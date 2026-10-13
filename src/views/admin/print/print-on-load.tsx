'use client';

import { useEffect } from 'react';

import { PRINTED_MESSAGE } from '@/shared/print/labels';

// Once per page load, even if React runs the effect twice (development Strict Mode).
let started = false;

const PX_PER_MM = 96 / 25.4;

/**
 * Sizes the printed page to the ticket: the paper width and exactly the ticket's length,
 * so a receipt printer cuts right after it instead of feeding a whole A4 page. CSS can't
 * say "as long as the content" (`size: 80mm auto` is invalid and falls back to A4), so
 * the tallest ticket is measured just before printing.
 */
function fitPageToTicket(paperMm: number) {
  const tallest = Math.max(
    0,
    ...Array.from(document.querySelectorAll<HTMLElement>('.tk'), (el) => el.offsetHeight),
  );
  // A little slack so rounding never spills the last line onto a second page.
  const heightMm = Math.ceil(tallest / PX_PER_MM) + 2;
  let style = document.getElementById('tk-page-size');
  if (!style) {
    style = document.createElement('style');
    style.id = 'tk-page-size';
    // Last in the document, so it overrides the page's fallback @page rule.
    document.body.append(style);
  }
  style.textContent = `@page { size: ${paperMm}mm ${Math.max(heightMm, 40)}mm; margin: 0; }`;
}

async function printTicket(paperMm: number) {
  await document.fonts.ready;
  fitPageToTicket(paperMm);
  window.print();
}

/**
 * Opens the print dialog once fonts are ready, then tells the board (the parent window,
 * which loads this page in a hidden frame) that it can remove the frame.
 */
export function PrintOnLoad({ enabled, paperMm }: { enabled: boolean; paperMm: number }) {
  useEffect(() => {
    if (!enabled || started) return;
    started = true;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (window.parent !== window)
        window.parent.postMessage({ type: PRINTED_MESSAGE }, window.location.origin);
    };
    window.addEventListener('afterprint', finish, { once: true });
    void printTicket(paperMm).then(() => {
      // Some browsers never fire afterprint when printing silently (kiosk mode).
      setTimeout(finish, 1500);
    });
  }, [enabled, paperMm]);
  return null;
}

export function PrintButton({ paperMm }: { paperMm: number }) {
  return (
    <button
      type="button"
      onClick={() => void printTicket(paperMm)}
      className="tk-screen-only bg-ink min-h-12 rounded-full px-6 font-bold text-white"
    >
      Print
    </button>
  );
}
