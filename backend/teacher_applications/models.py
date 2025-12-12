from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator
from django.db import models
from datetime import date


# === 공통 유효성 검사기 ===
def validate_image_size_under_2mb(value):
    max_size = 2 * 1024 * 1024  # 2MB
    if value.size > max_size:
        raise ValidationError(
            "이미지 파일 크기는 2MB 이하여야 합니다. (Max size is 2MB)"
        )


# === 선택지(Choices) 정의 ===
class GenderChoices(models.TextChoices):
    MALE = "MALE", "Male / 남성"
    FEMALE = "FEMALE", "Female / 여성"
    OTHER = "OTHER", "Other / 기타"
    PREFER_NOT = "PREFER_NOT", "Prefer not to say / 선택하지 않음"


class VisaTypeChoices(models.TextChoices):
    E2 = "E-2", "E-2"
    F2 = "F-2", "F-2"
    F4 = "F-4", "F-4"
    F5 = "F-5", "F-5"
    D10 = "D-10", "D-10"
    OTHER = "OTHER", "Other / 기타"


class TeachingLanguageChoices(models.TextChoices):
    ENGLISH = "English", "English"
    JAPANESE = "Japanese", "Japanese"
    CHINESE = "Chinese", "Chinese"
    SPANISH = "Spanish", "Spanish"


class EmploymentTypeChoices(models.TextChoices):
    FULL_TIME = "FULL_TIME", "Full-time / 풀타임"
    PART_TIME = "PART_TIME", "Part-time / 파트타임"
    FREELANCE = "FREELANCE", "Freelance / 프리랜서"
    ANY = "ANY", "Any / 상관없음"


class ApplicationStatusChoices(models.TextChoices):
    NEW = "NEW", "New / 신규"
    IN_REVIEW = "IN_REVIEW", "In review / 검토 중"
    ACCEPTED = "ACCEPTED", "Accepted / 채용 확정"
    REJECTED = "REJECTED", "Rejected / 불합격"


class TeacherApplication(models.Model):
    """
    Foreign language teacher resume application.
    한국에서 일하는(또는 일하고 싶은) 외국인 어학 강사의 이력서를 접수하는 모델.
    """

    # 로그인 기반으로 운영하고 싶다면: 유저와 연결 (없어도 동작 가능)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=False,  # 로그인 안 한 이력서를 허용하지 않으려면 False 로 바꿔도 됨
        blank=False,
        related_name="teacher_application",  # 단수형으로 변경 (옵션)
        verbose_name="User / 사용자",
    )

    # --- 1. 기본 인적 정보 (Personal Information / 개인정보) ---

    profile_image = models.ImageField(
        upload_to="teacher_applications/profile_images/",
        validators=[
            validate_image_size_under_2mb,
            FileExtensionValidator(["jpg", "jpeg", "png"]),
        ],
        verbose_name="Profile image (2MB max, JPG/PNG) / 프로필 이미지 (최대 2MB, JPG/PNG)",
    )

    first_name = models.CharField(
        max_length=50,
        verbose_name="First name / 이름 (First Name)",
    )
    last_name = models.CharField(
        max_length=50,
        verbose_name="Last name / 성 (Last Name)",
    )
    korean_name = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        verbose_name="Korean name / 한국 이름 (선택)",
    )

    gender = models.CharField(
        max_length=20,
        choices=GenderChoices.choices,
        blank=True,
        verbose_name="Gender / 성별",
    )

    date_of_birth = models.DateField(
        blank=True,
        null=True,
        verbose_name="Date of birth / 생년월일",
    )

    nationality = models.CharField(
        max_length=100,
        verbose_name="Nationality",
    )
    native_language = models.CharField(
        max_length=100,
        verbose_name="Native language / 모국어",
    )

    email = models.EmailField(
        verbose_name="Email address",
    )
    phone_number = models.CharField(
        max_length=30,
        verbose_name="Phone number / 전화번호",
    )

    address_line1 = models.CharField(
        max_length=255,
        verbose_name="Address (street & detail) / 주소 (도로명·상세)",
    )
    city = models.CharField(
        max_length=100,
        verbose_name="City / 도시",
    )
    district = models.CharField(
        max_length=100,
        verbose_name="District / 구·군",
    )
    postal_code = models.CharField(
        max_length=20,
        blank=True,
        verbose_name="Postal code / 우편번호",
    )

    # --- 2. 비자 정보 (Visa Information / 비자 정보) ---

    visa_type = models.CharField(
        max_length=20,
        choices=VisaTypeChoices.choices,
        verbose_name="Visa type",
    )
    visa_expiry_date = models.DateField(
        blank=True,
        null=True,
        verbose_name="Visa expiry date / 비자 만료일",
    )
    visa_scan = models.ImageField(
        upload_to="teacher_applications/visa_scans/",
        validators=[
            validate_image_size_under_2mb,
            FileExtensionValidator(["jpg", "jpeg", "png"]),
        ],
        verbose_name="Visa copy (2MB max, JPG/PNG) / 비자 사본 (최대 2MB, JPG/PNG)",
    )

    # --- 3. 강의 관련 정보 (Teaching Profile / 강의 프로필) ---

    teaching_languages = models.CharField(
        max_length=20,
        choices=TeachingLanguageChoices.choices,
        verbose_name="Languages you can teach / 가르칠 수 있는 언어",
        help_text="Please select one language. / 한 가지만 선택해 주세요.",
    )

    preferred_subjects = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Preferred subjects / 선호 수업 분야",
        help_text="e.g. Conversation, Business English, Kids / 예: 회화, 비즈니스, 어린이 영어 등",
    )

    total_teaching_experience_years = models.DecimalField(
        max_digits=4,
        decimal_places=1,
        blank=True,
        null=True,
        verbose_name="Total teaching experience (years) / 총 강의 경력 (년)",
    )
    korea_teaching_experience_years = models.DecimalField(
        max_digits=4,
        decimal_places=1,
        blank=True,
        null=True,
        verbose_name="Teaching experience in Korea (years) / 한국 강의 경력 (년)",
    )

    # --- 4. 웹에서 직접 작성하는 이력 내용 (Resume Details on Page) ---

    self_introduction = models.TextField(
        verbose_name="Self introduction / 자기소개",
        help_text="Briefly introduce yourself as a teacher. / 강사로서 본인을 간단히 소개해 주세요.",
    )

    education_history = models.TextField(
        verbose_name="Education history / 학력 사항",
        help_text="List universities, degrees, majors, and years. / 학교, 학위, 전공, 기간 등을 적어 주세요.",
    )

    experience_history = models.TextField(
        verbose_name="Teaching & work experience / 강의 및 근무 경력",
        help_text="List teaching and work experience in order. / 강의 및 근무 경력을 순서대로 적어 주세요.",
    )

    certifications = models.TextField(
        blank=True,
        verbose_name="Certificates & qualifications / 자격증 및 인증",
        help_text="e.g. TESOL, CELTA, etc. / 예: TESOL, CELTA 등",
    )

    teaching_style = models.TextField(
        blank=True,
        verbose_name="Teaching style & strengths / 수업 스타일 및 강점",
    )

    additional_info = models.TextField(
        blank=True,
        verbose_name="Additional information / 기타 참고 사항",
    )

    # --- 5. 희망 근무 조건 (Preferred Working Conditions / 희망 근무 조건) ---

    employment_type = models.CharField(
        max_length=20,
        choices=EmploymentTypeChoices.choices,
        blank=True,
        verbose_name="Employment type / 근무 형태",
    )

    preferred_locations = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Preferred locations / 선호 근무 지역",
        help_text="e.g. Seoul, Online only / 예: 서울, 온라인만 등",
    )

    available_time_slots = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Available time slots / 근무 가능 시간대",
        help_text="e.g. Weekdays evenings, Weekends / 예: 평일 저녁, 주말 등",
    )

    available_from_date = models.DateField(
        blank=True,
        null=True,
        verbose_name="Available from / 근무 시작 가능 일자",
    )

    # --- 6. 동의 항목 (Consents / 동의 항목) ---

    consent_personal_data = models.BooleanField(
        default=False,
        verbose_name="Consent to personal data usage / 개인정보 수집·이용 동의",
    )
    consent_data_retention = models.BooleanField(
        default=False,
        verbose_name="Consent to data retention / 정보 보관 기간 동의",
    )
    consent_third_party_sharing = models.BooleanField(
        default=False,
        verbose_name="Consent to share with partner institutes / 제3자 제공 동의",
    )
    confirmation_info_true = models.BooleanField(
        default=False,
        verbose_name="Confirm information is true / 정보의 정확성 확인",
    )

    # --- 7. 메타 정보 (Meta info) ---

    status = models.CharField(
        max_length=20,
        choices=ApplicationStatusChoices.choices,
        default=ApplicationStatusChoices.NEW,
        verbose_name="지원 상태",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="신청 일시",
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="수정 일시",
    )

    # --- 8. 관리자 전용 필드 (Admin Only Fields / 관리자 전용) ---

    memo = models.TextField(
        blank=True,
        verbose_name="Memo / 메모",
        help_text="특이 사항 등 간단한 메모 (관리자 전용) / Brief notes for special remarks (Admin only)",
    )

    evaluation_result = models.TextField(
        max_length=1000,
        blank=True,
        verbose_name="Evaluation Result / 평가 결과",
        help_text="전체적인 이력서 평가 결과 (1000자 이내, 관리자 전용) / Overall resume evaluation result (max 1000 chars, Admin only)",
    )

    def clean(self):
        """모델 레벨 유효성 검증"""
        super().clean()
        errors = {}

        # 생년월일 검증 - 미래 날짜 불가, 너무 오래된 날짜 불가
        if self.date_of_birth:
            today = date.today()
            if self.date_of_birth > today:
                errors["date_of_birth"] = "생년월일은 미래 날짜일 수 없습니다."
            elif self.date_of_birth < date(1920, 1, 1):
                errors["date_of_birth"] = "유효하지 않은 생년월일입니다."

        # 비자 만료일 검증 - 과거 날짜면 경고
        if self.visa_expiry_date:
            if self.visa_expiry_date <= date.today():
                errors["visa_expiry_date"] = "비자가 만료되었거나 만료 예정입니다."

        # 근무 시작 가능일 검증
        if self.available_from_date:
            # 너무 과거 날짜는 불허
            if self.available_from_date < date.today():
                errors["available_from_date"] = (
                    "근무 시작 가능일은 오늘 이후 날짜여야 합니다."
                )

        if errors:
            raise ValidationError(errors)

    class Meta:
        verbose_name = "Teacher application"
        verbose_name_plural = "Teacher applications"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.email})"
