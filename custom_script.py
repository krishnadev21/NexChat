import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'NexChat.settings')
django.setup()

from userauths.models import CustomUser
from chat.models import Messages
from django.db.models import Q, Max, Count, Case, When, IntegerField

user_id = CustomUser.objects.all().last().id # krish@email.com 

def fetchUserConversations(user_id):
    
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
            is_read=False
        ).count()

        conversation_list.append({
            "partner": partner,
            "last_message": last_msg.body if last_msg else "",
            "last_message_time": last_msg.created_at if last_msg else None,
            "unread": unread_count
        })

    conversation_list.sort(key=lambda x: x["last_message_time"] or 0, reverse=True)

    return conversation_list  # <-- FIXED


# def fetchUserConversations(user_id):
#         # Identify all chat partners
#         partners = Messages.objects.filter(
#             Q(sender_id=user_id) | Q(recipient_id=user_id)
#         ).values(
#             partner=Case(
#                 When(sender_id=user_id, then='recipient_id'),
#                 default='sender_id',
#                 output_field=IntegerField()
#             )
#         ).distinct()

#         conversation_list = []

#         for p in partners:
#             partner_id = p["partner"]

#             # Last message exchanged between user & partner
#             last_msg = Messages.objects.filter(
#                 Q(sender_id=user_id, recipient_id=partner_id) |
#                 Q(sender_id=partner_id, recipient_id=user_id)
#             ).order_by("-created_at").first()

#             # Unread count
#             unread_count = Messages.objects.filter(
#                 sender_id=partner_id,
#                 recipient_id=user_id,
#                 is_read=False
#             ).count()

#             conversation_list.append({
#                 "partner_id": partner_id,
#                 "last_message": last_msg.body,
#                 "last_message_time": last_msg.created_at,
#                 "unread": unread_count
#             })

#         # Sort by last_message_time (DESC)
#         conversation_list.sort(key=lambda x: x["last_message_time"], reverse=True)

#         return conversation_list
