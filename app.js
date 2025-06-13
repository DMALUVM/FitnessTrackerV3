const defaultGoals = { pushups: 200, pullups: 20, squats: 200 };
let goals = { ...defaultGoals };
let activityData = JSON.parse(localStorage.getItem('activityData') || '{}');
const todayStr = new Date().toISOString().split('T')[0];

window.addEventListener('DOMContentLoaded', () => {
  const savedGoals = JSON.parse(localStorage.getItem('goals'));
  if (savedGoals) {
    goals = savedGoals;
    ['pushups', 'pullups', 'squats'].forEach(k => {
      document.getElementById(`goal${capitalize(k)}`).value = goals[k];
    });
  }
  updateProgressBars();
  renderCalendar();
  updateSummary();
  renderHistoryTable();
});

function validateForm(isEdit = false) {
  let isValid = true;
  const prefix = isEdit ? 'edit' : '';
  const errors = {};
  const fields = ['Pushups', 'Pullups', 'Squats', 'DeadHang'];

  fields.forEach(field => {
    const input = document.getElementById(`${prefix}${field}`);
    const value = input.value;
    if (['Pushups', 'Pullups', 'Squats'].includes(field)) {
      if (isNaN(value) || value < 0) {
        errors[`${prefix}${field}`] = 'Please enter a valid non-negative number';
        isValid = false;
      }
    }
    if (field === 'DeadHang' && value && !/^\d+:\d{2}$/.test(value)) {
      errors[`${prefix}${field}`] = 'Enter time in mm:ss format';
      isValid = false;
    }
  });

  const formSelector = isEdit ? '#edit-form' : '#workout-form';
  document.querySelectorAll(`${formSelector} .invalid-feedback`).forEach(el => {
    const field = el.id.replace('-error', '');
    if (errors[field]) {
      el.textContent = errors[field];
      el.style.display = 'block';
    } else {
      el.style.display = 'none';
    }
  });

  return isValid;
}

function saveGoals() {
  goals = {
    pushups: parseInt(document.getElementById('goalPushups').value) || 0,
    pullups: parseInt(document.getElementById('goalPullups').value) || 0,
    squats: parseInt(document.getElementById('goalSquats').value) || 0
  };
  localStorage.setItem('goals', JSON.stringify(goals));
  updateProgressBars();
  renderCalendar();
  updateSummary();
  renderHistoryTable();
}

let goalSaveTimer;
function debounceSaveGoals() {
  clearTimeout(goalSaveTimer);
  goalSaveTimer = setTimeout(saveGoals, 400);
}

function saveTodayEntry(e) {
  e.preventDefault();
  if (!validateForm()) return;

  const entry = {
    pushups: +document.getElementById('pushups').value || 0,
    pullups: +document.getElementById('pullups').value || 0,
    squats: +document.getElementById('squats').value || 0,
    deadHang: document.getElementById('deadHang').value || ''
  };

  const prev = activityData[todayStr] || { pushups: 0, pullups: 0, squats: 0, deadHang: '' };
  const updated = {
    pushups: prev.pushups + entry.pushups,
    pullups: prev.pullups + entry.pullups,
    squats: prev.squats + entry.squats,
    deadHang: entry.deadHang || prev.deadHang
  };

  activityData[todayStr] = updated;
  localStorage.setItem('activityData', JSON.stringify(activityData));
  updateProgressBars();
  renderCalendar();
  updateSummary();
  renderHistoryTable();
  sendToGoogleSheets(todayStr, updated);

  ['pushups', 'pullups', 'squats', 'deadHang'].forEach(id => document.getElementById(id).value = '');
}

function sendToGoogleSheets(date, entry, retries = 2) {
  fetch("https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, ...entry })
  })
  .then(res => res.text())
  .then(msg => console.log("✅ Backup:", msg))
  .catch(err => {
    console.error("❌ Google Sheets Failed:", err);
    if (retries > 0) setTimeout(() => sendToGoogleSheets(date, entry, retries - 1), 2000);
  });
}

function updateProgressBars() {
  const d = activityData[todayStr] || { pushups: 0, pullups: 0, squats: 0 };
  updateBar('progressPushups', d.pushups, goals.pushups);
  updateBar('progressPullups', d.pullups, goals.pullups);
  updateBar('progressSquats', d.squats, goals.squats);
}

function updateBar(id, val, goal) {
  const pct = Math.min((val / goal) * 100, 100);
  const el = document.getElementById(id);
  el.style.width = pct + '%';
  el.style.backgroundColor = pct >= 100 ? 'green' : pct >= 50 ? 'orange' : 'red';

  let label = el.parentElement.querySelector('.bar-total-label');
  if (!label) {
    label = document.createElement('span');
    label.className = 'bar-total-label';
    el.parentElement.appendChild(label);
  }
  label.textContent = `${val}/${goal}`;
}

function saveEditEntry(e) {
  e.preventDefault();
  if (!validateForm(true)) return;

  const d = document.getElementById('editModal').dataset.date;
  activityData[d] = {
    pushups: +document.getElementById('editPushups').value || 0,
    pullups: +document.getElementById('editPullups').value || 0,
    squats: +document.getElementById('editSquats').value || 0,
    deadHang: document.getElementById('editDeadHang').value || ''
  };

  localStorage.setItem('activityData', JSON.stringify(activityData));
  renderCalendar();
  updateSummary();
  renderHistoryTable();
  if (d === todayStr) updateProgressBars();
  sendToGoogleSheets(d, activityData[d]);
  document.getElementById('editModal').classList.add('hidden');
}

function deleteEntry(d) {
  if (confirm('Delete this workout entry?')) {
    delete activityData[d];
    localStorage.setItem('activityData', JSON.stringify(activityData));
    renderCalendar();
    updateSummary();
    renderHistoryTable();
    if (d === todayStr) updateProgressBars();
  }
}

function renderCalendar() {
  const calendar = document.getElementById('calendar');
  calendar.innerHTML = '';
  const now = new Date(), y = now.getFullYear(), m = now.getMonth();
  const start = new Date(y, m, 1), end = new Date(y, m + 1, 0);
  document.getElementById('calendarMonthYear').textContent = `${now.toLocaleString('default', { month: 'long' })} ${y}`;

  let day = new Date(start);
  day.setDate(day.getDate() - day.getDay());

  while (day <= end || day.getDay() !== 0) {
    const ds = day.toISOString().split('T')[0];
    const box = document.createElement('div');
    box.className = 'calendar-day';
    if (ds === todayStr) box.style.border = '2px solid #007bff';
    box.tabIndex = 0;
    box.innerHTML = `<div class="date-label">${day.getDate()}</div>`;

    if (activityData[ds]) {
      const a = activityData[ds];
      box.innerHTML += `
        <div class="emoji-indicators">
          ${['pushups', 'pullups', 'squats'].map(k =>
            a[k] >= goals[k] ? '✅' : (a[k] > 0 ? '⚠️' : '❌')
          ).map(e => `<span>${e}</span>`).join('')}
        </div>
        ${a.deadHang ? `<div>⏱ ${a.deadHang}</div>` : ''}
      `;
    }

    box.addEventListener('click', () => openEditModal(ds));
    calendar.appendChild(box);
    day.setDate(day.getDate() + 1);
  }
}

function openEditModal(ds) {
  const d = activityData[ds] || { pushups: 0, pullups: 0, squats: 0, deadHang: '' };
  document.getElementById('editDateLabel').textContent = ds;
  document.getElementById('editModal').dataset.date = ds;
  ['pushups', 'pullups', 'squats', 'deadHang'].forEach(k => {
    document.getElementById(`edit${capitalize(k)}`).value = d[k];
  });
  document.getElementById('editModal').classList.remove('hidden');
}

function updateSummary() {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const totals = { week: {}, month: {}, year: {}, allTime: {} };
  ['week', 'month', 'year', 'allTime'].forEach(k => totals[k] = { pushups: 0, pullups: 0, squats: 0 });

  for (const [ds, d] of Object.entries(activityData)) {
    const date = new Date(ds);
    if (date >= startOfWeek) addToTotals(totals.week, d);
    if (date >= startOfMonth) addToTotals(totals.month, d);
    if (date >= startOfYear) addToTotals(totals.year, d);
    addToTotals(totals.allTime, d);
  }

  const sum = totals;
  document.getElementById('summary').innerHTML = `
    <strong>Week:</strong> Pushups: ${sum.week.pushups}, Pullups: ${sum.week.pullups}, Squats: ${sum.week.squats}<br>
    <strong>Month:</strong> Pushups: ${sum.month.pushups}, Pullups: ${sum.month.pullups}, Squats: ${sum.month.squats}<br>
    <strong>Year:</strong> Pushups: ${sum.year.pushups}, Pullups: ${sum.year.pullups}, Squats: ${sum.year.squats}<br>
    <strong>All Time:</strong> Pushups: ${sum.allTime.pushups}, Pullups: ${sum.allTime.pullups}, Squats: ${sum.allTime.squats}
  `;
}

function addToTotals(t, d) {
  ['pushups', 'pullups', 'squats'].forEach(k => t[k] += d[k] || 0);
}

function renderHistoryTable(sortKey = 'date', ascending = true) {
  const tbody = document.getElementById('workout-history');
  tbody.innerHTML = '';
  const entries = Object.entries(activityData).map(([date, data]) => ({ date, ...data }));
  entries.sort((a, b) => {
    if (sortKey === 'date') return ascending ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
    if (sortKey === 'deadHang') return ascending ? (a.deadHang || '').localeCompare(b.deadHang || '') : (b.deadHang || '').localeCompare(a.deadHang || '');
    return ascending ? (a[sortKey] || 0) - (b[sortKey] || 0) : (b[sortKey] || 0) - (a[sortKey] || 0);
  });

  entries.forEach(entry => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${entry.date}</td>
      <td>${entry.pushups}</td>
      <td>${entry.pullups}</td>
      <td>${entry.squats}</td>
      <td>${entry.deadHang || '-'}</td>
      <td>
        <button class="btn btn-outline-primary btn-sm edit-btn" data-date="${entry.date}">Edit</button>
        <button class="btn btn-outline-danger btn-sm delete-btn" data-date="${entry.date}">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });

  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.date));
  });
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteEntry(btn.dataset.date));
  });

  document.querySelectorAll('.sortable').forEach(th => {
    th.classList.remove('asc', 'desc');
    if (th.dataset.sort === sortKey) th.classList.add(ascending ? 'asc' : 'desc');
  });
}

// Utilities
function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Events
document.getElementById('workout-form').addEventListener('submit', saveTodayEntry);
document.getElementById('edit-form').addEventListener('submit', saveEditEntry);
document.querySelectorAll('.goals-section input').forEach(input => {
  input.addEventListener('input', debounceSaveGoals);
});
document.getElementById('closeModal').addEventListener('click', () => {
  document.getElementById('editModal').classList.add('hidden');
});
document.querySelectorAll('.sortable').forEach(th => {
  th.addEventListener('click', () => {
    const k = th.dataset.sort;
    const asc = !th.classList.contains('asc');
    renderHistoryTable(k, asc);
  });
});
