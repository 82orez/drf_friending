import Link from "next/link";
import { useState } from "react";

export default function MainPage() {
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState<string>("");

  const handleNavigation = (path: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    setIsNavigating(true);
    setNavigatingTo(path);
  };

  return (
    <div className="space-y-4">
      <div className="mb-6 text-lg text-gray-700">Please sign in or create an account</div>
      <div className="space-y-3">
        <Link
          href="/auth/login"
          onClick={handleNavigation("/auth/login")}
          className={`flex w-full justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none ${
            isNavigating && navigatingTo === "/auth/login" ? "cursor-not-allowed bg-indigo-400" : "bg-indigo-600 hover:bg-indigo-700"
          }`}>
          {isNavigating && navigatingTo === "/auth/login" ? (
            <div className="flex items-center space-x-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>Loading...</span>
            </div>
          ) : (
            "Sign In"
          )}
        </Link>

        <Link
          href="/auth/register"
          onClick={handleNavigation("/auth/register")}
          className={`flex w-full justify-center rounded-md border px-4 py-2 text-sm font-medium shadow-sm focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none ${
            isNavigating && navigatingTo === "/auth/register"
              ? "cursor-not-allowed border-gray-300 bg-gray-100 text-gray-400"
              : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          }`}>
          {isNavigating && navigatingTo === "/auth/register" ? (
            <div className="flex items-center space-x-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
              <span>Loading...</span>
            </div>
          ) : (
            "Create Account"
          )}
        </Link>
      </div>
    </div>
  );
}
