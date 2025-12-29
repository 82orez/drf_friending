from django.contrib import admin
from import_export.admin import ImportExportModelAdmin

from .models import Region, Center, CultureCenter
from .resources import CultureCenterUpsertResource, CultureCenterInsertOnlyResource


@admin.register(Region)
class RegionAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "notes", "created_at")
    search_fields = ("name",)


@admin.register(Center)
class CenterAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "notes", "created_at")
    search_fields = ("name",)


@admin.register(CultureCenter)
class CultureCenterAdmin(ImportExportModelAdmin):
    # ✅ 리소스 2개 등록: 관리자에서 선택 가능
    resource_classes = [CultureCenterUpsertResource, CultureCenterInsertOnlyResource]

    list_display = (
        "id",
        "center",
        "region",
        "branch_name",
        "address_detail",
        "center_phone",
        "manager_name",
        "manager_phone",
        "manager_email",
    )
    list_filter = ("center", "region")
    search_fields = ("center__name", "branch_name", "address_detail")
