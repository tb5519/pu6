const databaseMonthInput = document.querySelector("#db-monthInput");
const databaseDateInput = document.querySelector("#db-dateInput");
const databaseRefreshButton = document.querySelector("#db-refreshButton");
const databaseMessage = document.querySelector("#db-message");
const databaseViews = document.querySelectorAll("[data-db-view]");
const databaseTopicButtons = document.querySelectorAll("[data-db-topic]");
const databaseClassCount = document.querySelector("#db-classCount");
const databaseStudentCount = document.querySelector("#db-studentCount");
const databaseAverageCompletion = document.querySelector("#db-averageCompletion");
const databaseLearningToday = document.querySelector("#db-learningToday");
const databaseLearningMonth = document.querySelector("#db-learningMonth");
const databaseRenewalToday = document.querySelector("#db-renewalToday");
const databaseRenewalMonth = document.querySelector("#db-renewalMonth");
const databaseReferralToday = document.querySelector("#db-referralToday");
const databaseReferralMonth = document.querySelector("#db-referralMonth");
const databaseReferralConversionToday = document.querySelector("#db-referralConversionToday");
const databaseReferralConversionMonth = document.querySelector("#db-referralConversionMonth");
const databaseCompletionRows = document.querySelector("#db-completionRows");
const databaseLearningRows = document.querySelector("#db-learningRows");
const databaseRenewalRows = document.querySelector("#db-renewalRows");
const databaseReferralRows = document.querySelector("#db-referralRows");
const databaseCategoryList = document.querySelector("#db-categoryList");
const databaseUpdatedAt = document.querySelector("#db-updatedAt");

const DATABASE_CATEGORIES = ["完课超赞", "异常断课", "长期不上课", "周末欠缺", "偶尔断课", "暂无数据"];

function setDatabaseMessage(message, isError = false) {
  if (!databaseMessage) return;
  databaseMessage.textContent = message || "";
  databaseMessage.classList.toggle("is-error", isError);
}

function padDatabaseNumber(value) {
  return String(value).padStart(2, "0");
}

function formatDatabaseDate(date) {
  return `${date.getFullYear()}-${padDatabaseNumber(date.getMonth() + 1)}-${padDatabaseNumber(date.getDate())}`;
}

function formatDatabaseMonth(date) {
  return `${date.getFullYear()}-${padDatabaseNumber(date.getMonth() + 1)}`;
}

function formatDatabasePercent(value) {
  if (value === null || value === undefined || value === "") return "-";
  return `${Number(value).toFixed(1).replace(/\.0$/, "")}%`;
}

function escapeDatabaseText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function databaseCount(source, key) {
  return Number(source?.[key] || 0);
}

async function databaseApiRequest(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "数据库读取失败，请稍后重试。");
  }
  return data;
}

function showDatabaseView(viewName) {
  databaseViews.forEach((view) => {
    view.classList.toggle("is-hidden", view.dataset.dbView !== viewName);
  });
}

function renderCategoryList(categoryCounts = {}) {
  if (!databaseCategoryList) return;
  databaseCategoryList.innerHTML = DATABASE_CATEGORIES.map((category) => {
    const count = databaseCount(categoryCounts, category);
    return `
      <span class="database-category-chip">
        <em>${escapeDatabaseText(category)}</em>
        <strong>${count}</strong>
      </span>
    `;
  }).join("");
}

function renderCompletionRows(classes = []) {
  if (!databaseCompletionRows) return;
  if (!classes.length) {
    databaseCompletionRows.innerHTML = `<tr><td colspan="10" class="database-empty-cell">暂无完课班级数据。</td></tr>`;
    return;
  }

  databaseCompletionRows.innerHTML = classes
    .map((item) => {
      const counts = item.category_counts || {};
      return `
        <tr>
          <td class="database-strong-cell">${escapeDatabaseText(item.name)}</td>
          <td>${escapeDatabaseText(item.teacher_name || "未分配")}</td>
          <td>${databaseCount(item, "student_count")}</td>
          <td>${databaseCount(item, "active_student_count")}</td>
          <td class="database-percent-cell">${formatDatabasePercent(item.average_completion)}</td>
          <td>${databaseCount(counts, "完课超赞")}</td>
          <td>${databaseCount(counts, "异常断课")}</td>
          <td>${databaseCount(counts, "长期不上课")}</td>
          <td>${databaseCount(counts, "周末欠缺")}</td>
          <td>${databaseCount(counts, "偶尔断课")}</td>
        </tr>
      `;
    })
    .join("");
}

function renderMetricRows(rows = [], target, emptyText) {
  if (!target) return;
  if (!rows.length) {
    target.innerHTML = `<tr><td colspan="4" class="database-empty-cell">${emptyText}</td></tr>`;
    return;
  }

  target.innerHTML = rows
    .map((row) => `
      <tr>
        <td class="database-strong-cell">${escapeDatabaseText(row.teacher_name)}</td>
        <td>${databaseCount(row, "student_count")}</td>
        <td>${databaseCount(row, "today")}</td>
        <td>${databaseCount(row, "month_total")}</td>
      </tr>
    `)
    .join("");
}

function renderReferralRows(rows = []) {
  if (!databaseReferralRows) return;
  if (!rows.length) {
    databaseReferralRows.innerHTML = `<tr><td colspan="6" class="database-empty-cell">暂无转介绍数据。</td></tr>`;
    return;
  }

  databaseReferralRows.innerHTML = rows
    .map((row) => `
      <tr>
        <td class="database-strong-cell">${escapeDatabaseText(row.teacher_name)}</td>
        <td>${databaseCount(row, "student_count")}</td>
        <td>${databaseCount(row, "leads_today")}</td>
        <td>${databaseCount(row, "leads_month_total")}</td>
        <td>${databaseCount(row, "conversions_today")}</td>
        <td>${databaseCount(row, "conversions_month_total")}</td>
      </tr>
    `)
    .join("");
}

function renderDatabase(data) {
  const completionSummary = data.completion?.summary || {};
  if (databaseClassCount) databaseClassCount.textContent = databaseCount(completionSummary, "class_count");
  if (databaseStudentCount) databaseStudentCount.textContent = databaseCount(completionSummary, "student_count");
  if (databaseAverageCompletion) databaseAverageCompletion.textContent = formatDatabasePercent(completionSummary.average_completion);
  if (databaseLearningToday) databaseLearningToday.textContent = databaseCount(data.learning, "today_total");
  if (databaseLearningMonth) databaseLearningMonth.textContent = databaseCount(data.learning, "month_total");
  if (databaseRenewalToday) databaseRenewalToday.textContent = databaseCount(data.renewal, "today_total");
  if (databaseRenewalMonth) databaseRenewalMonth.textContent = databaseCount(data.renewal, "month_total");
  if (databaseReferralToday) databaseReferralToday.textContent = databaseCount(data.referral, "leads_today_total");
  if (databaseReferralMonth) databaseReferralMonth.textContent = databaseCount(data.referral, "leads_month_total");
  if (databaseReferralConversionToday) {
    databaseReferralConversionToday.textContent = databaseCount(data.referral, "conversions_today_total");
  }
  if (databaseReferralConversionMonth) {
    databaseReferralConversionMonth.textContent = databaseCount(data.referral, "conversions_month_total");
  }
  if (databaseUpdatedAt) databaseUpdatedAt.textContent = `统计月份：${data.month}，统计日期：${data.date}`;

  renderCategoryList(completionSummary.category_counts);
  renderCompletionRows(data.completion?.classes || []);
  renderMetricRows(data.learning?.rows || [], databaseLearningRows, "暂无学情数据。");
  renderMetricRows(data.renewal?.rows || [], databaseRenewalRows, "暂无续费数据。");
  renderReferralRows(data.referral?.rows || []);
}

async function loadDatabaseSummary() {
  if (!databaseMonthInput || !databaseDateInput) return;

  if (databaseRefreshButton) databaseRefreshButton.disabled = true;
  setDatabaseMessage("正在读取数据库统计...");
  try {
    const params = new URLSearchParams({
      month: databaseMonthInput.value,
      date: databaseDateInput.value,
    });
    const data = await databaseApiRequest(`/api/database/summary?${params.toString()}`);
    renderDatabase(data);
    setDatabaseMessage("");
  } finally {
    if (databaseRefreshButton) databaseRefreshButton.disabled = false;
  }
}

function syncDatabaseDateToMonth() {
  if (!databaseMonthInput || !databaseDateInput) return;
  if (!databaseDateInput.value || !databaseDateInput.value.startsWith(`${databaseMonthInput.value}-`)) {
    databaseDateInput.value = `${databaseMonthInput.value}-01`;
  }
}

function initDatabase() {
  if (!databaseMonthInput) return;

  const today = new Date();
  databaseMonthInput.value = formatDatabaseMonth(today);
  databaseDateInput.value = formatDatabaseDate(today);

  databaseTopicButtons.forEach((button) => {
    button.addEventListener("click", () => showDatabaseView(button.dataset.dbTopic || "home"));
  });

  databaseMonthInput.addEventListener("change", () => {
    syncDatabaseDateToMonth();
    loadDatabaseSummary().catch((error) => setDatabaseMessage(error.message, true));
  });

  databaseDateInput?.addEventListener("change", () => {
    if (databaseDateInput.value) {
      databaseMonthInput.value = databaseDateInput.value.slice(0, 7);
    }
    loadDatabaseSummary().catch((error) => setDatabaseMessage(error.message, true));
  });

  databaseRefreshButton?.addEventListener("click", () => {
    loadDatabaseSummary().catch((error) => setDatabaseMessage(error.message, true));
  });

  showDatabaseView("home");
  loadDatabaseSummary().catch((error) => setDatabaseMessage(error.message, true));
}

initDatabase();
