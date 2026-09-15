"use client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
}

export async function fetchWithAuthClient(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getCookie("auth_token");

  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  
  // Ensure we accept JSON
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  // Use relative endpoint if running in browser to leverage same-origin proxy rewrite
  const url = endpoint.startsWith("http") ? endpoint : endpoint;

  return fetch(url, {
    cache: "no-store",
    credentials: "include",
    ...options,
    headers,
  });
}
