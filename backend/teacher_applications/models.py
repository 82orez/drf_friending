from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator, URLValidator
from django.db import models
from datetime import date

from django.core.files.base import ContentFile
from PIL import Image, ImageOps
import io
import os
from urllib.parse import urlparse

from django.db.models.signals import post_delete, pre_save
from django.dispatch import receiver


# === 공통 유효성 검사기 ===
def validate_image_size_under_2mb(value):
    max_size = 2 * 1024 * 1024  # 2MB
    if value.size > max_size:
        raise ValidationError(
            "이미지 파일 크기는 2MB 이하여야 합니다. (Max size is 2MB)"
        )


def validate_youtube_url(value: str):
    """
    Allow only YouTube URLs:
    - https://youtu.be/...
    - https://www.youtube.com/watch?v=...
    - https://youtube.com/...
    """
    if not value:
        return

    try:
        parsed = urlparse(value)
        host = (parsed.netloc or "").lower()

        allowed_hosts = {
            "youtu.be",
            "www.youtu.be",
            "youtube.com",
            "www.youtube.com",
            "m.youtube.com",
        }

        if host not in allowed_hosts:
            raise ValidationError(
                "유효한 유튜브 링크만 입력해 주세요. (Only YouTube links are allowed.)"
            )
    except ValidationError:
        raise
    except Exception:
        raise ValidationError("유효한 URL 형식이 아닙니다. (Invalid URL format.)")


# === 선택지(Choices) 정의 ===
class GenderChoices(models.TextChoices):
    MALE = "MALE", "Male / 남성"
    FEMALE = "FEMALE", "Female / 여성"
    OTHER = "OTHER", "Other / 기타"
    PREFER_NOT = "PREFER_NOT", "Prefer not to say / 선택하지 않음"


class NationalityChoices(models.TextChoices):
    USA = "USA", "United States / 미국"
    UK = "UK", "United Kingdom / 영국"
    CANADA = "CANADA", "Canada / 캐나다"
    IRELAND = "IRELAND", "Ireland / 아일랜드"
    AUSTRALIA = "AUSTRALIA", "Australia / 호주"
    NEW_ZEALAND = "NEW_ZEALAND", "New Zealand / 뉴질랜드"
    SOUTH_AFRICA = "SOUTH_AFRICA", "South Africa / 남아프리카공화국"
    PHILIPPINES = "PHILIPPINES", "Philippines / 필리핀"
    SOUTH_KOREA = "SOUTH_KOREA", "South Korea / 대한민국"
    JAPAN = "JAPAN", "Japan / 일본"
    CHINA = "CHINA", "China / 중국"
    OTHER = "OTHER", "Other / 기타"


class NativeLanguageChoices(models.TextChoices):
    ENGLISH = "ENGLISH", "English / 영어"
    KOREAN = "KOREAN", "Korean / 한국어"
    JAPANESE = "JAPANESE", "Japanese / 일본어"
    CHINESE = "CHINESE", "Chinese / 중국어"
    SPANISH = "SPANISH", "Spanish / 스페인어"
    OTHER = "OTHER", "Other / 기타"


class VisaTypeChoices(models.TextChoices):
    F2 = "F-2", "F-2"
    F4 = "F-4", "F-4"
    F5 = "F-5", "F-5"
    F6 = "F-6", "F-6"
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

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=False,
        blank=False,
        related_name="teacher_application",
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

    profile_image_thumbnail = models.ImageField(
        upload_to="teacher_applications/profile_images/thumbnails/",
        blank=True,
        null=True,
        editable=False,
        verbose_name="Profile image thumbnail / 프로필 썸네일",
    )

    profile_image_width = models.PositiveIntegerField(
        blank=True,
        null=True,
        editable=False,
        verbose_name="Profile image width",
    )
    profile_image_height = models.PositiveIntegerField(
        blank=True,
        null=True,
        editable=False,
        verbose_name="Profile image height",
    )
    profile_image_format = models.CharField(
        max_length=10,
        blank=True,
        editable=False,
        verbose_name="Profile image format",
    )
    profile_image_filesize = models.PositiveIntegerField(
        blank=True,
        null=True,
        editable=False,
        verbose_name="Profile image file size (bytes)",
    )

    first_name = models.CharField(
        max_length=50,
        verbose_name="First name / 이름",
    )
    last_name = models.CharField(
        max_length=50,
        verbose_name="Last name / 성",
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
        choices=NationalityChoices.choices,
        verbose_name="Nationality",
    )
    native_language = models.CharField(
        max_length=100,
        choices=NativeLanguageChoices.choices,
        verbose_name="Native language / 모국어",
    )

    email = models.EmailField(
        verbose_name="Email address",
    )
    phone_number = models.CharField(
        max_length=30,
        verbose_name="Phone number",
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

    # ✅ 변경: CharField -> JSONField
    available_time_slots = models.JSONField(
        blank=True,
        null=True,
        verbose_name="Available time slots / 근무 가능 시간대",
        help_text="Weekly timetable selection stored as JSON / 주간 타임테이블 선택값(JSON)으로 저장",
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
        blank=True,
        verbose_name="Evaluation Result / 평가 결과",
        help_text="전체적인 이력서 평가 결과 (1000자 이내, 관리자 전용) / Overall resume evaluation result (max 1000 chars, Admin only)",
    )

    # ✅ 유튜브 소개 영상 링크 (선택)
    introduction_youtube_url = models.URLField(
        blank=True,
        null=True,
        max_length=500,
        validators=[URLValidator(), validate_youtube_url],
        verbose_name="YouTube intro video link / 유튜브 소개 영상 링크 (선택)",
        help_text="e.g. https://youtu.be/kkkUVYjxN1U?si=... / 예: 유튜브 소개 영상 링크",
    )

    def _generate_profile_thumbnail_and_meta(self):
        """
        - 썸네일: 256x256 (비율 유지, 긴 변 기준 thumbnail)
        - 포맷: JPEG로 통일 (프론트에서 다루기 쉬움)
        """
        if not self.profile_image:
            return

        # 원본 파일명 기반으로 썸네일 파일명 생성
        base, _ext = os.path.splitext(os.path.basename(self.profile_image.name))
        thumb_name = f"{base}_thumb.jpg"

        # Pillow로 열기
        self.profile_image.open("rb")
        with Image.open(self.profile_image) as img:
            img = ImageOps.exif_transpose(img)  # 회전 EXIF 보정
            self.profile_image_format = (img.format or "").upper()

            # 메타 저장(원본 기준)
            self.profile_image_width, self.profile_image_height = img.size

            # 썸네일 생성
            img = img.convert("RGB")
            img.thumbnail((256, 256), Image.Resampling.LANCZOS)

            buffer = io.BytesIO()
            img.save(buffer, format="JPEG", quality=85, optimize=True)
            buffer.seek(0)

        # filesize 저장(원본)
        try:
            self.profile_image_filesize = self.profile_image.size
        except Exception:
            # 스토리지/환경에 따라 size 접근이 실패할 수 있어 방어적으로 처리
            self.profile_image_filesize = None

        # 기존 썸네일이 있으면 삭제(파일 교체 시 찌꺼기 방지)
        if self.profile_image_thumbnail and self.profile_image_thumbnail.name:
            try:
                self.profile_image_thumbnail.delete(save=False)
            except Exception:
                pass

        self.profile_image_thumbnail.save(
            thumb_name,
            ContentFile(buffer.getvalue()),
            save=False,
        )

    def save(self, *args, **kwargs):
        # profile_image 변경 여부 확인(기존 레코드가 있을 때만)
        old_profile_name = None
        if self.pk:
            try:
                old_profile_name = (
                    TeacherApplication.objects.filter(pk=self.pk)
                    .values_list("profile_image", flat=True)
                    .first()
                )
            except Exception:
                old_profile_name = None

        super().save(*args, **kwargs)

        # 새 업로드/변경 시에만 생성 (또는 썸네일이 없으면 생성)
        new_profile_name = self.profile_image.name if self.profile_image else None
        should_regenerate = new_profile_name and (
            old_profile_name != new_profile_name or not self.profile_image_thumbnail
        )

        if should_regenerate:
            self._generate_profile_thumbnail_and_meta()
            super().save(
                update_fields=[
                    "profile_image_thumbnail",
                    "profile_image_width",
                    "profile_image_height",
                    "profile_image_format",
                    "profile_image_filesize",
                ]
            )

        # ✅ profile_image가 새 파일로 교체된 경우: 기존 원본 파일도 스토리지에서 삭제
        # (주의) self.profile_image.delete()를 호출하면 "현재" 파일(새 파일)을 지울 수 있어
        #        old 파일명으로 스토리지에서 직접 삭제합니다.
        if old_profile_name and old_profile_name != new_profile_name:
            try:
                self.profile_image.storage.delete(old_profile_name)
            except Exception:
                pass

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


def _safe_delete_file_field(file_field) -> None:
    """
    FileField/ImageField가 가리키는 스토리지 파일을 안전하게 삭제.
    - save=False 로 DB 재저장 방지
    - storage.delete(name)로 실제 파일 제거
    """
    if not file_field:
        return
    name = getattr(file_field, "name", None)
    if not name:
        return
    storage = getattr(file_field, "storage", None)
    try:
        if storage:
            storage.delete(name)
        else:
            file_field.delete(save=False)
    except Exception:
        # 정책에 따라 로깅만 하고 무시(원하시면 로깅 추가 가능)
        pass


@receiver(post_delete, sender=TeacherApplication)
def teacher_application_delete_files(sender, instance: TeacherApplication, **kwargs):
    """
    TeacherApplication 레코드가 삭제될 때 연결된 파일도 스토리지에서 함께 삭제.
    (Admin 삭제 / queryset.delete / cascade 등 모든 삭제 경로에 적용)
    """
    _safe_delete_file_field(instance.profile_image_thumbnail)
    _safe_delete_file_field(instance.profile_image)
    _safe_delete_file_field(instance.visa_scan)


@receiver(pre_save, sender=TeacherApplication)
def teacher_application_delete_replaced_files(
    sender, instance: TeacherApplication, **kwargs
):
    """
    수정 시 파일이 '교체'되는 경우, 예전 파일이 스토리지에 남지 않도록 삭제.
    - profile_image는 기존 save()에서 old_profile_name 삭제 로직이 있으니
      여기서는 visa_scan 교체 케이스만 보완(필요 시 확장 가능).
    """
    if not instance.pk:
        return

    try:
        old = TeacherApplication.objects.get(pk=instance.pk)
    except TeacherApplication.DoesNotExist:
        return

    old_visa = getattr(old.visa_scan, "name", None)
    new_visa = getattr(instance.visa_scan, "name", None)
    if old_visa and old_visa != new_visa:
        try:
            old.visa_scan.storage.delete(old_visa)
        except Exception:
            pass
