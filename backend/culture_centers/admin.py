from django.contrib import admin
from .models import Region, Center, CultureCenter


@admin.register(Region)
class RegionAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "notes", "created_at")
    search_fields = ("name",)


@admin.register(Center)
class CenterAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "notes", "created_at")
    search_fields = ("name",)


@admin.register(CultureCenter)
class CultureCenterAdmin(admin.ModelAdmin):
    list_display = ("id", "center", "region", "branch_name", "address_detail")
    list_filter = ("center", "region")
    search_fields = ("center__name", "branch_name", "address_detail")
