"use client";

import { FormEvent, useState, ChangeEvent, useEffect } from "react";
import { teacherApplicationAPI } from "@/lib/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const API_ENDPOINT = `${API_BASE_URL}/api/teacher-applications/`;

type Gender = "" | "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT";
type VisaType = "" | "E-2" | "F-2" | "F-4" | "F-5" | "D-10" | "OTHER";
type EmploymentType = "" | "FULL_TIME" | "PART_TIME" | "FREELANCE" | "ANY";

interface TeacherApplicationForm {
  // Personal info
  first_name: string;
  last_name: string;
  korean_name: string;
  gender: Gender;
  date_of_birth: string;
  nationality: string;
  native_language: string;
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

export default function TeacherApplicationPage() {
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

  // revoke object URLs on unmount
  useEffect(() => {
    return () => {
      if (profilePreviewUrl) URL.revokeObjectURL(profilePreviewUrl);
      if (visaPreviewUrl) URL.revokeObjectURL(visaPreviewUrl);
    };
  }, [profilePreviewUrl, visaPreviewUrl]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value /* checkbox는 boolean, 나머지는 string */,
    }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateFile = (file: File | null, fieldName: string): string | null => {
    if (!file) return "This file is required. / 파일은 필수입니다.";

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
      setProfilePreviewUrl(null);
      setErrors((prev) => ({ ...prev, profile_image: error }));
      return;
    }
    setProfileImageFile(file);
    setProfilePreviewUrl(file ? URL.createObjectURL(file) : null);
    setErrors((prev) => ({ ...prev, profile_image: "" }));
  };

  const handleVisaScanChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    const error = validateFile(file, "visa_scan");
    if (error) {
      setVisaScanFile(null);
      setVisaPreviewUrl(null);
      setErrors((prev) => ({ ...prev, visa_scan: error }));
      return;
    }
    setVisaScanFile(file);
    setVisaPreviewUrl(file ? URL.createObjectURL(file) : null);
    setErrors((prev) => ({ ...prev, visa_scan: "" }));
  };

  const validateForm = (): boolean => {
    const newErrors: ErrorMap = {};

    // 최소 필수 필드들
    if (!profileImageFile) {
      newErrors.profile_image = "Profile image is required. / 프로필 이미지는 필수입니다.";
    }
    if (!visaScanFile) {
      newErrors.visa_scan = "Visa copy is required. / 비자 사본은 필수입니다.";
    }

    if (!form.first_name.trim()) newErrors.first_name = "First name is required. / 이름(First Name)은 필수입니다.";
    if (!form.last_name.trim()) newErrors.last_name = "Last name is required. / 성(Last Name)은 필수입니다.";
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
    if (!form.confirmationInfoTrue) newErrors.confirmationInfoTrue = "This confirmation is required. / 필수 확인 항목입니다.";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData();

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
      formData.append("nationality", form.nationality);
      formData.append("native_language", form.native_language);
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
      if (form.total_teaching_experience_years) formData.append("total_teaching_experience_years", form.total_teaching_experience_years);
      if (form.korea_teaching_experience_years) formData.append("korea_teaching_experience_years", form.korea_teaching_experience_years);

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

      // teacherApplicationAPI 사용으로 변경
      const response = await teacherApplicationAPI.submit(formData);
      const data = response.data;

      if (data.success !== false) {
        setSubmitSuccess(data?.message || "Application submitted successfully. / 지원서가 성공적으로 제출되었습니다.");
        // 폼 초기화 (원하면 파일도 초기화)
        setForm((prev) => ({
          ...prev,
          self_introduction: "",
          education_history: "",
          experience_history: "",
          certifications: "",
          teaching_style: "",
          additional_info: "",
        }));
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
        setSubmitError(errorData.message || "Failed to submit application. / 지원서 제출에 실패했습니다.");
      } else if (err.response?.status === 401) {
        setSubmitError("로그인이 필요합니다. Please log in first.");
      } else if (err.response?.status === 400) {
        setSubmitError("입력된 정보를 다시 확인해주세요. Please check your input data.");
      } else {
        setSubmitError("An unexpected error occurred. / 예기치 못한 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderError = (field: string) => (errors[field] ? <p className="mt-1 text-xs text-red-500">{errors[field]}</p> : null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold text-slate-900">Teacher Application</h1>
          <p className="mt-2 text-sm text-slate-600">강사 이력서 제출 페이지입니다.</p>
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
                <div>
                  <label className="block text-sm font-medium text-slate-800">
                    Profile Image (2MB max, JPG/PNG) / 프로필 이미지
                    <span className="text-rose-500"> *</span>
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
                      <p className="mt-1 text-xs text-slate-500">JPEG or PNG, up to 2MB. / JPEG 또는 PNG, 최대 2MB.</p>
                      {renderError("profile_image")}
                    </div>
                  </div>
                </div>

                {/* Visa scan */}
                <div>
                  <label className="block text-sm font-medium text-slate-800">
                    Visa Copy (2MB max, JPG/PNG) / 비자 사본
                    <span className="text-rose-500"> *</span>
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
                      <p className="mt-1 text-xs text-slate-500">JPEG or PNG, up to 2MB. / JPEG 또는 PNG, 최대 2MB.</p>
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
                  <label className="block text-sm font-medium text-slate-800">Gender / 성별</label>
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
                  <label className="block text-sm font-medium text-slate-800">Date of Birth / 생년월일</label>
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
                <div>
                  <label className="block text-sm font-medium text-slate-800">
                    Nationality / 국적
                    <span className="text-rose-500"> *</span>
                  </label>
                  <input
                    name="nationality"
                    value={form.nationality}
                    onChange={handleInputChange}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-slate-900/5 outline-none focus:bg-white focus:ring-2"
                  />
                  {renderError("nationality")}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800">
                    Native Language / 모국어
                    <span className="text-rose-500"> *</span>
                  </label>
                  <input
                    name="native_language"
                    value={form.native_language}
                    onChange={handleInputChange}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-slate-900/5 outline-none focus:bg-white focus:ring-2"
                  />
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
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-slate-900/5 outline-none focus:bg-white focus:ring-2"
                  />
                  {renderError("email")}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800">
                    Phone Number / 전화번호
                    <span className="text-rose-500"> *</span>
                  </label>
                  <input
                    name="phone_number"
                    value={form.phone_number}
                    onChange={handleInputChange}
                    placeholder="010-1234-5678"
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
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-800">
                    City / 도시
                    <span className="text-rose-500"> *</span>
                  </label>
                  <input
                    name="city"
                    value={form.city}
                    onChange={handleInputChange}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-slate-900/5 outline-none focus:bg-white focus:ring-2"
                  />
                  {renderError("city")}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800">
                    District / 구·군
                    <span className="text-rose-500"> *</span>
                  </label>
                  <input
                    name="district"
                    value={form.district}
                    onChange={handleInputChange}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-slate-900/5 outline-none focus:bg-white focus:ring-2"
                  />
                  {renderError("district")}
                </div>
              </div>
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
                    <option value="E-2">E-2</option>
                    <option value="F-2">F-2</option>
                    <option value="F-4">F-4</option>
                    <option value="F-5">F-5</option>
                    <option value="D-10">D-10</option>
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
                  <input
                    name="teaching_languages"
                    value={form.teaching_languages}
                    onChange={handleInputChange}
                    placeholder="e.g. English, Chinese / 예: English, Chinese"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-slate-900/5 outline-none focus:bg-white focus:ring-2"
                  />
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
                    placeholder="e.g. 3.5"
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
                    placeholder="e.g. 1.0"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 ring-slate-900/5 outline-none focus:bg-white focus:ring-2"
                  />
                  {renderError("korea_teaching_experience_years")}
                </div>
              </div>
            </section>

            {/* 4. Resume details (text) */}
            <section className="border-t border-slate-100 pt-6">
              <h2 className="text-lg font-semibold text-slate-900">4. Resume Details / 이력 정보 (웹에서 직접 작성)</h2>

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
                    <span className="font-medium">Consent to share with partner institutes / 제3자 제공 동의 (선택)</span>
                    <br />I agree that my profile may be shared with partner schools or academies for recruitment. / 제휴 학원/학교에 이력서를
                    제공하는 것에 동의합니다. (선택)
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
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400">
                {isSubmitting ? "Submitting... / 제출 중..." : "Submit Application / 이력서 제출"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
