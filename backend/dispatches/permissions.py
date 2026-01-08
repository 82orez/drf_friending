from __future__ import annotations

from rest_framework.permissions import BasePermission

from culture_centers.models import CultureCenterMembership


class IsRole(BasePermission):
    """request.user.role 기반 간단 권한."""

    allowed_role: str | None = None

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user or user.is_anonymous:
            return False
        if user.is_superuser:
            return True
        if not self.allowed_role:
            return False
        return getattr(user, "role", None) == self.allowed_role


class IsAdminRole(IsRole):
    allowed_role = "admin"


class IsManagerRole(IsRole):
    allowed_role = "manager"


class IsTeacherRole(IsRole):
    allowed_role = "teacher"


def user_can_request_for_center(user, culture_center_id: int) -> bool:
    """매니저가 해당 지점에 요청할 권한(멤버십)이 있는지."""
    if not user or user.is_anonymous:
        return False
    if user.is_superuser:
        return True

    return CultureCenterMembership.objects.filter(
        user=user,
        culture_center_id=culture_center_id,
        role=CultureCenterMembership.MemberRole.MANAGER,
        is_active=True,
    ).exists()
