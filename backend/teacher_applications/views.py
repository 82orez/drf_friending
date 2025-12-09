# applications/views.py
from rest_framework import generics, permissions, filters
from rest_framework.parsers import MultiPartParser, FormParser

from .models import TeacherApplication
from .serializers import TeacherApplicationSerializer


class TeacherApplicationCreateView(generics.CreateAPIView):
    """
    Public endpoint to create a teacher application.
    강사가 이력서를 제출하는 공개용 엔드포인트 (회원/비회원 모두 가능하게 설계 가능)
    """

    queryset = TeacherApplication.objects.all()
    serializer_class = TeacherApplicationSerializer
    permission_classes = [
        # permissions.AllowAny
        permissions.IsAuthenticated,
    ]  # 로그인 필수로 하고 싶으면 IsAuthenticated로 변경
    parser_classes = [
        MultiPartParser,
        FormParser,
    ]  # 파일 업로드를 위해 필요 (이미지 포함)

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(user=user)


class TeacherApplicationListView(generics.ListAPIView):
    """
    Admin-only list view for reviewing applications.
    관리자용 이력서 목록 조회 엔드포인트
    """

    queryset = TeacherApplication.objects.all()
    serializer_class = TeacherApplicationSerializer
    permission_classes = [permissions.IsAdminUser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]

    # 검색 필드 (원하면 더 추가 가능)
    search_fields = [
        "first_name",
        "last_name",
        "email",
        "nationality",
        "visa_type",
    ]

    # 정렬 (created_at 기준 최신순 등)
    ordering_fields = ["created_at", "visa_expiry_date"]
    ordering = ["-created_at"]
