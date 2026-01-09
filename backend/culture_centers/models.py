from django.db import models

# ✅ added
from django.core.validators import MinValueValidator, MaxValueValidator


class Region(models.Model):
    name = models.CharField("지역", max_length=50, unique=True)
    notes = models.CharField("비고", max_length=255, blank=True, null=True)

    created_at = models.DateTimeField("생성일", auto_now_add=True)
    updated_at = models.DateTimeField("수정일", auto_now=True)

    class Meta:
        verbose_name = "지역"
        verbose_name_plural = "지역"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Center(models.Model):
    name = models.CharField("문화센터 이름", max_length=100, unique=True)
    notes = models.CharField("비고", max_length=255, blank=True, null=True)

    created_at = models.DateTimeField("생성일", auto_now_add=True)
    updated_at = models.DateTimeField("수정일", auto_now=True)

    class Meta:
        verbose_name = "문화센터(센터명)"
        verbose_name_plural = "문화센터(센터명)"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class CultureCenter(models.Model):
    center = models.ForeignKey(
        Center,
        on_delete=models.PROTECT,
        related_name="branches",
        verbose_name="문화센터 이름",
    )
    region = models.ForeignKey(
        Region,
        on_delete=models.PROTECT,
        related_name="culture_centers",
        verbose_name="지역",
    )

    branch_name = models.CharField("지점 이름", max_length=100)
    address_detail = models.CharField("상세 주소", max_length=255)

    # ✅ 추가: 모두 nullable
    center_phone = models.CharField(
        "센터 전화번호", max_length=50, blank=True, null=True
    )
    manager_name = models.CharField(
        "담당자 이름", max_length=100, blank=True, null=True
    )
    manager_phone = models.CharField(
        "담당자 전화번호", max_length=50, blank=True, null=True
    )
    manager_email = models.EmailField("담당자 이메일", blank=True, null=True)

    # ✅ added: 위치(좌표) - 추후 구글맵 등에서 세팅해서 "내 주변 강사/센터(거리순)"에 사용
    latitude = models.DecimalField(
        "위도",
        max_digits=9,
        decimal_places=6,
        blank=True,
        null=True,
        db_index=True,
        validators=[MinValueValidator(-90), MaxValueValidator(90)],
        help_text="e.g. 37.313313 (WGS84). Optional for now.",
    )
    longitude = models.DecimalField(
        "경도",
        max_digits=9,
        decimal_places=6,
        blank=True,
        null=True,
        db_index=True,
        validators=[MinValueValidator(-180), MaxValueValidator(180)],
        help_text="e.g. 127.081270 (WGS84). Optional for now.",
    )

    notes = models.CharField("비고", max_length=255, blank=True, null=True)

    created_at = models.DateTimeField("생성일", auto_now_add=True)
    updated_at = models.DateTimeField("수정일", auto_now=True)

    class Meta:
        verbose_name = "문화센터 지점"
        verbose_name_plural = "문화센터 지점"
        indexes = [
            models.Index(fields=["center"]),
            models.Index(fields=["region"]),
            models.Index(fields=["branch_name"]),
            models.Index(fields=["latitude", "longitude"], name="cc_lat_lng_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["center", "region", "branch_name"],
                name="uniq_center_region_branch",
            )
        ]

    def __str__(self) -> str:
        return f"{self.center.name} - {self.branch_name} ({self.region.name})"
