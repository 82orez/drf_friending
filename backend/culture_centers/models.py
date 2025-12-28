# apps/culture/models.py
from django.db import models


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


class CultureCenter(models.Model):
    center_name = models.CharField("문화센터 이름", max_length=100)  # 센터명
    region = models.ForeignKey(
        Region,
        on_delete=models.PROTECT,  # ✅ 지역 삭제로 센터 데이터가 깨지지 않게 보호
        related_name="culture_centers",
        verbose_name="지역",
    )
    branch_name = models.CharField("지점 이름", max_length=100)  # 지점명
    address_detail = models.CharField("상세 주소", max_length=255)  # 주소
    notes = models.CharField("비고", max_length=255, blank=True, null=True)

    created_at = models.DateTimeField("생성일", auto_now_add=True)
    updated_at = models.DateTimeField("수정일", auto_now=True)

    class Meta:
        verbose_name = "문화센터"
        verbose_name_plural = "문화센터"
        indexes = [
            models.Index(fields=["center_name"]),
            models.Index(fields=["branch_name"]),
            models.Index(fields=["region"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["center_name", "region", "branch_name"],
                name="uniq_center_region_branch",
            )
        ]

    def __str__(self) -> str:
        return f"{self.center_name} - {self.branch_name} ({self.region.name})"
