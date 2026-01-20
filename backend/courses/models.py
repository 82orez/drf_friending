from __future__ import annotations

from django.core.exceptions import ValidationError
from django.db import models

from culture_centers.models import CultureCenter
from teacher_applications.models import TeacherApplication

from course_posts.models import CoursePost
from courses.utils import calculate_end_date

DAY_KEYS = {"MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"}


class CourseStatusChoices(models.TextChoices):
    NEW = "NEW", "New"
    REVIEWING = "REVIEWING", "Reviewing"
    CONFIRMED = "CONFIRMED", "Confirmed"
    ONGOING = "ONGOING", "Ongoing"
    ENDED = "ENDED", "Ended"
    CANCELLED = "CANCELLED", "Cancelled"


class Course(models.Model):
    """
    확정 강좌(운영 엔티티)
    - source_post 1:1 (정석)
    - DispatchRequest의 필드들을 복제하여 운영 중 원본 요청이 바뀌어도 강좌는 안정적으로 유지
    """

    source_post = models.OneToOneField(
        CoursePost,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="course",
    )

    culture_center = models.ForeignKey(
        CultureCenter,
        on_delete=models.PROTECT,
        related_name="courses",
        verbose_name="문화센터 지점",
    )

    teaching_language = models.CharField("강의 언어", max_length=50)
    course_title = models.CharField("강좌명", max_length=120)

    instructor_type = models.CharField(
        "강사 형태", max_length=10, blank=True, default=""
    )

    teacher = models.ForeignKey(
        TeacherApplication,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_courses",
        verbose_name="배정 강사",
    )

    class_days = models.JSONField("강의 요일", default=list, blank=True)
    start_time = models.TimeField("시작 시간", null=True, blank=True)
    end_time = models.TimeField("종료 시간", null=True, blank=True)

    start_date = models.DateField("시작일")
    end_date = models.DateField("종료일", null=True, blank=True)

    lecture_count = models.PositiveIntegerField("강의 횟수", default=1)
    students_count = models.PositiveIntegerField(
        "수강생 수(예상)", null=True, blank=True
    )

    applicant_name = models.CharField(
        "신청자 이름", max_length=100, blank=True, default=""
    )
    applicant_phone = models.CharField("연락처", max_length=50, blank=True, default="")
    applicant_email = models.EmailField("이메일", blank=True, default="")

    extra_requirements = models.TextField("추가 요청사항", blank=True, null=True)
    notes = models.TextField("비고", blank=True, default="")

    status = models.CharField(
        "상태",
        max_length=20,
        choices=CourseStatusChoices.choices,
        default=CourseStatusChoices.NEW,
        db_index=True,
    )

    created_at = models.DateTimeField("생성일", auto_now_add=True)
    updated_at = models.DateTimeField("수정일", auto_now=True)

    class Meta:
        verbose_name = "Course"
        verbose_name_plural = "Courses"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["culture_center"]),
            models.Index(fields=["start_date"]),
        ]

    def __str__(self) -> str:
        return f"[{self.status}] {self.course_title} / {self.teaching_language} @ {self.culture_center}"

    def clean(self):
        super().clean()

        days = self.class_days or []
        if not isinstance(days, list):
            raise ValidationError({"class_days": "class_days must be a list."})
        bad = [d for d in days if str(d).upper() not in DAY_KEYS]
        if bad:
            raise ValidationError({"class_days": f"Invalid day(s): {bad}"})

        if self.start_time and self.end_time and self.start_time >= self.end_time:
            raise ValidationError({"end_time": "end_time must be after start_time."})

        if not self.start_date:
            raise ValidationError({"start_date": "시작일은 필수입니다."})

        if not self.class_days:
            raise ValidationError(
                {"class_days": "강의 요일은 1개 이상 선택해야 합니다."}
            )

        if self.lecture_count < 1:
            raise ValidationError({"lecture_count": "강의 횟수는 1 이상이어야 합니다."})

        # ✅ end_date는 파생값(항상 재계산)
        self.end_date = calculate_end_date(
            self.start_date, self.class_days, self.lecture_count
        )

        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValidationError({"end_date": "end_date must be on/after start_date."})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)
