import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// CSRF Token 처리
api.interceptors.request.use(async (config) => {
  // Django의 CSRF 토큰을 가져오기
  if (["post", "put", "patch", "delete"].includes(config.method?.toLowerCase() || "")) {
    try {
      const csrfResponse = await fetch(`${API_BASE_URL}/api/auth/csrf/`, {
        credentials: "include",
      });
      const csrfData = await csrfResponse.json();
      config.headers["X-CSRFToken"] = csrfData.csrfToken;
    } catch (error) {
      console.error("Failed to get CSRF token:", error);
    }
  }
  return config;
});

export default api;

// Auth API functions
export const authAPI = {
  register: (data: { email: string; password: string; password_confirm: string }) => api.post("/auth/register/", data),

  login: (data: { email: string; password: string }) => api.post("/auth/login/", data),

  logout: () => api.post("/auth/logout/"),

  verifyEmail: (token: string) => api.post("/auth/verify-email/", { token }),

  resendVerification: (email: string) => api.post("/auth/resend-verification/", { email }),

  passwordResetRequest: (email: string) => api.post("/auth/password-reset-request/", { email }),

  passwordResetConfirm: (data: { token: string; password: string; password_confirm: string }) => api.post("/auth/password-reset-confirm/", data),

  getProfile: () => api.get("/auth/profile/"),

  updateProfile: (data: FormData) => {
    return api.patch("/auth/profile/", data, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },
};

export const teacherApplicationAPI = {
  // 기존 이력서 확인 및 새 이력서 제출
  submit: async (formData: FormData) => {
    return await api.post("/teacher-applications/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  // 기존 이력서 조회
  checkExisting: async () => {
    return await api.get("/teacher-applications/");
  },

  // 이력서 수정
  update: async (formData: FormData) => {
    return await api.patch("/teacher-applications/my/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  // 이력서 조회 (수정용)
  getMyApplication: async () => {
    return await api.get("/teacher-applications/my/");
  },

  // 이력서 삭제 (REJECTED일 때만 서버에서 허용)
  deleteMyApplication: async () => {
    return await api.delete("/teacher-applications/my/");
  },
};

// === Dispatch Requests API ===
export const dispatchRequestsAPI = {
  create: (data: any) => api.post("/dispatch-requests/", data),
  myList: () => api.get("/dispatch-requests/my/"),
  adminList: () => api.get("/dispatch-requests/admin/list/"),
  adminDetail: (id: number) => api.get(`/dispatch-requests/admin/${id}/`),
};

// === Course Posts (Recruiting) API ===
export const coursePostsAPI = {
  list: () => api.get("/course-posts/"),
  detail: (id: number) => api.get(`/course-posts/${id}/`),
  apply: (id: number, message?: string) => api.post(`/course-posts/${id}/apply/`, { message: message || "" }),
  withdraw: (id: number) => api.post(`/course-posts/${id}/withdraw/`),

  // admin/manager
  adminList: () => api.get("/course-posts/admin/list/"),
  adminDetail: (id: number) => api.get(`/course-posts/admin/${id}/`),
  create: (data: { dispatch_request_id: number; application_deadline?: string | null; notes_for_teachers?: string }) =>
    api.post("/course-posts/", data),
  publish: (id: number) => api.post(`/course-posts/admin/${id}/publish/`),
  close: (id: number) => api.post(`/course-posts/admin/${id}/close/`),
  applications: (id: number) => api.get(`/course-posts/admin/${id}/applications/`),
  setApplicationStatus: (postId: number, applicationId: number, status: string) =>
    api.patch(`/course-posts/admin/${postId}/set-application-status/`, {
      application_id: applicationId,
      status,
    }),
};

// === Courses (Confirmed) API ===
export const coursesAPI = {
  myList: () => api.get("/courses/my/"),

  // admin/manager
  adminList: () => api.get("/courses/admin/list/"),
  adminDetail: (id: number) => api.get(`/courses/admin/${id}/`),
  adminUpdate: (id: number, data: any) => api.patch(`/courses/admin/${id}/`, data),
  confirmFromPost: (postId: number, teacherId?: number) =>
    api.post(`/courses/admin/confirm-from-post/${postId}/`, teacherId ? { teacher_id: teacherId } : {}),
};
