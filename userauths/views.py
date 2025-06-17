from django.views import View
from django.contrib import messages
from .forms import CustomRegisterForm
from django.shortcuts import redirect, render

class UserSignup(View):
    def get(self, request):
        form = CustomRegisterForm()
        return render(request, 'chat/signup.html', context={'form': form})

    def post(self, request):
        form = CustomRegisterForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, 'Account created successfully! Please log in to continue.')
            return redirect('login')
        
        messages.error(request, 'Unable to create an account. Please check your details and try again.')
        return render(request, 'chat/signup.html', context={'form': form})

