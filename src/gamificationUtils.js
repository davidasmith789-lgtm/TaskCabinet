export const DEFAULT_GAMIFICATION = Object.freeze({
  version: 1,
  weeklyGoal: 5,
  earnedAchievementIds: [],
  selectedConfetti: "standard",
  selectedTitle: "getting-started",
  showHeaderSummary: true,
});

export const GAMIFICATION_ACHIEVEMENTS = Object.freeze([
  { id: "first-completion", title: "First Win", description: "Complete your first assignment." },
  { id: "five-completions", title: "Momentum Builder", description: "Complete five assignments." },
  { id: "weekly-goal", title: "Goal Getter", description: "Reach your weekly assignment goal." },
  { id: "three-productive-days", title: "Consistent Glow", description: "Complete work on three different days in one week." },
  { id: "high-priority", title: "Priority Pro", description: "Complete a high-priority assignment." },
  { id: "overdue-recovery", title: "Deadline Defender", description: "Complete an overdue assignment." },
  { id: "related-tasks", title: "Step by Step", description: "Finish an assignment by completing all related tasks." },
  { id: "focus-finish", title: "Focus Finisher", description: "Complete an assignment after a focus session." },
]);

export const GAMIFICATION_TITLES = Object.freeze([
  { id: "getting-started", label: "Getting Started", requirement: null },
  { id: "momentum-builder", label: "Momentum Builder", requirement: "five-completions" },
  { id: "deadline-defender", label: "Deadline Defender", requirement: "overdue-recovery" },
  { id: "focus-finisher", label: "Focus Finisher", requirement: "focus-finish" },
]);

export const GAMIFICATION_CONFETTI = Object.freeze([
  { id: "standard", label: "Glow Mix", requirement: null },
  { id: "stars", label: "Golden Stars", requirement: "weekly-goal" },
  { id: "course", label: "Course Colors", requirement: "three-productive-days" },
]);

const validIds = (values, allowed) => [...new Set((Array.isArray(values) ? values : []).filter((id) => allowed.has(id)))];

export function normalizeGamification(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const achievementIds = new Set(GAMIFICATION_ACHIEVEMENTS.map((item) => item.id));
  const earnedAchievementIds = validIds(source.earnedAchievementIds, achievementIds);
  const earned = new Set(earnedAchievementIds);
  const weeklyGoal = Math.max(1, Math.min(50, Math.round(Number(source.weeklyGoal) || DEFAULT_GAMIFICATION.weeklyGoal)));
  const selectedTitle = GAMIFICATION_TITLES.some((item) => item.id === source.selectedTitle && (!item.requirement || earned.has(item.requirement))) ? source.selectedTitle : DEFAULT_GAMIFICATION.selectedTitle;
  const selectedConfetti = GAMIFICATION_CONFETTI.some((item) => item.id === source.selectedConfetti && (!item.requirement || earned.has(item.requirement))) ? source.selectedConfetti : DEFAULT_GAMIFICATION.selectedConfetti;
  return { version: 1, weeklyGoal, earnedAchievementIds, selectedConfetti, selectedTitle, showHeaderSummary: source.showHeaderSummary !== false };
}

export function getWeekRange(now = new Date(), weekStartsOn = "sunday") {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const firstDay = weekStartsOn === "monday" ? 1 : 0;
  start.setDate(start.getDate() - ((start.getDay() - firstDay + 7) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

export function summarizeWeeklyMomentum(tasks, gamification, options = {}) {
  const settings = normalizeGamification(gamification);
  const { start, end } = getWeekRange(options.now || new Date(), options.weekStartsOn);
  const completions = (Array.isArray(tasks) ? tasks : []).filter((task) => {
    if (!task?.isCompleted || task.isDeleted || !task.completedAt) return false;
    const completed = new Date(task.completedAt);
    return !Number.isNaN(completed.getTime()) && completed >= start && completed < end;
  });
  const productiveDays = new Set(completions.map((task) => {
    const date = new Date(task.completedAt);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  })).size;
  return { completed: completions.length, goal: settings.weeklyGoal, productiveDays, progress: Math.min(100, Math.round((completions.length / settings.weeklyGoal) * 100)), goalReached: completions.length >= settings.weeklyGoal };
}

export function getNewAchievementIds(tasks, gamification, event = {}, options = {}) {
  const settings = normalizeGamification(gamification);
  const earned = new Set(settings.earnedAchievementIds);
  const completed = (Array.isArray(tasks) ? tasks : []).filter((task) => task?.isCompleted && !task.isDeleted && task.completedAt);
  const weekly = summarizeWeeklyMomentum(tasks, settings, options);
  const candidates = [];
  if (completed.length >= 1) candidates.push("first-completion");
  if (completed.length >= 5) candidates.push("five-completions");
  if (weekly.goalReached) candidates.push("weekly-goal");
  if (weekly.productiveDays >= 3) candidates.push("three-productive-days");
  if (event.priority === "HIGH") candidates.push("high-priority");
  if (event.wasOverdue) candidates.push("overdue-recovery");
  if (event.source === "related-tasks") candidates.push("related-tasks");
  if (event.source === "focus") candidates.push("focus-finish");
  return candidates.filter((id) => !earned.has(id));
}

export function getGamificationTitle(gamification) {
  const settings = normalizeGamification(gamification);
  return GAMIFICATION_TITLES.find((item) => item.id === settings.selectedTitle) || GAMIFICATION_TITLES[0];
}
