import os
import uuid
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
    ext = filename.split('.')[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    return f"room_avatars/{instance.id}/{filename}"

class GroupModel(models.Model):
    name = models.CharField(max_length=100)
    participants = models.ManyToManyField(
        CustomUser, 
        related_name='room_participants'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    admin = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='admin_of_room'
    )

    avatar = models.ImageField(
        upload_to=userDirectoryPath,
        default='default.jpg'
    )

    is_active = models.BooleanField(default=True)
    description = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.name} (Admin: {self.admin})"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

        # Resize avatar only if not default
        if self.avatar and self.avatar.name != 'default.jpg':
            avatar_path = self.avatar.path

            try:
                img = Image.open(avatar_path)
            except (FileNotFoundError, ValueError):
                return  # Ignore if file missing or corrupted

            # Resize only if needed
            if img.height > 300 or img.width > 300:
                img.thumbnail((300, 300))
                img.save(avatar_path)

class GroupMessagesModel(models.Model):
    room = models.ForeignKey(
        GroupModel,
        on_delete=models.CASCADE,
        related_name='messages'
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
        ordering = ["timestamp"]
        indexes = [
            models.Index(fields=["room", "timestamp"]),
            models.Index(fields=["sender"]),
        ]

    def __str__(self):
        return f"{self.sender} → {self.room}: {self.message[:20]}"

    def save(self, *args, **kwargs):
        if not self.room.participants.filter(pk=self.sender.pk).exists():
            raise ValidationError("Sender must be a participant of this room.")
        super().save(*args, **kwargs)










         