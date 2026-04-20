# drf_friending — CLAUDE.md

## 프로젝트 개요

한국 문화센터와 외국어 강사를 매칭하는 B2B2C 플랫폼.  
매니저가 강사 파견을 요청하면, 관리자가 공고를 게시하여 반경 내 강사들에게 자동으로 알림이 발송되고, 강사가 지원하여 강좌가 확정되는 워크플로우를 지원한다.

- **도메인**: friending.ac
- **구조**: 백엔드(Django DRF) + 프런트엔드(Next.js) 분리
- **루트 디렉터리**: `backend/`, `frontend/`, `docker-compose.yml`

---

## 기술 스택

### Backend (`backend/`)
- **Framework**: Django 5.2.9 + Django REST Framework 3.16.1
- **Python**: 3.14
- **DB**: SQLite (개발) / PostgreSQL (운영)
- **Storage**: 로컬 `media/` (개발) / AWS S3 Lightsail (운영)
- **인증**: 세션 기반 (`SessionAuthentication`)
- **이메일**: Console 백엔드 (개발) / Resend API SMTP (운영)
- **주요 라이브러리**: Pillow, django-import-export, django-cors-headers, django-storages, WhiteNoise, Gunicorn, python-environ

### Frontend (`frontend/`)
- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript 5
- **스타일**: Tailwind CSS v4
- **HTTP**: Axios
- **UI**: react-hot-toast, lucide-react, react-icons
- **PDF 생성**: jsPDF + html2canvas-pro

---

## 디렉터리 구조

```
drf_friending/
├── backend/
│   ├── config/                 # settings.py, urls.py
│   ├── accounts/               # 사용자 인증/권한 (커스텀 User 모델)
│   ├── teacher_applications/   # 강사 지원서 관리
│   ├── culture_centers/        # 문화센터 지점 관리
│   ├── dispatch_requests/      # 강사 파견 요청 = 공개 모집 공고 (통합)
│   ├── course_posts/           # CourseApplication (강사 지원) 만 보유
│   ├── courses/                # 확정 강좌 운영
│   ├── media/                  # 업로드 파일 (개발)
│   ├── logs/                   # 애플리케이션 로그
│   ├── requirements.txt
│   └── manage.py
└── frontend/
    └── src/
        ├── app/                # Next.js 라우트 (App Router)
        ├── components/         # 재사용 컴포넌트
        ├── contexts/           # React Context (전역 상태)
        └── lib/                # 유틸리티 / Axios 클라이언트 설정
```

---

## 사용자 역할 (`accounts.User.role`)

| Role | 설명 | 주요 권한 |
|------|------|-----------|
| `TEACHER` | 외국어 강사 | 강좌 공고 조회/지원, 본인 지원서 관리 |
| `MANAGER` | 문화센터 담당자 | 파견 요청(DispatchRequest) 생성 |
| `ADMIN` | 시스템 관리자 | 전체 리소스 열람/편집, Django admin |

커스텀 권한 클래스: `IsAdminOrManager`, `IsTeacher` (각 앱의 `permissions.py`)

---

## Django 앱 개요

### `accounts`
- 이메일 기반 커스텀 User (`AbstractBaseUser`)
- `AUTH_USER_MODEL = "accounts.User"`
- `EmailVerificationToken` (24시간), `PasswordResetToken` (1시간)

### `teacher_applications`
- `TeacherApplication` — User와 1:1
- 개인정보, 비자 정보(visa_type, visa_scan), 강의 프로필, 이력서, 근무 희망 조건
- 위치 좌표(lat/lng), 가용 시간 슬롯(JSONField)
- 상태: `NEW → IN_REVIEW → ACCEPTED / REJECTED`

### `culture_centers`
- `Region`, `Center`, `CultureCenter` (지점)
- 지점마다 lat/lng 저장 (지오로케이션용)
- django-import-export로 Excel 일괄 업로드 지원

### `dispatch_requests`
- `DispatchRequest` — 매니저가 파견 요청을 생성하고, 관리자가 이를 직접 공개 모집 공고로 게시(기존 CoursePost 기능 흡수)
- 수업 요일(JSONField), 강좌 수 기반 종료일 자동 계산
- 강사 안내 메모(`notes_for_teachers`), 지원 마감일(`application_deadline`), 게시/마감 타임스탬프(`published_at`, `closed_at`) 보유
- `open()` 호출 시 반경 15km 내 조건 일치(ACCEPTED + 언어) 강사 전원에게 딥링크 포함 이메일 자동 발송 (`transaction.on_commit`)
- 상태: `REQUESTED → OPEN → CLOSED / CANCELLED`

### `course_posts`
- `CoursePost` 모델은 폐기됨(2026-04-20). `DispatchRequest`로 병합.
- `CourseApplication` — 강사 지원 (`dispatch_request` FK). 상태: `APPLIED → SHORTLISTED → SELECTED / WITHDRAWN / REJECTED`
- `UniqueConstraint(dispatch_request, teacher)` — 1 강사당 1 지원
- 앱 자체는 유지하되 Model/Admin/Serializer만 남기고 View/URL는 비움

### `courses`
- `Course` — DispatchRequest와 1:1(`source_dispatch_request`), 확정된 강좌
- DispatchRequest 데이터를 복제 저장 → 원본 변경과 독립적으로 운영 안정성 보장
- 생성 시 선정자에 축하 이메일, 탈락 지원자 전원(APPLIED/SHORTLISTED)에 결과 이메일 자동 발송
- 상태: `CONFIRMED → ONGOING → ENDED / CANCELLED`

---

## 주요 워크플로우

### 강사 등록
```
회원가입 → 이메일 인증 → TeacherApplication 작성 → 관리자 검토(IN_REVIEW) → ACCEPTED/REJECTED
```

### 강좌 개설 및 매칭 (관리자 2클릭 플로우)
```
매니저: DispatchRequest 생성 (REQUESTED)
  → 관리자 접수 이메일 자동 발송

관리자: /admin-pages/dispatch-requests/[id] 에서 메모·마감일 입력 후
  → [공고 게시 & 강사 알림] ─── ★1클릭
        • status=OPEN, published_at=now
        • 반경 15km + 언어 일치 + ACCEPTED 강사 전원에 딥링크 이메일 자동 발송
        • 딥링크: {FRONTEND_URL}/teacher/posts/{id}

강사: /teacher/posts 또는 이메일 딥링크에서 [지원]
  → CourseApplication 생성 (APPLIED)

관리자: 지원자 표에서 [선정] → [강사 확정] ─── ★1클릭
  → confirm-from-dispatch API 호출
  → Course 생성 (CONFIRMED), DispatchRequest → CLOSED
  → 선정자 축하 메일 + 탈락자 결과 메일 자동 발송

Course: CONFIRMED → ONGOING → ENDED
```

---

## 핵심 패턴 및 규칙

- **상태 머신**: 모든 주요 모델에 `status` 필드 + `clean()` 유효성 검증. 역방향 전환 불가.
- **이미지 처리**: 2MB 제한, 256×256 썸네일 자동 생성(Pillow), EXIF 회전 보정, 교체 시 구 파일 자동 삭제(`post_delete`, `pre_save` 시그널).
- **날짜 계산**: `calculate_end_date()` 유틸 — start_date + class_days + lecture_count로 종료일 산출.
- **이메일**: `fail_silently=True`로 API 흐름 방해 없이 발송. 공고 게시/강좌 확정은 `transaction.on_commit`으로 커밋 후 발송.
- **반경 필터**: `teacher_applications/geo.py :: teachers_within_radius()` (Haversine) — 공고 게시 시 15km 자동 매칭.
- **CSRF**: 프런트엔드에서 `/api/auth/csrf-token` 먼저 호출 후 세션 쿠키 사용.
- **관리자 커스텀**: 주간 시간표 위젯(30분 단위). (기존 Django admin의 수동 이메일 일괄 발송 뷰는 자동 발송으로 대체되어 제거됨.)

---

## API 구조 요약

| 경로 | 앱 |
|------|-----|
| `/api/auth/` | accounts |
| `/api/teacher-applications/` | teacher_applications |
| `/api/culture-centers/` | culture_centers |
| `/api/dispatch-requests/` | dispatch_requests (공고/지원 통합) |
| `/api/courses/` | courses |

관리자 전용 엔드포인트는 `/admin/list/`, `/admin/<id>/` 패턴 사용.

### 주요 DispatchRequest 엔드포인트
| Method | 경로 | 용도 |
|--------|------|------|
| GET | `/api/dispatch-requests/open/` | 강사용: 현재 게시 중(OPEN)인 공고 목록 |
| GET | `/api/dispatch-requests/<id>/` | 공고 상세 |
| POST | `/api/dispatch-requests/<id>/apply/` | 강사 지원 |
| POST | `/api/dispatch-requests/<id>/withdraw/` | 지원 철회 |
| POST | `/api/dispatch-requests/admin/<id>/open/` | 공고 게시 + 반경 강사 자동 알림 |
| POST | `/api/dispatch-requests/admin/<id>/close/` | 공고 마감 |
| GET  | `/api/dispatch-requests/admin/<id>/applications/` | 지원자 목록 |
| PATCH | `/api/dispatch-requests/admin/<id>/set-application-status/` | 지원자 상태 변경 |
| POST | `/api/courses/admin/confirm-from-dispatch/<dispatch_id>/` | 강좌 확정 생성 |

---

## 개발 명령어

```bash
# 백엔드 (backend/ 디렉터리에서)
python manage.py runserver           # 개발 서버 (포트 8000)
python manage.py migrate             # DB 마이그레이션
python manage.py createsuperuser     # 슈퍼유저 생성
python manage.py collectstatic       # 정적 파일 수집

# 프런트엔드 (frontend/ 디렉터리에서)
npm run dev      # 개발 서버 (포트 3000)
npm run build    # 프로덕션 빌드
npm start        # 프로덕션 서버 실행
```

---

## 환경 변수 (`.env` 필수 항목)

```
SECRET_KEY=
DEBUG=True
ALLOWED_HOSTS=
FRONTEND_URL=http://localhost:3000
EMAIL_VERIFICATION_TOKEN_EXPIRES_HOURS=24

# 운영 DB (DEBUG=False 시 사용)
POSTGRES_DB=
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_HOST=
POSTGRES_PORT=5432

# AWS S3 (운영)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_STORAGE_BUCKET_NAME=
AWS_S3_REGION_NAME=

# 이메일 (운영)
RESEND_API_KEY=
ADMIN_EMAIL=
```
