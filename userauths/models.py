import os
from PIL import Image
from django.utils.text import slugify

from django.db import models
from django.core.validators import RegexValidator
from django.contrib.auth.models import AbstractUser

def userDirectoryPath(instance, filename):
    """Generate path for user uploads using username instead of ID"""
    # Get file extension
    ext = filename.split('.')[-1]
    # Generate new filename (avatar.{ext})
    new_filename = f'avatar.{ext}'
    return f'users/{instance.username}/{new_filename}'

class CustomUser(AbstractUser):
    # Username with validation
    username = models.CharField(
        max_length=20,
        unique=True,
        blank=False,
        validators=[
            RegexValidator(
                regex='^[a-zA-Z0-9_]+$',
                message='Username can only contain letters, numbers, and underscores',
                code='invalid_username'
            )
        ],
        help_text='Required. 20 characters or fewer. Letters, digits and _ only.'
    )
    
    # Email field (already unique)
    email = models.EmailField(
        unique=True,
        blank=False,
        help_text='Required. Must be a valid email address.'
    )
    
    # Bio with character counter
    bio = models.TextField(
        max_length=500,  # Increased from 100
        blank=True,  # Changed from False
        help_text='Tell us about yourself (500 characters max)'
    )
    
    # Avatar image with better handling
    avatar = models.ImageField(
        upload_to=userDirectoryPath,
        default='default.jpg',
        help_text='Profile picture (300x300 recommended)'
    )
    
    # Social media fields with better validation
    website = models.URLField(
        blank=True,
        default='',
        help_text='Your personal website'
    )
    facebook = models.URLField(
        blank=True,
        default='',
        help_text='Your Facebook profile URL'
    )
    instagram = models.URLField(  # Fixed typo from 'instagran'
        blank=True,
        default='',
        help_text='Your Instagram profile URL'
    )
    twitter = models.URLField(
        blank=True,
        default='',
        help_text='Your Twitter profile URL'
    )
    
    # Additional useful fields
    is_verified = models.BooleanField(
        default=False,
        help_text='Designates whether the user has verified their email'
    )
    last_activity = models.DateTimeField(
        auto_now=True,
        help_text='Last time the user was active'
    )

    # Set email as the USERNAME_FIELD
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']  # Email is already required by default

    class Meta:
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        ordering = ['-date_joined']

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

        img = Image.open(self.avatar.path)
        if img.height > 300 or img.width > 300:
            output_size = (300, 300) # (height, width)
            img.thumbnail(output_size)
            img.save(self.avatar.path)

    def __str__(self):
        # return f'{self.username} ({self.email})'
        return f'{self.username}'

    def handleUsernameChange(self, old_username):
        """Handle avatar file movement when username changes"""
        old_path = self.avatar.path
        if os.path.exists(old_path):
            # Delete the old directory if empty
            try:
                os.removedirs(os.path.dirname(old_path))
            except OSError:
                pass  # Directory not empty or other error

    def get_display_name(self):
        """Return a display name, falling back to username if first/last name not set"""
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.username