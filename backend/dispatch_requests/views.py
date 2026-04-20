from __future__ import annotations

from django.db import transaction
from django.db.models import Count
from django.utils import timezone

from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from course_posts.models import CourseApplication, CourseApplicationStatusChoices
from course_posts.serializers import CourseApplicationSerializer
from teacher_applications.models import TeacherApplication

from .models import DispatchRequest, DispatchRequestStatusChoices
from .serializers import (
    DispatchRequestSerializer,
    DispatchRequestAdminSerializer,
    ApplySerializer,
    SetApplicationStatusSerializer,
)
from .emails import (
    send_dispatch_request_received_email,
    send_open_notification_to_matched_teachers,
)


def _role(user) -> str:
    return getattr(user, "role", "") or ""


def _is_admin_or_manager(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    return user.is_superuser or _role(user) in ["admin", "manager"]


def _get_my_teacher_application_or_error(user) -> TeacherApplication:
    try:
        return user.teacher_application
    except Exception:
        raise ValidationError(
            "먼저 강사 이력서(TeacherApplication)를 제출한 뒤 이용할 수 있습니다."
        )


class DispatchRequestCreateView(generics.CreateAPIView):
    """
    매니저가 강사 파견 요청 생성
    POST /api/dispatch-requests/
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DispatchRequestSerializer
    queryset = DispatchRequest.objects.select_related("culture_center", "requester")

    def perform_create(self, serializer):
        dr = serializer.save(requester=self.request.user)
        transaction.on_commit(lambda: send_dispatch_request_received_email(dr))


class DispatchRequestMyListView(generics.ListAPIView):
    """
    GET /api/dispatch-requests/my/
    매니저: 내 요청 목록
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DispatchRequestSerializer

    def get_queryset(self):
        return (
            DispatchRequest.objects.select_related("culture_center", "requester")
            .filter(requester=self.request.user)
            .order_by("-created_at")
        )


class DispatchRequestOpenListView(generics.ListAPIView):
    """
    GET /api/dispatch-requests/open/
    강사: 게시된(OPEN) 공고 목록
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DispatchRequestSerializer

    def get_queryset(self):
        return (
            DispatchRequest.objects.select_related(
                "culture_center", "culture_center__center", "culture_center__region"
            )
            .annotate(_applications_count=Count("applications"))
            .filter(status=DispatchRequestStatusChoices.OPEN)
            .order_by("-published_at", "-created_at")
        )


class DispatchRequestDetailView(generics.RetrieveAPIView):
    """
    GET /api/dispatch-requests/<id>/

    - admin/manager/staff/superuser: 전체 접근
    - 매니저(요청자): 본인 요청만
    - 강사: OPEN 상태인 요청만 접근 (공고 상세 열람)
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DispatchRequestSerializer

    def get_queryset(self):
        qs = DispatchRequest.objects.select_related(
            "culture_center", "requester"
        ).annotate(_applications_count=Count("applications"))
        user = self.request.user
        role = _role(user)
        if _is_admin_or_manager(user) or user.is_staff:
            return qs
        if role == "teacher":
            return qs.filter(status=DispatchRequestStatusChoices.OPEN)
        return qs.filter(requester=user)


class DispatchRequestAdminListView(generics.ListAPIView):
    """
    GET /api/dispatch-requests/admin/list/
    관리자: 전체 목록
    """

    permission_classes = [permissions.IsAdminUser]
    serializer_class = DispatchRequestSerializer
    queryset = (
        DispatchRequest.objects.select_related("culture_center", "requester")
        .annotate(_applications_count=Count("applications"))
        .order_by("-created_at")
    )


class DispatchRequestAdminDetailView(generics.RetrieveUpdateAPIView):
    """
    GET/PATCH /api/dispatch-requests/admin/<id>/
    관리자: 상세 조회 + notes/deadline 등 업데이트
    """

    permission_classes = [permissions.IsAdminUser]
    serializer_class = DispatchRequestAdminSerializer
    queryset = DispatchRequest.objects.select_related("culture_center", "requester")


class DispatchRequestOpenView(APIView):
    """
    POST /api/dispatch-requests/admin/<id>/open/
    상태 → OPEN 전환 + 반경+언어 일치 강사에게 공고 이메일 자동 발송
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk: int):
        if not _is_admin_or_manager(request.user):
            raise PermissionDenied("권한이 없습니다.")

        with transaction.atomic():
            dr = (
                DispatchRequest.objects.select_for_update()
                .select_related("culture_center", "requester")
                .get(pk=pk)
            )

            if dr.status == DispatchRequestStatusChoices.OPEN:
                raise ValidationError("이미 게시된 요청입니다.")
            dr.open()
            dr.save()

        # 트랜잭션 커밋 이후 자동 이메일 발송
        transaction.on_commit(
            lambda: send_open_notification_to_matched_teachers(dr)
        )

        return Response(
            DispatchRequestSerializer(dr).data, status=status.HTTP_200_OK
        )


class DispatchRequestCloseView(APIView):
    """
    POST /api/dispatch-requests/admin/<id>/close/
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk: int):
        if not _is_admin_or_manager(request.user):
            raise PermissionDenied("권한이 없습니다.")

        with transaction.atomic():
            dr = (
                DispatchRequest.objects.select_for_update()
                .select_related("culture_center", "requester")
                .get(pk=pk)
            )
            dr.close()
            dr.save()

        return Response(
            DispatchRequestSerializer(dr).data, status=status.HTTP_200_OK
        )


class DispatchRequestApplyView(APIView):
    """
    POST /api/dispatch-requests/<id>/apply/
    body: { message?: string }
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk: int):
        if _role(request.user) != "teacher":
            raise PermissionDenied("강사만 지원할 수 있습니다.")

        dr = DispatchRequest.objects.get(pk=pk)

        if dr.status != DispatchRequestStatusChoices.OPEN:
            raise ValidationError("게시된(OPEN) 요청에만 지원할 수 있습니다.")

        if dr.application_deadline and dr.application_deadline < timezone.now():
            raise ValidationError("지원 마감된 공고입니다.")

        teacher = _get_my_teacher_application_or_error(request.user)

        body = ApplySerializer(data=request.data)
        body.is_valid(raise_exception=True)
        message = body.validated_data.get("message", "")

        app, created = CourseApplication.objects.get_or_create(
            dispatch_request=dr,
            teacher=teacher,
            defaults={
                "message": message,
                "status": CourseApplicationStatusChoices.APPLIED,
            },
        )

        if not created:
            if app.status == CourseApplicationStatusChoices.WITHDRAWN:
                app.status = CourseApplicationStatusChoices.APPLIED
                app.message = message
                app.save()
            else:
                raise ValidationError("이미 지원한 공고입니다.")

        return Response(
            CourseApplicationSerializer(app).data, status=status.HTTP_201_CREATED
        )


class DispatchRequestWithdrawView(APIView):
    """
    POST /api/dispatch-requests/<id>/withdraw/
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk: int):
        if _role(request.user) != "teacher":
            raise PermissionDenied("강사만 지원 취소할 수 있습니다.")

        dr = DispatchRequest.objects.get(pk=pk)
        teacher = _get_my_teacher_application_or_error(request.user)

        try:
            app = CourseApplication.objects.get(dispatch_request=dr, teacher=teacher)
        except CourseApplication.DoesNotExist:
            raise ValidationError("지원 내역이 없습니다.")

        app.withdraw()
        app.save()
        return Response(
            CourseApplicationSerializer(app).data, status=status.HTTP_200_OK
        )


class DispatchRequestApplicationsView(generics.ListAPIView):
    """
    GET /api/dispatch-requests/admin/<id>/applications/
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CourseApplicationSerializer

    def get_queryset(self):
        if not _is_admin_or_manager(self.request.user):
            raise PermissionDenied("권한이 없습니다.")
        dr_id = self.kwargs.get("pk")
        return (
            CourseApplication.objects.select_related("teacher", "dispatch_request")
            .filter(dispatch_request_id=dr_id)
            .order_by("-created_at")
        )


class DispatchRequestSetApplicationStatusView(APIView):
    """
    PATCH /api/dispatch-requests/admin/<id>/set-application-status/
    body: { application_id: number, status: string }
    """

    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk: int):
        if not _is_admin_or_manager(request.user):
            raise PermissionDenied("권한이 없습니다.")

        dr = DispatchRequest.objects.get(pk=pk)

        body = SetApplicationStatusSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        application_id = body.validated_data["application_id"]
        new_status = body.validated_data["status"]

        if new_status not in dict(CourseApplicationStatusChoices.choices):
            raise ValidationError("유효하지 않은 status 입니다.")

        try:
            app = CourseApplication.objects.get(pk=application_id, dispatch_request=dr)
        except CourseApplication.DoesNotExist:
            raise ValidationError("지원서를 찾을 수 없습니다.")

        if new_status == CourseApplicationStatusChoices.SELECTED:
            with transaction.atomic():
                CourseApplication.objects.filter(
                    dispatch_request=dr,
                    status=CourseApplicationStatusChoices.SELECTED,
                ).exclude(pk=app.pk).update(
                    status=CourseApplicationStatusChoices.SHORTLISTED
                )

                app.status = new_status
                app.save()
        else:
            app.status = new_status
            app.save()

        return Response(
            CourseApplicationSerializer(app).data, status=status.HTTP_200_OK
        )
