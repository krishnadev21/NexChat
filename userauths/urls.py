from django.urls import path
from django.urls import reverse_lazy
from django.contrib.auth import views as auth_views
# from django.contrib.auth import views as auth_views

from .views import UserSignup

from .forms import (
    LoginForm,
    MySetPasswordForm,
    MyPasswordResetForm, 
    MyPasswordChangeForm, 
)

urlpatterns = [
    # User authentication
    path('', auth_views.LoginView.as_view(
        template_name='chat/login.html',
        authentication_form=LoginForm
    ), name='login'),
    # Method allowed (POST)
    path('logout/', auth_views.LogoutView.as_view(next_page=reverse_lazy('login')), name='logout'),
    path('signup/', UserSignup.as_view(), name='signup'),
]
