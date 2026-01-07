from __future__ import annotations

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from culture_centers.models import CultureCenter
from teacher_applications.models import (
    TeacherApplication,
    ApplicationStatusChoices,
    TeachingLanguageChoices,
)


class WeekdayChoices(models.TextChoices):
    MON = "MON", "Mon"
    TUE = "TUE", "Tue"
    WED = "WED", "Wed"
    THU = "THU", "Thu"
    FRI = "FRI", "Fri"
    SAT = "SAT", "Sat"
    SUN = "SUN", "Sun"


def validate_weekdays(value):
    """JSONField validator: ["MON", "WED", ...]"""
    if value in (None, ""):
        return
    if not isinstance(value, list):
        raise ValidationError("weekdays must be a list. e.g. ['MON','WED']")
    allowed = {c for c, _ in WeekdayChoices.choices}
    for v in value:
        if v not in allowed:
            raise ValidationError(f"Invalid weekday: {v}")
    if len(set(value)) != len(value):
        raise ValidationError("Duplicate weekdays are not allowed.")


class DispatchRequestStatus(models.TextChoices):
    REQUESTED = "REQUESTED", "Requested / 요청됨"  # 매니저 제출
    REVIEWING = "REVIEWING", "Reviewing / 검토 중"  # 관리자 확인 중
    PUBLISHED = "PUBLISHED", "Published / 공고 중"  # 강사에게 노출
    CLOSED = "CLOSED", "Closed / 모집 마감"  # 지원 마감
    ASSIGNED = "ASSIGNED", "Assigned / 강사 배치"  # 배치 완료
    CONFIRMED = "CONFIRMED", "Confirmed / 파견 확정"  # 최종 확정
    CANCELED = "CANCELED", "Canceled / 취소"  # 취소


class DispatchRequest(models.Model):
    """
    매니저가 지점(CultureCenter)을 선택해 강사 파견을 요청하고,
    관리자가 공고(PUBLISHED)로 전환하여 강사 지원을 받는 엔티티.
    """

    # --- 요청 주체/지점 ---
    culture_center = models.ForeignKey(
        CultureCenter,
        on_delete=models.PROTECT,
        related_name="dispatch_requests",
        verbose_name="문화센터 지점",
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="dispatch_requests",
        verbose_name="요청자(User)",
    )

    # --- 강좌/모집 정보 ---
    teaching_language = models.CharField(
        max_length=20,
        choices=TeachingLanguageChoices.choices,
        verbose_name="강의 언어",
    )
    course_title = models.CharField(max_length=200, verbose_name="강좌명")

    weekdays = models.JSONField(
        validators=[validate_weekdays],
        verbose_name="강의 요일(복수)",
        help_text="e.g. ['MON','WED']",
    )

    start_time = models.TimeField(verbose_name="수업 시작 시간")
    end_time = models.TimeField(verbose_name="수업 종료 시간")

    start_date = models.DateField(verbose_name="강의 시작일")
    end_date = models.DateField(verbose_name="강의 종료일")

    # 선택 확장 필드(현업에서 자주 필요)
    target = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="대상(성인/키즈 등)",
    )
    level = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="레벨(초급/중급 등)",
    )
    headcount = models.PositiveIntegerField(
        blank=True,
        null=True,
        verbose_name="예상 인원",
    )
    is_online = models.BooleanField(default=False, verbose_name="온라인 여부")
    requirements = models.TextField(blank=True, verbose_name="요청/필요 조건")
    notes = models.TextField(blank=True, verbose_name="비고")

    # --- 신청자 연락 정보(요청 당시 스냅샷) ---
    requester_name = models.CharField(max_length=100, verbose_name="신청자 이름")
    requester_phone = models.CharField(max_length=50, verbose_name="연락처")
    requester_email = models.EmailField(verbose_name="이메일")

    # --- 공고/상태 ---
    status = models.CharField(
        max_length=20,
        choices=DispatchRequestStatus.choices,
        default=DispatchRequestStatus.REQUESTED,
        verbose_name="상태",
        db_index=True,
    )
    published_at = models.DateTimeField(blank=True, null=True, verbose_name="공고 시각")
    application_deadline = models.DateField(
        blank=True, null=True, verbose_name="지원 마감일"
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="생성일")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="수정일")

    class Meta:
        verbose_name = "강사 파견 요청/공고"
        verbose_name_plural = "강사 파견 요청/공고"
        indexes = [
            models.Index(fields=["culture_center", "status"]),
            models.Index(fields=["teaching_language", "status"]),
        ]

    def clean(self):
        if self.end_time <= self.start_time:
            raise ValidationError("end_time must be after start_time.")
        if self.end_date < self.start_date:
            raise ValidationError("end_date must be >= start_date.")

    def __str__(self) -> str:
        return f"[{self.status}] {self.course_title} @ {self.culture_center}"


class DispatchApplicationStatus(models.TextChoices):
    APPLIED = "APPLIED", "Applied / 지원"
    WITHDRAWN = "WITHDRAWN", "Withdrawn / 지원취소"
    REJECTED = "REJECTED", "Rejected / 탈락"
    SHORTLISTED = "SHORTLISTED", "Shortlisted / 후보"
    SELECTED = "SELECTED", "Selected / 선정"


class DispatchApplication(models.Model):
    dispatch_request = models.ForeignKey(
        DispatchRequest,
        on_delete=models.CASCADE,
        related_name="applications",
        verbose_name="파견 요청",
    )
    teacher_application = models.ForeignKey(
        TeacherApplication,
        on_delete=models.PROTECT,
        related_name="dispatch_applications",
        verbose_name="강사(이력서)",
    )

    message = models.TextField(blank=True, verbose_name="지원 메시지")
    status = models.CharField(
        max_length=20,
        choices=DispatchApplicationStatus.choices,
        default=DispatchApplicationStatus.APPLIED,
        db_index=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "강사 지원"
        verbose_name_plural = "강사 지원"
        constraints = [
            models.UniqueConstraint(
                fields=["dispatch_request", "teacher_application"],
                name="uniq_dispatch_request_teacher_application",
            )
        ]
        indexes = [
            models.Index(fields=["dispatch_request", "status"]),
            models.Index(fields=["teacher_application", "status"]),
        ]

    def clean(self):
        # 승인된 강사만 지원 가능
        if self.teacher_application.status != ApplicationStatusChoices.ACCEPTED:
            raise ValidationError("Only ACCEPTED teachers can apply.")

    def __str__(self) -> str:
        return f"{self.teacher_application} -> {self.dispatch_request}"


class DispatchAssignmentStatus(models.TextChoices):
    ASSIGNED = "ASSIGNED", "Assigned / 배치됨"
    CONFIRMED_BY_TEACHER = "CONFIRMED_BY_TEACHER", "Confirmed by teacher / 강사 확인"
    CONFIRMED_BY_CENTER = "CONFIRMED_BY_CENTER", "Confirmed by center / 센터 확인"
    CONFIRMED = "CONFIRMED", "Confirmed / 최종 확정"
    CANCELED = "CANCELED", "Canceled / 취소"


class DispatchAssignment(models.Model):
    dispatch_request = models.OneToOneField(
        DispatchRequest,
        on_delete=models.CASCADE,
        related_name="assignment",
        verbose_name="파견 요청",
    )
    selected_application = models.OneToOneField(
        DispatchApplication,
        on_delete=models.PROTECT,
        related_name="assignment",
        verbose_name="선정된 지원",
    )

    status = models.CharField(
        max_length=30,
        choices=DispatchAssignmentStatus.choices,
        default=DispatchAssignmentStatus.ASSIGNED,
        db_index=True,
    )
    admin_memo = models.TextField(blank=True, verbose_name="관리자 메모")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "강사 배치/파견"
        verbose_name_plural = "강사 배치/파견"

    def clean(self):
        if self.selected_application.dispatch_request_id != self.dispatch_request_id:
            raise ValidationError(
                "selected_application must belong to the same dispatch_request."
            )

    def __str__(self) -> str:
        return f"{self.dispatch_request} -> {self.selected_application.teacher_application}"
