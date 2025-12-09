from django.urls import path
from . import views
from .views import (
    TeacherApplicationCreateView,
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
