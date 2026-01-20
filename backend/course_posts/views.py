from __future__ import annotations

from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError, PermissionDenied
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from teacher_applications.models import TeacherApplication

from .models import (
    CoursePost,
    CourseApplication,
    CoursePostStatusChoices,
    CourseApplicationStatusChoices,
)
from .serializers import (
    CoursePostSerializer,
    CoursePostCreateSerializer,
    CourseApplicationSerializer,
)
from .permissions import IsAdminOrManager, IsTeacher


def _role(user) -> str:
    return getattr(user, "role", "") or ""


class CoursePostViewSet(viewsets.ModelViewSet):
    queryset = (
        CoursePost.objects.all()
        .select_related("dispatch_request", "dispatch_request__culture_center_branch")
        .annotate(applications_count=Count("applications", distinct=True))
    )
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ["create"]:
            return CoursePostCreateSerializer
        return CoursePostSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        role = _role(self.request.user)

        # teacher는 게시된 공고만
        if role == "teacher":
            qs = qs.filter(status=CoursePostStatusChoices.PUBLISHED)
            # 마감일이 지난 공고는 숨기고 싶으면 아래 주석 해제
            # qs = qs.filter(Q(application_deadline__isnull=True) | Q(application_deadline__gte=timezone.now()))
        return qs

    def create(self, request, *args, **kwargs):
        if (
            _role(request.user) not in ["admin", "manager"]
            and not request.user.is_superuser
        ):
            raise PermissionDenied("권한이 없습니다.")
        return super().create(request, *args, **kwargs)

    @action(
        detail=True,
        methods=["patch"],
        permission_classes=[IsAuthenticated, IsAdminOrManager],
    )
    def publish(self, request, pk=None):
        post = self.get_object()
        post.publish()
        post.save()
        return Response(CoursePostSerializer(post, context={"request": request}).data)

    @action(
        detail=True,
        methods=["patch"],
        permission_classes=[IsAuthenticated, IsAdminOrManager],
    )
    def close(self, request, pk=None):
        post = self.get_object()
        post.close()
        post.save()
        return Response(CoursePostSerializer(post, context={"request": request}).data)

    @action(
        detail=True,
        methods=["get"],
        permission_classes=[IsAuthenticated, IsAdminOrManager],
    )
    def applications(self, request, pk=None):
        post = self.get_object()
        qs = post.applications.select_related("teacher").all()
        return Response(
            CourseApplicationSerializer(
                qs, many=True, context={"request": request}
            ).data
        )

    @action(
        detail=True, methods=["post"], permission_classes=[IsAuthenticated, IsTeacher]
    )
    def apply(self, request, pk=None):
        post = self.get_object()

        # 마감 체크
        if post.application_deadline and post.application_deadline < timezone.now():
            raise ValidationError("지원 마감된 공고입니다.")

        # 현재 로그인 user와 TeacherApplication 연결 방식은 프로젝트마다 다를 수 있어서,
        # 여기서는 가장 흔한 패턴(teacher_application_id를 body로 받음)을 사용합니다.
        teacher_application_id = request.data.get("teacher_application_id")
        if not teacher_application_id:
            raise ValidationError(
                {"teacher_application_id": "teacher_application_id가 필요합니다."}
            )

        try:
            teacher = TeacherApplication.objects.get(id=teacher_application_id)
        except TeacherApplication.DoesNotExist:
            raise ValidationError("강사 정보를 찾을 수 없습니다.")

        # TODO: teacher가 request.user의 소유인지(본인 이력서인지) 검증 로직을 프로젝트 방식에 맞게 추가 권장

        message = request.data.get("message", "")

        app, created = CourseApplication.objects.get_or_create(
            post=post,
            teacher=teacher,
            defaults={
                "message": message,
                "status": CourseApplicationStatusChoices.APPLIED,
            },
        )
        if not created:
            # 재지원 허용 정책: WITHDRAWN이면 APPLIED로 되돌릴지 결정
            if app.status == CourseApplicationStatusChoices.WITHDRAWN:
                app.status = CourseApplicationStatusChoices.APPLIED
                app.message = message
                app.save()
            else:
                raise ValidationError("이미 지원한 공고입니다.")

        return Response(
            CourseApplicationSerializer(app, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True, methods=["post"], permission_classes=[IsAuthenticated, IsTeacher]
    )
    def withdraw(self, request, pk=None):
        post = self.get_object()
        teacher_application_id = request.data.get("teacher_application_id")
        if not teacher_application_id:
            raise ValidationError(
                {"teacher_application_id": "teacher_application_id가 필요합니다."}
            )

        try:
            app = CourseApplication.objects.get(
                post=post, teacher_id=teacher_application_id
            )
        except CourseApplication.DoesNotExist:
            raise ValidationError("지원 내역이 없습니다.")

        app.withdraw()
        app.save()
        return Response(
            CourseApplicationSerializer(app, context={"request": request}).data
        )

    @action(
        detail=True,
        methods=["patch"],
        permission_classes=[IsAuthenticated, IsAdminOrManager],
    )
    def set_application_status(self, request, pk=None):
        post = self.get_object()
        application_id = request.data.get("application_id")
        new_status = request.data.get("status")

        if not application_id or not new_status:
            raise ValidationError({"application_id": "필수", "status": "필수"})

        try:
            app = CourseApplication.objects.get(id=application_id, post=post)
        except CourseApplication.DoesNotExist:
            raise ValidationError("지원서를 찾을 수 없습니다.")

        if new_status not in dict(CourseApplicationStatusChoices.choices):
            raise ValidationError("유효하지 않은 status 입니다.")

        # 선택(SELECTED)은 1명만 허용 (정석 운영)
        if new_status == CourseApplicationStatusChoices.SELECTED:
            with transaction.atomic():
                CourseApplication.objects.filter(
                    post=post,
                    status=CourseApplicationStatusChoices.SELECTED,
                ).exclude(id=app.id).update(
                    status=CourseApplicationStatusChoices.SHORTLISTED
                )
                app.status = new_status
                app.save()
        else:
            app.status = new_status
            app.save()

        return Response(
            CourseApplicationSerializer(app, context={"request": request}).data
        )
