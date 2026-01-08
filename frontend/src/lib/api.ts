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
// ================================
// Culture Centers API (for manager/admin)
// ================================
export const cultureCentersAPI = {
  // Manager: list only centers the manager is linked to (or all if admin)
  listMy: async () => {
    return await api.get("/culture-centers/my/");
  },
};

// ================================
// Dispatches API
// ================================
export const dispatchesAPI = {
  manager: {
    listRequests: async () => {
      return await api.get("/dispatches/manager/requests/");
    },
    createRequest: async (data: any) => {
      return await api.post("/dispatches/manager/requests/", data);
    },
    getRequest: async (id: number) => {
      return await api.get(`/dispatches/manager/requests/${id}/`);
    },
    updateRequest: async (id: number, data: any) => {
      return await api.patch(`/dispatches/manager/requests/${id}/`, data);
    },
  },

  teacher: {
    listPublishedRequests: async () => {
      return await api.get("/dispatches/teacher/requests/");
    },
    apply: async (requestId: number, data: { message?: string }) => {
      return await api.post(`/dispatches/teacher/requests/${requestId}/apply/`, data);
    },
    listMyApplications: async () => {
      return await api.get("/dispatches/teacher/applications/");
    },
  },

  admin: {
    listRequests: async () => {
      return await api.get("/dispatches/admin/requests/");
    },
    getRequest: async (id: number) => {
      return await api.get(`/dispatches/admin/requests/${id}/`);
    },
    updateRequest: async (id: number, data: any) => {
      return await api.patch(`/dispatches/admin/requests/${id}/`, data);
    },
    publish: async (id: number, data: { application_deadline?: string | null }) => {
      return await api.post(`/dispatches/admin/requests/${id}/publish/`, data);
    },
    listApplications: async (id: number) => {
      return await api.get(`/dispatches/admin/requests/${id}/applications/`);
    },
    assign: async (id: number, data: { application_id: number; admin_memo?: string }) => {
      return await api.post(`/dispatches/admin/requests/${id}/assign/`, data);
    },
    updateAssignment: async (assignmentId: number, data: { status?: string; admin_memo?: string }) => {
      return await api.patch(`/dispatches/admin/assignments/${assignmentId}/`, data);
    },
  },
};
