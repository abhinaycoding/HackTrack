const STORAGE_KEY = "hackathons";

const form = document.getElementById("hackathon-form");
const nameInput = document.getElementById("name");
const deadlineInput = document.getElementById("deadline");
const prizeInput = document.getElementById("prize");
const list = document.getElementById("hackathon-list");
const emptyState = document.getElementById("empty-state");
const filterGroup = document.getElementById("filter-group");
const sortSelect = document.getElementById("sort-select");

const metricTotal = document.getElementById("metric-total");
const metricUpcoming = document.getElementById("metric-upcoming");
const insightTotal = document.getElementById("insight-total");
const insightUpcoming = document.getElementById("insight-upcoming");
const insightAvg = document.getElementById("insight-avg");
const calendarMonthLabel = document.getElementById("calendar-month-label");
const miniCalendarGrid = document.getElementById("mini-calendar-grid");
const calendarSelectedLabel = document.getElementById("calendar-selected-label");
const calendarDayList = document.getElementById("calendar-day-list");
const calendarPrevMonthButton = document.getElementById("calendar-prev-month");
const calendarNextMonthButton = document.getElementById("calendar-next-month");
const calendarTodayButton = document.getElementById("calendar-today");
const toastStack = document.getElementById("toast-stack");
const splashOverlay = document.getElementById("splash-overlay");
const mainUi = document.getElementById("main-ui");
const exportBtn = document.getElementById("export-btn");
const importBtn = document.getElementById("import-btn");
const importFile = document.getElementById("import-file");
const clearClosedBtn = document.getElementById("clear-closed-btn");

const now = new Date();

const uiState = {
  filter: "all",
  sort: "deadline",
  search: "",
  expandedId: null,
  countdownTimer: null,
  data: [],
  selectedCalendarDate: null,
  calendarViewYear: now.getFullYear(),
  calendarViewMonthIndex: now.getMonth()
};

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SPLASH_SEEN_KEY = "hacktrack_splash_seen_v1";

function getHackathonKey(hackathon) {
  return hackathon.id || `${hackathon.name}::${hackathon.deadline}::${hackathon.createdAt || 0}`;
}

function toDeadlineEnd(deadline) {
  if (!deadline) {
    return null;
  }

  return new Date(`${deadline}T23:59:59`);
}

function hasValidDeadline(deadline) {
  const date = toDeadlineEnd(deadline);
  return date instanceof Date && !Number.isNaN(date.getTime());
}

function getDiffHours(deadline) {
  const endDate = toDeadlineEnd(deadline);
  if (!(endDate instanceof Date) || Number.isNaN(endDate.getTime())) {
    return null;
  }

  return Math.floor((endDate.getTime() - Date.now()) / (1000 * 60 * 60));
}

function formatDeadline(dateValue) {
  if (!hasValidDeadline(dateValue)) {
    return "Not detected";
  }

  const date = new Date(`${dateValue}T00:00:00`);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthContext(year, monthIndex) {
  return {
    year,
    monthIndex,
    daysInMonth: new Date(year, monthIndex + 1, 0).getDate(),
    firstWeekday: new Date(year, monthIndex, 1).getDay()
  };
}

function shiftCalendarMonth(offset) {
  const next = new Date(uiState.calendarViewYear, uiState.calendarViewMonthIndex + offset, 1);
  uiState.calendarViewYear = next.getFullYear();
  uiState.calendarViewMonthIndex = next.getMonth();
}

function getHackathonsByDate() {
  const byDate = new Map();
  uiState.data.forEach((item) => {
    if (!hasValidDeadline(item.deadline)) {
      return;
    }

    const dateKey = item.deadline;
    if (!byDate.has(dateKey)) {
      byDate.set(dateKey, []);
    }

    byDate.get(dateKey).push(item);
  });

  return byDate;
}

function getCountdown(deadline) {
  const hours = getDiffHours(deadline);

  if (hours === null) {
    return { label: "No deadline", tone: "yellow" };
  }

  if (hours <= 0) {
    return { label: "Closed", tone: "red" };
  }

  const days = Math.floor(hours / 24);
  const remainHours = Math.max(0, hours % 24);
  const label = days > 0 ? `${days}d ${remainHours}h left` : `${Math.max(1, hours)}h left`;

  if (hours < 24) {
    return { label, tone: "red" };
  }

  if (hours < 72) {
    return { label, tone: "yellow" };
  }

  return { label, tone: "green" };
}

function getStatus(deadline) {
  const hours = getDiffHours(deadline);
  if (hours === null) {
    return { label: "Upcoming", className: "status-pill status-upcoming" };
  }

  if (hours <= 0) {
    return { label: "Missed", className: "status-pill status-missed" };
  }

  if (hours < 24) {
    return { label: "Urgent", className: "status-pill status-urgent" };
  }

  return { label: "Upcoming", className: "status-pill status-upcoming" };
}

function showToast(message) {
  if (!toastStack) {
    return;
  }

  const toast = document.createElement("div");
  toast.className = "toast-item";
  toast.textContent = message;
  toastStack.appendChild(toast);

  window.setTimeout(() => {
    toast.style.transition = "opacity 180ms ease, transform 180ms ease";
    toast.style.opacity = "0";
    toast.style.transform = "translateY(4px)";
    window.setTimeout(() => {
      toast.remove();
    }, 190);
  }, 1700);
}

function fireConfetti() {
  const colors = ['#ece2c7', '#e7aaaa', '#df8f93', '#d8747b', '#c9636a'];
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '9999';
  document.body.appendChild(container);

  for (let i = 0; i < 50; i++) {
    const confetti = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    const left = Math.random() * 100;
    const size = Math.random() * 6 + 4;
    const duration = Math.random() * 1.5 + 1;
    const delay = Math.random() * 0.2;
    
    confetti.style.position = 'absolute';
    confetti.style.left = `${left}%`;
    confetti.style.top = '-10px';
    confetti.style.width = `${size}px`;
    confetti.style.height = `${size * 1.5}px`;
    confetti.style.backgroundColor = color;
    confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    
    container.appendChild(confetti);

    confetti.animate([
      { transform: `translate3d(0, 0, 0) rotate(0deg)`, opacity: 1 },
      { transform: `translate3d(${Math.random() * 100 - 50}px, ${window.innerHeight}px, 0) rotate(${Math.random() * 720}deg)`, opacity: 0 }
    ], {
      duration: duration * 1000,
      delay: delay * 1000,
      easing: 'cubic-bezier(.37,0,.63,1)',
      fill: 'forwards'
    });
  }

  setTimeout(() => container.remove(), 3000);
}

function runSplashScreen() {
  if (!(splashOverlay instanceof HTMLElement) || !(mainUi instanceof HTMLElement)) {
    return;
  }

  const hasSeenSplash = window.localStorage.getItem(SPLASH_SEEN_KEY) === "1";

  if (hasSeenSplash) {
    mainUi.classList.remove("splash-blur");
    splashOverlay.remove();
    return;
  }

  splashOverlay.classList.add("is-visible");

  window.setTimeout(() => {
    splashOverlay.classList.add("is-exit");
    mainUi.classList.remove("splash-blur");
  }, 650);

  window.setTimeout(() => {
    splashOverlay.remove();
  }, 900);

  window.localStorage.setItem(SPLASH_SEEN_KEY, "1");
}

function getNextUpcomingKey(hackathons) {
  let nextItem = null;
  let minTime = Number.POSITIVE_INFINITY;

  hackathons.forEach((item) => {
    const end = toDeadlineEnd(item.deadline);
    if (!(end instanceof Date) || Number.isNaN(end.getTime())) {
      return;
    }

    const deadlineTs = end.getTime();
    if (deadlineTs <= Date.now()) {
      return;
    }

    if (deadlineTs < minTime) {
      minTime = deadlineTs;
      nextItem = item;
    }
  });

  return nextItem ? getHackathonKey(nextItem) : null;
}

function countdownClass(tone) {
  if (tone === "red") {
    return "rounded-full border border-red-400/40 bg-red-500/20 px-2 py-0.5 text-[9px] font-bold text-red-300";
  }

  if (tone === "yellow") {
    return "rounded-full border border-yellow-400/50 bg-gradient-to-r from-yellow-500/25 to-amber-500/15 px-2 py-0.5 text-[9px] font-bold text-yellow-300";
  }

  return "rounded-full border border-emerald-400/40 bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-300";
}

function parsePrizeValue(prizeText) {
  if (!prizeText) {
    return 0;
  }

  const raw = String(prizeText).toLowerCase().replace(/,/g, "");
  const numberMatch = raw.match(/(\d+(?:\.\d+)?)/);
  if (!numberMatch) {
    return 0;
  }

  let value = Number(numberMatch[1]);
  if (raw.includes("crore") || raw.includes(" cr")) {
    value *= 10000000;
  } else if (raw.includes("lakh") || raw.includes("lac")) {
    value *= 100000;
  } else if (raw.includes("k")) {
    value *= 1000;
  } else if (raw.includes("m")) {
    value *= 1000000;
  }

  return value;
}

function getHackathons() {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
      resolve([]);
      return;
    }
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      if (chrome.runtime.lastError) {
        console.error("Popup Storage Get Error:", chrome.runtime.lastError);
        resolve([]);
      } else {
        resolve(Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : []);
      }
    });
  });
}

function saveHackathons(hackathons) {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
      resolve();
      return;
    }
    chrome.storage.local.set({ [STORAGE_KEY]: hackathons }, () => {
      if (chrome.runtime.lastError) {
        console.error("Popup Storage Set Error:", chrome.runtime.lastError);
      }
      resolve();
    });
  });
}

function getActiveTabInfo() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs && tabs[0];
      if (chrome.runtime.lastError || !activeTab) {
        resolve({ title: "", url: "" });
        return;
      }

      resolve({
        title: String(activeTab.title || ""),
        url: String(activeTab.url || "")
      });
    });
  });
}

function filteredAndSortedHackathons(hackathons) {
  let rows = [...hackathons];

  if (uiState.filter === "registered") {
    rows = rows.filter((item) => item.registered);
  } else if (uiState.filter === "not_registered") {
    rows = rows.filter((item) => !item.registered);
  } else if (uiState.filter === "ending_soon") {
    rows = rows.filter((item) => {
      const hours = getDiffHours(item.deadline);
      return hours !== null && hours > 0 && hours < 72;
    });
  }

  if (uiState.search.trim()) {
    const query = uiState.search.toLowerCase();
    rows = rows.filter((item) => {
      const matchesName = item.name.toLowerCase().includes(query);
      const matchesTag = item.tags && item.tags.some(tag => tag.toLowerCase().includes(query));
      return matchesName || matchesTag;
    });
  }

  if (uiState.sort === "deadline") {
    rows.sort((a, b) => {
      const aDate = toDeadlineEnd(a.deadline);
      const bDate = toDeadlineEnd(b.deadline);

      const aTime = aDate && !Number.isNaN(aDate.getTime()) ? aDate.getTime() : Number.POSITIVE_INFINITY;
      const bTime = bDate && !Number.isNaN(bDate.getTime()) ? bDate.getTime() : Number.POSITIVE_INFINITY;

      return aTime - bTime;
    });
  } else if (uiState.sort === "prize") {
    rows.sort((a, b) => parsePrizeValue(b.prize) - parsePrizeValue(a.prize));
  } else {
    rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  return rows;
}

function updateFilterChips() {
  const counts = {
    all: uiState.data.length,
    registered: uiState.data.filter((item) => item.registered).length,
    not_registered: uiState.data.filter((item) => !item.registered).length,
    ending_soon: uiState.data.filter((item) => {
      const hours = getDiffHours(item.deadline);
      return hours !== null && hours > 0 && hours < 72;
    }).length
  };

  filterGroup.querySelectorAll(".filter-chip").forEach((chip) => {
    const filterKey = chip.dataset.filter || "all";
    const label = chip.dataset.label || chip.textContent.trim();
    const count = counts[filterKey] || 0;
    const previousCount = Number(chip.dataset.badgeCount ?? count);
    const isActive = chip.dataset.filter === uiState.filter;
    chip.className = isActive
      ? "filter-chip active ui-button pulse-chip inline-flex items-center gap-1 rounded-full border border-yellow-500/50 bg-gradient-to-r from-yellow-500/20 to-amber-500/10 px-2.5 py-1 text-[10px] font-bold text-yellow-300 shadow-[0_0_15px_rgba(251,191,36,0.15)]"
      : "filter-chip ui-button pulse-chip inline-flex items-center gap-1 rounded-full border border-gray-700/80 bg-gray-800/50 px-2.5 py-1 text-[10px] font-semibold text-gray-300 hover:border-yellow-500/30 hover:bg-yellow-500/5";

    chip.textContent = "";
    const labelNode = document.createElement("span");
    labelNode.textContent = label;
    const countBadge = document.createElement("span");
    countBadge.className = "filter-chip-badge";
    countBadge.textContent = String(count);
    if (previousCount !== count) {
      countBadge.classList.add("bump");
    }
    chip.dataset.badgeCount = String(count);
    chip.append(labelNode, countBadge);
  });
}

function buildCard(hackathon, nextUpcomingKey) {
  const card = document.createElement("li");
  const key = getHackathonKey(hackathon);
  const expanded = uiState.expandedId === key;
  const countdown = getCountdown(hackathon.deadline);
  const status = getStatus(hackathon.deadline);

  card.dataset.hackathonKey = key;
  card.className =
    "glass card-hover group relative rounded-xl border border-yellow-500/10 p-3 shadow-md transition-all duration-300 hover:shadow-[0_10px_30px_rgba(0,0,0,0.3),0_0_20px_rgba(251,191,36,0.06)]";
  if (nextUpcomingKey && key === nextUpcomingKey) {
    card.classList.add("next-upcoming-highlight");
  }

  const top = document.createElement("div");
  top.className = "flex items-start justify-between gap-2 pr-6";

  const titleWrap = document.createElement("div");
  titleWrap.className = "min-w-0 flex-1";
  const title = document.createElement("span");
  title.className = "text-xs font-bold text-gray-100 flex items-center min-w-0";

  const titleText = document.createElement("button");
  titleText.type = "button";
  titleText.dataset.action = "toggle-expand";
  titleText.className = "text-left transition hover:text-yellow-300 flex items-start gap-1.5 group/expand focus:outline-none min-w-0 flex-1";
  titleText.innerHTML = `<span class="block min-w-0 break-words leading-snug line-clamp-2">${hackathon.name}</span><span class="shrink-0 pt-[1px] text-[9px] text-gray-500 transform transition-transform duration-200 ${expanded ? 'rotate-180 text-yellow-400' : 'group-hover/expand:text-yellow-400'}">▼</span>`;

  title.appendChild(titleText);

  const regLink = document.createElement("button");
  regLink.type = "button";
  regLink.dataset.action = "open-register";
  regLink.className = "ml-1 text-yellow-500 hover:text-yellow-400 transition-colors shrink-0 text-[10px]";
  regLink.innerHTML = "🔗";
  regLink.title = "Open Registration Page";
  if (!hackathon.sourceUrl) {
    regLink.classList.add("hidden");
  }
  title.appendChild(regLink);

  const metaLine = document.createElement("div");
  metaLine.className = "mt-1.5 flex items-center gap-2 text-[10px] text-gray-400";
  metaLine.innerHTML = `<span class="text-yellow-500/70">📅</span>${formatDeadline(hackathon.deadline)} <span class="text-yellow-500/70 ml-1">💰</span>${hackathon.prize || "N/A"}`;

  const statusPill = document.createElement("span");
  statusPill.className = status.className + " text-[8px] px-1.5 py-0.5";
  statusPill.textContent = status.label;

  const metaRow = document.createElement("div");
  metaRow.className = "mt-2 flex items-center gap-1.5";
  metaRow.appendChild(statusPill);

  const badge = document.createElement("span");
  badge.className = `${countdownClass(countdown.tone)} shrink-0 whitespace-nowrap self-start text-[9px] px-2 py-0.5`;
  badge.dataset.role = "countdown";
  badge.textContent = `⏳ ${countdown.label}`;

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.dataset.action = "delete";
  deleteButton.className =
    "ui-button absolute right-2 top-2 rounded p-1 text-[10px] text-gray-500 opacity-40 hover:text-red-400 hover:opacity-100 hover:bg-red-500/10 transition-all";
  deleteButton.textContent = "🗑️";

  // Progress Bar
  const checklist = hackathon.checklist || ["Team Formed", "Idea Finalized", "Design Complete", "Development Started", "Project Submitted"].map(t => ({ task: t, completed: false }));
  const completedCount = checklist.filter(t => t.completed).length;
  const progressPercent = checklist.length ? Math.round((completedCount / checklist.length) * 100) : 0;

  const progressContainer = document.createElement("div");
  progressContainer.className = "mt-2 w-full bg-gray-800/60 rounded-full h-1.5 overflow-hidden border border-yellow-500/10";
  const progressBar = document.createElement("div");
  progressBar.className = "h-full bg-gradient-to-r from-yellow-600 to-yellow-400 transition-all duration-500 ease-out shadow-[0_0_8px_rgba(251,191,36,0.3)]";
  progressBar.style.width = `${progressPercent}%`;
  progressContainer.appendChild(progressBar);

  // Tags Section (Preview) - show only first 2 tags
  const tags = hackathon.tags || [];
  let tagsEl = "";
  if (tags.length > 0) {
    const tagsRow = document.createElement("div");
    tagsRow.className = "mt-2 flex flex-wrap gap-1";
    tags.slice(0, 2).forEach(tag => {
      const t = document.createElement("span");
      t.className = "px-1.5 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400/90 text-[8px] font-bold uppercase tracking-wider";
      t.textContent = tag;
      tagsRow.appendChild(t);
    });
    if (tags.length > 2) {
      const more = document.createElement("span");
      more.className = "text-[8px] text-gray-500";
      more.textContent = `+${tags.length - 2}`;
      tagsRow.appendChild(more);
    }
    tagsEl = tagsRow;
  }

  titleWrap.append(title, metaLine, metaRow, progressContainer);
  if (tagsEl) titleWrap.appendChild(tagsEl);
  top.append(titleWrap, badge);

  const actions = document.createElement("div");
  actions.className = expanded
    ? "mt-3 flex flex-wrap items-center gap-1.5"
    : "mt-3 hidden flex-wrap items-center gap-1.5 group-hover:flex";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.dataset.action = "edit";
  editButton.className =
    "ui-button rounded bg-gray-800/80 border border-gray-700/50 px-2 py-1 text-[10px] font-semibold text-gray-200 hover:bg-gray-700 hover:border-yellow-500/30 transition-all";
  editButton.textContent = "✏️ Edit";

  const registerButton = document.createElement("button");
  registerButton.type = "button";
  registerButton.dataset.action = "toggle-registered";
  registerButton.className = hackathon.registered
    ? "ui-button rounded bg-emerald-600/90 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)] transition-all"
    : "ui-button rounded bg-gray-800/80 border border-yellow-500/40 px-2 py-1 text-[10px] font-semibold text-yellow-300 hover:bg-yellow-500/10 transition-all";
  registerButton.textContent = hackathon.registered ? "✔ Reg" : "Mark Reg";

  const registerLinkButton = document.createElement("button");
  registerLinkButton.type = "button";
  registerLinkButton.dataset.action = "open-register";
  registerLinkButton.className = hackathon.sourceUrl
    ? "ui-button rounded bg-gradient-to-r from-yellow-600 to-yellow-500 px-2 py-1 text-[10px] font-bold text-gray-900 hover:from-yellow-500 hover:to-yellow-400 shadow-[0_2px_10px_rgba(251,191,36,0.25)] transition-all"
    : "ui-button rounded bg-gray-700/50 px-2 py-1 text-[10px] font-semibold text-gray-500 cursor-not-allowed";
  registerLinkButton.textContent = "Open";
  if (!hackathon.sourceUrl) {
    registerLinkButton.disabled = true;
  }

  actions.append(editButton, registerButton, registerLinkButton);

  const inlineEdit = document.createElement("div");
  inlineEdit.dataset.role = "inline-edit";
  inlineEdit.className = "mt-2 hidden grid grid-cols-6 gap-1.5";

  const nameEdit = document.createElement("input");
  nameEdit.type = "text";
  nameEdit.value = hackathon.name;
  nameEdit.dataset.role = "edit-name";
  nameEdit.className =
    "ui-input col-span-3 rounded border border-yellow-500/20 bg-gray-900/80 px-2 py-1 text-[10px] text-white focus:outline-none focus:border-yellow-500";

  const deadlineEdit = document.createElement("input");
  deadlineEdit.type = "date";
  deadlineEdit.value = hackathon.deadline;
  deadlineEdit.dataset.role = "edit-deadline";
  deadlineEdit.className =
    "ui-input col-span-2 rounded border border-yellow-500/20 bg-gray-900/80 px-2 py-1 text-[10px] text-white focus:outline-none focus:border-yellow-500";

  const saveEdit = document.createElement("button");
  saveEdit.type = "button";
  saveEdit.dataset.action = "save-edit";
  saveEdit.className =
    "ui-button col-span-1 rounded bg-gradient-to-r from-yellow-600 to-yellow-500 px-2 py-1 text-[10px] font-bold text-gray-900 hover:from-yellow-500 hover:to-yellow-400";
  saveEdit.textContent = "Save";

  const prizeEdit = document.createElement("input");
  prizeEdit.type = "text";
  prizeEdit.value = hackathon.prize || "";
  prizeEdit.placeholder = "Prize";
  prizeEdit.dataset.role = "edit-prize";
  prizeEdit.className =
    "ui-input col-span-4 rounded border border-yellow-500/20 bg-gray-900/80 px-2 py-1 text-[10px] text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500";

  const cancelEdit = document.createElement("button");
  cancelEdit.type = "button";
  cancelEdit.dataset.action = "cancel-edit";
  cancelEdit.className =
    "ui-button col-span-2 rounded bg-gray-800 border border-gray-700 px-2 py-1 text-[10px] font-semibold text-gray-300 hover:bg-gray-700";
  cancelEdit.textContent = "Cancel";

  inlineEdit.append(nameEdit, deadlineEdit, saveEdit, prizeEdit, cancelEdit);

  const expansion = document.createElement("div");
  expansion.className = expanded ? "mt-3 space-y-2" : "hidden";

  // Notes Section
  const notesWrap = document.createElement("div");
  notesWrap.className = "rounded-lg bg-gray-900/40 p-2 border border-yellow-500/10";
  const notesHeader = document.createElement("h4");
  notesHeader.className = "text-[9px] font-bold uppercase tracking-widest text-yellow-500/70 mb-1";
  notesHeader.textContent = "Notes";
  const notesArea = document.createElement("textarea");
  notesArea.className = "w-full bg-transparent text-[10px] text-gray-300 border-none focus:ring-0 p-0 resize-none min-h-[40px] placeholder-gray-600";
  notesArea.placeholder = "Add notes...";
  notesArea.value = hackathon.notes || "";
  notesArea.dataset.role = "notes-area";

  const saveNotesBtn = document.createElement("button");
  saveNotesBtn.className = "mt-1 text-[9px] text-yellow-400 hover:text-yellow-300 font-bold";
  saveNotesBtn.textContent = "Save";
  saveNotesBtn.dataset.action = "save-notes";

  notesWrap.append(notesHeader, notesArea, saveNotesBtn);

  // Checklist Section
  const checklistWrap = document.createElement("div");
  checklistWrap.className = "rounded-lg bg-gray-900/20 p-2 border border-yellow-500/20 backdrop-blur-sm";
  const checklistHeader = document.createElement("div");
  checklistHeader.className = "flex items-center justify-between mb-2";
  checklistHeader.innerHTML = `
    <h4 class="text-[9px] font-bold uppercase tracking-widest text-yellow-500/70">Checklist</h4>
    <span class="text-[9px] text-yellow-500/50 font-semibold">${completedCount}/${checklist.length}</span>
  `;

  const checklistItems = document.createElement("ul");
  checklistItems.className = "space-y-1";

  checklist.forEach((item, idx) => {
    const li = document.createElement("li");
    li.className = "flex items-center justify-between gap-1 text-[10px] text-gray-200 group/item";

    const left = document.createElement("div");
    left.className = "flex items-center gap-1.5";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = item.completed;
    cb.className = "rounded border-yellow-500/40 bg-gray-800/70 text-yellow-400 focus:ring-yellow-500/50 cursor-pointer w-3 h-3";
    cb.onchange = async () => {
      const previouslyCompleted = checklist.filter(t => t.completed).length;
      item.completed = cb.checked;
      const currentlyCompleted = checklist.filter(t => t.completed).length;

      const targetIdx = uiState.data.findIndex(h => getHackathonKey(h) === key);
      if (targetIdx >= 0) {
        uiState.data[targetIdx].checklist = checklist;
        await persistData();

        if (currentlyCompleted === checklist.length && previouslyCompleted < checklist.length) {
          fireConfetti();
        }

        renderList();
        updateInsights();
      }
    };

    const span = document.createElement("span");
    span.textContent = item.task;
    if (item.completed) span.className = "line-through text-gray-500";

    left.append(cb, span);

    const delTask = document.createElement("button");
    delTask.className = "opacity-50 group-hover/item:opacity-100 text-gray-500 hover:text-red-400 text-[10px] transition-opacity";
    delTask.innerHTML = "×";
    delTask.title = "Remove";
    delTask.onclick = async () => {
      checklist.splice(idx, 1);
      const targetIdx = uiState.data.findIndex(h => getHackathonKey(h) === key);
      if (targetIdx >= 0) {
        uiState.data[targetIdx].checklist = checklist;
        await persistData();
        renderList();
        updateInsights();
      }
    };

    li.append(left, delTask);
    checklistItems.appendChild(li);
  });

  const addTaskRow = document.createElement("div");
  addTaskRow.className = "mt-2 flex gap-1";
  const addTaskInput = document.createElement("input");
  addTaskInput.type = "text";
  addTaskInput.placeholder = "New task...";
  addTaskInput.className = "flex-1 bg-gray-800/35 border border-yellow-500/30 rounded px-2 py-1 text-[9px] text-white focus:outline-none placeholder-gray-500";

  const addTaskBtn = document.createElement("button");
  addTaskBtn.className = "bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 px-2 py-1 rounded text-[9px] font-bold border border-yellow-500/35";
  addTaskBtn.textContent = "+";
  addTaskBtn.onclick = async () => {
    const val = addTaskInput.value.trim();
    if (!val) return;
    checklist.push({ task: val, completed: false });
    const targetIdx = uiState.data.findIndex(h => getHackathonKey(h) === key);
    if (targetIdx >= 0) {
      uiState.data[targetIdx].checklist = checklist;
      await persistData();
      refreshDashboard();
    }
  };

  addTaskInput.onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTaskBtn.click();
    }
  };

  addTaskRow.append(addTaskInput, addTaskBtn);
  checklistWrap.append(checklistHeader, checklistItems, addTaskRow);

  // Tags Editor Section
  const tagsEditWrap = document.createElement("div");
  tagsEditWrap.className = "rounded-lg bg-gray-900/40 p-2 border border-yellow-500/10";
  const tagsEditHeader = document.createElement("h4");
  tagsEditHeader.className = "text-[9px] font-bold uppercase tracking-widest text-yellow-500/70 mb-1";
  tagsEditHeader.textContent = "Tags";

  const tagsList = document.createElement("div");
  tagsList.className = "flex flex-wrap gap-1 mb-2";

  tags.forEach((tag, tIdx) => {
    const tagChip = document.createElement("span");
    tagChip.className = "flex items-center gap-0.5 group/tag bg-yellow-500/10 border border-yellow-500/25 text-yellow-400 px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase";
    tagChip.innerHTML = `<span>${tag}</span><button class="text-yellow-500/60 hover:text-red-400 opacity-60 group-hover/tag:opacity-100">×</button>`;
    tagChip.querySelector("button").onclick = async () => {
      tags.splice(tIdx, 1);
      const targetIdx = uiState.data.findIndex(h => getHackathonKey(h) === key);
      if (targetIdx >= 0) {
        uiState.data[targetIdx].tags = tags;
        await persistData();
        renderList();
      }
    };
    tagsList.appendChild(tagChip);
  });

  const addTagRow = document.createElement("div");
  addTagRow.className = "flex gap-1";
  const addTagInput = document.createElement("input");
  addTagInput.type = "text";
  addTagInput.placeholder = "Add tag...";
  addTagInput.className = "flex-1 bg-gray-800/50 border border-yellow-500/20 rounded px-2 py-1 text-[9px] text-white focus:outline-none uppercase placeholder-gray-600";

  const addTagBtn = document.createElement("button");
  addTagBtn.className = "bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/25 px-2 py-1 rounded text-[9px] font-bold border border-yellow-500/20";
  addTagBtn.textContent = "Add";

  const handleAddTag = async () => {
    const val = addTagInput.value.trim().toUpperCase();
    if (!val || tags.includes(val)) return;
    tags.push(val);
    const targetIdx = uiState.data.findIndex(h => getHackathonKey(h) === key);
    if (targetIdx >= 0) {
      uiState.data[targetIdx].tags = tags;
      await persistData();
      renderList();
    }
  };

  addTagBtn.onclick = handleAddTag;
  addTagInput.onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  addTagRow.append(addTagInput, addTagBtn);
  tagsEditWrap.append(tagsEditHeader, tagsList, addTagRow);

  expansion.append(notesWrap, checklistWrap, tagsEditWrap);

  card.append(deleteButton, top, actions, inlineEdit, expansion);
  return card;
}

function renderList() {
  const rows = filteredAndSortedHackathons(uiState.data);
  const nextUpcomingKey = getNextUpcomingKey(rows);

  if (!rows.length) {
    emptyState.classList.remove("hidden");
    list.replaceChildren();
  } else {
    emptyState.classList.add("hidden");
    
    // Performance: Only rebuild if the row count or order changed, 
    // or if we are toggling expansion. Otherwise, just update specific nodes.
    const fragment = document.createDocumentFragment();
    rows.forEach((hackathon) => fragment.appendChild(buildCard(hackathon, nextUpcomingKey)));
    list.replaceChildren(fragment);
  }

  if (nextUpcomingKey) {
    const target = list.querySelector(`[data-hackathon-key='${nextUpcomingKey}']`);
    if (target instanceof HTMLElement) {
      target.classList.add("next-upcoming-highlight");
    }
  }
}

function updateInsights() {
  const all = uiState.data;
  let activeCount = 0;
  let upcomingCount = 0;
  let activeHoursSum = 0;

  all.forEach((item) => {
    const hours = getDiffHours(item.deadline);
    if (hours === null || hours <= 0) {
      return;
    }

    activeCount += 1;
    activeHoursSum += Math.max(0, hours);

    if (hours < 72) {
      upcomingCount += 1;
    }
  });

  const avgHours = activeCount ? Math.round(activeHoursSum / activeCount) : 0;

  metricTotal.textContent = String(all.length);
  metricUpcoming.textContent = String(upcomingCount);
  insightTotal.textContent = String(all.length);
  insightUpcoming.textContent = String(upcomingCount);
  insightAvg.textContent = `${avgHours}h`;
}

function renderSelectedDateHackathons() {
  if (!calendarSelectedLabel || !calendarDayList) {
    return;
  }

  const selected = uiState.selectedCalendarDate;
  calendarDayList.innerHTML = "";

  if (!selected) {
    calendarSelectedLabel.textContent = "Select a date";
    return;
  }

  const matches = uiState.data.filter((item) => item.deadline === selected);
  const selectedDate = new Date(`${selected}T00:00:00`);
  calendarSelectedLabel.textContent = selectedDate.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });

  if (!matches.length) {
    const empty = document.createElement("li");
    empty.className = "text-gray-400";
    empty.textContent = "No hackathons";
    calendarDayList.appendChild(empty);
    return;
  }

  matches
    .slice()
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    .forEach((item) => {
      const row = document.createElement("li");
      row.className = "truncate";
      row.textContent = `• ${item.name}`;
      calendarDayList.appendChild(row);
    });

}

function renderMiniCalendar() {
  if (!miniCalendarGrid || !calendarMonthLabel) {
    return;
  }

  const month = getMonthContext(uiState.calendarViewYear, uiState.calendarViewMonthIndex);
  const byDate = getHackathonsByDate();

  calendarMonthLabel.textContent = new Date(month.year, month.monthIndex, 1).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric"
  });

  if (uiState.selectedCalendarDate) {
    const selectedDate = new Date(`${uiState.selectedCalendarDate}T00:00:00`);
    const isCurrentMonthSelected =
      selectedDate.getFullYear() === month.year && selectedDate.getMonth() === month.monthIndex;
    if (!isCurrentMonthSelected) {
      uiState.selectedCalendarDate = null;
    }
  }

  if (!uiState.selectedCalendarDate) {
    const todayKey = formatDateKey(new Date());
    if (byDate.has(todayKey)) {
      uiState.selectedCalendarDate = todayKey;
    }
  }

  miniCalendarGrid.innerHTML = "";
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < month.firstWeekday; index += 1) {
    const spacer = document.createElement("div");
    spacer.className = "mini-calendar-empty";
    fragment.appendChild(spacer);
  }

  for (let day = 1; day <= month.daysInMonth; day += 1) {
    const dateKey = `${month.year}-${String(month.monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const hasEvents = byDate.has(dateKey);
    const isSelected = uiState.selectedCalendarDate === dateKey;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "mini-calendar-day";
    button.dataset.date = dateKey;
    button.dataset.hasEvents = hasEvents ? "true" : "false";
    button.dataset.selected = isSelected ? "true" : "false";
    const tooltip = hasEvents
      ? `${byDate.get(dateKey).length} hackathon(s)`
      : WEEKDAY_NAMES[new Date(`${dateKey}T00:00:00`).getDay()];
    button.dataset.tooltip = tooltip;
    button.title = tooltip;
    button.textContent = String(day);

    fragment.appendChild(button);
  }

  miniCalendarGrid.appendChild(fragment);
  renderSelectedDateHackathons();
}

function refreshDashboard() {
  updateFilterChips();
  renderList();
  updateInsights();
  renderMiniCalendar();
}

async function loadData() {
  const hackathons = await getHackathons();
  uiState.data = hackathons.map((item) => ({
    ...item,
    prize: item.prize || "Not specified",
    registered: Boolean(item.registered)
  }));
  refreshDashboard();
}

async function persistData() {
  await saveHackathons(uiState.data);
}

async function prefillHackathonNameFromTab() {
  const { title } = await getActiveTabInfo();
  if (title && !nameInput.value.trim()) {
    nameInput.value = title;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = nameInput.value.trim();
  const deadline = deadlineInput.value.trim();
  const prize = prizeInput.value.trim();
  const { url: currentUrl } = await getActiveTabInfo();

  if (!name) {
    return;
  }

  const existingIndex = currentUrl
    ? uiState.data.findIndex((item) => item.sourceUrl && item.sourceUrl === currentUrl)
    : -1;

  if (existingIndex >= 0) {
    const existing = uiState.data[existingIndex];
    uiState.data[existingIndex] = {
      ...existing,
      name,
      sourceUrl: currentUrl,
      deadline: deadline || existing.deadline || "",
      prize: prize || existing.prize || "Not specified",
      updatedAt: Date.now()
    };
  } else {
    const nextHackathon = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
      name,
      registered: false,
      createdAt: Date.now()
    };

    if (currentUrl) {
      nextHackathon.sourceUrl = currentUrl;
    }

    if (deadline) {
      nextHackathon.deadline = deadline;
    }

    if (prize) {
      nextHackathon.prize = prize;
    }

    uiState.data.push(nextHackathon);
  }

  await persistData();

  const submitBtn = form.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn.textContent;
  submitBtn.textContent = "Saved!";
  submitBtn.classList.remove("from-yellow-600", "to-yellow-500");
  submitBtn.classList.add("bg-emerald-600");

  form.reset();
  refreshDashboard();
  showToast(existingIndex >= 0 ? "Hackathon updated" : "Hackathon saved");

  window.setTimeout(async () => {
    submitBtn.textContent = originalBtnText;
    submitBtn.classList.remove("bg-emerald-600");
    submitBtn.classList.add("from-yellow-600", "to-yellow-500");
    await prefillHackathonNameFromTab();
  }, 1500);
});

filterGroup.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const chip = target.closest("[data-filter]");
  if (!(chip instanceof HTMLElement)) {
    return;
  }

  uiState.filter = chip.dataset.filter || "all";
  refreshDashboard();
});

sortSelect.addEventListener("change", () => {
  uiState.sort = sortSelect.value;
  refreshDashboard();
});

if (miniCalendarGrid) {
  miniCalendarGrid.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const dateButton = target.closest("[data-date]");
    if (!(dateButton instanceof HTMLElement)) {
      return;
    }

    uiState.selectedCalendarDate = dateButton.dataset.date || null;
    renderMiniCalendar();
    if (uiState.selectedCalendarDate) {
      showToast("Filtered by selected date");
    }
  });
}

if (calendarPrevMonthButton) {
  calendarPrevMonthButton.addEventListener("click", () => {
    shiftCalendarMonth(-1);
    renderMiniCalendar();
  });
}

if (calendarNextMonthButton) {
  calendarNextMonthButton.addEventListener("click", () => {
    shiftCalendarMonth(1);
    renderMiniCalendar();
  });
}

if (calendarTodayButton) {
  calendarTodayButton.addEventListener("click", () => {
    const today = new Date();
    uiState.calendarViewYear = today.getFullYear();
    uiState.calendarViewMonthIndex = today.getMonth();
    uiState.selectedCalendarDate = formatDateKey(today);
    renderMiniCalendar();
  });
}

list.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const actionElement = target.closest("[data-action]");
  if (!(actionElement instanceof HTMLElement)) {
    return;
  }

  const card = actionElement.closest("li");
  if (!(card instanceof HTMLElement)) {
    return;
  }

  const key = card.dataset.hackathonKey;
  if (!key) {
    return;
  }

  const index = uiState.data.findIndex((item) => getHackathonKey(item) === key);
  if (index < 0) {
    return;
  }

  const action = actionElement.dataset.action;

  if (action === "toggle-expand") {
    uiState.expandedId = uiState.expandedId === key ? null : key;
    renderList();
    updateInsights();
    return;
  }

  if (action === "toggle-registered") {
    uiState.data[index].registered = !uiState.data[index].registered;
    await persistData();
    renderList();
    updateInsights();
    showToast(uiState.data[index].registered ? "Marked as registered" : "Marked as not registered");
    return;
  }

  if (action === "open-register") {
    const sourceUrl = uiState.data[index].sourceUrl;
    if (!sourceUrl) {
      return;
    }

    chrome.tabs.create({ url: sourceUrl });
    showToast("Opening registration page");
    return;
  }

  if (action === "delete") {
    card.style.transition = "opacity 220ms ease, transform 220ms ease";
    card.style.opacity = "0";
    card.style.transform = "translateY(10px)";

    window.setTimeout(async () => {
      uiState.data.splice(index, 1);
      await persistData();
      renderList();
      updateInsights();
      showToast("Hackathon deleted");
    }, 220);
    return;
  }

  if (action === "edit") {
    const editBox = card.querySelector("[data-role='inline-edit']");
    if (editBox instanceof HTMLElement) {
      editBox.classList.remove("hidden");
    }
    return;
  }

  if (action === "cancel-edit") {
    renderList();
    updateInsights();
    return;
  }

  if (action === "save-edit") {
    const nameEdit = card.querySelector("[data-role='edit-name']");
    const deadlineEdit = card.querySelector("[data-role='edit-deadline']");
    const prizeEdit = card.querySelector("[data-role='edit-prize']");

    if (!(nameEdit instanceof HTMLInputElement)) {
      return;
    }

    if (!(deadlineEdit instanceof HTMLInputElement)) {
      return;
    }

    if (!(prizeEdit instanceof HTMLInputElement)) {
      return;
    }

    const nextName = nameEdit.value.trim();
    const nextDeadline = deadlineEdit.value.trim();
    const nextPrize = prizeEdit.value.trim() || "Not specified";

    if (!nextName) {
      return;
    }

    uiState.data[index] = {
      ...uiState.data[index],
      name: nextName,
      deadline: nextDeadline,
      prize: nextPrize
    };

    await persistData();
    renderList();
    updateInsights();
    showToast("Hackathon updated");
    return;
  }

  if (action === "save-notes") {
    const notesArea = card.querySelector("[data-role='notes-area']");
    if (!(notesArea instanceof HTMLTextAreaElement)) {
      return;
    }

    uiState.data[index].notes = notesArea.value.trim();
    await persistData();
    showToast("Notes saved");
  }
});

list.addEventListener("mouseover", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const card = target.closest("li");
  if (!(card instanceof HTMLElement)) {
    return;
  }

  list.classList.add("has-hovered-card");
  list.querySelectorAll("li").forEach((item) => item.classList.remove("is-hovered"));
  card.classList.add("is-hovered");
});

list.addEventListener("mouseleave", () => {
  list.classList.remove("has-hovered-card");
  list.querySelectorAll("li").forEach((item) => item.classList.remove("is-hovered"));
});

function startCountdownTicker() {
  if (uiState.countdownTimer) {
    window.clearInterval(uiState.countdownTimer);
  }

  uiState.countdownTimer = window.setInterval(() => {
    if (!list.children.length) {
      updateInsights();
      return;
    }

    const itemByKey = new Map();
    uiState.data.forEach((entry) => {
      itemByKey.set(getHackathonKey(entry), entry);
    });

    const rows = list.querySelectorAll("li");
    rows.forEach((row) => {
      if (!(row instanceof HTMLElement)) {
        return;
      }

      const key = row.dataset.hackathonKey;
      const countdownNode = row.querySelector("[data-role='countdown']");
      if (!key || !(countdownNode instanceof HTMLElement)) {
        return;
      }

      const item = itemByKey.get(key);
      if (!item) {
        return;
      }

      const countdown = getCountdown(item.deadline);
      countdownNode.className = countdownClass(countdown.tone);
      countdownNode.dataset.role = "countdown";
      countdownNode.textContent = `⏳ ${countdown.label}`;
    });

    updateInsights();
  }, 1000);
}

function handleExport() {
  const dataStr = JSON.stringify(uiState.data, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hacktrack_backup_${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Data exported");
}

function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const importedData = JSON.parse(e.target.result);
      if (!Array.isArray(importedData)) {
        throw new Error("Invalid format");
      }
      
      // Basic validation and merging
      uiState.data = importedData.map(item => ({
        ...item,
        id: item.id || (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)),
        createdAt: item.createdAt || Date.now()
      }));
      
      await persistData();
      renderList();
      updateInsights();
      showToast("Data imported successfully");
    } catch (err) {
      showToast("Error importing data: " + err.message);
    }
  };
  reader.readAsText(file);
}

async function handleClearClosed() {
  const beforeCount = uiState.data.length;
  if (!beforeCount) {
    showToast("No hackathons to clear");
    return;
  }

  const nextData = uiState.data.filter((item) => {
    if (!hasValidDeadline(item.deadline)) {
      return true;
    }

    const hours = getDiffHours(item.deadline);
    return hours === null || hours > 0;
  });

  const removedCount = beforeCount - nextData.length;
  if (removedCount <= 0) {
    showToast("No closed hackathons found");
    return;
  }

  const shouldClear = window.confirm(
    `Clear ${removedCount} closed hackathon${removedCount === 1 ? "" : "s"}?`
  );
  if (!shouldClear) {
    return;
  }

  uiState.data = nextData;
  uiState.expandedId = null;

  await persistData();
  refreshDashboard();
  showToast(`Cleared ${removedCount} closed hackathon${removedCount === 1 ? "" : "s"}`);
}

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

async function initializePopup() {
  runSplashScreen();
  await Promise.all([loadData(), prefillHackathonNameFromTab()]);
  startCountdownTicker();

  if (exportBtn) exportBtn.addEventListener("click", handleExport);
  if (importBtn) importBtn.addEventListener("click", () => importFile.click());
  if (importFile) importFile.addEventListener("change", handleImport);
  if (clearClosedBtn) clearClosedBtn.addEventListener("click", handleClearClosed);

  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    const debouncedRender = debounce(() => {
      renderList();
    }, 200);
    
    searchInput.addEventListener("input", (e) => {
      uiState.search = e.target.value;
      debouncedRender();
    });
  }

  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === "local" && changes[STORAGE_KEY]) {
        loadData();
      }
    });
  }
}

initializePopup();
