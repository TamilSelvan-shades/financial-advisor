import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;

  const isAuthRoute = request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/register";
  
  if (!token && !isAuthRoute) {
    // Redirect unauthenticated users to login
    return NextResponse.redirect(new URL("/login", request.url));
  }
  
  if (token && isAuthRoute) {
    // Redirect authenticated users away from login/register
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

// Specify the routes to apply the middleware to
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/loans/:path*",
    "/expenses/:path*",
    "/chat/:path*",
    "/login",
    "/register",
  ],
};
