interface LogoProps {
  className?: string;
}

/** Clementine — botanical line art. A clementine on a branch with leaves. */
export function ClementineLogo({ className = 'w-6 h-6' }: LogoProps) {
  return (
    <svg viewBox="0 0 40 48" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Branch — gentle curve */}
      <path
        d="M6 1 C10 4, 15 8, 18 12 C19 14, 20 16, 20 18"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none"
      />
      {/* Leaf 1 — larger, drooping left */}
      <path
        d="M10 5 C6 2, 2 4, 3 8 C4 12, 9 10, 10 5Z"
        stroke="currentColor" strokeWidth="0.9" fill="currentColor" fillOpacity="0.08"
      />
      <path d="M10 5 C7 6, 4 7, 3 8" stroke="currentColor" strokeWidth="0.5" fill="none" />
      <path d="M8 5.5 C6.5 6.5, 5 7.5, 4.5 9" stroke="currentColor" strokeWidth="0.3" fill="none" />
      <path d="M9 6.5 C8 7, 6.5 8, 5.5 10" stroke="currentColor" strokeWidth="0.3" fill="none" />
      {/* Leaf 2 — upper right */}
      <path
        d="M15 8 C18 4, 23 4, 22 9 C21 13, 16 11, 15 8Z"
        stroke="currentColor" strokeWidth="0.9" fill="currentColor" fillOpacity="0.08"
      />
      <path d="M15 8 C18 8, 21 7, 22 9" stroke="currentColor" strokeWidth="0.5" fill="none" />
      <path d="M17 7.5 C18.5 8, 20 8.5, 21 9.5" stroke="currentColor" strokeWidth="0.3" fill="none" />
      <path d="M16 9 C17.5 9, 19.5 9, 20.5 10" stroke="currentColor" strokeWidth="0.3" fill="none" />
      {/* Leaf 3 — small, near fruit */}
      <path
        d="M23 14 C26 12, 28 14, 26 17 C24 19, 22 16, 23 14Z"
        stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.08"
      />
      <path d="M23 14 C25 14, 27 14.5, 26 17" stroke="currentColor" strokeWidth="0.4" fill="none" />
      {/* Fruit */}
      <circle cx="20" cy="30" r="11.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
      {/* Stem */}
      <path d="M20 18 L20 18.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      {/* Subtle calyx (star shape at top of fruit) */}
      <path d="M18 19.5 L20 18.5 L22 19.5" stroke="currentColor" strokeWidth="0.6" fill="none" strokeLinecap="round" />
      {/* Segment curves */}
      <path d="M20 18.5 C18 25, 13 32, 11 39" stroke="currentColor" strokeWidth="0.35" opacity="0.4" fill="none" />
      <path d="M20 18.5 C22 25, 27 32, 29 39" stroke="currentColor" strokeWidth="0.35" opacity="0.4" fill="none" />
      <path d="M20 18.5 C20 26, 20 34, 20 41.5" stroke="currentColor" strokeWidth="0.35" opacity="0.4" fill="none" />
    </svg>
  );
}

/** App logo — intertwined rings with a heart */
export function AppLogo({ className = 'w-6 h-6' }: LogoProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Left ring */}
      <circle cx="12" cy="16" r="9" stroke="#EC4899" strokeWidth="2" />
      {/* Right ring */}
      <circle cx="20" cy="16" r="9" stroke="#F9A8D4" strokeWidth="2" />
      {/* Heart at center */}
      <path
        d="M16 14 C16 12.5, 14.2 11.5, 13.2 12.8 C12.2 14, 16 17.5, 16 17.5 C16 17.5, 19.8 14, 18.8 12.8 C17.8 11.5, 16 12.5, 16 14Z"
        fill="#EC4899"
      />
    </svg>
  );
}
