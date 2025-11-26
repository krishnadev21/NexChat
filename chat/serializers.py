from rest_framework import serializers

from .models import Messages
from userauths.models import CustomUser

class CustomUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'email']

class MessageSerializer(serializers.ModelSerializer):
    sender = CustomUserSerializer()
    recipient = CustomUserSerializer()

    class Meta:
        model = Messages
        fields = ['id', 'body', 'created_at', 'is_read', 'sender', 'recipient']

class ConversationSerializer(serializers.Serializer):
    partner = CustomUserSerializer()
    last_message = MessageSerializer()
    last_message_body = serializers.CharField()
    unread_count = serializers.IntegerField()
    is_sent_last = serializers.BooleanField()
