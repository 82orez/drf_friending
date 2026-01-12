from django.urls import path
from .views import CultureCenterBranchListView

app_name = "culture_centers"

urlpatterns = [
    path("branches/", CultureCenterBranchListView.as_view(), name="branch-list"),
]
