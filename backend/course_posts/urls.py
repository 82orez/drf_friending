from django.urls import path

from .views import (
    CoursePostListCreateView,
    CoursePostDetailView,
    CoursePostApplyView,
    CoursePostWithdrawView,
    CoursePostAdminListView,
    CoursePostAdminDetailView,
    CoursePostPublishView,
    CoursePostCloseView,
    CoursePostApplicationsView,
    CoursePostSetApplicationStatusView,
)

app_name = "course_posts"

urlpatterns = [
    # teacher/public
    path("", CoursePostListCreateView.as_view(), name="list-create"),
    path("<int:pk>/", CoursePostDetailView.as_view(), name="detail"),
    path("<int:pk>/apply/", CoursePostApplyView.as_view(), name="apply"),
    path("<int:pk>/withdraw/", CoursePostWithdrawView.as_view(), name="withdraw"),
    # admin
    path("admin/list/", CoursePostAdminListView.as_view(), name="admin-list"),
    path("admin/<int:pk>/", CoursePostAdminDetailView.as_view(), name="admin-detail"),
    path(
        "admin/<int:pk>/publish/", CoursePostPublishView.as_view(), name="admin-publish"
    ),
    path("admin/<int:pk>/close/", CoursePostCloseView.as_view(), name="admin-close"),
    path(
        "admin/<int:pk>/applications/",
        CoursePostApplicationsView.as_view(),
        name="admin-applications",
    ),
    path(
        "admin/<int:pk>/set-application-status/",
        CoursePostSetApplicationStatusView.as_view(),
        name="admin-set-application-status",
    ),
]
