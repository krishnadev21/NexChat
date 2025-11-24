import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'NexChat.settings')
django.setup()

from userauths.models import CustomUser
from chat.models import Messages
from django.db.models import Q, Max, Count, Case, When, IntegerField

user_id = CustomUser.objects.all().last().id # krish@email.com 

# partners = Messages.objects.filter(
#             Q(sender_id=user_id) | Q(recipient_id=user_id)
#         ).values(
#             partner=Case(
#                 When(sender_id=user_id, then='recipient'),
#                 default='sender'
#             )
#         ).distinct()

partners = CustomUser.objects.filter(
    Q(sent__recipient_id=user_id) |
    Q(received__sender_id=user_id)
).distinct()


print(partners)