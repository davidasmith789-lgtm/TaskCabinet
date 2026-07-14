import { useId } from "react";

export default function GlowDocketLogo({ className = "", decorative = false, label = "GlowDocket logo" }) {
  const gradientId = `glowdocket-gradient-${useId().replace(/:/g, "")}`;

  return (
    <svg
      className={`glowdocket-logo ${className}`.trim()}
      viewBox="0 0 120 120"
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? "true" : undefined}
      aria-label={decorative ? undefined : label}
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="22" y1="24" x2="101" y2="103" gradientUnits="userSpaceOnUse">
          <stop className="glowdocket-logo-gradient-start" offset="0" />
          <stop className="glowdocket-logo-gradient-end" offset="1" />
        </linearGradient>
        <filter id={`${gradientId}-glow`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <rect className="glowdocket-logo-background" x="2" y="2" width="116" height="116" rx="24" />
      <path className="glowdocket-logo-speed-line" d="M13 86h27M9 96h35M18 106h29" />
      <path
        fill={`url(#${gradientId})`}
        d="M51 20c-23 0-39 17-39 40s16 39 39 39h18V61H49a7 7 0 0 0 0 14h5v10h-3c-15 0-25-10-25-25s10-26 25-26h31c8 0 13-4 16-11-4-2-9-3-16-3H51Z"
      />
      <path
        fill={`url(#${gradientId})`}
        d="M61 54h22c19 0 31 13 31 31 0 19-12 31-31 31H61V54Zm15 15v32h7c10 0 16-6 16-16s-6-16-16-16h-7Z"
      />
      <path className="glowdocket-logo-star-glow" filter={`url(#${gradientId}-glow)`} d="m92 13 4 12 12 4-12 4-4 12-4-12-12-4 12-4 4-12Z" />
      <path className="glowdocket-logo-star" d="m92 13 4 12 12 4-12 4-4 12-4-12-12-4 12-4 4-12Z" />
    </svg>
  );
}
