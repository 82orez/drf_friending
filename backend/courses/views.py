from __future__ import annotations

from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError, PermissionDenied
from rest_framework.response import Response

from course_posts.models import (
    CoursePost,
    CoursePostStatusChoices,
    CourseApplication,
    CourseApplicationStatusChoices,
)
from .models import Course, CourseStatusChoices
from .serializers import CourseSerializer, ConfirmCourseSerializer
from .permissions import IsAdminOrManager


def _role(user) -> str:
    return getattr(user, "role", "") or ""


class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.all().select_related(
        "culture_center_branch", "teacher", "source_post"
    )
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        role = _role(self.request.user)

        # teacher면 본인 배정 강좌만 (TeacherApplication 연결 방식에 따라 조정 필요)
        if role == "teacher":
            teacher_application_id = self.request.query_params.get(
                "teacher_application_id"
            )
            if teacher_application_id:
                qs = qs.filter(teacher_id=teacher_application_id)
            else:
                qs = qs.none()

        return qs

    def create(self, request, *args, **kwargs):
        # 일반 생성은 admin/manager만
        if (
            _role(request.user) not in ["admin", "manager"]
            and not request.user.is_superuser
        ):
            raise PermissionDenied("권한이 없습니다.")
        return super().create(request, *args, **kwargs)

    @action(
        detail=False,
        methods=["post"],
        url_path=r"confirm-from-post/(?P<post_id>\d+)",
        permission_classes=[IsAuthenticated, IsAdminOrManager],
    )
    def confirm_from_post(self, request, post_id=None):
        """
        공고 기반 확정:
        - SELECTED 된 지원자(또는 body로 teacher_application_id)를 teacher로 확정
        - Course 생성 + status=CONFIRMED
        - post는 CLOSED로 전환 권장
        """
        serializer = ConfirmCourseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        teacher_application_id = serializer.validated_data["teacher_application_id"]

        try:
            post = CoursePost.objects.select_related(
                "dispatch_request", "dispatch_request__culture_center_branch"
            ).get(id=post_id)
        except CoursePost.DoesNotExist:
            raise ValidationError("공고를 찾을 수 없습니다.")

        if hasattr(post, "course") and post.course:
            raise ValidationError("이미 이 공고로 생성된 강좌가 존재합니다.")

        # 선택된 지원자 검증 (정석: SELECTED 상태인 지원서와 일치해야 함)
        try:
            selected_app = CourseApplication.objects.get(
                post=post,
                teacher_id=teacher_application_id,
                status=CourseApplicationStatusChoices.SELECTED,
            )
        except CourseApplication.DoesNotExist:
            raise ValidationError("해당 강사는 SELECTED 상태가 아닙니다.")

        dr = post.dispatch_request

        with transaction.atomic():
            course = Course.objects.create(
                source_post=post,
                culture_center_branch=dr.culture_center_branch,
                teacher_id=teacher_application_id,
                course_name=dr.course_name,
                start_date=dr.start_date,
                class_days=dr.class_days,
                class_time=dr.class_time,
                lecture_count=getattr(dr, "lecture_count", 1) or 1,
                status=CourseStatusChoices.CONFIRMED,
                manager_name=getattr(dr, "manager_name", "") or "",
                manager_phone=getattr(dr, "manager_phone", "") or "",
                manager_email=getattr(dr, "manager_email", "") or "",
                notes=getattr(dr, "notes", "") or "",
            )

            # 공고 마감 처리
            post.close()
            post.save()

        return Response(
            CourseSerializer(course, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["patch"],
        permission_classes=[IsAuthenticated, IsAdminOrManager],
    )
    def set_status(self, request, pk=None):
        course = self.get_object()
        new_status = request.data.get("status")

        if new_status not in dict(CourseStatusChoices.choices):
            raise ValidationError("유효하지 않은 status 입니다.")

        course.status = new_status
        course.save()
        return Response(CourseSerializer(course, context={"request": request}).data)
