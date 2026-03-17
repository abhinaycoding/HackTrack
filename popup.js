const STORAGE_KEY = "hackathons";
const RECENT_LIMIT = 5;

const quickAddForm = document.getElementById("quick-add-form");
const quickInput = document.getElementById("quick-input");
const headerCountdown = document.getElementById("header-countdown");
const nextCard = document.getElementById("next-card");
const recentList = document.getElementById("recent-list");
const recentEmpty = document.getElementById("recent-empty");
const actionAdd = document.getElementById("action-add");
const actionDashboard = document.getElementById("action-dashboard");
const actionSettings = document.getElementById("action-settings");
const toastStack = document.getElementById("toast-stack");

const uiState = {
  data: [],
  showAllRecent: false,
  expandedKey: null,
  countdownTicker: null
};

function getHackathonKey(hackathon) {
  return hackathon.id || `${hackathon.name}::${hackathon.deadline || ""}::${hackathon.createdAt || 0}`;
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

function toDeadlineEnd(deadline) {
  if (!deadline) {
    return null;
  }

  const date = new Date(`${deadline}T23:59:59`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatDeadline(deadline) {
  const date = toDeadlineEnd(deadline);
  if (!date) {
    return "No deadline";
  }

  return new Date(`${deadline}T00:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function getDiffHours(deadline) {
  const date = toDeadlineEnd(deadline);
  if (!date) {
    return null;
  }

  return Math.floor((date.getTime() - Date.now()) / (1000 * 60 * 60));
}

function getCountdownLabel(deadline) {
  const hours = getDiffHours(deadline);
  if (hours === null) {
    return "No deadline";
  }

  if (hours <= 0) {
    return "Closed";
  }

  const days = Math.floor(hours / 24);
  const remainingHours = Math.max(0, hours % 24);
  return days > 0 ? `${days}d ${remainingHours}h left` : `${Math.max(1, hours)}h left`;
}

function getStatus(deadline) {
  const hours = getDiffHours(deadline);
  if (hours === null) {
    return { label: "Upcoming", className: "status status-upcoming" };
  }

  if (hours <= 0) {
    return { label: "Missed", className: "status status-missed" };
  }

  if (hours < 24) {
    return { label: "Urgent", className: "status status-urgent" };
  }

  return { label: "Upcoming", className: "status status-upcoming" };
}

function getRecentHackathons() {
  const rows = [...uiState.data].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (uiState.showAllRecent) {
    return rows;
  }

  return rows.slice(0, RECENT_LIMIT);
}

function getNextUpcomingHackathon() {
  return [...uiState.data]
    .filter((item) => {
      const hours = getDiffHours(item.deadline);
      return hours !== null && hours > 0;
    })
    .sort((a, b) => toDeadlineEnd(a.deadline).getTime() - toDeadlineEnd(b.deadline).getTime())[0] || null;
}

function showToast(message) {
  if (!toastStack) {
    return;
  }

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  toastStack.appendChild(toast);

  window.setTimeout(() => {
    toast.style.transition = "opacity 150ms ease, transform 150ms ease";
    toast.style.opacity = "0";
    toast.style.transform = "translateY(4px)";
    window.setTimeout(() => toast.remove(), 160);
  }, 1500);
}

function parseDateFromInput(text) {
  const match = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  return match ? match[1] : "";
}

function normalizeHackathonInput(rawInput, activeTab) {
  const text = rawInput.trim();
  const deadline = parseDateFromInput(text);
  const nameWithoutDate = deadline ? text.replace(deadline, "").replace(/\s{2,}/g, " ").trim() : text;

  const isUrl = /^https?:\/\//i.test(nameWithoutDate);
  if (isUrl) {
    try {
      const url = new URL(nameWithoutDate);
      const inferredName = activeTab.url === nameWithoutDate && activeTab.title
        ? activeTab.title
        : `Hackathon • ${url.hostname.replace(/^www\./, "")}`;

      return {
        name: inferredName,
        sourceUrl: nameWithoutDate,
        deadline
      };
    } catch {
      return {
        name: nameWithoutDate,
        sourceUrl: activeTab.url || "",
        deadline
      };
    }
  }

  return {
    name: nameWithoutDate,
    sourceUrl: activeTab.url || "",
    deadline
  };
}

function buildRecentItem(hackathon) {
  const key = getHackathonKey(hackathon);
  const isExpanded = uiState.expandedKey === key;
  const status = getStatus(hackathon.deadline);

  const row = document.createElement("li");
  row.className = "hack-item";
  row.dataset.key = key;
  row.dataset.expanded = isExpanded ? "true" : "false";

  const top = document.createElement("div");
  top.className = "hack-top";

  const left = document.createElement("div");
  const name = document.createElement("p");
  name.className = "hack-name";
  name.textContent = hackathon.name;

  const time = document.createElement("p");
  time.className = "hack-time";
  time.textContent = `${formatDeadline(hackathon.deadline)} • ${getCountdownLabel(hackathon.deadline)}`;

  left.append(name, time);

  const statusEl = document.createElement("span");
  statusEl.className = status.className;
  statusEl.textContent = status.label;

  top.append(left, statusEl);

  const actions = document.createElement("div");
  actions.className = "item-actions";

  const openBtn = document.createElement("button");
  openBtn.className = "item-action";
  openBtn.type = "button";
  openBtn.dataset.action = "open";
  openBtn.textContent = "Open";

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "item-action";
  deleteBtn.type = "button";
  deleteBtn.dataset.action = "delete";
  deleteBtn.textContent = "Delete";

  actions.append(openBtn, deleteBtn);
  row.append(top, actions);

  return row;
}

function renderHeaderCountdown(nextHackathon) {
  if (!headerCountdown) {
    return;
  }

  headerCountdown.textContent = nextHackathon
    ? `${getCountdownLabel(nextHackathon.deadline)} • ${nextHackathon.name}`
    : "No upcoming";
}

function renderNextCard(nextHackathon) {
  if (!nextCard) {
    return;
  }

  if (!nextHackathon) {
    nextCard.innerHTML = '<p class="empty-note">No upcoming hackathon yet.</p>';
    return;
  }

  const status = getStatus(nextHackathon.deadline);
  nextCard.innerHTML = "";

  const name = document.createElement("p");
  name.className = "next-name";
  name.textContent = nextHackathon.name;

  const meta = document.createElement("p");
  meta.className = "next-meta";
  meta.textContent = `${formatDeadline(nextHackathon.deadline)} • ${getCountdownLabel(nextHackathon.deadline)}`;

  const badge = document.createElement("span");
  badge.className = status.className;
  badge.textContent = status.label;

  nextCard.append(name, meta, badge);
}

function renderRecentList() {
  const rows = getRecentHackathons();
  recentList.innerHTML = "";

  if (!rows.length) {
    recentEmpty.style.display = "block";
    return;
  }

  recentEmpty.style.display = "none";
  const fragment = document.createDocumentFragment();
  rows.forEach((item) => fragment.appendChild(buildRecentItem(item)));
  recentList.appendChild(fragment);
}

function refreshUI() {
  const next = getNextUpcomingHackathon();
  renderHeaderCountdown(next);
  renderNextCard(next);
  renderRecentList();
}

async function persistAndRefresh() {
  await saveHackathons(uiState.data);
  refreshUI();
}

async function addHackathonFromInput() {
  const rawInput = quickInput.value.trim();
  if (!rawInput) {
    return;
  }

  const activeTab = await getActiveTabInfo();
  const normalized = normalizeHackathonInput(rawInput, activeTab);

  if (!normalized.name) {
    showToast("Enter a valid name or URL");
    return;
  }

  const existingIndex = normalized.sourceUrl
    ? uiState.data.findIndex((item) => item.sourceUrl && item.sourceUrl === normalized.sourceUrl)
    : -1;

  if (existingIndex >= 0) {
    const existing = uiState.data[existingIndex];
    uiState.data[existingIndex] = {
      ...existing,
      name: normalized.name,
      deadline: normalized.deadline || existing.deadline || "",
      sourceUrl: normalized.sourceUrl || existing.sourceUrl || "",
      updatedAt: Date.now()
    };
    showToast("Hackathon updated");
  } else {
    uiState.data.push({
      id: crypto.randomUUID(),
      name: normalized.name,
      deadline: normalized.deadline || "",
      sourceUrl: normalized.sourceUrl || "",
      registered: false,
      createdAt: Date.now()
    });
    showToast("Hackathon added");
  }

  quickInput.value = "";
  await persistAndRefresh();
}

async function handleRecentAction(target) {
  const row = target.closest(".hack-item");
  if (!(row instanceof HTMLElement)) {
    return;
  }

  const key = row.dataset.key;
  if (!key) {
    return;
  }

  const index = uiState.data.findIndex((item) => getHackathonKey(item) === key);
  if (index < 0) {
    return;
  }

  const action = target.dataset.action;
  if (!action) {
    uiState.expandedKey = uiState.expandedKey === key ? null : key;
    refreshUI();
    return;
  }

  if (action === "open") {
    const sourceUrl = uiState.data[index].sourceUrl;
    if (!sourceUrl) {
      showToast("No source URL available");
      return;
    }

    chrome.tabs.create({ url: sourceUrl });
    showToast("Opening hackathon page");
    return;
  }

  if (action === "delete") {
    uiState.data.splice(index, 1);
    uiState.expandedKey = null;
    await persistAndRefresh();
    showToast("Hackathon deleted");
  }
}

function startTicker() {
  if (uiState.countdownTicker) {
    window.clearInterval(uiState.countdownTicker);
  }

  uiState.countdownTicker = window.setInterval(() => {
    renderHeaderCountdown(getNextUpcomingHackathon());

    const next = getNextUpcomingHackathon();
    if (next) {
      const nextName = nextCard.querySelector(".next-name");
      const nextMeta = nextCard.querySelector(".next-meta");
      if (nextName instanceof HTMLElement && nextMeta instanceof HTMLElement) {
        nextName.textContent = next.name;
        nextMeta.textContent = `${formatDeadline(next.deadline)} • ${getCountdownLabel(next.deadline)}`;
      }
    }

    recentList.querySelectorAll(".hack-item").forEach((row) => {
      const key = row.getAttribute("data-key");
      if (!key) {
        return;
      }

      const item = uiState.data.find((entry) => getHackathonKey(entry) === key);
      if (!item) {
        return;
      }

      const timeNode = row.querySelector(".hack-time");
      const statusNode = row.querySelector(".status");
      if (timeNode instanceof HTMLElement) {
        timeNode.textContent = `${formatDeadline(item.deadline)} • ${getCountdownLabel(item.deadline)}`;
      }

      if (statusNode instanceof HTMLElement) {
        const status = getStatus(item.deadline);
        statusNode.className = status.className;
        statusNode.textContent = status.label;
      }
    });
  }, 1000);
}

async function initializePopup() {
  uiState.data = (await getHackathons()).map((item) => ({
    ...item,
    registered: Boolean(item.registered)
  }));

  const activeTab = await getActiveTabInfo();
  if (activeTab.title) {
    quickInput.placeholder = `Add hackathon or paste URL • ${activeTab.title.slice(0, 30)}`;
  }

  refreshUI();
  startTicker();
}

quickAddForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await addHackathonFromInput();
});

recentList.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  await handleRecentAction(target);
});

actionAdd.addEventListener("click", async () => {
  if (quickInput.value.trim()) {
    await addHackathonFromInput();
    return;
  }

  quickInput.focus();
  showToast("Type a name or paste URL");
});

actionDashboard.addEventListener("click", () => {
  uiState.showAllRecent = !uiState.showAllRecent;
  actionDashboard.textContent = uiState.showAllRecent ? "Compact View" : "Open Dashboard";
  refreshUI();
  showToast(uiState.showAllRecent ? "Dashboard view enabled" : "Compact view enabled");
});

actionSettings.addEventListener("click", () => {
  chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
  showToast("Opening extension settings");
});

initializePopup();
