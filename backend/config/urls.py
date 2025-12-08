from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include

# admin page 텍스트 설정
admin.site.site_header = "Friending administration"  # 상단 왼쪽 큰 제목
admin.site.site_title = "Friending Admin"  # 브라우저 탭 제목(<title>)
# admin.site.index_title = "관리자 대시보드"  # 메인 화면의 제목

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
]

# 배포 환경에서는 AWS S3 에 연결 설정
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
