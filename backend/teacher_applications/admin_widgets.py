import json
from django import forms


def _coerce_to_dict(value):
    """
    JSONField가 과거 데이터/실수로 인해 문자열(JSON string)로 저장된 경우도 안전하게 dict로 변환.
    - dict면 그대로
    - str이면 json.loads 시도(최대 2번; 이중 인코딩 케이스 방어)
    """
    if value in (None, "", {}):
        return None

    if isinstance(value, dict):
        return value

    if isinstance(value, str):
        s = value.strip()
        # 1차 파싱
        try:
            loaded = json.loads(s)
        except Exception:
            return None

        # loaded가 dict면 OK
        if isinstance(loaded, dict):
            return loaded

        # loaded가 또 문자열(이중 인코딩)인 경우 2차 파싱
        if isinstance(loaded, str):
            try:
                loaded2 = json.loads(loaded)
                if isinstance(loaded2, dict):
                    return loaded2
            except Exception:
                return None

        return None

    return None


class WeeklyTimeTableWidget(forms.Widget):
    template_name = "teacher_applications/admin/widgets/weekly_timetable.html"

    class Media:
        css = {"all": ("teacher_applications/admin/weekly_timetable.css",)}
        js = ("teacher_applications/admin/weekly_timetable.js",)

    def format_value(self, value):
        # ✅ 핵심: 문자열로 저장된 JSON도 dict로 복원
        v = _coerce_to_dict(value)

        if not v:
            v = {
                "tz": "Asia/Seoul",
                "stepMinutes": 30,
                "startHour": 6,
                "endHour": 24,
                "days": {
                    "MON": [],
                    "TUE": [],
                    "WED": [],
                    "THU": [],
                    "FRI": [],
                    "SAT": [],
                    "SUN": [],
                },
            }

        try:
            return json.dumps(v, ensure_ascii=False)
        except Exception:
            return json.dumps(
                {
                    "tz": "Asia/Seoul",
                    "stepMinutes": 30,
                    "startHour": 6,
                    "endHour": 24,
                    "days": {
                        "MON": [],
                        "TUE": [],
                        "WED": [],
                        "THU": [],
                        "FRI": [],
                        "SAT": [],
                        "SUN": [],
                    },
                },
                ensure_ascii=False,
            )

    def get_context(self, name, value, attrs):
        ctx = super().get_context(name, value, attrs)
        ctx["widget"]["value"] = self.format_value(value)
        return ctx
