from __future__ import annotations

import json
from django import forms
from .models import TeacherApplication
from .admin_widgets import WeeklyTimeTableWidget

DAY_KEYS = ("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN")


def default_payload() -> dict:
    return {
        "tz": "Asia/Seoul",
        "stepMinutes": 30,
        "startHour": 6,
        "endHour": 24,
        "days": {k: [] for k in DAY_KEYS},
    }


def normalize_payload(v: object | None) -> dict | None:
    if v in (None, "", {}):
        return None

    # ✅ 방어: 혹시라도 문자열이 들어오면 dict로 파싱
    if isinstance(v, str):
        s = v.strip()
        try:
            loaded = json.loads(s)
        except Exception:
            raise forms.ValidationError("available_time_slots is invalid JSON string")

        # 이중 인코딩 방어
        if isinstance(loaded, str):
            try:
                loaded = json.loads(loaded)
            except Exception:
                raise forms.ValidationError(
                    "available_time_slots is double-encoded JSON"
                )

        v = loaded

    if not isinstance(v, dict):
        raise forms.ValidationError("available_time_slots must be a JSON object")

    base = default_payload()
    days = v.get("days") if isinstance(v.get("days"), dict) else {}
    normalized_days = {k: list(days.get(k) or []) for k in DAY_KEYS}

    start_hour = v.get("startHour", base["startHour"])
    end_hour = v.get("endHour", base["endHour"])

    try:
        start_hour = int(start_hour)
        end_hour = int(end_hour)
    except Exception:
        raise forms.ValidationError("startHour/endHour must be integers")

    return {
        "tz": "Asia/Seoul",
        "stepMinutes": 30,
        "startHour": start_hour,
        "endHour": end_hour,
        "days": normalized_days,
    }


class TeacherApplicationAdminForm(forms.ModelForm):
    available_time_slots = forms.JSONField(
        required=False,
        widget=WeeklyTimeTableWidget(),
        help_text="Weekly timetable picker (stored as JSON).",
    )

    class Meta:
        model = TeacherApplication
        fields = "__all__"

    def clean_available_time_slots(self):
        v = self.cleaned_data.get("available_time_slots")
        v = normalize_payload(v)

        if v is None:
            return None

        if v.get("tz") != "Asia/Seoul":
            raise forms.ValidationError("tz must be Asia/Seoul")
        if v.get("stepMinutes") != 30:
            raise forms.ValidationError("stepMinutes must be 30")

        start_hour = v["startHour"]
        end_hour = v["endHour"]
        if not (0 <= start_hour <= 23):
            raise forms.ValidationError("startHour must be between 0 and 23")
        if not (1 <= end_hour <= 24):
            raise forms.ValidationError("endHour must be between 1 and 24")
        if start_hour >= end_hour:
            raise forms.ValidationError("startHour must be less than endHour")

        step = 30
        start_slot = (start_hour * 60) // step
        end_slot_excl = (end_hour * 60) // step

        for day in DAY_KEYS:
            arr = v["days"].get(day, [])
            if not isinstance(arr, list):
                raise forms.ValidationError(f"{day} must be a list")

            cleaned = []
            for x in arr:
                if not isinstance(x, int):
                    raise forms.ValidationError(
                        f"{day} contains a non-integer slotIndex"
                    )
                if x < start_slot or x >= end_slot_excl:
                    raise forms.ValidationError(
                        f"{day} slotIndex {x} is out of range ({start_slot}~{end_slot_excl - 1})"
                    )
                cleaned.append(x)

            v["days"][day] = sorted(set(cleaned))

        return v
