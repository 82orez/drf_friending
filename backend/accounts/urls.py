from django.urls import path
from . import views

app_name = "accounts"

urlpatterns = [
    path("csrf/", views.get_csrf_token, name="csrf"),
    path("register/", views.register, name="register"),
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("verify-email/", views.verify_email, name="verify_email"),
    path("resend-verification/", views.resend_verification, name="resend_verification"),
    path(
        "password-reset-request/",
        views.password_reset_request,
        name="password_reset_request",
    ),
    path(
        "password-reset-confirm/",
        views.password_reset_confirm,
        name="password_reset_confirm",
    ),
    path("profile/", views.user_profile, name="profile"),
]
