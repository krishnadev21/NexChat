from django.urls import path

from .views import (
    GroupView,
    GroupListView,
    CreateGroupView,
    SendMessageView,
    SearchUsersView,
    ConversationView,
    DeleteMessageView,
    DeleteConversationView,
    ConversationsListView,
    DeleteGroupMessage,
    DeleteGroupView,
)

urlpatterns = [
    # Conversation
    path('conversations-list/', ConversationsListView.as_view(), name='conversations-list'),
    path('conversation/<int:partner_id>', ConversationView.as_view(), name='conversation'),
    path('search-users/', SearchUsersView.as_view(), name='search-users'),
    path('send-message/', SendMessageView.as_view(), name='send-message'),
    path('delete-message/<int:pk>', DeleteMessageView.as_view(), name='delete-message'),
    path('delete-conversation/<int:partner_id>', DeleteConversationView.as_view(), name='delete-conversation'),

    # Group
    path('groups/', GroupListView.as_view(), name='groups'),
    path('group/<int:pk>', GroupView.as_view(), name='group'),
    path('create-group/', CreateGroupView.as_view(), name='create-group'),
    path('delete-group-message/<int:pk>/<int:message_id>', DeleteGroupMessage.as_view(), name='delete-group-message'),
    path('delete-group/<int:pk>', DeleteGroupView.as_view(), name='delete-group'),
]
