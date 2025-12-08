"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { authAPI } from "@/lib/api";

interface User {
  id: number;
  email: string;
  username: string;
  is_email_verified: boolean;
  date_joined: string;
  profile_image: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, passwordConfirm: string) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  confirmPasswordReset: (token: string, password: string, passwordConfirm: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (data: FormData) => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const response = await authAPI.getProfile();
      setUser(response.data);
    } catch (error) {
      setUser(null);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      await refreshUser();
      setLoading(false);
    };
    initializeAuth();
  }, []);

  const updateProfile = async (data: FormData) => {
    const response = await authAPI.updateProfile(data);
    // 프로필 업데이트 후 사용자 정보 새로고침
    await refreshUser();
    return response.data;
  };

  const login = async (email: string, password: string) => {
    const response = await authAPI.login({ email, password });
    setUser(response.data.user);
  };

  const logout = async () => {
    await authAPI.logout();
    setUser(null);
  };

  const register = async (email: string, password: string, passwordConfirm: string) => {
    await authAPI.register({ email, password, password_confirm: passwordConfirm });
  };

  const verifyEmail = async (token: string) => {
    await authAPI.verifyEmail(token);
  };

  const resendVerification = async (email: string) => {
    await authAPI.resendVerification(email);
  };

  const requestPasswordReset = async (email: string) => {
    await authAPI.passwordResetRequest(email);
  };

  const confirmPasswordReset = async (token: string, password: string, passwordConfirm: string) => {
    await authAPI.passwordResetConfirm({ token, password, password_confirm: passwordConfirm });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        register,
        verifyEmail,
        resendVerification,
        requestPasswordReset,
        confirmPasswordReset,
        refreshUser,
        updateProfile,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
