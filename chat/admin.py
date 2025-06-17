from django.contrib import admin

from import_export.admin import ImportExportModelAdmin

from .models import (
    Messages,
    RoomModel,
    RoomMessagesModel,
 )

class MessageAdmin(ImportExportModelAdmin):
    list_display = ['user', 'sender','recipient', 'body', 'is_read']
    list_filter = ['is_read']

admin.site.register(Messages, MessageAdmin)

class RoomAdmin(ImportExportModelAdmin):
    list_display = ['name', 'admin', 'created_at', 'description']
    
admin.site.register(RoomModel, RoomAdmin)

class RoomMessagesAdmin(ImportExportModelAdmin):
    list_display = ['room', 'sender', 'message']

admin.site.register(RoomMessagesModel, RoomMessagesAdmin)