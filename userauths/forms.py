from django import forms
from django.contrib.auth.models import User
from django.contrib.auth.forms import (
    AuthenticationForm,
    UsernameField,
    UserCreationForm,
    PasswordResetForm,
    SetPasswordForm,
    PasswordChangeForm
)

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

# Get the custom user model
User = get_user_model()

class LoginForm(AuthenticationForm):
    username = forms.EmailField(  # Changed from UsernameField to EmailField
        label='Email',
        widget=forms.EmailInput(attrs={
            'autofocus': True,
            'placeholder': 'Email',
            # 'class': 'form-control',
            'class': 'appearance-none block w-full px-3 py-2 border border-gray-300 rounded-full shadow-md placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm'
        })
    )
    
    password = forms.CharField(
        widget=forms.PasswordInput(attrs={
            'autocomplete': 'current-password',
            'placeholder': 'Password',
            # 'class': 'form-control',
             'class': 'appearance-none block w-full px-3 py-2 border border-gray-300 rounded-full shadow-md placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm'
        })
    )

class CustomRegisterForm(UserCreationForm):
    username = forms.CharField(
        widget=forms.TextInput(attrs={
            'autofocus': True,
            'placeholder': 'Username',
            # 'class': 'form-control',
            'class': 'appearance-none block w-full px-3 py-2 border border-gray-300 rounded-full shadow-md placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm'
        })
    )
    email = forms.EmailField(
        widget=forms.EmailInput(attrs={
            'placeholder': 'Email',
            # 'class': 'form-control',
            'class': 'appearance-none block w-full px-3 py-2 border border-gray-300 rounded-full shadow-md placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm'
        })
    )
    password1 = forms.CharField(
        label='Password',
        widget=forms.PasswordInput(attrs={
            # 'class': 'form-control',
            'placeholder': 'Password',
            'class': 'appearance-none block w-full px-3 py-2 border border-gray-300 rounded-full shadow-md placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm'
        })
    )
    password2 = forms.CharField(
        label='Confirm Password',
        widget=forms.PasswordInput(attrs={
            # 'class': 'form-control',
            'placeholder': 'Confirm Password',
            'class': 'appearance-none block w-full px-3 py-2 border border-gray-300 rounded-full shadow-md placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm'
        })
    )

    class Meta:
        model = User
        fields = ['username', 'email', 'password1', 'password2']

    def clean_username(self):
        username = self.cleaned_data.get('username')
        if User.objects.filter(username=username).exists():
            raise ValidationError("Username already exists")
        return username

    def clean_email(self):
        email = self.cleaned_data.get('email')
        if User.objects.filter(email=email).exists():
            raise ValidationError("Email already exists")
        return email

class MyPasswordResetForm(PasswordResetForm):
    email = forms.EmailField(
        label='Email',
        widget=forms.EmailInput(attrs={
            'class': 'form-control',
            'placeholder': 'Enter a valid email'
        })
    )

class MySetPasswordForm(SetPasswordForm):
    new_password1 = forms.CharField(
        label='New Password',
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'autocomplete': 'current-password',
            'placeholder': 'Password'
        })
    )
    new_password2 = forms.CharField(
        label='Confirm New Password',
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'autocomplete': 'current-password',
            'placeholder': 'Confirm password'
        })
    )

class MyPasswordChangeForm(PasswordChangeForm):
    old_password = forms.CharField(
        label='Old Password',
        widget=forms.PasswordInput(attrs={
            'autofocus': True,
            'class': 'form-control',
            'autocomplete': 'current-password',
            'placeholder': 'Old password'
        })
    )
    new_password1 = forms.CharField(
        label='New Password',
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'autocomplete': 'current-password',
            'placeholder': 'New password'
        })
    )
    new_password2 = forms.CharField(
        label='Confirm Password',
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'autocomplete': 'current-password',
            'placeholder': 'Confirm password'
        })
    )

