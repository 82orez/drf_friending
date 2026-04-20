from django.urls import path

from .views import (
    CourseMyListView,
    CourseAdminListView,
    CourseAdminDetailView,
    CourseConfirmFromDispatchView,
)

app_name = "courses"

urlpatterns = [
    path("my/", CourseMyListView.as_view(), name="my-list"),
    path("admin/list/", CourseAdminListView.as_view(), name="admin-list"),
    path("admin/<int:pk>/", CourseAdminDetailView.as_view(), name="admin-detail"),
    path(
        "admin/confirm-from-dispatch/<int:dispatch_id>/",
        CourseConfirmFromDispatchView.as_view(),
        name="admin-confirm-from-dispatch",
    ),
]
