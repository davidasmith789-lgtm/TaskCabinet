export const PRIVACY_PREFERENCES_STORAGE_KEY = "glowdocket_privacy_preferences_v1";

const DEFAULT_PRIVACY_PREFERENCES = Object.freeze({ version: 1, analyticsEnabled: false });

export function readPrivacyPreferences(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(PRIVACY_PREFERENCES_STORAGE_KEY) || "null");
    if (parsed?.version !== 1 || typeof parsed.analyticsEnabled !== "boolean") return { ...DEFAULT_PRIVACY_PREFERENCES };
    return { version: 1, analyticsEnabled: parsed.analyticsEnabled };
  } catch {
    return { ...DEFAULT_PRIVACY_PREFERENCES };
  }
}

export function writePrivacyPreferences(storage, analyticsEnabled) {
  const preferences = { version: 1, analyticsEnabled: analyticsEnabled === true };
  storage.setItem(PRIVACY_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  return preferences;
}
