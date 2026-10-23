import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;

  const isLoginRoute = request.nextUrl.pathname === "/login";
  const isRegisterRoute = request.nextUrl.pathname === "/register";
  
  if (!token && !isLoginRoute && !isRegisterRoute) {
    // Redirect unauthenticated users to login
    return NextResponse.redirect(new URL("/login", request.url));
  }
  
  if (token && isLoginRoute) {
    // If user explicitly wants to switch accounts via ?switch=true, allow access to /login
    if (!request.nextUrl.searchParams.has("switch")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // NOTE: /register is never blocked for authenticated users.
  // Existing users must be able to access /register to create new accounts.

  return NextResponse.next();
}

// Specify the routes to apply the middleware to
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/loans/:path*",
    "/expenses/:path*",
    "/chat/:path*",
    "/bills/:path*",
    "/credit/:path*",
    "/goals/:path*",
    "/investments/:path*",
    "/reports/:path*",
    "/tax/:path*",
    "/billing/:path*",
    "/login",
    "/register",
  ],
};
