from datetime import time

from django import forms
from django.contrib import admin, messages
from django.urls import path, reverse
from django.shortcuts import redirect
from django.utils.html import format_html
from django.template.response import TemplateResponse

from .models import DAY_KEYS, DispatchRequest
from teacher_applications.admin_widgets import WeeklyTimeTableWidget

# ✅ 추가 import
from teacher_applications.geo import teachers_within_radius
from teacher_applications.models import TeacherApplication, ApplicationStatusChoices
from .emails import send_dispatch_request_to_selected_teachers


def _time_to_slot_index(t: time, step_minutes: int) -> int:
    return ((t.hour * 60) + t.minute) // step_minutes


def _slot_index_to_time(slot_index: int, step_minutes: int) -> time:
    minutes = slot_index * step_minutes
    h = minutes // 60
    m = minutes % 60
    return time(hour=h % 24, minute=m)


def _build_payload_from_instance(obj: DispatchRequest) -> dict:
    """
    모델(class_days/start_time/end_time) -> 위젯 payload(요일별 slotIndex 배열)
    A안: 모든 요일에 동일한 시간 구간을 칠해둔 형태로 생성
    """
    step = 30
    payload = {
        "tz": "Asia/Seoul",
        "stepMinutes": step,
        "startHour": 6,
        "endHour": 24,
        "days": {k: [] for k in ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]},
    }

    days = obj.class_days or []
    if not days or not obj.start_time or not obj.end_time:
        return payload

    from_slot = _time_to_slot_index(obj.start_time, step)
    to_slot = _time_to_slot_index(obj.end_time, step)
    for d in days:
        dk = str(d).upper()
        if dk in payload["days"]:
            payload["days"][dk] = list(range(from_slot, to_slot))
    return payload


def _extract_common_range(days_map: dict, step_minutes: int):
    """
    위젯 payload -> (selected_days, start_slot, end_slot_exclusive)
    검증:
      - 선택된 요일들의 슬롯이 '연속 1구간'이어야 함
      - 선택된 모든 요일이 동일한 (start,end) 구간이어야 함
    """
    selected_days = []
    common = None  # (start, endExclusive)

    for day_key, slots in (days_map or {}).items():
        if not slots:
            continue

        selected_days.append(day_key)
        uniq = sorted(set(int(s) for s in slots))

        # 연속 1구간 검증
        start = uniq[0]
        end_excl = uniq[-1] + 1
        expected = list(range(start, end_excl))
        if uniq != expected:
            raise forms.ValidationError(
                f"{day_key}: 선택 슬롯이 연속된 1개 구간이어야 합니다(여러 구간/구멍 금지)."
            )

        if common is None:
            common = (start, end_excl)
        elif common != (start, end_excl):
            raise forms.ValidationError(
                "현재 모델은 '모든 요일에 동일한 시작/종료 시간'만 저장할 수 있습니다. "
                "요일마다 다른 시간대로 선택할 수 없습니다."
            )

    return selected_days, common


class DispatchRequestAdminForm(forms.ModelForm):
    weekly_timetable = forms.CharField(
        label="주간 타임테이블(30분 단위)",
        required=False,
        widget=WeeklyTimeTableWidget,
        help_text="드래그로 선택하세요. (현재 모델 특성상 모든 요일은 동일한 시작/종료 시간이어야 합니다.)",
    )

    class Meta:
        model = DispatchRequest
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # ✅ teacher_name: ACCEPTED(채용 확정) 강사만 선택 가능하게 제한
        if "teacher_name" in self.fields:
            self.fields["teacher_name"].queryset = TeacherApplication.objects.filter(
                status=ApplicationStatusChoices.ACCEPTED
            )

        obj = self.instance
        if obj and obj.pk:
            self.initial["weekly_timetable"] = _build_payload_from_instance(obj)

    def clean_weekly_timetable(self):
        raw = self.cleaned_data.get("weekly_timetable")

        # 위젯이 dict로 주는지 / JSON 문자열로 주는지 케이스가 갈릴 수 있어 방어적으로 처리
        import json

        if not raw:
            self.cleaned_data["class_days"] = []
            self.cleaned_data["start_time"] = None
            self.cleaned_data["end_time"] = None
            return raw

        if isinstance(raw, str):
            try:
                payload = json.loads(raw)
            except Exception as e:
                raise forms.ValidationError(
                    "타임테이블 데이터(JSON)가 올바르지 않습니다."
                ) from e
        else:
            payload = raw

        step = int(payload.get("stepMinutes") or 30)
        if step != 30:
            raise forms.ValidationError("현재는 30분 단위만 지원합니다.")

        days_map = payload.get("days") or {}
        selected_days, common = _extract_common_range(days_map, step)

        if not selected_days:
            self.cleaned_data["class_days"] = []
            self.cleaned_data["start_time"] = None
            self.cleaned_data["end_time"] = None
            return raw

        if common is None:
            raise forms.ValidationError("선택값을 해석할 수 없습니다.")

        start_slot, end_slot_excl = common
        start_time = _slot_index_to_time(start_slot, step)
        end_time = _slot_index_to_time(end_slot_excl, step)

        # 모델 필드로 역매핑
        self.cleaned_data["class_days"] = [d for d in selected_days if d in DAY_KEYS]
        self.cleaned_data["start_time"] = start_time
        self.cleaned_data["end_time"] = end_time

        return raw


@admin.register(DispatchRequest)
class DispatchRequestAdmin(admin.ModelAdmin):
    form = DispatchRequestAdminForm

    # ✅ change 페이지 하단 버튼용 템플릿
    change_form_template = "admin/dispatch_requests/dispatchrequest/change_form.html"

    list_display = (
        "id",
        "culture_center",
        "teaching_language",
        "instructor_type",
        "teacher_name",
        "course_title",
        "status",
        "created_at",
    )
    list_filter = ("status", "teaching_language", "culture_center__center__name")
    search_fields = ("course_title", "applicant_name", "applicant_email")
    readonly_fields = ("created_at", "updated_at", "requester")

    exclude = ("class_days", "start_time", "end_time")

    fieldsets = (
        (
            "기본 정보",
            {
                "fields": (
                    "requester",
                    "culture_center",
                    "teaching_language",
                    "course_title",
                    "instructor_type",
                    "teacher_name",
                    "status",
                )
            },
        ),
        (
            "수업 시간",
            {
                "classes": (
                    "collapse",
                    "collapsed",
                ),
                "fields": (
                    "weekly_timetable",
                    "start_date",
                    "end_date",
                    "lecture_count",
                ),
            },
        ),
        (
            "신청자 정보",
            {
                "fields": (
                    "applicant_name",
                    "applicant_phone",
                    "applicant_email",
                )
            },
        ),
        (
            "기타",
            {
                "fields": (
                    "students_count",
                    "extra_requirements",
                )
            },
        ),
        (
            "메타",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    # ✅ 커스텀 URL 추가
    def get_urls(self):
        urls = super().get_urls()
        custom = [
            path(
                "<path:object_id>/send-teacher-emails/",
                self.admin_site.admin_view(self.send_teacher_emails_view),
                name="dispatch_requests_dispatchrequest_send_teacher_emails",
            ),
        ]
        return custom + urls

    # ✅ change_form에 버튼 URL 주입 (※ 반드시 클래스 안에 있어야 함)
    def change_view(self, request, object_id, form_url="", extra_context=None):
        extra_context = extra_context or {}
        extra_context["send_teacher_emails_url"] = reverse(
            "admin:dispatch_requests_dispatchrequest_send_teacher_emails",
            args=[object_id],
        )
        return super().change_view(
            request, object_id, form_url, extra_context=extra_context
        )

    def _get_candidates(self, *, obj: DispatchRequest, radius_km: float):
        cc = obj.culture_center
        if not cc or cc.latitude is None or cc.longitude is None:
            return (
                None,
                "문화센터 지점의 위도/경도가 설정되지 않아 거리 계산을 할 수 없습니다.",
            )

        center_lat = float(cc.latitude)
        center_lng = float(cc.longitude)

        qs = teachers_within_radius(
            center_lat=center_lat,
            center_lng=center_lng,
            radius_km=float(radius_km),
        ).filter(
            status=ApplicationStatusChoices.ACCEPTED,
            teaching_languages=obj.teaching_language,
        )

        # teachers_within_radius가 distance_km를 붙인다는 전제 하에 거리순 정렬
        teachers = sorted(qs, key=lambda t: float(getattr(t, "distance_km", 10**9)))
        return teachers, None

    # ✅ 버튼 클릭 후: (GET) 선택 화면, (POST) 선택된 강사에게 발송
    def send_teacher_emails_view(self, request, object_id):
        obj = self.get_object(request, object_id)
        if obj is None:
            messages.error(request, "요청서를 찾을 수 없습니다.")
            return redirect("..")

        # 반경 기본값 5km
        try:
            radius = int(request.GET.get("radius") or request.POST.get("radius") or 5)
        except Exception:
            radius = 5
        if radius not in (5, 15, 20):
            radius = 5

        if request.method == "GET":
            teachers, err = self._get_candidates(obj=obj, radius_km=radius)
            if err:
                messages.error(request, err)
                return redirect("..")

            context = dict(
                self.admin_site.each_context(request),
                opts=self.model._meta,
                original=obj,
                title="강사 이메일 발송 대상 선택",
                radius=radius,
                teachers=teachers,
                teaching_language=obj.teaching_language,
            )
            return TemplateResponse(
                request,
                "admin/dispatch_requests/dispatchrequest/send_teacher_emails.html",
                context,
            )

        if request.method != "POST":
            messages.error(request, "잘못된 요청입니다(GET/POST만 허용).")
            return redirect("..")

        selected_ids = request.POST.getlist("teacher_ids")
        if not selected_ids:
            messages.warning(request, "선택된 강사가 없습니다.")
            return redirect(request.path + f"?radius={radius}")

        teachers, err = self._get_candidates(obj=obj, radius_km=radius)
        if err:
            messages.error(request, err)
            return redirect("..")

        # 보안/정합성: 현재 조건/반경 후보에 포함되는 강사만 허용
        candidate_by_id = {str(t.pk): t for t in teachers}
        selected_teachers = [
            candidate_by_id[tid] for tid in selected_ids if tid in candidate_by_id
        ]

        if not selected_teachers:
            messages.warning(
                request,
                "선택된 강사가 현재 조건/반경 후보에 없습니다. 다시 선택해주세요.",
            )
            return redirect(request.path + f"?radius={radius}")

        result = send_dispatch_request_to_selected_teachers(
            dispatch_request=obj,
            teachers=selected_teachers,
        )

        messages.success(
            request,
            format_html(
                "이메일 발송 완료: 선택 {}명 / 성공 {}건 / 실패 {}건",
                result["target_count"],
                result["sent_count"],
                result["failed_count"],
            ),
        )
        if result["failed_count"] > 0:
            messages.warning(
                request,
                "일부 발송 실패가 있습니다. (메일 설정/수신자 이메일/SMTP 상태를 확인하세요.)",
            )

        return redirect("..")
