export const FEEDBACK_CATEGORIES = [
  { value: "", label: "No category" },
  { value: "bug", label: "Bug report" },
  { value: "feature", label: "Feature request" },
  { value: "usability", label: "Design or usability" },
  { value: "account_sync", label: "Account or synchronization" },
  { value: "notifications", label: "Notifications or reminders" },
  { value: "other", label: "Other" },
];

export const FEEDBACK_MAX_MESSAGE_LENGTH = 5000;
export const FEEDBACK_MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
export const FEEDBACK_SCREENSHOT_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export function validateFeedbackScreenshot(file) {
  if (!file) return { valid: true, extension: null, error: "" };
  const extension = FEEDBACK_SCREENSHOT_TYPES[file.type];
  if (!extension) return { valid: false, extension: null, error: "Choose a PNG, JPEG, or WebP screenshot." };
  if (file.size > FEEDBACK_MAX_SCREENSHOT_BYTES) return { valid: false, extension: null, error: "The screenshot must be 5 MB or smaller." };
  return { valid: true, extension, error: "" };
}

export function feedbackScreenshotPath(userId, feedbackId, extension) {
  return `${userId}/${feedbackId}/screenshot.${extension}`;
}
