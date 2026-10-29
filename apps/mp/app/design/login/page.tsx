import { notFound } from "next/navigation";
import LoginPage from "../../login/page";

export const metadata = { title: "Sign-in preview · Tally" };

/** The real sign-in page; `?error=invalid` shows the failed sign-in. Not served in production. */
export default async function LoginPreview({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { error } = await searchParams;
  return <LoginPage searchParams={Promise.resolve({ error })} />;
}
