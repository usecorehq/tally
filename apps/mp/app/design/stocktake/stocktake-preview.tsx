"use client";

import { useEffect, useRef, useState } from "react";
import { PickView, Working, type Photo } from "../../stocktake/stocktake-flow";
import { Outcome, ReviewTable } from "../../stocktake/review-table";
import type { Variant } from "./variants";
import { DETECTIONS, OUTCOME, OUTCOME_WARN, RESULT, STEPS, drawShelf } from "./fixtures";

const BUSINESSES = [
  { id: "b1", name: "Mama Nkechi Provisions" },
  { id: "b2", name: "Lekki Mini Mart" },
];
const noop = () => undefined;

/** Renders the real stock-take components on fixtures; nothing here calls a server action. */
export function StocktakePreview({ variant }: { variant: Variant }) {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [startedAt] = useState(() => Date.now() - 48_000);
  const [businessId, setBusinessId] = useState("b1");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let url = "";
    drawShelf().then((blob) => {
      url = URL.createObjectURL(blob);
      setPhoto({ blob, url, width: 1600, height: 1000 });
    });
    return () => URL.revokeObjectURL(url);
  }, []);

  if (variant === "pick" || variant === "pick-photo") {
    return (
      <PickView
        businesses={BUSINESSES}
        businessId={businessId}
        onBusiness={setBusinessId}
        error={null}
        preparing={false}
        photo={variant === "pick-photo" ? photo : null}
        fileRef={fileRef}
        onFile={noop}
        onAgent={noop}
        onQuick={noop}
      />
    );
  }

  if (variant === "outcome" || variant === "outcome-warn") {
    return (
      <Outcome businessName={BUSINESSES[0]!.name} result={variant === "outcome" ? OUTCOME : OUTCOME_WARN} rows={DETECTIONS} onRestart={noop} />
    );
  }

  if (!photo) return <p className="text-sm text-gray-500">Drawing the fixture photo…</p>;

  if (variant.startsWith("working")) {
    const mode = variant === "working-quick" ? "quick" : "agent";
    const steps = variant === "working-agent" ? STEPS : [];
    return <Working photo={photo} phase={{ name: "working", mode, steps, startedAt }} businessName={BUSINESSES[0]!.name} />;
  }

  return (
    <ReviewTable
      businessId="b1"
      businessName={BUSINESSES[0]!.name}
      result={RESULT}
      fallback={variant === "review-fallback"}
      photo={photo.blob}
      photoUrl={photo.url}
      onRestart={noop}
      confirm={async () => {
        await new Promise((r) => setTimeout(r, 1200));
        return { ok: true, data: OUTCOME };
      }}
    />
  );
}
