import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Everything except the login page and NextAuth's own routes needs a session.
export default auth((req) => {
  if (!req.auth) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
});

export const config = {
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)"],
};
