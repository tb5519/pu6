const classHomeView = document.querySelector("[data-class-home]");
const classDetailView = document.querySelector("[data-class-detail]");
const completionSectionButtons = document.querySelectorAll("[data-completion-section]");
const completionSectionPanels = document.querySelectorAll("[data-completion-section-panel]");
const classCreateForm = document.querySelector("[data-class-create-form]");
const classBackButton = document.querySelector("[data-class-back]");
const classList = document.querySelector("#cc-classList");
const classMessage = document.querySelector("#cc-message");
const activityJoinForm = document.querySelector("[data-activity-join-form]");
const activityClassSelect = document.querySelector("#cc-activityClassSelect");
const classNameInput = document.querySelector("#cc-className");
const classTeacherSelect = document.querySelector("#cc-classTeacher");
const classWeekSelect = document.querySelector("#cc-weekSelect");
const classUploadButton = document.querySelector("#cc-uploadButton");
const classClearMonthButton = document.querySelector("#cc-clearMonthButton");
const classFileInput = document.querySelector("#cc-fileInput");
const classGenerateImage = document.querySelector("#cc-generateImage");
const classImageWeekSelect = document.querySelector("#cc-imageWeekSelect");
const classImageWeekNumber = document.querySelector("#cc-imageWeekNumber");
const classGenerateCurrentImage = document.querySelector("#cc-generateCurrentImage");
const classGenerateActivityImage = document.querySelector("#cc-generateActivityImage");
const classImagePanel = document.querySelector("#cc-imagePanel");
const classImagePanelTitle = document.querySelector("#cc-imagePanelTitle");
const classImagePreviewToggle = document.querySelector("#cc-imagePreviewToggle");
const classImagePreviewWrap = document.querySelector("#cc-imagePreviewWrap");
const classImagePreview = document.querySelector("#cc-imagePreview");
const classImageDownload = document.querySelector("#cc-imageDownload");
const classDetailMessage = document.querySelector("#cc-detailMessage");
const detailTitle = document.querySelector("#cc-detailTitle");
const studentCategoryFilter = document.querySelector("#cc-categoryFilter");
const studentStatus = document.querySelector("#cc-studentStatus");
const studentRows = document.querySelector("#cc-studentRows");
const studentEmpty = document.querySelector("#cc-studentEmpty");
const reminderPriorityStatus = document.querySelector("#cc-reminderPriorityStatus");
const reminderPriorityList = document.querySelector("#cc-reminderPriorityList");
const reminderScheduleStatus = document.querySelector("#cc-reminderScheduleStatus");
const reminderScheduleList = document.querySelector("#cc-reminderScheduleList");
const reminderRefreshButton = document.querySelector("#cc-reminderRefresh");
const reminderHomeView = document.querySelector("[data-reminder-home]");
const reminderDetailView = document.querySelector("[data-reminder-detail]");
const reminderBackButton = document.querySelector("[data-reminder-back]");
const reminderConfirmPanel = document.querySelector("[data-reminder-confirm]");
const reminderArrangementPanel = document.querySelector("[data-reminder-arrangement]");
const reminderDetailTitle = document.querySelector("#cc-reminderDetailTitle");
const reminderDetailMeta = document.querySelector("#cc-reminderDetailMeta");
const reminderDetailMessage = document.querySelector("#cc-reminderDetailMessage");
const reminderConfirmCopy = document.querySelector("#cc-reminderConfirmCopy");
const reminderConfirmYes = document.querySelector("#cc-reminderConfirmYes");
const reminderConfirmNo = document.querySelector("#cc-reminderConfirmNo");
const reminderArrangementStatus = document.querySelector("#cc-reminderArrangementStatus");
const reminderArrangementBody = document.querySelector("#cc-reminderArrangementBody");

const WEEK_KEYS = ["1", "2", "3", "4"];
const DAY_COUNT = 6;
const ACTIVITY_WEEK_GOAL = 6;
const PLANT_VARIETIES = [
  { name: "彩虹花", className: "plant-rainbow" },
  { name: "向日葵", className: "plant-sunflower" },
  { name: "樱花树", className: "plant-sakura" },
  { name: "蓝绣球", className: "plant-hydrangea" },
  { name: "小橘树", className: "plant-orange" },
  { name: "紫铃兰", className: "plant-bell" },
];

let classes = [];
let classTeachers = [];
let activeClass = null;
let reminderPlanLoaded = false;
let reminderPlanLoading = false;
let activeReminderClass = null;
let activeReminderArrangement = null;
let reminderActionIndex = new Map();

function setCompletionSection(sectionName) {
  completionSectionButtons.forEach((button) => {
    const isActive = button.dataset.completionSection === sectionName;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  completionSectionPanels.forEach((panel) => {
    panel.classList.toggle("is-hidden", panel.dataset.completionSectionPanel !== sectionName);
  });

  if (sectionName !== "classes") {
    activeClass = null;
    classHomeView?.classList.remove("is-hidden");
    classDetailView?.classList.add("is-hidden");
    clearCompletionImage();
    setClassMessage("");
    setDetailMessage("");
  }

  if (sectionName === "reminder") {
    loadReminderPlan().catch((error) => renderReminderError(error.message));
  }
}

function setClassMessage(message, isError = false) {
  if (!classMessage) return;
  classMessage.textContent = message || "";
  classMessage.classList.toggle("is-error", isError);
}

function setDetailMessage(message, isError = false) {
  if (!classDetailMessage) return;
  classDetailMessage.textContent = message || "";
  classDetailMessage.classList.toggle("is-error", isError);
}

function setReminderDetailMessage(message, isError = false) {
  if (!reminderDetailMessage) return;
  reminderDetailMessage.textContent = message || "";
  reminderDetailMessage.classList.toggle("is-error", isError);
}

function escapeText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: options.body instanceof FormData ? {} : { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "请求失败，请稍后重试。");
  }
  return data;
}

function showClassHome() {
  setCompletionSection("classes");
  classHomeView?.classList.remove("is-hidden");
  classDetailView?.classList.add("is-hidden");
  activeClass = null;
  clearCompletionImage();
  setDetailMessage("");
  setClassMessage("");
}

function showClassDetail() {
  setCompletionSection("classes");
  classHomeView?.classList.add("is-hidden");
  classDetailView?.classList.remove("is-hidden");
  setClassMessage("");
  setDetailMessage("");
}

function formatCompletion(rate) {
  if (rate === null || rate === undefined || rate === "") return "-";
  const value = Number(rate);
  if (Number.isNaN(value)) return "-";
  const text = Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
  return `${text}%`;
}

function completionClass(rate) {
  const value = Number(rate || 0);
  if (value >= 90) return "is-high";
  if (value >= 60) return "is-mid";
  return "is-low";
}

function formatCompletionDelta(value) {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  if (Number.isNaN(number)) return "-";
  const prefix = number > 0 ? "+" : "";
  const text = Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/\.?0+$/, "");
  return `${prefix}${text}%`;
}

function reminderStars(count) {
  const value = Math.max(1, Math.min(5, Number(count || 1)));
  return `${"★".repeat(value)}${"☆".repeat(5 - value)}`;
}

function reminderSuggestion(stars) {
  const value = Number(stars || 1);
  if (value >= 5) return "最高优先";
  if (value >= 4) return "优先催课";
  if (value >= 3) return "重点跟进";
  if (value >= 2) return "常规提醒";
  return "观察即可";
}

function weekLabel(week) {
  return ["", "第一周", "第二周", "第三周", "第四周"][Number(week)] || `第${week}周`;
}

function selectedImageWeek() {
  return classImageWeekSelect?.value || classWeekSelect?.value || "1";
}

function normalizeWeeks(weeks = {}) {
  return WEEK_KEYS.reduce((output, week) => {
    const values = Array.isArray(weeks[week]) ? weeks[week] : [];
    output[week] = Array.from({ length: DAY_COUNT }, (_, index) => values[index] ?? null);
    return output;
  }, {});
}

function renderMonthlyCell(rate) {
  const width = rate === null || rate === undefined ? 0 : Number(rate);
  return `
    <div class="completion-cell">
      <span>${formatCompletion(rate)}</span>
      <div class="completion-bar ${completionClass(rate)}">
        <i style="width: ${Math.max(0, Math.min(100, width))}%"></i>
      </div>
    </div>
  `;
}

function renderDayCell(rate) {
  if (rate === null || rate === undefined || rate === "") {
    return `<span class="day-value is-empty">-</span>`;
  }
  return `<span class="day-value ${completionClass(rate)}">${formatCompletion(rate)}</span>`;
}

function habitClass(category) {
  const key = String(category || "");
  if (key === "完课超赞") return "is-excellent";
  if (key === "长期不上课") return "is-inactive";
  if (key === "异常断课") return "is-abnormal";
  if (key === "周末欠缺") return "is-weekend";
  if (key === "偶尔断课") return "is-occasional";
  return "is-empty";
}

function renderHabitCell(category) {
  const label = category || "暂无数据";
  return `<span class="habit-badge ${habitClass(label)}">${escapeText(label)}</span>`;
}

function weekCompleted(values = []) {
  return values.filter((rate) => Number(rate) >= 100).length >= ACTIVITY_WEEK_GOAL;
}

function studentWaterCount(student) {
  const weeks = normalizeWeeks(student.weeks);
  return WEEK_KEYS.reduce((count, week) => count + (weekCompleted(weeks[week]) ? 1 : 0), 0);
}

function plantVariety(student) {
  const source = `${student.id || ""}${student.account || ""}${student.name || ""}`;
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  return PLANT_VARIETIES[hash % PLANT_VARIETIES.length];
}

function plantStage(waterCount, variety) {
  if (waterCount >= 4) {
    return { label: `惊喜绽放 · ${variety.name}`, className: "is-bloom" };
  }
  if (waterCount >= 3) return { label: "神秘小树苗", className: "is-mystery" };
  if (waterCount >= 2) return { label: "抽枝", className: "is-branch" };
  if (waterCount >= 1) return { label: "发芽", className: "is-sprout" };
  return { label: "盲盒种子", className: "is-seed" };
}

function clearCompletionImage() {
  classImagePanel?.classList.add("is-hidden");
  classImagePreviewWrap?.classList.add("is-hidden");
  if (classImagePanelTitle) {
    classImagePanelTitle.textContent = "完课表图片";
  }
  if (classImagePreviewToggle) {
    classImagePreviewToggle.textContent = "预览图片";
  }
  if (classImagePreview) {
    classImagePreview.removeAttribute("src");
  }
  if (classImageDownload) {
    classImageDownload.setAttribute("href", "#");
  }
}

function completionImageTitle() {
  const rawValue = classImageWeekNumber?.value.trim() || "";
  const weekNumber = rawValue.replace(/^w/i, "").trim();
  if (!weekNumber) return "";
  return `${activeClass?.name || "完课表"} W${weekNumber}`;
}

function imageCellColor(rate) {
  if (rate === null || rate === undefined || rate === "") return "#ffffff";
  const value = Number(rate);
  if (Number.isNaN(value)) return "#ffffff";
  if (value === 0) return "#f3b6b4";
  if (value >= 90) return "#d9f2d4";
  return "#fbf1cb";
}

function drawCanvasCell(ctx, x, y, width, height, options = {}) {
  const {
    fill = "#ffffff",
    stroke = "#d9d9d9",
    text = "",
    font = "700 26px Arial, sans-serif",
    color = "#000000",
    align = "center",
    baseline = "middle",
  } = options;
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);

  if (!text) return;
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  const textX = align === "left" ? x + 12 : x + width / 2;
  const maxTextWidth = Math.max(0, width - 24);
  ctx.fillText(fitCanvasText(ctx, text, maxTextWidth), textX, y + height / 2);
}

function fitCanvasText(ctx, text, maxWidth) {
  const value = String(text || "");
  if (!value || ctx.measureText(value).width <= maxWidth) return value;

  let output = value;
  while (output.length > 1 && ctx.measureText(`${output}…`).width > maxWidth) {
    output = output.slice(0, -1);
  }
  return `${output}…`;
}

function setGeneratedImage(panelTitle, imageUrl, fileName, message) {
  if (classImagePanelTitle) classImagePanelTitle.textContent = panelTitle;
  if (classImagePreview) classImagePreview.src = imageUrl;
  if (classImageDownload) {
    classImageDownload.href = imageUrl;
    classImageDownload.download = fileName;
  }
  classImagePreviewWrap?.classList.add("is-hidden");
  if (classImagePreviewToggle) {
    classImagePreviewToggle.textContent = "预览图片";
  }
  classImagePanel?.classList.remove("is-hidden");
  setDetailMessage(message);
}

function roundedRectPath(ctx, x, y, width, height, radius) {
  const corner = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + corner, y);
  ctx.lineTo(x + width - corner, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + corner);
  ctx.lineTo(x + width, y + height - corner);
  ctx.quadraticCurveTo(x + width, y + height, x + width - corner, y + height);
  ctx.lineTo(x + corner, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - corner);
  ctx.lineTo(x, y + corner);
  ctx.quadraticCurveTo(x, y, x + corner, y);
  ctx.closePath();
}

function fillRoundedRect(ctx, x, y, width, height, radius, fill) {
  roundedRectPath(ctx, x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
}

function strokeRoundedRect(ctx, x, y, width, height, radius, stroke, lineWidth = 1) {
  roundedRectPath(ctx, x, y, width, height, radius);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function drawFitText(ctx, text, x, y, maxWidth, options = {}) {
  const {
    font = "700 24px Microsoft YaHei, Arial, sans-serif",
    color = "#213047",
    align = "left",
    baseline = "alphabetic",
  } = options;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(fitCanvasText(ctx, text, maxWidth), x, y);
}

function drawPlantPot(ctx, cx, bottom, scale = 1) {
  fillRoundedRect(ctx, cx - 19 * scale, bottom - 14 * scale, 38 * scale, 16 * scale, 5 * scale, "#bc7e4f");
  fillRoundedRect(ctx, cx - 15 * scale, bottom - 3 * scale, 30 * scale, 6 * scale, 5 * scale, "#a86f44");
}

function drawLeaf(ctx, x, y, width, height, color, angle = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawStem(ctx, cx, bottom, height, color = "#2f8a53", width = 5) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx, bottom);
  ctx.lineTo(cx, bottom - height);
  ctx.stroke();
}

function drawFinalPlant(ctx, cx, cy, size, variety) {
  const bottom = cy + size * 0.38;
  drawStem(ctx, cx, bottom - 12, size * 0.5, "#2f8a53", 5);
  drawLeaf(ctx, cx - 13, bottom - 28, 22, 12, "#4ca45f", -0.45);
  drawLeaf(ctx, cx + 13, bottom - 34, 22, 12, "#4ca45f", 0.45);

  if (variety.className === "plant-rainbow") {
    ctx.lineWidth = 9;
    ["#f05f7f", "#f5b544", "#69bf5b", "#4ba6e8", "#9b7ce8"].forEach((color, index) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.arc(cx, cy - 8, 30 - index * 4, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.fillStyle = "#fff36b";
    ctx.arc(cx, cy + 4, 10, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (variety.className === "plant-sunflower") {
    for (let index = 0; index < 14; index += 1) {
      const angle = (Math.PI * 2 * index) / 14;
      drawLeaf(ctx, cx + Math.cos(angle) * 21, cy - 10 + Math.sin(angle) * 21, 18, 10, "#ffd45b", angle);
    }
    ctx.beginPath();
    ctx.fillStyle = "#f4b83f";
    ctx.arc(cx, cy - 10, 23, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = "#7b5129";
    ctx.arc(cx, cy - 10, 10, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (variety.className === "plant-sakura") {
    [
      [cx - 20, cy - 10, 20, "#f19bb5"],
      [cx, cy - 20, 24, "#ffc2d2"],
      [cx + 18, cy - 10, 20, "#ffd0dc"],
      [cx - 2, cy + 1, 22, "#f7afc3"],
    ].forEach(([x, y, radius, color]) => {
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
    return;
  }

  if (variety.className === "plant-hydrangea") {
    [
      [cx - 17, cy - 8, 18, "#5f93d9"],
      [cx, cy - 18, 20, "#9bc4f3"],
      [cx + 17, cy - 8, 18, "#76a8e8"],
      [cx - 3, cy + 5, 18, "#8bb8ee"],
    ].forEach(([x, y, radius, color]) => {
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "#eaf3ff";
    [[cx - 11, cy - 8], [cx + 4, cy - 14], [cx + 13, cy + 2], [cx - 4, cy + 7]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
    return;
  }

  if (variety.className === "plant-orange") {
    [
      [cx - 18, cy - 9, 19, "#407f47"],
      [cx, cy - 18, 23, "#5aa85c"],
      [cx + 18, cy - 8, 19, "#66b461"],
      [cx, cy + 6, 20, "#4f9d53"],
    ].forEach(([x, y, radius, color]) => {
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "#ef9b25";
    [[cx - 14, cy - 4], [cx + 10, cy - 13], [cx + 19, cy + 8], [cx - 2, cy + 10]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    });
    return;
  }

  ctx.strokeStyle = "#4f9370";
  ctx.lineWidth = 4;
  [[-18, 19, -0.45], [16, 17, 0.42], [0, 25, 0]].forEach(([dx, length, angle]) => {
    ctx.save();
    ctx.translate(cx, bottom - 45);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(dx * 0.35, length);
    ctx.stroke();
    ctx.restore();
  });
  [
    [cx - 18, cy + 0, 0.18],
    [cx + 16, cy - 2, -0.18],
    [cx, cy + 9, 0],
  ].forEach(([x, y, angle]) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    fillRoundedRect(ctx, -8, -10, 16, 22, 8, "#9c83d8");
    ctx.restore();
  });
}

function drawActivityPlant(ctx, x, y, size, student) {
  const waterCount = studentWaterCount(student);
  const variety = plantVariety(student);
  const cx = x + size / 2;
  const cy = y + size / 2;
  const bottom = y + size - 10;

  fillRoundedRect(ctx, x, y, size, size, 16, "#f4fbf6");
  strokeRoundedRect(ctx, x, y, size, size, 16, "rgba(39, 128, 100, 0.16)");
  drawPlantPot(ctx, cx, bottom, 1.1);

  if (waterCount <= 0) {
    ctx.save();
    ctx.translate(cx, bottom - 23);
    ctx.rotate(0.35);
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 11, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#725139";
    ctx.fill();
    ctx.restore();
    return;
  }

  if (waterCount >= 4) {
    drawFinalPlant(ctx, cx, cy, size, variety);
    return;
  }

  drawStem(ctx, cx, bottom - 12, waterCount === 1 ? 22 : 38, "#2f8a53", 5);
  drawLeaf(ctx, cx - 12, bottom - 31, 20, 12, "#54a96d", -0.45);
  if (waterCount >= 2) {
    drawLeaf(ctx, cx + 13, bottom - 39, 21, 12, "#54a96d", 0.45);
    ctx.strokeStyle = "#3b8f54";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, bottom - 42);
    ctx.lineTo(cx - 16, bottom - 53);
    ctx.stroke();
  }
  if (waterCount >= 3) {
    ctx.beginPath();
    ctx.fillStyle = "#62a86a";
    ctx.arc(cx, bottom - 56, 17, 0, Math.PI * 2);
    ctx.fill();
    drawFitText(ctx, "?", cx, bottom - 49, 30, {
      font: "900 23px Microsoft YaHei, Arial, sans-serif",
      color: "#ffffff",
      align: "center",
    });
  }
}

function generateActivityImage() {
  if (!activeClass) {
    setDetailMessage("请先进入班级后再生成活动展示图。", true);
    return;
  }
  if (!activeClass.completion_activity) {
    setDetailMessage("该班级还未参与 6月完课活动，请先在活动通知里选择参与班级。", true);
    return;
  }

  const students = activeClass.students || [];
  if (!students.length) {
    setDetailMessage("当前班级暂无学员，无法生成活动展示图。", true);
    return;
  }

  const rows = students.map((student) => {
    const waterCount = studentWaterCount(student);
    const variety = plantVariety(student);
    return {
      student,
      waterCount,
      variety,
      stage: plantStage(waterCount, variety),
    };
  });
  const totalWater = rows.reduce((total, row) => total + row.waterCount, 0);
  const maxWater = rows.length * 4;
  const growthRate = maxWater ? (totalWater / maxWater) * 100 : 0;
  const grownCount = rows.filter((row) => row.waterCount >= 4).length;

  const width = 1200;
  const margin = 56;
  const headerHeight = 230;
  const cardGap = 18;
  const columns = 2;
  const cardWidth = (width - margin * 2 - cardGap) / columns;
  const cardHeight = 150;
  const rowCount = Math.ceil(rows.length / columns);
  const height = headerHeight + rowCount * (cardHeight + cardGap) + 58;
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#f5fbf7";
  ctx.fillRect(0, 0, width, height);

  const headerGradient = ctx.createLinearGradient(0, 0, width, headerHeight);
  headerGradient.addColorStop(0, "#dff7d7");
  headerGradient.addColorStop(0.55, "#fff4b9");
  headerGradient.addColorStop(1, "#e5f3ff");
  fillRoundedRect(ctx, margin, 34, width - margin * 2, 166, 28, headerGradient);
  strokeRoundedRect(ctx, margin, 34, width - margin * 2, 166, 28, "rgba(39, 128, 100, 0.2)");

  drawFitText(ctx, "6月完课活动 · 班级成长花园", margin + 34, 92, 620, {
    font: "900 42px Microsoft YaHei, Arial, sans-serif",
    color: "#183a2f",
  });
  drawFitText(ctx, `${activeClass.name || "班级"} ｜ 本月种子成长进度`, margin + 36, 135, 620, {
    font: "800 25px Microsoft YaHei, Arial, sans-serif",
    color: "#4f665d",
  });
  drawFitText(ctx, "每完成一周任务即可浇水一次，满 4 次后揭晓专属植物。", margin + 36, 172, 760, {
    font: "700 23px Microsoft YaHei, Arial, sans-serif",
    color: "#60756d",
  });

  fillRoundedRect(ctx, width - margin - 295, 65, 250, 102, 22, "rgba(255, 255, 255, 0.72)");
  drawFitText(ctx, "班级成长进度", width - margin - 170, 98, 220, {
    font: "800 20px Microsoft YaHei, Arial, sans-serif",
    color: "#60756d",
    align: "center",
  });
  drawFitText(ctx, formatCompletion(growthRate), width - margin - 170, 144, 220, {
    font: "900 44px Microsoft YaHei, Arial, sans-serif",
    color: "#17624d",
    align: "center",
  });
  drawFitText(ctx, `${totalWater}/${maxWater} 次浇水 · ${grownCount} 株绽放`, width - margin - 170, 170, 220, {
    font: "800 18px Microsoft YaHei, Arial, sans-serif",
    color: "#7c6f4b",
    align: "center",
  });

  rows.forEach((row, index) => {
    const col = index % columns;
    const rowIndex = Math.floor(index / columns);
    const x = margin + col * (cardWidth + cardGap);
    const y = headerHeight + rowIndex * (cardHeight + cardGap);
    const cardFill = row.waterCount >= 4 ? "#f4fff6" : "#ffffff";
    const accent = row.waterCount >= 4 ? "#39a978" : row.waterCount > 0 ? "#9ed79e" : "#cfd9d4";

    fillRoundedRect(ctx, x, y, cardWidth, cardHeight, 18, cardFill);
    strokeRoundedRect(ctx, x, y, cardWidth, cardHeight, 18, accent, 2);
    drawActivityPlant(ctx, x + 18, y + 21, 104, row.student);

    drawFitText(ctx, row.student.name || "未命名学员", x + 140, y + 42, cardWidth - 172, {
      font: "900 25px Microsoft YaHei, Arial, sans-serif",
      color: "#213047",
    });
    drawFitText(ctx, row.stage.label, x + 140, y + 72, cardWidth - 172, {
      font: "800 18px Microsoft YaHei, Arial, sans-serif",
      color: row.waterCount >= 4 ? "#17624d" : "#6b7c73",
    });
    drawFitText(ctx, `本月已浇水 ${row.waterCount}/4 次`, x + 140, y + 105, 220, {
      font: "900 24px Microsoft YaHei, Arial, sans-serif",
      color: row.waterCount >= 4 ? "#17624d" : "#3d4c5d",
    });
    drawFitText(ctx, `${Math.round((row.waterCount / 4) * 100)}%`, x + cardWidth - 34, y + 105, 150, {
      font: "800 18px Microsoft YaHei, Arial, sans-serif",
      color: "#6b7c73",
      align: "right",
    });

    fillRoundedRect(ctx, x + 140, y + 122, cardWidth - 174, 9, 5, "#e4ece8");
    fillRoundedRect(ctx, x + 140, y + 122, (cardWidth - 174) * (row.waterCount / 4), 9, 5, "#39a978");
    fillRoundedRect(ctx, x + cardWidth - 132, y + 24, 100, 32, 16, row.waterCount >= 4 ? "#d9f2d4" : "#fbf1cb");
    drawFitText(ctx, `${row.waterCount}/4`, x + cardWidth - 82, y + 46, 82, {
      font: "900 19px Microsoft YaHei, Arial, sans-serif",
      color: "#203247",
      align: "center",
    });
  });

  drawFitText(ctx, "小提示：本图统计本月当前累计种子成长进度，补交完成后会自动更新浇水次数。", width / 2, height - 22, width - margin * 2, {
    font: "700 18px Microsoft YaHei, Arial, sans-serif",
    color: "#7a8b84",
    align: "center",
  });

  const title = `${activeClass.name || "班级"} 6月完课活动 本月成长进度`;
  const imageUrl = canvas.toDataURL("image/png");
  const fileName = `${title.replace(/[\\/:*?"<>|]/g, "_")}.png`;
  setGeneratedImage(
    "6月完课活动展示图",
    imageUrl,
    fileName,
    `已生成 ${title} 活动展示图，可预览或下载。`
  );
}

function generateCompletionImage() {
  if (!activeClass) {
    setDetailMessage("请先进入班级后再生成完课表。", true);
    return;
  }
  const title = completionImageTitle();
  if (!title) {
    setDetailMessage("请先填写标题周数，例如 24。", true);
    classImageWeekNumber?.focus();
    return;
  }

  const week = selectedImageWeek();
  const students = activeClass.students || [];
  if (!students.length) {
    setDetailMessage("当前班级暂无学员，无法生成完课表。", true);
    return;
  }

  const nameWidth = 190;
  const dayWidth = 190;
  const titleHeight = 70;
  const dayHeaderHeight = 52;
  const subHeaderHeight = 78;
  const rowHeight = 46;
  const width = nameWidth + dayWidth * DAY_COUNT;
  const height = titleHeight + dayHeaderHeight + subHeaderHeight + rowHeight * students.length;
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  drawCanvasCell(ctx, 0, 0, width, titleHeight, {
    fill: "#bfe337",
    stroke: "#222222",
    text: title,
    font: "900 34px Arial, sans-serif",
  });

  drawCanvasCell(ctx, 0, titleHeight, nameWidth, dayHeaderHeight + subHeaderHeight, {
    fill: "#fff45a",
    stroke: "#222222",
    text: "学员姓名",
    font: "900 28px Arial, sans-serif",
  });

  for (let index = 0; index < DAY_COUNT; index += 1) {
    const x = nameWidth + dayWidth * index;
    drawCanvasCell(ctx, x, titleHeight, dayWidth, dayHeaderHeight, {
      fill: "#f6cea4",
      stroke: "#222222",
      text: `D${index + 1}`,
      font: "900 26px Arial, sans-serif",
    });
    drawCanvasCell(ctx, x, titleHeight + dayHeaderHeight, dayWidth, subHeaderHeight, {
      fill: "#ffffff",
      stroke: "#222222",
      text: "完成度",
      font: "900 28px Arial, sans-serif",
    });
  }

  students.forEach((student, rowIndex) => {
    const y = titleHeight + dayHeaderHeight + subHeaderHeight + rowHeight * rowIndex;
    const weeks = normalizeWeeks(student.weeks);
    const weekValues = weeks[week] || [];

    drawCanvasCell(ctx, 0, y, nameWidth, rowHeight, {
      fill: "#ffffff",
      stroke: "#e3e3e3",
      text: student.name || "",
      font: "700 22px Arial, sans-serif",
    });

    for (let dayIndex = 0; dayIndex < DAY_COUNT; dayIndex += 1) {
      const rate = weekValues[dayIndex];
      drawCanvasCell(ctx, nameWidth + dayWidth * dayIndex, y, dayWidth, rowHeight, {
        fill: imageCellColor(rate),
        stroke: "#d7e4d2",
        text: rate === null || rate === undefined ? "" : formatCompletion(rate),
        font: "700 22px Arial, sans-serif",
      });
    }
  });

  const imageUrl = canvas.toDataURL("image/png");
  const fileName = `${title.replace(/[\\/:*?"<>|]/g, "_")}.png`;
  setGeneratedImage(
    "完课表图片",
    imageUrl,
    fileName,
    `已生成 ${title} ${weekLabel(week)}完课表图片，可预览或下载。`
  );
}

function toggleCompletionImagePreview() {
  if (!classImagePreview?.getAttribute("src")) {
    setDetailMessage("请先生成图片。", true);
    return;
  }
  const shouldShow = classImagePreviewWrap?.classList.contains("is-hidden");
  classImagePreviewWrap?.classList.toggle("is-hidden", !shouldShow);
  if (classImagePreviewToggle) {
    classImagePreviewToggle.textContent = shouldShow ? "收起预览" : "预览图片";
  }
}

function renderClassList() {
  if (!classList) return;
  renderActivityClassOptions();

  if (!classes.length) {
    classList.innerHTML = `<div class="empty-state">暂无班级，请先添加自己的班级。</div>`;
    return;
  }

  classList.innerHTML = classes
    .map((item) => `
      <article class="class-card ${item.completion_activity ? "is-activity-class" : ""}">
        <div>
          <div class="class-card-topline">
            <span class="module-eyebrow">班级</span>
            ${item.completion_activity ? '<span class="class-activity-badge">6月活动中</span>' : ""}
          </div>
          <h2>${escapeText(item.name)}</h2>
          <p>${item.student_count || 0} 名学员${item.teacher_name ? ` · ${escapeText(item.teacher_name)}` : ""}</p>
          <label class="class-teacher-field">
            <span>班主任</span>
            <select data-class-teacher="${item.id}" aria-label="${escapeText(item.name)} 班主任">
              <option value="">未选择</option>
              ${classTeachers.map((teacher) => (
                `<option value="${escapeText(teacher.id)}"${teacher.id === item.teacher_id ? " selected" : ""}>${escapeText(teacher.name)}</option>`
              )).join("")}
            </select>
          </label>
        </div>
        <div class="class-card-actions">
          <button type="button" class="primary-button compact-button" data-open-class="${item.id}">进入班级</button>
          <button type="button" class="ghost-button" data-delete-class="${item.id}">删除</button>
        </div>
      </article>
    `)
    .join("");

  document.querySelectorAll("[data-open-class]").forEach((button) => {
    button.addEventListener("click", () => openClass(button.dataset.openClass));
  });


  document.querySelectorAll("[data-delete-class]").forEach((button) => {
    button.addEventListener("click", () => deleteClass(button.dataset.deleteClass));
  });

  document.querySelectorAll("[data-class-teacher]").forEach((select) => {
    select.addEventListener("change", () => updateClassTeacher(select.dataset.classTeacher, select.value));
  });
}

function renderActivityClassOptions() {
  if (!activityClassSelect) return;
  const currentValue = activityClassSelect.value;
  activityClassSelect.innerHTML = `
    <option value="">选择参与班级</option>
    ${classes.map((item) => `
      <option value="${escapeText(item.id)}"${item.id === currentValue ? " selected" : ""}>
        ${escapeText(item.name)}${item.completion_activity ? "（已参与）" : ""}
      </option>
    `).join("")}
  `;
}

function normalizeReminderClassName(value) {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
}

function alphaZeroBasedNumber(char) {
  const code = String(char || "").toUpperCase().charCodeAt(0);
  if (Number.isNaN(code)) return "";
  return String(code - "A".charCodeAt(0));
}

function alphaOneBasedNumber(char) {
  const code = String(char || "").toUpperCase().charCodeAt(0);
  if (Number.isNaN(code)) return "";
  return String(code - "A".charCodeAt(0) + 1);
}

function encodeReminderPeriodToken(token) {
  return String(token || "").replace(/[A-Za-z]/g, (char) => alphaZeroBasedNumber(char));
}

function encodeReminderClassName(value) {
  return String(value || "")
    .replace(/([A-Za-z0-9]+)期/g, (match, token) => (
      /[A-Za-z]/.test(token) ? `${encodeReminderPeriodToken(token)}期` : match
    ))
    .replace(/-([A-Za-z])班/g, (match, letter) => `-${alphaOneBasedNumber(letter)}班`);
}

function reminderClassNameKeys(value) {
  const rawValue = String(value || "").trim();
  const variants = new Set([rawValue, encodeReminderClassName(rawValue)]);
  Array.from(variants).forEach((item) => {
    variants.add(item.replace(/L2-/gi, "PU1-"));
  });
  return new Set(Array.from(variants).map(normalizeReminderClassName).filter(Boolean));
}

function reminderClassNamesMatch(firstName, secondName) {
  const firstKeys = reminderClassNameKeys(firstName);
  const secondKeys = reminderClassNameKeys(secondName);
  return Array.from(firstKeys).some((key) => secondKeys.has(key));
}

function findLocalClassForReminder(item = {}) {
  if (item.source === "my_class") {
    const byId = classes.find((classItem) => classItem.id === item.class_id);
    if (byId) return byId;
  }
  return classes.find((classItem) => reminderClassNamesMatch(classItem.name, item.class_name)) || null;
}

function showReminderHome() {
  reminderHomeView?.classList.remove("is-hidden");
  reminderDetailView?.classList.add("is-hidden");
  reminderConfirmPanel?.classList.remove("is-hidden");
  reminderArrangementPanel?.classList.add("is-hidden");
  activeReminderClass = null;
  activeReminderArrangement = null;
  setReminderDetailMessage("");
  if (reminderPriorityList && !reminderPlanLoaded && !reminderPlanLoading) {
    loadReminderPlan(true).catch((error) => renderReminderError(error.message));
  }
}

function showReminderDetail(item) {
  activeReminderClass = item;
  reminderHomeView?.classList.add("is-hidden");
  reminderDetailView?.classList.remove("is-hidden");
  reminderConfirmPanel?.classList.remove("is-hidden");
  reminderArrangementPanel?.classList.add("is-hidden");
  activeReminderArrangement = null;
  setReminderDetailMessage("");

  if (reminderDetailTitle) {
    reminderDetailTitle.textContent = item.class_name || "班级催课";
  }
  if (reminderDetailMeta) {
    const parts = [
      item.day_label ? `${item.day_label}${item.task_label ? ` · ${item.task_label}` : ""}` : "",
      item.source_label ? `来源：${item.source_label}` : "",
      item.rank ? `优先级 #${item.rank}` : "",
    ].filter(Boolean);
    reminderDetailMeta.textContent = parts.join(" ｜ ") || "请先确认当前完课数据是否为最新。";
  }
  if (reminderConfirmCopy) {
    reminderConfirmCopy.textContent = `当前读取到的完成度为 ${formatCompletion(item.completion_rate)}，上个月完课率为 ${formatCompletion(item.last_month_completion)}。如果这不是最新数据，请先上传最新完课数据。`;
  }
}

function hasReminderRate(rate) {
  if (rate === null || rate === undefined || rate === "") return false;
  return !Number.isNaN(Number(rate));
}

function reminderDayLabel(week, dayIndex) {
  return `${weekLabel(week)}第${dayIndex + 1}天`;
}

function summarizeReminderDays(items = []) {
  const labels = items.slice(0, 4).map((item) => item.label);
  return `${labels.join("、")}${items.length > 4 ? `等${items.length}天` : ""}`;
}

function reminderStudentStats(student = {}) {
  const weeks = normalizeWeeks(student.weeks);
  const uploaded = [];
  const incomplete = [];

  WEEK_KEYS.forEach((week) => {
    weeks[week].forEach((rate, dayIndex) => {
      if (!hasReminderRate(rate)) return;
      const item = {
        week,
        day: dayIndex + 1,
        label: reminderDayLabel(week, dayIndex),
        value: Number(rate),
      };
      uploaded.push(item);
      if (item.value < 100) {
        incomplete.push(item);
      }
    });
  });

  return {
    weeks,
    uploaded,
    incomplete,
    category: student.habit_category || "暂无数据",
  };
}

function reminderPromptForStudent(student = {}, stats = {}) {
  const task = activeReminderClass?.task_label || "催课";
  const category = stats.category || "暂无数据";
  const incomplete = stats.incomplete || [];
  const uploaded = stats.uploaded || [];

  if (!uploaded.length) {
    return "暂无已上传完课明细，先确认这个学员是否在最新表格中。";
  }

  if (!incomplete.length) {
    return category === "完课超赞"
      ? "已上传日期均达100%，适合在群里点名表扬并保持节奏。"
      : "已上传日期均达100%，先正向反馈，继续观察后续数据。";
  }

  const days = summarizeReminderDays(incomplete);
  const zeroCount = incomplete.filter((item) => item.value <= 0).length;
  const zeroHint = zeroCount ? `其中${zeroCount}天为0%，` : "";
  let prompt = "";

  if (category === "长期不上课") {
    prompt = `${days}未达100%，${zeroHint}优先私信家长确认固定学习时间和补交截止。`;
  } else if (category === "异常断课") {
    prompt = `${days}出现断点，先问清卡点，再提醒当天补齐缺口。`;
  } else if (category === "周末欠缺") {
    prompt = `${days}未达100%，重点提醒周末或收尾任务按时补交。`;
  } else if (category === "偶尔断课") {
    prompt = `${days}未达100%，轻提醒一次并约定今天完成。`;
  } else if (category === "完课超赞") {
    prompt = `${days}有波动，先鼓励再提醒补齐，避免从满分状态掉队。`;
  } else {
    prompt = `${days}未达100%，先私信确认原因并同步补交时间。`;
  }

  if (task === "回收") {
    return `回收重点：核对${days}是否已补齐，未补齐再私信一次。`;
  }
  if (task === "重点复催") {
    return `重点复催：${prompt}`;
  }
  return prompt;
}

function reminderStudentPriority(stats = {}) {
  if (!stats.uploaded?.length) return 1;
  if (stats.incomplete?.length) return 0;
  return 2;
}

function renderReminderDayCell(rate) {
  if (!hasReminderRate(rate)) {
    return `<span class="reminder-day-value is-empty">-</span>`;
  }
  return `<span class="reminder-day-value ${completionClass(rate)}">${formatCompletion(rate)}</span>`;
}

function renderReminderStudentRows(students = []) {
  return students
    .map((student) => {
      const stats = reminderStudentStats(student);
      return {
        student,
        stats,
        prompt: reminderPromptForStudent(student, stats),
      };
    })
    .sort((first, second) => {
      const priorityGap = reminderStudentPriority(first.stats) - reminderStudentPriority(second.stats);
      if (priorityGap) return priorityGap;
      return (second.stats.incomplete?.length || 0) - (first.stats.incomplete?.length || 0);
    });
}

function renderReminderStudentTable(rows = [], options = {}) {
  const title = options.title || "学员每日完课与催课提示";
  const subtitle = options.subtitle || "按需催课学员优先展示";
  const emptyText = options.emptyText || "当前班级暂无学员明细，请先在“我的班级”上传完课数据。";
  if (!rows.length) {
    if (!options.title) {
      return `<div class="reminder-arrangement-empty">${escapeText(emptyText)}</div>`;
    }
    return `
      <section class="reminder-student-section">
        <div class="reminder-section-head">
          <h3>${escapeText(title)}</h3>
          <span>${escapeText(subtitle)}</span>
        </div>
        <div class="reminder-arrangement-empty">${escapeText(emptyText)}</div>
      </section>
    `;
  }

  const weekHeaders = WEEK_KEYS
    .map((week) => `<th class="reminder-week-head" colspan="${DAY_COUNT}">${weekLabel(week)}</th>`)
    .join("");
  const dayHeaders = WEEK_KEYS
    .flatMap((week) => Array.from({ length: DAY_COUNT }, (_, index) => (
      `<th class="${index === 0 ? "week-group-start" : ""}">D${index + 1}</th>`
    )))
    .join("");
  const bodyRows = rows
    .map(({ student, stats, prompt }) => {
      const dayCells = WEEK_KEYS
        .flatMap((week) => stats.weeks[week].map((rate, dayIndex) => (
          `<td class="${dayIndex === 0 ? "week-group-start" : ""}">${renderReminderDayCell(rate)}</td>`
        )))
        .join("");
      return `
        <tr>
          <td class="reminder-student-name">${escapeText(student.name || "-")}</td>
          <td>${escapeText(student.account || "-")}</td>
          <td>${renderHabitCell(stats.category)}</td>
          <td>${renderMonthlyCell(student.monthly_completion)}</td>
          <td class="reminder-student-prompt">${escapeText(prompt)}</td>
          ${dayCells}
        </tr>
      `;
    })
    .join("");

  return `
    <section class="reminder-student-section">
      <div class="reminder-section-head">
        <h3>${escapeText(title)}</h3>
        <span>${escapeText(subtitle)}</span>
      </div>
      <div class="reminder-student-table-wrap">
        <table class="reminder-student-table">
          <thead>
            <tr>
              <th rowspan="2">学员姓名</th>
              <th rowspan="2">学员账号</th>
              <th rowspan="2">学员分类</th>
              <th rowspan="2">本月完成度</th>
              <th class="reminder-prompt-head" rowspan="2">一句话提示</th>
              ${weekHeaders}
            </tr>
            <tr>${dayHeaders}</tr>
          </thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function reminderRowsNeedingFollowUp(rows = []) {
  return rows.filter((row) => row.stats.incomplete.length > 0);
}

function normalizeReminderStudentKey(value) {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
}

function reminderStudentKeys(student = {}) {
  return [
    student.id ? `id:${student.id}` : "",
    student.account ? `account:${normalizeReminderStudentKey(student.account)}` : "",
    student.name ? `name:${normalizeReminderStudentKey(student.name)}` : "",
  ].filter(Boolean);
}

function reminderRecoveryKeySet(records = []) {
  const keys = new Set();
  records.forEach((record) => {
    (record.students || []).forEach((student) => {
      reminderStudentKeys(student).forEach((key) => keys.add(key));
    });
  });
  return keys;
}

function reminderRowMatchesKeys(row, keySet) {
  return reminderStudentKeys(row.student).some((key) => keySet.has(key));
}

function findReminderCurrentRow(student = {}, rows = []) {
  const keys = new Set(reminderStudentKeys(student));
  return rows.find((row) => reminderStudentKeys(row.student).some((key) => keys.has(key))) || null;
}

function reminderRateAt(weeks = {}, week, day) {
  const values = weeks[String(week)] || [];
  const index = Number(day) - 1;
  if (index < 0 || index >= values.length) return null;
  return values[index];
}

function formatReminderPendingDays(items = []) {
  const labels = items.slice(0, 4).map((item) => item.text);
  return `${labels.join("、")}${items.length > 4 ? `等${items.length}项` : ""}`;
}

function reminderRecoveryResult(student = {}, currentRows = []) {
  const currentRow = findReminderCurrentRow(student, currentRows);
  if (!currentRow) {
    return {
      className: "is-missing",
      label: "当前数据未匹配",
      detail: "最新表格里暂未匹配到该学员，请确认账号或姓名是否变化。",
    };
  }

  const incompleteDays = (student.incomplete_days || []).filter((item) => item.week && item.day);
  if (!incompleteDays.length) {
    return {
      className: "is-done",
      label: "无需回收",
      detail: "催课时没有记录到未达100%的日期。",
    };
  }

  const pending = [];
  const completed = [];
  incompleteDays.forEach((item) => {
    const currentRate = reminderRateAt(currentRow.stats.weeks, item.week, item.day);
    const label = item.label || `${weekLabel(item.week)}第${item.day}天`;
    if (hasReminderRate(currentRate) && Number(currentRate) >= 100) {
      completed.push({ label, value: currentRate });
    } else {
      pending.push({
        label,
        value: currentRate,
        text: `${label}${hasReminderRate(currentRate) ? `当前${formatCompletion(currentRate)}` : "当前无数据"}`,
      });
    }
  });

  if (!pending.length) {
    return {
      className: "is-done",
      label: "已补齐",
      detail: `周一催过的 ${completed.length} 项已补到100%。`,
    };
  }
  if (completed.length) {
    return {
      className: "is-partial",
      label: "部分补齐",
      detail: `还需回收：${formatReminderPendingDays(pending)}`,
    };
  }
  return {
    className: "is-pending",
    label: "未补齐",
    detail: `还需回收：${formatReminderPendingDays(pending)}`,
  };
}

function reminderStudentPayload({ student, stats, prompt }) {
  return {
    id: student.id || "",
    name: student.name || "",
    account: student.account || "",
    category: stats.category || "暂无数据",
    monthly_completion: student.monthly_completion,
    prompt,
    weeks: stats.weeks,
    incomplete_days: stats.incomplete,
    uploaded_days: stats.uploaded,
  };
}

function reminderRecoveryQuery(item = {}) {
  const params = new URLSearchParams();
  params.set("class_name", item.class_name || "");
  params.set("day_key", item.day_key || "");
  params.set("recover_from", item.recover_from || "");
  if (item.teacher_id) params.set("teacher_id", item.teacher_id);
  return params.toString();
}

async function loadReminderRecoveryRecords(item = {}) {
  if (item.task_label !== "回收") return [];
  const query = reminderRecoveryQuery(item);
  if (!query) return [];
  const data = await apiRequest(`/api/database/completion-reminders/recovery-records?${query}`);
  return data.records || [];
}

function renderReminderSnapshotDayCell(rate) {
  return renderReminderDayCell(rate);
}

function renderReminderRecoveryResultCell(result = {}) {
  return `
    <div class="reminder-recovery-result ${result.className || ""}">
      <strong>${escapeText(result.label || "-")}</strong>
      <span>${escapeText(result.detail || "")}</span>
    </div>
  `;
}

function renderReminderSnapshotTable(students = [], currentRows = []) {
  if (!students.length) {
    return `<div class="reminder-arrangement-empty">暂无需要回收的学员。</div>`;
  }
  const weekHeaders = WEEK_KEYS
    .map((week) => `<th class="reminder-week-head" colspan="${DAY_COUNT}">${weekLabel(week)}</th>`)
    .join("");
  const dayHeaders = WEEK_KEYS
    .flatMap((week) => Array.from({ length: DAY_COUNT }, (_, index) => (
      `<th class="${index === 0 ? "week-group-start" : ""}">D${index + 1}</th>`
    )))
    .join("");
  const rows = students.map((student) => {
    const weeks = normalizeWeeks(student.weeks);
    const result = reminderRecoveryResult(student, currentRows);
    const dayCells = WEEK_KEYS
      .flatMap((week) => weeks[week].map((rate, dayIndex) => (
        `<td class="${dayIndex === 0 ? "week-group-start" : ""}">${renderReminderSnapshotDayCell(rate)}</td>`
      )))
      .join("");
    const incompleteText = (student.incomplete_days || [])
      .map((item) => item.label || `${weekLabel(item.week)}第${item.day}天`)
      .filter(Boolean)
      .join("、") || "无";
    return `
      <tr>
        <td class="reminder-student-name">${escapeText(student.name || "-")}</td>
        <td>${escapeText(student.account || "-")}</td>
        <td>${renderHabitCell(student.category || "暂无数据")}</td>
        <td>${renderMonthlyCell(student.monthly_completion)}</td>
        <td class="reminder-recovery-result-cell">${renderReminderRecoveryResultCell(result)}</td>
        <td class="reminder-student-prompt">${escapeText(incompleteText)}</td>
        <td class="reminder-student-prompt">${escapeText(student.prompt || "")}</td>
        ${dayCells}
      </tr>
    `;
  }).join("");

  return `
    <div class="reminder-student-table-wrap reminder-recovery-table-wrap">
      <table class="reminder-student-table reminder-recovery-table">
        <thead>
          <tr>
            <th rowspan="2">学员姓名</th>
            <th rowspan="2">学员账号</th>
            <th rowspan="2">催课时分类</th>
            <th rowspan="2">催课时完成度</th>
            <th rowspan="2">回收结果</th>
            <th rowspan="2">催课时未达标日期</th>
            <th rowspan="2">催课时提示</th>
            ${weekHeaders}
          </tr>
          <tr>${dayHeaders}</tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderReminderRecoveryRecords(records = [], currentRows = []) {
  if (activeReminderClass?.task_label !== "回收") return "";
  if (!records.length) {
    return `
      <section class="reminder-recovery-section">
        <div class="reminder-section-head">
          <h3>待回收学员</h3>
          <span>暂无已同步的待回收记录</span>
        </div>
        <div class="reminder-arrangement-empty">还没有从前一轮催课同步过来的学员，确认是否已经点击过“已完成催课”。</div>
      </section>
    `;
  }
  return `
    <section class="reminder-recovery-section">
      <div class="reminder-section-head">
        <h3>待回收学员</h3>
        <span>来自前一轮已完成催课的名单</span>
      </div>
      ${records.map((record) => `
        <article class="reminder-recovery-record">
          <div class="reminder-recovery-record-head">
            <strong>${escapeText(record.origin_day_label || "上一轮")}催课记录</strong>
            <span>${Number(record.student_count || 0)} 名待回收 · 保存于 ${escapeText(record.completed_at || record.created_at || "-")}</span>
          </div>
          ${renderReminderSnapshotTable(record.students || [], currentRows)}
        </article>
      `).join("")}
    </section>
  `;
}

function renderReminderRecoveryNewNeeds(rows = [], records = []) {
  if (activeReminderClass?.task_label !== "回收") return "";
  const remindedKeys = reminderRecoveryKeySet(records);
  const newNeedRows = reminderRowsNeedingFollowUp(rows)
    .filter((row) => !reminderRowMatchesKeys(row, remindedKeys));
  return renderReminderStudentTable(newNeedRows, {
    title: "新增需催课学员",
    subtitle: "不在上一轮催课名单中，按当前最新数据正常催课",
    emptyText: "当前没有新增需催课学员。",
  });
}

function renderReminderCompletionBar(rows = [], records = []) {
  const task = activeReminderClass?.task_label || "催课";
  const needRows = reminderRowsNeedingFollowUp(rows);
  const isRecovery = task === "回收";
  const buttonText = isRecovery ? "已完成回收" : "已完成催课";
  const helperText = isRecovery
    ? `完成后会清空本次待回收名单。当前待回收记录 ${records.length} 条。`
    : `完成后会保存 ${needRows.length} 名需催课学员，并同步到对应回收日。`;
  const disabled = isRecovery && !records.length;
  return `
    <section class="reminder-complete-bar" data-reminder-complete-bar>
      <div>
        <strong>${escapeText(buttonText)}</strong>
        <span>${escapeText(helperText)}</span>
      </div>
      <button class="primary-button compact-button" type="button" data-reminder-complete-action${disabled ? " disabled" : ""}>${escapeText(buttonText)}</button>
    </section>
  `;
}

function clearReminderArrangementAfterSave(message) {
  const sections = reminderArrangementBody?.querySelectorAll(".reminder-student-section, .reminder-recovery-section");
  sections?.forEach((section) => section.remove());
  const bar = reminderArrangementBody?.querySelector("[data-reminder-complete-bar]");
  if (bar) {
    bar.outerHTML = `<section class="reminder-arrangement-empty">${escapeText(message || "已完成，本次数据已清空。")}</section>`;
  }
}

async function completeReminderArrangement() {
  if (!activeReminderClass || !activeReminderArrangement) return;
  const { classData, localClass, rows, recoveryRecords } = activeReminderArrangement;
  const task = activeReminderClass.task_label || "催课";
  const needRows = reminderRowsNeedingFollowUp(rows);
  const payload = {
    task_label: task,
    day_key: activeReminderClass.day_key || "",
    day_label: activeReminderClass.day_label || "",
    recover_from: activeReminderClass.recover_from || "",
    teacher_id: activeReminderClass.teacher_id || classData?.teacher_id || "",
    class_id: activeReminderClass.class_id || "",
    class_name: activeReminderClass.class_name || classData?.name || "",
    local_class_id: localClass?.id || classData?.id || "",
    local_class_name: classData?.name || localClass?.name || "",
    source: activeReminderClass.source || "",
    completion_rate: activeReminderClass.completion_rate,
    last_month_completion: activeReminderClass.last_month_completion,
    change_from_last_month: activeReminderClass.change_from_last_month,
    record_ids: recoveryRecords.map((record) => record.id),
    students: task === "回收" ? [] : needRows.map(reminderStudentPayload),
  };

  const button = reminderArrangementBody?.querySelector("[data-reminder-complete-action]");
  if (button) {
    button.disabled = true;
    button.textContent = task === "回收" ? "正在保存回收..." : "正在保存催课...";
  }

  try {
    const data = await apiRequest("/api/database/completion-reminders/actions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const message = data.message || (task === "回收" ? "已完成回收。" : "已完成催课。");
    setReminderDetailMessage(message);
    activeReminderArrangement = null;
    reminderPlanLoaded = false;
    clearReminderArrangementAfterSave(message);
  } catch (error) {
    if (button) {
      button.disabled = false;
      button.textContent = task === "回收" ? "已完成回收" : "已完成催课";
    }
    setReminderDetailMessage(error.message, true);
  }
}

function bindReminderArrangementActions() {
  const button = reminderArrangementBody?.querySelector("[data-reminder-complete-action]");
  button?.addEventListener("click", () => {
    completeReminderArrangement().catch((error) => setReminderDetailMessage(error.message, true));
  });
}

function renderReminderArrangementError(message) {
  if (!reminderArrangementBody) return;
  reminderArrangementBody.innerHTML = `
    <section class="reminder-arrangement-empty">${escapeText(message)}</section>
  `;
}

async function renderReminderArrangement() {
  if (!activeReminderClass) return;
  reminderConfirmPanel?.classList.add("is-hidden");
  reminderArrangementPanel?.classList.remove("is-hidden");
  setReminderDetailMessage("");

  if (reminderArrangementStatus) {
    reminderArrangementStatus.textContent = `${activeReminderClass.day_label || "今日"} ${activeReminderClass.task_label || "催课"}安排`;
  }
  if (!reminderArrangementBody) return;

  reminderArrangementBody.innerHTML = `<section class="reminder-arrangement-empty">正在读取该班级学员完课明细...</section>`;

  if (!classes.length) {
    await loadClasses();
  }
  const localClass = findLocalClassForReminder(activeReminderClass);
  if (!localClass) {
    renderReminderArrangementError("当前账号的“我的班级”里没有匹配到这个班级，暂时无法读取学员每日完课明细。请先在我的班级中添加或选择同名班级。");
    return;
  }

  let classData = null;
  try {
    const data = await apiRequest(`/api/classes/${localClass.id}`);
    classData = data.class || null;
  } catch (error) {
    renderReminderArrangementError(error.message);
    return;
  }

  const students = classData?.students || [];
  const rows = renderReminderStudentRows(students);
  const needReminderCount = rows.filter((row) => row.stats.incomplete.length > 0).length;
  const recoveryRecords = await loadReminderRecoveryRecords(activeReminderClass);
  activeReminderArrangement = { localClass, classData, rows, recoveryRecords };

  reminderArrangementBody.innerHTML = `
    <section class="reminder-arrangement-summary">
      <div>
        <span>本月完成度</span>
        <strong>${formatCompletion(activeReminderClass.completion_rate)}</strong>
      </div>
      <div>
        <span>上个月完课率</span>
        <strong>${formatCompletion(activeReminderClass.last_month_completion)}</strong>
      </div>
      <div>
        <span>较上个月</span>
        <strong class="${Number(activeReminderClass.change_from_last_month || 0) < 0 ? "is-negative" : "is-positive"}">${formatCompletionDelta(activeReminderClass.change_from_last_month)}</strong>
      </div>
      <div>
        <span>班级学员</span>
        <strong>${students.length}</strong>
      </div>
      <div>
        <span>需催课人数</span>
        <strong class="${needReminderCount > 0 ? "is-negative" : "is-positive"}">${needReminderCount}</strong>
      </div>
    </section>
    ${renderReminderCompletionBar(rows, recoveryRecords)}
    ${renderReminderRecoveryRecords(recoveryRecords, rows)}
    ${renderReminderRecoveryNewNeeds(rows, recoveryRecords)}
    ${renderReminderStudentTable(rows, activeReminderClass.task_label === "回收" ? {
      title: "全班最新完课明细",
      subtitle: "用于对比回收结果和查看当前全班情况",
    } : {})}
  `;
  bindReminderArrangementActions();
}

async function jumpToReminderUpload() {
  if (!activeReminderClass) return;
  if (!classes.length) {
    await loadClasses();
  }
  const localClass = findLocalClassForReminder(activeReminderClass);
  if (!localClass) {
    setReminderDetailMessage("当前账号的“我的班级”里没有匹配到这个班级，无法直接跳转上传。请先在我的班级中添加或选择同名班级。", true);
    return;
  }

  await openClass(localClass.id);
  window.requestAnimationFrame(() => {
    classUploadButton?.scrollIntoView({ behavior: "smooth", block: "center" });
    classUploadButton?.focus();
    setDetailMessage("请在这里上传该班级的最新完课数据。上传完成后再回到催课页面确认。");
  });
}

function renderReminderError(message) {
  if (reminderPriorityStatus) {
    reminderPriorityStatus.textContent = message || "催课数据读取失败。";
  }
  if (reminderScheduleStatus) {
    reminderScheduleStatus.textContent = "请稍后刷新重试。";
  }
  if (reminderPriorityList) {
    reminderPriorityList.innerHTML = `<div class="empty-state compact-empty">催课优先级暂时无法读取。</div>`;
  }
  if (reminderScheduleList) {
    reminderScheduleList.innerHTML = `<div class="empty-state compact-empty">本周催课节奏暂时无法生成。</div>`;
  }
}

function reminderGroupSummary(group) {
  return `优先级 ${group.included_count || 0} 个，节奏共 ${group.schedule_count || 0} 个，补充 ${group.extra_count || 0} 个我的班级`;
}

function renderReminderPriorities(groups = []) {
  if (!reminderPriorityList) return;
  const visibleGroups = groups.filter((group) => (group.priorities || []).length);
  if (!visibleGroups.length) {
    reminderPriorityList.innerHTML = `
      <div class="empty-state compact-empty">
        暂无可排序班级。未出现在完课数据表、或缺少上个月完课对比的班级不会参与排序。
      </div>
    `;
    return;
  }

  reminderPriorityList.innerHTML = visibleGroups.map((group) => `
    <article class="reminder-teacher-block">
      <div class="reminder-teacher-head">
        <h3>${escapeText(group.teacher_name || "未分配")}</h3>
        <span>${escapeText(reminderGroupSummary(group))}</span>
      </div>
      <div class="reminder-table-wrap">
        <table class="reminder-priority-table">
          <thead>
            <tr>
              <th>优先级</th>
              <th>班级</th>
              <th>本月完成度</th>
              <th>上个月完课率</th>
              <th>较上个月</th>
              <th>建议</th>
            </tr>
          </thead>
          <tbody>
            ${group.priorities.map((item) => `
              <tr>
                <td>
                  <span class="reminder-rank">#${item.rank}</span>
                  <span class="reminder-stars" aria-label="${item.stars}星">${reminderStars(item.stars)}</span>
                </td>
                <td class="reminder-class-name">${escapeText(item.class_name)}</td>
                <td>${formatCompletion(item.completion_rate)}</td>
                <td>${formatCompletion(item.last_month_completion)}</td>
                <td class="${Number(item.change_from_last_month || 0) < 0 ? "is-negative" : "is-positive"}">
                  ${formatCompletionDelta(item.change_from_last_month)}
                </td>
                <td><span class="reminder-suggestion">${escapeText(reminderSuggestion(item.stars))}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </article>
  `).join("");
}

function reminderClassChips(items = [], emptyText = "无", context = {}) {
  if (!items.length) {
    return `<span class="reminder-empty-chip">${escapeText(emptyText)}</span>`;
  }
  return items.map((item) => {
    const actionState = item.action_state || {};
    const isCompleted = Boolean(actionState.completed);
    const completedTitle = actionState.completed_at
      ? `${actionState.label || "已完成"}：${actionState.completed_at}`
      : (actionState.label || "已完成");
    const token = `reminder-${reminderActionIndex.size}`;
    reminderActionIndex.set(token, {
      ...item,
      day_key: context.dayKey || "",
      day_label: context.dayLabel || "",
      task_label: context.taskLabel || "",
      recover_from: context.recoverFrom || "",
    });
    return `
      <button class="reminder-class-chip ${item.source === "my_class" ? "is-extra" : ""} ${isCompleted ? "is-completed" : ""}" type="button" data-reminder-open="${escapeText(token)}">
        ${isCompleted ? `<span class="reminder-done-mark" title="${escapeText(completedTitle)}">✅</span>` : ""}
        <em>${item.rank ? `#${item.rank}` : (item.source === "my_class" ? "补" : "库")}</em>
        <span class="reminder-class-chip-name">${escapeText(item.class_name)}</span>
      </button>
    `;
  }).join("");
}

function reminderTaskRow(label, items, emptyText, day = {}) {
  if (!items.length) return "";
  return `
    <div class="reminder-task-row">
      <strong>${escapeText(label)}</strong>
      <div>${reminderClassChips(items, emptyText, { dayKey: day.key, dayLabel: day.label, taskLabel: label, recoverFrom: day.recover_from })}</div>
    </div>
  `;
}

function renderReminderSchedule(groups = []) {
  if (!reminderScheduleList) return;
  reminderActionIndex = new Map();
  const visibleGroups = groups.filter((group) => Number(group.schedule_count || 0) > 0);
  if (!visibleGroups.length) {
    reminderScheduleList.innerHTML = `
      <div class="empty-state compact-empty">
        暂无可生成节奏的班级。请先在我的班级中添加班级，或确认数据库完课专区已有班级。
      </div>
    `;
    return;
  }

  reminderScheduleList.innerHTML = visibleGroups.map((group) => `
    <article class="reminder-teacher-block">
      <div class="reminder-teacher-head">
        <h3>${escapeText(group.teacher_name || "未分配")}</h3>
        <span>数据库班级优先 ${group.database_count || 0} 个，补充我的班级 ${group.extra_count || 0} 个</span>
      </div>
      <div class="reminder-week-grid">
        ${(group.schedule || []).map((day) => {
          const rows = [
            reminderTaskRow("催课", day.new_classes || [], "无新增催课", day),
            reminderTaskRow("回收", day.recover_classes || [], "无回收班级", day),
            reminderTaskRow("重点复催", day.focus_classes || [], "无重点复催", day),
          ].filter(Boolean).join("");
          return `
            <section class="reminder-day-card">
              <h4>${escapeText(day.label)}</h4>
              ${rows || `<div class="reminder-no-task">无需安排</div>`}
            </section>
          `;
        }).join("")}
      </div>
    </article>
  `).join("");

  reminderScheduleList.querySelectorAll("[data-reminder-open]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = reminderActionIndex.get(button.dataset.reminderOpen);
      if (item) showReminderDetail(item);
    });
  });
}

function renderReminderPlan(data) {
  const summary = data?.summary || {};
  const sourceDate = data?.snapshot_date ? `当前数据：${data.snapshot_date}` : "当前数据：暂无上传快照";
  const lastMonthSource = data?.last_month_source_month ? `上月基准：${data.last_month_source_month}` : "上月基准：暂无";
  if (reminderPriorityStatus) {
    reminderPriorityStatus.textContent = `${sourceDate}，${lastMonthSource}，可排序 ${summary.included_count || 0} 个班级`;
  }
  if (reminderScheduleStatus) {
    reminderScheduleStatus.textContent = `本周节奏共 ${summary.schedule_count || 0} 个班级，数据库优先 ${summary.database_count || 0} 个，补充我的班级 ${summary.extra_count || 0} 个`;
  }
  renderReminderPriorities(data?.groups || []);
  renderReminderSchedule(data?.groups || []);
}

async function loadReminderPlan(force = false) {
  if (!reminderPriorityList || reminderPlanLoading) return;
  if (reminderPlanLoaded && !force) return;
  reminderPlanLoading = true;
  if (reminderPriorityStatus) reminderPriorityStatus.textContent = "正在读取数据库完课对比数据...";
  if (reminderScheduleStatus) reminderScheduleStatus.textContent = "正在生成本周催课节奏...";
  try {
    const data = await apiRequest("/api/database/completion-reminders");
    renderReminderPlan(data);
    reminderPlanLoaded = true;
  } finally {
    reminderPlanLoading = false;
  }
}


function renderActivityProgressCell(student) {
  if (!activeClass?.completion_activity) return "";
  const waterCount = studentWaterCount(student);
  const variety = plantVariety(student);
  const stage = plantStage(waterCount, variety);
  const revealClass = waterCount >= 3 ? variety.className : "plant-secret";
  return `
    <td class="activity-progress-cell">
      <div class="activity-plant-progress">
        <span class="plant-visual compact ${stage.className} ${revealClass}" aria-hidden="true">
          <i class="plant-seed"></i>
          <i class="plant-stem"></i>
          <i class="plant-leaf left"></i>
          <i class="plant-leaf right"></i>
          <i class="plant-branch left"></i>
          <i class="plant-branch right"></i>
          <i class="plant-crown"></i>
          <i class="plant-bloom one"></i>
          <i class="plant-bloom two"></i>
          <i class="plant-fruit one"></i>
          <i class="plant-fruit two"></i>
        </span>
        <div class="activity-stage-copy">
          <span class="activity-stage-badge ${stage.className}">${stage.label}</span>
          <strong>${waterCount}/4</strong>
          <div class="water-progress compact"><i style="width: ${(waterCount / 4) * 100}%"></i></div>
        </div>
      </div>
    </td>
  `;
}

function syncActivityProgressColumn() {
  const shouldShow = Boolean(activeClass?.completion_activity);
  const headerRow = document.querySelector(".student-table .week-header-row");
  const dayHeaderRow = document.querySelector(".student-table .day-header-row");
  if (!headerRow || !dayHeaderRow) return;

  headerRow.querySelector("[data-activity-progress-head]")?.remove();
  dayHeaderRow.querySelector("[data-activity-progress-subhead]")?.remove();
  if (!shouldShow) return;

  const head = document.createElement("th");
  head.setAttribute("rowspan", "2");
  head.setAttribute("data-activity-progress-head", "true");
  head.textContent = "活动进度";
  const weekStart = headerRow.querySelector(".week-group-start");
  headerRow.insertBefore(head, weekStart);

  const subHead = document.createElement("th");
  subHead.setAttribute("data-activity-progress-subhead", "true");
  subHead.className = "activity-progress-subhead";
  subHead.hidden = true;
  dayHeaderRow.insertBefore(subHead, dayHeaderRow.querySelector(".week-group-start"));
}

async function joinCompletionActivity(classId) {
  if (!classId) {
    setClassMessage("请先选择要参与活动的班级。", true);
    activityClassSelect?.focus();
    return;
  }
  const data = await apiRequest(`/api/classes/${classId}`, {
    method: "PATCH",
    body: JSON.stringify({ completion_activity: true }),
  });
  classes = classes.map((item) => (item.id === classId ? data.class : item));
  activeClass = data.class;
  renderClassList();
  if (activityClassSelect) activityClassSelect.value = classId;
  detailTitle.textContent = activeClass.name;
  showClassDetail();
  renderStudents();
  setDetailMessage("该班级已参与 6月完课活动。");
}

function renderStudents() {
  if (!activeClass || !studentRows || !studentStatus || !studentEmpty) return;

  const students = activeClass.students || [];
  syncActivityProgressColumn();
  const selectedCategory = studentCategoryFilter?.value || "";
  const visibleStudents = selectedCategory
    ? students.filter((student) => (student.habit_category || "暂无数据") === selectedCategory)
    : students;
  const month = activeClass.month ? ` · ${activeClass.month}` : "";
  studentStatus.textContent = selectedCategory
    ? `${visibleStudents.length} / ${students.length} 名学员${month}`
    : `${students.length} 名学员${month}`;
  studentRows.innerHTML = visibleStudents
    .map((student) => {
      const weeks = normalizeWeeks(student.weeks);
      const dayCells = WEEK_KEYS
        .flatMap((week) => weeks[week].map((rate, dayIndex) => (
          `<td class="${dayIndex === 0 ? "week-group-start" : ""}">${renderDayCell(rate)}</td>`
        )))
        .join("");
      return `
        <tr>
          <td class="sticky-col student-name-cell">${escapeText(student.name)}</td>
          <td class="sticky-col second-col">${escapeText(student.account)}</td>
          <td>${renderMonthlyCell(student.monthly_completion)}</td>
          <td>${renderHabitCell(student.habit_category)}</td>
          ${renderActivityProgressCell(student)}
          ${dayCells}
        </tr>
      `;
    })
    .join("");

  if (!students.length) {
    studentEmpty.textContent = "当前班级暂无学员，请上传表格。";
  } else {
    studentEmpty.textContent = "当前筛选条件下暂无学员。";
  }
  studentEmpty.classList.toggle("is-hidden", visibleStudents.length > 0);
}

async function loadClasses() {
  if (!classList) return;
  const data = await apiRequest("/api/classes");
  classes = data.classes || [];
  classTeachers = data.teachers || classTeachers;
  renderClassList();
}

async function createClass(name, teacherId) {
  const data = await apiRequest("/api/classes", {
    method: "POST",
    body: JSON.stringify({ name, teacher_id: teacherId }),
  });
  classes.unshift(data.class);
  renderClassList();
  setClassMessage("班级已添加。");
}

async function updateClassTeacher(classId, teacherId) {
  const data = await apiRequest(`/api/classes/${classId}`, {
    method: "PATCH",
    body: JSON.stringify({ teacher_id: teacherId }),
  });
  classes = classes.map((item) => (item.id === classId ? data.class : item));
  if (activeClass?.id === classId) {
    activeClass = data.class;
  }
  renderClassList();
  setClassMessage("班主任归属已更新，日报带班人数会同步变化。");
}

async function deleteClass(classId) {
  await apiRequest(`/api/classes/${classId}`, { method: "DELETE" });
  classes = classes.filter((item) => item.id !== classId);
  renderClassList();
  setClassMessage("班级已删除。");
}

async function openClass(classId) {
  const data = await apiRequest(`/api/classes/${classId}`);
  activeClass = data.class;
  detailTitle.textContent = activeClass.name;
  showClassDetail();
  clearCompletionImage();
  renderStudents();
}

async function uploadStudents(file) {
  if (!activeClass || !file) return;
  const week = classWeekSelect?.value || "1";
  if (classGenerateImage?.checked && !completionImageTitle()) {
    setDetailMessage("请先填写标题周数，例如 24。", true);
    classImageWeekNumber?.focus();
    return;
  }
  setDetailMessage(`正在导入 ${file.name} 到${weekLabel(week)}...`);
  const formData = new FormData();
  formData.append("file", file);
  formData.append("week", week);
  const data = await apiRequest(`/api/classes/${activeClass.id}/upload`, {
    method: "POST",
    body: formData,
  });
  activeClass = data.class;
  renderStudents();
  await loadClasses();
  if (classGenerateImage?.checked) {
    if (classImageWeekSelect) {
      classImageWeekSelect.value = week;
    }
    generateCompletionImage();
  } else {
    setDetailMessage(
      `已同步到${weekLabel(week)}：新增 ${data.result.created} 人，更新 ${data.result.updated} 人，移除 ${data.result.removed} 人。`
    );
  }
}

async function clearMonthData() {
  if (!activeClass) return;
  const confirmed = window.confirm("确认清空当前班级本月完课数据吗？学员名单和账号会保留。");
  if (!confirmed) return;

  const data = await apiRequest(`/api/classes/${activeClass.id}/month-data`, {
    method: "DELETE",
  });
  activeClass = data.class;
  clearCompletionImage();
  renderStudents();
  await loadClasses();
  setDetailMessage(`已清空 ${data.result.month} 本月数据，保留 ${activeClass.students.length} 名学员。`);
}

function initCompletion() {
  if (!classList) return;

  completionSectionButtons.forEach((button) => {
    button.addEventListener("click", () => setCompletionSection(button.dataset.completionSection));
  });

  reminderRefreshButton?.addEventListener("click", () => {
    reminderPlanLoaded = false;
    showReminderHome();
    loadReminderPlan(true).catch((error) => renderReminderError(error.message));
  });

  reminderBackButton?.addEventListener("click", showReminderHome);
  reminderConfirmYes?.addEventListener("click", () => {
    renderReminderArrangement().catch((error) => {
      setReminderDetailMessage(error.message, true);
      renderReminderArrangementError(error.message);
    });
  });
  reminderConfirmNo?.addEventListener("click", () => {
    jumpToReminderUpload().catch((error) => setReminderDetailMessage(error.message, true));
  });

  classCreateForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = classNameInput.value.trim();
    if (!name) {
      setClassMessage("请输入班级名称。", true);
      return;
    }
    try {
      await createClass(name, classTeacherSelect?.value || "");
      classCreateForm.reset();
    } catch (error) {
      setClassMessage(error.message, true);
    }
  });

  classBackButton?.addEventListener("click", showClassHome);

  activityJoinForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await joinCompletionActivity(activityClassSelect?.value || "");
    } catch (error) {
      setClassMessage(error.message, true);
    }
  });

  classUploadButton?.addEventListener("click", () => {
    if (!activeClass) {
      setDetailMessage("请先进入班级后再上传表格。", true);
      return;
    }
    setDetailMessage(`请选择要导入到${weekLabel(classWeekSelect?.value || "1")}的 Excel 或 CSV 文件。`);
    classFileInput?.click();
  });

  classGenerateCurrentImage?.addEventListener("click", generateCompletionImage);
  classGenerateActivityImage?.addEventListener("click", generateActivityImage);
  classImagePreviewToggle?.addEventListener("click", toggleCompletionImagePreview);

  classWeekSelect?.addEventListener("change", () => {
    if (classImageWeekSelect) {
      classImageWeekSelect.value = classWeekSelect.value;
    }
    clearCompletionImage();
  });

  classImageWeekSelect?.addEventListener("change", clearCompletionImage);
  studentCategoryFilter?.addEventListener("change", renderStudents);

  classClearMonthButton?.addEventListener("click", async () => {
    try {
      await clearMonthData();
    } catch (error) {
      setDetailMessage(error.message, true);
    }
  });

  classFileInput?.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) {
      setDetailMessage("未选择文件。", true);
      return;
    }
    try {
      await uploadStudents(file);
    } catch (error) {
      setDetailMessage(error.message, true);
    } finally {
      event.target.value = "";
    }
  });

  loadClasses().catch((error) => setClassMessage(error.message, true));
}

initCompletion();
