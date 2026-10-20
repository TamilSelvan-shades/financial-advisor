"use client";

import { login } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isRegistered = searchParams.get("registered") === "true";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await login(formData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to Ledgerly"
      description="Continue to your private financial workspace."
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-5">
          {isRegistered && !error && (
            <div
              role="status"
              className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
            >
              Registration successful. Sign in to continue.
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
            >
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label
              htmlFor="username"
              className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#5d716d]"
            >
              Email
            </Label>
            <div className="relative">
              <Mail
                size={17}
                className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-[#167d6b]"
              />
              <Input
                id="username"
                name="username"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className="h-12 rounded-none border-x-0 border-t-0 border-[#15332f]/25 bg-transparent pl-7 pr-0 shadow-none focus-visible:border-[#167d6b] focus-visible:ring-0"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="password"
              className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#5d716d]"
            >
              Password
            </Label>
            <div className="relative">
              <LockKeyhole
                size={17}
                className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-[#167d6b]"
              />
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="h-12 rounded-none border-x-0 border-t-0 border-[#15332f]/25 bg-transparent pl-7 pr-10 shadow-none focus-visible:border-[#167d6b] focus-visible:ring-0"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute right-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-[#5d716d] transition-colors hover:text-[#15332f]"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>
        </div>
        <div className="mt-7 space-y-5">
          <Button
            type="submit"
            className="group h-12 w-full justify-between rounded-md bg-[#15332f] px-5 font-bold text-white hover:bg-[#214943]"
            disabled={loading}
          >
            <span>{loading ? "Signing in..." : "Enter your workspace"}</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-300 text-[#15332f] transition-transform group-hover:translate-x-0.5">
              <ArrowRight size={15} />
            </span>
          </Button>
          <div className="text-center text-sm text-[#5d716d]">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-bold text-[#167d6b] hover:underline"
            >
              Create one
            </Link>
          </div>
        </div>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#15332f] text-sm font-semibold text-emerald-100">
          Loading your workspace...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
