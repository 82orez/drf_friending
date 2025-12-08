from pathlib import Path
import environ

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Environment variables
env = environ.Env(DEBUG=(bool, False))
environ.Env.read_env(BASE_DIR / ".env")

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = env("SECRET_KEY", default="django-insecure-change-me")

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = env("DEBUG", default=False)

ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["*"])

# Frontend URL for accounts/views.py - register
FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:3000")


# Application definition

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "accounts",
    "storages",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # Add this line
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


# Database
# https://docs.djangoproject.com/en/5.2/ref/settings/#databases

if DEBUG:
    # 개발 환경: SQLite 사용
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    # 배포 환경: PostgreSQL 사용
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": env("POSTGRES_DB", default="friending"),  # DB 이름
            "USER": env("POSTGRES_USER", default="friending_user"),  # DB 사용자
            "PASSWORD": env("POSTGRES_PASSWORD", default=""),  # DB 비밀번호
            "HOST": env(
                "POSTGRES_HOST", default="db"
            ),  # docker-compose 쓰면 서비스 이름 등
            "PORT": env("POSTGRES_PORT", default="5432"),
        }
    }


# Password validation
# https://docs.djangoproject.com/en/5.2/ref/settings/#auth-password-validators

if DEBUG:
    AUTH_PASSWORD_VALIDATORS = []
else:
    AUTH_PASSWORD_VALIDATORS = [
        # {
        #     "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
        # },
        # {
        #     "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        # },
        # {
        #     "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
        # },
        # {
        #     "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
        # },
    ]

# Custom User Model
AUTH_USER_MODEL = "accounts.User"

# Internationalization
# https://docs.djangoproject.com/en/5.2/topics/i18n/

LANGUAGE_CODE = "en-us"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.2/howto/static-files/

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"  # collectstatic 결과물

# Add this line for Whitenoise
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"


# Media Files
# AWS / Lightsail Object Storage
AWS_ACCESS_KEY_ID = env("AWS_ACCESS_KEY_ID", default=None)
AWS_SECRET_ACCESS_KEY = env("AWS_SECRET_ACCESS_KEY", default=None)
AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME", default=None)
AWS_S3_REGION_NAME = env(
    "AWS_S3_REGION_NAME", default="ap-northeast-2"
)  # 서울이면 이 값
AWS_S3_SIGNATURE_VERSION = "s3v4"
AWS_S3_ADDRESSING_STYLE = "virtual"  # <bucket>.s3.<region>.amazonaws.com

# 개발(로컬)에서는 media 폴더, 배포에서는 Lightsail 버킷을 쓰게 만듭니다.
if DEBUG:
    # 개발 환경: 로컬 media 폴더 사용
    MEDIA_URL = "/media/"
    MEDIA_ROOT = BASE_DIR / "media"

    STORAGES = {
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
        },
        "staticfiles": {
            # 이미 사용 중인 staticfiles backend 가 있다면 그대로 유지
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
        },
    }

else:
    # 프로덕션: Lightsail Object Storage(S3 호환 버킷)를 media 저장소로 사용
    MEDIA_URL = f"https://{AWS_STORAGE_BUCKET_NAME}.s3.{AWS_S3_REGION_NAME}.amazonaws.com/media/"

    STORAGES = {
        "default": {
            # config 는 settings.py 가 들어있는 django 프로젝트 패키지 이름
            "BACKEND": "config.storages.PublicMediaStorage",
        },
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
        },
    }


# Default primary key field type
# https://docs.djangoproject.com/en/5.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# DRF Settings
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}


# CORS Settings
CORS_ALLOWED_ORIGINS = [
    "https://friending.ac",
    "https://www.friending.ac",
]

# 개발 환경에서만 localhost 추가
if DEBUG:
    CORS_ALLOWED_ORIGINS += [
        "http://127.0.0.1:3000",
        "http://localhost:3000",
    ]

CORS_ALLOW_CREDENTIALS = True

# CSRF 설정
CSRF_TRUSTED_ORIGINS = [
    "https://friending.ac",
    "https://www.friending.ac",
]

if DEBUG:
    CSRF_TRUSTED_ORIGINS += [
        "http://127.0.0.1:3000",
        "http://localhost:3000",
    ]


# 이메일 설정 (개발 환경에서는 콘솔로 출력)
if DEBUG:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
    DEFAULT_FROM_EMAIL = "noreply@dj-issue-vote.com"

else:
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    DEFAULT_FROM_EMAIL = "Django Allauth <noreply@friending.ac>"
    EMAIL_HOST = "smtp.resend.com"
    EMAIL_USE_TLS = True
    EMAIL_PORT = 587
    EMAIL_HOST_USER = "resend"
    EMAIL_HOST_PASSWORD = env("RESEND_API_KEY", default="")


# Email Verification Token Settings
EMAIL_VERIFICATION_TOKEN_EXPIRES_HOURS = env(
    "EMAIL_VERIFICATION_TOKEN_EXPIRES_HOURS", default=24, cast=int
)

# Session Settings
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"

# SESSION_COOKIE_SECURE 값이 True 일 때는 https 환경에서만 session cookie 발행.
# DEBUG=True, 즉 개발환경에서는 http/https 환경 구분하지 않고 항상 session cookie 발행.
# DEBUG=False, 즉 배포환경에서는 https 환경에서만 session cookie 발행.
SESSION_COOKIE_SECURE = True if not DEBUG else False

CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SECURE = True if not DEBUG else False  # HTTPS에서 필요
CSRF_COOKIE_HTTPONLY = True  # 추가 보안
SESSION_COOKIE_AGE = 60 * 60 * 24  # 1일 (60초 * 60분 * 24시간)


# LOGGING 설정
# LOG_LEVEL = "DEBUG" if DEBUG else "INFO"
LOG_LEVEL = "INFO"

# Admins for error email notifications
ADMINS = [
    ("Admin", env("ADMIN_EMAIL", default="admin@example.com")),
]

# 로그 파일을 저장할 디렉토리 (Docker에서는 /app/logs)
LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    # 1) 로그 포맷
    "formatters": {
        "simple": {
            "format": "[{levelname}] {message}",
            "style": "{",
        },
        "verbose": {
            "format": "[{asctime}] [{levelname}] {name}:{lineno} - {message}",
            "style": "{",
        },
    },
    # 2) 핸들러: 로그를 어디로 보낼지
    "handlers": {
        # Docker 환경에서는 콘솔 로그가 매우 중요 (docker logs 로 확인)
        "console": {
            "class": "logging.StreamHandler",
            "level": LOG_LEVEL,
            "formatter": "simple",
        },
        # 배포 환경에서 파일에 쌓기 (로그 로테이션까지)
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "level": "INFO",
            "formatter": "verbose",
            "filename": str(LOG_DIR / "django.log"),
            "maxBytes": 1024 * 1024 * 5,  # 5MB 넘으면 새 파일
            "backupCount": 5,  # 최대 5개까지 백업
        },
        # 심각한 에러를 관리자에게 이메일 (DEBUG=False일 때만 의미 있음)
        "mail_admins": {
            "class": "django.utils.log.AdminEmailHandler",
            "level": "ERROR",
        },
    },
    # 3) 로거: 누가 어떤 핸들러를 쓸지
    "loggers": {
        # Django 전체
        "django": {
            "handlers": ["console", "file"] if not DEBUG else ["console"],
            "level": LOG_LEVEL,
            "propagate": True,
        },
        # 요청/응답 관련 에러 (500, 404 등)
        "django.request": {
            "handlers": ["file", "mail_admins"] if not DEBUG else ["console"],
            "level": "ERROR",
            "propagate": False,
        },
        # DB 쿼리 로그 (개발할 때 SQL 보고 싶을 때 유용)
        "django.db.backends": {
            "handlers": ["console"],
            "level": "DEBUG" if DEBUG else "WARNING",
            "propagate": False,
        },
        # 내가 만든 앱용 (예: accounts, todo 등)
        # __name__ 기준으로 logger 이름이 'accounts.views', 'accounts.models' 이런 식으로 잡힘
        "accounts": {
            "handlers": ["console", "file"] if not DEBUG else ["console"],
            "level": "DEBUG" if DEBUG else "INFO",
            "propagate": False,
        },
    },
}
