'use client';

import { useSyncExternalStore } from 'react';
import { claimPrint } from '@/app/admin/_actions/printing';
import { PRINTED_MESSAGE } from '@/components/admin/print/print-on-load';
import { readJson, writeJson } from '@/lib/browser-storage';

// "Print on this device" is a per-device switch (localStorage), so only the tablet or
// computer next to the printer prints, even if the board is open on several devices.
const DEVICE_KEY = 'bp-print-device';
const CHANGE_EVENT = 'bp-print-device-change';

export function isPrintDevice(): boolean {
  return readJson<boolean>(DEVICE_KEY, false);
}

export function setPrintDevice(on: boolean) {
  writeJson(DEVICE_KEY, on);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function usePrintDevice(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener(CHANGE_EVENT, onChange);
      window.addEventListener('storage', onChange);
      return () => {
        window.removeEventListener(CHANGE_EVENT, onChange);
        window.removeEventListener('storage', onChange);
      };
    },
    isPrintDevice,
    () => false,
  );
}

// One print dialog at a time: tickets queue up (e.g. KOT and bill in quick succession).
let queue: Promise<unknown> = Promise.resolve();

/** Loads the ticket page in a hidden frame, which opens the print dialog itself. */
export function printUrl(url: string): Promise<void> {
  const job = queue.then(
    () =>
      new Promise<void>((resolve) => {
        const frame = document.createElement('iframe');
        frame.title = 'Printing';
        frame.setAttribute('aria-hidden', 'true');
        frame.tabIndex = -1;
        frame.style.cssText =
          'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
        const cleanup = () => {
          window.removeEventListener('message', onMessage);
          clearTimeout(timer);
          frame.remove();
          resolve();
        };
        const onMessage = (e: MessageEvent) => {
          if (
            e.origin === window.location.origin &&
            e.source === frame.contentWindow &&
            (e.data as { type?: string })?.type === PRINTED_MESSAGE
          )
            cleanup();
        };
        // Safety net: never leave a frame behind if the dialog is closed oddly.
        const timer = setTimeout(cleanup, 120_000);
        window.addEventListener('message', onMessage);
        frame.src = url;
        document.body.appendChild(frame);
      }),
  );
  queue = job.catch(() => undefined);
  return job;
}

export type PrintOutcome = 'printed' | 'already-printed' | { error: string };

/**
 * Prints a ticket for a real order. `auto` = triggered by a status change: prints only on
 * a print device, and only if nobody has printed this ticket yet. `round` = which KOT
 * round (a table's later dishes print as their own KOT).
 */
export async function printTicket(
  orderId: string,
  kind: 'kot' | 'bill',
  { auto = false, round = 1 }: { auto?: boolean; round?: number } = {},
): Promise<PrintOutcome> {
  if (auto && !isPrintDevice()) return 'already-printed';
  const claim = await claimPrint(orderId, kind, auto, round);
  if (!claim.ok) return { error: claim.error };
  if (claim.copy === null) return 'already-printed';
  const roundParam = kind === 'kot' ? `&round=${round}` : '';
  await printUrl(`/admin/print/${orderId}/${kind}?copy=${claim.copy}${roundParam}&print=1`);
  return 'printed';
}
