import type { CSSProperties } from "react";

/** A line's thumbnail: a data URL or crop URL, or CSS that shows its square of the stored photo. */
export type Thumb = string | CSSProperties;

/** Fills its square box with the thumbnail; nothing when there is none or the image fails. */
export function ThumbImage({ thumb }: { thumb: Thumb | undefined }) {
  if (!thumb) return null;
  if (typeof thumb !== "string") return <div aria-hidden className="h-full w-full" style={thumb} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a data URL cut from the photo, or a short-lived crop link
    <img src={thumb} alt="" className="h-full w-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
  );
}
