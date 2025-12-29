from import_export import resources, fields
from import_export.widgets import ForeignKeyWidget

from .models import Center, Region, CultureCenter


def _clean_cell(v):
    if v is None:
        return ""
    s = str(v).strip()
    return "" if s.lower() == "nan" else s


class CultureCenterBaseResource(resources.ModelResource):
    """
    엑셀 헤더 기준:
    센터명 / 지역 / 지점명 / 주소 / 비고
    (추가 필드: center_phone, manager_name, manager_phone, manager_email 은 엑셀에 있으면 매핑됨)
    """

    center = fields.Field(
        column_name="센터명",
        attribute="center",
        widget=ForeignKeyWidget(Center, "name"),
    )
    region = fields.Field(
        column_name="지역",
        attribute="region",
        widget=ForeignKeyWidget(Region, "name"),
    )
    branch_name = fields.Field(column_name="지점명", attribute="branch_name")
    address_detail = fields.Field(column_name="주소", attribute="address_detail")
    notes = fields.Field(column_name="비고", attribute="notes")

    # ✅ 엑셀에 컬럼이 있으면 자동 반영(없으면 빈 값)
    center_phone = fields.Field(column_name="센터전화", attribute="center_phone")
    manager_name = fields.Field(column_name="담당자명", attribute="manager_name")
    manager_phone = fields.Field(column_name="담당자전화", attribute="manager_phone")
    manager_email = fields.Field(column_name="담당자이메일", attribute="manager_email")

    class Meta:
        model = CultureCenter

        # ✅ 중복 판단 기준(고유 키)
        import_id_fields = ("center", "region", "branch_name")

        fields = (
            "center",
            "region",
            "branch_name",
            "address_detail",
            "notes",
            "center_phone",
            "manager_name",
            "manager_phone",
            "manager_email",
        )

        skip_unchanged = True
        report_skipped = True

    def before_import_row(self, row, **kwargs):
        # 값 정리
        row["센터명"] = _clean_cell(row.get("센터명"))
        row["지역"] = _clean_cell(row.get("지역"))
        row["지점명"] = _clean_cell(row.get("지점명"))
        row["주소"] = _clean_cell(row.get("주소"))
        row["비고"] = _clean_cell(row.get("비고"))

        # FK 마스터 자동 생성
        if row["센터명"]:
            Center.objects.get_or_create(name=row["센터명"])
        if row["지역"]:
            Region.objects.get_or_create(name=row["지역"])


class CultureCenterUpsertResource(CultureCenterBaseResource):
    """
    ✅ 정책 A: 중복이면 업데이트(Upsert)
    - import_id_fields로 기존 레코드를 찾아 자동 UPDATE
    - 주소/비고/연락처 등 엑셀 값으로 덮어씀
    """

    class Meta(CultureCenterBaseResource.Meta):
        pass


class CultureCenterInsertOnlyResource(CultureCenterBaseResource):
    """
    ✅ 정책 B: 중복이면 스킵(Insert-only)
    - 이미 있는 (센터+지역+지점명) 조합이면 그 행은 SKIP
    """

    def skip_row(self, instance, original, row, import_validation_errors=None):
        # original != None => 기존 레코드가 있었다는 뜻(=중복)
        if original is not None:
            return True
        return super().skip_row(instance, original, row, import_validation_errors)
