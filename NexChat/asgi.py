"""
ASGI config for NexChat project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.1/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack 
from chat import routing

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'NexChat.settings')

application = ProtocolTypeRouter({
    "http": get_asgi_application(),        # Handles normal HTTP
    "websocket": AuthMiddlewareStack(      # Handles WebSockets
        URLRouter(
            routing.websocket_urlpatterns
        )
    )
})