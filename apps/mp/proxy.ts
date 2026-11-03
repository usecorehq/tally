import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Everything except the login page and NextAuth's own routes needs a session.
// / is open (signed out it's the landing page); /design (kit previews, fixture data) is open outside production.
export default auth((req) => {
  if (req.nextUrl.pathname === "/") return;
  if (process.env.NODE_ENV !== "production" && req.nextUrl.pathname.startsWith("/design")) return;
  if (!req.auth) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
});

export const config = {
  matcher: ["/((?!login|api/auth|landing/|icon.svg|_next/static|_next/image|favicon.ico).*)"],
};
