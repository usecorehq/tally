"use client";

import { Button, SolarIcon } from "@tally/ui";
import { useEffect, useLayoutEffect, useState } from "react";
import { applyStoredTheme } from "../_components/theme-toggle";
import { HandCount } from "./hand-count";
import { HowShowcase } from "./how-showcase";
import { MetaMark } from "./meta-mark";
import { Powered } from "./powered";
import { ScanDemo } from "./scan-demo";
import { ScrollReveal } from "./scroll-reveal";
import { delay, useReveals } from "./reveal";
import { WorksOn } from "./works-on";
import "./landing.css";

// No waitlist form yet: no dead button, the page says the waitlist opens soon.
const WAITLIST_URL: string | undefined = undefined;

// Only links that exist: page sections, and the waitlist once it's live. Sister products are named, not linked.
const FOOTER: { title: string; links: { label: string; href?: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "The problem", href: "#problem" },
      { label: "How it works", href: "#how" },
      { label: "What it reads", href: "#works-on" },
      { label: "Powered by", href: "#powered" },
    ],
  },
  {
    title: "Get Tally",
    links: [WAITLIST_URL ? { label: "Join the waitlist", href: WAITLIST_URL } : { label: "Waitlist opens soon" }, { label: "Phone and web", href: "#get-tally" }],
  },
  { title: "Family", links: [{ label: "Qorelly" }, { label: "Qore Catalog" }, { label: "Qore Maps" }] },
];

function WaitlistButton({ size = "lg" }: { size?: "lg" | "xl" }) {
  if (!WAITLIST_URL) return null;
  return (
    <Button asChild size={size}>
      <a href={WAITLIST_URL}>
        Join the waitlist
        <SolarIcon name="Arrow-Right" size={18} />
      </a>
    </Button>
  );
}

/** The Tally logo: a tally mark in a viewfinder. Decorative beside the "Tally" wordmark. */
function TallyMark({ className = "h-9 w-9" }: { className?: string }) {
  return <img src="/landing/logo.svg" alt="" aria-hidden className={`shrink-0 ${className}`} />;
}

const NAV = [
  { href: "#problem", label: "The problem" },
  { href: "#how", label: "How it works" },
  { href: "#works-on", label: "What it reads" },
  { href: "#powered", label: "Powered by" },
];

/** Clear with white text over the hero video, a white bar once the page scrolls past it. */
function SiteHeader() {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header
      className={`sticky top-0 z-30 transition-colors duration-300 ${
        solid ? "border-b border-gray-100 bg-surface/90 text-gray-900 backdrop-blur-md" : "border-b border-white/10 bg-transparent text-white"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-8">
        <TallyMark className={`h-9 w-9 transition ${solid ? "" : "brightness-0 invert"}`} />
        <span className="text-[17px] font-semibold tracking-tight">Tally</span>
        <nav aria-label="Sections" className={`ml-6 hidden gap-1 text-sm md:flex ${solid ? "text-gray-600" : "text-white/80"}`}>
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className={`rounded-lg px-3 py-2 transition-colors ${solid ? "hover:bg-gray-100 hover:text-gray-900" : "hover:bg-white/10 hover:text-white"}`}
            >
              {n.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <a
            href="/login"
            className={`rounded-lg px-3 py-2 text-sm transition-colors ${solid ? "text-gray-600 hover:bg-gray-100 hover:text-gray-900" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
          >
            Sign in
          </a>
          <Button
            asChild
            size="md"
            variant="quiet"
            className={solid ? "" : "bg-white/10 text-white ring-white/25 shadow-none backdrop-blur-md hover:bg-white/20"}
          >
            <a href="#get-tally">Get Tally</a>
          </Button>
        </div>
      </div>
    </header>
  );
}

/** Light only, whatever the portal theme is: undone when you leave for the app. */
function useLightPage() {
  useLayoutEffect(() => {
    const html = document.documentElement;
    html.classList.remove("dark");
    html.style.scrollBehavior = "smooth";
    return () => {
      html.style.scrollBehavior = "";
      applyStoredTheme();
    };
  }, []);
}

/** The marketing page, shown at / to signed-out visitors. */
export function Landing() {
  useLightPage();
  useReveals();
  return (
    <div className="min-h-dvh bg-surface text-gray-900">
      {/* Drops a stored dark theme before first paint; useLightPage keeps it off after hydration. */}
      <script dangerouslySetInnerHTML={{ __html: 'document.documentElement.classList.remove("dark")' }} />
      <SiteHeader />

      <main>
        <section className="relative isolate -mt-16 flex min-h-[calc(100dvh-2rem)] items-center overflow-hidden bg-gray-950 pt-16">
          <video
            className="hero-video absolute inset-0 -z-20 h-full w-full object-cover object-[30%_center]"
            src="/landing/hero/shop.mp4"
            poster="/landing/hero/shop-poster.jpg"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden
          />
          {/* Darken the left for the headline and the foot for the next section; the shop stays visible in between. */}
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/55 to-black/35" />
          <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-black/60 to-transparent" />

          <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 sm:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:py-24">
            <div className="text-white">
              <span className="q-rise mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-medium text-white ring-1 ring-white/20 backdrop-blur-md">
                <MetaMark white className="h-4 w-auto" />
                Powered by Muse
              </span>
              <h1 className="q-rise font-display text-[46px] [animation-delay:70ms] [animation-duration:500ms] leading-[1.02] tracking-tight sm:text-7xl">
                Snap a shelf.
                <br />
                Get your stock count.
              </h1>
              <p className="q-rise mt-6 max-w-xl text-lg leading-relaxed text-white/80 [animation-delay:160ms] [animation-duration:500ms]">
                Tally reads every product in one photo, counts the units and matches each one to Qore Catalog's Nigerian
                products. You check it, then it's in your stock.
              </p>
              <div className="q-rise mt-9 flex flex-wrap items-center gap-3 [animation-delay:240ms] [animation-duration:500ms]">
                <WaitlistButton size="xl" />
                <Button asChild size="xl" variant="quiet" className="bg-white text-gray-950 ring-0 hover:bg-white/90">
                  <a href="#how">See how it works</a>
                </Button>
              </div>
              <p className="q-fade-in mt-6 text-sm text-white/60 [animation-delay:420ms] [animation-duration:600ms]">No more counting tins by hand. No more guessing what ran out.</p>
            </div>
            <div className="q-pop [animation-delay:200ms] [animation-duration:700ms]">
              <ScanDemo />
            </div>
          </div>
        </section>

        <section id="problem" className="scroll-mt-16">
          <ScrollReveal />
        </section>

        <HandCount />

        <HowShowcase />

        <WorksOn />

        <Powered />

        <section id="get-tally" className="scroll-mt-20 px-4 py-24 sm:px-8">
          <div data-reveal="clip" className="relative isolate mx-auto flex min-h-[680px] max-w-6xl overflow-hidden rounded-[32px] bg-gray-950 sm:min-h-[560px]">
            <img
              src="/landing/cta/shopkeeper.jpg"
              alt="A smiling shop assistant in an apron, arms folded, in front of a fresh produce wall"
              loading="lazy"
              className="absolute inset-x-0 top-0 -z-20 h-[62%] w-full object-cover object-[62%_15%] sm:inset-y-0 sm:left-auto sm:right-[-14%] sm:h-full sm:w-[118%] sm:max-w-none sm:object-[50%_30%]"
            />
            {/* Dark at the text: below the photo on phones, the left on wider screens. */}
            <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,var(--color-gray-950)_42%,transparent_66%)] sm:bg-[linear-gradient(to_right,rgb(0_0_0/0.82),rgb(0_0_0/0.45)_45%,transparent_70%)]" />

            <div className="flex w-full flex-col justify-end p-6 sm:max-w-xl sm:justify-center sm:p-12 lg:p-16">
              <p data-reveal style={delay(250)} className="mb-5 inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-medium text-white ring-1 ring-white/20 backdrop-blur-md">
                <span className="size-1.5 rounded-[2px] bg-primary" />
                Works with your Qorelly account
              </p>
              <h2 data-reveal style={delay(330)} className="font-display text-[40px] leading-[1.05] tracking-tight text-white sm:text-6xl">Count your next shelf with Tally</h2>
              <p data-reveal style={delay(410)} className="mt-4 max-w-md text-base leading-relaxed text-white/80 sm:text-lg">
                Join the waitlist and we'll tell you when your shop can start. One photo, and the count is done.
              </p>
              <div data-reveal style={delay(490)} className="mt-8 flex flex-wrap items-center gap-3">
                {WAITLIST_URL ? (
                  <WaitlistButton size="xl" />
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-[15px] font-medium text-gray-950">
                    <span className="size-1.5 animate-pulse rounded-[2px] bg-primary" />
                    The waitlist opens soon
                  </span>
                )}
                <Button asChild size="xl" variant="quiet" className="bg-white/10 text-white ring-white/25 shadow-none backdrop-blur-md hover:bg-white/20">
                  <a href="#how">See how it works</a>
                </Button>
              </div>
            </div>

            {/* What she just did: the end of the flow from the hero demo. */}
            <div data-reveal="pop" style={delay(700)} className="absolute right-6 top-6 hidden w-[260px] rounded-[20px] bg-white/90 p-3.5 shadow-[0_24px_50px_-20px_rgba(0,0,0,0.55)] ring-1 ring-white/60 backdrop-blur-xl md:block lg:right-12 lg:top-auto lg:bottom-12">
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <SolarIcon name="Check-Circle" iconStyle="Fill" size={22} />
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold tracking-tight text-gray-900">Stock updated</p>
                  <p className="text-[12px] text-gray-500">5 products from one photo</p>
                </div>
              </div>
              <div className="mt-3 flex gap-1.5">
                {["/landing/how/tin.jpg", "/landing/how/cheese.jpg", "/landing/how/honey.jpg", "/landing/how/tea.jpg"].map((src) => (
                  <img key={src} src={src} alt="" className="size-9 rounded-[10px] object-cover ring-1 ring-black/5" />
                ))}
                <span className="flex size-9 items-center justify-center rounded-[10px] bg-gray-100 text-[11px] font-medium tabular-nums text-gray-600">+1</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-20 sm:px-8">
          <div className="grid gap-14 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <div data-reveal>
              <a href="#" className="inline-flex items-center gap-2.5">
                <TallyMark className="h-8 w-8" />
                <span className="text-[19px] font-semibold tracking-tight text-gray-900">Tally</span>
              </a>
              <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-gray-500">
                Photo-to-inventory for Nigerian shops. A sister product to Qorelly.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
              {FOOTER.map((col, i) => (
                <div key={col.title} data-reveal style={delay(80 + i * 80)}>
                  <p className="font-mono text-[13px] uppercase tracking-[0.12em] text-gray-400">{col.title}</p>
                  <ul className="mt-5 space-y-3.5">
                    {col.links.map((l) => (
                      <li key={l.label} className="text-[16px] text-gray-900">
                        {l.href ? (
                          <a href={l.href} className="transition-colors hover:text-primary">
                            {l.label}
                          </a>
                        ) : (
                          <span className="text-gray-500">{l.label}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-20 text-sm text-gray-500">
            <span>© {new Date().getFullYear()} Core Technologies LTD. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
