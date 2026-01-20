from django.urls import path

from .views import (
    CourseMyListView,
    CourseAdminListView,
    CourseAdminDetailView,
    CourseConfirmFromPostView,
)

app_name = "courses"

urlpatterns = [
    # teacher
    path("my/", CourseMyListView.as_view(), name="my-list"),
    # admin/manager
    path("admin/list/", CourseAdminListView.as_view(), name="admin-list"),
    path("admin/<int:pk>/", CourseAdminDetailView.as_view(), name="admin-detail"),
    path(
        "admin/confirm-from-post/<int:post_id>/",
        CourseConfirmFromPostView.as_view(),
        name="admin-confirm-from-post",
    ),
]
