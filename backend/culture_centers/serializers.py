from rest_framework import serializers
from .models import CultureCenter


class CultureCenterBranchSerializer(serializers.ModelSerializer):
    center_name = serializers.CharField(source="center.name", read_only=True)
    region_name = serializers.CharField(source="region.name", read_only=True)

    class Meta:
        model = CultureCenter
        fields = [
            "id",
            "center_name",
            "region_name",
            "branch_name",
            "address_detail",
            "center_phone",
            "manager_name",
            "manager_phone",
            "manager_email",
            "latitude",
            "longitude",
            "notes",
        ]
