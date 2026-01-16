from datetime import time

from django import forms
from django.contrib import admin

from .models import DAY_KEYS, DispatchRequest
from teacher_applications.admin_widgets import WeeklyTimeTableWidget


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

    list_display = (
        "id",
        "culture_center",
        "teaching_language",
        "instructor_type",
        "course_title",
        "status",
        "created_at",
    )
    list_filter = ("status", "teaching_language", "culture_center__center__name")
    search_fields = ("course_title", "applicant_name", "applicant_email")
    readonly_fields = ("created_at", "updated_at", "requester")

    # 기존 입력 필드를 직접 편집하지 않게 하고(선택),
    # weekly_timetable 하나로만 수정하도록 유도
    exclude = ("class_days", "start_time", "end_time")

    # ✅ weekly_timetable 표시 위치를 여기서 고정/조정
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
