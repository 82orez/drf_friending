from rest_framework.routers import DefaultRouter
from .views import CoursePostViewSet

router = DefaultRouter()
router.register(r"course-posts", CoursePostViewSet, basename="course-posts")

urlpatterns = router.urls
