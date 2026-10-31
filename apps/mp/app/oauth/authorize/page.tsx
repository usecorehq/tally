import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { ApiError, api, errorMessage } from "@/lib/api";
import { PKCE_CHALLENGE, authorizePath, clientRedirect, parseAuthorizeParams, type AuthorizeInfo } from "../_lib/authorize";
import { ConsentError, ConsentFlow, ConsentLoadFailed } from "./consent-screens";

export const dynamic = "force-dynamic";
export const metadata = { title: "Connect to Tally" };

const BAD_CLIENT = {
  title: "This app can't connect to Tally",
  body: "The link that brought you here isn't registered with Tally, so we won't send you back to it.",
};

/** /oauth/authorize (contracts §7): validate, sign in, choose a business, then Allow or Cancel. */
export default async function AuthorizePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const p = parseAuthorizeParams(query);
  const self = authorizePath(query);

  // Without a client and a redirect_uri there is nowhere safe to send an error.
  if (!p.clientId || !p.redirectUri) return <ConsentError display={p.display} {...BAD_CLIENT} />;

  // Here as well as in proxy.ts, so the full query survives sign-in whatever the proxy does.
  const session = await auth();
  const toLogin = `/login?callbackUrl=${encodeURIComponent(self)}`;
  if (!session?.accessToken || session.error === "RefreshFailed") redirect(toLogin);

  let info: AuthorizeInfo | null = null;
  let oauthError: string | null = null;
  try {
    const qs = new URLSearchParams({ client_id: p.clientId, redirect_uri: p.redirectUri, scope: p.scope });
    info = await api<AuthorizeInfo>(`/clients/v1/oauth/authorize-info?${qs}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect(toLogin);
    if (err instanceof ApiError && err.code === "invalid_client") return <ConsentError display={p.display} {...BAD_CLIENT} />;
    if (err instanceof ApiError && err.status === 400 && err.code) oauthError = err.code;
    else return <ConsentLoadFailed display={p.display} />;
  }
  // From here the client and its redirect_uri are known good, so errors go back to the app.
  if (oauthError) redirect(clientRedirect(p.redirectUri, { error: oauthError }, p.state));
  if (p.responseType !== "code") redirect(clientRedirect(p.redirectUri, { error: "unsupported_response_type" }, p.state));
  if (!PKCE_CHALLENGE.test(p.codeChallenge) || p.codeChallengeMethod !== "S256") {
    redirect(clientRedirect(p.redirectUri, { error: "invalid_request", error_description: "PKCE with S256 is required" }, p.state));
  }
  if (!info) return <ConsentLoadFailed display={p.display} />;

  // Inline actions: Next encrypts the closed-over params, so a posted form can't swap the redirect_uri.
  async function allow(businessId: string): Promise<{ error: string } | void> {
    "use server";
    let code: string;
    try {
      ({ code } = await api<{ code: string; expires_in: number }>("/clients/v1/oauth/codes", {
        method: "POST",
        json: {
          client_id: p.clientId,
          redirect_uri: p.redirectUri,
          scope: p.scope,
          business_id: businessId,
          code_challenge: p.codeChallenge,
          code_challenge_method: "S256",
        },
      }));
    } catch (err) {
      if (err instanceof ApiError && err.code === "not_owner") return { error: "Only the business owner can connect apps to it." };
      return { error: errorMessage(err) };
    }
    redirect(clientRedirect(p.redirectUri, { code }, p.state));
  }

  async function deny() {
    "use server";
    redirect(clientRedirect(p.redirectUri, { error: "access_denied" }, p.state));
  }

  async function switchAccount() {
    "use server";
    await signOut({ redirectTo: toLogin });
  }

  return (
    <ConsentFlow
      display={p.display}
      account={session.user?.name || session.user?.email || "your account"}
      client={info.client}
      scopes={info.scopes}
      businesses={info.businesses}
      newBusinessHref={`/businesses/new?returnTo=${encodeURIComponent(self)}`}
      actions={{ allow, deny, switchAccount }}
    />
  );
}
