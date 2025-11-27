from rest_framework import serializers
from .models import Messages, CustomUser

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'email', 'first_name', 'last_name']

class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    recipient = UserSerializer(read_only=True)
    sender_id = serializers.IntegerField(write_only=True)
    recipient_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = Messages
        fields = [
            'id', 'sender', 'recipient', 'sender_id', 'recipient_id',
            'body', 'created_at', 'delivered', 'seen',
            'deleted_for_sender', 'deleted_for_recipient'
        ]
        read_only_fields = ['id', 'created_at', 'delivered', 'seen']

class MessageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Messages
        fields = ['sender_id', 'recipient_id', 'body']

    def validate_sender_id(self, value):
        if not CustomUser.objects.filter(id=value).exists():
            raise serializers.ValidationError("Sender does not exist.")
        return value

    def validate_recipient_id(self, value):
        if not CustomUser.objects.filter(id=value).exists():
            raise serializers.ValidationError("Recipient does not exist.")
        return value

    def validate(self, data):
        if data['sender_id'] == data['recipient_id']:
            raise serializers.ValidationError("Cannot send message to yourself.")
        return data