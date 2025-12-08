"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

function VerifyEmailContent() {
  const [status, setStatus] = useState<"ready" | "loading" | "success" | "error">("ready");
  const [message, setMessage] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { verifyEmail } = useAuth();

  useEffect(() => {
    const urlToken = searchParams.get("token");

    if (!urlToken) {
      setStatus("error");
      setMessage("Invalid verification link.");
      return;
    }

    setToken(urlToken);
    setStatus("ready");
  }, [searchParams]);

  const handleConfirm = async () => {
    if (!token) return;

    setStatus("loading");

    try {
      await verifyEmail(token);
      setStatus("success");
      setMessage("Email verified successfully!");

      // Redirect to the login-page after 3 seconds
      setTimeout(() => {
        router.push("/auth/login");
      }, 3000);
    } catch (err: any) {
      setStatus("error");
      setMessage(err.response?.data?.error || "Email verification failed.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          {status === "ready" && (
            <>
              <div className="mx-auto h-12 w-12 text-4xl">📧</div>
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Email Verification</h2>
              <p className="mt-2 text-sm text-gray-600">Click the button below to verify your email address</p>
            </>
          )}

          {status === "loading" && (
            <>
              <div className="mx-auto h-12 w-12 animate-spin text-4xl">⏳</div>
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Verifying your email...</h2>
            </>
          )}

          {status === "success" && (
            <>
              <div className="mx-auto h-12 w-12 text-4xl">✅</div>
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Email verified!</h2>
              <p className="mt-2 text-sm text-gray-600">Redirecting to sign in page in 3 seconds...</p>
            </>
          )}

          {status === "error" && (
            <>
              <div className="mx-auto h-12 w-12 text-4xl">❌</div>
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Verification failed</h2>
            </>
          )}
        </div>

        <div className="rounded-lg bg-white p-6 shadow-md">
          <div className="text-center">
            {status === "ready" && (
              <button
                onClick={handleConfirm}
                className="flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none">
                Confirm Email Verification
              </button>
            )}

            {status === "success" && <div className="mb-4 rounded border border-green-200 bg-green-50 px-4 py-3 text-green-700">{message}</div>}

            {status === "error" && (
              <>
                <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700">{message}</div>
                <Link
                  href="/auth/login"
                  className="flex w-full justify-center rounded-md border border-transparent bg-gray-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:outline-none">
                  Go to sign in
                </Link>
              </>
            )}

            {(status === "ready" || status === "loading") && (
              <div className="mt-4">
                <Link href="/auth/login" className="text-sm text-indigo-600 hover:text-indigo-500">
                  Back to sign in
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmail() {
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
      <VerifyEmailContent />
    </Suspense>
  );
}
