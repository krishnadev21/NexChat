from django import forms

from .models import (
    RoomModel,
    RoomMessagesModel,
)

from userauths.models import CustomUser

from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator


class RoomForm(forms.ModelForm):
    avatar = forms.ImageField(
        widget=forms.FileInput(attrs={
            'accept': 'image/*',
            'class': (
                'block w-full px-3 py-2 border border-gray-300 rounded-full shadow-md '
                'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 '
                'file:mr-4 file:py-1.5 file:px-4 file:rounded-full file:border-0 '
                'file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 '
                'hover:file:bg-indigo-100 cursor-pointer text-gray-500'
            ),
            'placeholder': 'Upload avatar (300×300)',
        }),
        validators=[FileExtensionValidator(['jpg', 'jpeg', 'png'])],
        required=False
    )

    participants = forms.ModelMultipleChoiceField(
        queryset=CustomUser.objects.none(),  # Temporary empty queryset
        widget=forms.SelectMultiple(attrs={
            'class': (
                'block w-full rounded-md border border-gray-300 py-2 pl-3 pr-8 shadow-sm '
                'text-gray-400 placeholder-gray-400 text-sm leading-6 '
                'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 '
                'hover:border-gray-400 transition-colors duration-150 '
                'cursor-pointer min-h-[42px]'
            ),
            'multiple': 'multiple',
        }),
        required=True,
        help_text='Hold Ctrl/Cmd to select multiple users',
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
            'name': forms.TextInput(attrs={
                'autofocus': True,
                # 'class': 'form-control',
                'placeholder': 'Room name',
                'class': (
                    'appearance-none block w-full px-3 py-2 border border-gray-300 rounded-full '
                    'shadow-md placeholder-gray-400 focus:outline-none focus:ring-indigo-500 '
                    'focus:border-indigo-500 sm:text-sm text-gray-400'  
                ), 
            }),

            'description': forms.Textarea(attrs={
                'rows': 3,
                'placeholder': 'Description...',
                'class': (
                    'block w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 '
                    'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 '
                    'text-gray-400 placeholder-gray-400 sm:text-sm sm:leading-6 '
                    'transition duration-150 ease-in-out hover:border-gray-400 '
                    'resize-y min-h-[100px]'
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

    def clean_participants(self):
        participants = self.cleaned_data.get('participants')
        if not participants:
            raise ValidationError("At least one participant is required.")
        return participants

    # def clean(self):
    #     cleaned_data = super().clean()
    #     admin = cleaned_data.get('admin')
    #     participants = cleaned_data.get('participants')
        
    #     if admin and self.user not in participants:
    #         raise ValidationError({
    #             'admin': "Admin must be one of the participants."
    #         })
        
    #     return cleaned_data