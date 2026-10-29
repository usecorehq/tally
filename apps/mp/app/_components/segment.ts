// Shared classes for the shell's segmented controls. The kit's white thumb vanishes on a dark track,
// so dark mode drops the track to the deepest grey and keeps a hairline on the thumb.

export const SEGMENT_TRACK = "rounded-xl bg-gray-200/60 dark:bg-gray-50 dark:ring-1 dark:ring-hairline/[0.06]";

export const SEGMENT_THUMB = "bg-surface text-gray-900 ring-1 ring-hairline/[0.06] dark:bg-gray-200 dark:ring-hairline/10";

/** A focus ring that shows in light and dark: brand, offset from the control. */
export const FOCUS = "rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-gray-100";
