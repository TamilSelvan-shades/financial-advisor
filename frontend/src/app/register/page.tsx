"use client";

import { register } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await register(formData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push("/login?registered=true");
    }
  }

  return (
    <AuthShell
      eyebrow="Start your record"
      title="Create your Ledgerly account"
      description="Set up one private place for your complete financial picture."
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-5">
          {error && (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="full_name" className="text-sm font-semibold">
              Full name
            </Label>
            <Input
              id="full_name"
              name="full_name"
              autoComplete="name"
              placeholder="Your name"
              className="h-11 bg-white"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-semibold">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="h-11 bg-white"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-semibold">
              Password
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              className="h-11 bg-white"
              required
            />
          </div>
        </div>
        <div className="mt-7 space-y-5">
          <Button
            type="submit"
            className="h-11 w-full bg-[#15332f] font-bold text-white hover:bg-[#214943]"
            disabled={loading}
          >
            {loading ? "Creating account..." : "Create account"}
          </Button>
          <div className="text-center text-sm text-[#5d716d]">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-bold text-[#167d6b] hover:underline"
            >
              Sign in
            </Link>
          </div>
        </div>
      </form>
    </AuthShell>
  );
}
