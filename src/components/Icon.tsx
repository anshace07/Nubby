import type { ReactNode } from "react";

/* Hand-picked stroke icons (24×24 grid). Colour follows `currentColor`. */
const P: Record<string, ReactNode> = {
  sidebar: (<><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16" /></>),
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  sun: (<><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></>),
  book: (<><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" /><path d="M5 17a3 3 0 0 1 3-3h11" /></>),
  clock: (<><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>),
  sticky: (<><path d="M5 5h14v9l-5 5H5z" /><path d="M14 19v-5h5" /></>),
  search: (<><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></>),
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  settings: (<><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" /></>),
  help: (<><circle cx="12" cy="12" r="8.5" /><path d="M9.6 9.5a2.5 2.5 0 0 1 4.8 1c0 1.7-2.4 2-2.4 3.5" /><path d="M12 17h.01" /></>),
  plus: <path d="M12 5v14M5 12h14" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  chevronUp: <path d="M6 15l6-6 6 6" />,
  chevronLeft: <path d="M15 6l-6 6 6 6" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  more: (<><circle cx="5.5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="18.5" cy="12" r="1.3" /></>),
  folder: <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />,
  download: (<><path d="M12 4v11M7 10.5l5 5 5-5" /><path d="M5 19.5h14" /></>),
  image: (<><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><circle cx="9" cy="10" r="1.6" /><path d="M20.5 16l-5-5-9 8.5" /></>),
  page: (<><rect x="4" y="3" width="16" height="18" rx="2.5" /><circle cx="9" cy="9" r=".6" /><circle cx="15" cy="9" r=".6" /><circle cx="9" cy="15" r=".6" /><circle cx="15" cy="15" r=".6" /></>),
  highlight: (<><path d="M14.5 4.5l5 5L11 18H6v-5z" /><path d="M4 21h9" /></>),
  bullets: <path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" />,
  numbers: (<><path d="M10 6.5h10M10 12h10M10 17.5h10" /><path d="M4 5.5l1.5-1v4.5M4 10.5h2.2L4 13.6h2.4M4 16h2.3l-1.2 1.5c1 0 1.4.5 1.4 1s-.5 1.2-1.4 1.2H4" /></>),
  checklist: (<><rect x="3.5" y="4.5" width="6" height="6" rx="1.5" /><path d="M5 7.7l1.3 1.3 2-2.2M13 7.5h7.5M13 16.5h7.5" /><rect x="3.5" y="13.5" width="6" height="6" rx="1.5" /></>),
  alignLeft: <path d="M4 6h16M4 10h10M4 14h16M4 18h10" />,
  alignCenter: <path d="M4 6h16M7 10h10M4 14h16M7 18h10" />,
  alignRight: <path d="M4 6h16M10 10h10M4 14h16M10 18h10" />,
  copy: (<><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>),
  front: (<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M15 9V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h4" /></>),
  print: (<><path d="M7 9V3.5h10V9" /><rect x="3.5" y="9" width="17" height="8" rx="2" /><path d="M7 14h10v6.5H7z" /></>),
  link: (<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>),
  undo: (<><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>),
  minimize: <path d="M5 12h14" />,
  restore: (<><rect x="4" y="8" width="12" height="12" rx="1.5" /><path d="M8 8V5.5A1.5 1.5 0 0 1 9.5 4h9A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H16" /></>),
  maximize: <rect x="4.5" y="4.5" width="15" height="15" rx="1.5" />,
  popOut: (<><rect x="3.5" y="7" width="13.5" height="13.5" rx="2.5" /><path d="M13 3.5h7.5V11M20.5 3.5 11.5 12.5" /></>),
  popIn: <path d="M14.5 4H20v5.5M20 4l-6.5 6.5M9.5 20H4v-5.5M4 20l6.5-6.5" />,
  pin: (<><path d="M9.5 3.5h5l-.8 5.3 3.3 3.2v2H7v-2l3.3-3.2z" /><path d="M12 14v6.5" /></>),
  foldUp: (<><path d="M4 4h16v5H4z" /><path d="M12 20v-7M8.5 16.5 12 13l3.5 3.5" /></>),
  foldDown: (<><path d="M4 4h16v5H4z" /><path d="M12 12v7M8.5 15.5 12 19l3.5-3.5" /></>),
  grip: (<><circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" /></>),
};

export function Icon({
  name,
  size = 20,
  stroke = 2,
  className,
  title,
}: {
  name: keyof typeof P | string;
  size?: number;
  stroke?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      {P[name] ?? null}
    </svg>
  );
}

/* ---------- small coloured glyphs used in the toolbar ---------- */

export const HeadingGlyph = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
    <rect x="1.5" y="6.5" width="21" height="11" rx="5.5" fill="#F7E2C7" stroke="#1a1a1a" />
    <path d="M8 9.5l-.8 5M11.5 9.5l-.8 5M6.2 11h6.4M5.9 13h6.4M14.5 12h4.5" stroke="#1a1a1a" />
  </svg>
);

export const TagGlyph = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
    <g transform="rotate(-14 12 12)">
      <path d="M3 12l4.5-5H21v10H7.5z" fill="#2E9E5B" stroke="#1a1a1a" />
      <circle cx="8.5" cy="12" r="1" fill="#ffffff" />
    </g>
  </svg>
);

export const DashedBoxGlyph = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2E9E5B" strokeWidth="2" aria-hidden>
    <rect x="3" y="5" width="18" height="14" rx="4" strokeDasharray="3 2.4" />
  </svg>
);

export const GreyBoxGlyph = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
    <rect x="3" y="5" width="18" height="14" rx="2" fill="#E5E5E5" />
    <path d="M7 10h10M7 14h6" />
  </svg>
);

export const StickyGlyph = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
    <path d="M5 4h14v10l-6 6H5z" fill="#FFE873" />
    <path d="M13 20v-6h6" />
  </svg>
);

export const KidGlyph = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="12.5" r="8.5" fill="#EFB29A" />
    <path d="M5.6 9.5C6 6 8.6 4 12 4s6 2 6.4 5.5C17 8 15 7.5 12 7.5S7 8 5.6 9.5z" fill="#F2A23A" />
    <path d="M5.8 11.2c3.5-1.1 8.9-1.1 12.4 0l-.5 2.5c-1.4 1.1-3.8 1.1-5-.1L12 13l-.7.6c-1.2 1.2-3.6 1.2-5 .1z" fill="#1a1a1a" stroke="none" />
    <path d="M10 17.2c1.3.7 2.7.7 4 0" />
  </svg>
);
