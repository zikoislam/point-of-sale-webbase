'use client';

import { useBranding } from '../hooks/useBranding';

/**
 * LED-style scrolling marquee.
 *
 *  - <ScrollingBanner />                       → scrolls the shop name that is
 *    set in Settings for the ACTIVE organization (per-org branding).
 *  - <ScrollingBanner message="WELCOME TO…" /> → scrolls a fixed message
 *    (used on the public welcome page).
 */
export function ScrollingBanner({
  message,
  slim = false,
}: {
  message?: string;
  slim?: boolean;
}) {
  const branding = useBranding();
  const text = (message ?? branding.shopName ?? 'BDBBC ERP').toUpperCase();

  const chunk = (hidden: boolean) => (
    <div className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {Array.from({ length: 6 }).map((_, i) => (
        <span
          key={i}
          className={`mx-6 whitespace-nowrap font-bold uppercase tracking-[0.3em] text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.65)] ${
            slim ? 'text-xs' : 'text-sm md:text-base'
          }`}
        >
          {message ? `★ ${text} ` : `★ ${text} `}
          <span className="text-cyan-300">— WELCOME —</span>
        </span>
      ))}
    </div>
  );

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-amber-400/30 bg-slate-950/90 shadow-[inset_0_0_30px_rgba(251,191,36,0.06)] ${
        slim ? 'py-2' : 'py-4'
      }`}
    >
      <style>{`@keyframes bdbbc-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
      <div className="flex w-max" style={{ animation: 'bdbbc-marquee 30s linear infinite' }}>
        {chunk(false)}
        {chunk(true)}
      </div>
    </div>
  );
}
