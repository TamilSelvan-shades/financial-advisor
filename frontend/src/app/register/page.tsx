import { cookies } from "next/headers";
import { Suspense } from "react";
import { RegisterForm } from "./register-form";

export default async function RegisterPage() {
  const cookieStore = await cookies();
  const hasExistingSession = Boolean(cookieStore.get("auth_token")?.value);

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f7f7f2]" />}>
      <RegisterForm hasExistingSession={hasExistingSession} />
    </Suspense>
  );
}
