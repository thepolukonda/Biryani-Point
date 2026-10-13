/** External links: WhatsApp, maps. */

export function whatsappUrl(number: string, text?: string): string {
  const digits = number.replace(/\D/g, '');
  return text
    ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${digits}`;
}

export function directionsUrl(location: { lat: number; lng: number }): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`;
}

export function mapPinUrl(location: { lat: number; lng: number }): string {
  return `https://maps.google.com/?q=${location.lat.toFixed(6)},${location.lng.toFixed(6)}`;
}

/** OpenStreetMap embed: no API key, no cookies. */
export function osmEmbedUrl(location: { lat: number; lng: number }, span = 0.006): string {
  const bbox = [
    location.lng - span,
    location.lat - span / 2,
    location.lng + span,
    location.lat + span / 2,
  ]
    .map((n) => n.toFixed(5))
    .join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${location.lat},${location.lng}`;
}

export function osmUrl(location: { lat: number; lng: number }): string {
  return `https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lng}#map=17/${location.lat}/${location.lng}`;
}
