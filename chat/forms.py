from django import forms

from .models import (
    RoomModel,
    RoomMessagesModel,
)

from userauths.models import CustomUser

from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator


class RoomForm(forms.ModelForm):
    participants = forms.CharField(
        widget=forms.HiddenInput(),
        required=True
    )

    admin = forms.ModelChoiceField(
        label='',
        queryset=CustomUser.objects.none(),
        widget=forms.HiddenInput(),  # Hide since we'll auto-set it
        required=False
    )

    class Meta:
        model = RoomModel
        fields = ['name', 'participants', 'admin', 'avatar', 'description']
        widgets = {
            'avatar': forms.ClearableFileInput(attrs={
                'id': 'avatar',  # Important to match your JavaScript and label
                'name': 'avatar', # Important for request.FILES
                'class': 'hidden',
                'accept': 'image/*',
                'required': False,
            }),

            'name': forms.TextInput(attrs={
                'name': 'name', # Optional django assign default name 
                'autofocus': True,
                'placeholder': 'Group name',
                'required': True,
                'class': (
                    'w-full text-white px-4 py-3 border-b-2 border-gray-500 focus:outline-none focus:border-b-2 focus:border-[#00A884]'
                ), 
            }),

            'description': forms.TextInput(attrs={
                'name': 'description', # Optional django assign default name 
                'required': False,
                'placeholder': 'Add description (optional)',
                'class': (
                    'w-full text-white px-4 py-3 border-b-2 border-gray-500 focus:outline-none focus:border-b-2 focus:border-[#00A884]'
                ),
            }),
        }

    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop('user', None)  # Get the current user from kwargs
        super().__init__(*args, **kwargs)
    
        # Exclude the current user from the (participants, admin) list 
        if self.user:
            self.fields['participants'].queryset = CustomUser.objects.exclude(id=self.user.id)

    def clean_name(self):
        name = self.cleaned_data.get('name').strip()  # Trim whitespace
        
        # Length check
        if len(name) < 3:
            raise ValidationError("Room name must be at least 3 characters long.")
        
        # Case-insensitive duplicate check (optimized)
        if hasattr(self, 'user') and self.user:
            qs = RoomModel.objects.filter(name__iexact=name, admin=self.user)
            if self.instance.pk:  # Skip current instance during updates
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise ValidationError(
                    f"You already have a group named '{name}'  "
                    "Please choose a different name."
                )
        
        return name

    def clean_participant_ids(self):
        """Validate the participant IDs but return the original string"""
        ids_string = self.cleaned_data.get('participants', '')
        if not ids_string:
            raise forms.ValidationError("Please select at least one participant.")
        
        try:
            # Convert comma-separated string to list of integers for validation
            participant_ids = [int(id.strip()) for id in ids_string.split(',') if id.strip()]
            
            # Validate that all IDs correspond to real users
            valid_users_count = CustomUser.objects.filter(id__in=participant_ids).count()
            if valid_users_count != len(participant_ids):
                raise forms.ValidationError("Invalid participant selected.")
                
            # Return the original string, not the objects
            return ids_string
            
        except (ValueError, TypeError):
            raise forms.ValidationError("Invalid participant format.")
    
    def clean(self):
        """Add the participants to the form's cleaned_data after validation"""
        cleaned_data = super().clean()
        
        # Convert the participant_ids string to actual user objects
        # after the main validation is complete
        ids_string = cleaned_data.get('participants')
        if ids_string:
            participant_ids = [int(id.strip()) for id in ids_string.split(',') if id.strip()]
            cleaned_data['participants'] = CustomUser.objects.filter(id__in=participant_ids)
        
        return cleaned_data
