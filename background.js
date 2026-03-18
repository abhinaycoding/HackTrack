const STORAGE_KEY = "hackathons";
const NOTIFIED_KEY = "hackathonReminderNotifications";
const DEADLINE_ALARM_NAME = "hackathon-deadline-check";
const REMINDER_INTERVAL_MS = 6 * 60 * 60 * 1000;
const REMINDER_WINDOW_HOURS = 72;
const NOTIFICATION_ICON_URL = chrome.runtime.getURL("icons/icon128.png");

function getStorage(keys) {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
      resolve({});
      return;
    }
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        console.error("Background Storage Get Error:", chrome.runtime.lastError);
        resolve({});
      } else {
        resolve(result);
      }
    });
  });
}

function setStorage(value) {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
      resolve();
      return;
    }
    chrome.storage.local.set(value, () => {
      if (chrome.runtime.lastError) {
        console.error("Background Storage Set Error:", chrome.runtime.lastError);
      }
      resolve();
    });
  });
}

function createNotification(notificationId, options) {
  return new Promise((resolve) => {
    chrome.notifications.create(notificationId, options, () => {
      if (chrome.runtime.lastError) {
        resolve(false);
        return;
      }

      resolve(true);
    });
  });
}

function toLocalMidnight(dateLike) {
  const date = new Date(dateLike);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getHoursUntilDeadline(deadlineValue) {
  const deadline = new Date(`${deadlineValue}T23:59:59`);
  const now = new Date();
  return (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
}

async function checkHackathonDeadlines() {
  const result = await getStorage([STORAGE_KEY, NOTIFIED_KEY]);
  const hackathons = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
  const notifiedReminders = result[NOTIFIED_KEY] || {};
  let hasChanges = false;

  for (const hackathon of hackathons) {
    if (!hackathon?.name || !hackathon?.deadline) {
      continue;
    }

    const reminderKey = `${hackathon.id || hackathon.name}:${hackathon.deadline}`;
    const hoursLeft = getHoursUntilDeadline(hackathon.deadline);

    if (hackathon.registered) {
      if (notifiedReminders[reminderKey]) {
        delete notifiedReminders[reminderKey];
        hasChanges = true;
      }
      continue;
    }

    if (hoursLeft <= 0 || hoursLeft > REMINDER_WINDOW_HOURS) {
      continue;
    }

    const lastReminderTime = Number(notifiedReminders[reminderKey] || 0);
    const enoughTimePassed = Date.now() - lastReminderTime >= REMINDER_INTERVAL_MS;

    if (enoughTimePassed) {
      const didCreateNotification = await createNotification(`deadline-${reminderKey}`, {
        type: "basic",
        iconUrl: NOTIFICATION_ICON_URL,
        title: "HackTrack Reminder",
        message: `${hackathon.name} deadline is in ${Math.max(1, Math.floor(hoursLeft))}h. Mark as Registered to stop reminders.`
      });

      if (didCreateNotification) {
        notifiedReminders[reminderKey] = Date.now();
        hasChanges = true;
      }
    }
  }

  if (hasChanges) {
    await setStorage({ [NOTIFIED_KEY]: notifiedReminders });
  }
}

function ensureDeadlineAlarm() {
  chrome.alarms.create(DEADLINE_ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: 60
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  ensureDeadlineAlarm();
  await checkHackathonDeadlines();
});

chrome.runtime.onStartup.addListener(() => {
  ensureDeadlineAlarm();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== DEADLINE_ALARM_NAME) {
    return;
  }

  await checkHackathonDeadlines();
});
