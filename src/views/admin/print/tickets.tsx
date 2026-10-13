import QRCode from 'qrcode';
import { pickText, type I18nText, type Locale } from '@/shared/domain/i18n-text';
import { formatGel } from '@/shared/domain/money';
import { formatGeorgianPhone } from '@/shared/domain/phone';
import { BILL_LABELS, KOT_LABELS } from '@/shared/print/labels';
import { orderLabel } from '@/shared/orders/format';
import type { TicketContext } from '@/model-helpers/printing/ticket-data';
import { profileText } from '@/shared/domain/restaurant';

// Server components only: the QR code and all formatting happen before the page reaches
// the kitchen tablet, so printing needs no extra JavaScript.

/** Times in the restaurant's time zone, whatever the printing device is set to. */
function formatters(timeZone: string) {
  const time = (iso: string) =>
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(iso));
  const date = (iso: string) =>
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(iso));
  return { time, date, dateTime: (iso: string) => `${date(iso)} ${time(iso)}` };
}
const addMinutes = (iso: string, m: number) =>
  new Date(new Date(iso).getTime() + m * 60_000).toISOString();

export function billLocale(ctx: TicketContext): Locale {
  const l = ctx.print.bill_language;
  return l === 'customer' ? ctx.order.customerLocale : (l as Locale);
}

function Row({
  left,
  right,
  strong,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className={strong ? 'tk-row tk-b' : 'tk-row'}>
      <span>{left}</span>
      <span className="tk-num tk-r">{right}</span>
    </div>
  );
}

export async function Bill({
  ctx,
  copyNo,
  printedAt,
}: {
  ctx: TicketContext;
  copyNo: number;
  printedAt: string;
}) {
  const { order, print, restaurant } = ctx;
  const { dateTime } = formatters(restaurant.timezone);
  const lang = billLocale(ctx);
  const t = BILL_LABELS[lang];
  const brand = profileText(restaurant.profile, lang);
  // e.g. "Andhra & South Indian kitchen · Batumi"
  const tagline = [brand.tagline, brand.city].filter(Boolean).join(' · ');
  const money = (tetri: number) => formatGel(tetri, lang);
  const count = order.items.reduce((s, i) => s + i.quantity, 0);
  const reprint = copyNo > 1;
  const payLabel =
    order.paymentMethod === 'online'
      ? t.online
      : order.paymentMethod === 'card'
        ? t.cardPay
        : order.counter
          ? t.cashPay
          : order.type === 'delivery'
            ? t.cash
            : t.payAtPickup;
  const typeLabel =
    order.type === 'dine_in'
      ? `${t.table} ${order.tableLabel ?? ''}`.trim()
      : order.type === 'delivery'
        ? t.delivery
        : order.counter
          ? t.takeaway
          : t.pickup;
  // Prices include VAT. Shown only for VAT-registered businesses (18% in Georgia).
  const vat = print.vat_registered ? Math.round((order.totalTetri * 18) / 118) : 0;
  const footer = pickText(print.bill_footer as I18nText, lang);
  // The tracking page is for website orders; the counter hands the food over in person.
  const qr =
    print.bill_show_qr && !order.counter
      ? await QRCode.toString(order.trackingUrl, {
          type: 'svg',
          margin: 0,
          errorCorrectionLevel: 'M',
        })
      : null;

  return (
    <article className="tk tk-bill" lang={lang}>
      <header className="tk-c">
        <div className="tk-brand">{restaurant.profile.brandName.toUpperCase()}</div>
        {tagline && <div className="tk-tag">{tagline}</div>}
        {print.legal_address && <div className="tk-small">{print.legal_address}</div>}
        {restaurant.phone && (
          <div className="tk-small tk-num">{formatGeorgianPhone(restaurant.phone)}</div>
        )}
        {(print.legal_name || print.tax_id) && (
          <div className="tk-small">
            {print.legal_name}
            {print.legal_name && print.tax_id && ' · '}
            {print.tax_id && `${t.taxId} ${print.tax_id}`}
          </div>
        )}
      </header>
      <hr className="tk-solid" />
      <div className="tk-title">
        {t.bill}
        {reprint && ` · ${t.copy}`}
      </div>
      <div className="tk-meta">
        <Row
          left={t.billNo}
          right={<b>{orderLabel(restaurant.profile.orderPrefix, order.number)}</b>}
        />
        <Row left={t.date} right={dateTime(order.createdAt)} />
        <Row left={t.type} right={<b>{typeLabel}</b>} />
        {!order.counter && (
          <Row left={t.time} right={order.scheduledFor ? dateTime(order.scheduledFor) : t.asap} />
        )}
        {order.customerName && <Row left={t.customer} right={order.customerName} />}
        {print.bill_show_phone && order.customerPhone && (
          <Row left={t.phone} right={formatGeorgianPhone(order.customerPhone)} />
        )}
        {order.type === 'delivery' && (
          <Row left={t.address} right={order.addressText ?? (order.hasPin ? t.pin : '—')} />
        )}
      </div>
      <hr />
      <div className="tk-row tk-small">
        <span>{t.item}</span>
        <span>{t.amount}</span>
      </div>
      <div className="tk-items">
        {order.items.map((item, i) => (
          <div key={i} className="tk-line">
            <Row
              left={`${item.quantity} × ${pickText(item.name, lang)}`}
              right={money(item.lineTotalTetri)}
            />
            {item.quantity > 1 && (
              <div className="tk-opt tk-num">
                {item.quantity} × {money(item.unitTetri)}
              </div>
            )}
            {item.modifiers.map((m, j) => (
              <div key={j} className="tk-opt">
                + {pickText(m, lang)}
              </div>
            ))}
            {item.notes && <div className="tk-opt">“{item.notes}”</div>}
          </div>
        ))}
      </div>
      <hr />
      <Row left={`${t.subtotal} (${t.items(count)})`} right={money(order.subtotalTetri)} />
      {order.type === 'delivery' && (
        <Row
          left={t.deliveryFee}
          right={order.deliveryFeeTetri ? money(order.deliveryFeeTetri) : t.free}
        />
      )}
      {order.discountTetri > 0 && (
        <Row left={t.discount} right={`−${money(order.discountTetri)}`} />
      )}
      <hr className="tk-solid" />
      <div className="tk-row tk-total">
        <span>{t.total}</span>
        <span className="tk-num">{money(order.totalTetri)}</span>
      </div>
      {vat > 0 && <Row left={t.vat} right={money(vat)} />}
      <div className="tk-due">
        <span>{order.paid ? t.paid : t.toPay}</span>
        <span className="tk-num">{money(order.totalTetri)}</span>
      </div>
      <div className="tk-c tk-small tk-gap">{payLabel}</div>
      {qr && (
        <>
          <hr />
          <div className="tk-qr" dangerouslySetInnerHTML={{ __html: qr }} />
          <div className="tk-c tk-small">{t.track}</div>
        </>
      )}
      <hr />
      <div className="tk-c tk-b">{t.thanks}</div>
      {footer && <div className="tk-c tk-small tk-gap">{footer}</div>}
      {restaurant.googleReviewUrl && <div className="tk-c tk-small tk-gap">{t.review}</div>}
      <div className="tk-c tk-small tk-gap">{t.fiscal}</div>
      <div className="tk-c tk-small tk-gap tk-num">
        {reprint && `${t.copy} · `}
        {dateTime(printedAt)}
      </div>
    </article>
  );
}

export function Kot({
  ctx,
  copyNo,
  printedAt,
  round,
}: {
  ctx: TicketContext;
  copyNo: number;
  printedAt: string;
  /** Only the dishes of this KOT round (a table's later dishes). Omitted = all dishes. */
  round?: number;
}) {
  const { order: full, print } = ctx;
  const order = round ? { ...full, items: full.items.filter((i) => i.kotRound === round) } : full;
  const { time, date } = formatters(ctx.restaurant.timezone);
  const lang = print.kot_language as Locale;
  const t = KOT_LABELS[lang];
  const count = order.items.reduce((s, i) => s + i.quantity, 0);
  const reprint = copyNo > 1;
  const accepted = order.acceptedAt ?? printedAt;
  const prep = order.prepMinutes ?? 0;
  const readyBy = order.estimatedReadyAt ?? addMinutes(accepted, prep);

  return (
    <article className="tk tk-kot" lang={lang}>
      <header className="tk-kot-head">
        <div className="tk-kot-no">#{order.number}</div>
        <div className="tk-kot-type">
          {order.type === 'dine_in'
            ? `${t.table} ${order.tableLabel ?? ''}`.trim()
            : order.type === 'delivery'
              ? t.delivery
              : order.counter
                ? t.takeaway
                : t.pickup}
        </div>
      </header>
      {round && round > 1 && <div className="tk-flag">{t.round(round)}</div>}
      {order.scheduledFor ? (
        <>
          <div className="tk-kot-when">{t.scheduled(time(order.scheduledFor))}</div>
          <div className="tk-small">
            {prep > 0 && `${t.startBy(time(addMinutes(order.scheduledFor, -prep)))} · `}
            {date(order.scheduledFor)}
          </div>
        </>
      ) : (
        <>
          <div className="tk-kot-when">{t.readyBy(time(readyBy))}</div>
          <div className="tk-small">{t.asapLine(time(accepted), prep)}</div>
        </>
      )}
      {reprint && <div className="tk-flag">{t.reprint}</div>}
      <hr className="tk-solid" />
      {order.items.map((item, i) => (
        <div key={i} className="tk-kot-item">
          <div className="tk-kot-q">{item.quantity}×</div>
          <div className="tk-kot-n">
            {pickText(item.name, lang)}
            {item.veg && <span className="tk-veg">{t.veg}</span>}
          </div>
          {item.modifiers.map((m, j) => (
            <div key={j} className="tk-kot-mod">
              » {pickText(m, lang)}
            </div>
          ))}
          {item.notes && <div className="tk-kot-inote">{item.notes}</div>}
        </div>
      ))}
      <hr className="tk-solid" />
      <Row left={t.items} right={count} strong />
      {order.notes && (
        <div className="tk-kot-note">
          <span className="tk-kot-lbl">{t.note}</span> {order.notes}
        </div>
      )}
      <hr />
      <div className="tk-meta">
        {order.customerName && (
          <Row
            left={t.customer}
            right={`${order.customerName.split(' ')[0]}${order.customerLocale !== lang ? ` · ${t.speaks[order.customerLocale]}` : ''}`}
          />
        )}
        {order.type === 'delivery' && order.distanceKm !== null && (
          <Row left={t.distance} right={`${order.distanceKm} km`} />
        )}
        <Row
          left={t.ticket}
          right={`K-${order.number}${round && round > 1 ? `.${round}` : ''}-${copyNo}`}
        />
        <Row left={t.printed} right={`${time(printedAt)}${reprint ? ` (${t.reprinted})` : ''}`} />
      </div>
    </article>
  );
}
