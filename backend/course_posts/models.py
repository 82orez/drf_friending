from __future__ import annotations

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from dispatch_requests.models import DispatchRequest
from teacher_applications.models import TeacherApplication


class CoursePostStatusChoices(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    PUBLISHED = "PUBLISHED", "Published"
    CLOSED = "CLOSED", "Closed"
    CANCELLED = "CANCELLED", "Cancelled"


class CourseApplicationStatusChoices(models.TextChoices):
    APPLIED = "APPLIED", "Applied"
    WITHDRAWN = "WITHDRAWN", "Withdrawn"
    REJECTED = "REJECTED", "Rejected"
    SHORTLISTED = "SHORTLISTED", "Shortlisted"
    SELECTED = "SELECTED", "Selected"


class CoursePost(models.Model):
    """
    모집 공고 (정석)
    - DispatchRequest(내부 요청)와 1:1 연결
    """

    dispatch_request = models.OneToOneField(
        DispatchRequest,
        on_delete=models.CASCADE,
        related_name="course_post",
    )

    status = models.CharField(
        max_length=20,
        choices=CoursePostStatusChoices.choices,
        default=CoursePostStatusChoices.DRAFT,
        db_index=True,
    )

    application_deadline = models.DateTimeField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    notes_for_teachers = models.TextField(blank=True, default="")

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_course_posts",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Course post"
        verbose_name_plural = "Course posts"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["published_at"]),
        ]

    def __str__(self):
        dr = self.dispatch_request
        return f"[{self.status}] {dr.course_title} / {dr.teaching_language} @ {dr.culture_center}"

    def clean(self):
        super().clean()
        if (
            self.application_deadline
            and self.published_at
            and self.application_deadline < self.published_at
        ):
            raise ValidationError(
                {"application_deadline": "마감일은 게시일 이후여야 합니다."}
            )

    def publish(self):
        if self.status in [
            CoursePostStatusChoices.CLOSED,
            CoursePostStatusChoices.CANCELLED,
        ]:
            raise ValidationError("이미 마감/취소된 공고는 게시할 수 없습니다.")
        self.status = CoursePostStatusChoices.PUBLISHED
        if not self.published_at:
            self.published_at = timezone.now()

    def close(self):
        if self.status == CoursePostStatusChoices.CANCELLED:
            raise ValidationError("취소된 공고는 마감할 수 없습니다.")
        self.status = CoursePostStatusChoices.CLOSED
        if not self.closed_at:
            self.closed_at = timezone.now()


class CourseApplication(models.Model):
    """
    지원서
    - (post, teacher) 유니크
    - 강사는 본인 계정의 teacher_application으로 자동 매핑 (views에서 처리)
    """

    post = models.ForeignKey(
        CoursePost, on_delete=models.CASCADE, related_name="applications"
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
                fields=["post", "teacher"], name="uniq_course_application_post_teacher"
            ),
        ]
        indexes = [
            models.Index(fields=["post"]),
            models.Index(fields=["teacher"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.teacher} -> {self.post} ({self.status})"

    def clean(self):
        super().clean()

        if self.post.status != CoursePostStatusChoices.PUBLISHED:
            raise ValidationError("게시된 공고에만 지원할 수 있습니다.")

        # SELECTED는 1명만 허용
        if self.status == CourseApplicationStatusChoices.SELECTED:
            exists = (
                CourseApplication.objects.filter(
                    post=self.post, status=CourseApplicationStatusChoices.SELECTED
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
