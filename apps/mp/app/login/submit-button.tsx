"use client";

import { useFormStatus } from "react-dom";
import { Button, QorellyLoader } from "@tally/ui";

/** Sign-in submit: disabled with a spinner while the server checks the password, as Qorelly's login does. */
export function SignInButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="xl" block className="mt-1 disabled:opacity-80" disabled={pending} aria-busy={pending}>
      {pending ? (
        <>
          <QorellyLoader size={18} className="text-current" />
          Signing in…
        </>
      ) : (
        "Sign in"
      )}
    </Button>
  );
}
