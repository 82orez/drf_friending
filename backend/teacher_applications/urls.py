from django.urls import path
from .views import (
    TeacherApplicationCreateView,
    TeacherApplicationUpdateView,
    TeacherApplicationListView,
    TeacherApplicationDetailView,
)

app_name = "teacher_applications"

urlpatterns = [
    # 강사 이력서 제출용 (인증된 사용자)
    path(
        "",
        TeacherApplicationCreateView.as_view(),
        name="teacher-application-create",
    ),
    # 사용자가 자신의 이력서를 조회/수정하는 엔드포인트
    path(
        "my/",
        TeacherApplicationUpdateView.as_view(),
        name="teacher-application-update",
    ),
    # 관리자용 지원서 목록 조회
    path(
        "admin/list/",
        TeacherApplicationListView.as_view(),
        name="teacher-application-list",
    ),
    # 관리자용 지원서 상세 조회/수정
    path(
        "admin/<int:pk>/",
        TeacherApplicationDetailView.as_view(),
        name="teacher-application-detail",
    ),
]
