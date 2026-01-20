from __future__ import annotations

from datetime import date, timedelta
from typing import Iterable


def calculate_end_date(
    start_date: date, class_days: Iterable[str], lecture_count: int
) -> date:
    """
    start_date부터 class_days(예: ["MON","WED"])에 해당하는 날짜를 수업일로 카운트해서
    lecture_count회차 수업이 열리는 '마지막 수업일'을 반환.
    """
    if not start_date:
        raise ValueError("start_date is required.")
    if not class_days:
        raise ValueError("class_days is required.")
    if lecture_count is None or lecture_count < 1:
        raise ValueError("lecture_count must be >= 1.")

    day_map = {"MON": 0, "TUE": 1, "WED": 2, "THU": 3, "FRI": 4, "SAT": 5, "SUN": 6}
    wanted = {day_map[d] for d in class_days}

    current = start_date
    count = 0
    last = start_date
    # 안전장치: 무한루프 방지 (lecture_count가 비정상적으로 큰 경우)
    for _ in range(0, 3660):  # 최대 10년치 탐색
        if current.weekday() in wanted and current >= start_date:
            count += 1
            last = current
            if count >= lecture_count:
                return last
        current += timedelta(days=1)

    return last
