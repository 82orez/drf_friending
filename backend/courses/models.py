from __future__ import annotations

from django.core.exceptions import ValidationError
from django.db import models

from culture_centers.models import CultureCenter
from teacher_applications.models import TeacherApplication

from courses.utils import calculate_end_date
from course_posts.models import CoursePost


class CourseStatusChoices(models.TextChoices):
    NEW = "NEW", "New"
    REVIEWING = "REVIEWING", "Reviewing"
    CONFIRMED = "CONFIRMED", "Confirmed"
    ONGOING = "ONGOING", "Ongoing"
    ENDED = "ENDED", "Ended"
    CANCELLED = "CANCELLED", "Cancelled"


class Course(models.Model):
    """
    '확정 강좌' (운영 엔티티)
    - source_post 1:1 권장 (공고 기반 확정)
    """

    source_post = models.OneToOneField(
        CoursePost,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="course",
    )

    culture_center_branch = models.ForeignKey(
        CultureCenter, on_delete=models.PROTECT, related_name="courses"
    )
    teacher = models.ForeignKey(
        TeacherApplication,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_courses",
    )

    course_name = models.CharField(max_length=255)

    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)

    # DispatchRequest와 동일한 형태 가정: ["MON","WED"] 같은 문자열 배열
    class_days = models.JSONField(default=list, blank=True)
    class_time = models.CharField(max_length=100, blank=True, default="")

    lecture_count = models.PositiveIntegerField(default=1)

    status = models.CharField(
        max_length=20,
        choices=CourseStatusChoices.choices,
        default=CourseStatusChoices.NEW,
    )

    manager_name = models.CharField(max_length=100, blank=True, default="")
    manager_phone = models.CharField(max_length=50, blank=True, default="")
    manager_email = models.EmailField(blank=True, default="")

    notes = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.status}] {self.course_name} / {self.culture_center_branch}"

    def clean(self):
        super().clean()

        if not self.start_date:
            raise ValidationError({"start_date": "개강일은 필수입니다."})
        if not self.class_days:
            raise ValidationError(
                {"class_days": "수업 요일은 1개 이상 선택해야 합니다."}
            )
        if self.lecture_count < 1:
            raise ValidationError({"lecture_count": "수업 횟수는 1 이상이어야 합니다."})

        # end_date 자동 계산
        try:
            self.end_date = calculate_end_date(
                self.start_date, self.class_days, self.lecture_count
            )
        except ValueError as e:
            raise ValidationError(str(e))

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)
