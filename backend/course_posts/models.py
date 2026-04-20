from __future__ import annotations

from django.core.exceptions import ValidationError
from django.db import models

from dispatch_requests.models import DispatchRequest, DispatchRequestStatusChoices
from teacher_applications.models import TeacherApplication


class CourseApplicationStatusChoices(models.TextChoices):
    APPLIED = "APPLIED", "Applied"
    WITHDRAWN = "WITHDRAWN", "Withdrawn"
    REJECTED = "REJECTED", "Rejected"
    SHORTLISTED = "SHORTLISTED", "Shortlisted"
    SELECTED = "SELECTED", "Selected"


class CourseApplication(models.Model):
    """
    강사 지원서
    - (dispatch_request, teacher) 유니크
    - 강사는 본인 계정의 teacher_application으로 자동 매핑 (views에서 처리)
    """

    dispatch_request = models.ForeignKey(
        DispatchRequest,
        on_delete=models.CASCADE,
        related_name="applications",
    )
    teacher = models.ForeignKey(
        TeacherApplication, on_delete=models.CASCADE, related_name="course_applications"
    )

    status = models.CharField(
        max_length=20,
        choices=CourseApplicationStatusChoices.choices,
        default=CourseApplicationStatusChoices.APPLIED,
        db_index=True,
    )
    message = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Course application"
        verbose_name_plural = "Course applications"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["dispatch_request", "teacher"],
                name="uniq_course_application_dispatch_teacher",
            ),
        ]
        indexes = [
            models.Index(fields=["dispatch_request"]),
            models.Index(fields=["teacher"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.teacher} -> {self.dispatch_request} ({self.status})"

    def clean(self):
        super().clean()

        if self.dispatch_request.status != DispatchRequestStatusChoices.OPEN:
            raise ValidationError("게시된(OPEN) 요청에만 지원할 수 있습니다.")

        if self.status == CourseApplicationStatusChoices.SELECTED:
            exists = (
                CourseApplication.objects.filter(
                    dispatch_request=self.dispatch_request,
                    status=CourseApplicationStatusChoices.SELECTED,
                )
                .exclude(pk=self.pk)
                .exists()
            )
            if exists:
                raise ValidationError("이미 SELECTED 된 지원자가 존재합니다.")

    def withdraw(self):
        if self.status not in [
            CourseApplicationStatusChoices.APPLIED,
            CourseApplicationStatusChoices.SHORTLISTED,
        ]:
            raise ValidationError("현재 상태에서는 지원 취소가 불가능합니다.")
        self.status = CourseApplicationStatusChoices.WITHDRAWN
