import { useEffect, useState } from "react";
import { applyServiceWorkerUpdate, reloadForServiceWorkerUpdate, SERVICE_WORKER_UPDATE_EVENT } from "./serviceWorkerUpdates.js";
import "./ServiceWorkerUpdatePrompt.css";

export default function ServiceWorkerUpdatePrompt() {
  const [updateState, setUpdateState] = useState("");

  useEffect(() => {
    const handleUpdate = (event) => setUpdateState(event.detail?.state || "available");
    window.addEventListener(SERVICE_WORKER_UPDATE_EVENT, handleUpdate);
    return () => window.removeEventListener(SERVICE_WORKER_UPDATE_EVENT, handleUpdate);
  }, []);

  if (!updateState) return null;
  const reloadReady = updateState === "reload-ready";
  const activating = updateState === "activating";
  const handleUpdate = () => {
    if (reloadReady) { reloadForServiceWorkerUpdate(); return; }
    if (applyServiceWorkerUpdate()) setUpdateState("activating");
  };

  return (
    <aside className="service-worker-update" role="status" aria-live="polite" aria-label="GlowDocket update available">
      <div><strong>{reloadReady ? "GlowDocket was updated" : "A GlowDocket update is ready"}</strong><small>{reloadReady ? "Reload to use the newest version." : "Finish any open edits, then update when you’re ready."}</small></div>
      <button type="button" className="service-worker-update-primary" disabled={activating} onClick={handleUpdate}>{activating ? "Updating…" : reloadReady ? "Reload" : "Update"}</button>
      {!activating && <button type="button" className="service-worker-update-later" onClick={() => setUpdateState("")} aria-label="Dismiss update message">Later</button>}
    </aside>
  );
}
