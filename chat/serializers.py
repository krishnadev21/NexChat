from rest_framework import serializers
from .models import Messages, CustomUser

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'email', 'first_name', 'last_name']

class MessageCreateSerializer(serializers.ModelSerializer):
    # Accept user IDs → DRF converts them into user objects
    sender = serializers.PrimaryKeyRelatedField(queryset=CustomUser.objects.all())
    recipient = serializers.PrimaryKeyRelatedField(queryset=CustomUser.objects.all())

    class Meta:
        model = Messages
        fields = ['sender', 'recipient', 'body']

    def validate_sender(self, value):
        if not isinstance(value, CustomUser):
            raise serializers.ValidationError("Sender does not exist.")
        return value

    def validate_recipient(self, value):
        if not isinstance(value, CustomUser):
            raise serializers.ValidationError("Recipient does not exist.")
        return value

    def validate(self, data):
        if data['sender'] == data['recipient']:
            raise serializers.ValidationError("You cannot send a message to yourself.")
        return data
    
    def create(self, validated_data):
        # Any additional logic before creation goes here
        # validated_data['delivered'] = True
        return super().create(validated_data)
    
