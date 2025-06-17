from django.views import View
from django.db.models import Q
from django.contrib import messages
from django.shortcuts import render, redirect
from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import (
    JsonResponse,
    HttpResponseRedirect,
)

from chat.models import CustomUser
from userauths.forms import CustomRegisterForm
from .serializers import ConversationSerializer
from .models import (
    Messages,
    RoomModel,
    RoomMessagesModel,
)
from .forms import (
    RoomForm,
)

class ConversationsListView(LoginRequiredMixin, View):
    login_url = '/'  # Redirect URL if not authenticated
    redirect_field_name = 'next'  # Default (optional)

    def get(self, request):
        search_query = request.GET.get('search', '').strip()
        conversations_list = []
        
        try:
            search_partner = None
            if search_query:
                # Search by username (case-insensitive)
                search_partner = CustomUser.objects.filter(
                    username__icontains=search_query
                ).exclude(id=request.user.id).first()  # Get first match or None
            
            conversations_list = Messages.getConversationsList(
                user=request.user, 
                search_partner=search_partner
            )
        
        except Exception as e:
            messages.error(request, f"Error loading conversations: {str(e)}")
            conversations_list = []  # Ensure we always have a list
        
        return render(request, 'chat/conversations_list.html', {
            'search_query': search_query,
            'conversations': conversations_list
        })
    
class SearchUsersView(LoginRequiredMixin, View):
    login_url = '/'  # Redirect URL if not authenticated
    redirect_field_name = 'next'  # Default (optional)

    def get(self, request):
        search_query = request.GET.get('search', '').strip()
        
        try:
            if search_query:
                # Search by username or email (case-insensitive)
                searched_users = CustomUser.objects.filter(
                    Q(username__icontains=search_query) |
                    Q(email__icontains=search_query)
                ).exclude(id=request.user.id)  # Exclude current user

            else:
                # Return random users (excluding current user)
                searched_users = CustomUser.objects.exclude(
                    id=request.user.id
                ).order_by('username')[:20]  # Limit to 20 random users
            
        except Exception as e:
            messages.error(request, f"{str(e)}")
        
        return render(request, 'chat/search_users.html', {
            'search_query': search_query,
            'searched_users': searched_users,
        })

class ConversationView(LoginRequiredMixin, View):
    login_url = '/'  # Redirect URL if not authenticated
    redirect_field_name = 'next'  # Default (optional)

    def get(self, request, partner_id):
        conversation = Messages.getConversation(user=request.user, partner_id=partner_id)
        return render(request, 'chat/conversation.html', context={'conversation': conversation})

class SendMessageView(LoginRequiredMixin, View):
    login_url = '/'  # Redirect URL if not authenticated
    redirect_field_name = 'next'  # Default (optional)

    def post(self, request):
        to_user_username = request.POST.get('to_user')
        body = request.POST.get('body')

        to_user = CustomUser.objects.get(username=to_user_username)
        Messages.sendMessage(request.user, to_user, body)

        return JsonResponse({"message": f"Message Sent to {to_user_username}."})
    
class DeleteMessageView(LoginRequiredMixin, View):
    login_url = '/'  # Redirect URL if not authenticated
    redirect_field_name = 'next'  # Default (optional)

    def get(self, request, pk):
        Messages.objects.get(pk=pk).delete()
        messages.success(request, f"Message deleted.")
        
        return HttpResponseRedirect(request.META.get('HTTP_REFERER'))

class DeleteConversationView(LoginRequiredMixin, View):
    login_url = '/'  # Redirect URL if not authenticated
    redirect_field_name = 'next'  # Default (optional)

    def get(self, request, partner_id):
        try:
            partner = CustomUser.objects.get(pk=partner_id)
            
            # Delete both copies (current user's copies only)
            deleted_count, _ = Messages.objects.filter(
                Q(user=request.user) &  # Current user's copy
                (Q(sender=request.user, recipient=partner) | 
                 Q(sender=partner, recipient=request.user))
            ).delete()
            
            messages.success(request, f"Deleted {deleted_count} messages")
            return HttpResponseRedirect(request.META.get('HTTP_REFERER'))
            
        except Exception as e:
            messages.error(request, f"Error deleting conversation: {str(e)}")
            return HttpResponseRedirect(request.META.get('HTTP_REFERER'))
        
class CreateGroupView(LoginRequiredMixin, View):
    login_url = '/'  # Redirect URL if not authenticated
    redirect_field_name = 'next'  # Default (optional)

    def get(self, request):
        form = RoomForm(user=request.user)
        return render(request, 'chat/create_group.html', {'form': form})
    
    def post(self, request):
        form = RoomForm(request.POST, request.FILES, user=request.user)  # Keep this form instance
        
        try:
            if form.is_valid():  # This checks your clean_name() automatically
                room = form.save(commit=False)
                room.admin = request.user
                room.save()
                form.save_m2m()
                
                if request.user not in room.participants.all():
                    room.participants.add(request.user)
                
                messages.success(request, f"Group '{room.name}' created successfully!")
                return redirect('groups')
            
            # If NOT valid, render with existing form (which contains errors)
            return render(request, 'chat/create_group.html', {'form': form})
            
        except Exception as e:
            messages.error(request, f"Error creating group: {str(e)}")
            return render(request, 'chat/create_group.html', {'form': form})
        
class GroupListView(LoginRequiredMixin, View):
    login_url = '/'  # Redirect URL if not authenticated
    redirect_field_name = 'next'  # Default (optional)

    def get(self, request):
        search_query = request.GET.get('search', '').strip()

        try:
            # Get groups where user is a participant
            groups = RoomModel.objects.filter(
                participants=request.user
            ).distinct().order_by('-created_at')

            if search_query:
                groups = groups.filter(name__icontains=search_query)

            # Prefetch the last message for each group
            for group in groups:
                group.last_message = group.messages.order_by('-timestamp').first()

        except Exception as e:
            messages.error(request, f"Error loading conversations: {str(e)}")
            groups = []  # Fallback to empty list if error occurs
        
        return render(request, 'chat/groups.html', {
            'groups': groups,
            'search_query': search_query
        })

class GroupView(LoginRequiredMixin, View):
    login_url = '/'  # Redirect URL if not authenticated
    redirect_field_name = 'next'  # Default (optional)

    def get(self, request, pk):
        try:
            # Get the group with prefetched messages and participants
            group = RoomModel.objects.get(pk=pk)
            
            messages = group.messages.all().order_by('timestamp')
            print(f'Messages --> {messages}')
        
        except Exception as e:
            messages.error(request, f"Error loading conversations: {str(e)}")
            
        return render(request, 'chat/group.html', {
            'group': group,
            'chat_messages': messages
        })
    
    def post(self, request, pk):
        try:
            group = RoomModel.objects.get(pk=pk)
            body = request.POST.get('body', '').strip()
            
            # Create the message
            RoomMessagesModel.objects.create(
                room=group,
                sender=request.user,
                message=body
            )
            
            return JsonResponse({"message": f"{request.user.username} send a message on {group.name}."})
            
        except RoomModel.DoesNotExist:
            messages.error(request, "Group not found or access denied")
            return redirect('group', pk=pk)

class DeleteGroupView(LoginRequiredMixin, View):
    login_url = '/'  # Redirect URL if not authenticated
    redirect_field_name = 'next'  # Default (optional)

    def get(self, request, pk):
        try:
            group = RoomModel.objects.get(pk=pk)
            
            # Check permissions (only admin can delete)
            if request.user != group.admin:
                messages.error(request, "Only the group admin can delete this group")
                return redirect('group', pk=pk)
            
            # Delete the group (messages will be automatically deleted due to CASCADE)
            group_name = group.name
            group.delete()
            
            messages.success(request, f"Group '{group_name}' and all its messages were deleted")
            return redirect('groups')  # Redirect to group list
            
        except RoomModel.DoesNotExist:
            messages.error(request, "Group not found")
            return redirect('groups')

class DeleteGroupMessage(LoginRequiredMixin, View):
    login_url = '/'  # Redirect URL if not authenticated
    redirect_field_name = 'next'  # Default (optional)

    def get(self, request, pk, message_id):
        try:
            # Get message and verify permissions
            message = RoomMessagesModel.objects.get(
                pk=message_id,
                room__pk=pk,
                room__participants=request.user  # User must be in group
            )
            
            # Only allow delete if user is sender or group admin
            if request.user == message.sender:
                message.delete()
                messages.success(request, f"Message deleted.")
            else:
                messages.error(request, "You can't delete this message")
                
        except RoomMessagesModel.DoesNotExist:
            messages.error(request, "Message not found")
            
        return HttpResponseRedirect(request.META.get('HTTP_REFERER'))