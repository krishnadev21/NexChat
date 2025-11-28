import os
from PIL import Image
from datetime import timedelta

from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.db.models import Q, Max, Count, Case, When, IntegerField


from userauths.models import CustomUser


class Messages(models.Model):
    sender = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="sent")
    recipient = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="received")

    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    delivered = models.BooleanField(default=False)
    seen = models.BooleanField(default=False)

    deleted_for_sender = models.BooleanField(default=False)
    deleted_for_recipient = models.BooleanField(default=False)

    class Meta:
        db_table = 'messages'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.sender} → {self.recipient}: {self.body[:20]}..."

    @classmethod
    def fetchUserConversations(cls, user_id):
        
        partners = CustomUser.objects.filter(
            Q(sent__recipient_id=user_id) |
            Q(received__sender_id=user_id)
        ).distinct()

        conversation_list = []

        for partner in partners:
            partner_id = partner.id
            
            last_msg = Messages.objects.filter(
                Q(sender_id=user_id, recipient_id=partner_id) |
                Q(sender_id=partner_id, recipient_id=user_id)
            ).order_by("-created_at").first()

            unread_count = Messages.objects.filter(
                sender_id=partner_id,
                recipient_id=user_id,
                seen=False
            ).count()

            conversation_list.append({
                "partner": partner,
                "last_message": last_msg.body if last_msg else "",
                "last_message_time": last_msg.created_at if last_msg else None,
                "unread_count": unread_count
            })

        conversation_list.sort(key=lambda x: x["last_message_time"] or 0, reverse=True)
        
        return conversation_list  # <-- FIXED
    
    @classmethod
    def getConversation(cls, user, partner_id):
        """
        Returns:
        {
            'partner': CustomUser instance,
            'messages': List of Messages,
        }
        """

        # Fetch partner safely
        try:
            partner = CustomUser.objects.get(id=partner_id)
        except CustomUser.DoesNotExist:
            return None  # Or raise exception

        # Fetch all messages exchanged (excluding deleted-for-user)
        messages = (
            Messages.objects.filter(
                Q(sender=user, recipient=partner, deleted_for_sender=False) |
                Q(sender=partner, recipient=user, deleted_for_recipient=False)
            )
            .select_related("sender", "recipient")  # PERFORMANCE BOOST
            .order_by("created_at")
        )

        # Mark messages as seen
        Messages.objects.filter(
            sender=partner,
            recipient=user,
            seen=False
        ).update(seen=True)

        print(f'12345678900945345743058325073984532')

        return {
            "partner": partner,
            "messages": messages,
        }

    @classmethod
    def saveMessage(cls, user_id, recipient_id, body):
        msg = Messages.objects.create(
            user_id=user_id,
            recipient_id=recipient_id,
            body=body
        )

        return msg.id, msg.created_at
    
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









         