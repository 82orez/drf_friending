from django.urls import path
from .views import (
    DispatchRequestCreateView,
    DispatchRequestMyListView,
    DispatchRequestDetailView,  # ✅ NEW
    DispatchRequestAdminListView,
    DispatchRequestAdminDetailView,
)

app_name = "dispatch_requests"

urlpatterns = [
    path("", DispatchRequestCreateView.as_view(), name="create"),
    path("my/", DispatchRequestMyListView.as_view(), name="my-list"),
    path("<int:pk>/", DispatchRequestDetailView.as_view(), name="detail"),  # ✅ NEW
    path("admin/list/", DispatchRequestAdminListView.as_view(), name="admin-list"),
    path(
        "admin/<int:pk>/", DispatchRequestAdminDetailView.as_view(), name="admin-detail"
    ),
]
