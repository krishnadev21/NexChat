import os
from PIL import Image
from datetime import timedelta

from django.db import models
from django.utils import timezone
from django.db.models import Q, Max, Count
from django.core.exceptions import ValidationError

from userauths.models import CustomUser


class Messages(models.Model):  # Changed to singular form (convention for model naming)
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='message_owner')
    sender = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='sent_messages')
    recipient = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='received_messages')
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)  # More explicit than 'date'
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']  # Default ordering for queries
        indexes = [
            models.Index(fields=['user', 'recipient']),  # For faster lookups
            models.Index(fields=['is_read']),
        ]

    def __str__(self):
        return f"Message from {self.sender} to {self.recipient}"

    # Custom model method
    @classmethod
    def sendMessage(cls, from_user, to_user, body):
        """
        Creates and saves both sender and recipient copies of a message.
        Returns a tuple of (sender_message, recipient_message)
        """
        # Create sender copy
        sender_msg = cls.objects.create(
            user=from_user,
            sender=from_user,
            recipient=to_user,
            body=body,
            is_read=True
        )

        # Create recipient copy
        recipient_msg = cls.objects.create(
            user=to_user,
            sender=from_user,
            recipient=to_user,
            body=body,
            is_read=False
        )

        return sender_msg, recipient_msg

    @classmethod
    def getConversationsList(cls, user):
        """
        Returns all conversations for a user with the latest message info
        and unread counts for each conversation partner.
        """
        # Get all unique conversation partners
        partners = CustomUser.objects.filter(
            Q(received_messages__sender=user) | 
            Q(sent_messages__recipient=user)
        ).distinct()
        
        conversations = []
        
        for partner in partners:
            # Get the last message in the conversation
            last_message = cls.objects.filter(
                Q(sender=user, recipient=partner) | 
                Q(sender=partner, recipient=user)
            ).order_by('-created_at').first()

            # Skip if no messages exist with this partner
            if not last_message:
                continue

            # Count unread messages from this partner
            unread_count = cls.objects.filter(
                recipient=user,
                sender=partner,
                is_read=False
            ).count()

            conversations.append({
                'partner': partner,
                'last_message': last_message,
                'last_message_body': last_message.body if last_message else '',
                'unread_count': unread_count,
                'is_sent_last': last_message.sender == user if last_message else False,
                'last_message_time': last_message.created_at if last_message else None
            })
        
        # Sort by last message time (newest first)
        conversations.sort(
            key=lambda x: x['last_message_time'] or timezone.datetime.min, 
            reverse=True
        )
        
        return conversations

    @classmethod
    def getConversation(cls, user, partner_id):
        partner = CustomUser.objects.get(pk=partner_id)

        cls.objects.filter(
            user=user,          # Messages belonging to the current user (recipient's copy)
            sender=partner,     # Messages from this specific conversation partner
            recipient=user,     # Confirms these are received messages (not sent)
            is_read=False       # Only unread messages
        ).update(is_read=True)  # Marks them as read
        
        # Get all messages where user is involved (both sent and received)
        messages = cls.objects.filter(
            Q(user=user) &  # Only fetch messages belonging to current user
            (
                (Q(sender=user) & Q(recipient=partner)) |
                (Q(sender=partner) & Q(recipient=user))
            )
        ).order_by('created_at')
        
        # Annotate each message with whether the recipient has read their copy
        for message in messages:
            if message.sender == user:
                # For sent messages, check if recipient's copy is read
                recipient_copy = cls.objects.filter(
                    user=partner,
                    sender=user,
                    recipient=partner,
                    body=message.body,
                    created_at__range=(
                        message.created_at - timedelta(seconds=5),  # 5-second window before
                        message.created_at + timedelta(seconds=5)   # 5-second window after
                    )
                ).first()
                
                message.recipient_has_read = recipient_copy.is_read if recipient_copy else False
        
        return {
            'partner': partner,
            'messages': messages
        }
    
    def mark_as_read(self):
        """Marks the message as read if it isn't already."""
        if not self.is_read:
            self.is_read = True
            self.save(update_fields=['is_read'])



# from chat.models import *
# k = CustomUser.objects.get(pk=1)
# a = CustomUser.objects.get(pk=2)
# b = CustomUser.objects.get(pk=3)
# c = CustomUser.objects.get(pk=4)
# d = CustomUser.objects.get(pk=5)
# Message.get_conversations(user=k)

def userDirectoryPath(instance, filename):
    """Generate path for user uploads using username instead of ID"""
    # Get file extension
    ext = filename.split('.')[-1]
    # Generate new filename (avatar.{ext})
    new_filename = f'avatar.{ext}'
    return f'users/{instance.name}/{new_filename}'

class RoomModel(models.Model):
    # Basic fields
    name = models.CharField(max_length=100, blank=False, null=False)
    participants = models.ManyToManyField(CustomUser, related_name='room_participants')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # For group chats
    admin = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='admin_of_room'
    )

    # Avatar image with better handling
    avatar = models.ImageField(
        upload_to=userDirectoryPath,
        default='default.jpg',
        help_text='Profile picture (300x300 recommended)'
    )

    is_active = models.BooleanField(default=True)
    description = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        if self.name:
            return f"Room {self.name} ({self.admin})"
        
    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

        img = Image.open(self.avatar.path)
        if img.height > 300 or img.width > 300:
            output_size = (300, 300) # (height, width)
            img.thumbnail(output_size)
            img.save(self.avatar.path)

    def handleUsernameChange(self, old_username):
        """Handle avatar file movement when username changes"""
        old_path = self.avatar.path
        if os.path.exists(old_path):
            # Delete the old directory if empty
            try:
                os.removedirs(os.path.dirname(old_path))
            except OSError:
                pass  # Directory not empty or other error

    def get_display_name(self, user=None):
        """Get a display name for the room"""
        if self.name:
            return self.name
        
        return f"Group Chat ({self.participants.count()} members)"


class RoomMessagesModel(models.Model):
    room = models.ForeignKey(
        RoomModel, 
        on_delete=models.CASCADE,
        related_name='messages'  # This creates the reverse relationship
    )
    sender = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='messages_sent'
    )
    message = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    read = models.BooleanField(default=False)

    class Meta:
        ordering = ['timestamp']

    def __str__(self):
        return f"Message from {self.sender} in {self.room}"

    def save(self, *args, **kwargs):
        # Verify sender is a room participant before saving
        if not self.room.participants.filter(pk=self.sender.pk).exists():
            raise ValidationError("Sender must be a room participant")
        super().save(*args, **kwargs)









         