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
  if (!hasValidDeadline(deadline)) {
    return null;
  }

  return Math.floor((toDeadlineEnd(deadline).getTime() - Date.now()) / (1000 * 60 * 60));
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
  const colors = ['#6366f1', '#a855f7', '#ec4899', '#38bdf8', '#fbbf24'];
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
  const candidates = hackathons
    .filter((item) => {
      const hours = getDiffHours(item.deadline);
      return hours !== null && hours > 0;
    })
    .sort((a, b) => toDeadlineEnd(a.deadline).getTime() - toDeadlineEnd(b.deadline).getTime());

  if (!candidates.length) {
    return null;
  }

  return getHackathonKey(candidates[0]);
}

function countdownClass(tone) {
  if (tone === "red") {
    return "rounded-full border border-red-400/40 bg-red-500/20 px-2 py-1 text-xs font-semibold text-red-200";
  }

  if (tone === "yellow") {
    return "rounded-full border border-yellow-400/40 bg-yellow-500/20 px-2 py-1 text-xs font-semibold text-yellow-200";
  }

  return "rounded-full border border-emerald-400/40 bg-emerald-500/20 px-2 py-1 text-xs font-semibold text-emerald-200";
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
  filterGroup.querySelectorAll(".filter-chip").forEach((chip) => {
    const isActive = chip.dataset.filter === uiState.filter;
    chip.className = isActive
      ? "filter-chip ui-button pulse-chip rounded-full border border-indigo-400/40 bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-200"
      : "filter-chip ui-button pulse-chip rounded-full border border-gray-700 bg-gray-800 px-3 py-1 text-xs font-semibold text-gray-200";
  });
}

function buildCard(hackathon) {
  const card = document.createElement("li");
  const key = getHackathonKey(hackathon);
  const expanded = uiState.expandedId === key;
  const countdown = getCountdown(hackathon.deadline);
  const status = getStatus(hackathon.deadline);
  const nextUpcomingKey = getNextUpcomingKey(uiState.data);

  card.dataset.hackathonKey = key;
  card.className =
    "glass card-hover group relative rounded-2xl border border-gray-700 p-3 shadow-md";
  if (nextUpcomingKey && key === nextUpcomingKey) {
    card.classList.add("next-upcoming-highlight");
  }

  const top = document.createElement("div");
  top.className = "flex items-start justify-between gap-3 pr-8";

  const titleWrap = document.createElement("div");
  const title = document.createElement("span");
  title.className = "text-sm font-semibold text-gray-100 flex items-center";
  
  const titleText = document.createElement("button");
  titleText.type = "button";
  titleText.dataset.action = "toggle-expand";
  titleText.className = "text-left transition hover:text-indigo-200 flex items-center gap-2 group/expand focus:outline-none";
  titleText.innerHTML = `<span>${hackathon.name}</span><span class="text-[10px] text-gray-500 transform transition-transform duration-200 ${expanded ? 'rotate-180 text-indigo-400' : 'group-hover/expand:text-indigo-300'}">▼</span>`;
  
  title.appendChild(titleText);

  const regLink = document.createElement("button");
  regLink.type = "button";
  regLink.dataset.action = "open-register";
  regLink.className = "ml-2 text-indigo-400 hover:text-indigo-300 transition-colors shrink-0";
  regLink.innerHTML = "🔗";
  regLink.title = "Open Registration Page";
  if (!hackathon.sourceUrl) {
    regLink.classList.add("hidden");
  }
  title.appendChild(regLink);

  const deadline = document.createElement("p");
  deadline.className = "mt-1 text-xs text-gray-300";
  deadline.textContent = `📅 ${formatDeadline(hackathon.deadline)}`;

  const prize = document.createElement("p");
  prize.className = "mt-1 text-xs text-gray-300";
  prize.textContent = `💰 ${hackathon.prize || "Not detected"}`;

  const statusPill = document.createElement("span");
  statusPill.className = status.className;
  statusPill.textContent = status.label;

  const metaRow = document.createElement("div");
  metaRow.className = "mt-2 flex items-center gap-2";
  metaRow.appendChild(statusPill);

  const badge = document.createElement("span");
  badge.className = countdownClass(countdown.tone);
  badge.dataset.role = "countdown";
  badge.textContent = `⏳ ${countdown.label}`;

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.dataset.action = "delete";
  deleteButton.className =
    "ui-button absolute right-2 top-2 rounded-md p-1 text-sm text-gray-400 opacity-60 hover:text-red-400 hover:opacity-100";
  deleteButton.textContent = "🗑️";

  // Progress Bar
  const checklist = hackathon.checklist || ["Team Formed", "Idea Finalized", "Design Complete", "Development Started", "Project Submitted"].map(t => ({ task: t, completed: false }));
  const completedCount = checklist.filter(t => t.completed).length;
  const progressPercent = checklist.length ? Math.round((completedCount / checklist.length) * 100) : 0;

  const progressContainer = document.createElement("div");
  progressContainer.className = "mt-3 w-full bg-gray-800 rounded-full h-1.5 overflow-hidden";
  const progressBar = document.createElement("div");
  progressBar.className = "h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500 ease-out";
  progressBar.style.width = `${progressPercent}%`;
  progressContainer.appendChild(progressBar);

  const progressText = document.createElement("p");
  progressText.className = "mt-1 text-[10px] text-gray-500 font-medium text-right";
  progressText.textContent = `${progressPercent}% complete`;

  // Tags Section (Preview)
  const tagsRow = document.createElement("div");
  tagsRow.className = "mt-3 flex flex-wrap gap-1";
  const tags = hackathon.tags || [];
  tags.forEach(tag => {
    const t = document.createElement("span");
    t.className = "px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[9px] font-semibold uppercase tracking-wider";
    t.textContent = tag;
    tagsRow.appendChild(t);
  });

  titleWrap.append(title, deadline, prize, metaRow, progressContainer, progressText, (tags.length > 0 ? tagsRow : ""));
  top.append(titleWrap, badge);

  const actions = document.createElement("div");
  actions.className = expanded
    ? "mt-3 flex items-center gap-2"
    : "mt-3 hidden items-center gap-2 group-hover:flex";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.dataset.action = "edit";
  editButton.className =
    "ui-button rounded-lg bg-gray-800 px-2 py-1 text-xs font-semibold text-gray-100 hover:bg-gray-700";
  editButton.textContent = "✏️ Edit";

  const registerButton = document.createElement("button");
  registerButton.type = "button";
  registerButton.dataset.action = "toggle-registered";
  registerButton.className = hackathon.registered
    ? "ui-button rounded-lg bg-emerald-600/90 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-500 shadow-sm"
    : "ui-button rounded-lg bg-gray-800 border border-indigo-500/50 px-2 py-1 text-xs font-semibold text-indigo-100 hover:bg-indigo-600/20 shadow-sm transition-colors";
  registerButton.textContent = hackathon.registered ? "✔ Registered" : "Mark Registered";

  const registerLinkButton = document.createElement("button");
  registerLinkButton.type = "button";
  registerLinkButton.dataset.action = "open-register";
  registerLinkButton.className = hackathon.sourceUrl
    ? "ui-button rounded-lg bg-indigo-600/90 px-2 py-1 text-xs font-semibold text-white hover:bg-indigo-500"
    : "ui-button rounded-lg bg-gray-700/70 px-2 py-1 text-xs font-semibold text-gray-400 cursor-not-allowed";
  registerLinkButton.textContent = "Register";
  if (!hackathon.sourceUrl) {
    registerLinkButton.disabled = true;
  }

  actions.append(editButton, registerButton, registerLinkButton);

  const inlineEdit = document.createElement("div");
  inlineEdit.dataset.role = "inline-edit";
  inlineEdit.className = "mt-3 hidden grid grid-cols-6 gap-2";

  const nameEdit = document.createElement("input");
  nameEdit.type = "text";
  nameEdit.value = hackathon.name;
  nameEdit.dataset.role = "edit-name";
  nameEdit.className =
    "ui-input col-span-3 rounded-lg border bg-gray-900/80 px-2 py-1 text-xs text-white focus:outline-none";

  const deadlineEdit = document.createElement("input");
  deadlineEdit.type = "date";
  deadlineEdit.value = hackathon.deadline;
  deadlineEdit.dataset.role = "edit-deadline";
  deadlineEdit.className =
    "ui-input col-span-2 rounded-lg border bg-gray-900/80 px-2 py-1 text-xs text-white focus:outline-none";

  const saveEdit = document.createElement("button");
  saveEdit.type = "button";
  saveEdit.dataset.action = "save-edit";
  saveEdit.className =
    "ui-button col-span-1 rounded-lg bg-indigo-600 px-2 py-1 text-xs font-semibold text-white hover:bg-indigo-500";
  saveEdit.textContent = "Save";

  const prizeEdit = document.createElement("input");
  prizeEdit.type = "text";
  prizeEdit.value = hackathon.prize || "";
  prizeEdit.placeholder = "Prize";
  prizeEdit.dataset.role = "edit-prize";
  prizeEdit.className =
    "ui-input col-span-4 rounded-lg border bg-gray-900/80 px-2 py-1 text-xs text-white placeholder-gray-400 focus:outline-none";

  const cancelEdit = document.createElement("button");
  cancelEdit.type = "button";
  cancelEdit.dataset.action = "cancel-edit";
  cancelEdit.className =
    "ui-button col-span-2 rounded-lg bg-gray-700 px-2 py-1 text-xs font-semibold text-gray-100 hover:bg-gray-600";
  cancelEdit.textContent = "Cancel";

  inlineEdit.append(nameEdit, deadlineEdit, saveEdit, prizeEdit, cancelEdit);

  const expansion = document.createElement("div");
  expansion.className = expanded ? "mt-4 space-y-4" : "hidden";

  // Notes Section
  const notesWrap = document.createElement("div");
  notesWrap.className = "rounded-xl bg-gray-900/50 p-3 border border-gray-800";
  const notesHeader = document.createElement("h4");
  notesHeader.className = "text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2";
  notesHeader.textContent = "Notes";
  const notesArea = document.createElement("textarea");
  notesArea.className = "w-full bg-transparent text-xs text-gray-300 border-none focus:ring-0 p-0 resize-none min-h-[60px]";
  notesArea.placeholder = "Add your notes here...";
  notesArea.value = hackathon.notes || "";
  notesArea.dataset.role = "notes-area";
  
  const saveNotesBtn = document.createElement("button");
  saveNotesBtn.className = "mt-2 text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold";
  saveNotesBtn.textContent = "Save Notes";
  saveNotesBtn.dataset.action = "save-notes";

  notesWrap.append(notesHeader, notesArea, saveNotesBtn);

  // Checklist Section
  const checklistWrap = document.createElement("div");
  checklistWrap.className = "rounded-xl bg-gray-900/50 p-3 border border-gray-800";
  const checklistHeader = document.createElement("div");
  checklistHeader.className = "flex items-center justify-between mb-2";
  checklistHeader.innerHTML = `
    <h4 class="text-[10px] font-bold uppercase tracking-widest text-gray-500">Progress Checklist</h4>
    <span class="text-[10px] text-gray-600">${completedCount}/${checklist.length}</span>
  `;
  
  const checklistItems = document.createElement("ul");
  checklistItems.className = "space-y-2";
  
  checklist.forEach((item, idx) => {
    const li = document.createElement("li");
    li.className = "flex items-center justify-between gap-2 text-xs text-gray-300 group/item";
    
    const left = document.createElement("div");
    left.className = "flex items-center gap-2";
    
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = item.completed;
    cb.className = "rounded border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500";
    cb.onchange = async () => {
      const previouslyCompleted = checklist.filter(t => t.completed).length;
      item.completed = cb.checked;
      const currentlyCompleted = checklist.filter(t => t.completed).length;
      
      const targetIdx = uiState.data.findIndex(h => getHackathonKey(h) === key);
      if (targetIdx >= 0) {
        uiState.data[targetIdx].checklist = checklist;
        await persistData();
        
        // Trigger confetti if just hit 100%
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
    delTask.className = "opacity-0 group-hover/item:opacity-100 text-gray-600 hover:text-red-400 p-1 transition-opacity";
    delTask.innerHTML = "×";
    delTask.title = "Remove task";
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
  addTaskRow.className = "mt-3 flex gap-2";
  const addTaskInput = document.createElement("input");
  addTaskInput.type = "text";
  addTaskInput.placeholder = "Add new task...";
  addTaskInput.className = "flex-1 bg-gray-800/50 border border-gray-700 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50";
  
  const addTaskBtn = document.createElement("button");
  addTaskBtn.className = "bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/40 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors";
  addTaskBtn.textContent = "➕";
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
  tagsEditWrap.className = "rounded-xl bg-gray-900/50 p-3 border border-gray-800";
  const tagsEditHeader = document.createElement("h4");
  tagsEditHeader.className = "text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2";
  tagsEditHeader.textContent = "Tags";
  
  const tagsList = document.createElement("div");
  tagsList.className = "flex flex-wrap gap-2 mb-2";
  
  tags.forEach((tag, tIdx) => {
    const tagChip = document.createElement("span");
    tagChip.className = "flex items-center gap-1 group/tag bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-2 py-1 rounded text-[10px] font-semibold tracking-wider uppercase";
    tagChip.innerHTML = `<span>${tag}</span><button class="text-indigo-400 hover:text-red-400 opacity-60 group-hover/tag:opacity-100 transition-opacity">×</button>`;
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
  addTagRow.className = "flex gap-2";
  const addTagInput = document.createElement("input");
  addTagInput.type = "text";
  addTagInput.placeholder = "Add tag (e.g. AI, Web3)...";
  addTagInput.className = "flex-1 bg-gray-800/50 border border-gray-700 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50 uppercase";
  
  const addTagBtn = document.createElement("button");
  addTagBtn.className = "bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/40 px-3 py-1 rounded-lg text-[10px] font-bold transition-colors";
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

  if (!rows.length) {
    emptyState.classList.remove("hidden");
    list.replaceChildren();
  } else {
    emptyState.classList.add("hidden");
    
    // Performance: Only rebuild if the row count or order changed, 
    // or if we are toggling expansion. Otherwise, just update specific nodes.
    const fragment = document.createDocumentFragment();
    rows.forEach((hackathon) => fragment.appendChild(buildCard(hackathon)));
    list.replaceChildren(fragment);
  }

  const nextUpcomingKey = getNextUpcomingKey(rows);
  if (nextUpcomingKey) {
    const target = list.querySelector(`[data-hackathon-key='${nextUpcomingKey}']`);
    if (target instanceof HTMLElement) {
      target.classList.add("next-upcoming-highlight");
    }
  }
}

function updateInsights() {
  const all = uiState.data;
  const active = all.filter((item) => getDiffHours(item.deadline) > 0);
  const upcoming = active.filter((item) => getDiffHours(item.deadline) < 72);
  const avgHours = active.length
    ? Math.round(active.reduce((sum, item) => sum + Math.max(0, getDiffHours(item.deadline)), 0) / active.length)
    : 0;

  metricTotal.textContent = String(all.length);
  metricUpcoming.textContent = String(upcoming.length);
  insightTotal.textContent = String(all.length);
  insightUpcoming.textContent = String(upcoming.length);
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

  console.log("HackTrack - selected date", selected, matches);
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
  submitBtn.textContent = "Saved! ✓";
  submitBtn.classList.remove("from-indigo-500", "to-purple-600");
  submitBtn.classList.add("bg-green-600");

  form.reset();
  refreshDashboard();
  showToast(existingIndex >= 0 ? "Hackathon updated" : "Hackathon saved");

  window.setTimeout(async () => {
    submitBtn.textContent = originalBtnText;
    submitBtn.classList.remove("bg-green-600");
    submitBtn.classList.add("from-indigo-500", "to-purple-600");
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

      const item = uiState.data.find((entry) => getHackathonKey(entry) === key);
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
