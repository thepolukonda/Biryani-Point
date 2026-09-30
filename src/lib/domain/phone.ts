/**
 * Georgian phone numbers. Accepts what people actually type:
 *   "555 12 34 56", "+995 555 123 456", "995555123456", "0555123456", "(555) 12-34-56"
 * and returns E.164 ("+995555123456"), or null.
 *
 * Georgian numbers are 9 digits after +995. Mobiles start with 5; Batumi
 * landlines start with 422. Other area codes start with 3 or 4.
 */
export function normaliseGeorgianPhone(input: string): string | null {
  let digits = input.replace(/[\s().-]/g, '');
  if (!/^\+?\d+$/.test(digits)) return null;
  digits = digits.replace(/^\+/, '');

  if (digits.startsWith('995')) digits = digits.slice(3);
  else if (digits.startsWith('00995')) digits = digits.slice(5);
  else if (digits.length === 10 && digits.startsWith('0')) digits = digits.slice(1);

  if (!/^[345]\d{8}$/.test(digits)) return null;
  return `+995${digits}`;
}

/**
 * A customer's number: Georgian (any way it's typed, see above) or, for visitors with a
 * foreign SIM, an international number written with + or 00 and its country code.
 * Returns E.164 ("+995555123456", "+79991234567"), or null.
 */
export function normaliseCustomerPhone(input: string): string | null {
  const georgian = normaliseGeorgianPhone(input);
  if (georgian) return georgian;
  const compact = input.replace(/[\s().-]/g, '');
  const m = /^(?:\+|00)([1-9]\d{7,14})$/.exec(compact);
  // +995 numbers that failed the Georgian check are wrong, not foreign.
  return m && !m[1]!.startsWith('995') ? `+${m[1]}` : null;
}

/** "+995555123456" -> "+995 555 12 34 56" */
export function formatGeorgianPhone(e164: string): string {
  const d = e164.replace(/^\+995/, '');
  if (d.length !== 9) return e164;
  return `+995 ${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 7)} ${d.slice(7)}`;
}
