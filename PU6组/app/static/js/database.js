const databaseMonthInput = document.querySelector("#db-monthInput");
const databaseDateInput = document.querySelector("#db-dateInput");
const databaseRefreshButton = document.querySelector("#db-refreshButton");
const databaseArchiveMonthButton = document.querySelector("#db-archiveMonthButton");
const databaseMessage = document.querySelector("#db-message");
const databasePeriodSettings = document.querySelector("#db-periodSettings");
const databasePeriodHead = document.querySelector("#db-periodHead");
const databasePeriodBody = document.querySelector("#db-periodBody");
const databasePeriodStatus = document.querySelector("#db-periodStatus");
const databasePeriodSaveButton = document.querySelector("#db-periodSaveButton");
const databasePeriodToggleIcon = document.querySelector("#db-periodToggleIcon");
const databasePeriodCalendar = document.querySelector("#db-periodCalendar");
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
const databaseRenewalRateRows = document.querySelector("#db-renewalRateRows");
const databaseClosingRenewalRangeControls = document.querySelector("#db-closingRenewalRangeControls");
const databaseClosingRenewalMonthLabel = document.querySelector("#db-closingRenewalMonthLabel");
const databaseClosingRenewalClassCount = document.querySelector("#db-closingRenewalClassCount");
const databaseClosingRenewalStudentCount = document.querySelector("#db-closingRenewalStudentCount");
const databaseClosingRenewalEnrolledCount = document.querySelector("#db-closingRenewalEnrolledCount");
const databaseClosingRenewalRate = document.querySelector("#db-closingRenewalRate");
const databaseClosingRenewalTeacherRows = document.querySelector("#db-closingRenewalTeacherRows");
const databaseClosingRenewalRows = document.querySelector("#db-closingRenewalRows");
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
const databaseRankRenewalRateRows = document.querySelector("#db-rankRenewalRateRows");
const databaseCategoryList = document.querySelector("#db-categoryList");
const databaseUpdatedAt = document.querySelector("#db-updatedAt");

const DATABASE_CATEGORIES = ["完课超赞", "异常断课", "断续上课", "长期不上课", "周末欠缺", "偶尔断课", "暂无数据"];
const LEARNING_TARGET_RATES = [0.26, 0.28, 0.3];
const GMV_SECTION_LABELS = { renewal: "续费", referral: "转介绍" };
const DATABASE_PERIOD_SECTION_LABELS = { completion: "完课", learning: "学情", renewal: "续费", referral: "转介绍" };
const DATABASE_PERIOD_SECTIONS = ["completion", "learning", "renewal", "referral"];
const DATABASE_PERIOD_GROUPS = [
  { key: "completion", label: "完课", sections: ["completion"] },
  { key: "learning", label: "学情", sections: ["learning"] },
  { key: "renewalReferral", label: "续费&转介绍", sections: ["renewal", "referral"] },
];
let currentDatabaseData = null;
let selectedCompletionCompareDate = "";
let showOlderCompletionDates = false;
let gmvEditMode = false;
let databasePeriodPanelOpen = false;
let activePeriodPickerKey = "";
let activePeriodDraftStart = "";
let databasePeriodCalendarMonth = null;
let closingRenewalStartMonth = "";
let closingRenewalOverrides = {};

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

function addDatabaseMonths(monthValue, offset) {
  const [yearText, monthText] = String(monthValue || formatDatabaseMonth(new Date())).split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!year || !month) return formatDatabaseMonth(new Date());
  const next = new Date(year, month - 1 + Number(offset || 0), 1);
  return formatDatabaseMonth(next);
}

function databaseMonthNumber(monthValue) {
  const month = Number(String(monthValue || "").slice(5, 7));
  return month || "";
}

function closingRenewalDefaultStartMonth() {
  return addDatabaseMonths(databaseMonthInput?.value || formatDatabaseMonth(new Date()), -1);
}

function closingRenewalMonths(startMonth = closingRenewalStartMonth) {
  const start = startMonth || closingRenewalDefaultStartMonth();
  return [start, addDatabaseMonths(start, 1), addDatabaseMonths(start, 2)];
}

function closingRenewalRangeLabel(startMonth) {
  const months = closingRenewalMonths(startMonth);
  const first = months[0];
  const last = months[months.length - 1];
  if (first.slice(0, 4) === last.slice(0, 4)) {
    return `${databaseMonthNumber(first)}-${databaseMonthNumber(last)}月`;
  }
  return `${Number(first.slice(0, 4))}年${databaseMonthNumber(first)}月-${Number(last.slice(0, 4))}年${databaseMonthNumber(last)}月`;
}

function formatDatabaseShortDate(dateText) {
  const parts = String(dateText || "").split("-");
  if (parts.length !== 3) return dateText || "-";
  return `${Number(parts[1])}.${Number(parts[2])}`;
}

function formatDatabasePeriod(period = {}) {
  if (!period.start_date && !period.end_date) return "";
  return `${formatDatabaseShortDate(period.start_date)}-${formatDatabaseShortDate(period.end_date)}`;
}

function parseDatabaseDate(dateText) {
  const [year, month, day] = String(dateText || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function databaseDateFromParts(year, month, day) {
  return `${year}-${padDatabaseNumber(month)}-${padDatabaseNumber(day)}`;
}

function databasePeriodGroupRange(group, sections = {}) {
  const primary = sections[group.sections[0]] || {};
  return {
    start_date: primary.start_date || "",
    end_date: primary.end_date || "",
    is_custom: group.sections.some((sectionKey) => Boolean(sections[sectionKey]?.is_custom)),
  };
}

function setPeriodGroupInputs(groupKey, startDate, endDate) {
  const group = DATABASE_PERIOD_GROUPS.find((item) => item.key === groupKey);
  if (!group) return;
  group.sections.forEach((sectionKey) => {
    const startInput = document.querySelector(`[data-db-period-start="${sectionKey}"]`);
    const endInput = document.querySelector(`[data-db-period-end="${sectionKey}"]`);
    if (startInput) startInput.value = startDate || "";
    if (endInput) endInput.value = endDate || "";
  });
}

function getPeriodGroupInputs(groupKey) {
  const group = DATABASE_PERIOD_GROUPS.find((item) => item.key === groupKey);
  const sectionKey = group?.sections?.[0] || groupKey;
  const startInput = document.querySelector(`[data-db-period-start="${sectionKey}"]`);
  const endInput = document.querySelector(`[data-db-period-end="${sectionKey}"]`);
  return {
    start_date: startInput?.value || "",
    end_date: endInput?.value || "",
  };
}

function updatePeriodGroupButton(groupKey) {
  const range = getPeriodGroupInputs(groupKey);
  const button = document.querySelector(`[data-db-period-picker="${groupKey}"]`);
  if (!button) return;
  button.textContent = range.start_date && range.end_date
    ? formatDatabasePeriod(range)
    : "选择周期";
}

function renderPerformancePeriods(data = {}) {
  if (!databasePeriodSettings) return;
  const periodData = data.performance_periods || {};
  const sections = periodData.sections || {};
  DATABASE_PERIOD_GROUPS.forEach((group) => {
    const period = databasePeriodGroupRange(group, sections);
    setPeriodGroupInputs(group.key, period.start_date, period.end_date);
    updatePeriodGroupButton(group.key);
    const card = document.querySelector(`[data-db-period-section="${group.key}"]`);
    card?.classList.toggle("is-custom", Boolean(period.is_custom));
    card?.setAttribute("title", `${group.label}：${formatDatabasePeriod(period)}`);
  });
  if (databasePeriodStatus) {
    const labels = DATABASE_PERIOD_GROUPS
      .map((group) => {
        const period = databasePeriodGroupRange(group, sections);
        return `${group.label} ${formatDatabasePeriod(period)}`;
      })
      .join(" · ");
    databasePeriodStatus.textContent = labels || "按板块设置本期统计范围";
  }
}

function collectPerformancePeriods() {
  const periods = {};
  DATABASE_PERIOD_SECTIONS.forEach((sectionKey) => {
    const startInput = document.querySelector(`[data-db-period-start="${sectionKey}"]`);
    const endInput = document.querySelector(`[data-db-period-end="${sectionKey}"]`);
    periods[sectionKey] = {
      start_date: startInput?.value || "",
      end_date: endInput?.value || "",
    };
  });
  return periods;
}

function setDatabasePeriodPanel(open) {
  databasePeriodPanelOpen = Boolean(open);
  databasePeriodSettings?.classList.toggle("is-collapsed", !databasePeriodPanelOpen);
  databasePeriodBody?.classList.toggle("is-hidden", !databasePeriodPanelOpen);
  databasePeriodHead?.setAttribute("aria-expanded", databasePeriodPanelOpen ? "true" : "false");
  if (databasePeriodToggleIcon) databasePeriodToggleIcon.textContent = databasePeriodPanelOpen ? "⌃" : "⌄";
  if (!databasePeriodPanelOpen) closeDatabasePeriodCalendar();
}

function closeDatabasePeriodCalendar() {
  activePeriodPickerKey = "";
  activePeriodDraftStart = "";
  databasePeriodCalendar?.classList.add("is-hidden");
  if (databasePeriodCalendar) databasePeriodCalendar.innerHTML = "";
}

function databaseCalendarAnchorFor(groupKey) {
  const range = getPeriodGroupInputs(groupKey);
  return parseDatabaseDate(range.start_date) || parseDatabaseDate(databaseDateInput?.value) || new Date();
}

function openDatabasePeriodCalendar(groupKey) {
  activePeriodPickerKey = groupKey;
  const range = getPeriodGroupInputs(groupKey);
  activePeriodDraftStart = range.start_date && !range.end_date ? range.start_date : "";
  const anchor = databaseCalendarAnchorFor(groupKey);
  databasePeriodCalendarMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  renderDatabasePeriodCalendar();
  databasePeriodCalendar?.classList.remove("is-hidden");
}

function databasePeriodDayClass(dateKey, range) {
  const classes = [];
  if (dateKey === range.start_date) classes.push("is-start");
  if (dateKey === range.end_date) classes.push("is-end");
  if (range.start_date && range.end_date && range.start_date < dateKey && dateKey < range.end_date) {
    classes.push("is-in-range");
  }
  if (activePeriodDraftStart && dateKey === activePeriodDraftStart) classes.push("is-draft");
  return classes.join(" ");
}

function renderDatabasePeriodCalendar() {
  if (!databasePeriodCalendar || !activePeriodPickerKey) return;
  const group = DATABASE_PERIOD_GROUPS.find((item) => item.key === activePeriodPickerKey);
  const range = getPeriodGroupInputs(activePeriodPickerKey);
  const monthDate = databasePeriodCalendarMonth || new Date();
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = (firstDay.getDay() + 6) % 7;
  const cells = [];
  for (let index = 0; index < leading; index += 1) {
    cells.push(`<span class="database-period-day is-empty"></span>`);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = databaseDateFromParts(year, month + 1, day);
    cells.push(`
      <button
        class="database-period-day ${databasePeriodDayClass(dateKey, range)}"
        type="button"
        data-db-period-day="${dateKey}"
      >${day}</button>
    `);
  }
  const hint = activePeriodDraftStart
    ? `已选开始 ${formatDatabaseShortDate(activePeriodDraftStart)}，再点结束日期`
    : "点击开始日期，再点击结束日期";
  databasePeriodCalendar.innerHTML = `
    <div class="database-period-calendar-head">
      <button type="button" data-db-period-calendar-prev aria-label="上个月">‹</button>
      <strong>${year}年${month + 1}月</strong>
      <button type="button" data-db-period-calendar-next aria-label="下个月">›</button>
    </div>
    <div class="database-period-calendar-meta">
      <span>${escapeDatabaseText(group?.label || "")}</span>
      <small>${escapeDatabaseText(hint)}</small>
    </div>
    <div class="database-period-weekdays">
      ${["一", "二", "三", "四", "五", "六", "日"].map((day) => `<span>${day}</span>`).join("")}
    </div>
    <div class="database-period-days">${cells.join("")}</div>
  `;
}

function selectDatabasePeriodDay(dateKey) {
  if (!activePeriodPickerKey) return;
  const current = getPeriodGroupInputs(activePeriodPickerKey);
  if (!activePeriodDraftStart || (current.start_date && current.end_date)) {
    setPeriodGroupInputs(activePeriodPickerKey, dateKey, "");
    activePeriodDraftStart = dateKey;
    updatePeriodGroupButton(activePeriodPickerKey);
    renderDatabasePeriodCalendar();
    return;
  }
  const startDate = activePeriodDraftStart <= dateKey ? activePeriodDraftStart : dateKey;
  const endDate = activePeriodDraftStart <= dateKey ? dateKey : activePeriodDraftStart;
  setPeriodGroupInputs(activePeriodPickerKey, startDate, endDate);
  updatePeriodGroupButton(activePeriodPickerKey);
  closeDatabasePeriodCalendar();
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

function renewalRateClassKey(row = {}) {
  return String(
    row.class_key
    || row.class_id
    || row.project_id
    || `${row.teacher_id || ""}|${row.class_name || ""}|${row.week_number || ""}`
  ).trim();
}

function renewalRateValue(enrolledCount, studentCount) {
  const students = Number(studentCount || 0);
  if (!students) return null;
  return Number(enrolledCount || 0) / students * 100;
}

function renewalRateToneClass(value) {
  const rate = Number(value);
  if (Number.isNaN(rate)) return "";
  if (rate >= 50) return "is-rate-excellent";
  if (rate >= 40) return "is-rate-good";
  if (rate >= 30) return "is-rate-pass";
  return "is-rate-low";
}

function canEditClosingRenewal() {
  return Boolean(
    currentDatabaseData?.renewal_rate?.can_edit
    || currentDatabaseData?.permissions?.can_manage_closing_renewal
  );
}

function parseDatabaseOptionalNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (Number.isNaN(number) || number < 0) return null;
  return Math.round(number * 100) / 100;
}

function closingRenewalEditableCount(row, field, systemField) {
  const canEdit = canEditClosingRenewal();
  const value = row[field];
  const systemValue = row[systemField];
  const overridden = row[`${field}_overridden`];
  if (!canEdit) {
    return `<span class="${overridden ? "database-manual-value" : ""}">${formatDatabaseNumber(value)}</span>`;
  }
  return `
    <span class="closing-renewal-count-editor${overridden ? " is-overridden" : ""}" title="点击编辑；留空恢复系统计算：${formatDatabaseNumber(systemValue)}">
      <strong>${formatDatabaseNumber(value)}</strong>
    </span>
  `;
}

function syncClosingRenewalState(rows = []) {
  closingRenewalOverrides = {};
  rows.forEach((row) => {
    const classKey = renewalRateClassKey(row);
    const monthKey = row.closing_month || "";
    if (!classKey || !monthKey) return;
    const override = {};
    if (row.history_count_overridden) override.history_count = row.history_count;
    if (row.month_new_count_overridden) override.month_new_count = row.month_new_count;
    if (Object.keys(override).length) {
      closingRenewalOverrides[monthKey] = {
        ...(closingRenewalOverrides[monthKey] || {}),
        [classKey]: override,
      };
    }
  });
}

function closingRenewalPayload(monthKey) {
  const targetMonth = monthKey || databaseMonthInput?.value || currentDatabaseData?.month || "";
  const overrides = {};
  Object.entries(closingRenewalOverrides[targetMonth] || {}).forEach(([classKey, override]) => {
    if (!override) return;
    const entry = {};
    const historyCount = parseDatabaseOptionalNumber(override.history_count);
    const monthNewCount = parseDatabaseOptionalNumber(override.month_new_count);
    if (historyCount !== null) entry.history_count = historyCount;
    if (monthNewCount !== null) entry.month_new_count = monthNewCount;
    if (Object.keys(entry).length) overrides[classKey] = entry;
  });
  return {
    month: targetMonth,
    class_ids: [],
    overrides,
  };
}

async function saveClosingRenewalSettings(monthKey) {
  if (!canEditClosingRenewal()) return;
  setDatabaseMessage("正在保存结营续费看板...");
  await databaseApiRequest("/api/database/closing-renewal", {
    method: "PUT",
    body: JSON.stringify(closingRenewalPayload(monthKey)),
  });
  await loadDatabaseSummary();
  setDatabaseMessage("结营续费看板已保存。");
}

function updateClosingRenewalOverride(monthKey, classKey, field, rawValue) {
  const nextValue = parseDatabaseOptionalNumber(rawValue);
  if (nextValue === null) {
    closingRenewalOverrides[monthKey] = closingRenewalOverrides[monthKey] || {};
    closingRenewalOverrides[monthKey][classKey] = closingRenewalOverrides[monthKey][classKey] || {};
    delete closingRenewalOverrides[monthKey][classKey][field];
    if (!Object.keys(closingRenewalOverrides[monthKey][classKey]).length) {
      delete closingRenewalOverrides[monthKey][classKey];
    }
    if (!Object.keys(closingRenewalOverrides[monthKey]).length) {
      delete closingRenewalOverrides[monthKey];
    }
    return;
  }
  closingRenewalOverrides[monthKey] = {
    ...(closingRenewalOverrides[monthKey] || {}),
    [classKey]: {
      ...(closingRenewalOverrides[monthKey]?.[classKey] || {}),
      [field]: nextValue,
    },
  };
}

function startClosingRenewalCountEdit(control) {
  if (!control || control.dataset.editing === "true") return;
  const classKey = control.dataset.closingRenewalCount || "";
  const monthKey = control.dataset.closingRenewalMonth || "";
  const field = control.dataset.closingRenewalField || "";
  if (!classKey || !monthKey || !field) return;
  if (!canEditClosingRenewal()) {
    setDatabaseMessage("只有文云Joanna管理员账号可以修正结营续费数据。", true);
    return;
  }
  control.dataset.editing = "true";
  const previousHtml = control.innerHTML;
  const previousValue = String(control.dataset.closingRenewalValue || "");
  control.innerHTML = `
    <input
      class="closing-renewal-inline-input"
      type="number"
      min="0"
      step="0.1"
      value="${escapeDatabaseText(previousValue)}"
      aria-label="编辑结营续费人数"
    >
  `;
  const input = control.querySelector("input");
  if (!input) {
    control.innerHTML = previousHtml;
    delete control.dataset.editing;
    return;
  }
  let committed = false;
  const cancel = () => {
    if (committed) return;
    committed = true;
    control.innerHTML = previousHtml;
    delete control.dataset.editing;
  };
  const commit = () => {
    if (committed) return;
    committed = true;
    const rawValue = String(input.value || "").trim();
    updateClosingRenewalOverride(monthKey, classKey, field, rawValue);
    saveClosingRenewalSettings(monthKey).catch((error) => {
      control.innerHTML = previousHtml;
      delete control.dataset.editing;
      setDatabaseMessage(error.message, true);
    });
  };
  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      input.blur();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  });
  input.focus();
  input.select();
}

function activateClosingRenewalCountEdit(event, allowClick = false) {
  const control = event.target.closest("[data-closing-renewal-count]");
  if (!control) return false;
  if (!allowClick && event.type === "click") return false;
  if (event.type === "keydown" && event.key !== "Enter" && event.key !== "F2") return false;
  event.preventDefault();
  event.stopPropagation();
  startClosingRenewalCountEdit(control);
  return true;
}

function renderClosingRenewalRangeControls() {
  if (!databaseClosingRenewalRangeControls) return;
  const activeStart = closingRenewalStartMonth || closingRenewalDefaultStartMonth();
  const starts = [addDatabaseMonths(activeStart, -1), activeStart, addDatabaseMonths(activeStart, 1)];
  databaseClosingRenewalRangeControls.innerHTML = starts.map((startMonth) => `
    <button
      class="${startMonth === activeStart ? "is-active" : ""}"
      type="button"
      data-closing-renewal-start="${escapeDatabaseText(startMonth)}"
    >
      ${escapeDatabaseText(closingRenewalRangeLabel(startMonth))}
    </button>
  `).join("");
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
      databaseCompletionSnapshotStatus.textContent = `${sourceLabel}，按我的班级 W1-W41 匹配 Joanna 上传数据`;
    } else if (completion.source === "assignment") {
      databaseCompletionSnapshotStatus.textContent = "等待 Joanna 上传完课数据，上传后仅展示我的班级 W1-W41";
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

function renderClosingRenewalTeacherSummary(closing = {}, selectedRows = []) {
  const fallbackGroup = {
    month_label: closing.month_label || currentDatabaseData?.month || "-",
    class_count: closing.class_count ?? selectedRows.length,
    student_count: closing.student_count ?? selectedRows.reduce((sum, row) => sum + databaseCount(row, "student_count"), 0),
    enrolled_count: closing.enrolled_count ?? selectedRows.reduce((sum, row) => sum + databaseCount(row, "enrolled_count"), 0),
    renewal_rate: closing.renewal_rate ?? renewalRateValue(closing.enrolled_count, closing.student_count),
    teacher_rows: closing.teacher_rows || [],
  };
  const monthGroups = Array.isArray(closing.month_groups) && closing.month_groups.length
    ? closing.month_groups
    : [fallbackGroup];

  return monthGroups.map((group) => {
    const teacherRows = Array.isArray(group.teacher_rows) ? group.teacher_rows : [];
    const groupRate = group.renewal_rate ?? renewalRateValue(group.enrolled_count, group.student_count);
    const title = `${group.month_label || "-"}结营月数据`;
    const teacherHtml = teacherRows.length
      ? teacherRows.map((row) => `
        <tr>
          <td class="database-strong-cell">${escapeDatabaseText(row.teacher_name || "-")}</td>
          <td>${formatDatabaseNumber(row.student_count)}</td>
          <td>${formatDatabaseNumber(row.enrolled_count)}</td>
          <td class="database-percent-cell ${renewalRateToneClass(row.renewal_rate)}">${formatDatabasePercentFixed(row.renewal_rate)}</td>
        </tr>
      `).join("")
      : `<tr><td colspan="4" class="database-empty-cell">暂无结营班级。</td></tr>`;
    const totalHtml = teacherRows.length
      ? `
        <tr class="closing-renewal-total-row">
          <td class="database-strong-cell">全组</td>
          <td>${formatDatabaseNumber(group.student_count)}</td>
          <td>${formatDatabaseNumber(group.enrolled_count)}</td>
          <td class="database-percent-cell ${renewalRateToneClass(groupRate)}">${formatDatabasePercentFixed(groupRate)}</td>
        </tr>
      `
      : "";
    return `
      <tr class="closing-renewal-month-row">
        <td colspan="4">${escapeDatabaseText(title)}</td>
      </tr>
      ${teacherHtml}
      ${totalHtml}
    `;
  }).join("");
}

function renderClosingRenewalDashboard(rows = []) {
  if (!databaseClosingRenewalRows) return;
  renderClosingRenewalRangeControls();
  const closing = currentDatabaseData?.renewal_rate?.closing || {};
  const selectedRows = rows
    .filter((row) => row.closing_selected)
    .sort((first, second) => (
      String(first.closing_month || "").localeCompare(String(second.closing_month || ""))
      || String(first.teacher_name || "").localeCompare(String(second.teacher_name || ""), "zh-CN")
      || String(first.class_name || "").localeCompare(String(second.class_name || ""), "zh-CN")
    ));

  if (databaseClosingRenewalMonthLabel) databaseClosingRenewalMonthLabel.textContent = closing.month_label || currentDatabaseData?.month || "-";
  if (databaseClosingRenewalClassCount) databaseClosingRenewalClassCount.textContent = formatDatabaseNumber(closing.class_count ?? selectedRows.length);
  if (databaseClosingRenewalStudentCount) databaseClosingRenewalStudentCount.textContent = formatDatabaseNumber(closing.student_count ?? selectedRows.reduce((sum, row) => sum + databaseCount(row, "student_count"), 0));
  if (databaseClosingRenewalEnrolledCount) databaseClosingRenewalEnrolledCount.textContent = formatDatabaseNumber(closing.enrolled_count ?? selectedRows.reduce((sum, row) => sum + databaseCount(row, "enrolled_count"), 0));
  if (databaseClosingRenewalRate) databaseClosingRenewalRate.textContent = formatDatabasePercentFixed(closing.renewal_rate ?? renewalRateValue(closing.enrolled_count, closing.student_count));

  if (databaseClosingRenewalTeacherRows) {
    databaseClosingRenewalTeacherRows.innerHTML = renderClosingRenewalTeacherSummary(closing, selectedRows);
  }

  databaseClosingRenewalRows.innerHTML = selectedRows.length
    ? `${selectedRows.map((row) => `
      <tr>
        <td>${escapeDatabaseText(row.closing_month_label || "-")}</td>
        <td>${escapeDatabaseText(row.term_label || "-")}</td>
        <td>${escapeDatabaseText(row.class_name || "-")}</td>
        <td>${formatDatabaseNumber(row.student_count)}</td>
        <td class="database-strong-cell">${formatDatabaseNumber(row.enrolled_count)}</td>
        <td class="database-strong-cell">${escapeDatabaseText(row.teacher_name || "-")}</td>
        <td class="database-percent-cell ${renewalRateToneClass(row.renewal_rate)}">${formatDatabasePercentFixed(row.renewal_rate)}</td>
        <td
          class="closing-renewal-editable-cell"
          tabindex="0"
          data-closing-renewal-count="${escapeDatabaseText(renewalRateClassKey(row))}"
          data-closing-renewal-month="${escapeDatabaseText(row.closing_month || "")}"
          data-closing-renewal-field="history_count"
          data-closing-renewal-value="${escapeDatabaseText(row.history_count ?? "")}"
        >${closingRenewalEditableCount(row, "history_count", "system_history_count")}</td>
        <td
          class="closing-renewal-editable-cell"
          tabindex="0"
          data-closing-renewal-count="${escapeDatabaseText(renewalRateClassKey(row))}"
          data-closing-renewal-month="${escapeDatabaseText(row.closing_month || "")}"
          data-closing-renewal-field="month_new_count"
          data-closing-renewal-value="${escapeDatabaseText(row.month_new_count ?? "")}"
        >${closingRenewalEditableCount(row, "month_new_count", "system_month_new_count")}</td>
      </tr>
    `).join("")}
      <tr class="closing-renewal-total-row">
        <td class="database-strong-cell" colspan="3">当前范围合计</td>
        <td>${formatDatabaseNumber(closing.student_count)}</td>
        <td>${formatDatabaseNumber(closing.enrolled_count)}</td>
        <td>-</td>
        <td class="database-percent-cell ${renewalRateToneClass(closing.renewal_rate)}">${formatDatabasePercentFixed(closing.renewal_rate)}</td>
        <td>${formatDatabaseNumber(closing.history_count)}</td>
        <td>${formatDatabaseNumber(closing.month_new_count)}</td>
      </tr>
    `
    : `<tr><td colspan="9" class="database-empty-cell">当前范围暂无按 W54 推算到结营月的续费班级。</td></tr>`;

}

function renderRenewalRateRows(rows = [], groupRows = null) {
  if (!databaseRenewalRateRows) return;
  syncClosingRenewalState(rows);
  const displayRows = Array.isArray(groupRows) && groupRows.length ? groupRows : rows;
  if (!displayRows.length) {
    databaseRenewalRateRows.innerHTML = `<tr><td colspan="9" class="database-empty-cell">暂无进入续费期的班级。</td></tr>`;
    renderClosingRenewalDashboard([]);
    return;
  }

  databaseRenewalRateRows.innerHTML = displayRows
    .map((row) => {
      const gapCount = row.gap_count;
      const gapClass = Number(gapCount || 0) <= 0 ? "is-positive" : "is-negative";
      const classNames = Array.isArray(row.class_names) && row.class_names.length
        ? row.class_names
        : String(row.class_name_summary || row.class_name || "-").split("、").filter(Boolean);
      const classTitle = classNames.join("、") || "-";
      const classHtml = classNames
        .map((className) => `<span>${escapeDatabaseText(className)}</span>`)
        .join("");
      return `
        <tr>
          <td>${escapeDatabaseText(row.closing_month_label || "-")}</td>
          <td class="database-strong-cell">${escapeDatabaseText(row.teacher_name || "-")}</td>
          <td title="${escapeDatabaseText(classTitle)}"><div class="renewal-rate-class-list">${classHtml}</div></td>
          <td>${escapeDatabaseText(row.week_label || (row.week_number ? `W${row.week_number}` : "-"))}</td>
          <td>${escapeDatabaseText(row.stage || "-")}</td>
          <td>${formatDatabaseNumber(row.student_count)}</td>
          <td>${formatDatabaseNumber(row.enrolled_count)}</td>
          <td class="database-percent-cell ${renewalRateToneClass(row.renewal_rate)}">${formatDatabasePercentFixed(row.renewal_rate)}</td>
          <td class="database-gap-cell ${gapClass}">${escapeDatabaseText(row.gap_label || "-")}</td>
        </tr>
      `;
    })
    .join("");
  renderClosingRenewalDashboard(rows);
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
    target.innerHTML = `<tr><td colspan="4" class="database-ranking-empty">暂无完课完成度排名</td></tr>`;
    return;
  }
  target.innerHTML = sortedRows.map((row) => `
    <tr>
      <td><span class="database-rank-badge rank-${Math.min(row.rank, 3)}">${row.rank}</span></td>
      <td>${escapeDatabaseText(row.teacher_name || "未分配")}</td>
      <td class="database-ranking-value" title="班级：${escapeDatabaseText(row.class_name || "-")}">${formatDatabasePercentFixed(row.value)}</td>
      <td class="database-ranking-value">${formatDatabasePercentFixed(row.first_tier_achievement)}</td>
    </tr>
  `).join("");
}

function completionPerformanceLookup(performance = {}) {
  const lookup = {};
  (performance.rows || []).forEach((row) => {
    const keys = [
      row.class_id,
      row.class_name,
      row.local_class_name,
    ].map((value) => String(value || "").trim()).filter(Boolean);
    keys.forEach((key) => {
      lookup[key] = row;
    });
  });
  return lookup;
}

function completionRankingRows(completion = {}, performance = {}) {
  const performanceLookup = completionPerformanceLookup(performance);
  return (completion.classes || [])
    .map((row) => {
      const completionRate = Number(row.completion_rate);
      if (Number.isNaN(completionRate)) return null;
      const classId = row.id || row.class_id;
      const className = row.name || row.class_name || "-";
      const performanceRow = performanceLookup[String(classId || "").trim()] || performanceLookup[String(className || "").trim()] || {};
      const baseTarget = Number(performanceRow.base_target);
      const firstTierAchievement = baseTarget ? completionRate / baseTarget * 100 : null;
      return {
        teacher_id: row.teacher_id,
        teacher_name: row.teacher_name || "未分配",
        class_id: classId,
        class_name: className,
        value: completionRate,
        first_tier_achievement: firstTierAchievement,
      };
    })
    .filter(Boolean);
}

function renewalRateRankingRows(renewalRate = {}) {
  return (renewalRate.rows || [])
    .map((row) => {
      const value = Number(row.renewal_rate);
      if (Number.isNaN(value)) return null;
      return {
        teacher_id: row.teacher_id,
        teacher_name: row.teacher_name || "未分配",
        class_id: row.class_id,
        class_name: row.class_name,
        value,
      };
    })
    .filter(Boolean);
}

function renderRenewalRateRankingRows(target, rows = []) {
  if (!target) return;
  const sortedRows = rankedRows(rows);
  if (!sortedRows.length) {
    target.innerHTML = `<tr><td colspan="3" class="database-ranking-empty">暂无续费率排名</td></tr>`;
    return;
  }
  target.innerHTML = sortedRows.map((row) => `
    <tr>
      <td><span class="database-rank-badge rank-${Math.min(row.rank, 3)}">${row.rank}</span></td>
      <td>${escapeDatabaseText(row.teacher_name || "未分配")}</td>
      <td class="database-ranking-value">
        <span
          class="database-ranking-hover"
          title="班级：${escapeDatabaseText(row.class_name || "-")}"
          data-ranking-tooltip="班级：${escapeDatabaseText(row.class_name || "-")}"
        >${formatDatabasePercentFixed(row.value)}</span>
      </td>
    </tr>
  `).join("");
}

function renderDatabaseRankings(data = {}) {
  renderCompletionRankingRows(
    databaseRankCompletionRows,
    completionRankingRows(data.completion || {}, data.completion_performance || {})
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
  renderRenewalRateRankingRows(
    databaseRankRenewalRateRows,
    renewalRateRankingRows(data.renewal_rate || {})
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
  renderPerformancePeriods(data);

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
  renderRenewalRateRows(data.renewal_rate?.rows || [], data.renewal_rate?.group_rows || []);
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
      closing_months: closingRenewalMonths().join(","),
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

async function savePerformancePeriods() {
  if (!databasePeriodSaveButton || !databaseMonthInput || !databaseDateInput) return;
  databasePeriodSaveButton.disabled = true;
  setDatabaseMessage("正在保存绩效周期...");
  try {
    await databaseApiRequest("/api/database/performance-periods", {
      method: "PUT",
      body: JSON.stringify({
        month: databaseMonthInput.value,
        date: databaseDateInput.value,
        periods: collectPerformancePeriods(),
      }),
    });
    await loadDatabaseSummary();
    setDatabaseMessage("绩效周期已保存，统计已按新周期刷新。");
  } finally {
    databasePeriodSaveButton.disabled = false;
  }
}

async function archiveCurrentDatabaseMonth() {
  if (!databaseArchiveMonthButton || !databaseMonthInput || !databaseDateInput) return;
  const monthValue = databaseMonthInput.value || formatDatabaseMonth(new Date());
  const dateValue = databaseDateInput.value || `${monthValue}-01`;
  const confirmed = window.confirm(`${dateValue} 截止的当前统计周期将被存档，并从下一天开始新周期。历史数据不会删除，继续吗？`);
  if (!confirmed) return;

  databaseArchiveMonthButton.disabled = true;
  setDatabaseMessage("正在存档当前统计周期...");
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
    const periodLabel = data.archive?.period_label || `${monthValue} 当前周期`;
    setDatabaseMessage(`${periodLabel} 已存档，共保存 ${reportCount} 天日报；新周期从 ${nextDate || "下一天"} 开始。`);
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
  closingRenewalStartMonth = closingRenewalDefaultStartMonth();

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
  databasePeriodSaveButton?.addEventListener("click", () => {
    savePerformancePeriods().catch((error) => setDatabaseMessage(error.message, true));
  });
  databaseClosingRenewalRangeControls?.addEventListener("click", (event) => {
    const rangeButton = event.target.closest("[data-closing-renewal-start]");
    if (!rangeButton) return;
    closingRenewalStartMonth = rangeButton.dataset.closingRenewalStart || closingRenewalDefaultStartMonth();
    loadDatabaseSummary().catch((error) => setDatabaseMessage(error.message, true));
  });
  databaseClosingRenewalRows?.addEventListener("click", (event) => {
    activateClosingRenewalCountEdit(event, true);
  });
  databaseClosingRenewalRows?.addEventListener("dblclick", (event) => {
    activateClosingRenewalCountEdit(event);
  });
  databaseClosingRenewalRows?.addEventListener("keydown", (event) => {
    activateClosingRenewalCountEdit(event);
  });
  databasePeriodHead?.addEventListener("click", (event) => {
    if (event.target.closest("button")) return;
    setDatabasePeriodPanel(!databasePeriodPanelOpen);
  });
  databasePeriodHead?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    setDatabasePeriodPanel(!databasePeriodPanelOpen);
  });
  databasePeriodBody?.addEventListener("click", (event) => {
    const pickerButton = event.target.closest("[data-db-period-picker]");
    if (pickerButton) {
      openDatabasePeriodCalendar(pickerButton.dataset.dbPeriodPicker);
      return;
    }
    if (event.target.closest("[data-db-period-calendar-prev]")) {
      databasePeriodCalendarMonth = new Date(
        databasePeriodCalendarMonth.getFullYear(),
        databasePeriodCalendarMonth.getMonth() - 1,
        1
      );
      renderDatabasePeriodCalendar();
      return;
    }
    if (event.target.closest("[data-db-period-calendar-next]")) {
      databasePeriodCalendarMonth = new Date(
        databasePeriodCalendarMonth.getFullYear(),
        databasePeriodCalendarMonth.getMonth() + 1,
        1
      );
      renderDatabasePeriodCalendar();
      return;
    }
    const dayButton = event.target.closest("[data-db-period-day]");
    if (dayButton) {
      selectDatabasePeriodDay(dayButton.dataset.dbPeriodDay);
    }
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
    closingRenewalStartMonth = closingRenewalDefaultStartMonth();
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
    closingRenewalStartMonth = closingRenewalDefaultStartMonth();
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
