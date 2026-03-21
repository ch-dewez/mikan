let watchData = {};
let darkModeEnabled = false;
let websiteStats = [];

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

const isExtension = typeof browserAPI !== 'undefined' && browserAPI.storage && browserAPI.storage.local;

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

function formatTimeHours(seconds) {
  const hours = seconds / 3600;
  if (hours >= 1) {
    return `${hours.toFixed(1)}h`;
  } else {
    return `${Math.floor(seconds / 60)}m`;
  }
}

function formatTimeVerbose(seconds) {
  seconds = Math.floor(seconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes} minutes`;
  } else {
    return `${seconds} seconds`;
  }
}

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

  // Rebuild heatmap to apply correct empty color
  if (calHeatmap) {
    buildHeatmap();
  }
}

function getWeekStart() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  return new Date(now.getFullYear(), now.getMonth(), diff).toISOString().split("T")[0];
}

function getMonthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
}

function calculateStats() {

  const now = new Date();
  let dayOfWeek = now.getDay();
  // monday = 1
  if (dayOfWeek == 0) {
    dayOfWeek = 7;
  }
  const today = new Date().toISOString().split("T")[0];
  const weekStart = getWeekStart();
  const monthStart = getMonthStart();

  let todaySeconds = 0;
  let weekSeconds = 0;
  let monthSeconds = 0;
  let totalSeconds = 0;

  // const daysWithData = days.filter(d => watchData[d] && watchData[d].totalSeconds > 0);
  const daysWithData = [];

  for (const categoryData of Object.values(watchData)) {
    for (const day of categoryData) {
      const seconds = day.total || 0;
      if (seconds > 0) {
        if (!daysWithData.includes(day.date)) {
          daysWithData.push(day.date);
        }
      }
      totalSeconds += seconds;

      if (day.date === today) {
        todaySeconds += seconds;
      }
      if (day.date >= weekStart) {
        weekSeconds += seconds;
      }
      if (day.date >= monthStart) {
        monthSeconds += seconds;
      }
    }
  }

  const dailyAvg = daysWithData.length > 0 ? totalSeconds / daysWithData.length : 0;

  const monthsSet = new Set();
  for (const day of daysWithData) {
    monthsSet.add(day.substring(0, 7));
  }
  const monthlyAvg = monthsSet.size > 0 ? totalSeconds / monthsSet.size : 0;

  document.getElementById('today-stat').textContent = formatTime(todaySeconds);
  document.getElementById('week-stat').textContent = formatTime(weekSeconds);
  document.getElementById('month-stat').textContent = formatTime(monthSeconds);
  document.getElementById('total-stat').textContent = formatTime(totalSeconds);
  document.getElementById('daily-avg-stat').textContent = formatTime(dailyAvg);
  document.getElementById('monthly-avg-stat').textContent = formatTime(monthlyAvg);
}

let calHeatmap = null;

function buildHeatmap() {
  // Convert watchData to Cal-Heatmap format
  const heatmapData = [];

  for (const categoryData of Object.values(watchData)) {
    for (const dayData of categoryData) {
      if (dayData.total > 0) {
        heatmapData.push({
          date: dayData.date,
          value: dayData.total
        });
      }
    }
  }

  // Find max for scaling
  let maxSeconds = 0;
  for (const entry of heatmapData) {
    if (entry.value > maxSeconds) maxSeconds = entry.value;
  }
  if (maxSeconds === 0) maxSeconds = 3600;

  // Calculate start date
  const today = new Date();
  const startDate = new Date(today.getFullYear(), today.getMonth() - 3, 1);

  // Destroy existing instance if any
  if (calHeatmap) {
    calHeatmap.destroy();
  }

  // Create new Cal-Heatmap instance
  calHeatmap = new CalHeatmap();

  calHeatmap.paint({
    animationDuration: 0,
    theme: darkModeEnabled ? 'dark' : 'light',
    data: {
      source: heatmapData,
      x: 'date',
      y: 'value'
    },
    date: {
      start: startDate,
      locale: 'en',
    },
    range: 7,
    domain: {
      type: 'month',
      gutter: 8,
      label: {
        text: 'MMM',
        position: 'bottom',
        textAlign: 'middle'
      }
    },
    subDomain: {
      type: 'day',
      width: 14,
      height: 14,
      gutter: 3,
      radius: 3
    },
    scale: {
      color: {
        type: 'threshold',
        range: ['#fef3e2', '#fed7aa', '#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c'],
        domain: [1, maxSeconds * 0.15, maxSeconds * 0.3, maxSeconds * 0.5, maxSeconds * 0.7, maxSeconds * 0.9],
        emptyColor: darkModeEnabled ? '#292524' : '#EDEDED',
      }
    },
    itemSelector: '#cal-heatmap'
  }, [
    [
      Tooltip,
      {
        text: function(date, value, dayjsDate) {
          const dateStr = dayjsDate.format('YYYY-MM-DD');
          const seconds = value || 0;
          const formatted = formatTime(seconds);
          return `${dayjsDate.format('MMM D, YYYY')}: ${formatted}`;
        }
      }
    ]
  ]);

  calHeatmap.on('click', (event, timestamp, value) => {
    if (!timestamp || !value) {
      return;
    }
    let section = document.getElementById("selected-day-section");
    section.style.display = "block";

    let container = document.getElementById("selected-day-list");

    let date = new Date(timestamp).toISOString().split("T")[0];
    buildWebsiteList(container, date)
  });
}

function showTooltip(e) {
  const tooltip = document.getElementById('tooltip');
  const dateStr = e.target.dataset.date;
  const seconds = parseInt(e.target.dataset.seconds) || 0;

  const date = new Date(dateStr + 'T00:00:00');
  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  tooltip.querySelector('.tooltip-date').textContent = formattedDate;
  tooltip.querySelector('.tooltip-value').textContent = seconds > 0
    ? formatTimeVerbose(seconds) + ' watched'
    : 'No activity';

  tooltip.style.display = 'block';

  const rect = e.target.getBoundingClientRect();
  tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
  tooltip.style.top = `${rect.top - tooltip.offsetHeight - 8}px`;
}

function hideTooltip() {
  document.getElementById('tooltip').style.display = 'none';
}

function buildWeeklyChart() {
  const container = document.getElementById('weekly-chart');
  container.innerHTML = '';

  const days = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    days.push({
      date: date.toISOString().split("T")[0],
      label: date.toLocaleDateString('en-US', { weekday: 'short' }),
      isToday: i === 0
    });
  }

  const dailyTotals = {};
  for (const day of days) {
    dailyTotals[day.date] = {
      Reading: 0,
      Watching: 0,
      Speaking: 0,
      total: 0
    };
  }

  for (const [category, categoryData] of Object.entries(watchData)) {
    for (const dayData of categoryData) {
      if (dailyTotals[dayData.date]) {
        dailyTotals[dayData.date][category] = dayData.total || 0;
        dailyTotals[dayData.date].total += dayData.total || 0;
      }
    }
  }

  const values = days.map(d => dailyTotals[d.date].total);
  const maxValue = Math.max(...values, 60);

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const dayData = dailyTotals[day.date];

    const group = document.createElement('div');
    group.className = 'bar-group';

    const value = document.createElement('div');
    value.className = 'bar-value';
    value.textContent = dayData.total > 0 ? formatTimeHours(dayData.total) : '';

    const bar = document.createElement('div');
    bar.className = 'bar';
    const height = (dayData.total / maxValue) * 120;
    bar.style.height = `${Math.max(height, 4)}px`;

    if (dayData.total > 0) {
      for (const category of Object.keys(dayData).filter(k => k !== 'total')) {
        const categorySeconds = dayData[category];
        if (categorySeconds > 0) {
          const segment = document.createElement('div');
          segment.className = `bar-segment ${category}`;
          segment.style.height = `${(categorySeconds / dayData.total) * 100}%`;
          bar.appendChild(segment);
        }
      }
    } else {
      bar.classList.add('empty');
    }

    const label = document.createElement('div');
    label.className = 'bar-label';
    label.textContent = day.isToday ? 'Today' : day.label;

    group.appendChild(value);
    group.appendChild(bar);
    group.appendChild(label);
    container.appendChild(group);
  }
}

function buildMonthlyChart() {
  const container = document.getElementById('monthly-chart');
  container.innerHTML = '';

  const monthlyTotals = {};
  const today = new Date();

  for (let i = 5; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthlyTotals[key] = {
      Reading: 0,
      Watching: 0,
      Speaking: 0,
      total: 0,
      label: date.toLocaleDateString('en-US', { month: 'short' })
    };
  }

  for (const [category, categoryData] of Object.entries(watchData)) {
    for (const dayData of categoryData) {
      const monthKey = dayData.date.substring(0, 7);
      if (monthlyTotals[monthKey]) {
        monthlyTotals[monthKey][category] += dayData.total || 0;
        monthlyTotals[monthKey].total += dayData.total || 0;
      }
    }
  }

  const months = Object.entries(monthlyTotals);
  const maxValue = Math.max(...months.map(m => m[1].total), 60);

  for (const [key, data] of months) {
    const row = document.createElement('div');
    row.className = 'chart-row';

    const label = document.createElement('div');
    label.className = 'bar-label';
    label.textContent = data.label;
    row.appendChild(label);

    const barContainer = document.createElement('div');
    barContainer.className = 'horizontal-bar-container';
    row.appendChild(barContainer);

    const monthlyBar = document.createElement('div');
    monthlyBar.className = 'monthly-bar';
    barContainer.appendChild(monthlyBar);

    const width = (data.total / maxValue) * 100;
    monthlyBar.style.width = `${width}%`;

    if (data.total === 0) {
      monthlyBar.classList.add('empty');
    } else {
      for (const category of Object.keys(data).filter(k => k !== 'total' && k !== 'label')) {
        const categorySeconds = data[category];
        if (categorySeconds > 0) {
          const segment = document.createElement('div');
          segment.className = `bar-segment ${category}`;
          segment.style.width = `${(categorySeconds / data.total) * 100}%`;
          monthlyBar.appendChild(segment);
        }
      }
    }

    const valueSpan = document.createElement('span');
    valueSpan.className = 'monthly-value';
    valueSpan.textContent = formatTimeHours(data.total);
    monthlyBar.appendChild(valueSpan);

    container.appendChild(row);
  }
}

function buildWebsiteList(container = undefined, date = "") {
  calculateWebsiteStats(date);

  if (!container || container == undefined) {
    container = document.getElementById('website-list');
  }

  if (!container) return;

  container.innerHTML = '';

  if (!websiteStats || websiteStats.length === 0) {
    container.innerHTML = '<p style="text-align:center; opacity:0.6; padding: 20px;">No data recorded yet.</p>';
    return;
  }

  const maxSeconds = Math.max(...websiteStats.map(w => w.totalSeconds));

  websiteStats.forEach(website => {
    const websiteItem = document.createElement('div');
    websiteItem.className = 'chart-row';

    const websiteLabel = document.createElement('div');
    websiteLabel.className = 'bar-label';
    websiteLabel.title = website.host;
    websiteLabel.textContent = website.host;
    websiteItem.appendChild(websiteLabel);

    const websiteBarContainer = document.createElement('div');
    websiteBarContainer.className = 'horizontal-bar-container';

    const websiteBar = document.createElement('div');
    websiteBar.className = 'website-bar';
    const percentage = maxSeconds > 0 ? (website.totalSeconds / maxSeconds) * 100 : 0;
    websiteBar.style.width = `${Math.max(percentage, 2)}%`;

    if (website.totalSeconds === 0) {
      websiteBar.classList.add('empty');
    } else {
      for (const category of Object.keys(website).filter(k => k !== 'host' && k !== 'totalSeconds')) {
        const categorySeconds = website[category];
        if (categorySeconds > 0) {
          const segment = document.createElement('div');
          segment.className = `bar-segment ${category}`;
          segment.style.width = `${(categorySeconds / website.totalSeconds) * 100}%`;
          websiteBar.appendChild(segment);
        }
      }
    }

    const valueSpan = document.createElement('span');
    valueSpan.className = 'website-value';
    valueSpan.textContent = formatTimeVerbose(website.totalSeconds);
    websiteBar.appendChild(valueSpan);

    websiteBarContainer.appendChild(websiteBar);
    websiteItem.appendChild(websiteBarContainer);
    container.appendChild(websiteItem);
  });
}

function renderWebsitePieChart() {
  const container = document.getElementById('website-pie-chart');
  if (!container || !websiteStats.length) return;

  container.innerHTML = '';

  const pieChartData = [];
  websiteStats.forEach(site => {
    if (site.Reading > 0) {
      pieChartData.push({ host: site.host, category: 'Reading', seconds: site.Reading });
    }
    if (site.Watching > 0) {
      pieChartData.push({ host: site.host, category: 'Watching', seconds: site.Watching });
    }
    if (site.Speaking > 0) {
      pieChartData.push({ host: site.host, category: 'Speaking', seconds: site.Speaking });
    }
  });

  if (pieChartData.length === 0) {
    return;
  }

  const width = container.offsetWidth || 300;
  const height = 320;
  const outerRadius = Math.min(width, height) / 2 - 50;
  const innerRadius = outerRadius * 0.5;

  const svg = d3.select("#website-pie-chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", `translate(${width / 2}, ${height / 2})`);

  const pie = d3.pie()
    .value(d => d.seconds)
    .sort(null);

  const arc = d3.arc()
    .innerRadius(innerRadius)
    .outerRadius(outerRadius);

  // This arc determines label placement (positioned at the very edge of the slice)
  const labelArc = d3.arc()
    .innerRadius(outerRadius * 0.85)
    .outerRadius(outerRadius * 0.85);

  const pieData = pie(pieChartData);

  // Draw Slices
  svg.selectAll("path")
    .data(pieData)
    .enter()
    .append("path")
    .attr("d", arc)
    .attr("class", d => `pie-slice ${d.data.category}`)
    .attr("stroke", "white")
    .style("stroke-width", "1px");

  // Add Labels
  svg.selectAll("text")
    .data(pieData)
    .enter()
    .append("text")
    .attr("transform", d => {
      const pos = labelArc.centroid(d);
      return `translate(${pos})`;
    })
    .attr("dy", "0.35em")
    .attr("class", "pie-label")
    .style("text-anchor", d => {
      // If the center of the slice is on the right, anchor start. If left, anchor end.
      const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
      return midAngle < Math.PI ? "start" : "end";
    })
    .text(d => {
      const percentage = (d.endAngle - d.startAngle) / (2 * Math.PI);
      return percentage > 0.05 ? d.data.host : ''; // Label content is host name
    });
}

function init() {
  // Set up dark mode toggle
  document.getElementById('dark-mode-btn').addEventListener('click', () => {
    darkModeEnabled = !darkModeEnabled;
    if (isExtension) {
      browserAPI.storage.local.set({ darkModeEnabled });
    }
    updateDarkModeUI();
  });

  if (isExtension) {
    // Load initial data including dark mode setting
    browserAPI.storage.local.get(['darkModeEnabled'], (result) => {
      darkModeEnabled = result.darkModeEnabled === true;
      updateDarkModeUI();
      //render();
    });

    browserAPI.runtime.sendMessage({ type: 'getAllData' })
      .then((data) => {
        console.log(data);
        watchData = data;
        render();
      });

    // Listen for changes
    browserAPI.storage.onChanged.addListener((changes) => {
      // if (changes.watchData) {
      //   watchData = changes.watchData.newValue || {};
      //   render();
      // }
      if (changes.darkModeEnabled) {
        darkModeEnabled = changes.darkModeEnabled.newValue;
        updateDarkModeUI();
      }
    });
  } else {
    watchData = {};
    render();
  }
}

function calculateWebsiteStats(date = "") {
  const aggregatedWebsiteData = {};

  for (const [category, categoryData] of Object.entries(watchData)) {
    for (const dayData of categoryData) {
      if (dayData && dayData.websites) {
        if (date != "" && dayData.date != date) {
          continue;
        }
        for (const host in dayData.websites) {
          if (!aggregatedWebsiteData[host]) {
            aggregatedWebsiteData[host] = {
              host,
              totalSeconds: 0,
              Reading: 0,
              Watching: 0,
              Speaking: 0,
            };
          }
          aggregatedWebsiteData[host][category] += dayData.websites[host];
          aggregatedWebsiteData[host].totalSeconds += dayData.websites[host];
        }
      }
    }
  }

  websiteStats = Object.values(aggregatedWebsiteData)
    .sort((a, b) => b.totalSeconds - a.totalSeconds);
}

function render() {
  calculateStats();
  buildHeatmap();
  buildWeeklyChart();
  buildMonthlyChart();
  buildWebsiteList();
  renderWebsitePieChart();
}

init();
