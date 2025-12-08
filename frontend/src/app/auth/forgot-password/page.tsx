"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { requestPasswordReset } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      await requestPasswordReset(email);
      setMessage("Password reset email sent. Please check your email.");
    } catch (err: any) {
      // Handle specific error messages from the backend
      if (err.response?.data?.email) {
        // Handle field-specific errors (like email validation)
        setError(err.response.data.email[0]);
      } else if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError("Failed to send password reset email.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Reset your password</h2>
          <p className="mt-2 text-center text-sm text-gray-600">Enter your email address and we'll send you a link to reset your password.</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {message && <div className="rounded border border-green-200 bg-green-50 px-4 py-3 text-green-700">{message}</div>}

          {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>}

          {!message && (
            <>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="relative mt-1 block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
                  placeholder="Email address"
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="group relative flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50">
                  {loading ? "Sending..." : "Send reset link"}
                </button>
              </div>
            </>
          )}

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
