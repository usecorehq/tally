import { createTallyAuth } from "@tally/auth";

export const { handlers, auth, signIn, signOut } = createTallyAuth();
