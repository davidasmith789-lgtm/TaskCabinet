export const COMMUNITY_POST_TYPES = ["Course Advice", "Study Guide", "Concept Explanation", "Class Tips", "Other"];
export const COMMUNITY_REPORT_REASONS = ["Cheating or answer key", "Copyrighted material", "Personal information", "Harassment or harmful content", "Spam", "Other"];
export const COMMUNITY_LIMITS = { course: 100, title: 140, body: 10000, tags: 8, tag: 30 };
export const COMMUNITY_DRAFT_VERSION = 1;

export const getCommunityDraftStorageKey = (userId) =>
  `glowdocket_community_draft_v${COMMUNITY_DRAFT_VERSION}_${String(userId || "guest")}`;

export function hasMeaningfulCommunityDraft(draft) {
  return Boolean(
    String(draft?.course_name || "").trim()
    || String(draft?.title || "").trim()
    || String(draft?.body || "").trim()
    || (Array.isArray(draft?.links) && draft.links.some((link) => String(link?.name || "").trim() || String(link?.url || "").trim())),
  );
}

export function normalizeCommunityDraft(draft) {
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) return null;
  const postType = COMMUNITY_POST_TYPES.includes(draft.post_type) ? draft.post_type : COMMUNITY_POST_TYPES[0];
  return {
    course_name: String(draft.course_name || "").slice(0, COMMUNITY_LIMITS.course),
    post_type: postType,
    title: String(draft.title || "").slice(0, COMMUNITY_LIMITS.title),
    body: String(draft.body || "").slice(0, COMMUNITY_LIMITS.body),
    tags: "",
    links: (Array.isArray(draft.links) ? draft.links : []).slice(0, 5).map((link) => ({
      name: String(link?.name || "").slice(0, 80),
      url: String(link?.url || "").slice(0, 2000),
    })),
  };
}

export function loadCommunityDraft(storage, userId) {
  try {
    const stored = JSON.parse(storage?.getItem(getCommunityDraftStorageKey(userId)) || "null");
    if (stored?.version !== COMMUNITY_DRAFT_VERSION || !Number.isFinite(stored?.savedAt)) return null;
    const draft = normalizeCommunityDraft(stored.draft);
    if (!draft || !hasMeaningfulCommunityDraft(draft)) return null;
    return { draft, savedAt: stored.savedAt };
  } catch {
    return null;
  }
}

export function saveCommunityDraft(storage, userId, draft, savedAt = Date.now()) {
  const key = getCommunityDraftStorageKey(userId);
  const normalized = normalizeCommunityDraft(draft);
  try {
    if (!normalized || !hasMeaningfulCommunityDraft(normalized)) {
      storage?.removeItem(key);
      return null;
    }
    const value = { version: COMMUNITY_DRAFT_VERSION, savedAt, draft: normalized };
    storage?.setItem(key, JSON.stringify(value));
    return value;
  } catch {
    return null;
  }
}

export function clearCommunityDraft(storage, userId) {
  try { storage?.removeItem(getCommunityDraftStorageKey(userId)); } catch { /* storage may be unavailable */ }
}

const normalizeCourseSearch = (value) => String(value || "")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

export function matchCommunityCourses(courses, query, limit = 8) {
  const terms = normalizeCourseSearch(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return [...new Set((Array.isArray(courses) ? courses : []).map((course) => String(course || "").trim()).filter(Boolean))]
    .filter((course) => {
      const normalized = normalizeCourseSearch(course);
      return terms.every((term) => normalized.includes(term));
    })
    .sort((a, b) => {
      const normalizedA = normalizeCourseSearch(a);
      const normalizedB = normalizeCourseSearch(b);
      const queryText = terms.join(" ");
      return Number(normalizedB.startsWith(queryText)) - Number(normalizedA.startsWith(queryText)) || a.localeCompare(b);
    })
    .slice(0, limit);
}

export function normalizeCommunityLinks(links) {
  return (Array.isArray(links) ? links : []).map((link) => ({
    name: String(link?.name || "").trim().slice(0, 80),
    url: String(link?.url || "").trim().slice(0, 2000),
  })).filter((link) => link.name || link.url).slice(0, 5);
}

export function isSafeCommunityLink(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function parseCommunityTags(value) {
  return [...new Set(String(value || "").split(",").map((tag) => tag.trim()).filter(Boolean))].slice(0, COMMUNITY_LIMITS.tags);
}

export function validateCommunityPost(post, confirmed = false) {
  const tags = Array.isArray(post.topic_tags) ? post.topic_tags : parseCommunityTags(post.tags);
  if (!String(post.course_name || "").trim() || String(post.course_name).length > COMMUNITY_LIMITS.course) return "Enter a course name within 100 characters.";
  if (!COMMUNITY_POST_TYPES.includes(post.post_type)) return "Choose a valid post type.";
  if (!String(post.title || "").trim() || String(post.title).length > COMMUNITY_LIMITS.title) return "Enter a title within 140 characters.";
  if (!String(post.body || "").trim() || String(post.body).length > COMMUNITY_LIMITS.body) return "Enter post text within 10,000 characters.";
  if (tags.length > COMMUNITY_LIMITS.tags || tags.some((tag) => tag.length > COMMUNITY_LIMITS.tag)) return "Use no more than eight tags, each within 30 characters.";
  const links = normalizeCommunityLinks(post.links);
  if (links.some((link) => !link.name || !isSafeCommunityLink(link.url))) return "Give every link a name and a valid http or https address.";
  if (!confirmed) return "Confirm the community sharing agreement.";
  return "";
}

export function communityBodyBlocks(body) {
  const lines = String(body || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let paragraph = [];
  let list = null;
  const flushParagraph = () => { if (paragraph.length) blocks.push({ type: "paragraph", lines: paragraph.splice(0) }); };
  const flushList = () => { if (list) { blocks.push(list); list = null; } };
  lines.forEach((line) => {
    if (/^##\s+/.test(line)) { flushParagraph(); flushList(); blocks.push({ type: "heading", text: line.replace(/^##\s+/, "") }); return; }
    const bullet = line.match(/^[-*]\s+(.+)/); const numbered = line.match(/^\d+[.)]\s+(.+)/);
    if (bullet || numbered) { flushParagraph(); const type = bullet ? "bullets" : "numbers"; if (!list || list.type !== type) { flushList(); list = { type, items: [] }; } list.items.push((bullet || numbered)[1]); return; }
    if (!line.trim()) { flushParagraph(); flushList(); return; }
    flushList(); paragraph.push(line);
  });
  flushParagraph(); flushList();
  return blocks;
}

export function getCommunityFormattingMarker(kind, body = "", cursor = String(body).length) {
  if (kind === "heading") return "## ";
  if (kind === "bullet") return "- ";
  if (kind !== "numbered") return "";

  const beforeCursor = String(body).slice(0, cursor);
  const currentLineStart = beforeCursor.lastIndexOf("\n") + 1;
  const currentLinePrefix = beforeCursor.slice(currentLineStart);
  if (currentLinePrefix.trim()) return "1. ";

  const previousText = beforeCursor.slice(0, Math.max(0, currentLineStart - 1));
  const previousLine = previousText.slice(previousText.lastIndexOf("\n") + 1);
  const previousNumber = previousLine.match(/^\s*(\d+)[.)]\s+/);
  return `${previousNumber ? Number(previousNumber[1]) + 1 : 1}. `;
}
