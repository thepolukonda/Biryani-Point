/** Small inline icon set (stroke icons, 24px grid). Decorative by default. */
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Stroke({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const PlusIcon = (p: IconProps) => (
  <Stroke strokeWidth="2.6" {...p}>
    <path d="M12 5v14M5 12h14" />
  </Stroke>
);
export const MinusIcon = (p: IconProps) => (
  <Stroke strokeWidth="2.6" {...p}>
    <path d="M5 12h14" />
  </Stroke>
);
export const CloseIcon = (p: IconProps) => (
  <Stroke strokeWidth="2.4" {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Stroke>
);
export const BagIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M6 7h12l1 13H5L6 7Z" />
    <path d="M9 7a3 3 0 0 1 6 0" />
  </Stroke>
);
export const SearchIcon = (p: IconProps) => (
  <Stroke {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Stroke>
);
export const ClockIcon = (p: IconProps) => (
  <Stroke {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Stroke>
);
export const PinIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21Z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </Stroke>
);
export const PhoneIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
  </Stroke>
);
export const MailIcon = (p: IconProps) => (
  <Stroke {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </Stroke>
);
export const StarIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false" {...p}>
    <path d="m12 2 3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21l1.4-7L2 9.3l7-.8z" />
  </svg>
);
export const ArrowRightIcon = (p: IconProps) => (
  <Stroke strokeWidth="2.4" {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Stroke>
);
export const ArrowLeftIcon = (p: IconProps) => (
  <Stroke strokeWidth="2.4" {...p}>
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </Stroke>
);
export const CheckIcon = (p: IconProps) => (
  <Stroke strokeWidth="2.6" {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Stroke>
);
export const MenuIcon = (p: IconProps) => (
  <Stroke strokeWidth="2.2" {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Stroke>
);
export const TruckIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" />
    <circle cx="7" cy="18" r="2" />
    <circle cx="17" cy="18" r="2" />
  </Stroke>
);
export const StoreIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M4 10v10h16V10M3 10l2-6h14l2 6H3Z" />
    <path d="M10 20v-5h4v5" />
  </Stroke>
);
export const ShareIcon = (p: IconProps) => (
  <Stroke {...p}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
  </Stroke>
);
export const PencilIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
  </Stroke>
);
export const TrashIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </Stroke>
);
export const LocateIcon = (p: IconProps) => (
  <Stroke {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </Stroke>
);
export const LeafIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M5 19c8 0 14-6 14-15-9 0-15 6-15 14" />
    <path d="M5 19c2-5 5-8 9-10" />
  </Stroke>
);
export const FlameIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M12 21a6 6 0 0 0 6-6c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-3 5-3 8a6 6 0 0 0 6 6Z" />
  </Stroke>
);
export const PauseIcon = (p: IconProps) => (
  <Stroke strokeWidth="2.4" {...p}>
    <path d="M9 5v14M15 5v14" />
  </Stroke>
);
export const PlayIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false" {...p}>
    <path d="M8 5v14l11-7L8 5Z" />
  </svg>
);

export function WhatsAppIcon(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false" {...p}>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  );
}
