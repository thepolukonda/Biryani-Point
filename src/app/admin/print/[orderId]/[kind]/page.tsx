import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Bill, Kot } from '@/components/admin/print/tickets';
import { PrintButton, PrintOnLoad } from '@/components/admin/print/print-on-load';
import { requireStaff } from '@/lib/admin/auth';
import { loadTicket, sampleTicket, type TicketKind } from '@/lib/print/ticket-data';
import '../../print.css';

export const metadata: Metadata = { title: 'Print' };
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * /admin/print/<order id>/<kot|bill>?copy=1&print=1
 *   copy   the copy number from claim_print (2+ prints "REPRINT" / "COPY")
 *   round  KOT only: print just the dishes of this round
 *   print  1 = open the print dialog straight away (used by the board's hidden frame)
 * /admin/print/sample/<kind> prints a made-up order (test print, settings preview).
 */
export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string; kind: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaff();
  const [{ orderId, kind }, query] = await Promise.all([params, searchParams]);
  if (kind !== 'kot' && kind !== 'bill') notFound();
  if (orderId !== 'sample' && !UUID.test(orderId)) notFound();

  const ctx = orderId === 'sample' ? await sampleTicket() : await loadTicket(orderId);
  if (!ctx) notFound();

  const copyNo = Math.max(1, Math.min(99, Number(query.copy) || 1));
  // KOT round (dishes added to a table later print on their own ticket).
  const round = Number(query.round) || undefined;
  const autoPrint = query.print === '1';
  const embedded = query.embed === '1';
  const ticketKind = kind as TicketKind;
  const copies = ticketKind === 'kot' ? ctx.print.kot_copies : ctx.print.bill_copies;
  const paper = `${ctx.print.paper_width_mm}mm`;
  const printedAt = new Date().toISOString();
  const Ticket = ticketKind === 'kot' ? Kot : Bill;

  return (
    <div
      className="tk-page"
      style={{
        ['--paper' as string]: paper,
        ...(embedded ? { padding: 0, background: 'transparent' } : {}),
      }}
    >
      {/* Paper width for the print dialog (the length is fitted to the ticket just before
          printing). Margins 0: thermal printers add their own. */}
      <style>{`@page { size: ${paper} 200mm; margin: 0; }`}</style>
      {!embedded && !autoPrint && (
        <div className="tk-screen-only flex justify-center">
          <PrintButton paperMm={ctx.print.paper_width_mm} />
        </div>
      )}
      {Array.from({ length: autoPrint || !embedded ? copies : 1 }, (_, i) => (
        <Ticket key={i} ctx={ctx} copyNo={copyNo} printedAt={printedAt} round={round} />
      ))}
      <PrintOnLoad enabled={autoPrint} paperMm={ctx.print.paper_width_mm} />
    </div>
  );
}
