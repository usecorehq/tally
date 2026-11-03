# @tally/landing

Tally's public landing page: a static Vite + React + Tailwind 4 site, styled with `@tally/ui`'s Qorelly Design V2 theme and the Ciscela serif for headings (PRD §9).

```sh
pnpm --filter @tally/landing dev      # http://localhost:3002
pnpm --filter @tally/landing build    # typecheck + static build to dist/
```

| Env | Required | |
|---|---|---|
| `VITE_WAITLIST_URL` | no | Where "Join the waitlist" goes (a form or `mailto:`). Unset: the page says the waitlist opens soon and shows no button. |

The page is light only, whatever the device is set to.

Layout: `src/App.tsx` (sections and the header), `src/scan-demo.tsx` (the hero's looping phone demo: snap, scan, confirm, stock updated; holds on the review under reduced motion), `src/hand-count.tsx` (where a hand count goes wrong: each step and cost drawn as an inline SVG line illustration, isometric where it helps; the dashes and dots stop under reduced motion), `src/works-on.tsx` (Built for how Nigerian shops stock: a notched photo panel whose tabs swap the shop photo in `public/works/` and the card of what Tally found; rotates until a tab is picked, still under reduced motion), `src/powered.tsx` (Muse Spark, SAM 3.1 and Qore Catalog in the order a photo meets them, then you confirm), `src/meta-mark.tsx` (Meta's symbol, path from Simple Icons; swap in the official file from Meta's brand resources before launch), `src/reveal.ts` (scroll reveals: mark an element `data-reveal`, stagger it with `delay(ms)`; styles in `index.css`, opacity-only under reduced motion), `src/scroll-reveal.tsx` (the pinned problem paragraph that lights up word by word as you scroll), `src/how-showcase.tsx` (How it works: four sticky rows that stack as you scroll, each with a looping panel of product stickers over a blurred shop photo; no stacking motion or loops under reduced motion), `public/how/` (blurred backgrounds `bg*.jpg` and the product photos used as stickers), `public/cta/` (`shopkeeper.jpg`, the closing call-to-action photo, resized to 2200 px), `public/hero/` (`shop.mp4` background video, 1280 px H.264 without audio, its `shop-poster.jpg`, and `shelf.jpg`, the shelf photo the demo scans), `public/fonts/Ciscela-Regular.woff2` (from Qorelly's portal).

Re-encode the background video from a new source with:

```sh
ffmpeg -i source.mov -an -vf "scale=1280:-2,fps=25" -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 27 -preset slow -movflags +faststart public/hero/shop.mp4
```
