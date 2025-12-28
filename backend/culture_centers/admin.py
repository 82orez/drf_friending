# apps/culture/admin.py
from django.contrib import admin
from .models import Region, CultureCenter


@admin.register(Region)
class RegionAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "notes", "created_at")
    search_fields = ("name",)


@admin.register(CultureCenter)
class CultureCenterAdmin(admin.ModelAdmin):
    list_display = ("id", "center_name", "region", "branch_name", "address_detail")
    list_filter = ("region", "center_name")
    search_fields = ("center_name", "branch_name", "address_detail")
