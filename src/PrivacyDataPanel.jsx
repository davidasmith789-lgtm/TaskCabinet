import { useEffect, useId, useRef } from "react";

export function PrivacyDataPanel({ analyticsEnabled, onAnalyticsChange, statusMessage = "" }) {
  const analyticsId = useId();
  return (
    <div className="privacy-data-panel">
      <div className="privacy-data-summary">
        <article><strong>On this device</strong><p>Assignments, preferences, layouts, and attachment files are primarily kept in this browser. Removing this site’s browser data can remove that local information.</p></article>
        <article><strong>Optional cloud account</strong><p>When you use a cloud account, supported planner data syncs through GlowDocket’s account service. Attachments, notification permission, and reminder connections remain device-specific.</p></article>
        <article><strong>No advertising tracking</strong><p>GlowDocket does not use a marketing or advertising-tracking category.</p></article>
      </div>
      <label className="settings-toggle settings-toggle-copy privacy-analytics-toggle" htmlFor={analyticsId}>
        <span><strong>Usage analytics</strong><small>Allow Vercel Analytics and Speed Insights to measure site usage and performance. These tools stay unloaded while this is off.</small></span>
        <input id={analyticsId} type="checkbox" checked={analyticsEnabled} onChange={(event) => onAnalyticsChange(event.target.checked)} />
      </label>
      <p className="hint-text">This choice applies only to this browser. It is not included in profile sync or planner exports, and you can change it here at any time.</p>
      <div className="privacy-preference-status" role="status" aria-live="polite">{statusMessage}</div>
    </div>
  );
}

export function PrivacyDataDialog({ open, onClose, analyticsEnabled, onAnalyticsChange, statusMessage }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const trigger = document.activeElement;
    const dialog = dialogRef.current;
    const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
    window.requestAnimationFrame(() => dialog?.querySelector("[data-dialog-initial-focus]")?.focus());
    const handleKeyDown = (event) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab" || !dialog) return;
      const controls = [...dialog.querySelectorAll(focusableSelector)].filter((control) => control.getClientRects().length > 0);
      if (controls.length === 0) { event.preventDefault(); dialog.focus(); return; }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.requestAnimationFrame(() => trigger?.focus?.());
    };
  }, [onClose, open]);

  if (!open) return null;
  return (
    <div className="modal-backdrop privacy-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="edit-modal privacy-dialog" role="dialog" aria-modal="true" aria-labelledby="privacy-dialog-title" tabIndex="-1">
        <header className="edit-modal-header">
          <div><p className="eyebrow">Your choice</p><h2 id="privacy-dialog-title" tabIndex="-1" data-dialog-initial-focus>Privacy &amp; Data</h2></div>
          <button type="button" className="modal-close-button" onClick={onClose} aria-label="Close Privacy and Data">×</button>
        </header>
        <p className="privacy-dialog-intro">A concise explanation of where GlowDocket keeps data and the optional measurement you control.</p>
        <PrivacyDataPanel analyticsEnabled={analyticsEnabled} onAnalyticsChange={onAnalyticsChange} statusMessage={statusMessage} />
      </section>
    </div>
  );
}
