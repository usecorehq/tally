import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Everything except the login page, NextAuth's own routes, the icons, the mark and the share image needs a session.
// /design (the V2 kit and page previews, fixture data only) is open outside production.
export default auth((req) => {
  if (process.env.NODE_ENV !== "production" && req.nextUrl.pathname.startsWith("/design")) return;
  if (!req.auth) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
});

export const config = {
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico|icon\\.svg|apple-icon\\.png|og\\.png|tally-mark\\.svg).*)"],
};
