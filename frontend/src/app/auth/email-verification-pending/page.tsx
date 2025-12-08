"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

function EmailVerificationPendingContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { resendVerification } = useAuth();

  const handleResend = async () => {
    // Show confirmation dialog
    const confirmed = window.confirm(
      "Are you sure you want to resend the verification email? Resending the email will invalidate the previous verification code.",
    );

    if (!confirmed) {
      return; // User canceled, don't proceed
    }

    setLoading(true);
    setMessage("");
    setError("");

    try {
      await resendVerification(email);
      setMessage("Verification email sent successfully!");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to resend verification email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-4 rounded-lg bg-white px-6 py-12 shadow-md">
        {message && <div className="rounded border border-green-200 bg-green-50 px-4 py-3 text-center text-green-700">{message}</div>}

        {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-center text-red-700">{error}</div>}

        <div className="space-y-4 text-center">
          <div className="text-center">
            <h2 className="mt-0 text-3xl font-extrabold text-gray-900">Check your email</h2>
            <p className="mt-6 text-lg font-semibold text-gray-600 underline">
              We've sent a verification link to <span className="font-medium text-indigo-600">{email}</span>
            </p>

            <div className={"mt-6 space-y-2"}>
              <p className="text-sm text-gray-600">Please click the link in the email to verify your account and complete your sign-up.</p>
              <p className="text-sm text-gray-600">If the email hasn't arrived, be sure to check your spam or junk folder.</p>
              {/*<p className="text-sm text-gray-600">Or click the button below to request a new verification email.</p>*/}
            </div>
          </div>

          <div className="mt-8 space-y-3">
            {/*<button*/}
            {/*  onClick={handleResend}*/}
            {/*  disabled={loading}*/}
            {/*  className="flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50">*/}
            {/*  {loading ? "Sending..." : "Resend verification email"}*/}
            {/*</button>*/}

            <Link
              href="/auth/login"
              className="flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EmailVerificationPending() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin text-4xl">⏳</div>
            <h2 className="mt-6 text-2xl font-bold text-gray-900">Loading...</h2>
          </div>
        </div>
      }>
      <EmailVerificationPendingContent />
    </Suspense>
  );
}
