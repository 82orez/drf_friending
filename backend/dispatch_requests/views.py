from rest_framework import generics, permissions
from .models import DispatchRequest
from .serializers import DispatchRequestSerializer

from django.db import transaction
from .emails import send_dispatch_request_received_email


class DispatchRequestCreateView(generics.CreateAPIView):
    """
    매니저가 강사 파견 요청 생성
    POST /api/dispatch-requests/
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DispatchRequestSerializer
    queryset = DispatchRequest.objects.select_related("culture_center", "requester")

    def perform_create(self, serializer):
        dispatch_request = serializer.save(requester=self.request.user)

        # ✅ 트랜잭션 커밋 이후 메일 발송(요청 생성 성공을 방해하지 않음)
        transaction.on_commit(
            lambda: send_dispatch_request_received_email(dispatch_request)
        )


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


class DispatchRequestDetailView(generics.RetrieveAPIView):
    """
    ✅ 매니저/관리자 공통 상세 조회
    GET /api/dispatch-requests/<id>/

    - admin(또는 staff/superuser)은 전체 접근
    - 그 외에는 본인(requester) 것만 접근
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DispatchRequestSerializer

    def get_queryset(self):
        qs = DispatchRequest.objects.select_related("culture_center", "requester")
        user = self.request.user
        role = getattr(user, "role", "") or ""
        if user.is_staff or user.is_superuser or role == "admin":
            return qs
        return qs.filter(requester=user)


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
