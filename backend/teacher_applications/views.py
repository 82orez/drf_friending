from rest_framework import generics, permissions, filters, status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.exceptions import (
    ValidationError as DRFValidationError,
    NotFound,
    PermissionDenied,
)
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from django.core.mail import send_mail
from django.conf import settings

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group

from .models import TeacherApplication
from .serializers import TeacherApplicationSerializer


class TeacherApplicationCreateView(generics.CreateAPIView):
    """
    Public endpoint to create a teacher application.
    강사가 이력서를 제출하는 공개용 엔드포인트
    """

    queryset = TeacherApplication.objects.all()
    serializer_class = TeacherApplicationSerializer
    permission_classes = [permissions.IsAuthenticated]  # 로그인 필수
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request, *args, **kwargs):
        """기존 이력서 조회"""
        user = request.user
        try:
            application = TeacherApplication.objects.get(user=user)
            serializer = self.get_serializer(application)
            return Response(
                {
                    "success": True,
                    "message": "이력서를 조회했습니다.",
                    "data": serializer.data,
                    "exists": True,
                }
            )
        except TeacherApplication.DoesNotExist:
            return Response(
                {
                    "success": True,
                    "message": "등록된 이력서가 없습니다.",
                    "data": None,
                    "exists": False,
                }
            )

    def perform_create(self, serializer):
        user = self.request.user

        # === 핵심: 유저당 1개의 이력서만 허용 ===
        if TeacherApplication.objects.filter(user=user).exists():
            # DRF ValidationError 로 던지면 400 + 에러 내용이 JSON 으로 반환됨
            raise DRFValidationError(
                {
                    "non_field_errors": [
                        "You have already submitted a teacher application. "
                        "이미 이력서가 등록되어 있습니다. 기존 이력서만 수정할 수 있습니다."
                    ]
                }
            )

        # 여기까지 왔다는 것은 아직 이력서가 없다는 뜻
        instance = serializer.save(user=user)

        # 1) 지원자에게 이력서 등록 완료 이메일 발송
        self.send_confirmation_email(instance)

        # 2) superuser + Reviewers 그룹에게 새 이력서 등록 알림 메일
        self.send_new_application_notification_email(instance)

    def send_confirmation_email(self, instance):
        """지원서 제출 확인 이메일 발송 (지원자)"""
        try:
            subject = "Teacher Application Submitted / 강사 지원서 제출 완료"
            message = f"""
Dear {instance.first_name} {instance.last_name},

Your teacher application has been successfully submitted.
We will review your application and contact you soon.

안녕하세요 {instance.first_name} {instance.last_name}님,

강사 지원서가 성공적으로 제출되었습니다.
지원서를 검토한 후 곧 연락드리겠습니다.

Best regards,
Friending Team
""".strip()

            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[instance.email],
                fail_silently=True,  # 이메일 발송 실패해도 API는 성공 처리
            )
        except Exception:
            pass

    def send_new_application_notification_email(self, instance):
        """
        새 이력서 등록 알림 이메일 발송 (superuser + Reviewers 그룹)
        """
        try:
            User = get_user_model()

            recipients = set()

            # (A) superuser들
            superuser_emails = (
                User.objects.filter(is_superuser=True, is_active=True)
                .exclude(email__isnull=True)
                .exclude(email__exact="")
                .values_list("email", flat=True)
            )
            recipients.update(superuser_emails)

            # (B) Reviewers 그룹 유저들
            try:
                reviewers_group = Group.objects.get(name="Reviewers")
                reviewer_emails = (
                    reviewers_group.user_set.filter(is_active=True)
                    .exclude(email__isnull=True)
                    .exclude(email__exact="")
                    .values_list("email", flat=True)
                )
                recipients.update(reviewer_emails)
            except Group.DoesNotExist:
                # 그룹이 없으면 스킵
                pass

            # 지원자 본인에게 중복 발송 방지
            if instance.email:
                recipients.discard(instance.email)

            if not recipients:
                return

            subject = "New Teacher Application Submitted / 새 이력서(지원서) 등록 알림"
            message = f"""
A new teacher application has been submitted.

- Name: {instance.first_name} {instance.last_name}
- Email: {instance.email}
- Nationality: {getattr(instance, "nationality", "")}
- Visa Type: {getattr(instance, "visa_type", "")}

새 강사 이력서(지원서)가 등록되었습니다.

- 이름: {instance.first_name} {instance.last_name}
- 이메일: {instance.email}
- 국적: {getattr(instance, "nationality", "")}
- 비자 종류: {getattr(instance, "visa_type", "")}

Please review it in the admin/reviewer page.
관리자/검토 페이지에서 확인해주세요.
""".strip()

            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=list(recipients),
                fail_silently=True,
            )
        except Exception:
            # 이메일 발송 실패해도 지원서 제출은 성공으로 처리
            pass

    def create(self, request, *args, **kwargs):
        """Create 응답 커스터마이징"""
        try:
            response = super().create(request, *args, **kwargs)
            response.data = {
                "success": True,
                "message": "Application submitted successfully. / 지원서가 성공적으로 제출되었습니다.",
                "data": response.data,
            }
            return response

        # serializer / perform_create 에서 발생한 ValidationError 처리
        except DRFValidationError as e:
            return Response(
                {
                    "success": False,
                    "message": "Failed to submit application. / 지원서 제출에 실패했습니다.",
                    "errors": e.detail,  # str(e) 대신 detail 을 그대로 내려주면 구조가 유지됨
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 그 외 예상치 못한 예외
        except Exception as e:
            return Response(
                {
                    "success": False,
                    "message": "Failed to submit application. / 지원서 제출에 실패했습니다.",
                    "errors": str(e),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )


class TeacherApplicationUpdateView(generics.RetrieveUpdateDestroyAPIView):
    """
    사용자가 자신의 이력서를 조회/수정/삭제하는 엔드포인트
    - status가 REJECTED(불합격) 또는 NEW(신규)일 때만 삭제 허용
    """

    serializer_class = TeacherApplicationSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_object(self):
        """현재 로그인한 사용자의 이력서 조회"""
        try:
            return TeacherApplication.objects.get(user=self.request.user)
        except TeacherApplication.DoesNotExist:
            raise NotFound(
                detail={
                    "success": False,
                    "message": "등록된 이력서가 없습니다.",
                }
            )

    def retrieve(self, request, *args, **kwargs):
        """이력서 조회 응답 커스터마이징"""
        try:
            instance = self.get_object()
            serializer = self.get_serializer(instance)
            return Response(
                {
                    "success": True,
                    "message": "이력서를 조회했습니다.",
                    "data": serializer.data,
                }
            )
        except NotFound as e:
            return Response(
                e.detail,
                status=status.HTTP_404_NOT_FOUND,
            )

    def update(self, request, *args, **kwargs):
        """이력서 수정"""
        try:
            partial = kwargs.pop("partial", False)
            instance = self.get_object()

            # ✅ status가 NEW일 때만 수정 허용
            if instance.status != "NEW":
                raise PermissionDenied(
                    detail={
                        "success": False,
                        "message": "현재 상태에서는 이력서를 수정할 수 없습니다. (Only editable when status is NEW)",
                        "status": instance.status,
                    }
                )

            serializer = self.get_serializer(
                instance, data=request.data, partial=partial
            )
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)

            return Response(
                {
                    "success": True,
                    "message": "이력서가 성공적으로 수정되었습니다.",
                    "data": serializer.data,
                }
            )
        except NotFound as e:
            return Response(
                e.detail,
                status=status.HTTP_404_NOT_FOUND,
            )
        except PermissionDenied as e:
            return Response(
                e.detail,
                status=status.HTTP_403_FORBIDDEN,
            )
        except Exception as e:
            return Response(
                {
                    "success": False,
                    "message": "이력서 수정에 실패했습니다.",
                    "errors": str(e),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    def destroy(self, request, *args, **kwargs):
        """
        이력서 삭제
        - status가 REJECTED(불합격) 또는 NEW(신규)일 때만 삭제 허용
        """
        instance = self.get_object()

        allowed_statuses = {"REJECTED", "NEW"}
        if instance.status not in allowed_statuses:
            return Response(
                {
                    "success": False,
                    "message": "현재 상태에서는 이력서를 삭제할 수 없습니다.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # 파일 필드도 스토리지에서 삭제 (DB delete만으로는 파일이 남을 수 있음)
        try:
            if instance.profile_image_thumbnail:
                instance.profile_image_thumbnail.delete(save=False)
            if instance.profile_image:
                instance.profile_image.delete(save=False)
            if instance.visa_scan:
                instance.visa_scan.delete(save=False)
        except Exception:
            # 파일 삭제 실패해도 DB 삭제는 진행 (정책에 따라 바꿔도 됨)
            pass

        instance.delete()

        return Response(
            {
                "success": True,
                "message": "이력서가 삭제되었습니다.",
            },
            status=status.HTTP_200_OK,
        )


class TeacherApplicationListView(generics.ListAPIView):
    """
    Admin-only list view for reviewing applications.
    관리자용 이력서 목록 조회 엔드포인트
    """

    queryset = TeacherApplication.objects.all()
    serializer_class = TeacherApplicationSerializer
    permission_classes = [permissions.IsAdminUser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]

    # 검색 필드
    search_fields = [
        "first_name",
        "last_name",
        "email",
        "nationality",
        "visa_type",
        "teaching_languages",
    ]

    # 정렬
    ordering_fields = ["created_at", "visa_expiry_date", "status"]
    ordering = ["-created_at"]

    @method_decorator(cache_page(60 * 5))  # 5분 캐싱
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        """필터링 옵션 추가"""
        queryset = super().get_queryset()

        # 상태별 필터링
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # 비자 종류별 필터링
        visa_type = self.request.query_params.get("visa_type")
        if visa_type:
            queryset = queryset.filter(visa_type=visa_type)

        return queryset


class TeacherApplicationDetailView(generics.RetrieveUpdateAPIView):
    """
    Admin-only detail view for reviewing specific application.
    관리자용 개별 지원서 상세 조회/수정 엔드포인트
    """

    queryset = TeacherApplication.objects.all()
    serializer_class = TeacherApplicationSerializer
    permission_classes = [permissions.IsAdminUser]

    def update(self, request, *args, **kwargs):
        """상태 업데이트 시 알림 이메일 발송"""
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        old_status = instance.status

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        # 상태가 변경된 경우 이메일 발송
        new_status = serializer.instance.status
        if old_status != new_status and new_status in ["ACCEPTED", "REJECTED"]:
            self.send_status_update_email(serializer.instance, new_status)

        return Response(serializer.data)

    def send_status_update_email(self, instance, status):
        """상태 변경 알림 이메일"""
        try:
            if status == "ACCEPTED":
                subject = "Congratulations! Application Accepted / 축하합니다! 지원서가 승인되었습니다"
                message = f"Dear {instance.first_name}, your teacher application has been accepted!"
            else:  # REJECTED
                subject = "Application Update / 지원서 결과 안내"
                message = f"Dear {instance.first_name}, thank you for your application. We will keep your profile for future opportunities."

            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[instance.email],
                fail_silently=True,
            )
        except Exception:
            pass
