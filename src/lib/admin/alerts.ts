'use client';

/** New-order alerts for the kitchen: a chime (generated, no audio file) and a browser notification. */

let context: AudioContext | null = null;

/** Must be called from a click once, so the browser allows sound. */
export async function unlockAudio(): Promise<boolean> {
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') await context.resume();
    return context.state === 'running';
  } catch {
    return false;
  }
}

export function playChime(): void {
  if (!context || context.state !== 'running') return;
  const now = context.currentTime;
  // Two bright notes, loud enough for a busy kitchen.
  [880, 1318.5, 880, 1318.5].forEach((frequency, i) => {
    const osc = context!.createOscillator();
    const gain = context!.createGain();
    osc.type = 'triangle';
    osc.frequency.value = frequency;
    const start = now + i * 0.22;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.6, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
    osc.connect(gain).connect(context!.destination);
    osc.start(start);
    osc.stop(start + 0.21);
  });
}

export async function requestNotifications(): Promise<NotificationPermission | 'unsupported'> {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'default') return Notification.requestPermission();
  return Notification.permission;
}

export function notify(title: string, body: string): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, tag: title, requireInteraction: true });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // Some mobile browsers only allow notifications from a service worker.
  }
}
