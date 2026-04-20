# backend/dispatch_requests/emails.py
from __future__ import annotations

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import EmailMultiAlternatives, send_mail
from django.utils import timezone

from django.contrib.auth.models import Group

from teacher_applications.geo import teachers_within_radius
from teacher_applications.models import ApplicationStatusChoices

from .models import DispatchRequest


DEFAULT_NOTIFY_RADIUS_KM = 15


def _format_days(days) -> str:
    if not days:
        return "-"
    try:
        return ", ".join([str(x) for x in days])
    except Exception:
        return str(days)


def build_dispatch_request_email_text(dr: DispatchRequest) -> tuple[str, str]:
    """
    returns (subject, body_text) — 접수 알림용 (관리자/매니저 대상)
    """
    cc = getattr(dr, "culture_center", None)

    branch_name = getattr(cc, "branch_name", None) or str(cc) if cc else "-"
    center_name = getattr(getattr(cc, "center", None), "name", "") or ""
    center_region = getattr(getattr(cc, "region", None), "name", "") or ""

    subject = f"[Friending] 강사 파견 요청 접수 완료 (요청 #{dr.id})"

    body = f"""강사 파견 요청이 접수되었습니다.

요청 ID: {dr.id}
접수 시각: {timezone.localtime(dr.created_at).strftime("%Y-%m-%d %H:%M:%S")}

[문화센터]
- 센터: {center_name}
- 지역: {center_region}
- 지점: {branch_name}

[강의 정보]
- 강의 언어: {dr.teaching_language}
- 강좌명: {dr.course_title}
- 강사 형태: {dr.instructor_type}
- 강의 요일: {_format_days(dr.class_days)}
- 시간: {dr.start_time or "-"} ~ {dr.end_time or "-"}
- 시작일: {dr.start_date or "-"}
- 종료일(자동계산): {dr.end_date or "-"}
- 강의 횟수: {dr.lecture_count}
- 예상 수강생 수: {dr.students_count or "-"}
- 추가 요청사항: {dr.extra_requirements or "-"}

[신청자 정보]
- 이름: {dr.applicant_name}
- 연락처: {dr.applicant_phone}
- 이메일: {dr.applicant_email}

요청자(로그인 계정): {getattr(dr.requester, "email", "-")}
"""
    return subject, body


def get_dispatch_request_recipients(dr: DispatchRequest) -> list[str]:
    User = get_user_model()
    recipients: set[str] = set()

    def add_email(v):
        s = (v or "").strip()
        if s:
            recipients.add(s)

    superuser_emails = (
        User.objects.filter(is_superuser=True, is_active=True)
        .exclude(email__isnull=True)
        .exclude(email__exact="")
        .values_list("email", flat=True)
    )
    for e in superuser_emails:
        add_email(e)

    try:
        sub_admins = Group.objects.get(name="Sub_admins")
        group_emails = (
            sub_admins.user_set.filter(is_active=True)
            .exclude(email__isnull=True)
            .exclude(email__exact="")
            .values_list("email", flat=True)
        )
        for e in group_emails:
            add_email(e)
    except Group.DoesNotExist:
        pass

    add_email(getattr(dr, "applicant_email", None))

    return sorted(recipients)


def send_dispatch_request_received_email(dr: DispatchRequest) -> None:
    """DB에 이미 저장된 DispatchRequest 기준으로 이메일 발송. (매니저/관리자용 접수 안내)"""
    dr = DispatchRequest.objects.select_related(
        "culture_center__center",
        "culture_center__region",
        "requester",
    ).get(pk=dr.pk)

    recipients = get_dispatch_request_recipients(dr)
    if not recipients:
        return

    subject, body = build_dispatch_request_email_text(dr)

    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None) or "no-reply@localhost"

    msg = EmailMultiAlternatives(
        subject=subject,
        body=body,
        from_email=from_email,
        to=recipients,
    )
    msg.send(fail_silently=True)


def _build_teacher_open_email(dr: DispatchRequest) -> tuple[str, str]:
    cc = dr.culture_center
    frontend_url = getattr(settings, "FRONTEND_URL", "").rstrip("/")
    apply_url = f"{frontend_url}/teacher/posts/{dr.id}"

    subject = f"[Friending] New Teaching Opportunity: {dr.course_title} ({dr.teaching_language})"

    message = f"""Hello,

A new teaching opportunity is available near you.

- Culture Center: {cc}
- Language: {dr.teaching_language}
- Course: {dr.course_title}
- Instructor Type: {dr.instructor_type}
- Class Days: {", ".join(dr.class_days or [])}
- Time: {dr.start_time or ""} ~ {dr.end_time or ""}
- Start Date: {dr.start_date or ""}
- End Date: {dr.end_date or ""}
- Lecture Count: {dr.lecture_count}
- Students (expected): {dr.students_count or ""}
- Notes: {dr.notes_for_teachers or "-"}
- Extra Requirements: {dr.extra_requirements or "-"}

[Apply now →] {apply_url}

Best regards,
Friending Team
""".strip()

    return subject, message


def send_open_notification_to_matched_teachers(dr: DispatchRequest) -> dict:
    """
    공고 게시 시 호출: 반경 + 언어 + ACCEPTED 강사 전원에 개별 발송.
    """
    cc = dr.culture_center
    if not cc or cc.latitude is None or cc.longitude is None:
        return {"target_count": 0, "sent_count": 0, "failed_count": 0, "skipped_reason": "missing_center_geo"}

    teachers = teachers_within_radius(
        center_lat=float(cc.latitude),
        center_lng=float(cc.longitude),
        radius_km=float(DEFAULT_NOTIFY_RADIUS_KM),
    ).filter(
        status=ApplicationStatusChoices.ACCEPTED,
        teaching_languages=dr.teaching_language,
    )

    subject, message = _build_teacher_open_email(dr)
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None)

    seen = set()
    target_count = 0
    sent_count = 0
    failed_count = 0

    for teacher in teachers:
        email = (getattr(teacher, "email", None) or "").strip()
        if not email or email in seen:
            continue
        seen.add(email)

        target_count += 1
        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=from_email,
                recipient_list=[email],
                fail_silently=True,
            )
            sent_count += 1
        except Exception:
            failed_count += 1

    return {
        "target_count": target_count,
        "sent_count": sent_count,
        "failed_count": failed_count,
    }
