const injected = import.meta.env?.VITE_GLOWDOCKET_BUILD_METADATA;

const cleanText = (value, fallback) => {
  const text = String(value || "").trim();
  return text ? text.slice(0, 160) : fallback;
};

export const APP_BUILD_METADATA = Object.freeze({
  appVersion: cleanText(injected?.appVersion, "0.0.0"),
  commitSha: cleanText(injected?.commitSha, "unavailable"),
  environment: cleanText(injected?.environment, import.meta.env?.MODE || "unknown"),
  buildTimestamp: cleanText(injected?.buildTimestamp, "unavailable"),
  sourceState: injected?.sourceState === "dirty" ? "dirty" : "clean",
});

export function getBuildFingerprint(metadata = APP_BUILD_METADATA) {
  const shortSha = metadata.commitSha === "unavailable" ? "unavailable" : metadata.commitSha.slice(0, 12);
  return `GlowDocket v${metadata.appVersion} · ${shortSha}${metadata.sourceState === "dirty" ? "-dirty" : ""} · ${metadata.environment}`;
}

export function createReportMetadata(createdAt = new Date().toISOString(), dataSchemaVersion = null) {
  return {
    app: "GlowDocket",
    appVersion: APP_BUILD_METADATA.appVersion,
    commitSha: APP_BUILD_METADATA.commitSha,
    environment: APP_BUILD_METADATA.environment,
    buildTimestamp: APP_BUILD_METADATA.buildTimestamp,
    sourceState: APP_BUILD_METADATA.sourceState,
    createdAt,
    ...(dataSchemaVersion === null ? {} : { dataSchemaVersion: Number(dataSchemaVersion) }),
  };
}

export function createRuntimeDiagnostics(createdAt = new Date().toISOString()) {
  return {
    _metadata: createReportMetadata(createdAt),
    runtime: {
      online: typeof navigator === "undefined" ? null : navigator.onLine,
      serviceWorkerControlled: typeof navigator === "undefined" ? null : Boolean(navigator.serviceWorker?.controller),
    },
  };
}
