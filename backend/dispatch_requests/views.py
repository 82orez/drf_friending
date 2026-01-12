from rest_framework import generics, permissions
from .models import DispatchRequest
from .serializers import DispatchRequestSerializer


class DispatchRequestCreateView(generics.CreateAPIView):
    """
    매니저가 강사 파견 요청 생성
    POST /api/dispatch-requests/
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DispatchRequestSerializer
    queryset = DispatchRequest.objects.select_related("culture_center", "requester")

    def perform_create(self, serializer):
        serializer.save(requester=self.request.user)


class DispatchRequestMyListView(generics.ListAPIView):
    """
    내 요청 목록
    GET /api/dispatch-requests/my/
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DispatchRequestSerializer

    def get_queryset(self):
        return (
            DispatchRequest.objects.select_related("culture_center", "requester")
            .filter(requester=self.request.user)
            .order_by("-created_at")
        )


class DispatchRequestAdminListView(generics.ListAPIView):
    """
    관리자용 전체 목록
    GET /api/dispatch-requests/admin/list/
    """

    permission_classes = [permissions.IsAdminUser]
    serializer_class = DispatchRequestSerializer
    queryset = DispatchRequest.objects.select_related(
        "culture_center", "requester"
    ).order_by("-created_at")


class DispatchRequestAdminDetailView(generics.RetrieveUpdateAPIView):
    """
    관리자용 상세/상태 업데이트
    GET/PATCH /api/dispatch-requests/admin/<id>/
    """

    permission_classes = [permissions.IsAdminUser]
    serializer_class = DispatchRequestSerializer
    queryset = DispatchRequest.objects.select_related("culture_center", "requester")
