/**
 * Tally logo reveal and loader. CSS only, so it works in server components and loading.tsx.
 * variant "reveal" draws the mark once (~1.9 s) and holds; "loop" keeps counting while you wait.
 */
const CSS = `.tl{display:inline-flex;align-items:center;gap:calc(var(--tl-size)*.28);--tl-size:56px}
.tl svg{width:var(--tl-size);height:var(--tl-size);overflow:visible;display:block}
.tl .tl-tile{transform-box:fill-box;transform-origin:center}
.tl .tl-c,.tl .tl-s,.tl .tl-x{fill:none;stroke:var(--tl-glyph,#171717);stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1 2}
.tl .tl-c{stroke-width:36}.tl .tl-s,.tl .tl-x{stroke-width:34}
.tl .tl-cg{transform-box:view-box;transform-origin:256px 256px}
.tl-word{font:800 calc(var(--tl-size)*.62)/1 Inter,ui-sans-serif,system-ui,sans-serif;letter-spacing:-.03em;color:var(--tl-ink,#171717)}
.tl-word small{display:block;font-size:.3em;font-weight:600;letter-spacing:0;color:var(--tl-sub,#737373);margin-top:.35em}

/* reveal: plays once and holds */
.tl--reveal .tl-tile{animation:tl-pop .5s cubic-bezier(.23,1,.32,1) both,tl-bump .32s 1.55s cubic-bezier(.23,1,.32,1)}
.tl--reveal .tl-c{animation:tl-draw .36s cubic-bezier(.23,1,.32,1) both}
.tl--reveal .tl-c1{animation-delay:.28s}.tl--reveal .tl-c2{animation-delay:.33s}.tl--reveal .tl-c3{animation-delay:.38s}.tl--reveal .tl-c4{animation-delay:.43s}
.tl--reveal .tl-s{animation:tl-draw .22s cubic-bezier(.33,1,.68,1) both}
.tl--reveal .tl-s1{animation-delay:.72s}.tl--reveal .tl-s2{animation-delay:.84s}.tl--reveal .tl-s3{animation-delay:.96s}.tl--reveal .tl-s4{animation-delay:1.08s}
.tl--reveal .tl-x{animation:tl-draw .3s 1.24s cubic-bezier(.33,1,.68,1) both}
.tl--reveal .tl-word{animation:tl-word .5s 1.3s cubic-bezier(.23,1,.32,1) both}

/* loop: tile and viewfinder stay, the count draws, strikes and resets */
.tl--loop .tl-c{stroke-dashoffset:0}
.tl--loop .tl-cg{animation:tl-focus 2.4s cubic-bezier(.23,1,.32,1) infinite}
.tl--loop .tl-s,.tl--loop .tl-x{animation:tl-count 2.4s cubic-bezier(.33,1,.68,1) infinite}
.tl--loop .tl-s1{animation-delay:0s}.tl--loop .tl-s2{animation-delay:.12s}.tl--loop .tl-s3{animation-delay:.24s}.tl--loop .tl-s4{animation-delay:.36s}
.tl--loop .tl-x{animation-name:tl-strike}

@keyframes tl-pop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}
@keyframes tl-bump{50%{transform:scale(1.06)}}
@keyframes tl-draw{0%{opacity:0;stroke-dashoffset:1}1%{opacity:1}100%{opacity:1;stroke-dashoffset:0}}
@keyframes tl-word{from{opacity:0;transform:translateX(-.25em)}to{opacity:1;transform:none}}
@keyframes tl-count{0%{opacity:0;stroke-dashoffset:1}1%{opacity:1;stroke-dashoffset:1}10%{stroke-dashoffset:0}72%{opacity:1;stroke-dashoffset:0}84%,100%{opacity:0;stroke-dashoffset:0}}
@keyframes tl-strike{0%,22%{opacity:0;stroke-dashoffset:1}23%{opacity:1;stroke-dashoffset:1}34%{stroke-dashoffset:0}72%{opacity:1;stroke-dashoffset:0}84%,100%{opacity:0;stroke-dashoffset:0}}
@keyframes tl-focus{0%,30%{transform:scale(1)}38%{transform:scale(.93)}48%,100%{transform:scale(1)}}

@media (prefers-reduced-motion:reduce){
  .tl *{animation:none!important;opacity:1!important;stroke-dashoffset:0!important}
}`;

type Props = {
  variant?: "reveal" | "loop";
  /** Mark size in px. */
  size?: number;
  /** Show "Tally / by Qorelly" beside the mark. */
  wordmark?: boolean;
  /** Tile and stroke colours; defaults to sunflower #F9D644 with ink #171717. */
  tile?: string;
  glyph?: string;
  label?: string;
  className?: string;
};

export function TallyLoader({ variant = "loop", size = 56, wordmark = false, tile, glyph, label = "Loading Tally", className }: Props) {
  const style = { "--tl-size": `${size}px`, ...(tile && { "--tl-tile": tile }), ...(glyph && { "--tl-glyph": glyph }) } as React.CSSProperties;
  return (
    <span role="status" aria-label={label} className={`tl tl--${variant}${className ? ` ${className}` : ""}`} style={style}>
      <style href="tally-loader" precedence="default">{CSS}</style>
      <svg viewBox="0 0 512 512" aria-hidden>
        <rect className="tl-tile" width="512" height="512" rx="112" fill="var(--tl-tile, #F9D644)" /><g className="tl-cg"><path className="tl-c tl-c1" d="M92 172L92 92L172 92" pathLength="1" /><path className="tl-c tl-c2" d="M340 92L420 92L420 172" pathLength="1" /><path className="tl-c tl-c3" d="M92 340L92 420L172 420" pathLength="1" /><path className="tl-c tl-c4" d="M340 420L420 420L420 340" pathLength="1" /></g><line className="tl-s tl-s1" x1="175" y1="170" x2="175" y2="342" pathLength="1" /><line className="tl-s tl-s2" x1="229" y1="170" x2="229" y2="342" pathLength="1" /><line className="tl-s tl-s3" x1="283" y1="170" x2="283" y2="342" pathLength="1" /><line className="tl-s tl-s4" x1="337" y1="170" x2="337" y2="342" pathLength="1" /><line className="tl-x" x1="142.6" y1="307.6" x2="369.4" y2="204.4" pathLength="1" />
      </svg>
      {wordmark && (
        <span className="tl-word" aria-hidden>
          Tally<small>by Qorelly</small>
        </span>
      )}
    </span>
  );
}

/** Full-screen splash for app boot or route loading. */
export function TallyLoaderScreen({ label = "Loading Tally" }: { label?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <TallyLoader variant="loop" size={64} label={label} />
    </div>
  );
}
