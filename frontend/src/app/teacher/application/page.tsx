"use client";

import { FormEvent, useState, ChangeEvent, useEffect } from "react";
import { teacherApplicationAPI } from "@/lib/api";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import RegionSelectKR from "@/components/RegionSelectKR";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type Gender = "" | "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT";
type VisaType = "" | "F-2" | "F-4" | "F-5" | "F-6" | "OTHER";
type EmploymentType = "" | "FULL_TIME" | "PART_TIME" | "FREELANCE" | "ANY";

// ✅ native_language를 select로 운영할 값(백엔드는 CharField라 자유지만, 프론트에서 표준화)
type NativeLanguage = "" | "ENGLISH" | "KOREAN" | "JAPANESE" | "CHINESE" | "SPANISH" | "OTHER";

interface TeacherApplicationForm {
  // Personal info
  first_name: string;
  last_name: string;
  korean_name: string;
  gender: Gender;
  date_of_birth: string;
  nationality: string;
  native_language: NativeLanguage;
  email: string;
  phone_number: string;
  address_line1: string;
  city: string;
  district: string;
  postal_code: string;

  // Visa
  visa_type: VisaType;
  visa_expiry_date: string;

  // Teaching profile
  teaching_languages: string;
  preferred_subjects: string;
  total_teaching_experience_years: string;
  korea_teaching_experience_years: string;

  // Resume details
  self_introduction: string;
  education_history: string;
  experience_history: string;
  certifications: string;
  teaching_style: string;
  additional_info: string;

  // Working conditions
  employment_type: EmploymentType;
  preferred_locations: string;
  available_time_slots: string;
  available_from_date: string;

  // Consents
  consentPersonalData: boolean;
  consentDataRetention: boolean;
  consentThirdParty: boolean;
  confirmationInfoTrue: boolean;
}

type ErrorMap = Record<string, string>;
type DecimalFieldName = "total_teaching_experience_years" | "korea_teaching_experience_years";

// ✅ UX 정책: "."만 입력된 경우 처리 방식
// - "empty": 빈 값("")으로 처리 (기본)
// - "zero": "0"으로 처리
const DOT_ONLY_POLICY: "empty" | "zero" = "empty";

// ✅ Nationality / Native language options (select)
const NATIONALITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "AUSTRALIA", label: "Australia / 호주" },
  { value: "CANADA", label: "Canada / 캐나다" },
  { value: "CHINA", label: "China / 중국" },
  { value: "IRELAND", label: "Ireland / 아일랜드" },
  { value: "JAPAN", label: "Japan / 일본" },
  { value: "NEW_ZEALAND", label: "New Zealand / 뉴질랜드" },
  { value: "PHILIPPINES", label: "Philippines / 필리핀" },
  { value: "SOUTH_AFRICA", label: "South Africa / 남아프리카공화국" },
  { value: "SOUTH_KOREA", label: "South Korea / 대한민국" },
  { value: "UK", label: "United Kingdom / 영국" },
  { value: "USA", label: "United States / 미국" },
  { value: "OTHER", label: "Other / 기타" },
];

const NATIVE_LANGUAGE_OPTIONS: Array<{ value: NativeLanguage; label: string }> = [
  { value: "ENGLISH", label: "English / 영어" },
  { value: "KOREAN", label: "Korean / 한국어" },
  { value: "JAPANESE", label: "Japanese / 일본어" },
  { value: "CHINESE", label: "Chinese / 중국어" },
  { value: "SPANISH", label: "Spanish / 스페인어" },
  { value: "OTHER", label: "Other / 기타" },
];

export default function TeacherApplicationPage() {
  const router = useRouter();
  const { user } = useAuth();

  // 사용자 이메일로 자동 설정
  useEffect(() => {
    if (user?.email) {
      setForm((prevForm) => ({
        ...prevForm,
        email: user.email,
      }));
    }
  }, [user]);

  const [form, setForm] = useState<TeacherApplicationForm>({
    first_name: "",
    last_name: "",
    korean_name: "",
    gender: "",
    date_of_birth: "",
    nationality: "",
    native_language: "",
    email: "",
    phone_number: "",
    address_line1: "",
    city: "",
    district: "",
    postal_code: "",
    visa_type: "",
    visa_expiry_date: "",
    teaching_languages: "",
    preferred_subjects: "",
    total_teaching_experience_years: "",
    korea_teaching_experience_years: "",
    self_introduction: "",
    education_history: "",
    experience_history: "",
    certifications: "",
    teaching_style: "",
    additional_info: "",
    employment_type: "",
    preferred_locations: "",
    available_time_slots: "",
    available_from_date: "",
    consentPersonalData: false,
    consentDataRetention: false,
    consentThirdParty: false,
    confirmationInfoTrue: false,
  });

  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [visaScanFile, setVisaScanFile] = useState<File | null>(null);
  const [profilePreviewUrl, setProfilePreviewUrl] = useState<string | null>(null);
  const [visaPreviewUrl, setVisaPreviewUrl] = useState<string | null>(null);

  const [errors, setErrors] = useState<ErrorMap>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasExistingApplication, setHasExistingApplication] = useState(false);
  const [existingApplicationData, setExistingApplicationData] = useState<any>(null);

  // ✅ status가 NEW일 때만 "수정" 가능하게 제한
  const applicationStatus: string | null = existingApplicationData?.status ?? null;
  const canEditOrSubmit = !hasExistingApplication || applicationStatus === "NEW"; // 새 제출은 허용, 기존은 NEW일 때만 허용
  const isEditLocked = hasExistingApplication && applicationStatus !== "NEW";

  // 기존 이력서 확인
  useEffect(() => {
    checkExistingApplication();
  }, []);

  const checkExistingApplication = async () => {
    setIsLoading(true);
    try {
      const response = await teacherApplicationAPI.checkExisting();
      if (response.data.exists && response.data.data) {
        setHasExistingApplication(true);
        setExistingApplicationData(response.data.data);
        // 기존 데이터로 폼 채우기
        populateFormWithExistingData(response.data.data);
      } else {
        setHasExistingApplication(false);
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        const msg = "로그인이 필요합니다. Please log in first.";
        setSubmitError(msg);
        toast.error(msg);
      } else {
        console.error("기존 이력서 확인 중 오류:", error);
        toast.error("기존 이력서를 불러오는 중 오류가 발생했습니다. 다시 시도해 주세요.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const populateFormWithExistingData = (data: any) => {
    setForm({
      first_name: data.first_name || "",
      last_name: data.last_name || "",
      korean_name: data.korean_name || "",
      gender: data.gender || "",
      date_of_birth: data.date_of_birth || "",
      nationality: data.nationality || "",
      native_language: (data.native_language as NativeLanguage) || "",
      email: user?.email || data.email || "", // 로그인한 사용자의 이메일 우선 사용
      phone_number: data.phone_number || "",
      address_line1: data.address_line1 || "",
      city: data.city || "",
      district: data.district || "",
      postal_code: data.postal_code || "",
      visa_type: data.visa_type || "",
      visa_expiry_date: data.visa_expiry_date || "",
      teaching_languages: data.teaching_languages || "",
      preferred_subjects: data.preferred_subjects || "",
      total_teaching_experience_years: data.total_teaching_experience_years?.toString() || "",
      korea_teaching_experience_years: data.korea_teaching_experience_years?.toString() || "",
      self_introduction: data.self_introduction || "",
      education_history: data.education_history || "",
      experience_history: data.experience_history || "",
      certifications: data.certifications || "",
      teaching_style: data.teaching_style || "",
      additional_info: data.additional_info || "",
      employment_type: data.employment_type || "",
      preferred_locations: data.preferred_locations || "",
      available_time_slots: data.available_time_slots || "",
      available_from_date: data.available_from_date || "",
      consentPersonalData: data.consent_personal_data || false,
      consentDataRetention: data.consent_data_retention || false,
      consentThirdParty: data.consent_third_party_sharing || false,
      confirmationInfoTrue: data.confirmation_info_true || false,
    });

    // 기존 이미지 URL 설정
    if (data.profile_image) {
      const imageUrl = data.profile_image.startsWith("/media/") ? `${API_BASE_URL}${data.profile_image}` : data.profile_image;
      setProfilePreviewUrl(imageUrl);
    }
    if (data.visa_scan) {
      const visaUrl = data.visa_scan.startsWith("/media/") ? `${API_BASE_URL}${data.visa_scan}` : data.visa_scan;
      setVisaPreviewUrl(visaUrl);
    }
  };

  // revoke object URLs on unmount
  useEffect(() => {
    return () => {
      if (profilePreviewUrl && profilePreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(profilePreviewUrl);
      }
      if (visaPreviewUrl && visaPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(visaPreviewUrl);
      }
    };
  }, [profilePreviewUrl, visaPreviewUrl]);

  // ✅ 소수점 1자리까지만 허용 (정수 / 0.3 / .2 / 1.2 / 1. 모두 가능)
  const sanitizeDecimalOnePlace = (raw: string) => {
    let v = raw.replace(/[^0-9.]/g, ""); // 숫자와 '.'만 남김

    const firstDot = v.indexOf(".");
    if (firstDot !== -1) {
      const before = v.slice(0, firstDot);
      const after = v
        .slice(firstDot + 1)
        .replace(/\./g, "") // '.' 추가 입력 제거
        .slice(0, 1); // ✅ 소수 1자리
      v = `${before}.${after}`;
    }

    return v;
  };

  // ✅ blur 시 보정:
  // - "1." -> "1.0" (그리고 "0." -> "0.0")
  // - "."  -> 정책에 따라 "" 또는 "0"
  const normalizeDecimalOnBlur = (raw: string) => {
    const v = sanitizeDecimalOnePlace(raw);

    if (v === ".") {
      return DOT_ONLY_POLICY === "zero" ? "0" : "";
    }

    // "숫자+." 형태면 0을 붙여서 완성
    if (/^\d+\.$/.test(v)) {
      return `${v}0`;
    }

    return v;
  };

  // ✅ submit 직전 보정 (blur 안 하고 바로 제출해도 안전하게 처리)
  const normalizeDecimalBeforeSubmit = (raw: string) => {
    const v = sanitizeDecimalOnePlace(raw);

    if (v === ".") {
      return DOT_ONLY_POLICY === "zero" ? "0" : "";
    }
    if (/^\d+\.$/.test(v)) {
      return `${v}0`;
    }
    return v;
  };

  const handleDecimalBlur = (field: DecimalFieldName) => {
    setForm((prev) => {
      const nextValue = normalizeDecimalOnBlur(prev[field]);
      if (nextValue === prev[field]) return prev;
      return { ...prev, [field]: nextValue };
    });
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  // 전화번호 포맷터 (숫자만 -> 010-1234-5678 / 011-123-1234 등)
  const formatKoreanPhoneNumber = (value: string): string => {
    // 1) 숫자만 남기기
    const digits = value.replace(/\D/g, "");

    if (!digits) return "";

    // 2) 길이에 따라 형식 적용
    if (digits.length <= 3) {
      // 010
      return digits;
    }

    if (digits.length <= 7) {
      // 010-1234 (입력 중간 단계)
      return digits.replace(/(\d{3})(\d{1,4})/, "$1-$2");
    }

    if (digits.length === 10) {
      // 10자리: 011-123-1234, 010-123-1234
      return digits.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
    }

    // 11자리 이상은 앞의 11자리만 사용: 010-1234-5678
    const trimmed = digits.slice(0, 11);
    return trimmed.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
  };

  const keepKoreanDigitsSpacesHyphenOnly = (value: string) => {
    // 한글(자모/음절) + 숫자 + 공백 + 하이픈(-)만 허용
    // 주소/도시/구군에 필요한 최소 범위
    return value.replace(/[^ㄱ-ㅎㅏ-ㅣ가-힣0-9\s-]/g, "");
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement;
    const { name, value, type, checked } = target;

    // ✅ 전화번호는 별도 처리 (숫자만 입력해도 자동 포맷)
    if (name === "phone_number") {
      const formatted = formatKoreanPhoneNumber(value);
      setForm((prev) => ({
        ...prev,
        phone_number: formatted,
      }));
      setErrors((prev) => ({ ...prev, phone_number: "" }));
      return;
    }

    // ✅ 총 강의 경력 / 한국 강의 경력: 소수점 1자리 제한
    if (name === "total_teaching_experience_years" || name === "korea_teaching_experience_years") {
      const sanitized = sanitizeDecimalOnePlace(value);
      setForm((prev) => ({
        ...prev,
        [name]: sanitized,
      }));
      setErrors((prev) => ({ ...prev, [name]: "" }));
      return;
    }

    // ✅ 주소/도시/구·군: 한글+숫자+공백+하이픈만 허용
    if (name === "address_line1" || name === "city" || name === "district") {
      const sanitized = keepKoreanDigitsSpacesHyphenOnly(value);
      setForm((prev) => ({
        ...prev,
        [name]: sanitized,
      }));
      setErrors((prev) => ({ ...prev, [name]: "" }));
      return;
    }

    // 그 외 일반 필드 처리
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value /* checkbox는 boolean, 나머지는 string */,
    }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateFile = (file: File | null, fieldName: string): string | null => {
    if (!file && !hasExistingApplication) return "This file is required. / 파일은 필수입니다.";
    if (!file) return null; // 기존 이력서가 있고 새 파일이 없으면 OK

    const allowedTypes = ["image/jpeg", "image/png"];
    const maxSize = 2 * 1024 * 1024; // 2MB

    if (!allowedTypes.includes(file.type)) {
      return "Only JPEG and PNG images are allowed. / JPEG와 PNG 형식만 가능합니다.";
    }
    if (file.size > maxSize) {
      return "File size must be 2MB or less. / 파일 크기는 2MB 이하여야 합니다.";
    }
    return null;
  };

  const handleProfileImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    const error = validateFile(file, "profile_image");
    if (error) {
      setProfileImageFile(null);
      // 기존 이미지 유지
      if (existingApplicationData?.profile_image) {
        const imageUrl = existingApplicationData.profile_image.startsWith("/media/")
          ? `${API_BASE_URL}${existingApplicationData.profile_image}`
          : existingApplicationData.profile_image;
        setProfilePreviewUrl(imageUrl);
      } else {
        setProfilePreviewUrl(null);
      }
      setErrors((prev) => ({ ...prev, profile_image: error }));
      toast.error(error);
      return;
    }
    setProfileImageFile(file);
    if (file) {
      setProfilePreviewUrl(URL.createObjectURL(file));
    }
    setErrors((prev) => ({ ...prev, profile_image: "" }));
  };

  const handleVisaScanChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    const error = validateFile(file, "visa_scan");
    if (error) {
      setVisaScanFile(null);
      // 기존 이미지 유지
      if (existingApplicationData?.visa_scan) {
        const visaUrl = existingApplicationData.visa_scan.startsWith("/media/")
          ? `${API_BASE_URL}${existingApplicationData.visa_scan}`
          : existingApplicationData.visa_scan;
        setVisaPreviewUrl(visaUrl);
      } else {
        setVisaPreviewUrl(null);
      }
      setErrors((prev) => ({ ...prev, visa_scan: error }));
      toast.error(error);
      return;
    }
    setVisaScanFile(file);
    if (file) {
      setVisaPreviewUrl(URL.createObjectURL(file));
    }
    setErrors((prev) => ({ ...prev, visa_scan: "" }));
  };

  const validateForm = (): boolean => {
    const newErrors: ErrorMap = {};

    // 이미지 파일 검증 (기존 이력서가 없는 경우만)
    if (!hasExistingApplication) {
      if (!profileImageFile) {
        newErrors.profile_image = "Profile image is required. / 프로필 이미지는 필수입니다.";
      }
      if (!visaScanFile) {
        newErrors.visa_scan = "Visa copy is required. / 비자 사본은 필수입니다.";
      }
    }

    // 최소 필수 필드들
    if (!form.first_name.trim()) newErrors.first_name = "First name is required. / 이름(First Name)은 필수입니다.";
    if (!form.last_name.trim()) newErrors.last_name = "Last name is required. / 성(Last Name)은 필수입니다.";
    if (!form.gender.trim()) newErrors.gender = "Gender is required. / 성별(Gender)은 필수입니다.";
    if (!form.date_of_birth.trim()) newErrors.date_of_birth = "Date of Birth is required. / 생년월일(Gender)은 필수입니다.";
    if (!form.nationality.trim()) newErrors.nationality = "Nationality is required. / 국적은 필수입니다.";
    if (!form.native_language.trim()) newErrors.native_language = "Native language is required. / 모국어는 필수입니다.";
    if (!form.email.trim()) newErrors.email = "Email is required. / 이메일 주소는 필수입니다.";
    if (!form.phone_number.trim()) newErrors.phone_number = "Phone number is required. / 전화번호는 필수입니다.";

    if (!form.address_line1.trim()) newErrors.address_line1 = "Address is required. / 주소는 필수입니다.";
    if (!form.city.trim()) newErrors.city = "City is required. / 도시는 필수입니다.";
    if (!form.district.trim()) newErrors.district = "District is required. / 구·군 정보는 필수입니다.";

    if (!form.visa_type) newErrors.visa_type = "Visa type is required. / 비자 종류는 필수입니다.";

    if (!form.teaching_languages.trim()) newErrors.teaching_languages = "Teaching languages are required. / 가르칠 수 있는 언어는 필수입니다.";

    if (!form.self_introduction.trim()) newErrors.self_introduction = "Self introduction is required. / 자기소개는 필수입니다.";
    if (!form.education_history.trim()) newErrors.education_history = "Education history is required. / 학력 사항은 필수입니다.";
    if (!form.experience_history.trim()) newErrors.experience_history = "Experience history is required. / 경력 사항은 필수입니다.";

    // 동의 항목
    if (!form.consentPersonalData) newErrors.consentPersonalData = "This consent is required. / 필수 동의 항목입니다.";
    if (!form.consentDataRetention) newErrors.consentDataRetention = "This consent is required. / 필수 동의 항목입니다.";
    if (!form.consentThirdParty) newErrors.consentThirdParty = "This consent is required. / 필수 동의 항목입니다.";
    if (!form.confirmationInfoTrue) newErrors.confirmationInfoTrue = "This confirmation is required. / 필수 확인 항목입니다.";

    setErrors(newErrors);

    const hasErrors = Object.keys(newErrors).length > 0;
    if (hasErrors) {
      const firstKey = Object.keys(newErrors)[0];
      const firstMessage = newErrors[firstKey] || "Please check the required fields. / 필수 항목을 확인해 주세요.";
      toast.error(firstMessage);
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // ✅ 서버 요청 전에 프론트에서 한 번 더 차단
    if (isEditLocked) {
      const msg =
        "담당자가 이력서 검토를 시작한 이후에는 이를 수정할 수 없습니다. (Once your application is under review, you can no longer edit it.)";
      setSubmitError(msg);
      toast.error(msg);
      return;
    }

    // Confirm 창 표시
    const confirmed = window.confirm(
      "Are you sure you want to submit your application? Once your application is under review, you can no longer edit it.",
    );
    if (!confirmed) {
      return; // 사용자가 취소한 경우 함수 종료
    }

    setSubmitError(null);
    setSubmitSuccess(null);

    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData();

      // ✅ submit 직전 decimal 값 보정 (blur 없이 제출해도 처리됨)
      const totalExpForSubmit = normalizeDecimalBeforeSubmit(form.total_teaching_experience_years);
      const koreaExpForSubmit = normalizeDecimalBeforeSubmit(form.korea_teaching_experience_years);

      // 파일 추가 (새 파일이 있을 때만)
      if (profileImageFile) {
        formData.append("profile_image", profileImageFile);
      }
      if (visaScanFile) {
        formData.append("visa_scan", visaScanFile);
      }

      // 문자열 필드들
      formData.append("first_name", form.first_name);
      formData.append("last_name", form.last_name);
      if (form.korean_name) formData.append("korean_name", form.korean_name);
      if (form.gender) formData.append("gender", form.gender);
      if (form.date_of_birth) formData.append("date_of_birth", form.date_of_birth);
      formData.append("nationality", form.nationality); // ✅ value(예: "USA")가 들어감
      formData.append("native_language", form.native_language); // ✅ value(예: "English")가 들어감
      formData.append("email", form.email);
      formData.append("phone_number", form.phone_number);
      formData.append("address_line1", form.address_line1);
      formData.append("city", form.city);
      formData.append("district", form.district);
      if (form.postal_code) formData.append("postal_code", form.postal_code);

      if (form.visa_type) formData.append("visa_type", form.visa_type);
      if (form.visa_expiry_date) formData.append("visa_expiry_date", form.visa_expiry_date);

      formData.append("teaching_languages", form.teaching_languages);
      if (form.preferred_subjects) formData.append("preferred_subjects", form.preferred_subjects);

      // ✅ 보정된 값으로 append (빈 값이면 append 안 함)
      if (totalExpForSubmit) formData.append("total_teaching_experience_years", totalExpForSubmit);
      if (koreaExpForSubmit) formData.append("korea_teaching_experience_years", koreaExpForSubmit);

      formData.append("self_introduction", form.self_introduction);
      formData.append("education_history", form.education_history);
      formData.append("experience_history", form.experience_history);
      if (form.certifications) formData.append("certifications", form.certifications);
      if (form.teaching_style) formData.append("teaching_style", form.teaching_style);
      if (form.additional_info) formData.append("additional_info", form.additional_info);

      if (form.employment_type) formData.append("employment_type", form.employment_type);
      if (form.preferred_locations) formData.append("preferred_locations", form.preferred_locations);
      if (form.available_time_slots) formData.append("available_time_slots", form.available_time_slots);
      if (form.available_from_date) formData.append("available_from_date", form.available_from_date);

      // 동의 항목 (DRF가 "true"/"false" 문자열을 boolean으로 파싱해줌)
      formData.append("consent_personal_data", form.consentPersonalData ? "true" : "false");
      formData.append("consent_data_retention", form.consentDataRetention ? "true" : "false");
      formData.append("consent_third_party_sharing", form.consentThirdParty ? "true" : "false");
      formData.append("confirmation_info_true", form.confirmationInfoTrue ? "true" : "false");

      // 기존 이력서가 있으면 수정, 없으면 새로 생성
      const response = hasExistingApplication ? await teacherApplicationAPI.update(formData) : await teacherApplicationAPI.submit(formData);

      const data = response.data;

      if (data.success !== false) {
        const successMessage =
          data?.message ||
          (hasExistingApplication
            ? "이력서가 성공적으로 수정되었습니다."
            : "Application submitted successfully. / 지원서가 성공적으로 제출되었습니다.");

        setSubmitSuccess(successMessage);
        toast.success(successMessage);

        // 새로 등록된 경우 상태 업데이트
        if (!hasExistingApplication) {
          setHasExistingApplication(true);
          setExistingApplicationData(data.data);
        }

        // ✅ 성공 시 루트 페이지로 이동
        router.push("/");
      }
    } catch (err: any) {
      console.error("Submit error:", err);

      // 더 구체적인 에러 처리
      if (err.response?.data) {
        const errorData = err.response.data;

        // 백엔드 에러 구조 반영
        const backendErrors: ErrorMap = {};
        if (errorData.errors && typeof errorData.errors === "object") {
          for (const [field, messages] of Object.entries(errorData.errors)) {
            if (Array.isArray(messages)) {
              backendErrors[field] = messages.join(" ");
            } else if (typeof messages === "string") {
              backendErrors[field] = messages;
            } else {
              backendErrors[field] = JSON.stringify(messages);
            }
          }
        }
        setErrors((prev) => ({ ...prev, ...backendErrors }));

        const fallbackMessage = hasExistingApplication
          ? "이력서 수정에 실패했습니다."
          : "Failed to submit application. / 지원서 제출에 실패했습니다.";
        const message = errorData.message || fallbackMessage;

        setSubmitError(message);
        // 필드 에러가 있으면 그중 하나를 보여주고, 없으면 message를 보여줌
        const firstBackendKey = Object.keys(backendErrors)[0];
        if (firstBackendKey) {
          toast.error(backendErrors[firstBackendKey]);
        } else {
          toast.error(message);
        }
      } else if (err.response?.status === 401) {
        const msg = "로그인이 필요합니다. Please log in first.";
        setSubmitError(msg);
        toast.error(msg);
      } else if (err.response?.status === 400) {
        const msg = "입력된 정보를 다시 확인해주세요. Please check your input data.";
        setSubmitError(msg);
        toast.error(msg);
      } else {
        const msg = "An unexpected error occurred. / 예기치 못한 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
        setSubmitError(msg);
        toast.error(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderError = (field: string) => (errors[field] ? <p className="mt-1 text-xs text-red-500">{errors[field]}</p> : null);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-semibold text-slate-900">Teacher Application / 강사 이력서 등록</h1>
          <p className="mt-4 text-sm text-slate-600">이력서를 작성하고 제출하는 페이지입니다.</p>

          {/* ✅ 상태가 NEW가 아니면 수정 불가 안내 */}
          {isEditLocked && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
              주의) 담당자가 이력서를 검토하기 시작하면 더이상 수정할 수 없습니다! (Once your application is under review, you can no longer edit it!)
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-xl shadow-slate-200">
          {/* 상태 메시지 */}
          {submitSuccess && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{submitSuccess}</div>
          )}
          {submitError && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{submitError}</div>}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* 1. Personal Info */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900">1. Personal Information / 기본 인적 정보</h2>
              <p className="mt-1 text-xs text-slate-500">Please fill in your basic personal details. / 기본 인적 정보를 입력해 주세요.</p>

              {/* Profile image + Visa scan */}
              <div className="mt-4 grid gap-6 md:grid-cols-2">
                {/* Profile image */}
                <div className={"rounded-xl border border-gray-300 p-4"}>
                  <label className="block text-sm font-medium text-slate-800">
                    Profile Image (2MB max, JPG/PNG) / 프로필 이미지
                    {!hasExistingApplication && <span className="text-rose-500"> *</span>}
                  </label>
                  <div className="mt-2 flex items-center gap-4">
                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-slate-100">
                      {profilePreviewUrl ? (
                        <img src={profilePreviewUrl} alt="Profile preview" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xs text-slate-400">No image</span>
                      )}
                    </div>
                    <div>
                      <input
                        type="file"
                        accept="image/jpeg,image/png"
                        onChange={handleProfileImageChange}
                        className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        JPEG or PNG, up to 2MB. / JPEG 또는 PNG, 최대 2MB.
                        {hasExistingApplication && " (기존 이미지 유지하려면 선택하지 마세요)"}
                      </p>
                      {renderError("profile_image")}
                    </div>
                  </div>
                </div>

                {/* Visa scan */}
                <div className={"rounded-xl border border-gray-300 p-4"}>
                  <label className="block text-sm font-medium text-slate-800">
                    Visa Copy (2MB max, JPG/PNG) / 비자 사본
                    {!hasExistingApplication && <span className="text-rose-500"> *</span>}
                  </label>
                  <div className="mt-2 flex items-center gap-4">
                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                      {visaPreviewUrl ? (
                        <img src={visaPreviewUrl} alt="Visa preview" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xs text-slate-400">No image</span>
                      )}
                    </div>
                    <div>
                      <input
                        type="file"
                        accept="image/jpeg,image/png"
                        onChange={handleVisaScanChange}
                        className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        JPEG or PNG, up to 2MB. / JPEG 또는 PNG, 최대 2MB.
                        {hasExistingApplication && " (기존 이미지 유지하려면 선택하지 마세요)"}
                      </p>
                      {renderError("visa_scan")}
                    </div>
                  </div>
                </div>
              </div>

              {/* Name / Gender / DOB */}
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-slate-800">
                    First Name / 이름 (First Name)
                    <span className="text-rose-500"> *</span>
                  </label>
                  <input
                    name="first_name"
                    value={form.first_name}
                    onChange={handleInputChange}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-slate-900/5 outline-none focus:bg-white focus:ring-2"
                  />
                  {renderError("first_name")}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800">
                    Last Name / 성 (Last Name)
                    <span className="text-rose-500"> *</span>
                  </label>
                  <input
                    name="last_name"
                    value={form.last_name}
                    onChange={handleInputChange}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-slate-900/5 outline-none focus:bg-white focus:ring-2"
                  />
                  {renderError("last_name")}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800">Korean Name (optional) / 한국 이름 (선택)</label>
                  <input
                    name="korean_name"
                    value={form.korean_name}
                    onChange={handleInputChange}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-slate-900/5 outline-none focus:bg-white focus:ring-2"
                  />
                  {renderError("korean_name")}
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-slate-800">
                    Gender / 성별 <span className="text-rose-500"> *</span>
                  </label>
                  <select
                    name="gender"
                    value={form.gender}
                    onChange={handleInputChange}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-slate-900/5 outline-none focus:bg-white focus:ring-2">
                    <option value="">Select / 선택</option>
                    <option value="MALE">Male / 남성</option>
                    <option value="FEMALE">Female / 여성</option>
                    <option value="OTHER">Other / 기타</option>
                    <option value="PREFER_NOT">Prefer not to say / 선택하지 않음</option>
                  </select>
                  {renderError("gender")}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800">
                    Date of Birth / 생년월일 <span className="text-rose-500"> *</span>
                  </label>
                  <input
                    type="date"
                    name="date_of_birth"
                    value={form.date_of_birth}
                    onChange={handleInputChange}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-slate-900/5 outline-none focus:bg-white focus:ring-2"
                  />
                  {renderError("date_of_birth")}
                </div>
              </div>

              {/* Nationality / native language / contact */}
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {/* ✅ Nationality: input -> select */}
                <div>
                  <label className="block text-sm font-medium text-slate-800">
                    Nationality / 국적
                    <span className="text-rose-500"> *</span>
                  </label>
                  <select
                    name="nationality"
                    value={form.nationality}
                    onChange={handleInputChange}
                    disabled={isEditLocked}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-slate-900/5 outline-none focus:bg-white focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100">
                    <option value="">Select / 선택</option>
                    {NATIONALITY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {renderError("nationality")}
                </div>

                {/* ✅ Native language: input -> select */}
                <div>
                  <label className="block text-sm font-medium text-slate-800">
                    Native Language / 모국어
                    <span className="text-rose-500"> *</span>
                  </label>
                  <select
                    name="native_language"
                    value={form.native_language}
                    onChange={handleInputChange}
                    disabled={isEditLocked}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-slate-900/5 outline-none focus:bg-white focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100">
                    <option value="">Select / 선택</option>
                    {NATIVE_LANGUAGE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {renderError("native_language")}
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-800">
                    Email Address / 이메일 주소
                    <span className="text-rose-500"> *</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleInputChange}
                    disabled={true} // 수정 불가하도록 비활성화
                    className="mt-1 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500" // 비활성화된 스타일 적용
                  />
                  <p className="mt-1 text-xs text-slate-500">이메일 주소는 로그인한 계정의 이메일이 자동으로 설정됩니다.</p>
                  {renderError("email")}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800">
                    Phone Number / 전화번호 (Only numbers)
                    <span className="text-rose-500"> *</span>
                  </label>
                  <input
                    name="phone_number"
                    value={form.phone_number}
                    onChange={handleInputChange}
                    placeholder="010 1234 5678"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-slate-900/5 outline-none focus:bg-white focus:ring-2"
                  />
                  {renderError("phone_number")}
                </div>
              </div>

              {/* Address */}
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-800">
                    Address (street & detail) / 주소 (도로명·상세)
                    <span className="text-rose-500"> *</span>
                  </label>
                  <input
                    name="address_line1"
                    value={form.address_line1}
                    onChange={handleInputChange}
                    placeholder={"한글로 작성해주세요."}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-slate-900/5 outline-none focus:bg-white focus:ring-2"
                  />
                  {renderError("address_line1")}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800">Postal Code / 우편번호</label>
                  <input
                    name="postal_code"
                    value={form.postal_code}
                    onChange={handleInputChange}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-slate-900/5 outline-none focus:bg-white focus:ring-2"
                  />
                  {renderError("postal_code")}
                </div>
              </div>

              <RegionSelectKR
                valueCity={form.city}
                valueDistrict={form.district}
                disabled={isEditLocked}
                required={true}
                onChangeCity={(nextCity) => {
                  setForm((prev) => ({ ...prev, city: nextCity }));
                  setErrors((prev) => ({ ...prev, city: "" }));
                }}
                onChangeDistrict={(nextDistrict) => {
                  setForm((prev) => ({ ...prev, district: nextDistrict }));
                  setErrors((prev) => ({ ...prev, district: "" }));
                }}
                renderError={(field) => renderError(field)}
              />
            </section>

            {/* 2. Visa info */}
            <section className="border-t border-slate-100 pt-6">
              <h2 className="text-lg font-semibold text-slate-900">2. Visa Information / 비자 정보</h2>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-800">
                    Visa Type / 비자 종류
                    <span className="text-rose-500"> *</span>
                  </label>
                  <select
                    name="visa_type"
                    value={form.visa_type}
                    onChange={handleInputChange}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-slate-900/5 outline-none focus:bg-white focus:ring-2">
                    <option value="">Select / 선택</option>
                    <option value="F-2">F-2</option>
                    <option value="F-4">F-4</option>
                    <option value="F-5">F-5</option>
                    <option value="F-6">F-6</option>
                    <option value="OTHER">Other / 기타</option>
                  </select>
                  {renderError("visa_type")}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800">Visa Expiry Date / 비자 만료일</label>
                  <input
                    type="date"
                    name="visa_expiry_date"
                    value={form.visa_expiry_date}
                    onChange={handleInputChange}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-slate-900/5 outline-none focus:bg-white focus:ring-2"
                  />
                  {renderError("visa_expiry_date")}
                </div>
              </div>
            </section>

            {/* 3. Teaching profile */}
            <section className="border-t border-slate-100 pt-6">
              <h2 className="text-lg font-semibold text-slate-900">3. Teaching Profile / 강의 프로필</h2>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-800">
                    Languages You Can Teach / 가르칠 수 있는 언어
                    <span className="text-rose-500"> *</span>
                  </label>
                  <select
                    name="teaching_languages"
                    value={form.teaching_languages}
                    onChange={handleInputChange}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-slate-900/5 outline-none focus:bg-white focus:ring-2">
                    <option value="">Select / 선택</option>
                    <option value="English">English</option>
                    <option value="Japanese">Japanese</option>
                    <option value="Chinese">Chinese</option>
                    <option value="Spanish">Spanish</option>
                  </select>
                  {renderError("teaching_languages")}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800">Preferred Subjects / 선호 수업 분야</label>
                  <input
                    name="preferred_subjects"
                    value={form.preferred_subjects}
                    onChange={handleInputChange}
                    placeholder="Conversation, Business English, Kids..."
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-slate-900/5 outline-none focus:bg-white focus:ring-2"
                  />
                  {renderError("preferred_subjects")}
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-800">Total Teaching Experience (years) / 총 강의 경력 (년)</label>
                  <input
                    name="total_teaching_experience_years"
                    value={form.total_teaching_experience_years}
                    onChange={handleInputChange}
                    onBlur={() => handleDecimalBlur("total_teaching_experience_years")}
                    inputMode="decimal"
                    pattern="^\d*(\.\d?)?$"
                    placeholder="e.g. 3, 3.5, .2"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-slate-900/5 outline-none focus:bg-white focus:ring-2"
                  />
                  {renderError("total_teaching_experience_years")}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800">Teaching Experience in Korea (years) / 한국 강의 경력 (년)</label>
                  <input
                    name="korea_teaching_experience_years"
                    value={form.korea_teaching_experience_years}
                    onChange={handleInputChange}
                    onBlur={() => handleDecimalBlur("korea_teaching_experience_years")}
                    inputMode="decimal"
                    pattern="^\d*(\.\d?)?$"
                    placeholder="e.g. 1, 1.0, .5"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-slate-900/5 outline-none focus:bg-white focus:ring-2"
                  />
                  {renderError("korea_teaching_experience_years")}
                </div>
              </div>
            </section>

            {/* 4. Resume details (text) */}
            <section className="border-t border-slate-100 pt-6">
              <h2 className="text-lg font-semibold text-slate-900">4. Resume Details / 이력 정보</h2>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-800">
                    Self Introduction / 자기소개
                    <span className="text-rose-500"> *</span>
                  </label>
                  <textarea
                    name="self_introduction"
                    value={form.self_introduction}
                    onChange={handleInputChange}
                    rows={4}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-slate-900/5 outline-none focus:bg-white focus:ring-2"
                  />
                  {renderError("self_introduction")}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800">
                    Education History / 학력 사항
                    <span className="text-rose-500"> *</span>
                  </label>
                  <textarea
                    name="education_history"
                    value={form.education_history}
                    onChange={handleInputChange}
                    rows={4}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-slate-900/5 outline-none focus:bg-white focus:ring-2"
                  />
                  {renderError("education_history")}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800">
                    Teaching & Work Experience / 강의 및 근무 경력
                    <span className="text-rose-500"> *</span>
                  </label>
                  <textarea
                    name="experience_history"
                    value={form.experience_history}
                    onChange={handleInputChange}
                    rows={4}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-slate-900/5 outline-none focus:bg-white focus:ring-2"
                  />
                  {renderError("experience_history")}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800">Certificates & Qualifications / 자격증 및 인증</label>
                  <textarea
                    name="certifications"
                    value={form.certifications}
                    onChange={handleInputChange}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-slate-900/5 outline-none focus:bg-white focus:ring-2"
                  />
                  {renderError("certifications")}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800">Teaching Style & Strengths / 수업 스타일 및 강점</label>
                  <textarea
                    name="teaching_style"
                    value={form.teaching_style}
                    onChange={handleInputChange}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-slate-900/5 outline-none focus:bg-white focus:ring-2"
                  />
                  {renderError("teaching_style")}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800">Additional Information / 기타 참고 사항</label>
                  <textarea
                    name="additional_info"
                    value={form.additional_info}
                    onChange={handleInputChange}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-slate-900/5 outline-none focus:bg-white focus:ring-2"
                  />
                  {renderError("additional_info")}
                </div>
              </div>
            </section>

            {/* 5. Working conditions */}
            <section className="border-t border-slate-100 pt-6">
              <h2 className="text-lg font-semibold text-slate-900">5. Preferred Working Conditions / 희망 근무 조건</h2>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-800">Employment Type / 근무 형태</label>
                  <select
                    name="employment_type"
                    value={form.employment_type}
                    onChange={handleInputChange}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-slate-900/5 outline-none focus:bg-white focus:ring-2">
                    <option value="">Select / 선택</option>
                    <option value="FULL_TIME">Full-time / 풀타임</option>
                    <option value="PART_TIME">Part-time / 파트타임</option>
                    <option value="FREELANCE">Freelance / 프리랜서</option>
                    <option value="ANY">Any / 상관없음</option>
                  </select>
                  {renderError("employment_type")}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800">Preferred Locations / 선호 근무 지역</label>
                  <input
                    name="preferred_locations"
                    value={form.preferred_locations}
                    onChange={handleInputChange}
                    placeholder="e.g. Seoul, Online only / 예: 서울, 온라인만 등"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-slate-900/5 outline-none focus:bg-white focus:ring-2"
                  />
                  {renderError("preferred_locations")}
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-800">Available Time Slots / 근무 가능 시간대</label>
                  <input
                    name="available_time_slots"
                    value={form.available_time_slots}
                    onChange={handleInputChange}
                    placeholder="Weekday evenings, Weekends... / 평일 저녁, 주말 등"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-slate-900/5 outline-none focus:bg-white focus:ring-2"
                  />
                  {renderError("available_time_slots")}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800">Available From / 근무 시작 가능 일자</label>
                  <input
                    type="date"
                    name="available_from_date"
                    value={form.available_from_date}
                    onChange={handleInputChange}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-slate-900/5 outline-none focus:bg-white focus:ring-2"
                  />
                  {renderError("available_from_date")}
                </div>
              </div>
            </section>

            {/* 6. Consents */}
            <section className="border-t border-slate-100 pt-6">
              <h2 className="text-lg font-semibold text-slate-900">6. Consents / 동의 항목</h2>
              <p className="mt-1 text-xs text-slate-500">Required consents are marked with * / * 표시된 항목은 필수입니다.</p>

              <div className="mt-4 space-y-3 rounded-xl bg-slate-50 px-4 py-4">
                <label className="flex items-start gap-3 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    name="consentPersonalData"
                    checked={form.consentPersonalData}
                    onChange={handleInputChange}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <span>
                    <span className="font-medium">
                      Consent to personal data usage / 개인정보 수집·이용 동의
                      <span className="text-rose-500"> *</span>
                    </span>
                    <br />I agree that my personal information may be collected and used for processing my application. / 본인은 지원서 접수 및 검토를
                    위해 개인정보를 수집·이용하는 것에 동의합니다.
                  </span>
                </label>
                {renderError("consentPersonalData")}

                <label className="flex items-start gap-3 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    name="consentDataRetention"
                    checked={form.consentDataRetention}
                    onChange={handleInputChange}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <span>
                    <span className="font-medium">
                      Consent to data retention / 정보 보관 기간 동의
                      <span className="text-rose-500"> *</span>
                    </span>
                    <br />I agree that my information may be stored for a certain period for future opportunities. / 향후 채용 기회를 위해 일정 기간
                    동안 정보를 보관하는 것에 동의합니다.
                  </span>
                </label>
                {renderError("consentDataRetention")}

                <label className="flex items-start gap-3 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    name="consentThirdParty"
                    checked={form.consentThirdParty}
                    onChange={handleInputChange}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <span>
                    <span className="font-medium">
                      Consent to share with partner institutes / 제3자 제공 동의<span className="text-rose-500"> *</span>
                    </span>
                    <br />I agree that my profile may be shared with partner schools or academies for recruitment. / 제휴 학원/학교에 이력서를
                    제공하는 것에 동의합니다.
                  </span>
                </label>
                {renderError("consentThirdParty")}

                <label className="flex items-start gap-3 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    name="confirmationInfoTrue"
                    checked={form.confirmationInfoTrue}
                    onChange={handleInputChange}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <span>
                    <span className="font-medium">
                      Confirm information is true / 정보의 정확성 확인
                      <span className="text-rose-500"> *</span>
                    </span>
                    <br />I confirm that all information provided is true and accurate. / 상기 입력한 내용이 사실임을 확인합니다.
                  </span>
                </label>
                {renderError("confirmationInfoTrue")}
              </div>
            </section>

            {/* Submit */}
            <div className="border-t border-slate-100 pt-6">
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => router.push("/")}
                  disabled={isSubmitting}
                  className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm shadow-slate-200 transition hover:cursor-pointer hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
                  Cancel / 취소하기
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || !canEditOrSubmit}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-slate-300 transition hover:cursor-pointer hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400">
                  {isSubmitting
                    ? hasExistingApplication
                      ? "Updating... / 수정 중..."
                      : "Submitting... / 제출 중..."
                    : hasExistingApplication
                      ? applicationStatus === "NEW"
                        ? "Update & Submit Application / 이력서 수정 및 제출"
                        : "Update Locked / 수정 불가"
                      : "Submit Application / 이력서 제출"}
                </button>
              </div>

              {/* ✅ 버튼 비활성화 사유를 바로 아래에 표시 */}
              {isEditLocked && <p className="mt-4 text-center text-sm text-slate-600">이력서 수정은 담당자가 검토를 시작하기 전에만 가능합니다.</p>}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
