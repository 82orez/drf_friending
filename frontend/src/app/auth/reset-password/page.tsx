"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { PiEyeClosed } from "react-icons/pi";
import { GoEye } from "react-icons/go";

function ResetPasswordForm() {
  const [formData, setFormData] = useState({
    password: "",
    passwordConfirm: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { confirmPasswordReset } = useAuth();

  useEffect(() => {
    const tokenFromUrl = searchParams.get("token");
    if (!tokenFromUrl) {
      setError("Invalid reset link.");
      return;
    }
    setToken(tokenFromUrl);
  }, [searchParams]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!token) {
      setError("Invalid reset link.");
      setLoading(false);
      return;
    }

    try {
      await confirmPasswordReset(token, formData.password, formData.passwordConfirm);
      alert("Your password has been successfully reset. You will be redirected to the login page.");
      router.push("/auth/login?message=Password reset successfully");
    } catch (err: any) {
      // Django DRF validation errors are typically in non_field_errors
      const errorMessage = err.response?.data?.non_field_errors?.[0] || err.response?.data?.error || "Failed to reset password.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!token && !error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Reset your password</h2>
          <p className="mt-2 text-center text-sm text-gray-600">Enter your new password below.</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>}

          <div className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                New Password
              </label>
              <div className="relative mt-1">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 pr-10 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
                  placeholder="New password"
                />
                {formData.password && (
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600">
                    {showPassword ? <GoEye size={20} /> : <PiEyeClosed size={20} />}
                  </button>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="passwordConfirm" className="block text-sm font-medium text-gray-700">
                Confirm New Password
              </label>
              <div className="relative mt-1">
                <input
                  id="passwordConfirm"
                  name="passwordConfirm"
                  type={showPasswordConfirm ? "text" : "password"}
                  required
                  value={formData.passwordConfirm}
                  onChange={handleChange}
                  className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 pr-10 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
                  placeholder="Confirm new password"
                />
                {formData.passwordConfirm && (
                  <button
                    type="button"
                    onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600">
                    {showPasswordConfirm ? <GoEye size={20} /> : <PiEyeClosed size={20} />}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? "Resetting..." : "Reset password"}
            </button>
          </div>

          <div className="text-center">
            <Link href="/auth/login" className="font-medium text-indigo-600 hover:text-indigo-500">
              Back to sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ResetPassword() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-xl">Loading...</div>
        </div>
      }>
      <ResetPasswordForm />
    </Suspense>
  );
}
