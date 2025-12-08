"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { PiEyeClosed } from "react-icons/pi";
import { GoEye } from "react-icons/go";

export default function Register() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    passwordConfirm: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

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

    try {
      await register(formData.email, formData.password, formData.passwordConfirm);
      router.push(`/auth/email-verification-pending?email=${encodeURIComponent(formData.email)}`);
    } catch (err: any) {
      // Handle different error response formats
      let errorMessage = "Registration failed. Please try again.";

      if (err.response?.data) {
        const data = err.response.data;
        console.log("API Error Response:", data);

        // Check for non_field_errors (from serializer validation)
        if (data.non_field_errors && data.non_field_errors.length > 0) {
          errorMessage = data.non_field_errors[0];
        }
        // Check for detail (from other API errors)
        else if (data.detail) {
          errorMessage = data.detail;
        }
        // Check for email
        else if (data.email && data.email.length > 0) {
          errorMessage = data.email[0];
        }
        // Check for field-specific errors
        else if (typeof data === "object") {
          const firstError = Object.values(data)[0];
          if (Array.isArray(firstError)) {
            errorMessage = firstError[0];
          } else if (typeof firstError === "string") {
            errorMessage = firstError;
          }
        }
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Create your account</h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div
              className={`animate-pulse rounded border px-4 py-3 text-center font-semibold ${
                error === "An account with this email already exists. Please sign in."
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}>
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="relative mt-1 block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
                placeholder="Email address"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
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
                  placeholder="Password"
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
                Confirm Password
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
                  placeholder="Confirm password"
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
              {loading ? "Creating account..." : "Create account"}
            </button>
          </div>

          <div className="text-center">
            <Link href="/auth/login" className="font-medium text-indigo-600 hover:text-indigo-500">
              Already have an account? Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
