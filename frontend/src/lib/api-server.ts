import { cookies } from "next/headers";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

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

  const url = `${API_BASE_URL}${endpoint}`;

  return fetch(url, {
    cache: "no-store",
    ...options,
    headers,
  });
}
