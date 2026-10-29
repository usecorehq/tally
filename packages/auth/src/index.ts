/**
 * NextAuth (Auth.js v5) in front of the shared Qorelly Supabase Auth: the Supabase access_token rides in the
 * NextAuth JWT so server code can call apps/api as a Bearer. NextAuth owns the cookie; Supabase owns identity.
 */
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { createClient } from "@supabase/supabase-js";

declare module "next-auth" {
  interface Session {
    accessToken: string;
    error?: "RefreshFailed";
  }
  interface User {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    error?: "RefreshFailed";
  }
}

function supabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Refresh a minute early so a request never leaves with a token about to expire.
const REFRESH_SKEW_S = 60;

export function createTallyAuth(overrides: Partial<NextAuthConfig> = {}) {
  return NextAuth({
    session: { strategy: "jwt" },
    pages: { signIn: "/login" },
    providers: [
      Credentials({
        credentials: { email: {}, password: {} },
        async authorize(credentials) {
          const email = String(credentials?.email ?? "");
          const password = String(credentials?.password ?? "");
          if (!email || !password) return null;

          const { data, error } = await supabase().auth.signInWithPassword({ email, password });
          if (error || !data.session) return null;

          return {
            id: data.user.id,
            email: data.user.email,
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            expiresAt: data.session.expires_at ?? 0,
          };
        },
      }),
    ],
    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          return {
            ...token,
            sub: user.id,
            accessToken: user.accessToken,
            refreshToken: user.refreshToken,
            expiresAt: user.expiresAt,
          };
        }
        if (Date.now() / 1000 < token.expiresAt - REFRESH_SKEW_S) return token;

        const { data, error } = await supabase().auth.refreshSession({
          refresh_token: token.refreshToken,
        });
        if (error || !data.session) return { ...token, error: "RefreshFailed" as const };
        return {
          ...token,
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresAt: data.session.expires_at ?? 0,
          error: undefined,
        };
      },
      async session({ session, token }) {
        session.user.id = token.sub!;
        session.accessToken = token.accessToken;
        session.error = token.error;
        return session;
      },
    },
    ...overrides,
  });
}
