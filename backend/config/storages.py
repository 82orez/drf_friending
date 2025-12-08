from django.conf import settings
from storages.backends.s3boto3 import S3Boto3Storage


class PublicMediaStorage(S3Boto3Storage):
    """
    Lightsail Object Storage(S3 호환)에 media 파일을 저장하기 위한 Storage Backend
    """

    # 버킷 안에서 media/ 디렉터리 하위에 저장되도록
    location = "media"
    default_acl = "public-read"  # 업로드된 파일을 public read 로
    file_overwrite = False  # 같은 파일명일 때 덮어쓰지 않고 새로운 이름 부여
    querystring_auth = False  # public URL 이므로 서명 쿼리스트링 제거

    # https://<bucket>.s3.<region>.amazonaws.com 형식
    custom_domain = f"{settings.AWS_STORAGE_BUCKET_NAME}.s3.{settings.AWS_S3_REGION_NAME}.amazonaws.com"
