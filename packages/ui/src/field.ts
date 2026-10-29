/**
 * V2 field (v2-kit V2_FIELD): a grey well that lifts to white on focus with a
 * soft 4px ring; red ring when aria-invalid. 16px text on phones so iOS
 * Safari doesn't zoom on focus. h-12 by default; pass a height
 * class for a compact field.
 */
export const FIELD =
  "w-full rounded-[14px] border border-gray-200 bg-gray-50 px-4 text-base text-gray-900 sm:text-[15px] outline-none transition-colors placeholder:text-gray-400 focus:border-gray-300 focus:bg-surface focus:ring-4 focus:ring-gray-900/[0.04] disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-red-300 aria-[invalid=true]:ring-4 aria-[invalid=true]:ring-red-500/10";
