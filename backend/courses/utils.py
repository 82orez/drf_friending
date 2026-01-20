from __future__ import annotations

from datetime import date, timedelta
from typing import Iterable

DAY_TO_WEEKDAY = {
    "MON": 0,
    "TUE": 1,
    "WED": 2,
    "THU": 3,
    "FRI": 4,
    "SAT": 5,
    "SUN": 6,
}


def calculate_end_date(
    start_date: date, class_days: Iterable[str], lecture_count: int
) -> date:
    """
    DispatchRequest와 동일한 정책으로 종료일 계산:
    start_date부터 class_days에 해당하는 날짜를 세어서 lecture_count번째 수업 날짜를 반환.
    """
    if not start_date:
        raise ValueError("start_date is required")

    days = list(class_days or [])
    if not days:
        raise ValueError("class_days is required")

    if lecture_count is None or int(lecture_count) < 1:
        raise ValueError("lecture_count must be >= 1")

    try:
        allowed_weekdays = {DAY_TO_WEEKDAY[str(d).upper()] for d in days}
    except KeyError:
        raise ValueError("class_days contains invalid day key")

    dt = start_date
    hits = 0

    for _ in range(366 * 3):
        if dt.weekday() in allowed_weekdays:
            hits += 1
            if hits == int(lecture_count):
                return dt
        dt = dt + timedelta(days=1)

    return dt
