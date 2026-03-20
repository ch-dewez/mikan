const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

function formatTime(seconds) {
  seconds = Math.floor(seconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

let currentTabId = null;
let darkModeEnabled = false;

function updateDarkModeUI() {
  const btn = document.getElementById('dark-mode-btn');
  if (darkModeEnabled) {
    document.body.classList.add('dark-mode');
    btn.textContent = '☀️';
    btn.title = 'Switch to light mode';
  } else {
    document.body.classList.remove('dark-mode');
    btn.textContent = '🌙';
    btn.title = 'Switch to dark mode';
  }
}

async function updateStats() {
  let todaySeconds = 0;
  let weekSeconds = 0;
  let monthSeconds = 0;
  //let totalSeconds = 0;

  const now = new Date();
  let dayOfWeek = now.getDay();
  // monday = 1
  if (dayOfWeek == 0) {
    dayOfWeek = 7;
  }

  // for one month
  for (let i = 0; i < now.getDate(); i++) {
    const currentDate = new Date(now);
    currentDate.setDate(now.getDate() - i);

    let dateString = currentDate.toISOString().split('T')[0];
    let result = await browserAPI.runtime.sendMessage({ type: 'getDayTotal', date: dateString });

    if (i == 0) {
      todaySeconds += result;
    }
    if (i < dayOfWeek) {
      weekSeconds += result;
    }
    monthSeconds += result;
    //totalSeconds += result;
  }

  document.getElementById('today-time').textContent = formatTime(todaySeconds);
  document.getElementById('week-time').textContent = formatTime(weekSeconds);
  document.getElementById('month-time').textContent = formatTime(monthSeconds);

  //browserAPI.storage.local.set({ cachedTotalSeconds: totalSeconds });
}

function updateStatus() {
  browserAPI.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    const statusCard = document.getElementById('status-card');
    const statusText = document.getElementById('status-text');
    const statusSubtext = document.getElementById('status-subtext');
    const forceBtn = document.getElementById('force-btn');

    if (!tab || !tab.url) {
      statusCard.className = 'card status-card inactive';
      statusText.textContent = 'No tab detected';
      statusSubtext.textContent = '';
      forceBtn.style.display = 'none';
      return;
    }

    browserAPI.tabs.sendMessage(tab.id, { type: 'getStatus' }, (response) => {
      console.log("Mikan popup: get status response: ", response);
      if (browserAPI.runtime.lastError) {
        statusCard.className = 'card status-card inactive';
        statusText.textContent = 'Not on a supported page';
        statusSubtext.textContent = '';
        forceBtn.style.display = 'none';
        return;
      }

      if (!response) {
        statusCard.className = 'card status-card inactive';
        statusText.textContent = 'Extension not loaded';
        statusSubtext.textContent = 'Try refreshing the page';
        forceBtn.style.display = 'none';

        browserAPI.runtime.sendMessage({ type: 'updateIcon', state: 'error', tabId: tab.id });
        return;
      }

      forceBtn.style.display = 'block';

      if (response.isTargetLanguage) {
        forceBtn.textContent = 'Mark as Non-Japanese';
      } else {
        forceBtn.textContent = 'Mark as Japanese';
      }

      if (response.hasError) {
        statusCard.className = 'card status-card wrong-lang';
        statusText.textContent = '⚠️ Auto detection failed';
        statusSubtext.textContent = 'Network too slow - use button to override';
      } else if (!response.isWatchPage) {
        statusCard.className = 'card status-card inactive';
        statusText.textContent = 'Not on a supported page';
        statusSubtext.textContent = '';
        forceBtn.style.display = 'none';
      }
      // I don't think this should happen a lot
      else if (!response.isActive) {
        statusCard.className = 'card status-card inactive';
        statusText.textContent = 'Not Active';
        statusSubtext.textContent = '';
        forceBtn.style.display = 'none';
      }
      else if (response.isTargetLanguage) {
        statusCard.className = 'card status-card active';
        statusText.textContent = '🎌 Tracking Japanese content';
        statusSubtext.textContent = '';
      } else {
        statusCard.className = 'card status-card wrong-lang';
        statusText.textContent = '⏸️ Not Japanese content';
        statusSubtext.textContent = 'Use button below to override';
      }
    });
  });
}

document.getElementById('force-btn').addEventListener('click', () => {
  browserAPI.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      browserAPI.tabs.sendMessage(tabs[0].id, { type: 'toggleForce' }, (response) => {
        if (response) {
          updateStatus();
        }
      });
    }
  });
});

document.getElementById('dashboard-btn').addEventListener('click', () => {
  browserAPI.tabs.create({ url: browserAPI.runtime.getURL('dashboard.html') });
});

document.getElementById('dark-mode-btn').addEventListener('click', () => {
  darkModeEnabled = !darkModeEnabled;
  browserAPI.storage.local.set({ darkModeEnabled });
  updateDarkModeUI();
});

// Listen for dark mode changes from dashboard
browserAPI.storage.onChanged.addListener((changes) => {
  if (changes.darkModeEnabled) {
    darkModeEnabled = changes.darkModeEnabled.newValue;
    updateDarkModeUI();
  }
});

browserAPI.storage.local.get(['darkModeEnabled'], (result) => {
  darkModeEnabled = result.darkModeEnabled === true;
  updateDarkModeUI();
  updateStats();
  updateStatus();
});

setInterval(() => {
  updateStats();
}, 1000);

setInterval(() => {
  updateStatus();
}, 3000);
