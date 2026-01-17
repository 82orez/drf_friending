# backend/teacher_applications/geo.py
from __future__ import annotations

import math
from django.db.models import F, FloatField, Value
from django.db.models.functions import (
    ACos,
    Cos,
    Sin,
    Radians,
    Least,
    Greatest,
    Cast,
)
from django.db.models.expressions import ExpressionWrapper
from .models import TeacherApplication


EARTH_RADIUS_KM = 6371.0088


def teachers_within_radius(
    *,
    center_lat: float,
    center_lng: float,
    radius_km: float = 5.0,
):
    """
    반경(radius_km) 이내 TeacherApplication queryset을
    distance_km로 annotate 후 거리순 정렬해서 반환.
    """
    # 1) bounding box (대략적인 사각형 필터)
    lat_delta = radius_km / 111.32
    # 위도에 따른 경도 1도 길이 보정
    cos_lat = math.cos(math.radians(center_lat))
    lng_delta = radius_km / (111.32 * cos_lat) if abs(cos_lat) > 1e-12 else 180.0

    qs = TeacherApplication.objects.filter(
        latitude__isnull=False,
        longitude__isnull=False,
        latitude__gte=center_lat - lat_delta,
        latitude__lte=center_lat + lat_delta,
        longitude__gte=center_lng - lng_delta,
        longitude__lte=center_lng + lng_delta,
    )

    # 2) Haversine(여기서는 acos 기반 great-circle) 거리 계산 (km)
    lat1 = Radians(Value(float(center_lat), output_field=FloatField()))
    lng1 = Radians(Value(float(center_lng), output_field=FloatField()))
    lat2 = Radians(Cast(F("latitude"), FloatField()))
    lng2 = Radians(Cast(F("longitude"), FloatField()))

    cos_angle = Cos(lat1) * Cos(lat2) * Cos(lng2 - lng1) + Sin(lat1) * Sin(lat2)

    # 부동소수점 오차로 acos 입력이 [-1,1]을 벗어나는 것 방지
    cos_angle_clamped = Least(
        Value(1.0, output_field=FloatField()),
        Greatest(Value(-1.0, output_field=FloatField()), cos_angle),
    )

    distance_km = ExpressionWrapper(
        Value(float(EARTH_RADIUS_KM), output_field=FloatField())
        * ACos(cos_angle_clamped),
        output_field=FloatField(),
    )

    qs = (
        qs.annotate(
            distance_km=distance_km,
        )
        .filter(distance_km__lte=float(radius_km))
        .order_by("distance_km")
    )

    return qs
