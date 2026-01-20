from rest_framework.permissions import BasePermission


def _role(user) -> str:
    return getattr(user, "role", "") or ""


class IsAdminOrManager(BasePermission):
    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        return user.is_superuser or _role(user) in ["admin", "manager"]


class IsTeacher(BasePermission):
    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        return _role(user) == "teacher"
