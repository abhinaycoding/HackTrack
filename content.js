const STORAGE_KEY = "hackathons";
const ROOT_ID = "hacktrack-floating-root";
const HACKATHON_KEYWORDS = ["hackathon", "devpost", "unstop", "mlh", "challenge"];
const SCROLL_TRIGGER_PX = 200;
const TAB_LABEL_REGEX = /\b(prizes?|rewards?|awards?)\b/i;
const OVERVIEW_TAB_REGEX = /\b(overview|about|details|summary|home)\b/i;
const TAB_WAIT_MS = 1200;

const DATE_KEYWORDS_REGEX =
  /\b(deadline|last\s*date|apply\s*by|registration\s*ends?|submission\s*deadline|applications?\s*close|runs\s*from|starts?|ends?)\b/i;
const DATE_END_KEYWORDS_REGEX =
  /\b(deadline|last\s*date|apply\s*by|registration\s*ends?|submission\s*deadline|applications?\s*close|ends?)\b/i;
const DATE_START_KEYWORDS_REGEX = /\b(runs\s*from|starts?)\b/i;

const PRIZE_STRONG_KEYWORDS_REGEX =
  /\b(prize\s*pool|prizes\s*worth|total\s*prize|win\s*up\s*to|cash\s*prize)\b/i;
const PRIZE_EXCLUDE_REGEX = /\b(registration|fee|participants?|teams?|slots?)\b/i;
const CURRENCY_VALUE_REGEX =
  /(₹|\$)\s?\d+(?:,\d{3})*(?:\.\d+)?\s?(?:lakh|lakhs|crore|k|million)?/i;

const MONTH_MAP = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11
};

const state = {
  inactiveTimer: null,
  hideTimer: null,
  modalOpen: false,
  isVisible: false,
  extractedData: null,
  hideTimeoutMs: 3500,
  tabPrizeAttempted: false,
  tabPrizeCachedResult: null
};

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isHackathonPage() {
  const matcher = new RegExp(HACKATHON_KEYWORDS.join("|"), "i");
  const url = window.location.href;
  const title = document.title || "";
  const heading = Array.from(document.querySelectorAll("h1, h2"))
    .slice(0, 6)
    .map((node) => node.textContent || "")
    .join(" ");
  return matcher.test(url) || matcher.test(title) || matcher.test(heading);
}

function textFromElement(selector) {
  const element = document.querySelector(selector);
  return element?.textContent?.trim() || "";
}

function detectTitle() {
  const h1Text = textFromElement("h1");
  if (h1Text && h1Text.length > 3) {
    return h1Text;
  }

  return (document.title || "Untitled Hackathon").trim();
}

function parseDateParts(day, monthText, yearCandidate) {
  const monthKey = String(monthText).slice(0, 3).toLowerCase();
  const monthIndex = MONTH_MAP[monthKey];
  const dayValue = Number(day);

  if (monthIndex === undefined || Number.isNaN(dayValue) || dayValue < 1 || dayValue > 31) {
    return null;
  }

  let year = new Date().getFullYear();
  if (yearCandidate !== undefined && yearCandidate !== null && yearCandidate !== "") {
    const rawYear = Number(yearCandidate);
    if (!Number.isNaN(rawYear)) {
      year = rawYear < 100 ? 2000 + rawYear : rawYear;
    }
  }

  const parsed = new Date(year, monthIndex, dayValue);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return toIsoDate(parsed);
}

function parseDateValue(value) {
  if (!value) {
    return null;
  }

  const normalizedValue = String(value).trim().replace(/(st|nd|rd|th)\b/gi, "");
  if (!normalizedValue) {
    return null;
  }

  const parsedDate = new Date(normalizedValue);
  if (!Number.isNaN(parsedDate.getTime())) {
    return toIsoDate(parsedDate);
  }

  const isoMatch = normalizedValue.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const slashMatch = normalizedValue.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/);
  if (!slashMatch) {
    return null;
  }

  const first = Number(slashMatch[1]);
  const second = Number(slashMatch[2]);
  let year = Number(slashMatch[3]);
  if (year < 100) {
    year += 2000;
  }

  if (first > 12) {
    return `${year}-${String(second).padStart(2, "0")}-${String(first).padStart(2, "0")}`;
  }

  return `${year}-${String(first).padStart(2, "0")}-${String(second).padStart(2, "0")}`;
}

function isReasonableDeadline(isoDate) {
  if (!isoDate) {
    return false;
  }

  const parsed = new Date(`${isoDate}T23:59:59`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const now = new Date();
  const minDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const maxDate = new Date(now.getFullYear() + 6, now.getMonth(), now.getDate());
  return parsed >= minDate && parsed <= maxDate;
}

function selectBestDeadline(candidates) {
  const filtered = [...new Set(candidates)].filter((date) => isReasonableDeadline(date));
  if (!filtered.length) {
    return null;
  }

  const nowTs = Date.now();
  const futureDates = filtered
    .map((date) => ({
      iso: date,
      ts: new Date(`${date}T23:59:59`).getTime()
    }))
    .filter((entry) => entry.ts >= nowTs)
    .sort((a, b) => a.ts - b.ts);

  if (futureDates.length) {
    return futureDates[0].iso;
  }

  const recentPast = filtered
    .map((date) => ({
      iso: date,
      ts: new Date(`${date}T23:59:59`).getTime()
    }))
    .sort((a, b) => b.ts - a.ts);

  return recentPast[0].iso;
}

function extractDatesFromText(text) {
  if (!text) {
    return [];
  }

  const normalized = String(text).replace(/(st|nd|rd|th)\b/gi, " ").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [];
  }

  const dates = [];

  const monthRangePattern =
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})\s*[-–]\s*(\d{1,2})(?:\s*,\s*(\d{2,4}))?\b/gi;
  let rangeMatch = monthRangePattern.exec(normalized);
  while (rangeMatch) {
    const start = parseDateParts(rangeMatch[2], rangeMatch[1], rangeMatch[4]);
    const end = parseDateParts(rangeMatch[3], rangeMatch[1], rangeMatch[4]);
    if (start) {
      dates.push(start);
    }
    if (end) {
      dates.push(end);
    }
    rangeMatch = monthRangePattern.exec(normalized);
  }

  const dayMonthPattern =
    /\b(\d{1,2})\s?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s?(\d{2,4})?\b/gi;
  let dayMonthMatch = dayMonthPattern.exec(normalized);
  while (dayMonthMatch) {
    const parsed = parseDateParts(dayMonthMatch[1], dayMonthMatch[2], dayMonthMatch[3]);
    if (parsed) {
      dates.push(parsed);
    }
    dayMonthMatch = dayMonthPattern.exec(normalized);
  }

  const monthDayPattern =
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})(?:\s*,\s*(\d{2,4}))?\b/gi;
  let monthDayMatch = monthDayPattern.exec(normalized);
  while (monthDayMatch) {
    const parsed = parseDateParts(monthDayMatch[2], monthDayMatch[1], monthDayMatch[3]);
    if (parsed) {
      dates.push(parsed);
    }
    monthDayMatch = monthDayPattern.exec(normalized);
  }

  return [...new Set(dates)];
}

function getVisibleTextElements(maxElements = 1800) {
  const elements = document.querySelectorAll("*");
  const allowedTags = new Set([
    "DIV",
    "SPAN",
    "P",
    "LI",
    "H1",
    "H2",
    "H3",
    "H4",
    "SECTION",
    "ARTICLE",
    "LABEL",
    "STRONG",
    "TIME",
    "DD",
    "DT"
  ]);

  const visible = [];
  for (const node of elements) {
    if (!(node instanceof HTMLElement)) {
      continue;
    }

    if (!allowedTags.has(node.tagName)) {
      continue;
    }

    const text = (node.textContent || "").trim().replace(/\s+/g, " ");
    if (text.length < 5 || text.length > 220) {
      continue;
    }

    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") {
      continue;
    }

    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      continue;
    }

    visible.push({ element: node, text });
    if (visible.length >= maxElements) {
      break;
    }
  }

  return visible;
}

function detectDeadlineSiteSpecific() {
  const host = window.location.hostname.toLowerCase();
  const selectors = [];

  if (host.includes("devpost")) {
    selectors.push(
      "[data-test='submission-period']",
      ".submission-period__dates",
      ".challenge-detail-stat"
    );
  }

  if (host.includes("unstop")) {
    selectors.push(".opportunity-info", ".details", "[class*='deadline']", "[class*='date']");
  }

  for (const selector of selectors) {
    const value = textFromElement(selector);
    if (!value) {
      continue;
    }

    const candidates = [];
    const parsedExplicit = parseDateValue(value);
    if (parsedExplicit) {
      candidates.push(parsedExplicit);
    }

    const extractedDates = extractDatesFromText(value);
    if (extractedDates.length) {
      candidates.push(...extractedDates);
    }

    const best = selectBestDeadline(candidates);
    if (best) {
      return best;
    }
  }

  return null;
}

function detectDeadlineFromElements(visibleTextElements) {
  const scoredCandidates = [];

  for (const entry of visibleTextElements) {
    const text = entry.text;
    if (!DATE_KEYWORDS_REGEX.test(text)) {
      continue;
    }

    const extractedDates = extractDatesFromText(text);
    if (!extractedDates.length) {
      continue;
    }

    const lowerText = text.toLowerCase();
    let score = 10;

    if (/deadline|last\s*date|apply\s*by|submission\s*deadline|applications?\s*close/.test(lowerText)) {
      score = 100;
    } else if (DATE_END_KEYWORDS_REGEX.test(lowerText)) {
      score = 80;
    } else if (DATE_START_KEYWORDS_REGEX.test(lowerText)) {
      score = 30;
    }

    const picked = DATE_END_KEYWORDS_REGEX.test(lowerText)
      ? extractedDates[extractedDates.length - 1]
      : extractedDates[0];

    if (picked) {
      scoredCandidates.push({ date: picked, score });
    }
  }

  if (!scoredCandidates.length) {
    return null;
  }

  const topScore = Math.max(...scoredCandidates.map((item) => item.score));
  const topDates = scoredCandidates.filter((item) => item.score === topScore).map((item) => item.date);
  return selectBestDeadline(topDates);
}

function detectDeadlineSafeFallback() {
  const structuredElements = document.querySelectorAll(
    "time, [datetime], [data-deadline], [class*='deadline' i], [id*='deadline' i]"
  );

  for (const node of structuredElements) {
    const values = [node.getAttribute("datetime"), node.getAttribute("data-deadline"), node.textContent];

    for (const value of values) {
      const candidates = [];
      const parsed = parseDateValue(value);
      if (parsed) {
        candidates.push(parsed);
      }
      const extracted = extractDatesFromText(value);
      if (extracted.length) {
        candidates.push(...extracted);
      }

      const best = selectBestDeadline(candidates);
      if (best) {
        return best;
      }
    }
  }

  return null;
}

function detectPrizeSiteSpecific() {
  const host = window.location.hostname.toLowerCase();
  const selectors = [];

  if (host.includes("devpost")) {
    selectors.push(".prizes", ".prize", "[data-test='prizes']", ".challenge-detail-prizes");
  }

  if (host.includes("unstop")) {
    selectors.push("[class*='prize']", ".opportunity-reward");
  }

  for (const selector of selectors) {
    const candidate = textFromElement(selector);
    if (!candidate) {
      continue;
    }

    if (!PRIZE_STRONG_KEYWORDS_REGEX.test(candidate) || PRIZE_EXCLUDE_REGEX.test(candidate)) {
      continue;
    }

    const match = candidate.match(CURRENCY_VALUE_REGEX);
    if (match?.[0]) {
      return match[0].replace(/\s+/g, " ").trim();
    }
  }

  return null;
}

function detectPrizeFromElements(visibleTextElements) {
  for (const entry of visibleTextElements) {
    const text = entry.text;
    if (!PRIZE_STRONG_KEYWORDS_REGEX.test(text)) {
      continue;
    }

    if (PRIZE_EXCLUDE_REGEX.test(text)) {
      continue;
    }

    const match = text.match(CURRENCY_VALUE_REGEX);
    if (match?.[0]) {
      return match[0].replace(/\s+/g, " ").trim();
    }
  }

  return null;
}

function detectPrizeSafeFallback() {
  const candidates = document.querySelectorAll("[class*='prize' i], [id*='prize' i]");

  for (const candidate of candidates) {
    const text = (candidate.textContent || "").trim();
    if (!text) {
      continue;
    }

    if (!PRIZE_STRONG_KEYWORDS_REGEX.test(text) || PRIZE_EXCLUDE_REGEX.test(text)) {
      continue;
    }

    const match = text.match(CURRENCY_VALUE_REGEX);
    if (match?.[0]) {
      return match[0].replace(/\s+/g, " ").trim();
    }
  }

  return null;
}

function hasPrizeTabWithoutVisibleContent(visibleTextElements) {
  const tabs = document.querySelectorAll("button, a, [role='tab']");
  let hasPrizeTab = false;

  for (const tab of tabs) {
    const text = (tab.textContent || "").trim();
    if (/\bprizes?\b/i.test(text)) {
      hasPrizeTab = true;
      break;
    }
  }

  if (!hasPrizeTab) {
    return false;
  }

  const hasVisiblePrize = visibleTextElements.some((entry) => {
    const text = entry.text;
    if (!PRIZE_STRONG_KEYWORDS_REGEX.test(text)) {
      return false;
    }

    if (PRIZE_EXCLUDE_REGEX.test(text)) {
      return false;
    }

    return CURRENCY_VALUE_REGEX.test(text);
  });

  return !hasVisiblePrize;
}

function getTabCandidates() {
  return Array.from(document.querySelectorAll("button, a, div, span, [role='tab']")).filter((node) => {
    if (!(node instanceof HTMLElement)) {
      return false;
    }

    const text = (node.textContent || "").trim();
    if (!text || text.length > 60) {
      return false;
    }

    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }

    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return false;
    }

    const clickable =
      node.tagName === "BUTTON" ||
      node.tagName === "A" ||
      node.getAttribute("role") === "tab" ||
      node.hasAttribute("onclick") ||
      node.tabIndex >= 0;

    return clickable;
  });
}

function dispatchRealClick(element) {
  ["mouseover", "mousedown", "mouseup", "click"].forEach((eventName) => {
    element.dispatchEvent(
      new MouseEvent(eventName, {
        view: window,
        bubbles: true,
        cancelable: true
      })
    );
  });

  element.click();
}

async function detectPrizeByClickingTabOnce() {
  if (state.tabPrizeAttempted) {
    return state.tabPrizeCachedResult;
  }

  state.tabPrizeAttempted = true;
  const candidates = getTabCandidates();

  const prizeTab = candidates.find((node) => TAB_LABEL_REGEX.test((node.textContent || "").trim()));
  if (!prizeTab) {
    state.tabPrizeCachedResult = null;
    return null;
  }

  const activeTab =
    candidates.find((node) => node.getAttribute("aria-selected") === "true") ||
    candidates.find((node) => OVERVIEW_TAB_REGEX.test((node.textContent || "").trim()));

  dispatchRealClick(prizeTab);
  await wait(TAB_WAIT_MS);

  const visibleTextElements = getVisibleTextElements();
  const extractedPrize = detectPrizeFromElements(visibleTextElements) || detectPrizeSafeFallback();

  if (activeTab && activeTab !== prizeTab) {
    dispatchRealClick(activeTab);
    await wait(200);
  }

  state.tabPrizeCachedResult = extractedPrize || null;
  return state.tabPrizeCachedResult;
}

function getCountdownInfo(deadline) {
  const deadlineDate = new Date(`${deadline}T23:59:59`);
  const diffMs = deadlineDate.getTime() - Date.now();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));

  if (Number.isNaN(hours) || diffMs <= 0) {
    return { label: "Closed", tone: "red" };
  }

  const days = Math.floor(hours / 24);
  const remainHours = hours % 24;
  const label = days > 0 ? `${days}d ${remainHours}h left` : `${Math.max(1, hours)}h left`;

  if (hours < 24) {
    return { label, tone: "red" };
  }

  if (hours < 72) {
    return { label, tone: "yellow" };
  }

  return { label, tone: "green" };
}

async function detectHackathonData() {
  const visibleTextElements = getVisibleTextElements();
  const title = detectTitle();

  const deadline =
    detectDeadlineSiteSpecific() ||
    detectDeadlineFromElements(visibleTextElements) ||
    detectDeadlineSafeFallback();

  let prize =
    detectPrizeSiteSpecific() ||
    detectPrizeFromElements(visibleTextElements) ||
    detectPrizeSafeFallback();

  const prizeNotLoaded = !prize && hasPrizeTabWithoutVisibleContent(visibleTextElements);
  if (!prize && prizeNotLoaded) {
    prize = await detectPrizeByClickingTabOnce();
  }

  const countdown = deadline ? getCountdownInfo(deadline) : null;

  return { title, deadline, prize, prizeNotLoaded: !prize && prizeNotLoaded, countdown };
}

function getHackathons() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      resolve(Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : []);
    });
  });
}

function saveHackathons(hackathons) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: hackathons }, resolve);
  });
}

function computeAdaptiveBottomOffset() {
  const base = 20;
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  const candidates = document.querySelectorAll(
    "iframe, [class*='chat' i], [id*='chat' i], [aria-label*='chat' i], [class*='widget' i], [id*='intercom' i], [class*='launcher' i]"
  );

  let extraOffset = 0;
  for (const node of candidates) {
    if (!(node instanceof HTMLElement)) {
      continue;
    }

    const rect = node.getBoundingClientRect();
    const isBottomRight =
      rect.right > viewportWidth - 220 && rect.bottom > viewportHeight - 220 && rect.width > 30;

    if (!isBottomRight) {
      continue;
    }

    const needed = viewportHeight - rect.top + 14;
    if (needed > extraOffset) {
      extraOffset = needed;
    }
  }

  return Math.min(base + extraOffset, 190);
}

function updateFabOffset(root) {
  root.style.setProperty("--fab-bottom", `${computeAdaptiveBottomOffset()}px`);
}

function showFab(root, immediate = false) {
  if (state.modalOpen) {
    return;
  }

  state.isVisible = true;
  root.classList.add("fab-visible");
  root.classList.remove("fab-hidden");

  if (immediate) {
    root.classList.add("fab-no-transition");
    window.setTimeout(() => root.classList.remove("fab-no-transition"), 50);
  }

  if (state.hideTimer) {
    window.clearTimeout(state.hideTimer);
  }

  state.hideTimer = window.setTimeout(() => {
    if (!state.modalOpen) {
      hideFab(root);
    }
  }, state.hideTimeoutMs);
}

function hideFab(root) {
  state.isVisible = false;
  root.classList.remove("fab-visible");
  root.classList.add("fab-hidden");
}

async function saveFromPreview(root, fabButton) {
  const data = state.extractedData || (await detectHackathonData());
  const hackathons = await getHackathons();
  const currentUrl = window.location.href;
  const existingIndex = hackathons.findIndex((item) => item.sourceUrl && item.sourceUrl === currentUrl);

  if (existingIndex >= 0) {
    const existing = hackathons[existingIndex];
    hackathons[existingIndex] = {
      ...existing,
      name: data.title || existing.name,
      sourceUrl: currentUrl,
      deadline: data.deadline || existing.deadline || "",
      prize: data.prize || existing.prize,
      updatedAt: Date.now()
    };
    await saveHackathons(hackathons);
  } else {
    const nextHackathon = {
      id: crypto.randomUUID(),
      name: data.title,
      registered: false,
      sourceUrl: currentUrl,
      createdAt: Date.now()
    };

    if (data.deadline) {
      nextHackathon.deadline = data.deadline;
    }

    if (data.prize) {
      nextHackathon.prize = data.prize;
    }

    hackathons.push(nextHackathon);
    await saveHackathons(hackathons);
  }

  fabButton.textContent = existingIndex >= 0 ? "✓" : "✅";
  window.setTimeout(() => {
    fabButton.textContent = "🚀";
  }, 1400);

  closePreview(root);
}

function getToneClass(tone) {
  if (tone === "red") {
    return "tone-red";
  }

  if (tone === "yellow") {
    return "tone-yellow";
  }

  return "tone-green";
}

async function openPreview(root) {
  const modal = root.shadowRoot.querySelector(".hacktrack-preview");
  const titleNode = root.shadowRoot.querySelector("[data-preview='title']");
  const deadlineRow = root.shadowRoot.querySelector("[data-row='deadline']");
  const deadlineNode = root.shadowRoot.querySelector("[data-preview='deadline']");
  const prizeRow = root.shadowRoot.querySelector("[data-row='prize']");
  const prizeNode = root.shadowRoot.querySelector("[data-preview='prize']");
  const countdownNode = root.shadowRoot.querySelector("[data-preview='countdown']");

  const detected = await detectHackathonData();
  state.extractedData = detected;

  titleNode.textContent = detected.title;

  if (detected.deadline) {
    deadlineNode.textContent = detected.deadline;
    deadlineRow.classList.remove("hidden");
  } else {
    deadlineNode.textContent = "";
    deadlineRow.classList.add("hidden");
  }

  if (detected.prize) {
    prizeNode.textContent = detected.prize;
    prizeRow.classList.remove("hidden");
  } else {
    prizeNode.textContent = "";
    prizeRow.classList.add("hidden");
  }

  if (detected.countdown) {
    countdownNode.textContent = detected.countdown.label;
    countdownNode.className = `countdown-chip ${getToneClass(detected.countdown.tone)}`;
    countdownNode.classList.remove("hidden");
  } else {
    countdownNode.textContent = "";
    countdownNode.className = "countdown-chip hidden";
  }

  state.modalOpen = true;
  modal.classList.add("preview-open");
}

function closePreview(root) {
  const modal = root.shadowRoot.querySelector(".hacktrack-preview");
  state.modalOpen = false;
  modal.classList.remove("preview-open");
  showFab(root);
}

function injectUi() {
  if (document.getElementById(ROOT_ID)) {
    return;
  }

  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.className = "fab-hidden";
  document.documentElement.appendChild(root);

  const shadowRoot = root.attachShadow({ mode: "open" });
  shadowRoot.innerHTML = `
    <style>
      :host {
        all: initial;
      }

      .fab-hidden .hacktrack-fab {
        opacity: 0;
        transform: translateY(12px) scale(0.92);
        pointer-events: none;
      }

      .fab-visible .hacktrack-fab {
        opacity: 0.65;
        transform: translateY(0) scale(1);
        pointer-events: auto;
      }

      .fab-no-transition .hacktrack-fab {
        transition: none !important;
      }

      .hacktrack-fab {
        position: fixed;
        right: 20px;
        bottom: var(--fab-bottom, 20px);
        width: 50px;
        height: 50px;
        border: 0;
        border-radius: 999px;
        background: linear-gradient(135deg, rgba(79, 70, 229, 0.95), rgba(139, 92, 246, 0.95));
        color: #fff;
        font-size: 24px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 10px 20px rgba(20, 16, 46, 0.35);
        backdrop-filter: blur(8px);
        cursor: pointer;
        z-index: 2147483646;
        transition: opacity 220ms ease, transform 220ms ease, box-shadow 220ms ease, filter 220ms ease;
      }

      .hacktrack-fab:hover {
        opacity: 1 !important;
        transform: scale(1.08);
        box-shadow: 0 16px 28px rgba(20, 16, 46, 0.45);
        filter: brightness(1.08);
      }

      .hacktrack-preview {
        position: fixed;
        right: 20px;
        bottom: calc(var(--fab-bottom, 20px) + 66px);
        width: 320px;
        border-radius: 16px;
        background: rgba(17, 24, 39, 0.96);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #f3f4f6;
        box-shadow: 0 24px 48px rgba(0, 0, 0, 0.35);
        z-index: 2147483647;
        padding: 14px;
        font-family: Inter, Segoe UI, system-ui, sans-serif;
        opacity: 0;
        transform: translateY(8px) scale(0.98);
        pointer-events: none;
        transition: opacity 220ms ease, transform 220ms ease;
      }

      .hacktrack-preview.preview-open {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: auto;
      }

      .title {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        line-height: 1.4;
        color: #ffffff;
      }

      .row {
        margin-top: 10px;
        font-size: 13px;
        color: #d1d5db;
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }

      .label {
        color: #9ca3af;
      }

      .value {
        text-align: right;
        max-width: 180px;
      }

      .countdown-chip {
        margin-top: 12px;
        display: inline-block;
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 12px;
        font-weight: 600;
        border: 1px solid transparent;
      }

      .tone-green {
        color: #86efac;
        background: rgba(16, 185, 129, 0.15);
        border-color: rgba(16, 185, 129, 0.38);
      }

      .tone-yellow {
        color: #fde68a;
        background: rgba(245, 158, 11, 0.15);
        border-color: rgba(245, 158, 11, 0.38);
      }

      .tone-red {
        color: #fca5a5;
        background: rgba(239, 68, 68, 0.15);
        border-color: rgba(239, 68, 68, 0.4);
      }

      .actions {
        margin-top: 14px;
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

      .btn {
        border: 0;
        border-radius: 10px;
        padding: 8px 12px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: transform 160ms ease, filter 160ms ease;
      }

      .btn:hover {
        transform: translateY(-1px);
        filter: brightness(1.06);
      }

      .btn-cancel {
        background: #1f2937;
        color: #d1d5db;
      }

      .btn-save {
        background: linear-gradient(135deg, #4f46e5, #8b5cf6);
        color: white;
      }
    </style>

    <button class="hacktrack-fab" type="button" aria-label="Save hackathon">🚀</button>

    <section class="hacktrack-preview" aria-live="polite">
      <p class="title" data-preview="title"></p>
      <div class="row" data-row="deadline"><span class="label">📅 Deadline</span><span class="value" data-preview="deadline"></span></div>
      <div class="row" data-row="prize"><span class="label">💰 Prize Pool</span><span class="value" data-preview="prize"></span></div>
      <span class="countdown-chip" data-preview="countdown"></span>
      <div class="actions">
        <button type="button" class="btn btn-cancel" data-action="cancel">Cancel</button>
        <button type="button" class="btn btn-save" data-action="save">Save</button>
      </div>
    </section>
  `;

  const fabButton = shadowRoot.querySelector(".hacktrack-fab");
  const preview = shadowRoot.querySelector(".hacktrack-preview");

  updateFabOffset(root);

  fabButton.addEventListener("mouseenter", () => {
    showFab(root);
  });

  fabButton.addEventListener("click", () => {
    openPreview(root);
  });

  preview.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const action = target.dataset.action;
    if (action === "cancel") {
      closePreview(root);
      return;
    }

    if (action === "save") {
      await saveFromPreview(root, fabButton);
    }
  });

  const requestVisible = () => {
    if (window.scrollY >= SCROLL_TRIGGER_PX) {
      showFab(root);
      return;
    }

    hideFab(root);
  };

  window.addEventListener(
    "scroll",
    () => {
      requestVisible();
    },
    { passive: true }
  );

  window.addEventListener(
    "mousemove",
    () => {
      if (state.inactiveTimer) {
        window.clearTimeout(state.inactiveTimer);
      }

      state.inactiveTimer = window.setTimeout(() => {
        if (!state.modalOpen && state.isVisible) {
          hideFab(root);
        }
      }, state.hideTimeoutMs);

      if (!state.modalOpen && window.scrollY >= SCROLL_TRIGGER_PX) {
        showFab(root);
      }
    },
    { passive: true }
  );

  window.addEventListener("resize", () => {
    updateFabOffset(root);
  });

  window.setTimeout(() => updateFabOffset(root), 1200);
  requestVisible();
}

if (isHackathonPage()) {
  injectUi();
}
