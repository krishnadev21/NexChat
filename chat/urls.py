from django.urls import path

from .views import (
    # GroupView,
    # GroupListView,
    # CreateGroupView,
    SaveMessageView,
    # SendMessageView,
    UserListView,
    fetchUserConversationsView,
    getConversationView,
    # DeleteMessageView,
    # DeleteConversationView,
    # ConversationsListView,
    # DeleteGroupMessage,
    # DeleteGroupView,
)

urlpatterns = [
    # Conversation
    path('user-conversations/', fetchUserConversationsView.as_view(), name='user-conversations'),
    path('conversation/<int:partner_id>', getConversationView.as_view(), name='conversation'),
    path('user-list/', UserListView.as_view(), name='user-list'),
    # path('delete-message/<int:pk>', DeleteMessageView.as_view(), name='delete-message'),
    path('save-message/', SaveMessageView.as_view(), name='save-message'),
    # path('send-message/', SendMessageView.as_view(), name='send-message'),
    # path('delete-conversation/<int:partner_id>', DeleteConversationView.as_view(), name='delete-conversation'),

    # Group
    # path('groups/', GroupListView.as_view(), name='groups'),
    # path('group/<int:pk>', GroupView.as_view(), name='group'),
    # path('create-group/', CreateGroupView.as_view(), name='create-group'),
    # path('delete-group-message/<int:pk>/<int:message_id>', DeleteGroupMessage.as_view(), name='delete-group-message'),
    # path('delete-group/<int:pk>', DeleteGroupView.as_view(), name='delete-group'),
]
