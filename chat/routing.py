from django.urls import path
from . import consumers

websocket_urlpatterns = [
    path('ws/socket-server/<int:to_user>', consumers.ChatConsumer.as_asgi()),
]