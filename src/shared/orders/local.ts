/**
 * Details the customer typed at checkout, kept only on their own device so the
 * tracking page can offer the full WhatsApp message. The public tracking data
 * never contains a phone number or address.
 */
export type LocalOrderDetails = {
  name: string;
  phone: string;
  addressText: string | null;
  location: { lat: number; lng: number } | null;
  notes: string | null;
};

export const localDetailsKey = (publicId: string) => `bp-order-${publicId}`;
