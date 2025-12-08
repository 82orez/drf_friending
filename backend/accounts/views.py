from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.contrib.auth import login, logout
from django.core.mail import send_mail
from django.conf import settings
from django.shortcuts import get_object_or_404
from .models import User, EmailVerificationToken, PasswordResetToken
from .serializers import (
    UserRegistrationSerializer,
    LoginSerializer,
    EmailVerificationSerializer,
    ResendVerificationSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    UserSerializer,
)
from django.middleware.csrf import get_token
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import JSONParser, FormParser, MultiPartParser

import logging

# 로거 생성
logger = logging.getLogger(__name__)  # 'accounts.views'로 로그 남음


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    logger.info(
        f"User registration attempt for email: {request.data.get('email', 'unknown')}"
    )

    serializer = UserRegistrationSerializer(data=request.data)
    if serializer.is_valid():
        try:
            user = serializer.save()
            logger.info(f"User registered successfully: {user.email}")

            # Create email verification token
            token = EmailVerificationToken.objects.create(user=user)

            # Send verification email
            verification_url = (
                f"{settings.FRONTEND_URL}/auth/verify-email?token={token.token}"
            )
            subject = "Verify your email address"
            message = f"""
            Hi! {user.email},
        
            Please click the link below to verify your email address:
            {verification_url}
        
            This link will expire in 24 hours.
        
            If you didn't create an account, please ignore this email.
            """

            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                fail_silently=False,
            )

            logger.info(f"Verification email sent to: {user.email}")

            return Response(
                {
                    "message": "Registration successful. Please check your email for verification.",
                    "user": UserSerializer(user).data,
                },
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            logger.error(
                f"Registration failed for {request.data.get('email', 'unknown')}: {str(e)}"
            )
            return Response(
                {"error": "Registration failed. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
    else:
        logger.warning(f"Invalid registration data: {serializer.errors}")

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([AllowAny])
def verify_email(request):
    logger.info("Email verification attempt")

    serializer = EmailVerificationSerializer(data=request.data)
    if serializer.is_valid():
        token = serializer.validated_data["token"]

        try:
            verification_token = EmailVerificationToken.objects.get(token=token)

            if verification_token.is_used:
                logger.warning(f"Attempt to use already used token: {token}")
                return Response(
                    {"error": "Token already used."}, status=status.HTTP_400_BAD_REQUEST
                )

            if verification_token.is_expired():
                logger.warning(
                    f"Attempt to use expired token for user: {verification_token.user.email}"
                )
                return Response(
                    {"error": "Token expired."}, status=status.HTTP_400_BAD_REQUEST
                )

            # Verify email
            user = verification_token.user
            user.is_email_verified = True
            user.save()

            # Mark token as used
            verification_token.is_used = True
            verification_token.save()

            logger.info(f"Email verified successfully for user: {user.email}")

            return Response(
                {"message": "Email verified successfully."}, status=status.HTTP_200_OK
            )

        except EmailVerificationToken.DoesNotExist:
            logger.warning(f"Invalid token used for verification: {token}")
            return Response(
                {"error": "Invalid token."}, status=status.HTTP_400_BAD_REQUEST
            )

    logger.warning(f"Invalid verification data: {serializer.errors}")
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([AllowAny])
def resend_verification(request):
    email = request.data.get("email", "unknown")
    logger.info(f"Resend verification attempt for email: {email}")

    serializer = ResendVerificationSerializer(data=request.data)
    if serializer.is_valid():
        email = serializer.validated_data["email"]

        try:
            user = User.objects.get(email=email)

            if user.is_email_verified:
                logger.warning(
                    f"Attempt to resend verification for already verified email: {email}"
                )
                return Response(
                    {"error": "Email already verified."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Invalidate old tokens
            EmailVerificationToken.objects.filter(user=user, is_used=False).update(
                is_used=True
            )

            # Create new token
            token = EmailVerificationToken.objects.create(user=user)

            # Send verification email
            verification_url = (
                f"{settings.FRONTEND_URL}/auth/verify-email?token={token.token}"
            )
            subject = "Verify your email address"
            message = f"""
            Hi! {user.email},
        
            Please click the link below to verify your email address:
            {verification_url}
        
            This link will expire in 24 hours.
        
            If you didn't create an account, please ignore this email.
            """

            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                fail_silently=False,
            )

            logger.info(f"Verification email resent successfully to: {email}")

            return Response(
                {"message": "Verification email sent."}, status=status.HTTP_200_OK
            )

        except User.DoesNotExist:
            logger.warning(
                f"Attempt to resend verification for non-existent user: {email}"
            )
            return Response(
                {"error": "User with this email does not exist."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    logger.warning(f"Invalid resend verification data: {serializer.errors}")
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    email = request.data.get("email", "unknown")
    logger.info(f"Login attempt for email: {email}")

    serializer = LoginSerializer(data=request.data, context={"request": request})
    if serializer.is_valid():
        user = serializer.validated_data["user"]
        login(request, user)

        logger.info(f"Login successful for user: {user.email}")

        return Response(
            {"message": "Login successful.", "user": UserSerializer(user).data},
            status=status.HTTP_200_OK,
        )

    logger.warning(f"Login failed for email: {email} - {serializer.errors}")
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
def logout_view(request):
    user_email = request.user.email if request.user.is_authenticated else "anonymous"
    logger.info(f"Logout request from user: {user_email}")

    logout(request)

    logger.info(f"Logout successful for user: {user_email}")
    return Response({"message": "Logout successful."}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([AllowAny])
def password_reset_request(request):
    email = request.data.get("email", "unknown")
    logger.info(f"Password reset request for email: {email}")

    serializer = PasswordResetRequestSerializer(data=request.data)
    if serializer.is_valid():
        email = serializer.validated_data["email"]

        try:
            # User exists (validated by serializer), proceed with token creation
            user = User.objects.get(email=email)

            # Invalidate old tokens
            PasswordResetToken.objects.filter(user=user, is_used=False).update(
                is_used=True
            )

            # Create new token
            token = PasswordResetToken.objects.create(user=user)

            # Send password reset email
            reset_url = (
                f"{settings.FRONTEND_URL}/auth/reset-password?token={token.token}"
            )
            subject = "Password Reset Request"
            message = f"""
            Hi! {user.email},
    
            You requested a password reset. Please click the link below to reset your password:
            {reset_url}
    
            This link will expire in 1 hour.
    
            If you didn't request a password reset, please ignore this email.
            """

            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                fail_silently=False,
            )

            logger.info(f"Password reset email sent successfully to: {email}")

            return Response(
                {"message": "Password reset email sent."}, status=status.HTTP_200_OK
            )
        except Exception as e:
            logger.error(f"Password reset email send failed for {email}: {str(e)}")
            return Response(
                {"error": "Failed to send password reset email."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    logger.warning(f"Invalid password reset request data: {serializer.errors}")
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([AllowAny])
def password_reset_confirm(request):
    logger.info("Password reset confirmation attempt")

    serializer = PasswordResetConfirmSerializer(data=request.data)
    if serializer.is_valid():
        token = serializer.validated_data["token"]
        password = serializer.validated_data["password"]

        try:
            reset_token = PasswordResetToken.objects.get(token=token)

            if reset_token.is_used:
                logger.warning(
                    f"Attempt to use already used password reset token: {token}"
                )
                return Response(
                    {"error": "Token already used."}, status=status.HTTP_400_BAD_REQUEST
                )

            if reset_token.is_expired():
                logger.warning(
                    f"Attempt to use expired password reset token for user: {reset_token.user.email}"
                )
                return Response(
                    {"error": "Token expired."}, status=status.HTTP_400_BAD_REQUEST
                )

            # Reset password
            user = reset_token.user
            user.set_password(password)
            user.save()

            # Mark token as used
            reset_token.is_used = True
            reset_token.save()

            logger.info(f"Password reset successfully for user: {user.email}")

            return Response(
                {"message": "Password reset successfully."}, status=status.HTTP_200_OK
            )

        except PasswordResetToken.DoesNotExist:
            logger.warning(f"Invalid password reset token used: {token}")
            return Response(
                {"error": "Invalid token."}, status=status.HTTP_400_BAD_REQUEST
            )

    logger.warning(f"Invalid password reset confirmation data: {serializer.errors}")
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "PATCH"])
@parser_classes([JSONParser, FormParser, MultiPartParser])
def user_profile(request):
    user_email = request.user.email if request.user.is_authenticated else "anonymous"
    logger.info(f"User profile request from user: {user_email}")

    if request.method == "GET":
        serializer = UserSerializer(request.user)
        logger.debug(f"User profile data returned for user: {user_email}")
        return Response(serializer.data)

    elif request.method == "PATCH":
        logger.info(f"Profile update request from user: {user_email}")

        # profile_image만 업데이트 가능하도록 제한
        allowed_fields = ["profile_image"]
        update_data = {
            key: value for key, value in request.data.items() if key in allowed_fields
        }

        if not update_data:
            logger.warning(
                f"No valid fields provided for profile update by user: {user_email}"
            )
            return Response(
                {"error": "No valid fields provided for update."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = UserSerializer(request.user, data=update_data, partial=True)

        if serializer.is_valid():
            try:
                user = serializer.save()
                logger.info(f"Profile updated successfully for user: {user_email}")

                return Response(
                    {
                        "message": "Profile updated successfully.",
                        "user": UserSerializer(user).data,
                    },
                    status=status.HTTP_200_OK,
                )
            except Exception as e:
                logger.error(f"Profile update failed for user {user_email}: {str(e)}")
                return Response(
                    {"error": "Profile update failed. Please try again."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
        else:
            logger.warning(
                f"Invalid profile update data for user {user_email}: {serializer.errors}"
            )
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
@permission_classes([AllowAny])
def get_csrf_token(request):
    logger.debug("CSRF token request")

    token = get_token(request)

    logger.debug("CSRF token generated successfully")
    return Response({"csrfToken": token})
