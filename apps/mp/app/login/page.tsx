import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { Button } from "@tally/ui";
import { signIn } from "@/auth";

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
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-2xl font-semibold">Sign in to Tally</h1>
      <p className="mt-2 text-sm text-neutral-600">Use your Qorelly merchant account.</p>
      {error && <p className="mt-4 text-sm text-red-600">Email or password is incorrect.</p>}
      <form action={login} className="mt-6 flex flex-col gap-3">
        <input name="email" type="email" required placeholder="Email" className="rounded-full border px-4 py-2" />
        <input name="password" type="password" required placeholder="Password" className="rounded-full border px-4 py-2" />
        <Button type="submit">Sign in</Button>
      </form>
    </main>
  );
}
