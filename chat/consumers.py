import json

from channels.generic.websocket import AsyncWebsocketConsumer

def getPrivateGroupName(user1_id, user2_id):
    sorted_ids = sorted([user1_id, user2_id])
    return f"private_chat_{sorted_ids[0]}_{sorted_ids[1]}"


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope["user"] # User object
        recipient = self.scope["url_route"]["kwargs"]["to_user"]
        self.room_group_name = getPrivateGroupName(user.id, recipient)

        # Add this connection to the group (await directly)
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

        # Send message back to WebSocket client
        await self.send(text_data=json.dumps({
            'type': 'chat',
            'message': 'Connection Established'
        }))

    async def disconnect(self, close_code):
        # Remove from group when disconnecting
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        payload = json.loads(text_data)
        
        if payload.get("type") == "chat":
            message = payload.get("message")
            
            # Broadcast to the group (await directly)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'sender_id': self.scope["user"].id,
                    'message': message
                }
            )
        
        if payload.get("type") == "typing":
            # Broadcast typing status to the group
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "typing_status",
                    "user_id": self.scope["user"].id,
                    "is_typing": payload.get("is_typing", False),
                }
            )

    async def chat_message(self, event):
        # Send message back to WebSocket client
        await self.send(text_data=json.dumps({
            'type': 'chat',
            'sender_id': event["sender_id"],
            'message': event["message"]
        }))

    async def typing_status(self, event):
        # Send to WebSocket
        await self.send(text_data=json.dumps({
            "type": "typing",
            "user_id": event["user_id"],
            "is_typing": event["is_typing"]
        }))