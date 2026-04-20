from __future__ import annotations

from django.conf import settings
from django.core.mail import send_mail

from course_posts.models import CourseApplication, CourseApplicationStatusChoices
from dispatch_requests.models import DispatchRequest


def _teacher_email(application: CourseApplication):
    teacher = application.teacher
    email = (getattr(teacher, "email", None) or "").strip()
    return email or None


def send_course_confirmed_email(application: CourseApplication, dr: DispatchRequest) -> None:
    email = _teacher_email(application)
    if not email:
        return

    frontend_url = (getattr(settings, "FRONTEND_URL", "") or "").rstrip("/")
    my_courses_url = f"{frontend_url}/teacher/courses" if frontend_url else ""

    subject = f"[Friending] 강좌가 확정되었습니다: {dr.course_title}"
    body = f"""축하합니다! 강좌가 확정되었습니다.

- 강좌명: {dr.course_title}
- 문화센터: {dr.culture_center}
- 언어: {dr.teaching_language}
- 시작일: {dr.start_date or "-"}
- 강의 횟수: {dr.lecture_count}

{('내 강좌 보기: ' + my_courses_url) if my_courses_url else ''}

Friending Team
""".strip()

    send_mail(
        subject=subject,
        message=body,
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
        recipient_list=[email],
        fail_silently=True,
    )


def send_course_rejected_email(application: CourseApplication, dr: DispatchRequest) -> None:
    email = _teacher_email(application)
    if not email:
        return

    subject = f"[Friending] 지원 결과 안내: {dr.course_title}"
    body = f"""안녕하세요.

'{dr.course_title}' 공고는 다른 강사가 최종 선정되었음을 안내드립니다.
앞으로 더 많은 기회를 전달드릴 수 있도록 하겠습니다.

감사합니다.
Friending Team
""".strip()

    send_mail(
        subject=subject,
        message=body,
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
        recipient_list=[email],
        fail_silently=True,
    )


def notify_confirmation_results(dr: DispatchRequest, selected_app: CourseApplication) -> None:
    """선정자에 축하 메일, 그 외 APPLIED/SHORTLISTED 지원자에 결과 메일 발송."""
    send_course_confirmed_email(selected_app, dr)

    other_apps = CourseApplication.objects.filter(
        dispatch_request=dr,
        status__in=[
            CourseApplicationStatusChoices.APPLIED,
            CourseApplicationStatusChoices.SHORTLISTED,
        ],
    ).exclude(pk=selected_app.pk).select_related("teacher")

    for app in other_apps:
        send_course_rejected_email(app, dr)
