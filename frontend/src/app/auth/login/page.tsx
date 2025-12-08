"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { GoEye } from "react-icons/go";
import { PiEyeClosed } from "react-icons/pi";

export default function Login() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login, resendVerification } = useAuth();
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleResendVerification = async () => {
    setResendingVerification(true);
    setResendMessage("");
    setError("");

    try {
      await resendVerification(formData.email);
      setResendMessage("Verification email sent successfully! Please check your email.");
      setShowResendVerification(false);
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || "Failed to resend verification email.";
      setError(errorMsg);
    } finally {
      setResendingVerification(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResendMessage("");
    setShowResendVerification(false);

    try {
      await login(formData.email, formData.password);
      router.push("/");
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.response?.data?.non_field_errors?.[0] || "Login failed. Please try again.";
      setError(errorMsg);

      // Check if the error is about email verification
      if (errorMsg === "Please verify your email address first.") {
        setShowResendVerification(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Sign in to your account</h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="animate-pulse rounded border border-red-200 bg-red-50 px-4 py-3 text-center font-semibold text-red-700">{error}</div>
          )}

          {resendMessage && (
            <div className="animate-pulse rounded border border-green-200 bg-green-50 px-4 py-3 font-semibold text-green-700">{resendMessage}</div>
          )}

          {showResendVerification && (
            <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3 font-semibold">
              <p className="mb-3 text-sm text-blue-700">Your email address needs to be verified before you can sign in.</p>
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resendingVerification}
                className="w-full rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50">
                {resendingVerification ? "Sending..." : "Resend verification email"}
              </button>
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
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <Link href="/auth/forgot-password" className="font-medium text-indigo-600 hover:text-indigo-500">
              Forgot your password?
            </Link>
            <Link href="/auth/register" className="font-medium text-indigo-600 hover:text-indigo-500">
              Create account
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
