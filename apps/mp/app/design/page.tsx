import { notFound } from "next/navigation";
import { KitPreview } from "./kit-preview";

export const metadata = { title: "Design V2 · Tally" };

/** The @tally/ui V2 kit on one page, for review. Not served in production. */
export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <KitPreview />;
}
