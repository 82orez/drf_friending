# backend/dispatch_requests/emails.py
from __future__ import annotations

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone

from .models import DispatchRequest


def _format_days(days) -> str:
    if not days:
        return "-"
    try:
        return ", ".join([str(x) for x in days])
    except Exception:
        return str(days)


def build_dispatch_request_email_text(dr: DispatchRequest) -> tuple[str, str]:
    """
    returns (subject, body_text)
    """
    center = getattr(dr.culture_center, "branch_name", None) or str(dr.culture_center)
    center_region = getattr(dr.culture_center, "region_name", "") or ""
    center_name = getattr(dr.culture_center, "center_name", "") or ""

    subject = f"[Friending] 강사 파견 요청 접수 완료 (요청 #{dr.id})"

    body = f"""강사 파견 요청이 접수되었습니다.

요청 ID: {dr.id}
접수 시각: {timezone.localtime(dr.created_at).strftime("%Y-%m-%d %H:%M:%S")}

[문화센터]
- 센터: {center_name}
- 지역: {center_region}
- 지점: {center}

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

    recipients = set()

    # superuser들에게 발송
    for u in User.objects.filter(is_superuser=True, is_active=True).only("email"):
        if u.email:
            recipients.add(u.email.strip())

    # 요청을 만든 사용자(로그인 계정)에게 발송
    requester_email = getattr(dr.requester, "email", "") or ""
    if requester_email.strip():
        recipients.add(requester_email.strip())

    return sorted(recipients)


def send_dispatch_request_received_email(dr: DispatchRequest) -> None:
    """
    DB에 이미 저장된 DispatchRequest 기준으로 이메일 발송.
    """
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
