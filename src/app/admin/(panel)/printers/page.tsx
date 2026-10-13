import type { Metadata } from 'next';
import { PrinterSettingsForm, ThisDeviceCard } from '@/views/admin/printers/printer-forms';
import { Card } from '@/views/admin/ui';
import { printersPage } from '@/controllers/admin/pages';

export const metadata: Metadata = { title: 'Printers' };
export const dynamic = 'force-dynamic';

export default async function PrintersPage() {
  const { print, isOwner } = await printersPage();
  const preview = (kind: 'kot' | 'bill') => (
    <iframe
      // Reloads after saving, so the preview always matches the settings.
      key={`${kind}-${print.updated_at}`}
      src={`/admin/print/sample/${kind}?embed=1`}
      title={kind === 'kot' ? 'KOT preview' : 'Bill preview'}
      className="bg-soft-2 h-[880px] w-full rounded-xl"
    />
  );

  return (
    <div className="grid gap-5">
      <h1 className="text-2xl font-extrabold">Printers</h1>
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="grid content-start gap-5">
          <ThisDeviceCard />
          <PrinterSettingsForm print={print} canEdit={isOwner} />
        </div>
        <Card
          title="Preview"
          description="A sample order with the current settings. Business details come from Settings → Bill details."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {preview('kot')}
            {preview('bill')}
          </div>
        </Card>
      </div>
      <Card title="Setting up the printer (once)">
        <ol className="grid list-decimal gap-2 pl-5 text-[15px]">
          <li>
            Connect the receipt printer (USB, network or Bluetooth) to the kitchen tablet or
            computer and install its driver. Print the printer&apos;s own test page to check it
            works.
          </li>
          <li>
            Open this page on that device, turn on <b>Auto-printing on this device</b> and press{' '}
            <b>Print a test KOT</b>.
          </li>
          <li>
            In Windows, open <b>Settings → Bluetooth &amp; devices → Printers</b>, choose the
            receipt printer → <b>Printing preferences</b> and set the paper to the{' '}
            <b>{print.paper_width_mm} mm roll</b> (called e.g. “Roll Paper {print.paper_width_mm} ×
            297 mm”, “{print.paper_width_mm} × Receipt” or “{print.paper_width_mm}mm”). If it says
            A4 or Letter, the ticket comes out tiny on a full page.
          </li>
          <li>
            In the print dialog choose the <b>receipt printer</b> as the destination (not “Save as
            PDF” or the office printer). Under <b>More settings</b>: margins <b>None</b>, scale{' '}
            <b>Default</b>, and turn <b>off</b> “Headers and footers”. The browser remembers this
            for next time.
          </li>
          <li>
            <b>Print without the dialog (recommended for the kitchen):</b> in Google Chrome on
            Windows, make the receipt printer the default printer, then start Chrome with{' '}
            <code className="bg-soft rounded px-1">--kiosk-printing</code> added to its shortcut
            (right-click the Chrome shortcut → Properties → Target). Tickets then print straight
            away.
          </li>
          <li>
            Keep the <b>Orders</b> page open on the printing device during service. The KOT prints
            when an order is accepted (on any device), and the bill when it is ready or out for
            delivery. Reprints are marked <b>REPRINT</b> / <b>COPY</b> so nobody cooks an order
            twice.
          </li>
        </ol>
      </Card>
    </div>
  );
}
