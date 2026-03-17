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

const uiState = {
  filter: "all",
  sort: "deadline",
  expandedId: null,
  countdownTimer: null,
  data: [],
  selectedCalendarDate: null
};

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

function getCurrentMonthContext() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    monthIndex: now.getMonth(),
    daysInMonth: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
    firstWeekday: new Date(now.getFullYear(), now.getMonth(), 1).getDay()
  };
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

  card.dataset.hackathonKey = key;
  card.className =
    "glass card-hover group relative rounded-2xl border border-gray-700 p-3 shadow-md";

  const top = document.createElement("div");
  top.className = "flex items-start justify-between gap-3 pr-8";

  const titleWrap = document.createElement("div");
  const title = document.createElement("button");
  title.type = "button";
  title.dataset.action = "toggle-expand";
  title.className = "text-left text-sm font-semibold text-gray-100 transition hover:text-indigo-200";
  title.textContent = hackathon.name;

  const deadline = document.createElement("p");
  deadline.className = "mt-1 text-xs text-gray-300";
  deadline.textContent = `📅 ${formatDeadline(hackathon.deadline)}`;

  const prize = document.createElement("p");
  prize.className = "mt-1 text-xs text-gray-300";
  prize.textContent = `💰 ${hackathon.prize || "Not detected"}`;

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

  titleWrap.append(title, deadline, prize);
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
    ? "ui-button rounded-lg bg-emerald-600/90 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
    : "ui-button rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 px-2 py-1 text-xs font-semibold text-gray-900 hover:from-amber-400 hover:to-yellow-400";
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

  card.append(deleteButton, top, actions, inlineEdit);
  return card;
}

function renderList() {
  const rows = filteredAndSortedHackathons(uiState.data);
  list.innerHTML = "";

  if (!rows.length) {
    emptyState.classList.remove("hidden");
  } else {
    emptyState.classList.add("hidden");
  }

  const fragment = document.createDocumentFragment();
  rows.forEach((hackathon) => fragment.appendChild(buildCard(hackathon)));
  list.appendChild(fragment);
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

  const month = getCurrentMonthContext();
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
    button.title = hasEvents ? `${byDate.get(dateKey).length} hackathon(s)` : WEEKDAY_NAMES[new Date(`${dateKey}T00:00:00`).getDay()];
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
      id: crypto.randomUUID(),
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

  form.reset();
  await prefillHackathonNameFromTab();
  refreshDashboard();
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
    refreshDashboard();
    return;
  }

  if (action === "toggle-registered") {
    uiState.data[index].registered = !uiState.data[index].registered;
    await persistData();
    refreshDashboard();
    return;
  }

  if (action === "open-register") {
    const sourceUrl = uiState.data[index].sourceUrl;
    if (!sourceUrl) {
      return;
    }

    chrome.tabs.create({ url: sourceUrl });
    return;
  }

  if (action === "delete") {
    card.style.transition = "opacity 220ms ease, transform 220ms ease";
    card.style.opacity = "0";
    card.style.transform = "translateY(10px)";

    window.setTimeout(async () => {
      uiState.data.splice(index, 1);
      await persistData();
      refreshDashboard();
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
    refreshDashboard();
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
    refreshDashboard();
  }
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

async function initializePopup() {
  await Promise.all([loadData(), prefillHackathonNameFromTab()]);
  startCountdownTicker();
}

initializePopup();
