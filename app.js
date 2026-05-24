const API = "/api/records";
const TIMES = [
  "06:00", "07:00", "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00", "16:00", "16:50",
  "17:40", "18:30", "19:20", "20:10", "21:00", "22:00",
  "23:00", "24:00"
];

const state = {
  records: [],
  search: "",
  continent: ""
};

const els = {
  sync: document.getElementById("syncState"),
  form: document.getElementById("recordForm"),
  rows: document.getElementById("recordRows"),
  search: document.getElementById("searchBox"),
  continentFilter: document.getElementById("continentFilter"),
  metricRow: document.getElementById("metricRow"),
  continentTimeStats: document.getElementById("continentTimeStats"),
  timeRank: document.getElementById("timeRank"),
  continentRank: document.getElementById("continentRank"),
statusRank: document.getElementById("statusRank"),
levelShare: document.getElementById("levelShare"),
toast: document.getElementById("toast")
};

document.querySelectorAll("[data-time-select]").forEach((select) => {
  select.insertAdjacentHTML(
    "beforeend",
    TIMES.map((time) => `<option>${time}</option>`).join("")
  );
});

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("is-active"));
    document.querySelectorAll(".panel").forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    document.getElementById(`tab-${button.dataset.tab}`).classList.add("is-active");
    if (button.dataset.tab !== "form") loadRecords(false);
  });
});

els.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(els.form).entries());
  try {
    setSync("正在保存");
    const result = await request(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    state.records = result.records || [];
    els.form.reset();
    els.form.id.value = "";
    renderAll();
    toast("记录已保存");
  } catch (error) {
    toast(error.message, true);
  } finally {
    setSync("已同步");
  }
});

document.getElementById("resetForm").addEventListener("click", () => {
  els.form.reset();
  els.form.id.value = "";
});

document.getElementById("refreshData").addEventListener("click", () => loadRecords(true));

els.search.addEventListener("input", () => {
  state.search = els.search.value.trim().toLowerCase();
  renderSummary();
});

els.continentFilter.addEventListener("change", () => {
  state.continent = els.continentFilter.value;
  renderSummary();
});

document.getElementById("exportCsv").addEventListener("click", () => {
  const rows = [
    ["学生ID", "归属LP", "归属大洲", "上课语种", "需求级别", "周几1", "北京时间1", "周几2", "北京时间2", "状态", "备注", "更新时间"]
  ];
  getFiltered().forEach((item) => {
    rows.push([
      item.studentId, item.lp, item.continent, item.language, item.level,
      item.day1, item.time1, item.day2, item.time2, item.status, item.note, formatDate(item.updatedAt)
    ]);
  });
  const csv = rows.map((row) => row.map((value) => `"${String(value || "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `学员排课需求_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
});

async function request(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || "请求失败");
  }
  return body;
}

async function loadRecords(showMessage) {
  try {
    setSync("正在同步");
    const result = await request(API);
    state.records = Array.isArray(result.records) ? result.records : [];
    renderAll();
    setSync(`已同步 ${formatTime(new Date())}`);
    if (showMessage) toast("数据已刷新");
  } catch (error) {
    setSync("同步失败");
    if (showMessage) toast(error.message, true);
  }
}

function renderAll() {
  renderSummary();
  renderAnalytics();
}

function getFiltered() {
  return state.records.filter((item) => {
    const text = [item.studentId, item.lp, item.continent, item.language, item.level, item.status]
      .join(" ")
      .toLowerCase();
    const matchesText = !state.search || text.includes(state.search);
    const matchesContinent = !state.continent || item.continent === state.continent;
    return matchesText && matchesContinent;
  });
}

function renderSummary() {
  const records = getFiltered();
  if (!records.length) {
    els.rows.innerHTML = `<tr><td colspan="10"><div class="empty">暂无数据</div></td></tr>`;
    return;
  }

  els.rows.innerHTML = records.map((item) => `
    <tr>
      <td>${escapeHtml(item.studentId)}</td>
      <td>${escapeHtml(item.lp)}</td>
      <td>${escapeHtml(item.continent)}</td>
      <td>${escapeHtml(item.language)}</td>
      <td>${escapeHtml(item.level || "-")}</td>
      <td>${escapeHtml(joinTime(item.day1, item.time1))}</td>
      <td>${escapeHtml(joinTime(item.day2, item.time2))}</td>
      <td><span class="status" data-status="${escapeHtml(item.status)}">${escapeHtml(item.status)}</span></td>
      <td>${formatDate(item.updatedAt)}</td>
      <td>
        <div class="row-actions">
          <button type="button" data-edit="${item.id}">编辑</button>
          <button type="button" data-delete="${item.id}">删除</button>
        </div>
      </td>
    </tr>
  `).join("");

  els.rows.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => editRecord(button.dataset.edit));
  });
  els.rows.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteRecord(button.dataset.delete));
  });
}

function renderAnalytics() {
  const total = state.records.length;
  const active = state.records.filter((item) => item.status === "上课中").length;
  const continents = new Set(state.records.map((item) => item.continent).filter(Boolean)).size;
  const timeCount = countTimes(state.records);

  els.metricRow.innerHTML = [
    metric("总记录", total),
    metric("上课中", active),
    metric("涉及大洲", continents),
    metric("时间偏好次数", Object.values(timeCount).reduce((sum, value) => sum + value, 0))
  ].join("");

  renderContinentTime();
  renderRank(els.timeRank, timeCount, "次");
renderRank(els.continentRank, countBy(state.records, "continent"), "人");
renderRank(els.statusRank, countBy(state.records, "status"), "人");
renderShare(els.levelShare, countLevels(state.records), total);
}

function renderContinentTime() {
  const grouped = {};
  state.records.forEach((item) => {
    if (!item.continent) return;
    grouped[item.continent] ||= {};
    [item.time1, item.time2].filter(Boolean).forEach((time) => {
      grouped[item.continent][time] = (grouped[item.continent][time] || 0) + 1;
    });
  });

  const continents = Object.keys(grouped).sort();
  if (!continents.length) {
    els.continentTimeStats.innerHTML = `<div class="empty">暂无时间数据</div>`;
    return;
  }

  els.continentTimeStats.innerHTML = continents.map((continent) => {
    const chips = Object.entries(grouped[continent])
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([time, count]) => `<span class="time-chip">${time}：${count}次</span>`)
      .join("");
    return `<div class="continent-box"><h3>${escapeHtml(continent)}</h3><div class="time-chip-row">${chips || "暂无时间"}</div></div>`;
  }).join("");
}

function renderRank(container, data, unit) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (!entries.length) {
    container.innerHTML = `<div class="empty">暂无数据</div>`;
    return;
  }function renderShare(container, data, total) {
  const entries = Object.entries(data).sort((a, b) => {
    const levelA = Number(a[0].replace("S", ""));
    const levelB = Number(b[0].replace("S", ""));
    if (Number.isFinite(levelA) && Number.isFinite(levelB)) return levelA - levelB;
    return b[1] - a[1] || a[0].localeCompare(b[0]);
  });

  if (!entries.length) {
    container.innerHTML = `<div class="empty">暂无级别数据</div>`;
    return;
  }

  const max = Math.max(...entries.map((item) => item[1]), 1);
  container.innerHTML = entries.map(([name, count]) => {
    const pct = total ? Math.round((count / total) * 100) : 0;
    return `
      <div class="bar">
        <div class="bar-name">${escapeHtml(name)}</div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${Math.max((count / max) * 100, 8)}%">${pct}%</div>
        </div>
        <div>${count}人</div>
      </div>
    `;
  }).join("");
}

function countLevels(records) {
  return records.reduce((acc, item) => {
    const value = item.level || "未填写";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}
  const max = Math.max(...entries.map((item) => item[1]), 1);
  container.innerHTML = entries.map(([name, count]) => `
    <div class="bar">
      <div class="bar-name">${escapeHtml(name)}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${Math.max((count / max) * 100, 8)}%">${count}</div>
      </div>
      <div>${unit}</div>
    </div>
  `).join("");
}

function editRecord(id) {
  const item = state.records.find((record) => record.id === id);
  if (!item) return;
  Object.entries(item).forEach(([key, value]) => {
    if (els.form.elements[key]) els.form.elements[key].value = value || "";
  });
  document.querySelector('[data-tab="form"]').click();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteRecord(id) {
  if (!confirm("确认删除这条记录吗？")) return;
  try {
    setSync("正在删除");
    const result = await request(`${API}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    state.records = result.records || [];
    renderAll();
    toast("记录已删除");
  } catch (error) {
    toast(error.message, true);
  } finally {
    setSync("已同步");
  }
}

function countBy(records, key) {
  return records.reduce((acc, item) => {
    const value = item[key];
    if (value) acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function countTimes(records) {
  return records.reduce((acc, item) => {
    [item.time1, item.time2].filter(Boolean).forEach((time) => {
      acc[time] = (acc[time] || 0) + 1;
    });
    return acc;
  }, {});
}

function metric(label, value) {
  return `<div class="metric"><strong>${value}</strong><span>${label}</span></div>`;
}

function joinTime(day, time) {
  if (!day && !time) return "-";
  return `${day || ""} ${time || ""}`.trim();
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatTime(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function setSync(text) {
  els.sync.textContent = text;
}

function toast(message, isError = false) {
  els.toast.textContent = message;
  els.toast.style.background = isError ? "#b91c1c" : "#111827";
  els.toast.classList.add("show");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 2200);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

loadRecords(false);
window.setInterval(() => loadRecords(false), 15000);
