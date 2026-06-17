const databaseMonthInput = document.querySelector("#db-monthInput");
const databaseDateInput = document.querySelector("#db-dateInput");
const databaseRefreshButton = document.querySelector("#db-refreshButton");
const databaseArchiveMonthButton = document.querySelector("#db-archiveMonthButton");
const databaseMessage = document.querySelector("#db-message");
const databaseViews = document.querySelectorAll("[data-db-view]");
const databaseTopicButtons = document.querySelectorAll("[data-db-topic]");
const databaseClassCount = document.querySelector("#db-classCount");
const databaseStudentCount = document.querySelector("#db-studentCount");
const databaseAverageCompletion = document.querySelector("#db-averageCompletion");
const databaseLearningToday = document.querySelector("#db-learningToday");
const databaseLearningMonth = document.querySelector("#db-learningMonth");
const databaseLearningBase = document.querySelector("#db-learningBase");
const databaseRenewalToday = document.querySelector("#db-renewalToday");
const databaseRenewalMonth = document.querySelector("#db-renewalMonth");
const databaseReferralToday = document.querySelector("#db-referralToday");
const databaseReferralMonth = document.querySelector("#db-referralMonth");
const databaseReferralConversionToday = document.querySelector("#db-referralConversionToday");
const databaseReferralConversionMonth = document.querySelector("#db-referralConversionMonth");
const databaseGmvMonth = document.querySelector("#db-gmvMonth");
const databaseGmvRenewalMonth = document.querySelector("#db-gmvRenewalMonth");
const databaseGmvReferralMonth = document.querySelector("#db-gmvReferralMonth");
const databaseCompletionRows = document.querySelector("#db-completionRows");
const databaseCompletionSnapshotStatus = document.querySelector("#db-completionSnapshotStatus");
const databaseCompletionUploadPanel = document.querySelector("#db-completionUploadPanel");
const databaseCompletionUploadDate = document.querySelector("#db-completionUploadDate");
const databaseCompletionUploadButton = document.querySelector("#db-completionUploadButton");
const databaseCompletionFileInput = document.querySelector("#db-completionFileInput");
const databaseCompletionLastMonthInput = document.querySelector("#db-completionLastMonthInput");
const databaseCompletionLastMonthButton = document.querySelector("#db-completionLastMonthButton");
const databaseCompletionLastMonthFileInput = document.querySelector("#db-completionLastMonthFileInput");
const databaseCompletionCompareDate = document.querySelector("#db-completionCompareDate");
const databaseCompletionHistoryToggle = document.querySelector("#db-completionHistoryToggle");
const databaseCompletionCompareCards = document.querySelector("#db-completionCompareCards");
const databaseCompletionHead = document.querySelector("#db-completionHead");
const databaseCompletionPerformanceRows = document.querySelector("#db-completionPerformanceRows");
const databaseLearningRows = document.querySelector("#db-learningRows");
const databaseLearningEditButton = document.querySelector("#db-learningEditButton");
const databaseLearningEditor = document.querySelector("#db-learningEditor");
const databaseLearningClassRows = document.querySelector("#db-learningClassRows");
const databaseLearningTargetRows = document.querySelector("#db-learningTargetRows");
const databaseLearningCancelButton = document.querySelector("#db-learningCancelButton");
const databaseLearningSaveButton = document.querySelector("#db-learningSaveButton");
const databaseRenewalRows = document.querySelector("#db-renewalRows");
const databaseReferralRows = document.querySelector("#db-referralRows");
const databaseGmvRenewalRows = document.querySelector("#db-gmvRenewalRows");
const databaseGmvReferralRows = document.querySelector("#db-gmvReferralRows");
const databaseGmvTargetSummary = document.querySelector("#db-gmvTargetSummary");
const databaseGmvEditButton = document.querySelector("#db-gmvEditButton");
const databaseGmvSaveButton = document.querySelector("#db-gmvSaveButton");
const databaseGmvCancelButton = document.querySelector("#db-gmvCancelButton");
const databaseRankCompletionRows = document.querySelector("#db-rankCompletionRows");
const databaseRankLearningRows = document.querySelector("#db-rankLearningRows");
const databaseRankRenewalRows = document.querySelector("#db-rankRenewalRows");
const databaseRankReferralRows = document.querySelector("#db-rankReferralRows");
const databaseRankGmvRows = document.querySelector("#db-rankGmvRows");
const databaseCategoryList = document.querySelector("#db-categoryList");
const databaseUpdatedAt = document.querySelector("#db-updatedAt");

const DATABASE_CATEGORIES = ["完课超赞", "异常断课", "断续上课", "长期不上课", "周末欠缺", "偶尔断课", "暂无数据"];
const LEARNING_TARGET_RATES = [0.26, 0.28, 0.3];
const GMV_SECTION_LABELS = { renewal: "续费", referral: "转介绍" };
let currentDatabaseData = null;
let selectedCompletionCompareDate = "";
let showOlderCompletionDates = false;
let gmvEditMode = false;

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

function previousDatabaseMonth(monthValue) {
  const [yearText, monthText] = String(monthValue || formatDatabaseMonth(new Date())).split("-");
  let year = Number(yearText);
  let month = Number(monthText);
  if (!year || !month) return formatDatabaseMonth(new Date());
  month -= 1;
  if (month === 0) {
    year -= 1;
    month = 12;
  }
  return `${year}-${padDatabaseNumber(month)}`;
}

function formatDatabaseShortDate(dateText) {
  const parts = String(dateText || "").split("-");
  if (parts.length !== 3) return dateText || "-";
  return `${Number(parts[1])}.${Number(parts[2])}`;
}

function completionHistoryValue(row, dateText) {
  const item = (row.history || []).find((entry) => entry.date === dateText);
  return item ? item.completion_rate : null;
}

function formatDatabasePercent(value) {
  if (value === null || value === undefined || value === "") return "-";
  return `${Number(value).toFixed(1).replace(/\.0$/, "")}%`;
}

function formatDatabasePercentFixed(value) {
  if (value === null || value === undefined || value === "") return "-";
  return `${Number(value).toFixed(2)}%`;
}

function escapeDatabaseText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeDatabaseSelector(value) {
  if (window.CSS?.escape) return window.CSS.escape(String(value ?? ""));
  return String(value ?? "").replace(/["\\]/g, "\\$&");
}

function databaseCount(source, key) {
  return Number(source?.[key] || 0);
}

function formatDatabaseInteger(value) {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  if (Number.isNaN(number)) return "-";
  return String(Math.round(number));
}

function formatDatabaseNumber(value) {
  const number = Number(value || 0);
  if (Number.isNaN(number)) return "0";
  return number.toFixed(2).replace(/\.?0+$/, "");
}

function formatDatabaseMoney(value) {
  const number = Number(value || 0);
  if (Number.isNaN(number)) return "¥0";
  return `¥${Math.round(number).toLocaleString("zh-CN")}`;
}

function formatDatabaseMoneyOptional(value) {
  if (value === null || value === undefined || value === "") return "-";
  return formatDatabaseMoney(value);
}

function formatDatabaseMoneyDelta(value) {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  if (Number.isNaN(number)) return "-";
  const prefix = number > 0 ? "+" : number < 0 ? "-" : "";
  return `${prefix}¥${Math.round(Math.abs(number)).toLocaleString("zh-CN")}`;
}

function formatTargetRate(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function databaseGapClass(value) {
  return Number(value || 0) >= 0 ? "is-positive" : "is-negative";
}

function databaseDeltaClass(value) {
  if (value === null || value === undefined || value === "") return "is-neutral";
  return Number(value) >= 0 ? "is-positive" : "is-negative";
}

function formatDatabaseDelta(value) {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  if (Number.isNaN(number)) return "-";
  const prefix = number > 0 ? "+" : "";
  return `${prefix}${formatDatabasePercent(number)}`;
}

async function databaseApiRequest(url, options = {}) {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const response = await fetch(url, {
    headers: options.body && !isFormData ? { "Content-Type": "application/json" } : {},
    ...options,
  });
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

function renderCompletionCompareOptions(completion = {}) {
  if (!databaseCompletionCompareDate) return;
  const compareDates = completion.compare_dates || [];
  const activeDate = completion.comparison?.compare_date || "";
  selectedCompletionCompareDate = activeDate;
  databaseCompletionCompareDate.innerHTML = compareDates.length
    ? compareDates.map((dateText) => `
      <option value="${escapeDatabaseText(dateText)}"${dateText === activeDate ? " selected" : ""}>
        ${escapeDatabaseText(formatDatabaseShortDate(dateText))}
      </option>
    `).join("")
    : `<option value="">暂无可对比日期</option>`;
  databaseCompletionCompareDate.disabled = !compareDates.length;
}

function completionVisibleDates(completion = {}) {
  const dates = completion.history_dates || [];
  return showOlderCompletionDates ? dates : dates.slice(0, 2);
}

function renderCompletionHead(completion = {}) {
  if (!databaseCompletionHead) return;
  const visibleDates = completionVisibleDates(completion);
  const comparison = completion.comparison || {};
  const compareLabel = comparison.compare_date ? `较${formatDatabaseShortDate(comparison.compare_date)}涨幅` : "对比涨幅";
  databaseCompletionHead.innerHTML = `
    <tr>
      <th>班级名称</th>
      <th>班主任</th>
      <th>在班学员数</th>
      ${visibleDates.map((dateText) => `<th>${escapeDatabaseText(formatDatabaseShortDate(dateText))}完成度</th>`).join("")}
      <th>上个月完课率</th>
      <th>${escapeDatabaseText(compareLabel)}</th>
      <th>较上个月涨幅</th>
    </tr>
  `;
}

function renderCompletionRows(classes = [], completion = {}) {
  if (!databaseCompletionRows) return;
  const visibleDates = completionVisibleDates(completion);
  const columnCount = 6 + visibleDates.length;
  if (!classes.length) {
    databaseCompletionRows.innerHTML = `<tr><td colspan="${columnCount}" class="database-empty-cell">暂无完课班级数据。</td></tr>`;
    return;
  }

  databaseCompletionRows.innerHTML = classes
    .map((item) => {
      return `
        <tr>
          <td class="database-strong-cell">${escapeDatabaseText(item.name)}</td>
          <td>${escapeDatabaseText(item.teacher_name || "未分配")}</td>
          <td>${formatDatabaseInteger(item.student_count)}</td>
          ${visibleDates.map((dateText) => `
            <td class="database-percent-cell">${formatDatabasePercent(completionHistoryValue(item, dateText))}</td>
          `).join("")}
          <td>${formatDatabasePercent(item.last_month_completion)}</td>
          <td class="database-delta-cell ${databaseDeltaClass(item.change_from_compare)}">${formatDatabaseDelta(item.change_from_compare)}</td>
          <td class="database-delta-cell ${databaseDeltaClass(item.change_from_last_month)}">${formatDatabaseDelta(item.change_from_last_month)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderCompletionComparison(completion = {}) {
  if (!databaseCompletionCompareCards) return;
  renderCompletionCompareOptions(completion);
  if (databaseCompletionHistoryToggle) {
    const hasOlderDates = Boolean((completion.older_history_dates || []).length);
    databaseCompletionHistoryToggle.disabled = !hasOlderDates;
    databaseCompletionHistoryToggle.textContent = showOlderCompletionDates ? "收起更早数据" : "展开更早数据";
  }
  const comparison = completion.comparison || {};
  const sourceDate = completion.snapshot_date || "";
  const sourceLabel = sourceDate ? `当前数据：${sourceDate}` : "当前数据：暂无上传快照";
  const compareLabel = comparison.compare_date
    ? `对比日期：${comparison.compare_date}`
    : "对比日期：暂无";
  const lastMonthLabel = comparison.last_month_source_month
    ? `上月基准：${comparison.last_month_source_month}`
    : "上月基准：暂无";

  databaseCompletionCompareCards.innerHTML = `
    <article class="completion-compare-card">
      <span>数据日期</span>
      <strong>${escapeDatabaseText(sourceDate || "-")}</strong>
      <small>${escapeDatabaseText(completion.source === "snapshot" ? sourceLabel : "等待 Joanna 上传数据")}</small>
    </article>
    <article class="completion-compare-card">
      <span>较所选日期</span>
      <strong class="${databaseDeltaClass(comparison.compare_change)}">${formatDatabaseDelta(comparison.compare_change)}</strong>
      <small>${escapeDatabaseText(compareLabel)}</small>
    </article>
    <article class="completion-compare-card">
      <span>较上个月</span>
      <strong class="${databaseDeltaClass(comparison.last_month_change)}">${formatDatabaseDelta(comparison.last_month_change)}</strong>
      <small>${escapeDatabaseText(lastMonthLabel)}</small>
    </article>
  `;

  if (databaseCompletionSnapshotStatus) {
    if (completion.source === "snapshot") {
      databaseCompletionSnapshotStatus.textContent = `${sourceLabel}，按班级分配表匹配 Joanna 上传数据`;
    } else if (completion.source === "assignment") {
      databaseCompletionSnapshotStatus.textContent = "已读取班级分配表，等待 Joanna 上传完课数据";
    } else {
      databaseCompletionSnapshotStatus.textContent = "尚未上传完课快照，暂按原班级学员明细展示";
    }
  }
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

function renderRenewalRows(rows = []) {
  if (!databaseRenewalRows) return;
  if (!rows.length) {
    databaseRenewalRows.innerHTML = `<tr><td colspan="6" class="database-empty-cell">暂无续费数据。</td></tr>`;
    return;
  }

  databaseRenewalRows.innerHTML = rows
    .map((row) => {
      const weekTotals = row.week_totals || [0, 0, 0, 0];
      return `
        <tr>
          <td class="database-strong-cell">${escapeDatabaseText(row.teacher_name)}</td>
          <td>${databaseCount(weekTotals, 0)}</td>
          <td>${databaseCount(weekTotals, 1)}</td>
          <td>${databaseCount(weekTotals, 2)}</td>
          <td>${databaseCount(weekTotals, 3)}</td>
          <td class="database-strong-cell">${databaseCount(row, "month_total")}</td>
        </tr>
      `;
    })
    .join("");
}

function renderLearningRows(rows = []) {
  if (!databaseLearningRows) return;
  if (!rows.length) {
    databaseLearningRows.innerHTML = `<tr><td colspan="6" class="database-empty-cell">暂无学情数据。</td></tr>`;
    return;
  }

  databaseLearningRows.innerHTML = rows
    .map((row) => `
      <tr>
        <td class="database-strong-cell">${escapeDatabaseText(row.teacher_name)}</td>
        <td>${databaseCount(row, "student_count")}</td>
        <td>${formatDatabaseNumber(row.learning_base)}</td>
        <td>
          <span class="database-target-value">${formatDatabaseNumber(row.target_learning)}</span>
          <small class="database-rate-note">${formatTargetRate(row.target_rate)}</small>
        </td>
        <td>${databaseCount(row, "month_total")}</td>
        <td class="database-gap-cell ${databaseGapClass(row.target_gap)}">${formatDatabaseNumber(row.target_gap)}</td>
      </tr>
    `)
    .join("");
}

function renderLearningEditor(data = currentDatabaseData) {
  if (!databaseLearningClassRows || !databaseLearningTargetRows || !data) return;
  const learning = data.learning || {};
  const classes = learning.classes || [];
  const teachers = learning.rows || [];
  const rates = learning.target_rates || LEARNING_TARGET_RATES;

  databaseLearningClassRows.innerHTML = classes.length
    ? classes.map((item) => `
      <tr>
        <td>${escapeDatabaseText(item.teacher_name)}</td>
        <td class="database-strong-cell">${escapeDatabaseText(item.class_name)}</td>
        <td>${databaseCount(item, "student_count")}</td>
        <td>
          <input
            class="database-coefficient-input${item.can_edit ? "" : " is-readonly"}"
            type="number"
            min="0"
            step="0.01"
            value="${formatDatabaseNumber(item.coefficient)}"
            data-learning-coefficient
            data-class-id="${escapeDatabaseText(item.class_id)}"
            data-teacher-id="${escapeDatabaseText(item.teacher_id)}"
            data-student-count="${databaseCount(item, "student_count")}"
            ${item.can_edit ? "" : "disabled"}
          >
        </td>
        <td><span data-learning-class-base="${escapeDatabaseText(item.class_id)}">${formatDatabaseNumber(item.learning_base)}</span></td>
      </tr>
    `).join("")
    : `<tr><td colspan="5" class="database-empty-cell">暂无完课班级，请先在完课板块导入班级。</td></tr>`;

  databaseLearningTargetRows.innerHTML = teachers.length
    ? teachers.map((item) => `
      <tr>
        <td class="database-strong-cell">${escapeDatabaseText(item.teacher_name)}</td>
        <td><span data-learning-target-base="${escapeDatabaseText(item.teacher_id)}">${formatDatabaseNumber(item.learning_base)}</span></td>
        <td>
          <select class="database-target-select${item.can_edit ? "" : " is-readonly"}" data-learning-target-rate data-teacher-id="${escapeDatabaseText(item.teacher_id)}" ${item.can_edit ? "" : "disabled"}>
            ${rates.map((rate) => `
              <option value="${rate}"${Number(item.target_rate) === Number(rate) ? " selected" : ""}>${formatTargetRate(rate)}</option>
            `).join("")}
          </select>
        </td>
        <td><span data-learning-target-output="${escapeDatabaseText(item.teacher_id)}">${formatDatabaseNumber(item.target_learning)}</span></td>
      </tr>
    `).join("")
    : `<tr><td colspan="4" class="database-empty-cell">暂无班主任数据。</td></tr>`;

  databaseLearningClassRows.querySelectorAll("[data-learning-coefficient]").forEach((input) => {
    input.addEventListener("input", recalculateLearningEditor);
  });
  databaseLearningTargetRows.querySelectorAll("[data-learning-target-rate]").forEach((select) => {
    select.addEventListener("change", recalculateLearningEditor);
  });
  recalculateLearningEditor();
}

function recalculateLearningEditor() {
  const baseByTeacher = {};
  databaseLearningClassRows?.querySelectorAll("[data-learning-coefficient]").forEach((input) => {
    const studentCount = Number(input.dataset.studentCount || 0);
    const coefficient = Math.max(0, Number(input.value || 0));
    const base = studentCount * (Number.isNaN(coefficient) ? 0 : coefficient);
    baseByTeacher[input.dataset.teacherId] = (baseByTeacher[input.dataset.teacherId] || 0) + base;
    const classBase = databaseLearningClassRows.querySelector(`[data-learning-class-base="${escapeDatabaseSelector(input.dataset.classId)}"]`);
    if (classBase) classBase.textContent = formatDatabaseNumber(base);
  });

  databaseLearningTargetRows?.querySelectorAll("[data-learning-target-rate]").forEach((select) => {
    const teacherId = select.dataset.teacherId;
    const base = baseByTeacher[teacherId] || 0;
    const rate = Number(select.value || 0);
    const baseTarget = databaseLearningTargetRows.querySelector(`[data-learning-target-base="${escapeDatabaseSelector(teacherId)}"]`);
    const targetOutput = databaseLearningTargetRows.querySelector(`[data-learning-target-output="${escapeDatabaseSelector(teacherId)}"]`);
    if (baseTarget) baseTarget.textContent = formatDatabaseNumber(base);
    if (targetOutput) targetOutput.textContent = formatDatabaseNumber(base * rate);
  });
}

function toggleLearningEditor(shouldShow) {
  if (!databaseLearningEditor) return;
  databaseLearningEditor.classList.toggle("is-hidden", !shouldShow);
  if (shouldShow) renderLearningEditor();
}

function syncCompletionUploadDate() {
  if (!databaseCompletionUploadDate || !databaseDateInput) return;
  databaseCompletionUploadDate.value = databaseDateInput.value || formatDatabaseDate(new Date());
  if (databaseCompletionLastMonthInput && databaseMonthInput) {
    databaseCompletionLastMonthInput.value = previousDatabaseMonth(databaseMonthInput.value);
  }
}

async function uploadCompletionSnapshot(file) {
  if (!databaseCompletionUploadButton || !databaseCompletionUploadDate) return;
  const uploadDate = databaseCompletionUploadDate.value || databaseDateInput.value;
  if (!uploadDate) {
    setDatabaseMessage("请先选择完课数据日期。", true);
    return;
  }
  if (!file) {
    setDatabaseMessage("请先选择要上传的 Excel 或 CSV 文件。", true);
    return;
  }

  const formData = new FormData();
  formData.append("date", uploadDate);
  formData.append("file", file);

  databaseCompletionUploadButton.disabled = true;
  setDatabaseMessage("正在上传完课数据...");
  try {
    const data = await databaseApiRequest("/api/database/completion-upload", {
      method: "POST",
      body: formData,
    });
    if (databaseMonthInput) databaseMonthInput.value = uploadDate.slice(0, 7);
    if (databaseDateInput) databaseDateInput.value = uploadDate;
    await loadDatabaseSummary();
    setDatabaseMessage(`已上传 ${data.snapshot?.date || uploadDate} 的完课数据，共 ${data.snapshot?.row_count || 0} 个班级。`);
  } finally {
    databaseCompletionUploadButton.disabled = false;
    if (databaseCompletionFileInput) databaseCompletionFileInput.value = "";
  }
}

async function uploadCompletionLastMonth(file) {
  if (!databaseCompletionLastMonthButton || !databaseCompletionLastMonthInput) return;
  const targetMonth = databaseCompletionLastMonthInput.value || previousDatabaseMonth(databaseMonthInput.value);
  if (!targetMonth) {
    setDatabaseMessage("请先选择上月数据对应的月份。", true);
    return;
  }
  if (!file) {
    setDatabaseMessage("请先选择要上传的上月完课数据文件。", true);
    return;
  }

  const formData = new FormData();
  formData.append("month", targetMonth);
  formData.append("file", file);

  databaseCompletionLastMonthButton.disabled = true;
  setDatabaseMessage("正在上传上月完课数据...");
  try {
    const data = await databaseApiRequest("/api/database/completion-last-month-upload", {
      method: "POST",
      body: formData,
    });
    await loadDatabaseSummary();
    setDatabaseMessage(`已保存 ${data.snapshot?.month || targetMonth} 的上月完课数据，共 ${data.snapshot?.row_count || 0} 个班级。`);
  } finally {
    databaseCompletionLastMonthButton.disabled = false;
    if (databaseCompletionLastMonthFileInput) databaseCompletionLastMonthFileInput.value = "";
  }
}

async function saveLearningSettings() {
  if (!databaseLearningSaveButton) return;
  const classes = Array.from(document.querySelectorAll("[data-learning-coefficient]:not(:disabled)")).map((input) => ({
    class_id: input.dataset.classId,
    coefficient: Number(input.value || 0),
  }));
  const teachers = Array.from(document.querySelectorAll("[data-learning-target-rate]:not(:disabled)")).map((select) => ({
    teacher_id: select.dataset.teacherId,
    target_rate: Number(select.value || 0.26),
  }));

  databaseLearningSaveButton.disabled = true;
  setDatabaseMessage("正在保存学情设置...");
  try {
    await databaseApiRequest("/api/database/learning-settings", {
      method: "PUT",
      body: JSON.stringify({ classes, teachers }),
    });
    await loadDatabaseSummary();
    toggleLearningEditor(false);
    setDatabaseMessage("学情设置已保存。");
  } finally {
    databaseLearningSaveButton.disabled = false;
  }
}

function renderReferralRows(rows = []) {
  if (!databaseReferralRows) return;
  if (!rows.length) {
    databaseReferralRows.innerHTML = `<tr><td colspan="3" class="database-empty-cell">暂无转介绍数据。</td></tr>`;
    return;
  }

  databaseReferralRows.innerHTML = rows
    .map((row) => `
      <tr>
        <td class="database-strong-cell">${escapeDatabaseText(row.teacher_name)}</td>
        <td>${databaseCount(row, "leads_month_total")}</td>
        <td>${databaseCount(row, "conversions_month_total")}</td>
      </tr>
    `)
    .join("");
}

function gmvGapClass(value) {
  if (value === null || value === undefined || value === "") return "is-neutral";
  return Number(value) >= 0 ? "is-positive" : "is-negative";
}

function renderGmvTargetSummary(gmv = {}) {
  if (!databaseGmvTargetSummary) return;
  const canEdit = Boolean(gmv.can_edit);
  databaseGmvTargetSummary.innerHTML = ["renewal", "referral"].map((sectionKey) => {
    const section = gmv[sectionKey] || {};
    const targetValue = section.target_amount;
    const targetGap = section.target_gap;
    const inputValue = targetValue === null || targetValue === undefined ? "" : formatDatabaseNumber(targetValue);
    const targetContent = canEdit && gmvEditMode
      ? `
        <input
          class="gmv-target-input"
          type="number"
          min="0"
          step="1"
          value="${escapeDatabaseText(inputValue)}"
          placeholder="填写本月目标"
          data-gmv-target-input="${escapeDatabaseText(sectionKey)}"
        >
      `
      : `<strong>${formatDatabaseMoneyOptional(targetValue)}</strong>`;
    return `
      <article class="gmv-target-card" data-gmv-target-card="${escapeDatabaseText(sectionKey)}">
        <span>${escapeDatabaseText(GMV_SECTION_LABELS[sectionKey])}GMV目标</span>
        <div class="gmv-target-values">
          <div>
            <em>当前</em>
            <strong>${formatDatabaseMoney(section.month_total)}</strong>
          </div>
          <div>
            <em>目标</em>
            ${targetContent}
          </div>
          <div>
            <em>目标差值</em>
            <strong class="${gmvGapClass(targetGap)}" data-gmv-target-gap="${escapeDatabaseText(sectionKey)}">${formatDatabaseMoneyDelta(targetGap)}</strong>
          </div>
        </div>
      </article>
    `;
  }).join("");

  databaseGmvTargetSummary.querySelectorAll("[data-gmv-target-input]").forEach((input) => {
    input.addEventListener("input", recalculateGmvEditor);
  });
}

function renderGmvCell(row, sectionKey, weekIndex, canEdit) {
  const amount = Number(row.week_totals?.[weekIndex] || 0);
  const defaultAmount = Number(row.default_week_totals?.[weekIndex] || 0);
  const isManual = Boolean(row.manual_week_flags?.[weekIndex]);
  if (canEdit && gmvEditMode) {
    return `
      <input
        class="gmv-amount-input${isManual ? " is-manual" : ""}"
        type="number"
        min="0"
        step="1"
        value="${formatDatabaseNumber(amount)}"
        data-gmv-input
        data-gmv-section="${escapeDatabaseText(sectionKey)}"
        data-teacher-id="${escapeDatabaseText(row.teacher_id)}"
        data-week-index="${weekIndex}"
        data-default-value="${formatDatabaseNumber(defaultAmount)}"
      >
    `;
  }
  return `
    <span class="gmv-amount${isManual ? " is-manual" : ""}">
      ${formatDatabaseMoney(amount)}
    </span>
  `;
}

function renderGmvRows(section = {}, target, sectionKey) {
  if (!target) return;
  const rows = section.rows || [];
  const canEdit = Boolean(section.can_edit || currentDatabaseData?.gmv?.can_edit);
  if (!rows.length) {
    target.innerHTML = `<tr><td colspan="6" class="database-empty-cell">暂无GMV数据。</td></tr>`;
    return;
  }

  target.innerHTML = rows
    .map((row) => `
      <tr data-gmv-row data-gmv-section="${escapeDatabaseText(sectionKey)}" data-teacher-id="${escapeDatabaseText(row.teacher_id)}" data-gmv-row-total-value="${formatDatabaseNumber(row.month_total)}">
        <td class="database-strong-cell">${escapeDatabaseText(row.teacher_name)}</td>
        ${[0, 1, 2, 3].map((weekIndex) => `<td>${renderGmvCell(row, sectionKey, weekIndex, canEdit)}</td>`).join("")}
        <td class="database-strong-cell" data-gmv-row-total>${formatDatabaseMoney(row.month_total)}</td>
      </tr>
    `)
    .join("");

  target.querySelectorAll("[data-gmv-input]").forEach((input) => {
    input.addEventListener("input", recalculateGmvEditor);
  });
}

function renderGmv(data = currentDatabaseData) {
  const gmv = data?.gmv || {};
  renderGmvRows(gmv.renewal || {}, databaseGmvRenewalRows, "renewal");
  renderGmvRows(gmv.referral || {}, databaseGmvReferralRows, "referral");
  renderGmvTargetSummary(gmv);
  recalculateGmvEditor();
}

function recalculateGmvEditor() {
  document.querySelectorAll("[data-gmv-row]").forEach((row) => {
    const inputs = row.querySelectorAll("[data-gmv-input]");
    if (!inputs.length) return;
    const total = Array.from(inputs).reduce((sum, input) => {
      const value = Math.max(0, Number(input.value || 0));
      return sum + (Number.isNaN(value) ? 0 : value);
    }, 0);
    row.dataset.gmvRowTotalValue = formatDatabaseNumber(total);
    const totalCell = row.querySelector("[data-gmv-row-total]");
    if (totalCell) totalCell.textContent = formatDatabaseMoney(total);
  });

  ["renewal", "referral"].forEach((sectionKey) => {
    const rowTotals = Array.from(document.querySelectorAll(`[data-gmv-row][data-gmv-section="${sectionKey}"]`))
      .reduce((sum, row) => sum + Number(row.dataset.gmvRowTotalValue || 0), 0);
    const targetInput = document.querySelector(`[data-gmv-target-input="${sectionKey}"]`);
    const targetValue = targetInput
      ? (targetInput.value === "" ? null : Number(targetInput.value || 0))
      : currentDatabaseData?.gmv?.[sectionKey]?.target_amount;
    const gapElement = document.querySelector(`[data-gmv-target-gap="${sectionKey}"]`);
    if (!gapElement) return;
    const gapValue = targetValue === null || targetValue === undefined || Number.isNaN(Number(targetValue))
      ? null
      : rowTotals - Number(targetValue);
    gapElement.textContent = formatDatabaseMoneyDelta(gapValue);
    gapElement.classList.toggle("is-positive", gapValue !== null && Number(gapValue) >= 0);
    gapElement.classList.toggle("is-negative", gapValue !== null && Number(gapValue) < 0);
    gapElement.classList.toggle("is-neutral", gapValue === null);
  });
}

function setGmvEditMode(shouldEdit) {
  gmvEditMode = shouldEdit;
  databaseGmvEditButton?.classList.toggle("is-hidden", shouldEdit);
  databaseGmvSaveButton?.classList.toggle("is-hidden", !shouldEdit);
  databaseGmvCancelButton?.classList.toggle("is-hidden", !shouldEdit);
  renderGmv();
}

function collectGmvAdjustments() {
  const sections = { renewal: [], referral: [] };
  Object.keys(sections).forEach((sectionKey) => {
    const rowsByTeacher = {};
    document.querySelectorAll(`[data-gmv-input][data-gmv-section="${sectionKey}"]`).forEach((input) => {
      const teacherId = input.dataset.teacherId || "";
      if (!teacherId) return;
      const weekIndex = Number(input.dataset.weekIndex || 0);
      const rawValue = Math.max(0, Number(input.value || 0));
      const value = Number.isNaN(rawValue) ? 0 : rawValue;
      const defaultValue = Number(input.dataset.defaultValue || 0);
      const overrideValue = Math.abs(value - defaultValue) > 0.004 ? value : null;
      if (!rowsByTeacher[teacherId]) {
        rowsByTeacher[teacherId] = { teacher_id: teacherId, week_totals: [null, null, null, null] };
      }
      rowsByTeacher[teacherId].week_totals[weekIndex] = overrideValue;
    });
    sections[sectionKey] = Object.values(rowsByTeacher);
  });
  return sections;
}

function collectGmvTargets() {
  const targets = {};
  document.querySelectorAll("[data-gmv-target-input]").forEach((input) => {
    const sectionKey = input.dataset.gmvTargetInput;
    if (!sectionKey) return;
    const rawValue = Math.max(0, Number(input.value || 0));
    targets[sectionKey] = input.value === "" || Number.isNaN(rawValue) ? null : rawValue;
  });
  return targets;
}

async function saveGmvAdjustments() {
  if (!databaseGmvSaveButton || !databaseMonthInput) return;
  databaseGmvSaveButton.disabled = true;
  setDatabaseMessage("正在保存GMV目标和修正...");
  try {
    await databaseApiRequest("/api/database/gmv-adjustments", {
      method: "PUT",
      body: JSON.stringify({
        month: databaseMonthInput.value,
        sections: collectGmvAdjustments(),
        targets: collectGmvTargets(),
      }),
    });
    gmvEditMode = false;
    await loadDatabaseSummary();
    setGmvEditMode(false);
    setDatabaseMessage("GMV目标和修正已保存。");
  } finally {
    databaseGmvSaveButton.disabled = false;
  }
}

function performanceStatusClass(status) {
  if (status === "achieved") return "is-achieved";
  if (status === "not_reached") return "is-missed";
  return "is-muted";
}

function formatPerformanceNextTier(row) {
  if (row.next_tier_gap === null || row.next_tier_gap === undefined || row.next_tier_gap === "") return "-";
  if (row.next_tier_label === "已最高档") return "已最高档";
  const gap = Number(row.next_tier_gap || 0);
  if (!gap) return `已达${row.next_tier_label || "下一档"}`;
  return `差${formatDatabasePercentFixed(gap)}`;
}

function renderCompletionPerformanceRows(rows = []) {
  if (!databaseCompletionPerformanceRows) return;
  if (!rows.length) {
    databaseCompletionPerformanceRows.innerHTML = `<tr><td colspan="9" class="database-empty-cell">暂无完课绩效数据。</td></tr>`;
    return;
  }

  databaseCompletionPerformanceRows.innerHTML = rows.map((row) => {
    const classTitle = row.local_class_name && row.local_class_name !== row.class_name
      ? ` title="本地班级：${escapeDatabaseText(row.local_class_name)}"`
      : "";
    const statusLabel = row.tier_label || row.status_label || "-";
    const nextTierTitle = row.next_tier_target
      ? ` title="${escapeDatabaseText(row.next_tier_label)}门槛：${formatDatabasePercentFixed(row.next_tier_target)}"`
      : "";
    return `
      <tr>
        <td>${escapeDatabaseText(row.teacher_name)}</td>
        <td class="database-strong-cell"${classTitle}>${escapeDatabaseText(row.class_name)}</td>
        <td>${escapeDatabaseText(row.title_week_label || "-")}</td>
        <td class="database-percent-cell">${formatDatabasePercentFixed(row.completion_rate)}</td>
        <td>${formatDatabasePercentFixed(row.base_target)}</td>
        <td>
          <span class="performance-tier-badge ${performanceStatusClass(row.status)}">
            ${escapeDatabaseText(statusLabel)}
          </span>
        </td>
        <td class="performance-gap-cell"${nextTierTitle}>${escapeDatabaseText(formatPerformanceNextTier(row))}</td>
        <td>${formatDatabasePercentFixed(row.target_rate)}</td>
        <td class="database-strong-cell">${formatDatabaseMoney(row.reward)}</td>
      </tr>
    `;
  }).join("");
}

function renderCompletionPerformance(performance = {}) {
  renderCompletionPerformanceRows(performance.rows || []);
}

function rankedRows(rows = []) {
  let lastValue = null;
  let lastRank = 0;
  return rows
    .map((row) => ({ ...row, value: Number(row.value || 0) }))
    .sort((first, second) => second.value - first.value || String(first.teacher_name || "").localeCompare(String(second.teacher_name || ""), "zh-CN"))
    .map((row, index) => {
      const rank = index > 0 && row.value === lastValue ? lastRank : index + 1;
      lastValue = row.value;
      lastRank = rank;
      return { ...row, rank };
    });
}

function renderRankingRows(target, rows = [], formatter = formatDatabaseNumber, emptyText = "暂无排名数据") {
  if (!target) return;
  const sortedRows = rankedRows(rows);
  if (!sortedRows.length) {
    target.innerHTML = `<tr><td colspan="3" class="database-ranking-empty">${escapeDatabaseText(emptyText)}</td></tr>`;
    return;
  }
  target.innerHTML = sortedRows.map((row) => `
    <tr>
      <td><span class="database-rank-badge rank-${Math.min(row.rank, 3)}">${row.rank}</span></td>
      <td>${escapeDatabaseText(row.teacher_name || "未分配")}</td>
      <td class="database-ranking-value">${escapeDatabaseText(formatter(row.value, row))}</td>
    </tr>
  `).join("");
}

function renderCompletionRankingRows(target, rows = []) {
  if (!target) return;
  const sortedRows = rankedRows(rows);
  if (!sortedRows.length) {
    target.innerHTML = `<tr><td colspan="4" class="database-ranking-empty">暂无可核算完课排名</td></tr>`;
    return;
  }
  target.innerHTML = sortedRows.map((row) => `
    <tr>
      <td><span class="database-rank-badge rank-${Math.min(row.rank, 3)}">${row.rank}</span></td>
      <td>${escapeDatabaseText(row.teacher_name || "未分配")}</td>
      <td title="${escapeDatabaseText(row.class_name || "")}">${escapeDatabaseText(row.class_name || "-")}</td>
      <td class="database-ranking-value">${formatDatabasePercentFixed(row.value)}</td>
    </tr>
  `).join("");
}

function completionRankingRows(performance = {}) {
  return (performance.rows || [])
    .map((row) => {
      const completionRate = Number(row.completion_rate);
      const baseTarget = Number(row.base_target);
      if (!row.counted || !baseTarget || Number.isNaN(completionRate)) return null;
      return {
        teacher_id: row.teacher_id,
        teacher_name: row.teacher_name || "未分配",
        class_id: row.class_id,
        class_name: row.class_name || row.local_class_name || "-",
        value: completionRate / baseTarget * 100,
      };
    })
    .filter(Boolean);
}

function gmvRankingRows(gmv = {}) {
  const groups = {};
  ["renewal", "referral"].forEach((sectionKey) => {
    (gmv[sectionKey]?.rows || []).forEach((row) => {
      const teacherId = row.teacher_id || row.teacher_name || "unknown";
      const group = groups[teacherId] || {
        teacher_id: teacherId,
        teacher_name: row.teacher_name || "未分配",
        value: 0,
      };
      group.value += Number(row.month_total || 0);
      groups[teacherId] = group;
    });
  });
  return Object.values(groups);
}

function renderDatabaseRankings(data = {}) {
  renderCompletionRankingRows(
    databaseRankCompletionRows,
    completionRankingRows(data.completion_performance || {})
  );
  renderRankingRows(
    databaseRankLearningRows,
    (data.learning?.rows || []).map((row) => ({ ...row, value: row.month_total })),
    (value) => `${formatDatabaseInteger(value)}个`
  );
  renderRankingRows(
    databaseRankRenewalRows,
    (data.renewal?.rows || []).map((row) => ({ ...row, value: row.month_total })),
    (value) => `${formatDatabaseInteger(value)}单`
  );
  renderRankingRows(
    databaseRankReferralRows,
    (data.referral?.rows || []).map((row) => ({ ...row, value: row.conversions_month_total })),
    (value) => `${formatDatabaseInteger(value)}单`
  );
  renderRankingRows(
    databaseRankGmvRows,
    gmvRankingRows(data.gmv || {}),
    (value) => formatDatabaseMoney(value)
  );
}

function renderDatabase(data) {
  currentDatabaseData = data;
  const completionSummary = data.completion?.summary || {};
  if (databaseClassCount) databaseClassCount.textContent = databaseCount(completionSummary, "class_count");
  if (databaseStudentCount) databaseStudentCount.textContent = databaseCount(completionSummary, "student_count");
  if (databaseAverageCompletion) databaseAverageCompletion.textContent = formatDatabasePercent(completionSummary.average_completion);
  if (databaseLearningToday) databaseLearningToday.textContent = formatDatabasePercent(data.learning?.achievement_rate);
  if (databaseLearningMonth) databaseLearningMonth.textContent = databaseCount(data.learning, "month_total");
  if (databaseLearningBase) databaseLearningBase.textContent = formatDatabaseNumber(data.learning?.learning_base_total);
  if (databaseRenewalToday) databaseRenewalToday.textContent = databaseCount(data.renewal, "month_total");
  if (databaseRenewalMonth) databaseRenewalMonth.textContent = databaseCount(data.renewal, "month_total");
  if (databaseReferralToday) databaseReferralToday.textContent = databaseCount(data.referral, "conversions_month_total");
  if (databaseReferralMonth) databaseReferralMonth.textContent = databaseCount(data.referral, "leads_month_total");
  if (databaseReferralConversionToday) {
    databaseReferralConversionToday.textContent = databaseCount(data.referral, "conversions_today_total");
  }
  if (databaseReferralConversionMonth) {
    databaseReferralConversionMonth.textContent = databaseCount(data.referral, "conversions_month_total");
  }
  if (databaseGmvMonth) databaseGmvMonth.textContent = formatDatabaseMoney(data.gmv?.month_total);
  if (databaseGmvRenewalMonth) databaseGmvRenewalMonth.textContent = formatDatabaseMoney(data.gmv?.renewal?.month_total);
  if (databaseGmvReferralMonth) databaseGmvReferralMonth.textContent = formatDatabaseMoney(data.gmv?.referral?.month_total);
  if (databaseUpdatedAt) databaseUpdatedAt.textContent = `统计月份：${data.month}，统计日期：${data.date}`;

  if (databaseCompletionUploadPanel) {
    databaseCompletionUploadPanel.classList.toggle("is-hidden", !data.permissions?.can_upload_completion && !data.completion?.can_upload);
  }
  renderCompletionComparison(data.completion || {});
  renderCompletionHead(data.completion || {});
  renderCompletionRows(data.completion?.classes || [], data.completion || {});
  renderLearningRows(data.learning?.rows || []);
  if (databaseLearningEditor && !databaseLearningEditor.classList.contains("is-hidden")) {
    renderLearningEditor(data);
  }
  renderRenewalRows(data.renewal?.rows || []);
  renderReferralRows(data.referral?.rows || []);
  renderGmv(data);
  renderCompletionPerformance(data.completion_performance || {});
  renderDatabaseRankings(data);
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
    if (selectedCompletionCompareDate) {
      params.set("compare_date", selectedCompletionCompareDate);
    }
    const data = await databaseApiRequest(`/api/database/summary?${params.toString()}`);
    renderDatabase(data);
    setDatabaseMessage("");
  } finally {
    if (databaseRefreshButton) databaseRefreshButton.disabled = false;
  }
}

async function archiveCurrentDatabaseMonth() {
  if (!databaseArchiveMonthButton || !databaseMonthInput || !databaseDateInput) return;
  const monthValue = databaseMonthInput.value || formatDatabaseMonth(new Date());
  const dateValue = databaseDateInput.value || `${monthValue}-01`;
  const confirmed = window.confirm(`${monthValue} 的日报和数据库统计将被保存为月度存档，并切换到下个月重新开始统计。历史数据不会删除，继续吗？`);
  if (!confirmed) return;

  databaseArchiveMonthButton.disabled = true;
  setDatabaseMessage("正在进行月度存档...");
  try {
    const data = await databaseApiRequest("/api/database/monthly-archives", {
      method: "POST",
      body: JSON.stringify({
        month: monthValue,
        date: dateValue,
      }),
    });
    const nextMonth = data.next_month || "";
    const nextDate = data.next_date || (nextMonth ? `${nextMonth}-01` : "");
    if (nextMonth) databaseMonthInput.value = nextMonth;
    if (nextDate) databaseDateInput.value = nextDate;
    selectedCompletionCompareDate = "";
    showOlderCompletionDates = false;
    await loadDatabaseSummary();
    window.dispatchEvent(new CustomEvent("pu6:monthly-archived", {
      detail: {
        month: monthValue,
        date: dateValue,
        nextMonth,
        nextDate,
      },
    }));
    const reportCount = data.archive?.daily_report_count ?? 0;
    setDatabaseMessage(`${monthValue} 已存档，共保存 ${reportCount} 天日报；当前已切换到 ${nextMonth || "下个月"}。`);
  } finally {
    databaseArchiveMonthButton.disabled = false;
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

  databaseLearningEditButton?.addEventListener("click", () => toggleLearningEditor(true));
  databaseLearningCancelButton?.addEventListener("click", () => toggleLearningEditor(false));
  databaseLearningSaveButton?.addEventListener("click", () => {
    saveLearningSettings().catch((error) => setDatabaseMessage(error.message, true));
  });
  databaseGmvEditButton?.addEventListener("click", () => setGmvEditMode(true));
  databaseGmvCancelButton?.addEventListener("click", () => setGmvEditMode(false));
  databaseGmvSaveButton?.addEventListener("click", () => {
    saveGmvAdjustments().catch((error) => setDatabaseMessage(error.message, true));
  });
  databaseCompletionUploadButton?.addEventListener("click", () => {
    syncCompletionUploadDate();
    databaseCompletionFileInput?.click();
  });
  databaseCompletionFileInput?.addEventListener("change", () => {
    const file = databaseCompletionFileInput.files?.[0];
    uploadCompletionSnapshot(file).catch((error) => setDatabaseMessage(error.message, true));
  });
  databaseCompletionLastMonthButton?.addEventListener("click", () => {
    databaseCompletionLastMonthFileInput?.click();
  });
  databaseCompletionLastMonthFileInput?.addEventListener("change", () => {
    const file = databaseCompletionLastMonthFileInput.files?.[0];
    uploadCompletionLastMonth(file).catch((error) => setDatabaseMessage(error.message, true));
  });
  databaseCompletionCompareDate?.addEventListener("change", () => {
    selectedCompletionCompareDate = databaseCompletionCompareDate.value || "";
    loadDatabaseSummary().catch((error) => setDatabaseMessage(error.message, true));
  });
  databaseCompletionHistoryToggle?.addEventListener("click", () => {
    showOlderCompletionDates = !showOlderCompletionDates;
    databaseCompletionHistoryToggle.textContent = showOlderCompletionDates ? "收起更早数据" : "展开更早数据";
    if (currentDatabaseData) {
      renderCompletionHead(currentDatabaseData.completion || {});
      renderCompletionRows(currentDatabaseData.completion?.classes || [], currentDatabaseData.completion || {});
    }
  });

  databaseMonthInput.addEventListener("change", () => {
    syncDatabaseDateToMonth();
    selectedCompletionCompareDate = "";
    showOlderCompletionDates = false;
    gmvEditMode = false;
    if (databaseCompletionHistoryToggle) databaseCompletionHistoryToggle.textContent = "展开更早数据";
    syncCompletionUploadDate();
    loadDatabaseSummary().catch((error) => setDatabaseMessage(error.message, true));
  });

  databaseDateInput?.addEventListener("change", () => {
    if (databaseDateInput.value) {
      databaseMonthInput.value = databaseDateInput.value.slice(0, 7);
    }
    selectedCompletionCompareDate = "";
    showOlderCompletionDates = false;
    gmvEditMode = false;
    if (databaseCompletionHistoryToggle) databaseCompletionHistoryToggle.textContent = "展开更早数据";
    syncCompletionUploadDate();
    loadDatabaseSummary().catch((error) => setDatabaseMessage(error.message, true));
  });

  databaseRefreshButton?.addEventListener("click", () => {
    loadDatabaseSummary().catch((error) => setDatabaseMessage(error.message, true));
  });
  databaseArchiveMonthButton?.addEventListener("click", () => {
    archiveCurrentDatabaseMonth().catch((error) => setDatabaseMessage(error.message, true));
  });

  showDatabaseView("home");
  syncCompletionUploadDate();
  loadDatabaseSummary().catch((error) => setDatabaseMessage(error.message, true));
}

initDatabase();
