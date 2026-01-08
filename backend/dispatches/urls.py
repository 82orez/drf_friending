from django.urls import path

from .views import (
    ManagerDispatchRequestListCreateView,
    ManagerDispatchRequestDetailView,
    TeacherPublishedDispatchRequestListView,
    TeacherDispatchApplyView,
    TeacherMyDispatchApplicationsListView,
    AdminDispatchRequestListView,
    AdminDispatchRequestDetailView,
    AdminPublishDispatchRequestView,
    AdminDispatchRequestApplicationsListView,
    AdminAssignTeacherView,
    AdminDispatchAssignmentUpdateView,
)

app_name = "dispatches"

urlpatterns = [
    # Manager
    path(
        "manager/requests/",
        ManagerDispatchRequestListCreateView.as_view(),
        name="manager-request-list-create",
    ),
    path(
        "manager/requests/<int:pk>/",
        ManagerDispatchRequestDetailView.as_view(),
        name="manager-request-detail",
    ),
    # Teacher
    path(
        "teacher/requests/",
        TeacherPublishedDispatchRequestListView.as_view(),
        name="teacher-published-request-list",
    ),
    path(
        "teacher/requests/<int:pk>/apply/",
        TeacherDispatchApplyView.as_view(),
        name="teacher-apply",
    ),
    path(
        "teacher/applications/",
        TeacherMyDispatchApplicationsListView.as_view(),
        name="teacher-my-applications",
    ),
    # Admin
    path(
        "admin/requests/",
        AdminDispatchRequestListView.as_view(),
        name="admin-request-list",
    ),
    path(
        "admin/requests/<int:pk>/",
        AdminDispatchRequestDetailView.as_view(),
        name="admin-request-detail",
    ),
    path(
        "admin/requests/<int:pk>/publish/",
        AdminPublishDispatchRequestView.as_view(),
        name="admin-request-publish",
    ),
    path(
        "admin/requests/<int:pk>/applications/",
        AdminDispatchRequestApplicationsListView.as_view(),
        name="admin-request-applications",
    ),
    path(
        "admin/requests/<int:pk>/assign/",
        AdminAssignTeacherView.as_view(),
        name="admin-request-assign",
    ),
    path(
        "admin/assignments/<int:pk>/",
        AdminDispatchAssignmentUpdateView.as_view(),
        name="admin-assignment-update",
    ),
]
