import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { Button, FieldLabel, FormMessage, Input, Tray, TraySheet, cn } from "@tally/ui";
import { signIn } from "@/auth";
import { TallyMark } from "../_components/tally-mark";

// The kit field lifts to bg-white on focus, which turns its near-white dark ink invisible.

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl = "/", error } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: callbackUrl,
      });
    } catch (err) {
      if (err instanceof AuthError) redirect("/login?error=invalid");
      throw err;
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gray-100 px-4 py-10">
      <Tray size="lg" className="w-full max-w-[440px] bg-gray-200/60">
        <TraySheet size="lg" className="flex flex-col gap-8 max-sm:p-6">
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="flex items-center gap-2.5">
              <TallyMark />
              <span className="text-[20px] font-semibold tracking-tight text-gray-900">Tally</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-gray-900">Sign in to Tally</h1>
              <p className="text-[15px] text-gray-500">Use your Qorelly merchant account.</p>
            </div>
          </div>

          <form action={login} className="flex flex-col gap-5">
            {error && <FormMessage message="Email or password is incorrect." />}
            <div>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                placeholder="you@business.com"
                aria-invalid={error ? true : undefined}
              />
            </div>
            <div>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                aria-invalid={error ? true : undefined}
              />
            </div>
            <Button type="submit" size="xl" block className="mt-1">
              Sign in
            </Button>
          </form>
        </TraySheet>
      </Tray>
    </main>
  );
}
