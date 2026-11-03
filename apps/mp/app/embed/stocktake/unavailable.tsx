"use client";

import { useEffect } from "react";
import { SolarIcon, Tray, TraySheet } from "@tally/ui";
import { envelope, type ErrorCode } from "./protocol";

/** The static error inside the frame; tells the host why when it knows who the host is. */
export function EmbedUnavailable({
  title,
  body,
  instance,
  parentOrigin,
  code,
}: {
  title: string;
  body: string;
  instance?: string;
  parentOrigin?: string;
  code?: ErrorCode;
}) {
  useEffect(() => {
    if (!instance || !parentOrigin || !code || window.parent === window) return;
    window.parent.postMessage(envelope(instance, { type: "error", payload: { code, message: `${title}. ${body}` } }), parentOrigin);
  }, [instance, parentOrigin, code, title, body]);

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-6">
      <Tray className="mx-auto max-w-[560px]">
        <TraySheet role="alert" className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <span className="mb-1 flex size-10 items-center justify-center rounded-full bg-red-50 text-red-600">
            <SolarIcon name="Danger-Circle" iconStyle="Outline" size={20} />
          </span>
          <p className="font-medium tracking-tight text-gray-900">{title}</p>
          <p className="max-w-sm break-words text-sm text-gray-500">{body}</p>
        </TraySheet>
      </Tray>
    </div>
  );
}
