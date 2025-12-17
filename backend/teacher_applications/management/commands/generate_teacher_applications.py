import random
import time
import uuid
from datetime import date, timedelta
from decimal import Decimal

import requests
from faker import Faker
from PIL import Image, ImageDraw
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction

from teacher_applications.models import (
    TeacherApplication,
    GenderChoices,
    VisaTypeChoices,
    TeachingLanguageChoices,
    EmploymentTypeChoices,
    ApplicationStatusChoices,
)

import json
from functools import lru_cache
from pathlib import Path


def _rand_phone_kr() -> str:
    mid = random.randint(1000, 9999)
    last = random.randint(1000, 9999)
    return f"010-{mid}-{last}"


def _rand_date(start: date, end: date) -> date:
    days = (end - start).days
    return start + timedelta(days=random.randint(0, max(days, 0)))


@lru_cache(maxsize=1)
def _load_city_district_json() -> dict:
    """
    Load real KR administrative divisions from:
      frontend/src/lib/city_district.json

    We keep this cached so each management command run reads it once.
    """
    # This file is typically:
    # backend/teacher_applications/management/commands/generate_teacher_applications.py
    # -> project root is 4 levels up from here.
    here = Path(__file__).resolve()
    project_root = here.parents[4]

    json_path = project_root / "frontend" / "src" / "lib" / "city_district.json"
    if not json_path.exists():
        raise RuntimeError(
            f"city_district.json not found at expected path: {json_path}\n"
            f"Please ensure frontend/src/lib/city_district.json exists."
        )

    with json_path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _rand_korean_address():
    """
    ✅ 실제 대한민국 행정구역 기반으로 생성:
    - city: 시/도(광역단체)
    - district: 시/군/구 (또는 '특정시 일반구' 형태면 '용인시 기흥구'처럼 공백으로 결합)
      - 예: 서울 / 강남구
      - 예: 경기도 / 용인시 기흥구
      - 예: 경기도 / 양평군
      - 예: 세종 / 세종 (시/군/구가 없는 경우 프론트 로직과 동일하게 district=city)
    - address_line1: city/district 미포함
    """
    data = _load_city_district_json()
    sido_list = (data or {}).get("sido") or []
    if not sido_list:
        raise RuntimeError("city_district.json has no 'sido' entries.")

    sido = random.choice(sido_list)
    city = str(sido.get("name") or "").strip()

    # 시/도 하위(시/군/구)
    level1_list = sido.get("districts") or []

    if not level1_list:
        # e.g. 세종(특별자치시): 프론트에서 district를 city로 저장하는 정책과 맞춤
        district = city
    else:
        level1 = random.choice(level1_list)
        level1_name = str(level1.get("name") or "").strip()

        # 특정시 산하 일반구(있으면 3단계)
        level2_list = level1.get("districts") or []
        if level2_list:
            level2 = random.choice(level2_list)
            level2_name = str(level2.get("name") or "").strip()
            district = f"{level1_name} {level2_name}".strip()
        else:
            district = level1_name

    # address_line1 은 city/district 제외(도로명/상세만)
    roads = [
        "테헤란로",
        "강남대로",
        "올림픽로",
        "세종대로",
        "종로",
        "해운대로",
        "중앙대로",
        "광안로",
        "학동로",
    ]

    road = random.choice(roads)
    main_no = random.randint(1, 999)
    sub_no = random.randint(1, 99)
    road_no = f"{main_no}-{sub_no}"

    unit_no = random.randint(101, 2005)
    detail = f"{unit_no}호"

    address_line1 = f"{road} {road_no} {detail}"
    postal_code = f"{random.randint(10000, 99999)}"
    return city, district, address_line1, postal_code


def fetch_dicebear_png(
    seed: str, style: str, dicebear_version: str = "9.x", size: int = 256
) -> bytes:
    url = f"https://api.dicebear.com/{dicebear_version}/{style}/png"
    params = {"seed": seed, "size": size}
    r = requests.get(url, params=params, timeout=20)
    r.raise_for_status()
    return r.content


def make_dummy_visa_scan_png(text: str) -> bytes:
    w, h = 900, 600
    img = Image.new("RGB", (w, h), (245, 245, 245))
    draw = ImageDraw.Draw(img)

    draw.rectangle([40, 40, w - 40, h - 40], outline=(120, 120, 120), width=6)
    draw.text((70, 80), "VISA COPY (DUMMY)", fill=(20, 20, 20))
    draw.text((70, 140), text, fill=(20, 20, 20))
    draw.text((70, 200), "For development only.", fill=(80, 80, 80))

    import io

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    buf.seek(0)
    return buf.getvalue()


def _make_long_evaluation_result(fake_en: Faker, status: str) -> str:
    """
    evaluation_result를 좀 더 '다양하고 긴' 텍스트로 생성합니다.
    - NEW 상태면 빈 문자열 유지
    - 모델 제약(1000자 이내)에 맞춰 자동으로 길이를 제한
    """
    if status == ApplicationStatusChoices.NEW:
        return ""

    score = random.randint(62, 97)
    strengths = random.sample(
        [
            "Strong rapport-building and clear classroom communication.",
            "Well-structured lesson planning with measurable outcomes.",
            "Positive feedback culture; encourages student speaking time.",
            "Experience with mixed-level classes and adaptive pacing.",
            "Professional demeanor and reliable scheduling.",
            "Comfortable using digital tools (LMS, Zoom, shared docs).",
            "Good pronunciation modeling and error correction timing.",
            "Solid understanding of communicative activities and drills balance.",
        ],
        k=random.randint(3, 5),
    )
    concerns = random.sample(
        [
            "Provide more concrete evidence of student outcomes (scores, retention, etc.).",
            "Clarify visa timeline and availability window.",
            "Consider adding age-group specialization (kids/adults/test prep) with examples.",
            "Add references or supervisor contacts if available.",
            "Tighten the resume wording; remove repeated phrasing.",
            "Include a brief demo-lesson outline to show teaching flow.",
            "Explain any employment gaps succinctly.",
        ],
        k=random.randint(2, 4),
    )

    decision_note = {
        ApplicationStatusChoices.IN_REVIEW: "Recommended next step: schedule a 20–30 minute interview and request a short demo plan.",
        ApplicationStatusChoices.ACCEPTED: "Decision: Accept. Proceed with contract discussion, document verification, and onboarding steps.",
        ApplicationStatusChoices.REJECTED: "Decision: Reject at this time. Encourage re-application after strengthening portfolio and adding references.",
    }.get(status, "Recommended next step: additional screening.")

    # Faker로 문장을 늘려 '긴' 텍스트를 만듭니다(다만 1000자 이내로 컷)
    extra_context = (
        " ".join(fake_en.sentences(nb=random.randint(3, 6)))
        + "\n\n"
        + fake_en.paragraph(nb_sentences=random.randint(4, 7))
    )

    text = (
        f"[Internal Review Summary]\n"
        f"- Overall score: {score}/100\n"
        f"- Snapshot: Candidate appears {random.choice(['prepared', 'motivated', 'experienced', 'well-aligned'])} for the role and communicates clearly.\n\n"
        f"[Strengths]\n" + "\n".join(f"- {s}" for s in strengths) + "\n\n"
        f"[Concerns / Follow-ups]\n" + "\n".join(f"- {c}" for c in concerns) + "\n\n"
        f"[Notes]\n"
        f"- Preferred class types mentioned: {random.choice(['Conversation', 'Business English', 'Kids', 'Test Prep'])}\n"
        f"- Suggested interview focus: {random.choice(['classroom management', 'error correction strategy', 'lesson structure', 'student engagement techniques'])}\n"
        f"- {decision_note}\n\n"
        f"{extra_context}"
    )

    # 모델 max_length=1000 준수(너무 길면 안전하게 자르기)
    return text[:1000].rstrip()


class Command(BaseCommand):
    help = "Generate fake TeacherApplication records with DiceBear profile images."

    def add_arguments(self, parser):
        parser.add_argument(
            "--count", type=int, default=50, help="How many applications to create"
        )
        parser.add_argument(
            "--style",
            type=str,
            default="adventurer-neutral",
            help="DiceBear style name",
        )

        # ✅ --version 충돌 방지: 이름 변경
        parser.add_argument(
            "--dicebear-version",
            type=str,
            default="9.x",
            help="DiceBear API version (e.g., 9.x)",
        )

        parser.add_argument(
            "--sleep", type=float, default=0.15, help="Sleep between DiceBear requests"
        )

    @transaction.atomic
    def handle(self, *args, **options):
        count = options["count"]
        style = options["style"]
        dicebear_version = options["dicebear_version"]
        sleep_s = options["sleep"]

        fake_en = Faker("en_US")
        fake_kr = Faker("ko_KR")
        User = get_user_model()

        nationalities = [
            ("United States", "English"),
            ("Canada", "English"),
            ("United Kingdom", "English"),
            ("Australia", "English"),
            ("Japan", "Japanese"),
            ("China", "Chinese"),
            ("Spain", "Spanish"),
        ]

        teaching_lang_values = [c[0] for c in TeachingLanguageChoices.choices]
        visa_types = [c[0] for c in VisaTypeChoices.choices]
        genders = [c[0] for c in GenderChoices.choices]
        employ_types = [c[0] for c in EmploymentTypeChoices.choices]
        statuses = [c[0] for c in ApplicationStatusChoices.choices]

        created = 0
        today = date.today()

        self.stdout.write(
            self.style.SUCCESS(f"Creating {count} TeacherApplications...")
        )

        for i in range(count):
            email = f"teacher{i+1:03d}_{uuid.uuid4().hex[:6]}@example.com"
            password = "Test1234!"
            user = User.objects.create_user(email=email, password=password)

            first_name = fake_en.first_name()
            last_name = fake_en.last_name()
            korean_name = fake_kr.name() if random.random() < 0.35 else None
            gender = random.choice(genders)

            dob = _rand_date(date(1965, 1, 1), date(2003, 12, 31))

            nat, native_lang = random.choice(nationalities)
            teaching_lang = random.choice(teaching_lang_values)

            visa_type = random.choice(visa_types)
            visa_expiry = today + timedelta(days=random.randint(30, 900))

            available_from = today + timedelta(days=random.randint(0, 90))

            # 경험(년): 0.0 ~ 15.0 (소수 1자리 정확 보장)
            total_exp_tenths = random.randint(0, 150)  # 0.0 ~ 15.0 를 0.1 단위로
            total_exp = Decimal(total_exp_tenths) / Decimal("10")

            # 한국 경력(년): 0.0 ~ min(10.0, total_exp) (역시 0.1 단위)
            max_korea_tenths = int(
                min(Decimal("10.0"), total_exp) * 10
            )  # Decimal -> tenths
            korea_exp_tenths = random.randint(0, max_korea_tenths)
            korea_exp = Decimal(korea_exp_tenths) / Decimal("10")

            status = random.choices(statuses, weights=[10, 10, 70, 10], k=1)[0]

            city_ko, district_ko, address_line1_ko, postal_code_num = (
                _rand_korean_address()
            )

            seed = f"{first_name}-{last_name}-{user.pk}-{uuid.uuid4().hex[:8]}"
            try:
                avatar_bytes = fetch_dicebear_png(
                    seed=seed,
                    style=style,
                    dicebear_version=dicebear_version,
                    size=256,
                )
            except Exception:
                fallback = Image.new("RGB", (256, 256), (200, 200, 200))
                import io

                buf = io.BytesIO()
                fallback.save(buf, format="PNG", optimize=True)
                buf.seek(0)
                avatar_bytes = buf.getvalue()

            time.sleep(sleep_s)

            avatar_name = f"avatar_{uuid.uuid4().hex}.png"
            visa_name = f"visa_{uuid.uuid4().hex}.png"
            visa_bytes = make_dummy_visa_scan_png(
                text=f"{first_name} {last_name} / {email}"
            )

            app = TeacherApplication(
                user=user,
                first_name=first_name,
                last_name=last_name,
                korean_name=korean_name,
                gender=gender,
                date_of_birth=dob,
                nationality=nat,
                native_language=native_lang,
                email=email,
                phone_number=_rand_phone_kr(),
                address_line1=address_line1_ko,
                city=city_ko,
                district=district_ko,
                postal_code=postal_code_num,
                visa_type=visa_type,
                visa_expiry_date=visa_expiry,
                teaching_languages=teaching_lang,
                preferred_subjects=random.choice(
                    [
                        "Conversation",
                        "Business English",
                        "Kids",
                        "Test Prep (IELTS/TOEFL)",
                        "Pronunciation",
                    ]
                ),
                total_teaching_experience_years=total_exp,
                korea_teaching_experience_years=korea_exp,
                self_introduction=fake_en.paragraph(nb_sentences=5),
                education_history="\n".join(
                    [
                        f"{fake_en.company()} University - BA in {fake_en.job()} (2012-2016)",
                        f"{fake_en.company()} Graduate School - MA in Education (2017-2019)",
                    ]
                ),
                experience_history="\n".join(
                    [
                        f"2019-2021: Language institute teacher - {fake_en.city()}",
                        f"2022-2024: Private tutoring / corporate classes - Korea",
                    ]
                ),
                certifications=random.choice(["TESOL", "CELTA", "TEFL", ""]),
                teaching_style=random.choice(
                    [
                        "Communicative, student-centered lessons with lots of speaking practice.",
                        "Structured lessons with clear goals and frequent feedback.",
                        "",
                    ]
                ),
                additional_info=random.choice(
                    ["Available for demo class upon request.", ""]
                ),
                employment_type=random.choice(employ_types),
                preferred_locations=random.choice(["서울", "경기", "부산", "온라인만"]),
                available_time_slots=random.choice(
                    ["평일 저녁", "주말", "평일 오전", "유동적"]
                ),
                available_from_date=available_from,
                consent_personal_data=True,
                consent_data_retention=True,
                consent_third_party_sharing=random.random() < 0.7,
                confirmation_info_true=True,
                status=status,
                memo="(DEV) Auto-generated dummy data",
                evaluation_result=_make_long_evaluation_result(
                    fake_en=fake_en, status=status
                ),
            )

            app.profile_image.save(avatar_name, ContentFile(avatar_bytes), save=False)
            app.visa_scan.save(visa_name, ContentFile(visa_bytes), save=False)

            app.full_clean()
            app.save()

            created += 1

        self.stdout.write(self.style.SUCCESS(f"Done. Created: {created}"))
        self.stdout.write(self.style.WARNING("Users password: Test1234! (dev only)"))


# python manage.py generate_teacher_applications --count 50 --style avataaars
