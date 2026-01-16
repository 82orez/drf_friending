# backend/dispatch_requests/emails.py
from __future__ import annotations

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone

from django.contrib.auth.models import Group

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

    def add_email(v: str | None):
        s = (v or "").strip()
        if s:
            recipients.add(s)

    # (A) superuser 전체
    superuser_emails = (
        User.objects.filter(is_superuser=True, is_active=True)
        .exclude(email__isnull=True)
        .exclude(email__exact="")
        .values_list("email", flat=True)
    )
    for e in superuser_emails:
        add_email(e)

    # (B) Sub_admins 그룹 전체
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

    # (C) 요청서 폼에 입력한 applicant_email (접수 안내 대상)
    add_email(getattr(dr, "applicant_email", None))

    return sorted(recipients)


def send_dispatch_request_received_email(dr: DispatchRequest) -> None:
    """
    DB에 이미 저장된 DispatchRequest 기준으로 이메일 발송.
    """
    # ✅ 최적화: email 본문 생성 전에 관련 FK들을 한 번에 로딩
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
