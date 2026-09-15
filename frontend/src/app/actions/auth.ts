"use server";

import { cookies } from "next/headers";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function login(formData: FormData) {
  const email = formData.get("username") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      // OAuth2PasswordBearer expects form data
      body: new URLSearchParams({
        username: email,
        password: password,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { error: errorData.detail || "Login failed" };
    }

    const data = await response.json();
    
    // Set the JWT as an HTTP-only cookie
    const cookieStore = await cookies();
    cookieStore.set({
      name: "auth_token",
      value: data.access_token,
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return { success: true };
  } catch (error) {
    console.error("Login error:", error);
    return { error: "An unexpected error occurred" };
  }
}

export async function register(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const full_name = formData.get("full_name") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        full_name,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { error: errorData.detail || "Registration failed" };
    }

    return { success: true };
  } catch (error) {
    console.error("Registration error:", error);
    return { error: "An unexpected error occurred" };
  }
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("auth_token");
}
