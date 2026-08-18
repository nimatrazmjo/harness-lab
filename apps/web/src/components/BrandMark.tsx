export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="brand-mark"
    >
      <rect width="24" height="24" rx="6" fill="#175cd3" />
      <path
        d="M5 13h2.8l1.4-4.5 2.6 9 2-6.5 1 2h4.2"
        stroke="#ffffff"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
