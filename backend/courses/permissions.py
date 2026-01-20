from rest_framework.permissions import BasePermission, SAFE_METHODS


def _role(user) -> str:
    return getattr(user, "role", "") or ""


class IsAdminOrManager(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return _role(request.user) in ["admin", "manager"] or request.user.is_superuser


class IsTeacher(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return _role(request.user) == "teacher"
