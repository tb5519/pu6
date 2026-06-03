const classHomeView = document.querySelector("[data-class-home]");
const classDetailView = document.querySelector("[data-class-detail]");
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
  classHomeView?.classList.remove("is-hidden");
  classDetailView?.classList.add("is-hidden");
  activeClass = null;
  clearCompletionImage();
  setDetailMessage("");
  setClassMessage("");
}

function showClassDetail() {
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
  if (waterCount >= 2) return { label: "冒枝", className: "is-branch" };
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
      <article class="class-card">
        <div>
          <span class="module-eyebrow">班级</span>
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
