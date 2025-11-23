from django.contrib import admin

from import_export.admin import ImportExportModelAdmin

from .models import (
    Messages,
    RoomModel,
    RoomMessagesModel,
 )

class MessageAdmin(ImportExportModelAdmin):
    list_display = ['sender','recipient', 'body', 'created_at']
    # list_filter = ['delivered']

admin.site.register(Messages, MessageAdmin)

class RoomAdmin(ImportExportModelAdmin):
    list_display = ['name', 'admin', 'created_at', 'description']
    
admin.site.register(RoomModel, RoomAdmin)

class RoomMessagesAdmin(ImportExportModelAdmin):
    list_display = ['room', 'sender', 'message']

admin.site.register(RoomMessagesModel, RoomMessagesAdmin)