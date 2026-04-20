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

// Auth API
export const authAPI = {
  register: (data: { email: string; password: string; password_confirm: string }) => api.post("/auth/register/", data),
  login: (data: { email: string; password: string }) => api.post("/auth/login/", data),
  logout: () => api.post("/auth/logout/"),
  verifyEmail: (token: string) => api.post("/auth/verify-email/", { token }),
  resendVerification: (email: string) => api.post("/auth/resend-verification/", { email }),
  passwordResetRequest: (email: string) => api.post("/auth/password-reset-request/", { email }),
  passwordResetConfirm: (data: { token: string; password: string; password_confirm: string }) => api.post("/auth/password-reset-confirm/", data),
  getProfile: () => api.get("/auth/profile/"),
  updateProfile: (data: FormData) =>
    api.patch("/auth/profile/", data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

export const teacherApplicationAPI = {
  submit: async (formData: FormData) =>
    api.post("/teacher-applications/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  checkExisting: async () => api.get("/teacher-applications/"),
  update: async (formData: FormData) =>
    api.patch("/teacher-applications/my/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  getMyApplication: async () => api.get("/teacher-applications/my/"),
  deleteMyApplication: async () => api.delete("/teacher-applications/my/"),
};

// === Dispatch Requests API (공고/지원 통합) ===
export const dispatchRequestsAPI = {
  // common
  create: (data: any) => api.post("/dispatch-requests/", data),
  myList: () => api.get("/dispatch-requests/my/"),
  openList: () => api.get("/dispatch-requests/open/"),
  detail: (id: number) => api.get(`/dispatch-requests/${id}/`),

  // admin/manager
  adminList: () => api.get("/dispatch-requests/admin/list/"),
  adminDetail: (id: number) => api.get(`/dispatch-requests/admin/${id}/`),
  adminUpdate: (
    id: number,
    data: { notes_for_teachers?: string | null; application_deadline?: string | null }
  ) => api.patch(`/dispatch-requests/admin/${id}/`, data),
  open: (id: number) => api.post(`/dispatch-requests/admin/${id}/open/`),
  close: (id: number) => api.post(`/dispatch-requests/admin/${id}/close/`),
  applications: (id: number) => api.get(`/dispatch-requests/admin/${id}/applications/`),
  setApplicationStatus: (id: number, applicationId: number, status: string) =>
    api.patch(`/dispatch-requests/admin/${id}/set-application-status/`, {
      application_id: applicationId,
      status,
    }),

  // teacher
  apply: (id: number, message?: string) =>
    api.post(`/dispatch-requests/${id}/apply/`, { message: message || "" }),
  withdraw: (id: number) => api.post(`/dispatch-requests/${id}/withdraw/`),
};

// === Courses (Confirmed) API ===
export const coursesAPI = {
  myList: () => api.get("/courses/my/"),
  adminList: () => api.get("/courses/admin/list/"),
  adminDetail: (id: number) => api.get(`/courses/admin/${id}/`),
  adminUpdate: (id: number, data: any) => api.patch(`/courses/admin/${id}/`, data),
  confirmFromDispatch: (dispatchId: number, teacherId?: number) =>
    api.post(
      `/courses/admin/confirm-from-dispatch/${dispatchId}/`,
      teacherId ? { teacher_id: teacherId } : {}
    ),
};
