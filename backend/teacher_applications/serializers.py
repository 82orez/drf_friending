from rest_framework import serializers
from datetime import date
from .models import TeacherApplication


class TeacherApplicationSerializer(serializers.ModelSerializer):
    """
    Teacher application serializer
    외국인 어학 강사 이력서 지원서 Serializer
    """

    # 파일 필드는 명시적으로 적어주는 게 가독성에 좋음
    profile_image = serializers.ImageField(
        write_only=False,
        required=True,
        help_text="Profile image (max 2MB, JPG/PNG) / 프로필 이미지 (최대 2MB, JPG/PNG)",
    )
    visa_scan = serializers.ImageField(
        write_only=False,
        required=True,
        help_text="Visa copy (max 2MB, JPG/PNG) / 비자 사본 (최대 2MB, JPG/PNG)",
    )

    # 읽기 전용 필드로 추가 정보 제공
    age = serializers.SerializerMethodField(read_only=True)
    is_visa_expiring_soon = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = TeacherApplication
        fields = "__all__"
        read_only_fields = (
            "id",
            "user",
            "status",
            "created_at",
            "updated_at",
            "age",
            "is_visa_expiring_soon",
        )

    # -------------------------------
    # 읽기 전용 필드 계산 메서드들
    # -------------------------------
    def get_age(self, obj):
        """생년월일로부터 나이 계산"""
        if obj.date_of_birth:
            today = date.today()
            return (
                today.year
                - obj.date_of_birth.year
                - (
                    (today.month, today.day)
                    < (obj.date_of_birth.month, obj.date_of_birth.day)
                )
            )
        return None

    def get_is_visa_expiring_soon(self, obj):
        """비자가 3개월 이내 만료인지 확인"""
        if obj.visa_expiry_date:
            days_until_expiry = (obj.visa_expiry_date - date.today()).days
            return days_until_expiry <= 90
        return None

    # -------------------------------
    # 필드 단위 검증
    # -------------------------------
    def validate_email(self, value):
        """이메일 중복 검증 (같은 이메일로 중복 지원 방지)"""
        if self.instance is None:  # 생성할 때만
            if TeacherApplication.objects.filter(email=value).exists():
                raise serializers.ValidationError(
                    "This email has already been used for an application. "
                    "이미 해당 이메일로 지원서가 제출되어 있습니다."
                )
        return value

    def validate_date_of_birth(self, value):
        """생년월일 유효성 검증"""
        if value:
            today = date.today()
            if value > today:
                raise serializers.ValidationError(
                    "Date of birth cannot be in the future. "
                    "생년월일은 미래 날짜일 수 없습니다."
                )
            age = (
                today.year
                - value.year
                - ((today.month, today.day) < (value.month, value.day))
            )
            if age < 18:
                raise serializers.ValidationError(
                    "Applicant must be at least 18 years old. "
                    "지원자는 만 18세 이상이어야 합니다."
                )
            if age > 80:
                raise serializers.ValidationError(
                    "Please check the date of birth. 생년월일을 다시 확인해 주세요."
                )
        return value

    def validate_phone_number(self, value):
        """전화번호 형식 검증"""
        import re

        # 한국 전화번호 형식 검증 (간단한 패턴)
        phone_pattern = re.compile(r"^(\+82|0)?[0-9]{1,2}-?[0-9]{3,4}-?[0-9]{4}$")
        if not phone_pattern.match(value.replace(" ", "").replace("-", "")):
            raise serializers.ValidationError(
                "Please enter a valid phone number. " "올바른 전화번호를 입력해 주세요."
            )
        return value

    # -------------------------------
    # 전체 레벨 검증
    # -------------------------------
    def validate(self, attrs):
        errors = {}

        # === 1. 유저당 1개 이력서만 허용 (1:1 관계 검증) ===
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None

        # 생성(create) 시에만 검증 (수정(update)은 허용)
        if self.instance is None:
            # 로그인 기반으로 운영한다면: 로그인 여부도 체크 가능
            if user and user.is_authenticated:
                # 이미 이 유저에게 TeacherApplication 이 연결되어 있다면 생성 불가
                if hasattr(user, "teacher_application"):
                    errors["non_field_errors"] = (
                        "You have already submitted an application. "
                        "이미 이력서가 등록되어 있습니다. 기존 이력서만 수정할 수 있습니다."
                    )

        # === 2. 필수 동의 항목 강제 ===
        required_true_fields = [
            "consent_personal_data",
            "consent_data_retention",
            "confirmation_info_true",
        ]
        for field in required_true_fields:
            if not attrs.get(field):
                errors[field] = (
                    "This consent is required to submit the application. "
                    "해당 동의는 지원서를 제출하기 위해 반드시 필요합니다."
                )

        # === 3. 기본 이미지 필수 확인 ===
        if self.instance is None:  # create일 때만
            if not attrs.get("profile_image"):
                errors["profile_image"] = (
                    "Profile image is required. 프로필 이미지는 필수입니다."
                )
            if not attrs.get("visa_scan"):
                errors["visa_scan"] = "Visa copy is required. 비자 사본은 필수입니다."

        # === 4. 비자 만료일 검증 ===
        if attrs.get("visa_expiry_date"):
            if attrs["visa_expiry_date"] <= date.today():
                errors["visa_expiry_date"] = (
                    "Visa expiry date must be in the future. "
                    "비자 만료일은 미래 날짜여야 합니다."
                )

        # === 5. 근무 경력 검증 ===
        total_exp = attrs.get("total_teaching_experience_years", 0) or 0
        korea_exp = attrs.get("korea_teaching_experience_years", 0) or 0
        if korea_exp > total_exp:
            errors["korea_teaching_experience_years"] = (
                "Korea experience cannot exceed total experience. "
                "한국 경력은 총 경력을 초과할 수 없습니다."
            )

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

    # -------------------------------
    # 생성 로직 오버라이드
    # -------------------------------
    def create(self, validated_data):
        """
        생성 시 현재 요청의 user 를 TeacherApplication.user 로 설정.
        이미 이력서가 있는 경우 방어적으로 한 번 더 체크.
        """
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None

        if user and user.is_authenticated:
            # 이미 이력서가 있다면 생성 불가
            if hasattr(user, "teacher_application"):
                raise serializers.ValidationError(
                    {
                        "non_field_errors": [
                            "You have already submitted an application. "
                            "이미 이력서가 등록되어 있습니다. 기존 이력서만 수정할 수 있습니다."
                        ]
                    }
                )
            validated_data["user"] = user

        return super().create(validated_data)
