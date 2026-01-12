from rest_framework import generics, permissions
from .models import CultureCenter
from .serializers import CultureCenterBranchSerializer


class CultureCenterBranchListView(generics.ListAPIView):
    """
    지점 선택 dropdown을 위한 지점 목록 API
    GET /api/culture-centers/branches/
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CultureCenterBranchSerializer
    queryset = CultureCenter.objects.select_related("center", "region").order_by(
        "center__name", "branch_name"
    )
