from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from culture_centers.models import CultureCenter
from datetime import timedelta

from teacher_applications.models import TeacherApplication, ApplicationStatusChoices


class DispatchRequestStatusChoices(models.TextChoices):
    NEW = "NEW", "New"
    IN_REVIEW = "IN_REVIEW", "In review"
    MATCHED = "MATCHED", "Matched"
    CONFIRMED = "CONFIRMED", "Confirmed"
    CLOSED = "CLOSED", "Closed"
    CANCELLED = "CANCELLED", "Cancelled"


DAY_KEYS = {"MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"}


class InstructorTypeChoices(models.TextChoices):
    KOREAN = "KOREAN", "한국인 강사"
    FOREIGN = "FOREIGN", "외국인 강사"
    ANY = "ANY", "Any"


class DispatchRequest(models.Model):
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="dispatch_requests",
        verbose_name="요청자(매니저)",
    )

    culture_center = models.ForeignKey(
        CultureCenter,
        on_delete=models.PROTECT,
        related_name="dispatch_requests",
        verbose_name="문화센터 지점",
    )

    teaching_language = models.CharField("강의 언어", max_length=50)
    course_title = models.CharField("강좌명", max_length=120)

    instructor_type = models.CharField(
        "강사 형태",
        max_length=10,
        choices=InstructorTypeChoices.choices,
        default=InstructorTypeChoices.ANY,
    )

    # ✅ added: accepted(채용 확정) 강사만 선택 가능
    teacher_name = models.ForeignKey(
        TeacherApplication,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="dispatch_requests",
        limit_choices_to={"status": ApplicationStatusChoices.ACCEPTED},
        verbose_name="등록 강사",
        help_text="TeacherApplication 중 status=ACCEPTED(채용 확정)인 강사만 선택 가능",
    )

    class_days = models.JSONField("강의 요일", default=list, blank=True)

    start_time = models.TimeField("시작 시간", null=True, blank=True)
    end_time = models.TimeField("종료 시간", null=True, blank=True)

    start_date = models.DateField("시작일", null=True, blank=True)
    end_date = models.DateField("종료일", null=True, blank=True)

    applicant_name = models.CharField("신청자 이름", max_length=100)
    applicant_phone = models.CharField("연락처", max_length=50)
    applicant_email = models.EmailField("이메일")

    lecture_count = models.PositiveIntegerField("강의 횟수", default=1)
    students_count = models.PositiveIntegerField(
        "수강생 수(예상)", null=True, blank=True
    )

    extra_requirements = models.TextField("추가 요청사항", blank=True, null=True)

    status = models.CharField(
        "상태",
        max_length=20,
        choices=DispatchRequestStatusChoices.choices,
        default=DispatchRequestStatusChoices.NEW,
        db_index=True,
    )

    created_at = models.DateTimeField("생성일", auto_now_add=True)
    updated_at = models.DateTimeField("수정일", auto_now=True)

    class Meta:
        verbose_name = "강사 파견 요청"
        verbose_name_plural = "강사 파견 요청"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["culture_center"]),
            models.Index(fields=["requester"]),
        ]

    def save(self, *args, **kwargs):
        """
        DRF serializer.save()는 model.clean()을 자동 호출하지 않기 때문에,
        저장 전에 full_clean()을 호출해서 end_date 자동 계산/검증이 항상 적용되게 한다.
        """
        self.full_clean()
        return super().save(*args, **kwargs)

    def _calculate_end_date_from_start_days_and_count(self):
        """
        start_date부터 시작해 class_days에 해당하는 날짜를 세어서
        lecture_count번째 수업 날짜를 end_date로 반환
        """
        if not self.start_date:
            return None

        count = int(self.lecture_count or 0)
        if count <= 0:
            return None

        days = self.class_days or []
        if not isinstance(days, list) or not days:
            return None

        key_to_weekday = {
            "MON": 0,
            "TUE": 1,
            "WED": 2,
            "THU": 3,
            "FRI": 4,
            "SAT": 5,
            "SUN": 6,
        }
        try:
            allowed_weekdays = {key_to_weekday[str(d).upper()] for d in days}
        except KeyError:
            return None

        dt = self.start_date
        hits = 0

        for _ in range(366 * 3):
            if dt.weekday() in allowed_weekdays:
                hits += 1
                if hits == count:
                    return dt
            dt = dt + timedelta(days=1)

        return None

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

        # ✅ teacher_name은 accepted 강사만 허용(폼 외의 경로로 값이 들어오는 것도 방지)
        if (
            self.teacher_name
            and self.teacher_name.status != ApplicationStatusChoices.ACCEPTED
        ):
            raise ValidationError(
                {"teacher_name": "ACCEPTED(채용 확정) 강사만 선택할 수 있습니다."}
            )

        # ✅ 정책: end_date는 파생값이므로 항상 재계산해서 덮어쓴다
        self.end_date = self._calculate_end_date_from_start_days_and_count()

        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValidationError({"end_date": "end_date must be on/after start_date."})

    def __str__(self) -> str:
        return f"[{self.status}] {self.course_title} / {self.teaching_language} @ {self.culture_center}"
