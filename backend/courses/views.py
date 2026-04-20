from __future__ import annotations

from django.db import transaction

from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from course_posts.models import CourseApplication, CourseApplicationStatusChoices
from dispatch_requests.models import DispatchRequest
from teacher_applications.models import TeacherApplication

from .emails import notify_confirmation_results
from .models import Course, CourseStatusChoices
from .permissions import IsAdminOrManager, IsTeacher
from .serializers import CourseSerializer, CourseConfirmSerializer


def _get_my_teacher_application_or_error(user) -> TeacherApplication:
    try:
        return user.teacher_application
    except Exception:
        raise ValidationError(
            "먼저 강사 이력서(TeacherApplication)를 제출한 뒤 이용할 수 있습니다."
        )


class CourseMyListView(generics.ListAPIView):
    """GET /api/courses/my/"""

    permission_classes = [permissions.IsAuthenticated, IsTeacher]
    serializer_class = CourseSerializer

    def get_queryset(self):
        teacher = _get_my_teacher_application_or_error(self.request.user)
        return (
            Course.objects.select_related(
                "culture_center", "teacher", "source_dispatch_request"
            )
            .filter(teacher=teacher)
            .order_by("-created_at")
        )


class CourseAdminListView(generics.ListAPIView):
    """GET /api/courses/admin/list/"""

    permission_classes = [permissions.IsAuthenticated, IsAdminOrManager]
    serializer_class = CourseSerializer
    queryset = Course.objects.select_related(
        "culture_center", "teacher", "source_dispatch_request"
    ).order_by("-created_at")


class CourseAdminDetailView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /api/courses/admin/<id>/"""

    permission_classes = [permissions.IsAuthenticated, IsAdminOrManager]
    serializer_class = CourseSerializer
    queryset = Course.objects.select_related(
        "culture_center", "teacher", "source_dispatch_request"
    )


class CourseConfirmFromDispatchView(APIView):
    """
    POST /api/courses/admin/confirm-from-dispatch/<dispatch_id>/
    body(optional): { teacher_id?: number }

    - 기본은: 해당 파견 요청에서 status=SELECTED 지원자 1명을 자동으로 찾음
    - 없으면 teacher_id로 지정 가능(단, 해당 강사가 SELECTED여야 함)
    - Course 생성 후 DispatchRequest는 CLOSED 처리
    """

    permission_classes = [permissions.IsAuthenticated, IsAdminOrManager]

    def post(self, request, dispatch_id: int):
        try:
            dr = DispatchRequest.objects.select_related("culture_center").get(
                pk=dispatch_id
            )
        except DispatchRequest.DoesNotExist:
            raise ValidationError("파견 요청을 찾을 수 없습니다.")

        if hasattr(dr, "course") and dr.course:
            raise ValidationError("이미 이 요청으로 생성된 강좌가 존재합니다.")

        body = CourseConfirmSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        teacher_id = body.validated_data.get("teacher_id")

        selected_qs = CourseApplication.objects.filter(
            dispatch_request=dr, status=CourseApplicationStatusChoices.SELECTED
        )
        if teacher_id is not None:
            selected_qs = selected_qs.filter(teacher_id=teacher_id)

        selected = selected_qs.select_related("teacher").first()
        if not selected:
            raise ValidationError(
                "SELECTED 상태의 지원자를 찾을 수 없습니다. 먼저 지원자를 선정해 주세요."
            )

        with transaction.atomic():
            course = Course.objects.create(
                source_dispatch_request=dr,
                culture_center=dr.culture_center,
                teaching_language=dr.teaching_language,
                course_title=dr.course_title,
                instructor_type=getattr(dr, "instructor_type", "") or "",
                teacher=selected.teacher,
                class_days=dr.class_days,
                start_time=dr.start_time,
                end_time=dr.end_time,
                start_date=dr.start_date,
                lecture_count=getattr(dr, "lecture_count", 1) or 1,
                students_count=dr.students_count,
                applicant_name=dr.applicant_name,
                applicant_phone=dr.applicant_phone,
                applicant_email=dr.applicant_email,
                extra_requirements=dr.extra_requirements,
                status=CourseStatusChoices.CONFIRMED,
                notes="",
            )

            dr.close()
            dr.save()

        transaction.on_commit(lambda: notify_confirmation_results(dr, selected))

        return Response(
            CourseSerializer(course, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )
