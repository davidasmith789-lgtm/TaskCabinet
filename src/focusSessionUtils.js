export const formatFocusDuration = (totalSeconds) => {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

export const getFocusTimeUpdate = (task, elapsedSeconds, reduceEstimate = false) => {
  const sessionMinutes = Math.max(1, Math.ceil((Number(elapsedSeconds) || 0) / 60));
  const previousMinutes = Math.max(0, Number(task?.focusMinutesSpent) || 0);
  const estimate = Number(task?.estimatedMinutes);

  return {
    focusMinutesSpent: previousMinutes + sessionMinutes,
    ...(reduceEstimate && Number.isFinite(estimate) && estimate > 0
      ? { estimatedMinutes: Math.max(0, estimate - sessionMinutes) }
      : {}),
  };
};
