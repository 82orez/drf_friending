from __future__ import annotations

from datetime import date

from django.db import transaction
from django.db.models import Count, Exists, OuterRef
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings

from rest_framework import generics, permissions, status, serializers
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response

from teacher_applications.models import TeacherApplication, ApplicationStatusChoices

from .models import (
    DispatchRequest,
    DispatchApplication,
    DispatchAssignment,
    DispatchRequestStatus,
    DispatchApplicationStatus,
)
from .serializers import (
    DispatchRequestSerializer,
    DispatchApplicationSerializer,
    DispatchApplicationCreateSerializer,
    DispatchAssignmentSerializer,
    AdminAssignSerializer,
)
from .permissions import (
    IsAdminRole,
    IsManagerRole,
    IsTeacherRole,
    user_can_request_for_center,
)

import logging


logger = logging.getLogger(__name__)


def _wrap(success: bool, message: str, data=None, errors=None):
    payload = {"success": success, "message": message}
    if data is not None:
        payload["data"] = data
    if errors is not None:
        payload["errors"] = errors
    return payload


# -----------------------------------------------------------------------------
# Manager endpoints
# -----------------------------------------------------------------------------


class ManagerDispatchRequestListCreateView(generics.ListCreateAPIView):
    """매니저: 파견 요청 목록 조회/생성"""

    serializer_class = DispatchRequestSerializer
    permission_classes = [permissions.IsAuthenticated, IsManagerRole]

    def get_queryset(self):
        user = self.request.user
        qs = DispatchRequest.objects.filter(requested_by=user).select_related(
            "culture_center",
            "culture_center__center",
            "culture_center__region",
            "requested_by",
        )
        qs = qs.annotate(applications_count=Count("applications", distinct=True))
        return qs.order_by("-created_at")

    def perform_create(self, serializer):
        user = self.request.user
        culture_center_id = serializer.validated_data.get("culture_center").id

        if not user_can_request_for_center(user, culture_center_id):
            raise PermissionDenied("You are not allowed to request for this center.")

        instance = serializer.save(requested_by=user)
        logger.info(
            "DispatchRequest created by manager",
            extra={"user_id": getattr(user, "id", None), "request_id": instance.id},
        )

    def create(self, request, *args, **kwargs):
        try:
            response = super().create(request, *args, **kwargs)
            return Response(
                _wrap(
                    True,
                    "Dispatch request created. / 파견 요청이 등록되었습니다.",
                    response.data,
                ),
                status=status.HTTP_201_CREATED,
            )
        except PermissionDenied as e:
            return Response(
                _wrap(False, "Permission denied. / 권한이 없습니다.", errors=str(e)),
                status=status.HTTP_403_FORBIDDEN,
            )
        except Exception:
            logger.exception("Failed to create dispatch request")
            return Response(
                _wrap(False, "Failed. / 실패했습니다."),
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        return Response(_wrap(True, "OK", response.data))


class ManagerDispatchRequestDetailView(generics.RetrieveUpdateAPIView):
    """매니저: 본인이 만든 요청 상세 조회/수정 (공고 전까지 제한적 수정)"""

    serializer_class = DispatchRequestSerializer
    permission_classes = [permissions.IsAuthenticated, IsManagerRole]

    def get_queryset(self):
        user = self.request.user
        return (
            DispatchRequest.objects.filter(requested_by=user)
            .select_related(
                "culture_center",
                "culture_center__center",
                "culture_center__region",
                "requested_by",
            )
            .annotate(applications_count=Count("applications", distinct=True))
        )

    def perform_update(self, serializer):
        instance: DispatchRequest = self.get_object()
        # 공고(PUBLISHED) 이후에는 매니저가 임의 수정하지 않도록 제한
        if instance.status in (
            DispatchRequestStatus.PUBLISHED,
            DispatchRequestStatus.CLOSED,
            DispatchRequestStatus.ASSIGNED,
            DispatchRequestStatus.CONFIRMED,
        ):
            raise PermissionDenied(
                "Cannot edit after published. / 공고 이후 수정할 수 없습니다."
            )
        serializer.save()

    def update(self, request, *args, **kwargs):
        try:
            response = super().update(request, *args, **kwargs)
            return Response(_wrap(True, "Updated / 수정되었습니다.", response.data))
        except PermissionDenied as e:
            return Response(
                _wrap(False, "Permission denied. / 권한이 없습니다.", errors=str(e)),
                status=status.HTTP_403_FORBIDDEN,
            )


# -----------------------------------------------------------------------------
# Teacher endpoints
# -----------------------------------------------------------------------------


class TeacherPublishedDispatchRequestListView(generics.ListAPIView):
    """강사: 공고중(PUBLISHED) 요청 목록"""

    serializer_class = DispatchRequestSerializer
    permission_classes = [permissions.IsAuthenticated, IsTeacherRole]

    def get_queryset(self):
        user = self.request.user

        # 본인 teacher_application이 없으면 빈 목록
        try:
            ta = TeacherApplication.objects.get(user=user)
        except TeacherApplication.DoesNotExist:
            return DispatchRequest.objects.none()

        # is_applied annotate
        applied_subq = DispatchApplication.objects.filter(
            dispatch_request_id=OuterRef("pk"), teacher_application_id=ta.id
        )

        qs = (
            DispatchRequest.objects.filter(status=DispatchRequestStatus.PUBLISHED)
            .select_related(
                "culture_center",
                "culture_center__center",
                "culture_center__region",
                "requested_by",
            )
            .annotate(applications_count=Count("applications", distinct=True))
            .annotate(is_applied=Exists(applied_subq))
        )

        # deadline이 있으면 오늘 이전인 건 제외
        today = date.today()
        qs = qs.exclude(application_deadline__lt=today)

        return qs.order_by("-published_at", "-created_at")

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        return Response(_wrap(True, "OK", response.data))


class TeacherDispatchApplyView(generics.CreateAPIView):
    """강사: 공고에 지원"""

    serializer_class = DispatchApplicationCreateSerializer
    permission_classes = [permissions.IsAuthenticated, IsTeacherRole]

    def create(self, request, *args, **kwargs):
        dispatch_request_id = kwargs.get("pk")
        try:
            dr = DispatchRequest.objects.get(pk=dispatch_request_id)
        except DispatchRequest.DoesNotExist:
            raise NotFound("Dispatch request not found")

        if dr.status != DispatchRequestStatus.PUBLISHED:
            return Response(
                _wrap(False, "Not open. / 공고 중인 강좌만 지원할 수 있습니다."),
                status=status.HTTP_400_BAD_REQUEST,
            )

        if dr.application_deadline and dr.application_deadline < date.today():
            return Response(
                _wrap(False, "Deadline passed. / 지원 마감되었습니다."),
                status=status.HTTP_400_BAD_REQUEST,
            )

        ser = self.get_serializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)

        try:
            ta = TeacherApplication.objects.get(user=request.user)
        except TeacherApplication.DoesNotExist:
            return Response(
                _wrap(False, "Teacher application not found. / 이력서가 없습니다."),
                status=status.HTTP_400_BAD_REQUEST,
            )

        if ta.status != ApplicationStatusChoices.ACCEPTED:
            return Response(
                _wrap(
                    False,
                    "Only ACCEPTED teachers can apply. / 승인된 강사만 지원 가능합니다.",
                ),
                status=status.HTTP_403_FORBIDDEN,
            )

        message = ser.validated_data.get("message", "")

        try:
            obj, created = DispatchApplication.objects.get_or_create(
                dispatch_request=dr,
                teacher_application=ta,
                defaults={"message": message},
            )
            if not created:
                return Response(
                    _wrap(False, "Already applied. / 이미 지원했습니다."),
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except Exception:
            logger.exception("Failed to apply")
            return Response(
                _wrap(False, "Failed. / 실패했습니다."),
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        logger.info(
            "Teacher applied to dispatch request",
            extra={
                "user_id": getattr(request.user, "id", None),
                "dispatch_request_id": dr.id,
                "teacher_application_id": ta.id,
            },
        )

        return Response(
            _wrap(True, "Applied. / 지원이 완료되었습니다.", {"id": obj.id}),
            status=status.HTTP_201_CREATED,
        )


class TeacherMyDispatchApplicationsListView(generics.ListAPIView):
    """강사: 내가 지원한 목록"""

    serializer_class = DispatchApplicationSerializer
    permission_classes = [permissions.IsAuthenticated, IsTeacherRole]

    def get_queryset(self):
        user = self.request.user
        try:
            ta = TeacherApplication.objects.get(user=user)
        except TeacherApplication.DoesNotExist:
            return DispatchApplication.objects.none()

        return (
            DispatchApplication.objects.filter(teacher_application=ta)
            .select_related(
                "dispatch_request",
                "dispatch_request__culture_center",
                "dispatch_request__culture_center__center",
                "dispatch_request__culture_center__region",
            )
            .order_by("-created_at")
        )

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        return Response(_wrap(True, "OK", response.data))


# -----------------------------------------------------------------------------
# Admin endpoints
# -----------------------------------------------------------------------------


class AdminDispatchRequestListView(generics.ListAPIView):
    serializer_class = DispatchRequestSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get_queryset(self):
        qs = DispatchRequest.objects.all().select_related(
            "culture_center",
            "culture_center__center",
            "culture_center__region",
            "requested_by",
        )
        qs = qs.annotate(applications_count=Count("applications", distinct=True))
        # admin은 기본적으로 is_applied 의미 없으니 false로
        return qs.order_by("-created_at")

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        return Response(_wrap(True, "OK", response.data))


class AdminDispatchRequestDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = DispatchRequestSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    queryset = (
        DispatchRequest.objects.all()
        .select_related(
            "culture_center",
            "culture_center__center",
            "culture_center__region",
            "requested_by",
        )
        .annotate(applications_count=Count("applications", distinct=True))
    )

    def update(self, request, *args, **kwargs):
        response = super().update(request, *args, **kwargs)
        return Response(_wrap(True, "Updated / 수정되었습니다.", response.data))


class AdminPublishDispatchRequestView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    serializer_class = DispatchRequestSerializer

    def post(self, request, *args, **kwargs):
        pk = kwargs.get("pk")
        try:
            dr = DispatchRequest.objects.get(pk=pk)
        except DispatchRequest.DoesNotExist:
            raise NotFound("Dispatch request not found")

        if dr.status in (
            DispatchRequestStatus.CANCELED,
            DispatchRequestStatus.CONFIRMED,
        ):
            return Response(
                _wrap(False, "Cannot publish. / 공고할 수 없는 상태입니다."),
                status=status.HTTP_400_BAD_REQUEST,
            )

        # deadline은 body로 받을 수 있게 (선택)
        deadline = request.data.get("application_deadline")
        if deadline:
            # DRF가 자동 파싱을 못하면 문자열일 수 있으니 serializer로 처리
            try:
                deadline = serializers.DateField().to_internal_value(deadline)
            except Exception:
                return Response(
                    _wrap(False, "Invalid deadline"),
                    status=status.HTTP_400_BAD_REQUEST,
                )
            dr.application_deadline = deadline

        dr.status = DispatchRequestStatus.PUBLISHED
        dr.published_at = timezone.now()
        dr.save(
            update_fields=[
                "status",
                "published_at",
                "application_deadline",
                "updated_at",
            ]
        )

        logger.info("Dispatch request published", extra={"request_id": dr.id})

        # (선택) 공고 알림 메일 - 필요하면 활성화
        # self._notify_teachers(dr)

        data = DispatchRequestSerializer(dr, context={"request": request}).data
        return Response(_wrap(True, "Published / 공고되었습니다.", data))

    def _notify_teachers(self, dr: DispatchRequest):
        """승인된 강사들에게 공고 알림 (옵션)."""
        try:
            recipients = list(
                TeacherApplication.objects.filter(
                    status=ApplicationStatusChoices.ACCEPTED
                )
                .exclude(email__isnull=True)
                .exclude(email__exact="")
                .values_list("email", flat=True)
            )
            if not recipients:
                return
            subject = "New Dispatch Opportunity / 새 강사 파견 공고"
            message = f"""A new dispatch opportunity is available.

- Course: {dr.course_title}
- Center: {dr.culture_center}
- Language: {dr.teaching_language}

새 강사 파견 공고가 등록되었습니다.

- 강좌: {dr.course_title}
- 센터: {dr.culture_center}
- 언어: {dr.teaching_language}
""".strip()
            send_mail(
                subject=subject,
                message=message,
                from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
                recipient_list=recipients,
                fail_silently=True,
            )
        except Exception:
            logger.exception("Failed to notify teachers")


class AdminDispatchRequestApplicationsListView(generics.ListAPIView):
    serializer_class = DispatchApplicationSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get_queryset(self):
        pk = self.kwargs.get("pk")
        return (
            DispatchApplication.objects.filter(dispatch_request_id=pk)
            .select_related("teacher_application", "dispatch_request")
            .order_by("-created_at")
        )

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        return Response(_wrap(True, "OK", response.data))


class AdminAssignTeacherView(generics.GenericAPIView):
    """관리자: 특정 공고에 대해 지원자 1명을 최종 선정"""

    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    serializer_class = AdminAssignSerializer

    @transaction.atomic
    def post(self, request, *args, **kwargs):
        pk = kwargs.get("pk")
        try:
            dr = DispatchRequest.objects.select_for_update().get(pk=pk)
        except DispatchRequest.DoesNotExist:
            raise NotFound("Dispatch request not found")

        if hasattr(dr, "assignment"):
            return Response(
                _wrap(False, "Already assigned. / 이미 배치가 존재합니다."),
                status=status.HTTP_400_BAD_REQUEST,
            )

        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        application_id = ser.validated_data["application_id"]
        admin_memo = ser.validated_data.get("admin_memo", "")

        try:
            app = DispatchApplication.objects.select_for_update().get(
                pk=application_id, dispatch_request=dr
            )
        except DispatchApplication.DoesNotExist:
            return Response(
                _wrap(False, "Application not found. / 지원서를 찾을 수 없습니다."),
                status=status.HTTP_404_NOT_FOUND,
            )

        # 선정 처리
        DispatchApplication.objects.filter(dispatch_request=dr).exclude(
            pk=app.pk
        ).filter(
            status__in=[
                DispatchApplicationStatus.APPLIED,
                DispatchApplicationStatus.SHORTLISTED,
            ]
        ).update(
            status=DispatchApplicationStatus.REJECTED
        )

        app.status = DispatchApplicationStatus.SELECTED
        app.save(update_fields=["status"])

        assignment = DispatchAssignment.objects.create(
            dispatch_request=dr,
            selected_application=app,
            admin_memo=admin_memo,
        )

        dr.status = DispatchRequestStatus.ASSIGNED
        dr.save(update_fields=["status", "updated_at"])

        logger.info(
            "Dispatch assignment created",
            extra={"dispatch_request_id": dr.id, "application_id": app.id},
        )

        data = DispatchAssignmentSerializer(
            assignment, context={"request": request}
        ).data
        return Response(_wrap(True, "Assigned. / 강사가 배치되었습니다.", data))


class AdminDispatchAssignmentUpdateView(generics.RetrieveUpdateAPIView):
    serializer_class = DispatchAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    queryset = DispatchAssignment.objects.select_related(
        "dispatch_request",
        "selected_application",
        "selected_application__teacher_application",
    )

    def update(self, request, *args, **kwargs):
        response = super().update(request, *args, **kwargs)
        return Response(_wrap(True, "Updated / 수정되었습니다.", response.data))
