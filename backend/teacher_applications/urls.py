from django.urls import path
from . import views
from .views import TeacherApplicationCreateView

app_name = "teacher_applications"

urlpatterns = [  # 강사 이력서 제출용 (공개)
    path(
        "",
        TeacherApplicationCreateView.as_view(),
        name="teacher-application-create",
    ),
]
