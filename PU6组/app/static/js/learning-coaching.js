const learningClassStatus = document.querySelector("#lc-classStatus");
const learningClassSearch = document.querySelector("#lc-classSearch");
const learningClassList = document.querySelector("#lc-classList");
const learningRefreshButton = document.querySelector("#lc-refreshButton");
const learningUploadButton = document.querySelector("#lc-uploadButton");
const learningFileInput = document.querySelector("#lc-fileInput");
const learningRosterRemoveFrom = document.querySelector("#lc-rosterRemoveFrom");
const learningRemoveRosterButton = document.querySelector("#lc-removeRosterButton");
const learningResetRosterButton = document.querySelector("#lc-resetRosterButton");
const learningGuideUploadButton = document.querySelector("#lc-guideUploadButton");
const learningGuideUploadInput = document.querySelector("#lc-guideUploadInput");
const learningUploadStatus = document.querySelector("#lc-uploadStatus");
const learningRoundPanel = document.querySelector("#lc-roundPanel");
const learningRoundToggle = document.querySelector("#lc-roundToggle");
const learningRoundBody = document.querySelector("#lc-roundBody");
const learningRoundRows = document.querySelector("#lc-roundRows");
const learningRoundAdd = document.querySelector("#lc-roundAdd");
const learningRoundSave = document.querySelector("#lc-roundSave");
const learningRoundStatus = document.querySelector("#lc-roundStatus");
const learningTodayPanel = document.querySelector("#lc-todayPanel");
const learningTodayStatus = document.querySelector("#lc-todayStatus");
const learningTodayList = document.querySelector("#lc-todayList");
const learningCommunicationCalendar = document.querySelector("#lc-communicationCalendar");
const learningCommunicationCalendarStatus = document.querySelector("#lc-communicationCalendarStatus");
const learningCommunicationCalendarList = document.querySelector("#lc-communicationCalendarList");
const learningEmptyState = document.querySelector("#lc-emptyState");
const learningDetail = document.querySelector("#lc-detail");
const learningClassMeta = document.querySelector("#lc-classMeta");
const learningClassTitle = document.querySelector("#lc-classTitle");
const learningClassBadges = document.querySelector("#lc-classBadges");
const learningBookTabs = document.querySelector("#lc-bookTabs");
const learningSelectedTitle = document.querySelector("#lc-selectedTitle");
const learningSelectedMeta = document.querySelector("#lc-selectedMeta");
const learningScoreHead = document.querySelector("#lc-scoreHead");
const learningScoreRows = document.querySelector("#lc-scoreRows");
const learningScoreEmpty = document.querySelector("#lc-scoreEmpty");
const learningGuideModal = document.querySelector("#lc-guideModal");
const learningGuideClose = document.querySelector("#lc-guideClose");
const learningGuideMeta = document.querySelector("#lc-guideMeta");
const learningGuideTitle = document.querySelector("#lc-guideTitle");
const learningGuideScoreSummary = document.querySelector("#lc-guideScoreSummary");
const learningGuideWordsText = document.querySelector("#lc-guideWordsText");
const learningGuideSentencesText = document.querySelector("#lc-guideSentencesText");
const learningGuideGrammarText = document.querySelector("#lc-guideGrammarText");
const learningGuidePracticeText = document.querySelector("#lc-guidePracticeText");
const learningGuideAnswerText = document.querySelector("#lc-guideAnswerText");
const learningGuideWordsInput = document.querySelector("#lc-guideWordsInput");
const learningGuideSentencesInput = document.querySelector("#lc-guideSentencesInput");
const learningGuideGrammarInput = document.querySelector("#lc-guideGrammarInput");
const learningGuidePracticeInput = document.querySelector("#lc-guidePracticeInput");
const learningGuideAnswerInput = document.querySelector("#lc-guideAnswerInput");
const learningAppointmentDate = document.querySelector("#lc-appointmentDate");
const learningAppointmentSave = document.querySelector("#lc-appointmentSave");
const learningAppointmentDone = document.querySelector("#lc-appointmentDone");
const learningAppointmentStatus = document.querySelector("#lc-appointmentStatus");
const LEARNING_SCORE_SCROLL_BUFFER_COLUMNS = 10;

let learningCoachingData = {
  classes: [],
  books: [],
  categories: [],
  coaching_start_week: 15,
  coaching_deadline_week: 24,
  coaching_rounds: [],
  guides: {},
  stage_guides: {},
  appointments: {},
  today_appointments: [],
  can_manage: false,
  current_teacher_id: "",
};
let learningSelectedClassId = "";
let learningSelectedBook = "upper";
let learningHasLoaded = false;
let learningGuideContext = null;
let learningExpandedTeacherIds = new Set();
let learningSelectedRosterStudentIds = new Set();

function escapeLearningText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function learningApiRequest(url, options = {}) {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: options.body && !isFormData ? { "Content-Type": "application/json", ...(options.headers || {}) } : (options.headers || {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "学情辅导数据读取失败。");
  }
  return data;
}

function setLearningUploadStatus(message = "", isError = false) {
  if (!learningUploadStatus) return;
  learningUploadStatus.textContent = message;
  learningUploadStatus.classList.toggle("is-error", Boolean(isError));
}

function setLearningRoundStatus(message = "", isError = false) {
  if (!learningRoundStatus) return;
  learningRoundStatus.textContent = message;
  learningRoundStatus.classList.toggle("is-error", Boolean(isError));
}

function defaultLearningRounds() {
  return [
    { id: "round-1", name: "第一轮辅导", start_week: 15, deadline_week: 24 },
    { id: "round-2", name: "第二轮辅导", start_week: 30, deadline_week: 39 },
  ];
}

function visibleLearningRounds() {
  return learningCoachingData.coaching_rounds?.length
    ? learningCoachingData.coaching_rounds
    : defaultLearningRounds();
}

function renderLearningRoundSettings() {
  learningRoundPanel?.classList.toggle("is-hidden", !learningCoachingData.can_manage);
  if (!learningRoundRows || !learningCoachingData.can_manage) return;
  learningRoundRows.innerHTML = visibleLearningRounds().map((round, index) => `
    <div class="learning-round-row" data-round-index="${index}">
      <label>
        <span>名称</span>
        <input data-round-field="name" value="${escapeLearningText(round.name || `第${index + 1}轮辅导`)}">
      </label>
      <label>
        <span>进入W</span>
        <input data-round-field="start_week" type="number" min="1" max="99" value="${Number(round.start_week || 1)}">
      </label>
      <label>
        <span>DDL W</span>
        <input data-round-field="deadline_week" type="number" min="1" max="99" value="${Number(round.deadline_week || round.start_week || 1)}">
      </label>
      <button class="icon-button" type="button" data-round-remove="${index}" aria-label="删除轮次">−</button>
    </div>
  `).join("");
}

function collectLearningRounds() {
  const rows = Array.from(learningRoundRows?.querySelectorAll(".learning-round-row") || []);
  return rows.map((row, index) => {
    const name = row.querySelector('[data-round-field="name"]')?.value?.trim() || `第${index + 1}轮辅导`;
    const startWeek = Number(row.querySelector('[data-round-field="start_week"]')?.value || 1);
    const deadlineWeek = Number(row.querySelector('[data-round-field="deadline_week"]')?.value || startWeek);
    return {
      id: visibleLearningRounds()[index]?.id || `round-${Date.now()}-${index}`,
      name,
      start_week: Math.max(1, Math.min(99, startWeek)),
      deadline_week: Math.max(startWeek, Math.min(99, deadlineWeek)),
    };
  }).filter((round) => round.start_week && round.deadline_week);
}

async function saveLearningRounds() {
  const rounds = collectLearningRounds();
  if (!rounds.length) {
    setLearningRoundStatus("请至少保留一轮辅导周期。", true);
    return;
  }
  setLearningRoundStatus("正在保存...");
  if (learningRoundSave) learningRoundSave.disabled = true;
  try {
    const data = await learningApiRequest("/api/learning-coaching/rounds", {
      method: "PUT",
      body: JSON.stringify({ rounds }),
    });
    learningCoachingData.coaching_rounds = data.coaching_rounds || rounds;
    setLearningRoundStatus("已保存");
    renderLearningRoundSettings();
    await loadLearningCoaching(true);
  } catch (error) {
    setLearningRoundStatus(error.message || "保存失败。", true);
  } finally {
    if (learningRoundSave) learningRoundSave.disabled = false;
  }
}

function formatLearningScore(value) {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return Number.isInteger(number) ? String(number) : number.toFixed(2);
}

function learningClassMatchesSearch(item) {
  return true;
}

function learningVisibleClasses() {
  return (learningCoachingData.classes || []).filter(learningClassMatchesSearch);
}

function learningCurrentTeacherId() {
  return String(learningCoachingData.current_teacher_id || "").trim();
}

function learningStatusOrder(status = "") {
  return {
    active: 0,
    upcoming: 1,
    unknown: 2,
    ended: 3,
  }[status] ?? 4;
}

function learningClassProgress(item = {}) {
  const total = Number(item.student_count || 0);
  const roundId = String(item.coaching_cycle?.round_id || "").trim();
  const completedStudents = new Set();
  Object.values(learningCoachingData.appointments || {}).forEach((record) => {
    if (!record || !record.completed || record.class_id !== item.id) return;
    const recordRoundId = String(record.round_id || "").trim();
    if (roundId && recordRoundId && recordRoundId !== roundId) return;
    if (record.student_id) completedStudents.add(record.student_id);
  });
  const completed = completedStudents.size;
  const rate = total ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  return { completed, total, rate };
}

function learningClassCycleNoteHtml(item = {}) {
  const cycle = item.coaching_cycle || {};
  if (!item.in_coaching_cycle && cycle.status === "upcoming" && cycle.entry_label) {
    return `<em><strong class="learning-entry-date">${escapeLearningText(cycle.entry_label)}</strong>进入${escapeLearningText(cycle.round_name || "辅导周期")}</em>`;
  }
  if (cycle.status === "unknown") {
    return `<em>未填写W数</em>`;
  }
  const cycleText = cycle.round_name || (item.in_coaching_cycle ? "辅导周期" : "未进入辅导周期");
  return `<em>${escapeLearningText(cycleText)}</em>`;
}

function learningClassCardHtml(item) {
  const isActive = item.id === learningSelectedClassId;
  const cycle = item.coaching_cycle || {};
  const progress = learningClassProgress(item);
  const ddlBadge = item.in_coaching_cycle && cycle.deadline_label
    ? `<i class="learning-ddl-badge">DDL ${escapeLearningText(cycle.deadline_label)}</i>`
    : "";
  return `
    <button class="learning-class-card${isActive ? " is-active" : ""}${item.in_coaching_cycle ? " is-cycle-active" : " is-muted"}" type="button" data-learning-class="${escapeLearningText(item.id)}">
      <span class="learning-class-topline">
        <b>${escapeLearningText(item.title_week_label || "未填W")}</b>
        ${ddlBadge}
      </span>
      <strong>${escapeLearningText(item.name || "-")}</strong>
      ${learningClassCycleNoteHtml(item)}
      <span class="learning-class-progress">
        <span><b>${progress.completed}/${progress.total}</b><i>${progress.rate}%</i></span>
        <small><i style="width: ${progress.rate}%"></i></small>
      </span>
    </button>
  `;
}

function teacherGroupSortValue(group = {}) {
  const firstClass = group.classes?.[0] || {};
  const cycle = firstClass.coaching_cycle || {};
  const primaryDate = cycle.status === "active" ? cycle.deadline_date : cycle.entry_date;
  return [
    group.isOwn ? 0 : 1,
    learningStatusOrder(cycle.status),
    primaryDate || "9999-12-31",
    group.teacherName || "",
  ].join("|");
}

function learningTeacherGroups(classes = []) {
  const currentTeacherId = learningCurrentTeacherId();
  const groupsByTeacher = new Map();
  classes.forEach((item) => {
    const teacherId = String(item.teacher_id || "unknown").trim() || "unknown";
    if (!groupsByTeacher.has(teacherId)) {
      groupsByTeacher.set(teacherId, {
        teacherId,
        teacherName: item.teacher_name || "未分配",
        isOwn: teacherId === currentTeacherId,
        classes: [],
      });
    }
    groupsByTeacher.get(teacherId).classes.push(item);
  });
  const groups = Array.from(groupsByTeacher.values());
  return groups.sort((left, right) => teacherGroupSortValue(left).localeCompare(teacherGroupSortValue(right)));
}

function learningTeacherGroupHtml(group = {}) {
  const containsSelected = group.classes.some((item) => item.id === learningSelectedClassId);
  const isOpen = group.isOwn || containsSelected || learningExpandedTeacherIds.has(group.teacherId);
  const activeCount = group.classes.filter((item) => item.in_coaching_cycle).length;
  const title = group.isOwn ? "我的班级" : group.teacherName;
  const subtitle = `${group.classes.length}个班${activeCount ? ` · ${activeCount}个辅导中` : ""}`;
  return `
    <section class="learning-teacher-group${isOpen ? " is-open" : ""}${group.isOwn ? " is-own" : ""}">
      <button class="learning-teacher-toggle" type="button" data-learning-teacher-toggle="${escapeLearningText(group.teacherId)}">
        <span>${escapeLearningText(title)}</span>
        <small>${escapeLearningText(subtitle)}</small>
      </button>
      <div class="learning-teacher-class-list">
        ${group.classes.map(learningClassCardHtml).join("")}
      </div>
    </section>
  `;
}

function currentLearningClass() {
  return (learningCoachingData.classes || []).find((item) => item.id === learningSelectedClassId) || null;
}

function currentLearningBook() {
  return currentLearningClass()?.books?.[learningSelectedBook] || null;
}

function learningGuideKey(kind, book, number) {
  return `${kind}:${book}:${Number(number || 1)}`;
}

function currentLearningGuide(kind, book, number) {
  return learningCoachingData.guides?.[learningGuideKey(kind, book, number)] || {};
}

function learningStageGuideKey(book, stage) {
  return `${book}:${Number(stage || 1)}`;
}

function currentLearningStageGuide(book, stage) {
  return currentLearningGuide("stage", book, stage)
    || learningCoachingData.stage_guides?.[learningStageGuideKey(book, stage)]
    || {};
}

function learningAppointmentKey(classId, studentId, book, kind, number, roundId = "") {
  const safeRoundId = String(roundId || "").trim();
  if (safeRoundId) {
    return `${classId}:${studentId}:${book}:${safeRoundId}:${kind === "stage" ? "stage" : "unit"}:${Number(number || 1)}`;
  }
  return `${classId}:${studentId}:${book}:${kind === "stage" ? "stage" : "unit"}:${Number(number || 1)}`;
}

function learningGuideContextNumber(context = learningGuideContext) {
  if (!context) return 1;
  const stage = Number(context.score?.stage || 1);
  return context.kind === "stage" ? stage : Number(context.score?.unit || 1);
}

function learningGuideAppointmentPayload(context = learningGuideContext) {
  const classData = currentLearningClass();
  if (!classData || !context?.student) return null;
  const kind = context.kind || "unit";
  const number = learningGuideContextNumber(context);
  return {
    class_id: classData.id,
    student_id: context.student.student_id || "",
    book: learningSelectedBook,
    round_id: classData.coaching_cycle?.round_id || "",
    kind,
    number,
  };
}

function currentLearningAppointment() {
  const payload = learningGuideAppointmentPayload();
  if (!payload) return null;
  const key = learningAppointmentKey(payload.class_id, payload.student_id, payload.book, payload.kind, payload.number, payload.round_id);
  return learningCoachingData.appointments?.[key] || null;
}

function learningCompletionForStudent(studentId) {
  const classData = currentLearningClass();
  if (!classData || !studentId) return null;
  const records = Object.values(learningCoachingData.appointments || {})
    .filter((item) => (
      item
      && item.completed
      && item.class_id === classData.id
      && item.student_id === studentId
      && item.book === learningSelectedBook
      && (item.round_id || "") === (classData.coaching_cycle?.round_id || "")
    ))
    .sort((a, b) => String(b.completed_at || b.completed_date || "").localeCompare(String(a.completed_at || a.completed_date || "")));
  return records[0] || null;
}

function currentLearningCompletion() {
  const payload = learningGuideAppointmentPayload();
  return payload ? learningCompletionForStudent(payload.student_id) : null;
}

function applyLearningAppointmentPayload(data = {}) {
  learningCoachingData.appointments = data.appointments || {};
  learningCoachingData.today_appointments = data.today_appointments || [];
}

function replaceLearningClassPayload(classData) {
  if (!classData?.id) return;
  learningCoachingData.classes = (learningCoachingData.classes || []).map((item) => (
    item.id === classData.id ? classData : item
  ));
}

function setLearningAppointmentStatus(message = "", isError = false) {
  if (!learningAppointmentStatus) return;
  learningAppointmentStatus.textContent = message;
  learningAppointmentStatus.classList.toggle("is-error", Boolean(isError));
}

function stageRangeLabel(stage) {
  const start = ((Number(stage || 1) - 1) * 3) + 1;
  return `Unit${start}-Unit${start + 2}`;
}

function stageUnitNumbers(stage) {
  const start = ((Number(stage || 1) - 1) * 3) + 1;
  return [start, start + 1, start + 2];
}

function learningParentLabel(student = {}) {
  const name = String(student.name || "").trim();
  if (!name) return "家长";
  if (/(妈妈|爸爸|家长)$/.test(name)) return name;
  return `${name}妈妈`;
}

function learningGuideMessage(context = learningGuideContext) {
  const student = context?.student || {};
  const score = context?.score || {};
  const kind = context?.kind || "unit";
  const stage = Number(score.stage || 1);
  const unit = Number(score.unit || 1);
  const range = kind === "stage"
    ? (score.stage_range_label || stageRangeLabel(stage))
    : `Unit${unit}`;
  const target = kind === "stage"
    ? `${range}这个阶段的重难点`
    : `${range}的重难点`;
  return `${learningParentLabel(student)}，给您来电主要是想给孩子辅导一下${target}，您什么时间方便接听，可以跟我留个言哦`;
}

function scoreLine(label, score = {}) {
  if (score.score === null || score.score === undefined) return `${label}：暂无`;
  const category = score.category ? ` · ${score.category}` : "";
  return `${label}：${formatLearningScore(score.score)}${category}`;
}

function renderLearningClassList() {
  if (!learningClassList) return;
  const classes = learningVisibleClasses();
  if (learningClassStatus) {
    learningClassStatus.textContent = "";
  }
  if (!classes.length) {
    learningClassList.innerHTML = `<div class="empty-state compact-empty">暂无可查看班级。</div>`;
    return;
  }
  if (!learningCoachingData.can_manage) {
    learningClassList.innerHTML = classes.map(learningClassCardHtml).join("");
    return;
  }
  learningClassList.innerHTML = learningTeacherGroups(classes).map(learningTeacherGroupHtml).join("");
}

function renderLearningBookTabs() {
  if (!learningBookTabs) return;
  const books = learningCoachingData.books?.length
    ? learningCoachingData.books
    : [{ key: "upper", label: "上册" }, { key: "lower", label: "下册" }];
  learningBookTabs.innerHTML = books.map((book) => `
    <button class="${book.key === learningSelectedBook ? "is-active" : ""}" type="button" data-learning-book="${escapeLearningText(book.key)}">
      ${escapeLearningText(book.label)}
    </button>
  `).join("");
}

function renderLearningTodayAppointments() {
  if (!learningTodayPanel || !learningTodayList) return;
  const items = learningCoachingData.today_appointments || [];
  learningTodayPanel.classList.toggle("is-hidden", !items.length);
  if (!items.length) {
    learningTodayList.innerHTML = "";
    if (learningTodayStatus) learningTodayStatus.textContent = "";
    return;
  }
  if (learningTodayStatus) {
    learningTodayStatus.textContent = `${items.length} 个待辅导`;
  }
  learningTodayList.innerHTML = items.map((item) => {
    const overdueText = item.is_today ? "" : " · 已到期";
    return `
      <button class="learning-today-item" type="button" data-appointment-key="${escapeLearningText(item.key || "")}">
        ${escapeLearningText(item.student_name || "-")} · ${escapeLearningText(item.target_label || "")}
        <small>${escapeLearningText(item.class_name || "")}${escapeLearningText(overdueText)}</small>
      </button>
    `;
  }).join("");
}

function learningDateLabelFromKey(dateKey = "") {
  const parts = String(dateKey || "").split("-");
  if (parts.length !== 3) return dateKey;
  return `${Number(parts[1]) || parts[1]}月${Number(parts[2]) || parts[2]}日`;
}

function learningCompletedCalendarRows(classData) {
  if (!classData) return [];
  const roundId = String(classData.coaching_cycle?.round_id || "").trim();
  const byDate = new Map();
  Object.values(learningCoachingData.appointments || {}).forEach((item) => {
    if (!item || !item.completed || item.class_id !== classData.id) return;
    const itemRoundId = String(item.round_id || "").trim();
    if (roundId && itemRoundId && itemRoundId !== roundId) return;
    const dateKey = item.completed_date || String(item.completed_at || "").slice(0, 10);
    if (!dateKey) return;
    if (!byDate.has(dateKey)) {
      byDate.set(dateKey, {
        date: dateKey,
        label: item.completed_label || learningDateLabelFromKey(dateKey),
        students: new Map(),
      });
    }
    const day = byDate.get(dateKey);
    const studentKey = item.student_id || `${item.student_name}-${item.target_label}`;
    const current = day.students.get(studentKey) || {
      name: item.student_name || "-",
      targets: new Set(),
    };
    if (item.target_label) current.targets.add(item.target_label);
    day.students.set(studentKey, current);
  });
  return Array.from(byDate.values())
    .sort((left, right) => String(right.date).localeCompare(String(left.date)))
    .map((day) => ({
      ...day,
      students: Array.from(day.students.values()).map((student) => ({
        name: student.name,
        targets: Array.from(student.targets),
      })),
    }));
}

function renderLearningCommunicationCalendar() {
  if (!learningCommunicationCalendar || !learningCommunicationCalendarList) return;
  const classData = currentLearningClass();
  const shouldShow = Boolean(learningCoachingData.can_manage && classData?.in_coaching_cycle);
  learningCommunicationCalendar.classList.toggle("is-hidden", !shouldShow);
  if (!shouldShow) {
    learningCommunicationCalendarList.innerHTML = "";
    if (learningCommunicationCalendarStatus) learningCommunicationCalendarStatus.textContent = "";
    return;
  }
  const rows = learningCompletedCalendarRows(classData);
  const studentCount = rows.reduce((sum, row) => sum + row.students.length, 0);
  if (learningCommunicationCalendarStatus) {
    learningCommunicationCalendarStatus.textContent = rows.length
      ? `${rows.length}天 · ${studentCount}人`
      : "暂无完成记录";
  }
  if (!rows.length) {
    learningCommunicationCalendarList.innerHTML = `<div class="empty-state compact-empty">当前辅导周期暂无已完成辅导。</div>`;
    return;
  }
  learningCommunicationCalendarList.innerHTML = rows.map((row) => {
    const studentNames = row.students.map((student) => student.name).join("、");
    const details = row.students
      .map((student) => {
        const targetText = student.targets.length ? `（${student.targets.join("、")}）` : "";
        return `${student.name}${targetText}`;
      })
      .join("；");
    return `
      <article class="learning-calendar-day" title="${escapeLearningText(details)}">
        <strong>${escapeLearningText(row.label || learningDateLabelFromKey(row.date))}</strong>
        <span>${row.students.length}人</span>
        <p>${escapeLearningText(studentNames)}</p>
      </article>
    `;
  }).join("");
}

function renderUnitScoreCell(score = {}, student = {}) {
  if (score.score === null || score.score === undefined) {
    return `<span class="learning-score-cell is-empty">-</span>`;
  }
  const classData = currentLearningClass();
  const canOpenGuide = Boolean(classData?.in_coaching_cycle);
  const inner = `
    <strong>${escapeLearningText(formatLearningScore(score.score))}</strong>
    <em>${escapeLearningText(score.category || "")}</em>
  `;
  if (!canOpenGuide) {
    return `
      <span class="learning-score-cell is-${escapeLearningText(score.category_key || "")}">
        ${inner}
      </span>
    `;
  }
  return `
    <button class="learning-score-cell learning-score-button is-${escapeLearningText(score.category_key || "")}" type="button"
      data-learning-score="1"
      data-guide-kind="unit"
      data-student-id="${escapeLearningText(student.student_id || "")}"
      data-unit="${escapeLearningText(score.unit || "")}"
      data-stage="${escapeLearningText(score.stage || "")}">
      ${inner}
    </button>
  `;
}

function stageScoreForStudent(student = {}, stage) {
  const fallback = {
    unit: ((Number(stage || 1) - 1) * 3) + 1,
    stage: Number(stage || 1),
    stage_label: `阶段${Number(stage || 1)}`,
    stage_range_label: stageRangeLabel(stage),
    stage_score: { score: null, category: "", category_key: "missing", source_label: "", updated_at: "" },
  };
  return (student.unit_scores || []).find((item) => (
    Number(item.stage) === Number(stage)
    && item.stage_score
    && item.stage_score.score !== null
    && item.stage_score.score !== undefined
  )) || fallback;
}

function studentHasLearningScore(student = {}) {
  return Number(student.scored_count || 0) > 0
    || (student.unit_scores || []).some((item) => (
      item.stage_score
      && item.stage_score.score !== null
      && item.stage_score.score !== undefined
    ));
}

function renderStageScoreCell(score = {}, student = {}, stage) {
  const stageScore = score.stage_score || {};
  if (stageScore.score === null || stageScore.score === undefined) {
    return `<span class="learning-score-cell learning-stage-score-cell is-empty">-</span>`;
  }
  const classData = currentLearningClass();
  const canOpenGuide = Boolean(classData?.in_coaching_cycle);
  const inner = `
    <strong>${escapeLearningText(formatLearningScore(stageScore.score))}</strong>
    <em>${escapeLearningText(stageScore.category || "阶段测评")}</em>
  `;
  if (!canOpenGuide) {
    return `
      <span class="learning-score-cell learning-stage-score-cell is-${escapeLearningText(stageScore.category_key || "")}">
        ${inner}
      </span>
    `;
  }
  return `
    <button class="learning-score-cell learning-score-button learning-stage-score-cell is-${escapeLearningText(stageScore.category_key || "")}" type="button"
      data-learning-score="1"
      data-guide-kind="stage"
      data-student-id="${escapeLearningText(student.student_id || "")}"
      data-unit="${escapeLearningText(score.unit || ((Number(stage || 1) - 1) * 3) + 1)}"
      data-stage="${escapeLearningText(stage || score.stage || "")}">
      ${inner}
    </button>
  `;
}

function learningScoreScrollBufferCells(tagName = "td") {
  return Array.from(
    { length: LEARNING_SCORE_SCROLL_BUFFER_COLUMNS },
    () => `<${tagName} class="learning-score-scroll-buffer" aria-hidden="true"></${tagName}>`,
  ).join("");
}

function renderLearningScoreHead(rows = []) {
  if (!learningScoreHead) return;
  const canWrite = Boolean(currentLearningClass()?.can_write);
  const studentIds = rows.map((student) => String(student.student_id || "").trim()).filter(Boolean);
  const allSelected = studentIds.length > 0 && studentIds.every((studentId) => learningSelectedRosterStudentIds.has(studentId));
  const selectionControl = canWrite ? `
    <input class="learning-roster-select" type="checkbox" data-learning-roster-select-all="1"
      aria-label="全选当前辅导名单" ${allSelected ? "checked" : ""}>
  ` : "";
  learningScoreHead.innerHTML = `
    <tr>
      <th><span class="learning-name-head">${selectionControl}<span>姓名</span></span></th>
      <th>学习账号</th>
      <th>Unit1</th>
      <th>Unit2</th>
      <th>Unit3</th>
      <th class="learning-stage-col">阶段1</th>
      <th>Unit4</th>
      <th>Unit5</th>
      <th>Unit6</th>
      <th class="learning-stage-col">阶段2</th>
      <th>Unit7</th>
      <th>Unit8</th>
      <th>Unit9</th>
      <th class="learning-stage-col">阶段3</th>
      ${learningScoreScrollBufferCells("th")}
    </tr>
  `;
}

function renderLearningScoreMatrix() {
  if (!learningScoreRows || !learningScoreEmpty) return;
  const sourceRows = currentLearningBook()?.student_rows || [];
  const visibleStudentIds = new Set(sourceRows.map((student) => String(student.student_id || "").trim()).filter(Boolean));
  learningSelectedRosterStudentIds = new Set(
    [...learningSelectedRosterStudentIds].filter((studentId) => visibleStudentIds.has(studentId)),
  );
  const rows = sourceRows.map((student, index) => ({ student, index })).sort((left, right) => {
    const leftCompleted = Boolean(learningCompletionForStudent(left.student.student_id));
    const rightCompleted = Boolean(learningCompletionForStudent(right.student.student_id));
    if (leftCompleted !== rightCompleted) return leftCompleted ? 1 : -1;
    return left.index - right.index;
  }).map((item) => item.student);
  const hasAnyScore = rows.some(studentHasLearningScore);
  learningScoreEmpty.classList.toggle("is-hidden", hasAnyScore);
  renderLearningScoreHead(rows);
  const canWrite = Boolean(currentLearningClass()?.can_write);
  learningScoreRows.innerHTML = rows.map((student) => {
    const completion = learningCompletionForStudent(student.student_id);
    const completionBadge = completion
      ? `<span class="learning-completion-date">&#10003; ${escapeLearningText(completion.completed_label || completion.completed_date || "")}</span>`
      : "";
    const studentId = String(student.student_id || "").trim();
    const selectionControl = canWrite && studentId ? `
      <input class="learning-roster-select" type="checkbox" data-learning-roster-student="${escapeLearningText(studentId)}"
        aria-label="选择 ${escapeLearningText(student.name || "学员")}" ${learningSelectedRosterStudentIds.has(studentId) ? "checked" : ""}>
    ` : "";
    const firstStageCells = Array.from({ length: 3 }, (_, index) => {
      const score = (student.unit_scores || []).find((item) => Number(item.unit) === index + 1) || {};
      return `<td>${renderUnitScoreCell(score, student)}</td>`;
    }).join("");
    const secondStageCells = Array.from({ length: 3 }, (_, index) => {
      const unit = index + 4;
      const score = (student.unit_scores || []).find((item) => Number(item.unit) === unit) || {};
      return `<td>${renderUnitScoreCell(score, student)}</td>`;
    }).join("");
    const thirdStageCells = Array.from({ length: 3 }, (_, index) => {
      const unit = index + 7;
      const score = (student.unit_scores || []).find((item) => Number(item.unit) === unit) || {};
      return `<td>${renderUnitScoreCell(score, student)}</td>`;
    }).join("");
    return `
      <tr class="${studentHasLearningScore(student) ? "" : "is-empty-score-row"}${completion ? " is-learning-completed-row" : ""}">
        <td class="learning-sticky-name">
          <div class="learning-student-name-line">
            ${selectionControl}
            <input class="learning-student-name-input" data-learning-student-name="${escapeLearningText(student.student_id || "")}" data-original-name="${escapeLearningText(student.name || "")}" value="${escapeLearningText(student.name || "")}" aria-label="编辑学员姓名">
          </div>
          ${completionBadge}
        </td>
        <td>${escapeLearningText(student.account || "-")}</td>
        ${firstStageCells}
        <td class="learning-stage-col">${renderStageScoreCell(stageScoreForStudent(student, 1), student, 1)}</td>
        ${secondStageCells}
        <td class="learning-stage-col">${renderStageScoreCell(stageScoreForStudent(student, 2), student, 2)}</td>
        ${thirdStageCells}
        <td class="learning-stage-col">${renderStageScoreCell(stageScoreForStudent(student, 3), student, 3)}</td>
        ${learningScoreScrollBufferCells()}
      </tr>
    `;
  }).join("");
  syncLearningRemoveRosterButton(rows);
}

function findLearningStudent(studentId) {
  return (currentLearningBook()?.student_rows || []).find((student) => student.student_id === studentId) || null;
}

function findLearningUnitScore(student, unit) {
  return (student?.unit_scores || []).find((item) => Number(item.unit) === Number(unit)) || null;
}

function guideFieldText(kind, book, number, field) {
  if (kind === "unit") {
    return currentLearningGuide("unit", book, number)?.[field] || "";
  }
  const stageGuide = currentLearningGuide("stage", book, number) || {};
  if (["practice", "answer"].includes(field)) {
    return stageGuide[field] || "";
  }
  const values = stageUnitNumbers(number)
    .map((unit) => {
      const text = currentLearningGuide("unit", book, unit)?.[field] || "";
      return text ? `Unit${unit}\n${text}` : "";
    })
    .filter(Boolean);
  return values.join("\n\n") || stageGuide[field] || "";
}

function guideTextNode(field) {
  return {
    words: learningGuideWordsText,
    sentences: learningGuideSentencesText,
    grammar: learningGuideGrammarText,
    practice: learningGuidePracticeText,
    answer: learningGuideAnswerText,
  }[field];
}

function guideInputNode(field) {
  return {
    words: learningGuideWordsInput,
    sentences: learningGuideSentencesInput,
    grammar: learningGuideGrammarInput,
    practice: learningGuidePracticeInput,
    answer: learningGuideAnswerInput,
  }[field];
}

async function saveLearningStudentName(input) {
  const classData = currentLearningClass();
  const studentId = input?.dataset?.learningStudentName || "";
  const originalName = input?.dataset?.originalName || "";
  const name = String(input?.value || "").trim();
  if (!classData || !studentId) return;
  if (!name) {
    input.value = originalName;
    setLearningUploadStatus("学员姓名不能为空。", true);
    return;
  }
  if (name === originalName) return;
  input.disabled = true;
  setLearningUploadStatus("正在保存姓名...");
  try {
    const data = await learningApiRequest(`/api/learning-coaching/${encodeURIComponent(classData.id)}/students/${encodeURIComponent(studentId)}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
    if (data.class) {
      replaceLearningClassPayload(data.class);
    }
    setLearningUploadStatus("姓名已保存");
    renderLearningClassList();
    renderLearningScoreMatrix();
  } catch (error) {
    input.disabled = false;
    input.value = originalName;
    setLearningUploadStatus(error.message || "姓名保存失败。", true);
  }
}

function learningGuideSectionConfig() {
  return [
    { field: "words", label: "重点单词", textNode: learningGuideWordsText },
    { field: "sentences", label: "重点句型", textNode: learningGuideSentencesText },
    { field: "grammar", label: "重点语法", textNode: learningGuideGrammarText },
    { field: "practice", label: "培优题目", textNode: learningGuidePracticeText },
    { field: "answer", label: "留言", textNode: learningGuideAnswerText },
  ];
}

function setupLearningGuideSections() {
  learningGuideSectionConfig().forEach((config) => {
    const section = config.textNode?.closest("section");
    if (!section) return;
    section.classList.add("learning-guide-section");
    section.dataset.guideField = config.field;
    const heading = section.querySelector("h3");
    if (heading) {
      heading.textContent = config.label;
      heading.classList.add("learning-guide-toggle");
      heading.setAttribute("role", "button");
      heading.setAttribute("tabindex", "0");
    }
    if (config.field === "answer" && !section.querySelector("[data-copy-guide-message]")) {
      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.className = "ghost-button compact-button learning-guide-copy-button";
      copyButton.dataset.copyGuideMessage = "1";
      copyButton.textContent = "复制留言";
      config.textNode.insertAdjacentElement("afterend", copyButton);
    }
  });
}

function collapseLearningGuideSections() {
  document.querySelectorAll(".learning-guide-section").forEach((section) => {
    section.classList.add("is-collapsed");
  });
}

function toggleLearningGuideSection(target) {
  const section = target?.closest(".learning-guide-section");
  if (!section) return;
  section.classList.toggle("is-collapsed");
}

async function copyLearningGuideMessage() {
  const message = learningGuideMessage();
  try {
    await navigator.clipboard.writeText(message);
  } catch (error) {
    const textarea = document.createElement("textarea");
    textarea.value = message;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
  setLearningAppointmentStatus("留言已复制");
}

function guideEmptyText(kind, field) {
  if (kind === "stage" && ["words", "sentences", "grammar"].includes(field)) {
    return "管理员暂未上传该阶段对应单元的内容。";
  }
  return `管理员暂未上传${{
    words: "重点单词",
    sentences: "重点句型",
    grammar: "重点语法",
    practice: "培优题目",
    answer: "留言",
  }[field]}。`;
}

function renderLearningAppointmentControls() {
  const appointment = currentLearningAppointment();
  const completion = currentLearningCompletion();
  if (learningAppointmentDate) {
    learningAppointmentDate.value = appointment?.appointment_date || "";
  }
  if (learningAppointmentDone) {
    learningAppointmentDone.checked = Boolean(completion);
    learningAppointmentDone.disabled = Boolean(completion);
  }
  if (completion) {
    setLearningAppointmentStatus(`已完成：${completion.completed_label || completion.completed_date || ""}`);
  } else if (appointment?.appointment_date) {
    const label = appointment.appointment_label || appointment.appointment_date;
    setLearningAppointmentStatus(appointment.is_due ? `已到期：${label}` : `已预约：${label}`);
  } else {
    setLearningAppointmentStatus("未预约");
  }
}

function closeLearningGuide() {
  learningGuideContext = null;
  learningGuideModal?.classList.add("is-hidden");
  setLearningAppointmentStatus("");
}

function renderLearningGuideModal() {
  if (!learningGuideModal || !learningGuideContext) return;
  setupLearningGuideSections();
  const { student, score, kind } = learningGuideContext;
  const book = learningSelectedBook;
  const stage = Number(score.stage || 1);
  const number = kind === "stage" ? stage : Number(score.unit || 1);
  const stageScore = score.stage_score || {};
  const range = kind === "stage" ? (score.stage_range_label || stageRangeLabel(stage)) : `Unit${number}`;

  if (learningGuideMeta) {
    learningGuideMeta.textContent = `${student.name || "-"} · ${kind === "stage" ? "阶段测评" : "单元检测"} · ${range}`;
  }
  if (learningGuideTitle) {
    learningGuideTitle.textContent = kind === "stage"
      ? `${range} 阶段辅导详情`
      : `Unit${number} 辅导详情`;
  }
  if (learningGuideScoreSummary) {
    learningGuideScoreSummary.innerHTML = kind === "stage"
      ? `
        <article>
          <span>阶段测评</span>
          <strong>${escapeLearningText(scoreLine(score.stage_label || `阶段${stage}`, stageScore))}</strong>
        </article>
      `
      : `
        <article>
          <span>单元检测</span>
          <strong>${escapeLearningText(scoreLine(`Unit${score.unit}`, score))}</strong>
        </article>
        <article>
          <span>阶段测评</span>
          <strong>${escapeLearningText(scoreLine(score.stage_label || `阶段${stage}`, stageScore))}</strong>
        </article>
      `;
  }

  ["words", "sentences", "grammar", "practice"].forEach((field) => {
    const text = guideFieldText(kind, book, number, field);
    const textNode = guideTextNode(field);
    const inputNode = guideInputNode(field);
    if (textNode) {
      textNode.textContent = text || guideEmptyText(kind, field);
      textNode.classList.toggle("is-muted", !text);
    }
    if (inputNode) {
      inputNode.value = text;
      inputNode.classList.add("is-hidden");
    }
  });
  if (learningGuideAnswerText) {
    learningGuideAnswerText.textContent = learningGuideMessage();
    learningGuideAnswerText.classList.remove("is-muted");
  }
  learningGuideAnswerInput?.classList.add("is-hidden");
  collapseLearningGuideSections();
  renderLearningAppointmentControls();
  learningGuideModal.classList.remove("is-hidden");
}

function openLearningGuide(studentId, unit, stage, kind = "unit") {
  const classData = currentLearningClass();
  if (!classData?.in_coaching_cycle) return;
  const student = findLearningStudent(studentId);
  const score = kind === "stage"
    ? stageScoreForStudent(student, stage)
    : findLearningUnitScore(student, unit);
  const hasUnitScore = score?.score !== null && score?.score !== undefined;
  const hasStageScore = score?.stage_score?.score !== null && score?.stage_score?.score !== undefined;
  if (!student || !score || (!hasUnitScore && !hasStageScore)) return;
  learningGuideContext = { student, score, kind };
  renderLearningGuideModal();
}


async function saveLearningAppointment() {
  const payload = learningGuideAppointmentPayload();
  if (!payload) return;
  setLearningAppointmentStatus("正在保存...");
  if (learningAppointmentSave) learningAppointmentSave.disabled = true;
  try {
    const data = await learningApiRequest("/api/learning-coaching/appointments", {
      method: "PUT",
      body: JSON.stringify({
        ...payload,
        appointment_date: learningAppointmentDate?.value || "",
      }),
    });
    applyLearningAppointmentPayload(data);
    renderLearningAppointmentControls();
    renderLearningTodayAppointments();
    renderLearningCommunicationCalendar();
  } catch (error) {
    setLearningAppointmentStatus(error.message || "预约保存失败。", true);
  } finally {
    if (learningAppointmentSave) learningAppointmentSave.disabled = false;
  }
}

async function completeLearningAppointment() {
  if (!learningAppointmentDone?.checked) return;
  const payload = learningGuideAppointmentPayload();
  if (!payload) return;
  const appointment = currentLearningAppointment();
  setLearningAppointmentStatus("正在记录完成...");
  learningAppointmentDone.disabled = true;
  try {
    const data = await learningApiRequest("/api/learning-coaching/appointments/complete", {
      method: "POST",
      body: JSON.stringify(appointment?.key ? { key: appointment.key } : payload),
    });
    applyLearningAppointmentPayload(data);
    renderLearningAppointmentControls();
    renderLearningTodayAppointments();
    renderLearningCommunicationCalendar();
    renderLearningScoreMatrix();
    renderLearningClassList();
    const completion = currentLearningCompletion();
    setLearningAppointmentStatus(`已完成：${completion?.completed_label || completion?.completed_date || ""}`);
    closeLearningGuide();
  } catch (error) {
    setLearningAppointmentStatus(error.message || "完成记录失败。", true);
    learningAppointmentDone.checked = false;
  } finally {
    learningAppointmentDone.disabled = false;
  }
}

function renderLearningDetail() {
  const classData = currentLearningClass();
  learningEmptyState?.classList.toggle("is-hidden", Boolean(classData));
  learningDetail?.classList.toggle("is-hidden", !classData);
  if (learningUploadButton) learningUploadButton.disabled = !classData;
  if (learningResetRosterButton) {
    const canResetRoster = Boolean(classData?.can_write && Number(classData?.student_count || 0) > 0);
    learningResetRosterButton.classList.toggle("is-hidden", !canResetRoster);
    learningResetRosterButton.disabled = !canResetRoster;
  }
  syncLearningRemoveRosterButton();
  learningGuideUploadButton?.classList.toggle("is-hidden", !learningCoachingData.can_manage);
  if (!classData) return;

  const book = currentLearningBook();
  renderLearningTodayAppointments();
  renderLearningCommunicationCalendar();
  renderLearningRoundSettings();
  if (learningClassTitle) learningClassTitle.textContent = "";
  if (learningClassMeta) {
    learningClassMeta.textContent = "";
  }
  if (learningClassBadges) {
    learningClassBadges.innerHTML = "";
  }
  if (learningSelectedTitle) {
    learningSelectedTitle.textContent = `${book?.label || "上册"}单元检测分数`;
  }
  if (learningSelectedMeta) {
    learningSelectedMeta.textContent = "";
  }
  renderLearningBookTabs();
  renderLearningScoreMatrix();
}

function selectLearningClass(classId) {
  if (learningSelectedClassId !== classId) {
    learningSelectedRosterStudentIds.clear();
  }
  learningSelectedClassId = classId;
  setLearningUploadStatus("");
  renderLearningClassList();
  renderLearningDetail();
}

function syncLearningRemoveRosterButton(rows = null) {
  if (!learningRemoveRosterButton) return;
  const canWrite = Boolean(currentLearningClass()?.can_write);
  const selectedCount = learningSelectedRosterStudentIds.size;
  const showRemoveButton = canWrite && selectedCount > 0;
  learningRemoveRosterButton.classList.toggle("is-hidden", !showRemoveButton);
  learningRemoveRosterButton.disabled = !canWrite || selectedCount === 0;
  learningRemoveRosterButton.title = selectedCount ? `移除所选 ${selectedCount} 名学员` : "移除所选名单";
  learningRemoveRosterButton.setAttribute("aria-label", learningRemoveRosterButton.title);

  if (!learningRosterRemoveFrom) return;
  learningRosterRemoveFrom.classList.toggle("is-hidden", !canWrite);
  learningRosterRemoveFrom.disabled = !canWrite;
  const sourceRows = Array.isArray(rows) ? rows : (currentLearningBook()?.student_rows || []);
  learningRosterRemoveFrom.innerHTML = [
    '<option value="">从这位起批量选择</option>',
    ...sourceRows
      .filter((student) => String(student.student_id || "").trim())
      .map((student) => (
        `<option value="${escapeLearningText(student.student_id)}">${escapeLearningText(student.name || "未命名学员")} · ${escapeLearningText(student.account || "无账号")}</option>`
      )),
  ].join("");
}

function renderLearningCoaching() {
  if ((!learningSelectedClassId || !currentLearningClass()) && learningCoachingData.classes?.length) {
    const currentTeacherId = learningCurrentTeacherId();
    const preferredClass = learningCoachingData.can_manage && currentTeacherId
      ? learningCoachingData.classes.find((item) => item.teacher_id === currentTeacherId)
      : null;
    learningSelectedClassId = (preferredClass || learningCoachingData.classes[0]).id;
  }
  renderLearningClassList();
  renderLearningDetail();
}

async function uploadLearningScores(file) {
  const classData = currentLearningClass();
  if (!classData || !file) return;
  const formData = new FormData();
  formData.append("file", file);
  setLearningUploadStatus(`正在上传 ${file.name}...`);
  if (learningUploadButton) learningUploadButton.disabled = true;
  try {
    const data = await learningApiRequest(`/api/learning-coaching/${encodeURIComponent(classData.id)}/upload`, {
      method: "POST",
      body: formData,
    });
    if (data.class) {
      learningCoachingData.classes = (learningCoachingData.classes || []).map((item) => (
        item.id === data.class.id ? data.class : item
      ));
    }
    renderLearningCoaching();
    const result = data.result || {};
    const changed = Number(result.assessment_updated || 0);
    const total = Number(result.score_count || 0);
    const rosterAdded = Number(result.roster_added_count || 0);
    const rosterRemoved = Number(result.roster_removed_count || 0);
    const rosterNote = result.roster_initialized
      ? "已建立首次辅导名单。"
      : [
        rosterAdded ? `已新增 ${rosterAdded} 名学员。` : "",
        rosterRemoved ? `已移除 ${rosterRemoved} 名本次未获取到的名单。` : "",
      ].filter(Boolean).join(" ");
    const scoreNote = changed
      ? `已更新 ${changed} 条检测分数。`
      : `已读取 ${total} 条检测分数，暂无新增变化。`;
    setLearningUploadStatus(`${scoreNote}${rosterNote ? ` ${rosterNote}` : ""}`);
  } catch (error) {
    setLearningUploadStatus(error.message || "上传失败，请检查表格。", true);
  } finally {
    if (learningUploadButton) learningUploadButton.disabled = false;
    if (learningFileInput) learningFileInput.value = "";
  }
}

async function removeSelectedLearningRosterStudents() {
  const classData = currentLearningClass();
  const studentIds = [...learningSelectedRosterStudentIds];
  if (!classData || !classData.can_write || !studentIds.length) return;
  const confirmed = window.confirm(
    `确认从“${classData.name || "当前班级"}”的学情辅导名单移除 ${studentIds.length} 名学员吗？\n\n只会移除学情辅导中的名单、分数展示和预约；不会删除“我的班级”、完课或续费数据。`,
  );
  if (!confirmed) return;

  setLearningUploadStatus(`正在移除 ${studentIds.length} 名辅导名单...`);
  if (learningRemoveRosterButton) learningRemoveRosterButton.disabled = true;
  try {
    const data = await learningApiRequest(`/api/learning-coaching/${encodeURIComponent(classData.id)}/remove-roster-students`, {
      method: "POST",
      body: JSON.stringify({ student_ids: studentIds }),
    });
    replaceLearningClassPayload(data.class);
    learningSelectedRosterStudentIds.clear();
    renderLearningCoaching();
    const result = data.result || {};
    const removedCount = Number(result.removed_count || 0);
    const removedAppointments = Number(result.removed_appointments || 0);
    setLearningUploadStatus(
      `已移除 ${removedCount} 名错误名单${removedAppointments ? `，并清除 ${removedAppointments} 条对应预约` : ""}。`,
    );
  } catch (error) {
    setLearningUploadStatus(error.message || "名单移除失败，请稍后重试。", true);
  } finally {
    syncLearningRemoveRosterButton();
  }
}

async function resetLearningRoster() {
  const classData = currentLearningClass();
  if (!classData?.can_write) return;
  const confirmed = window.confirm(
    `确认重建“${classData.name || "当前班级"}”的辅导名单吗？\n\n这会清空学情辅导里的名单、已上传检测分数和预约/完成记录。不会影响“我的班级”、完课数据或续费数据。\n\n确认后请立即上传正确的完整班级表，系统会以新表重新建立名单基准。`,
  );
  if (!confirmed) return;

  setLearningUploadStatus("正在清空错误辅导名单...");
  if (learningResetRosterButton) learningResetRosterButton.disabled = true;
  try {
    const data = await learningApiRequest(`/api/learning-coaching/${encodeURIComponent(classData.id)}/reset-roster`, {
      method: "POST",
    });
    replaceLearningClassPayload(data.class);
    applyLearningAppointmentPayload(data);
    learningSelectedRosterStudentIds.clear();
    renderLearningCoaching();
    const result = data.result || {};
    setLearningUploadStatus(
      `已清空 ${Number(result.cleared_student_count || 0)} 名错误辅导名单${Number(result.removed_appointments || 0) ? `，并移除 ${Number(result.removed_appointments)} 条预约记录` : ""}。请上传正确表格重新建立名单。`,
    );
  } catch (error) {
    setLearningUploadStatus(error.message || "重建名单失败，请稍后重试。", true);
  } finally {
    if (learningResetRosterButton) learningResetRosterButton.disabled = false;
  }
}

async function uploadLearningGuides(file) {
  if (!file) return;
  const formData = new FormData();
  formData.append("file", file);
  setLearningUploadStatus(`正在上传辅导资料 ${file.name}...`);
  if (learningGuideUploadButton) learningGuideUploadButton.disabled = true;
  try {
    const data = await learningApiRequest("/api/learning-coaching/guides/upload", {
      method: "POST",
      body: formData,
    });
    learningCoachingData.guides = data.guides || learningCoachingData.guides || {};
    setLearningUploadStatus(`已更新 ${Number(data.count || 0)} 条辅导资料。`);
    if (learningGuideContext) renderLearningGuideModal();
  } catch (error) {
    setLearningUploadStatus(error.message || "辅导资料上传失败，请检查表格。", true);
  } finally {
    if (learningGuideUploadButton) learningGuideUploadButton.disabled = false;
    if (learningGuideUploadInput) learningGuideUploadInput.value = "";
  }
}

async function loadLearningCoaching(force = false) {
  if (learningHasLoaded && !force) return;
  if (learningClassStatus) learningClassStatus.textContent = "正在读取学情辅导数据...";
  try {
    learningCoachingData = await learningApiRequest("/api/learning-coaching");
    learningHasLoaded = true;
    renderLearningCoaching();
  } catch (error) {
    if (learningClassStatus) learningClassStatus.textContent = error.message;
    if (learningClassList) {
      learningClassList.innerHTML = `<div class="empty-state compact-empty">${escapeLearningText(error.message)}</div>`;
    }
  }
}

function openLearningAppointment(key) {
  const item = (learningCoachingData.today_appointments || []).find((row) => row.key === key)
    || learningCoachingData.appointments?.[key];
  if (!item) return;
  learningSelectedBook = item.book || "upper";
  selectLearningClass(item.class_id || "");
  const number = Number(item.number || 1);
  if (item.kind === "stage") {
    openLearningGuide(item.student_id || "", ((number - 1) * 3) + 1, number, "stage");
  } else {
    openLearningGuide(item.student_id || "", number, Math.max(1, Math.min(3, Math.ceil(number / 3))), "unit");
  }
}

learningClassSearch?.addEventListener("input", renderLearningClassList);
learningRefreshButton?.addEventListener("click", () => loadLearningCoaching(true));
learningUploadButton?.addEventListener("click", () => learningFileInput?.click());
learningFileInput?.addEventListener("change", () => {
  const file = learningFileInput.files?.[0];
  if (file) uploadLearningScores(file);
});
learningRemoveRosterButton?.addEventListener("click", removeSelectedLearningRosterStudents);
learningResetRosterButton?.addEventListener("click", resetLearningRoster);
learningRosterRemoveFrom?.addEventListener("change", () => {
  const startStudentId = String(learningRosterRemoveFrom.value || "").trim();
  if (!startStudentId) return;
  const displayedStudentIds = [...(learningScoreRows?.querySelectorAll("[data-learning-roster-student]") || [])]
    .map((input) => String(input.dataset.learningRosterStudent || "").trim())
    .filter(Boolean);
  const startIndex = displayedStudentIds.indexOf(startStudentId);
  if (startIndex < 0) return;
  learningSelectedRosterStudentIds = new Set(displayedStudentIds.slice(startIndex));
  renderLearningScoreMatrix();
});
learningGuideUploadButton?.addEventListener("click", () => learningGuideUploadInput?.click());
learningGuideUploadInput?.addEventListener("change", () => {
  const file = learningGuideUploadInput.files?.[0];
  if (file) uploadLearningGuides(file);
});
learningRoundToggle?.addEventListener("click", () => {
  learningRoundBody?.classList.toggle("is-hidden");
});
learningRoundAdd?.addEventListener("click", () => {
  const rounds = collectLearningRounds();
  const last = rounds[rounds.length - 1] || { deadline_week: 24 };
  rounds.push({
    id: `round-${Date.now()}`,
    name: `第${rounds.length + 1}轮辅导`,
    start_week: Number(last.deadline_week || 24) + 1,
    deadline_week: Number(last.deadline_week || 24) + 10,
  });
  learningCoachingData.coaching_rounds = rounds;
  renderLearningRoundSettings();
});
learningRoundSave?.addEventListener("click", saveLearningRounds);
learningRoundRows?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-round-remove]");
  if (!button) return;
  const removeIndex = Number(button.dataset.roundRemove || -1);
  const rounds = collectLearningRounds().filter((_, index) => index !== removeIndex);
  learningCoachingData.coaching_rounds = rounds.length ? rounds : defaultLearningRounds();
  renderLearningRoundSettings();
});
learningGuideClose?.addEventListener("click", closeLearningGuide);
learningAppointmentSave?.addEventListener("click", saveLearningAppointment);
learningAppointmentDone?.addEventListener("change", completeLearningAppointment);
learningGuideModal?.addEventListener("click", (event) => {
  const copyButton = event.target.closest("[data-copy-guide-message]");
  if (copyButton) {
    copyLearningGuideMessage();
    return;
  }
  const toggle = event.target.closest(".learning-guide-toggle");
  if (toggle) {
    toggleLearningGuideSection(toggle);
  }
});
learningGuideModal?.addEventListener("keydown", (event) => {
  if (!["Enter", " "].includes(event.key)) return;
  const toggle = event.target.closest(".learning-guide-toggle");
  if (!toggle) return;
  event.preventDefault();
  toggleLearningGuideSection(toggle);
});
learningGuideModal?.addEventListener("click", (event) => {
  if (event.target === learningGuideModal) closeLearningGuide();
});

learningTodayList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-appointment-key]");
  if (!button) return;
  openLearningAppointment(button.dataset.appointmentKey || "");
});

learningClassList?.addEventListener("click", (event) => {
  const toggle = event.target.closest("[data-learning-teacher-toggle]");
  if (toggle) {
    const teacherId = toggle.dataset.learningTeacherToggle || "";
    if (learningExpandedTeacherIds.has(teacherId)) {
      learningExpandedTeacherIds.delete(teacherId);
    } else {
      learningExpandedTeacherIds.add(teacherId);
    }
    renderLearningClassList();
    return;
  }
  const button = event.target.closest("[data-learning-class]");
  if (!button) return;
  selectLearningClass(button.dataset.learningClass || "");
});

learningScoreRows?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-learning-score]");
  if (!button) return;
  openLearningGuide(
    button.dataset.studentId || "",
    button.dataset.unit || "",
    button.dataset.stage || "",
    button.dataset.guideKind || "unit",
  );
});

learningScoreRows?.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-learning-roster-student]");
  if (!checkbox) return;
  const studentId = String(checkbox.dataset.learningRosterStudent || "").trim();
  if (!studentId) return;
  if (checkbox.checked) {
    learningSelectedRosterStudentIds.add(studentId);
  } else {
    learningSelectedRosterStudentIds.delete(studentId);
  }
  renderLearningScoreMatrix();
});

learningScoreHead?.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-learning-roster-select-all]");
  if (!checkbox) return;
  const studentIds = (currentLearningBook()?.student_rows || [])
    .map((student) => String(student.student_id || "").trim())
    .filter(Boolean);
  if (checkbox.checked) {
    studentIds.forEach((studentId) => learningSelectedRosterStudentIds.add(studentId));
  } else {
    studentIds.forEach((studentId) => learningSelectedRosterStudentIds.delete(studentId));
  }
  renderLearningScoreMatrix();
});

learningScoreRows?.addEventListener("focusout", (event) => {
  const input = event.target.closest("[data-learning-student-name]");
  if (!input) return;
  saveLearningStudentName(input);
});

learningScoreRows?.addEventListener("keydown", (event) => {
  const input = event.target.closest("[data-learning-student-name]");
  if (!input) return;
  if (event.key === "Enter") {
    event.preventDefault();
    input.blur();
  }
});

learningBookTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-learning-book]");
  if (!button) return;
  learningSelectedBook = button.dataset.learningBook || "upper";
  renderLearningDetail();
});

document.querySelector('[data-module="学情辅导"]')?.addEventListener("click", () => {
  loadLearningCoaching();
});

if (document.querySelector(".learning-coaching-module.is-active")) {
  loadLearningCoaching();
}
