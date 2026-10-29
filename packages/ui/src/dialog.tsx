"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "./button";
import { cn } from "./lib/cn";
import { CloseButton } from "./v2-kit";

/*
 * V2 dialog: a tray (title and buttons on grey, content on one white sheet), 24px corners,
 * a 40% blurred overlay and a bare × on a grey disc.
 */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  title,
  description,
  footer,
  children,
  className,
  sheetClassName,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Buttons on the grey, primary last. */
  footer?: React.ReactNode;
  /** The white sheet's content; leave empty for a title-and-buttons confirm. */
  children?: React.ReactNode;
  className?: string;
  sheetClassName?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="q-fade-in fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        className={cn(
          "q-pop fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-[24px] bg-gray-100 p-2 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.35)] ring-1 ring-hairline/5 outline-none",
          className,
        )}
      >
        <div className="flex items-start gap-3 px-3 pb-3 pt-2.5">
          <div className="min-w-0 flex-1">
            <DialogPrimitive.Title className="text-[17px] font-medium leading-tight tracking-tight text-gray-900">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-[13px] leading-5 text-gray-500">{description}</DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{typeof title === "string" ? title : "Dialog"}</DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close asChild>
            <CloseButton />
          </DialogPrimitive.Close>
        </div>
        {children != null && (
          <div className={cn("min-h-0 overflow-y-auto rounded-[20px] bg-surface p-5 ring-1 ring-hairline/[0.04]", sheetClassName)}>{children}</div>
        )}
        {footer && <div className="flex flex-col-reverse gap-2 px-1 pb-1 pt-2 sm:flex-row sm:justify-end">{footer}</div>}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/**
 * Confirm, then close. Stays open (busy) while `onConfirm` runs and when it
 * throws, so the caller can show the failure where the merchant is looking.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  destructive = false,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  destructive?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void | Promise<void>;
  children?: React.ReactNode;
}) {
  const [busy, setBusy] = React.useState(false);
  async function confirm() {
    try {
      setBusy(true);
      await onConfirm?.();
      onOpenChange(false);
    } catch {
      // Left open on purpose: the caller reports the failure.
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent
        title={title}
        description={description}
        className="max-w-sm"
        footer={
          <>
            <Button variant="quiet" size="lg" onClick={() => onOpenChange(false)} disabled={busy}>
              {cancelLabel}
            </Button>
            <Button variant={destructive ? "destructive" : "primary"} size="lg" onClick={confirm} disabled={busy}>
              {busy ? "Working…" : confirmLabel}
            </Button>
          </>
        }
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}
