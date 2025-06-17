from django.contrib import admin
from import_export.admin import ImportExportModelAdmin

from .models import CustomUser

class CustomUserAdmin(ImportExportModelAdmin):
    list_display = ['username', 'email', 'last_activity']
    
admin.site.register(CustomUser, CustomUserAdmin)