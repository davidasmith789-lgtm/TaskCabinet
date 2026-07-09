export const WORKSPACE_LAYOUT_VERSION = 1;

export const PROTECTED_WIDGETS = new Set([
  "add-assignment",
  "checklists",
  "todo-master",
  "in-progress-master",
  "completed-master",
]);

export const DEFAULT_WIDGET_LAYOUT = {
  dashboard: [
    { type: "recommended", width: 640, height: 430, desktopX: 0, desktopY: 0 },
    { type: "quick-match", width: 360, height: 430, desktopX: 658, desktopY: 0 },
    { type: "mini-calendar", width: 330, height: 430, desktopX: 1036, desktopY: 0 },
    { type: "stat-active", width: 220, height: 145, desktopX: 0, desktopY: 448 },
    { type: "stat-today", width: 220, height: 145, desktopX: 238, desktopY: 448 },
    { type: "stat-overdue", width: 220, height: 145, desktopX: 476, desktopY: 448 },
    { type: "stat-workload", width: 220, height: 145, desktopX: 714, desktopY: 448 },
    { type: "reminders", width: 414, height: 360, desktopX: 952, desktopY: 448 },
    { type: "course-overview", width: 450, height: 340, desktopX: 0, desktopY: 611 },
    { type: "school-guide", width: 466, height: 340, desktopX: 468, desktopY: 611 },
    { type: "checklists", width: 414, height: 480, desktopX: 952, desktopY: 826 },
    { type: "add-assignment", width: 820, height: 620, desktopX: 0, desktopY: 969 },
    { type: "course-colors", width: 528, height: 460, desktopX: 838, desktopY: 969 },
  ],
  todo: [
    { type: "todo-master", width: 1050, height: 760 },
    ...["overdue", "today", "tomorrow", "this-week", "next-week", "later", "no-date"].map((bucket) => ({ type: `todo-bucket-${bucket}`, width: 480, height: 430, hidden: true })),
  ],
  inProgress: [
    { type: "in-progress-master", width: 1050, height: 760 },
    ...["overdue", "today", "tomorrow", "this-week", "next-week", "later", "no-date"].map((bucket) => ({ type: `in-progress-bucket-${bucket}`, width: 480, height: 430, hidden: true })),
  ],
  completed: [{ type: "completed-master", width: 1050, height: 760 }],
  settings: [{ type: "settings-master", width: 1180, height: 820 }],
};

const makeInstance = (item, index) => ({
  id: `${item.type}-${index}`,
  ...item,
  hidden: item.hidden ?? false,
});

const getCanvasWidth = (mode, override) => {
  const fallback = mode === "mobile" ? 720 : 1600;
  return Math.max(320, Number.isFinite(override) ? override : fallback);
};

const getGap = (mode) => mode === "mobile" ? 12 : 18;

const finiteNumber = (value, fallback) => (
  Number.isFinite(Number(value)) ? Number(value) : fallback
);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const rectsOverlap = (a, b, gap) => (
  a.x < b.x + b.width + gap &&
  a.x + a.width + gap > b.x &&
  a.y < b.y + b.height + gap &&
  a.y + a.height + gap > b.y
);

function findNearestOpenPosition(item, obstacles, canvasWidth, gap) {
  const maxX = Math.max(0, canvasWidth - item.width);
  const desiredX = clamp(item.x, 0, maxX);
  const desiredY = Math.max(0, item.y);
  const xValues = new Set([desiredX, 0, maxX]);
  const yValues = new Set([desiredY, 0]);

  for (const obstacle of obstacles) {
    xValues.add(obstacle.x - item.width - gap);
    xValues.add(obstacle.x + obstacle.width + gap);
    xValues.add(obstacle.x);
    yValues.add(obstacle.y - item.height - gap);
    yValues.add(obstacle.y + obstacle.height + gap);
    yValues.add(obstacle.y);
  }

  const candidates = [];
  for (const rawX of xValues) {
    candidates.push({ x: clamp(rawX, 0, maxX), y: desiredY });
  }
  for (const rawY of yValues) {
    candidates.push({ x: desiredX, y: Math.max(0, rawY) });
  }
  for (const rawX of xValues) {
    for (const rawY of yValues) {
      candidates.push({ x: clamp(rawX, 0, maxX), y: Math.max(0, rawY) });
    }
  }

  let best = null;
  const seen = new Set();
  for (const candidate of candidates) {
    const key = `${Math.round(candidate.x)}:${Math.round(candidate.y)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const positioned = { ...item, x: candidate.x, y: candidate.y };
    if (obstacles.some((obstacle) => rectsOverlap(positioned, obstacle, gap))) continue;

    const horizontalMove = Math.abs(candidate.x - desiredX);
    const verticalMove = Math.abs(candidate.y - desiredY);
    const score = horizontalMove + verticalMove * 1.08;
    if (
      !best ||
      score < best.score ||
      (score === best.score && candidate.y < best.y) ||
      (score === best.score && candidate.y === best.y && candidate.x < best.x)
    ) {
      best = { ...candidate, score };
    }
  }

  if (best) return { ...item, x: best.x, y: best.y, xRatio: canvasWidth > 0 ? best.x / canvasWidth : 0 };

  const fallbackY = obstacles.reduce((bottom, obstacle) => Math.max(bottom, obstacle.y + obstacle.height + gap), desiredY);
  return { ...item, x: desiredX, y: fallbackY, xRatio: canvasWidth > 0 ? desiredX / canvasWidth : 0 };
}

function packVisibleWidgets(items, mode, options = {}) {
  const canvasWidth = getCanvasWidth(mode, options.canvasWidth);
  const gap = getGap(mode);
  const sanitized = items.map((item, index) => {
    const width = clamp(finiteNumber(item.width, 320), 190, canvasWidth);
    const height = Math.max(58, finiteNumber(item.height, 320));
    const maxX = Math.max(0, canvasWidth - width);
    const x = clamp(finiteNumber(item.x, finiteNumber(item.xRatio, 0) * canvasWidth), 0, maxX);
    return {
      ...item,
      width,
      height,
      x,
      xRatio: canvasWidth > 0 ? x / canvasWidth : 0,
      y: Math.max(0, finiteNumber(item.y, 0)),
      zIndex: Math.max(1, finiteNumber(item.zIndex, 1)),
      __order: index,
    };
  });

  const active = options.activeId
    ? sanitized.find((item) => item.id === options.activeId && !item.hidden)
    : null;

  if (active) {
    const visibleObstacles = sanitized.filter((item) => !item.hidden && item.id !== active.id);
    const adjustedActive = findNearestOpenPosition(active, visibleObstacles, canvasWidth, gap);
    return sanitized.map((item) => {
      const cleanItem = item.id === active.id ? adjustedActive : item;
      const result = { ...cleanItem };
      delete result.__order;
      return result;
    });
  }

  const placed = [];
  const packedById = new Map();
  const visible = sanitized
    .filter((item) => !item.hidden)
    .sort((a, b) => a.y - b.y || a.x - b.x || a.__order - b.__order);

  for (const item of visible) {
    const next = findNearestOpenPosition(item, placed, canvasWidth, gap);
    next.xRatio = canvasWidth > 0 ? next.x / canvasWidth : 0;
    placed.push(next);
    packedById.set(next.id, next);
  }

  return sanitized.map((item) => {
    const packed = packedById.get(item.id) || item;
    const cleanItem = { ...packed };
    delete cleanItem.__order;
    return cleanItem;
  });
}

function addMissingPositions(items, mode, options = {}) {
  const canvasWidth = getCanvasWidth(mode, options.canvasWidth);
  const gap = mode === "mobile" ? 12 : 18;
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  const positioned = items.map((item) => {
    const width = Math.min(Number(item.width) || 320, canvasWidth);
    const height = Number(item.height) || 320;
    if (x > 0 && x + width > canvasWidth) {
      x = 0;
      y += rowHeight + gap;
      rowHeight = 0;
    }
    const explicitX = Number.isFinite(item.x)
      ? item.x
      : mode === "desktop" && Number.isFinite(item.desktopX)
        ? item.desktopX
        : undefined;
    const explicitY = Number.isFinite(item.y)
      ? item.y
      : mode === "desktop" && Number.isFinite(item.desktopY)
        ? item.desktopY
        : undefined;
    const positioned = {
      ...item,
      x: Number.isFinite(explicitX) ? explicitX : x,
      xRatio: Number.isFinite(item.xRatio)
        ? item.xRatio
        : Math.max(0, Math.min(1, (Number.isFinite(explicitX) ? explicitX : x) / canvasWidth)),
      y: Number.isFinite(explicitY) ? explicitY : y,
      zIndex: Number.isFinite(item.zIndex) ? item.zIndex : 1,
    };
    x += width + gap;
    rowHeight = Math.max(rowHeight, height);
    return positioned;
  });
  return packVisibleWidgets(positioned, mode, options);
}

export function createDefaultWorkspaceLayout() {
  const makeMode = (mode) => Object.fromEntries(
    Object.entries(DEFAULT_WIDGET_LAYOUT).map(([tab, items]) => [
      tab,
      addMissingPositions(items.map(makeInstance), mode),
    ]),
  );

  return {
    version: WORKSPACE_LAYOUT_VERSION,
    desktop: makeMode("desktop"),
    mobile: makeMode("mobile"),
    collapsed: {},
    locked: { desktop: false, mobile: false },
  };
}

export function normalizeWorkspaceLayout(value, options = {}) {
  const defaults = createDefaultWorkspaceLayout();
  if (!value || value.version !== WORKSPACE_LAYOUT_VERSION) return defaults;

  const modes = options.mode ? [options.mode] : ["desktop", "mobile"];
  for (const mode of modes) {
    const existingTypes = new Set(Object.values(value?.[mode] || {}).flat().map((item) => item.type));
    for (const tab of Object.keys(DEFAULT_WIDGET_LAYOUT)) {
      if (!Array.isArray(value?.[mode]?.[tab])) {
        value[mode] = { ...(value[mode] || {}), [tab]: defaults[mode][tab] };
        defaults[mode][tab].forEach((item) => existingTypes.add(item.type));
        continue;
      }
      const missing = defaults[mode][tab].filter((item) => !existingTypes.has(item.type));
      if (missing.length > 0) {
        value[mode][tab] = [...value[mode][tab], ...missing];
        missing.forEach((item) => existingTypes.add(item.type));
      }
      value[mode][tab] = addMissingPositions(value[mode][tab], mode, options);
    }
  }
  return { ...defaults, ...value, collapsed: value.collapsed || {}, locked: { ...defaults.locked, ...(value.locked || {}) } };
}

export function placeWidget(layout, mode, targetTab, widget, { copy = false } = {}) {
  const next = structuredClone(layout);
  const sourceTab = Object.keys(next[mode]).find((tab) =>
    next[mode][tab].some((item) => item.id === widget.id),
  );
  if (!copy && sourceTab) {
    next[mode][sourceTab] = next[mode][sourceTab].filter((item) => item.id !== widget.id);
  }
  next[mode][targetTab] = next[mode][targetTab].filter((item) => item.type !== widget.type);
  next[mode][targetTab].push({
    ...widget,
    id: copy ? `${widget.type}-${crypto.randomUUID()}` : widget.id,
    hidden: false,
  });
  return next;
}

export function canHideWidget(layout, mode, widgetType) {
  if (!PROTECTED_WIDGETS.has(widgetType)) return true;
  const visibleCount = Object.values(layout[mode] || {})
    .flat()
    .filter((item) => item.type === widgetType && !item.hidden).length;
  return visibleCount > 1;
}
