from __future__ import annotations

from django.db import transaction
from django.db.models import Count
from django.utils import timezone

from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from teacher_applications.models import TeacherApplication

from dispatch_requests.models import DispatchRequestStatusChoices  # ✅ add

from .models import (
    CoursePost,
    CourseApplication,
    CoursePostStatusChoices,
    CourseApplicationStatusChoices,
)
from .permissions import IsAdminOrManager, IsTeacher
from .serializers import (
    CoursePostSerializer,
    CoursePostCreateSerializer,
    CourseApplicationSerializer,
    CoursePostApplySerializer,
    CourseApplicationStatusUpdateSerializer,
)


def _role(user) -> str:
    return getattr(user, "role", "") or ""


def _get_my_teacher_application_or_error(user) -> TeacherApplication:
    """
    ✅ 핵심: teacher_application_id를 받지 않고,
    로그인 사용자(user)의 OneToOne TeacherApplication을 사용한다.
    """
    try:
        return user.teacher_application
    except Exception:
        # OneToOne가 아직 없으면(이력서 제출 전) 지원 불가
        raise ValidationError(
            "먼저 강사 이력서(TeacherApplication)를 제출한 뒤 지원할 수 있습니다."
        )


class CoursePostListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/course-posts/          (teacher: PUBLISHED만)
    POST /api/course-posts/          (admin/manager)
    """

    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = (
            CoursePost.objects.select_related(
                "dispatch_request", "dispatch_request__culture_center"
            )
            .annotate(applications_count=Count("applications"))
            .order_by("-created_at")
        )

        # ✅ optional filter: /api/course-posts/?dispatch_request_id=<id>
        drid = self.request.query_params.get("dispatch_request_id")
        if drid:
            try:
                qs = qs.filter(dispatch_request_id=int(drid))
            except Exception:
                pass

        if _role(self.request.user) == "teacher":
            qs = qs.filter(status=CoursePostStatusChoices.PUBLISHED)

        return qs

    def get_serializer_class(self):
        if self.request.method == "POST":
            return CoursePostCreateSerializer
        return CoursePostSerializer

    def create(self, request, *args, **kwargs):
        if not (
            request.user.is_superuser or _role(request.user) in ["admin", "manager"]
        ):
            raise PermissionDenied("권한이 없습니다.")
        return super().create(request, *args, **kwargs)


class CoursePostDetailView(generics.RetrieveAPIView):
    """
    GET /api/course-posts/<id>/
    teacher는 PUBLISHED만 접근 가능
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CoursePostSerializer

    def get_queryset(self):
        qs = CoursePost.objects.select_related(
            "dispatch_request", "dispatch_request__culture_center"
        ).annotate(applications_count=Count("applications"))
        if _role(self.request.user) == "teacher":
            qs = qs.filter(status=CoursePostStatusChoices.PUBLISHED)
        return qs


class CoursePostAdminListView(generics.ListAPIView):
    """
    GET /api/course-posts/admin/list/
    optional query:
      - ?dispatch_request_id=<int>
      - ?dispatch_request=<int>  (호환)
    """

    permission_classes = [permissions.IsAuthenticated, IsAdminOrManager]
    serializer_class = CoursePostSerializer

    def get_queryset(self):
        qs = (
            CoursePost.objects.select_related(
                "dispatch_request", "dispatch_request__culture_center"
            )
            .annotate(applications_count=Count("applications"))
            .order_by("-created_at")
        )

        drid = self.request.query_params.get(
            "dispatch_request_id"
        ) or self.request.query_params.get("dispatch_request")
        if drid:
            try:
                drid_int = int(drid)
                qs = qs.filter(dispatch_request_id=drid_int)
            except ValueError:
                pass

        return qs


class CoursePostAdminDetailView(generics.RetrieveUpdateAPIView):
    """
    GET/PATCH /api/course-posts/admin/<id>/
    """

    permission_classes = [permissions.IsAuthenticated, IsAdminOrManager]
    serializer_class = CoursePostSerializer
    queryset = CoursePost.objects.select_related(
        "dispatch_request", "dispatch_request__culture_center"
    ).annotate(applications_count=Count("applications"))


class CoursePostPublishView(APIView):
    """
    POST /api/course-posts/admin/<id>/publish/
    """

    permission_classes = [permissions.IsAuthenticated, IsAdminOrManager]

    def post(self, request, pk: int):
        with transaction.atomic():
            post = (
                CoursePost.objects.select_for_update()
                .select_related("dispatch_request")
                .get(pk=pk)
            )

            post.publish()
            post.save()

            # ✅ also: DispatchRequest.status -> PUBLISHED
            dr = post.dispatch_request
            if dr and dr.status != DispatchRequestStatusChoices.PUBLISHED:
                dr.status = DispatchRequestStatusChoices.PUBLISHED
                dr.save()

        data = CoursePostSerializer(
            post,
            context={"request": request},
        ).data
        return Response(data, status=status.HTTP_200_OK)


class CoursePostCloseView(APIView):
    """
    POST /api/course-posts/admin/<id>/close/
    """

    permission_classes = [permissions.IsAuthenticated, IsAdminOrManager]

    def post(self, request, pk: int):
        post = CoursePost.objects.get(pk=pk)
        post.close()
        post.save()
        data = CoursePostSerializer(post, context={"request": request}).data
        return Response(data, status=status.HTTP_200_OK)


class CoursePostApplyView(APIView):
    """
    ✅ teacher 자동 매핑
    POST /api/course-posts/<id>/apply/
    body: { message?: string }
    """

    permission_classes = [permissions.IsAuthenticated, IsTeacher]

    def post(self, request, pk: int):
        post = CoursePost.objects.select_related("dispatch_request").get(pk=pk)

        if post.status != CoursePostStatusChoices.PUBLISHED:
            raise ValidationError("게시된 공고에만 지원할 수 있습니다.")

        if post.application_deadline and post.application_deadline < timezone.now():
            raise ValidationError("지원 마감된 공고입니다.")

        teacher = _get_my_teacher_application_or_error(request.user)

        body = CoursePostApplySerializer(data=request.data)
        body.is_valid(raise_exception=True)
        message = body.validated_data.get("message", "")

        app, created = CourseApplication.objects.get_or_create(
            post=post,
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


class CoursePostWithdrawView(APIView):
    """
    ✅ teacher 자동 매핑
    POST /api/course-posts/<id>/withdraw/
    """

    permission_classes = [permissions.IsAuthenticated, IsTeacher]

    def post(self, request, pk: int):
        post = CoursePost.objects.get(pk=pk)
        teacher = _get_my_teacher_application_or_error(request.user)

        try:
            app = CourseApplication.objects.get(post=post, teacher=teacher)
        except CourseApplication.DoesNotExist:
            raise ValidationError("지원 내역이 없습니다.")

        app.withdraw()
        app.save()
        return Response(
            CourseApplicationSerializer(app).data, status=status.HTTP_200_OK
        )


class CoursePostApplicationsView(generics.ListAPIView):
    """
    GET /api/course-posts/admin/<id>/applications/
    """

    permission_classes = [permissions.IsAuthenticated, IsAdminOrManager]
    serializer_class = CourseApplicationSerializer

    def get_queryset(self):
        post_id = self.kwargs.get("pk")

        qs = (
            CourseApplication.objects.select_related("teacher", "post")
            .filter(post_id=post_id)
            .order_by("-created_at")
        )

        return qs


class CoursePostSetApplicationStatusView(APIView):
    """
    PATCH /api/course-posts/admin/<id>/set-application-status/
    body: { application_id: number, status: string }
    """

    permission_classes = [permissions.IsAuthenticated, IsAdminOrManager]

    def patch(self, request, pk: int):
        post = CoursePost.objects.get(pk=pk)

        body = CourseApplicationStatusUpdateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        application_id = body.validated_data["application_id"]
        new_status = body.validated_data["status"]

        if new_status not in dict(CourseApplicationStatusChoices.choices):
            raise ValidationError("유효하지 않은 status 입니다.")

        try:
            app = CourseApplication.objects.get(pk=application_id, post=post)
        except CourseApplication.DoesNotExist:
            raise ValidationError("지원서를 찾을 수 없습니다.")

        if new_status == CourseApplicationStatusChoices.SELECTED:
            # SELECTED 1명 보장
            with transaction.atomic():
                CourseApplication.objects.filter(
                    post=post,
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
