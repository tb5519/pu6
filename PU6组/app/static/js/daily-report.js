const dailyTodayButton = document.querySelector("#dr-todayButton");
const dailySaveButton = document.querySelector("#dr-saveButton");
const dailyMessage = document.querySelector("#dr-message");
const dailyTodayDay = document.querySelector("#dr-todayDay");
const dailyTodayText = document.querySelector("#dr-todayText");
const dailyPrevMonth = document.querySelector("#dr-prevMonth");
const dailyNextMonth = document.querySelector("#dr-nextMonth");
const dailyMonthTitle = document.querySelector("#dr-monthTitle");
const dailyCalendarGrid = document.querySelector("#dr-calendarGrid");
const dailySelectedDateTitle = document.querySelector("#dr-selectedDateTitle");
const dailyReportStatus = document.querySelector("#dr-reportStatus");
const dailyReportRows = document.querySelector("#dr-reportRows");
const dailyReportEmpty = document.querySelector("#dr-reportEmpty");
const dailySummaryReminder = document.querySelector("#dr-summaryReminder");
const dailySummaryComment = document.querySelector("#dr-summaryComment");
const dailySummaryLearning = document.querySelector("#dr-summaryLearning");
const dailySummaryRenewal = document.querySelector("#dr-summaryRenewal");

const DAILY_FIELD_LABELS = [
  { key: "lesson_reminders", label: "催课", sub_label: "当天数据", has_total: false },
  { key: "weekly_comments", label: "点评", sub_label: "本周总点评量", has_total: false },
  { key: "learning_status", label: "学情", sub_label: "当天数据", has_total: true },
  { key: "referral_leads", label: "转介绍线索", sub_label: "当天数据", has_total: true },
  { key: "referral_conversions", label: "转介绍转化", sub_label: "当天数据", has_total: true },
  { key: "refunds", label: "退费", sub_label: "当天数据", has_total: true },
  { key: "renewal_orders", label: "续费单量", sub_label: "当天数据", has_total: true },
];

const today = new Date();
let dailySelectedDate = formatDate(today);
let dailyCalendarMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let dailyRows = [];
let dailyFields = DAILY_FIELD_LABELS;

function padNumber(value) {
  return String(value).padStart(2, "0");
}

function formatDate(date) {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
}

function parseDate(dateText) {
  const [year, month, day] = dateText.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatChineseDate(dateText) {
  const date = parseDate(dateText);
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return `${date.getFullYear()}年${padNumber(date.getMonth() + 1)}月${padNumber(date.getDate())}日 ${weekdays[date.getDay()]}`;
}

function escapeDailyText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setDailyMessage(message, isError = false) {
  if (!dailyMessage) return;
  dailyMessage.textContent = message || "";
  dailyMessage.classList.toggle("is-error", isError);
}

async function dailyApiRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: options.body ? { "Content-Type": "application/json" } : {},
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "请求失败，请稍后重试。");
  }
  return data;
}

function renderTodayCard() {
  if (!dailyTodayDay || !dailyTodayText) return;
  dailyTodayDay.textContent = today.getDate();
  dailyTodayText.textContent = formatChineseDate(formatDate(today));
}

function renderCalendar() {
  if (!dailyCalendarGrid || !dailyMonthTitle) return;

  const year = dailyCalendarMonth.getFullYear();
  const month = dailyCalendarMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const dayCount = lastDay.getDate();
  const todayText = formatDate(today);

  dailyMonthTitle.textContent = `${year}年${padNumber(month + 1)}月`;

  const cells = [];
  for (let index = 0; index < startOffset; index += 1) {
    cells.push('<span class="calendar-day is-blank"></span>');
  }

  for (let day = 1; day <= dayCount; day += 1) {
    const dateText = formatDate(new Date(year, month, day));
    const classNames = ["calendar-day"];
    if (dateText === todayText) classNames.push("is-today");
    if (dateText === dailySelectedDate) classNames.push("is-selected");
    cells.push(`
      <button class="${classNames.join(" ")}" type="button" data-daily-date="${dateText}">
        <span>${day}</span>
      </button>
    `);
  }

  dailyCalendarGrid.innerHTML = cells.join("");
  dailyCalendarGrid.querySelectorAll("[data-daily-date]").forEach((button) => {
    button.addEventListener("click", async () => {
      dailySelectedDate = button.dataset.dailyDate;
      dailyCalendarMonth = new Date(parseDate(dailySelectedDate).getFullYear(), parseDate(dailySelectedDate).getMonth(), 1);
      renderCalendar();
      await loadDailyReport();
    });
  });
}

function numericValue(value) {
  const count = Number(value);
  if (Number.isNaN(count)) return 0;
  return Math.max(0, Math.trunc(count));
}

function renderMetricInput(row, field) {
  const value = numericValue(row[field.key]);
  const totalValue = numericValue(row[`${field.key}_total`]);
  const canEdit = row.can_edit !== false;
  const fieldClass = `daily-field-${field.key}`;
  const totalCell = field.has_total === false ? "" : `
    <td class="daily-total-cell ${fieldClass}">
      <span class="daily-total-value">${totalValue}</span>
    </td>
  `;
  return `
    <td class="daily-input-cell ${fieldClass}">
      <input
        class="daily-number-input${canEdit ? "" : " is-readonly"}"
        type="number"
        min="0"
        step="1"
        inputmode="numeric"
        value="${value}"
        data-daily-input="${escapeDailyText(field.key)}"
        data-daily-user="${escapeDailyText(row.username)}"
        aria-label="${escapeDailyText(row.teacher_name)} ${escapeDailyText(field.label)}"
        ${canEdit ? "" : "disabled"}
      >
    </td>
    ${totalCell}
  `;
}

function renderDailyRows() {
  if (!dailyReportRows || !dailyReportEmpty) return;

  dailyReportRows.innerHTML = dailyRows
    .map((row) => `
      <tr class="${row.can_edit === false ? "is-locked-row" : ""}" data-daily-row="${escapeDailyText(row.username)}">
        <td class="sticky-daily-col daily-teacher-cell">
          <span>${escapeDailyText(row.teacher_name)}</span>
          ${row.can_edit === false ? '<em class="readonly-badge">只读</em>' : '<em class="editable-badge">可填写</em>'}
        </td>
        <td class="sticky-daily-col daily-student-col"><span class="student-count-value">${numericValue(row.student_count)}</span></td>
        ${dailyFields.map((field) => renderMetricInput(row, field)).join("")}
      </tr>
    `)
    .join("");

  dailyReportEmpty.classList.toggle("is-hidden", dailyRows.length > 0);

  dailyReportRows.querySelectorAll("[data-daily-input]").forEach((input) => {
    input.addEventListener("input", () => {
      if (input.disabled) return;
      const row = dailyRows.find((item) => item.username === input.dataset.dailyUser);
      if (!row) return;
      row[input.dataset.dailyInput] = numericValue(input.value);
      updateDailySummary();
      setDailyMessage("当前日报有未保存修改。");
    });
  });

}

function updateDailySummary() {
  const sum = (field) => dailyRows.reduce((total, row) => total + numericValue(row[field]), 0);
  if (dailySummaryReminder) dailySummaryReminder.textContent = sum("lesson_reminders");
  if (dailySummaryComment) dailySummaryComment.textContent = sum("weekly_comments");
  if (dailySummaryLearning) dailySummaryLearning.textContent = sum("learning_status");
  if (dailySummaryRenewal) dailySummaryRenewal.textContent = sum("renewal_orders");
}

function renderDailyReport(data) {
  dailyRows = data.rows || [];
  dailyFields = data.fields || dailyFields;
  if (dailySelectedDateTitle) {
    dailySelectedDateTitle.textContent = `${formatChineseDate(data.date)} 日报`;
  }
  if (dailyReportStatus) {
    dailyReportStatus.textContent = data.updated_at ? `已保存：${data.updated_at}` : "尚未保存";
  }
  renderDailyRows();
  updateDailySummary();
}

async function loadDailyReport() {
  if (!dailyReportRows) return;
  setDailyMessage("正在读取日报...");
  const data = await dailyApiRequest(`/api/daily-report?date=${encodeURIComponent(dailySelectedDate)}`);
  renderDailyReport(data);
  setDailyMessage("");
}

function collectDailyRows() {
  return dailyRows.map((row) => {
    const output = {
      username: row.username,
      teacher_id: row.teacher_id || row.username,
    };
    dailyFields.forEach((field) => {
      output[field.key] = numericValue(row[field.key]);
    });
    return output;
  });
}

async function saveDailyReport() {
  if (!dailySaveButton) return;
  dailySaveButton.disabled = true;
  setDailyMessage("正在保存日报...");
  try {
    const data = await dailyApiRequest("/api/daily-report", {
      method: "PUT",
      body: JSON.stringify({
        date: dailySelectedDate,
        rows: collectDailyRows(),
      }),
    });
    renderDailyReport(data);
    setDailyMessage("日报已保存。");
  } finally {
    dailySaveButton.disabled = false;
  }
}

function initDailyReport() {
  if (!dailyCalendarGrid) return;

  renderTodayCard();
  renderCalendar();

  dailyPrevMonth?.addEventListener("click", () => {
    dailyCalendarMonth = new Date(dailyCalendarMonth.getFullYear(), dailyCalendarMonth.getMonth() - 1, 1);
    renderCalendar();
  });

  dailyNextMonth?.addEventListener("click", () => {
    dailyCalendarMonth = new Date(dailyCalendarMonth.getFullYear(), dailyCalendarMonth.getMonth() + 1, 1);
    renderCalendar();
  });

  dailyTodayButton?.addEventListener("click", async () => {
    dailySelectedDate = formatDate(today);
    dailyCalendarMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    renderCalendar();
    await loadDailyReport();
  });

  dailySaveButton?.addEventListener("click", async () => {
    try {
      await saveDailyReport();
    } catch (error) {
      setDailyMessage(error.message, true);
    }
  });

  loadDailyReport().catch((error) => setDailyMessage(error.message, true));
}

initDailyReport();
