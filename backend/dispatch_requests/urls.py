from django.urls import path
from .views import (
    DispatchRequestCreateView,
    DispatchRequestMyListView,
    DispatchRequestOpenListView,
    DispatchRequestDetailView,
    DispatchRequestAdminListView,
    DispatchRequestAdminDetailView,
    DispatchRequestOpenView,
    DispatchRequestCloseView,
    DispatchRequestApplyView,
    DispatchRequestWithdrawView,
    DispatchRequestApplicationsView,
    DispatchRequestSetApplicationStatusView,
)

app_name = "dispatch_requests"

urlpatterns = [
    path("", DispatchRequestCreateView.as_view(), name="create"),
    path("my/", DispatchRequestMyListView.as_view(), name="my-list"),
    path("open/", DispatchRequestOpenListView.as_view(), name="open-list"),
    path("<int:pk>/", DispatchRequestDetailView.as_view(), name="detail"),
    path("<int:pk>/apply/", DispatchRequestApplyView.as_view(), name="apply"),
    path("<int:pk>/withdraw/", DispatchRequestWithdrawView.as_view(), name="withdraw"),
    path("admin/list/", DispatchRequestAdminListView.as_view(), name="admin-list"),
    path(
        "admin/<int:pk>/",
        DispatchRequestAdminDetailView.as_view(),
        name="admin-detail",
    ),
    path(
        "admin/<int:pk>/open/", DispatchRequestOpenView.as_view(), name="admin-open"
    ),
    path(
        "admin/<int:pk>/close/", DispatchRequestCloseView.as_view(), name="admin-close"
    ),
    path(
        "admin/<int:pk>/applications/",
        DispatchRequestApplicationsView.as_view(),
        name="admin-applications",
    ),
    path(
        "admin/<int:pk>/set-application-status/",
        DispatchRequestSetApplicationStatusView.as_view(),
        name="admin-set-application-status",
    ),
]
