import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { EMBED_CONFIG_HEADER, frameAncestors, lookupEmbedClient } from "@/app/embed/config";

// Everything except the login page, NextAuth's own routes, the icons, the mark and the share image needs a session.
// /design (the V2 kit and page previews, fixture data only) is open outside production.
const withSession = auth((req) => {
  const { pathname } = req.nextUrl;
  if (process.env.NODE_ENV !== "production" && pathname.startsWith("/design")) return;
  if (!req.auth) {
    const url = new URL("/login", req.nextUrl);
    // With the query string, so /oauth/authorize?… survives sign-in.
    url.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
});

/** Skipped by the matcher before the embed host needed them: still no NextAuth on the main host. */
const PUBLIC = /^\/(login|api\/auth|og\.png|tally-mark\.svg)/;
const EMBED = /^\/embed(\/|$)/;
// The 404 page's own mark, the only public asset the embed host serves outside /embed/*.
const ASSET = /^\/tally-mark\.svg$/;

export default async function proxy(req: NextRequest, event: NextFetchEvent) {
  const embedHost = process.env.EMBED_HOST;
  // The Host header: nextUrl's hostname can be the server's own name in dev.
  const onEmbedHost = Boolean(embedHost) && (req.headers.get("host") ?? "").split(":")[0] === embedHost;
  const isEmbed = EMBED.test(req.nextUrl.pathname);
  // The embed host serves /embed/* only, with no NextAuth; the main host never serves /embed/*.
  // EMBED_HOST unset (dev, previews): /embed/* is served on the main host for testing.
  if (onEmbedHost) return isEmbed ? embed(req) : ASSET.test(req.nextUrl.pathname) ? NextResponse.next() : notFound(req);
  if (isEmbed) return embedHost ? notFound(req) : embed(req);
  if (PUBLIC.test(req.nextUrl.pathname)) return NextResponse.next();
  return withSession(req as Parameters<typeof withSession>[0], event as never);
}

/** The client lookup for /embed/stocktake: frame-ancestors on the response, the result forwarded to the page. */
async function embed(req: NextRequest) {
  const headers = new Headers(req.headers);
  // Never trust a client-sent copy.
  headers.delete(EMBED_CONFIG_HEADER);
  if (req.nextUrl.pathname !== "/embed/stocktake") return NextResponse.next({ request: { headers } });
  const lookup = await lookupEmbedClient(req.nextUrl.searchParams.get("client_id") ?? "", req.nextUrl.origin);
  headers.set(EMBED_CONFIG_HEADER, encodeURIComponent(JSON.stringify(lookup)));
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", `frame-ancestors ${frameAncestors(lookup.ok ? lookup.config : null)}`);
  return res;
}

// No route lives under /_not-found, so the app's not-found page renders, with a 404.
const notFound = (req: NextRequest) => NextResponse.rewrite(new URL("/_not-found", req.url), { status: 404 });

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon\\.svg|apple-icon\\.png).*)"],
};
