const renewalAddForm = document.querySelector("#renewal-addForm");
const renewalClassSelect = document.querySelector("#renewal-classSelect");
const renewalStageSelect = document.querySelector("#renewal-stageSelect");
const renewalMessage = document.querySelector("#renewal-message");
const renewalTeacherPanel = document.querySelector("#renewal-teacherPanel");
const renewalTeacherList = document.querySelector("#renewal-teacherList");
const renewalTeacherActiveLabel = document.querySelector("#renewal-teacherActiveLabel");
const renewalStageBoard = document.querySelector("#renewal-stageBoard");
const renewalMenuButton = document.querySelector('.side-menu-item[data-module="续费"]');
const renewalMenuBadge = document.querySelector("#renewal-menuBadge");
const renewalAddPanel = document.querySelector(".renewal-add-panel");
const renewalDetailView = document.querySelector("#renewal-detailView");
const renewalBackButton = document.querySelector("#renewal-backButton");
const renewalDetailTitle = document.querySelector("#renewal-detailTitle");
const renewalDetailMeta = document.querySelector("#renewal-detailMeta");
const renewalDetailSummary = document.querySelector("#renewal-detailSummary");
const renewalStudentList = document.querySelector("#renewal-studentList");
const renewalWeekSelect = document.querySelector("#renewal-weekSelect");
const renewalHistoryUploadPanel = document.querySelector("#renewal-historyUploadPanel");
const renewalHistoryFileInput = document.querySelector("#renewal-historyFileInput");
const renewalHistoryUploadButton = document.querySelector("#renewal-historyUploadButton");

const RENEWAL_STAGE_DESCRIPTIONS = {
  "铺垫阶段": "提前建立续费认知，持续同步孩子学习收获。",
  "续报首月": "进入首月续报推进，重点跟进意向和顾虑。",
  "续报次月": "持续推进未转化班级，补足沟通和转化动作。",
  "结营续报": "结营前集中收口，完成续报确认和报名跟进。",
};
const RENEWAL_FIRST_MONTH_STAGE = "续报首月";
const RENEWAL_SECOND_MONTH_STAGE = "续报次月";
const RENEWAL_CLOSING_STAGE = "结营续报";
const RENEWAL_FOLLOWUP_STATUSES = ["愿意继续学", "需要考虑", "拒绝", "未接听"];
const RENEWAL_FOLLOWUP_METHODS = ["私信", "电话"];
const RENEWAL_LEADER_ACTION_TYPES = ["留言", "去电"];
const RENEWAL_BLOCKER_OPTIONS = ["升初中", "时间紧张", "经济", "学员问题", "线下", "效果不满意", "不知道顾虑", "不回复", "拒绝早报"];
const RENEWAL_ADD_BLOCKER_VALUE = "__add_current_blocker__";
const RENEWAL_WEEK_STORAGE_KEY = "pu6RenewalSelectedWeek";
const RENEWAL_MESSAGE_TALK_TYPE = "留言推荐";
const RENEWAL_ALL_TEACHERS = "__all_teachers__";
const RENEWAL_WEEKS = [
  { key: "1", label: "第一周" },
  { key: "2", label: "第二周" },
  { key: "3", label: "第三周" },
  { key: "4", label: "第四周" },
];

function isRenewalFourWeekStage(projectOrStage) {
  const stage = typeof projectOrStage === "string" ? projectOrStage : projectOrStage?.stage;
  return stage === RENEWAL_FIRST_MONTH_STAGE || stage === RENEWAL_SECOND_MONTH_STAGE;
}

function isRenewalSingleFollowupStage(projectOrStage) {
  const stage = typeof projectOrStage === "string" ? projectOrStage : projectOrStage?.stage;
  return stage === RENEWAL_CLOSING_STAGE;
}

let renewalData = null;
let draggedRenewalProjectId = "";
let renewalShowEnrolledStudents = false;
let renewalNoteTooltip = null;
let renewalActiveDetailProject = null;
let renewalActiveDetailData = null;
let renewalSelectedWeekKey = "";
let renewalSelectedTeacherId = RENEWAL_ALL_TEACHERS;
let renewalActiveNoteContext = null;
let renewalNoteHideTimer = null;
let renewalNoteEditorModal = null;
let renewalNoteEditorResolve = null;

function setRenewalMessage(message, isError = false) {
  if (!renewalMessage) return;
  renewalMessage.textContent = message || "";
  renewalMessage.classList.toggle("is-error", isError);
}

function escapeRenewalText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRenewalAttr(value) {
  return escapeRenewalText(value).replace(/\n/g, "&#10;");
}

async function renewalApiRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: options.body ? { "Content-Type": "application/json" } : {},
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "续费项目读取失败，请稍后重试。");
  }
  return data;
}

function renderRenewalClassOptions(classes = []) {
  if (!renewalClassSelect) return;
  renewalClassSelect.disabled = !classes.length;
  renewalClassSelect.innerHTML = classes.length
    ? [
      `<option value="">选择我的完课班级</option>`,
      ...classes.map((item) => {
        const teacherPrefix = renewalData?.can_manage_all && item.teacher_name ? `${item.teacher_name} · ` : "";
        const note = item.note ? `（${item.note}）` : "";
        return `
          <option value="${escapeRenewalText(item.id)}">
            ${escapeRenewalText(`${teacherPrefix}${item.name}${note}`)}
          </option>
        `;
      }),
    ].join("")
    : `<option value="">暂无可添加的完课班级</option>`;
}

function renderRenewalStageOptions(activeStage) {
  const stages = renewalData?.stages || Object.keys(RENEWAL_STAGE_DESCRIPTIONS);
  return stages.map((stage) => `
    <option value="${escapeRenewalText(stage)}"${stage === activeStage ? " selected" : ""}>
      ${escapeRenewalText(stage)}
    </option>
  `).join("");
}

function getRenewalTeacherOptions() {
  return Array.isArray(renewalData?.teacher_overview) ? renewalData.teacher_overview : [];
}

function getRenewalSelectedTeacher() {
  return getRenewalTeacherOptions().find((teacher) => teacher.teacher_id === renewalSelectedTeacherId) || null;
}

function ensureRenewalTeacherSelection() {
  if (!renewalData?.can_manage_all) {
    renewalSelectedTeacherId = RENEWAL_ALL_TEACHERS;
    return;
  }
  if (renewalSelectedTeacherId === RENEWAL_ALL_TEACHERS) return;
  const exists = getRenewalTeacherOptions().some((teacher) => teacher.teacher_id === renewalSelectedTeacherId);
  if (!exists) renewalSelectedTeacherId = RENEWAL_ALL_TEACHERS;
}

function renewalProjectsForActiveTeacher(projects = []) {
  if (!renewalData?.can_manage_all || renewalSelectedTeacherId === RENEWAL_ALL_TEACHERS) {
    return projects;
  }
  return projects.filter((project) => project.teacher_id === renewalSelectedTeacherId);
}

function renderRenewalTeacherCard(teacher) {
  const isActive = teacher.teacher_id === renewalSelectedTeacherId;
  const stageCounts = teacher.stage_counts || {};
  const pendingPlans = Number(teacher.pending_leader_plan_count || 0);
  const stageText = (renewalData?.stages || Object.keys(RENEWAL_STAGE_DESCRIPTIONS))
    .map((stage) => `${stage.replace("阶段", "").replace("续报", "")}${Number(stageCounts[stage] || 0)}`)
    .join(" · ");
  return `
    <button
      class="renewal-teacher-card${isActive ? " is-active" : ""}"
      type="button"
      data-renewal-teacher="${escapeRenewalText(teacher.teacher_id)}"
    >
      <strong>${escapeRenewalText(teacher.teacher_name || teacher.teacher_id || "未命名老师")}</strong>
      <span>${Number(teacher.project_count || 0)} 个续费班级 · ${Number(teacher.student_count || 0)} 名学员</span>
      <small${pendingPlans ? " class=\"has-pending\"" : ""}>${pendingPlans ? `待处理盘单 ${pendingPlans} 条` : `已报名 ${Number(teacher.enrolled_count || 0)} 人`}</small>
      <em>${escapeRenewalText(stageText)}</em>
    </button>
  `;
}

function renderRenewalTeacherPanel() {
  if (!renewalTeacherPanel || !renewalTeacherList) return;
  const shouldShow = Boolean(renewalData?.can_manage_all);
  renewalTeacherPanel.classList.toggle("is-hidden", !shouldShow);
  if (!shouldShow) {
    renewalTeacherList.innerHTML = "";
    return;
  }
  const teachers = getRenewalTeacherOptions();
  const projects = renewalData?.projects || [];
  const totalStudents = teachers.reduce((sum, teacher) => sum + Number(teacher.student_count || 0), 0);
  const totalEnrolled = teachers.reduce((sum, teacher) => sum + Number(teacher.enrolled_count || 0), 0);
  const totalPendingPlans = teachers.reduce((sum, teacher) => sum + Number(teacher.pending_leader_plan_count || 0), 0);
  const activeTeacher = getRenewalSelectedTeacher();
  if (renewalTeacherActiveLabel) {
    renewalTeacherActiveLabel.textContent = activeTeacher
      ? `当前：${activeTeacher.teacher_name || activeTeacher.teacher_id}`
      : "当前：全部老师";
  }
  renewalTeacherList.innerHTML = [
    `
      <button
        class="renewal-teacher-card renewal-teacher-card-all${renewalSelectedTeacherId === RENEWAL_ALL_TEACHERS ? " is-active" : ""}"
        type="button"
        data-renewal-teacher="${RENEWAL_ALL_TEACHERS}"
      >
        <strong>全部老师</strong>
        <span>${projects.length} 个续费班级 · ${totalStudents} 名学员</span>
        <small${totalPendingPlans ? " class=\"has-pending\"" : ""}>${totalPendingPlans ? `待处理盘单 ${totalPendingPlans} 条` : `已报名 ${totalEnrolled} 人`}</small>
        <em>查看整组续费跟进</em>
      </button>
    `,
    ...teachers.map(renderRenewalTeacherCard),
  ].join("");
}

function renderRenewalFollowupOptions(activeStatus) {
  const statuses = renewalData?.followup_statuses || RENEWAL_FOLLOWUP_STATUSES;
  return [
    `<option value="">选择跟进情况</option>`,
    ...statuses.map((status) => `
      <option value="${escapeRenewalText(status)}"${status === activeStatus ? " selected" : ""}>
        ${escapeRenewalText(status)}
      </option>
    `),
  ].join("");
}

function renderRenewalBlockerOptions(activeBlocker) {
  const blockers = renewalData?.blocker_options || RENEWAL_BLOCKER_OPTIONS;
  return [
    `<option value="">选择当前卡点</option>`,
    ...blockers.map((blocker) => `
      <option value="${escapeRenewalText(blocker)}"${blocker === activeBlocker ? " selected" : ""}>
        ${escapeRenewalText(blocker)}
      </option>
    `),
    ...(renewalData?.can_manage_all ? [`
      <option value="${RENEWAL_ADD_BLOCKER_VALUE}">＋ 新增当前卡点</option>
    `] : []),
  ].join("");
}

function normalizeRenewalTalkText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[，。！？、,.!?;；:"“”'‘’()（）【】\[\]]/g, "");
}

function splitRenewalTalkSearchTerms(keyword) {
  const terms = String(keyword || "")
    .split(/[\s,，、;；。.!！?？]+/)
    .map((term) => normalizeRenewalTalkText(term))
    .filter(Boolean);
  const compact = normalizeRenewalTalkText(keyword);
  if (!terms.length && compact) terms.push(compact);
  return Array.from(new Set(terms));
}

function getRenewalLibraryTalkTracks() {
  if (typeof window.getRenewalTalkTracks !== "function") return [];
  const tracks = window.getRenewalTalkTracks("续费", RENEWAL_MESSAGE_TALK_TYPE);
  return Array.isArray(tracks) ? tracks.filter((track) => track?.id && track?.text) : [];
}

function renewalTalkMatch(track, keyword) {
  const terms = splitRenewalTalkSearchTerms(keyword);
  const text = normalizeRenewalTalkText([
    track.text,
    track.keywords,
    track.scene,
  ].join(" "));
  const basePriority = Number(track.priority || 0);
  if (!terms.length) {
    return {
      matched: true,
      score: basePriority,
    };
  }
  if (!text) {
    return {
      matched: false,
      score: basePriority,
    };
  }
  let score = basePriority;
  const matched = terms.every((term) => {
    const index = text.indexOf(term);
    if (index === -1) return false;
    score += 120 - Math.min(index, 80);
    return true;
  });
  const compactQuery = normalizeRenewalTalkText(keyword);
  if (compactQuery && text.includes(compactQuery)) score += 80;
  return { matched, score };
}

function compactRenewalTalkLabel(value, maxLength = 34) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

function renewalTalkSnippet(track, keyword) {
  const source = String(track.text || "").replace(/\s+/g, " ").trim();
  const rawTerms = String(keyword || "")
    .split(/[\s,，、;；。.!！?？]+/)
    .map((term) => term.trim())
    .filter(Boolean);
  const hit = rawTerms.find((term) => source.includes(term));
  if (!source) return "";
  if (!hit) return compactRenewalTalkLabel(source, 26);
  const index = source.indexOf(hit);
  const start = Math.max(0, index - 10);
  const end = Math.min(source.length, index + hit.length + 16);
  return `${start > 0 ? "..." : ""}${source.slice(start, end)}${end < source.length ? "..." : ""}`;
}

function renewalTalkLabel(track, keyword = "") {
  const scene = track.scene || track.keywords || "续费话术";
  const snippet = String(keyword || "").trim() ? renewalTalkSnippet(track, keyword) : "";
  return compactRenewalTalkLabel(snippet ? `${scene} · ${snippet}` : scene, 46);
}

function renewalTalkMatchesSelected(track, student) {
  const selectedText = String(student?.leader_talk_text || "").trim();
  const selectedType = String(student?.leader_talk_type || "").trim();
  if (selectedType && selectedType !== RENEWAL_MESSAGE_TALK_TYPE) return false;
  if (!selectedText) return false;
  return selectedText === String(track.text || "").trim();
}

function renderRenewalTalkOptions(student, keyword) {
  const selectedTitle = String(student?.leader_talk_title || "").trim();
  const selectedText = String(student?.leader_talk_text || "").trim();
  const selectedType = String(student?.leader_talk_type || "").trim();
  const canUseSavedTalk = selectedText && selectedType === RENEWAL_MESSAGE_TALK_TYPE;
  const searchKeyword = String(keyword || student?.leader_talk_keyword || student?.leader_note || "").trim();
  const sourceTracks = getRenewalLibraryTalkTracks();
  const scoredTracks = sourceTracks
    .map((track) => ({ track, ...renewalTalkMatch(track, searchKeyword) }))
    .sort((a, b) => (b.score - a.score) || (Number(b.track.priority || 0) - Number(a.track.priority || 0)));
  const matchedTracks = searchKeyword
    ? scoredTracks.filter((item) => item.matched)
    : scoredTracks;
  const tracks = matchedTracks
    .slice(0, 32)
    .map((item) => item.track);

  const selectedInOptions = canUseSavedTalk && tracks.some((track) => renewalTalkMatchesSelected(track, student));
  const savedOption = canUseSavedTalk && !selectedInOptions ? `
    <option value="__saved_talk__" selected>${escapeRenewalText(compactRenewalTalkLabel(selectedTitle || "已选话术"))}</option>
  ` : "";
  const emptyText = !sourceTracks.length
    ? "暂无留言推荐"
    : searchKeyword && !matchedTracks.length
      ? "没有匹配留言"
      : "选择留言话术";

  return [
    `<option value="">${escapeRenewalText(emptyText)}</option>`,
    savedOption,
    ...tracks.map((track) => `
      <option
        value="${escapeRenewalText(track.id)}"
        ${renewalTalkMatchesSelected(track, student) ? " selected" : ""}
      >${escapeRenewalText(renewalTalkLabel(track, searchKeyword))}</option>
    `),
  ].join("");
}

function findRenewalTalkTrackById(trackId) {
  return getRenewalLibraryTalkTracks().find((track) => track.id === trackId) || null;
}

function refreshRenewalTalkSelectOptions(input) {
  const plan = input?.closest(".renewal-leader-plan");
  const select = plan?.querySelector("[data-renewal-leader-talk]");
  if (!select) return;
  const previousValue = select.value;
  const savedKeyword = select.dataset.renewalTalkKeyword || "";
  const shouldKeepSelection = String(input.value || "").trim() === String(savedKeyword || "").trim();
  const selectedStudent = {
    leader_talk_title: shouldKeepSelection ? select.dataset.renewalTalkTitle || "" : "",
    leader_talk_text: shouldKeepSelection ? select.dataset.renewalTalkText || "" : "",
    leader_talk_type: shouldKeepSelection ? select.dataset.renewalTalkType || "" : "",
    leader_talk_keyword: input.value,
    leader_note: input.value,
  };
  select.innerHTML = renderRenewalTalkOptions(selectedStudent, input.value);
  if (Array.from(select.options).some((option) => option.value === previousValue)) {
    select.value = previousValue;
  }
}

async function copyRenewalText(text, button, resetLabel = "复制") {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const fallback = document.createElement("textarea");
    fallback.value = text;
    document.body.appendChild(fallback);
    fallback.select();
    document.execCommand("copy");
    fallback.remove();
  }
  if (!button) return;
  button.textContent = "已复制";
  setTimeout(() => {
    button.textContent = resetLabel;
  }, 1200);
}

function renderRenewalWeekSelect(project) {
  if (!renewalWeekSelect) return;
  const picker = renewalWeekSelect.closest(".renewal-week-picker");
  const shouldShow = isRenewalFourWeekStage(project);
  picker?.classList.toggle("is-hidden", !shouldShow);
  renewalWeekSelect.disabled = !shouldShow;
  if (!shouldShow) return;
  const activeWeekKey = getRenewalSelectedWeekKey();
  renewalWeekSelect.innerHTML = RENEWAL_WEEKS.map((week) => `
    <option value="${escapeRenewalText(week.key)}"${week.key === activeWeekKey ? " selected" : ""}>
      ${escapeRenewalText(week.label)}
    </option>
  `).join("");
}

function formatRenewalRate(value) {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  if (Number.isNaN(number)) return "-";
  return `${number.toFixed(1).replace(/\.0$/, "")}%`;
}

function todayRenewalDateValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function getRenewalCurrentWeekKey(date = new Date()) {
  const day = Number(date.getDate()) || 1;
  const weekIndex = Math.min(RENEWAL_WEEKS.length, Math.max(1, Math.ceil(day / 7)));
  return String(weekIndex);
}

function isValidRenewalWeekKey(weekKey) {
  return RENEWAL_WEEKS.some((week) => week.key === String(weekKey));
}

function getSavedRenewalWeekKey() {
  try {
    const savedWeek = window.localStorage?.getItem(RENEWAL_WEEK_STORAGE_KEY);
    if (isValidRenewalWeekKey(savedWeek)) return savedWeek;
  } catch (error) {
    // Ignore storage issues and fall back to the date-based default.
  }
  return getRenewalCurrentWeekKey();
}

function getRenewalSelectedWeekKey() {
  if (!isValidRenewalWeekKey(renewalSelectedWeekKey)) {
    renewalSelectedWeekKey = getSavedRenewalWeekKey();
  }
  return renewalSelectedWeekKey;
}

function setRenewalSelectedWeekKey(weekKey) {
  const nextWeekKey = isValidRenewalWeekKey(weekKey) ? String(weekKey) : getRenewalCurrentWeekKey();
  renewalSelectedWeekKey = nextWeekKey;
  try {
    window.localStorage?.setItem(RENEWAL_WEEK_STORAGE_KEY, nextWeekKey);
  } catch (error) {
    // The selector should still work even if the browser blocks storage.
  }
  return nextWeekKey;
}

function getRenewalWeekInfo(student, weekKey) {
  return student.weekly_followups?.[weekKey] || {
    latest_date: "",
    latest_date_label: "",
    latest_methods: [],
    count: 0,
    records: [],
  };
}

function getRenewalGeneralInfo(student) {
  return student.general_followup || {
    latest_date: "",
    latest_date_label: "",
    latest_methods: [],
    count: 0,
    records: [],
  };
}

function buildRenewalWeekHistory(records = []) {
  if (!records.length) return "暂无跟进记录";
  return records
    .map((record, index) => {
      const date = record.date_label || record.date || "-";
      const methods = (record.methods || []).join("、") || "-";
      return `${index + 1}. ${date} ${methods}`;
    })
    .join("\n");
}

function ensureRenewalNoteTooltip() {
  if (renewalNoteTooltip) return renewalNoteTooltip;
  renewalNoteTooltip = document.createElement("div");
  renewalNoteTooltip.className = "renewal-note-tooltip";
  renewalNoteTooltip.addEventListener("mouseenter", () => {
    if (renewalNoteHideTimer) {
      clearTimeout(renewalNoteHideTimer);
      renewalNoteHideTimer = null;
    }
  });
  renewalNoteTooltip.addEventListener("dblclick", (event) => {
    event.preventDefault();
    if (!renewalActiveNoteContext) return;
    editRenewalNoteText(
      renewalActiveNoteContext.projectId,
      renewalActiveNoteContext.studentId,
      renewalActiveNoteContext.noteText
    );
  });
  renewalNoteTooltip.addEventListener("mouseleave", hideRenewalNameNote);
  document.body.appendChild(renewalNoteTooltip);
  return renewalNoteTooltip;
}

function showRenewalNameNote(target) {
  if (renewalNoteHideTimer) {
    clearTimeout(renewalNoteHideTimer);
    renewalNoteHideTimer = null;
  }
  const note = target?.dataset?.renewalNoteText || target?.dataset?.renewalNameNote || "暂无备注";
  const tooltip = ensureRenewalNoteTooltip();
  const canEdit = Boolean(target?.dataset?.renewalNoteCard);
  renewalActiveNoteContext = canEdit ? {
    projectId: target.dataset.renewalNoteCard,
    studentId: target.dataset.renewalStudentId,
    noteText: note,
  } : null;
  tooltip.classList.remove("is-wide", "is-editable");
  tooltip.classList.toggle("is-editable", canEdit);
  tooltip.title = canEdit ? "双击编辑备注" : "";
  tooltip.textContent = note;
  tooltip.classList.add("is-visible");
  const rect = target.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const top = Math.max(8, Math.min(window.innerHeight - tooltipRect.height - 8, rect.top + (rect.height - tooltipRect.height) / 2));
  let left = rect.left - tooltipRect.width - 12;
  if (left < 8) left = 8;
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function showRenewalTalkPreview(target) {
  const text = target?.dataset?.renewalTalkPreview || "暂无选定话术";
  const tooltip = ensureRenewalNoteTooltip();
  renewalActiveNoteContext = null;
  tooltip.classList.remove("is-editable");
  tooltip.classList.add("is-wide");
  tooltip.title = "";
  tooltip.textContent = text;
  tooltip.classList.add("is-visible");
  const rect = target.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const top = Math.max(8, Math.min(window.innerHeight - tooltipRect.height - 8, rect.top));
  let left = rect.right + 12;
  if (left + tooltipRect.width > window.innerWidth - 8) {
    left = Math.max(8, rect.left - tooltipRect.width - 12);
  }
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function hideRenewalNameNote() {
  if (renewalNoteHideTimer) {
    clearTimeout(renewalNoteHideTimer);
    renewalNoteHideTimer = null;
  }
  renewalNoteTooltip?.classList.remove("is-visible", "is-wide");
  renewalNoteTooltip?.classList.remove("is-editable");
  renewalActiveNoteContext = null;
}

function scheduleRenewalNameNoteHide() {
  if (renewalNoteHideTimer) clearTimeout(renewalNoteHideTimer);
  renewalNoteHideTimer = setTimeout(hideRenewalNameNote, 450);
}

function closeRenewalNoteEditor(value = null) {
  if (!renewalNoteEditorModal) return;
  renewalNoteEditorModal.classList.remove("is-visible");
  document.body.classList.remove("renewal-note-editor-open");
  const resolve = renewalNoteEditorResolve;
  renewalNoteEditorResolve = null;
  if (resolve) resolve(value);
}

function ensureRenewalNoteEditor() {
  if (renewalNoteEditorModal) return renewalNoteEditorModal;
  renewalNoteEditorModal = document.createElement("div");
  renewalNoteEditorModal.className = "renewal-note-editor-modal";
  renewalNoteEditorModal.innerHTML = `
    <div class="renewal-note-editor-card" role="dialog" aria-modal="true" aria-labelledby="renewal-note-editor-title">
      <div class="renewal-note-editor-head">
        <strong id="renewal-note-editor-title">编辑备注</strong>
        <button class="renewal-note-editor-close" type="button" data-renewal-note-editor-cancel aria-label="关闭">×</button>
      </div>
      <textarea class="renewal-note-editor-textarea" maxlength="500"></textarea>
      <div class="renewal-note-editor-actions">
        <button class="ghost-button compact-button" type="button" data-renewal-note-editor-cancel>取消</button>
        <button class="primary-button compact-button" type="button" data-renewal-note-editor-save>保存</button>
      </div>
    </div>
  `;
  const textarea = renewalNoteEditorModal.querySelector(".renewal-note-editor-textarea");
  renewalNoteEditorModal.addEventListener("click", (event) => {
    if (event.target === renewalNoteEditorModal || event.target.closest("[data-renewal-note-editor-cancel]")) {
      closeRenewalNoteEditor(null);
      return;
    }
    if (event.target.closest("[data-renewal-note-editor-save]")) {
      closeRenewalNoteEditor(textarea.value);
    }
  });
  renewalNoteEditorModal.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeRenewalNoteEditor(null);
    }
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      closeRenewalNoteEditor(textarea.value);
    }
  });
  document.body.appendChild(renewalNoteEditorModal);
  return renewalNoteEditorModal;
}

function openRenewalNoteEditor(previousText = "") {
  ensureRenewalNoteEditor();
  if (renewalNoteEditorResolve) {
    closeRenewalNoteEditor(null);
  }
  const textarea = renewalNoteEditorModal.querySelector(".renewal-note-editor-textarea");
  textarea.value = previousText || "";
  renewalNoteEditorModal.classList.add("is-visible");
  document.body.classList.add("renewal-note-editor-open");
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.selectionStart = textarea.value.length;
    textarea.selectionEnd = textarea.value.length;
  });
  return new Promise((resolve) => {
    renewalNoteEditorResolve = resolve;
  });
}

function renderRenewalEnrolledToggle(project, student, disabledAttr, compact = false) {
  return `
    <label
      class="renewal-enrolled-toggle${compact ? " renewal-name-enrolled-toggle" : ""}"
      title="${student.enrolled ? "已报名" : "标记为已报名"}"
    >
      <input
        type="checkbox"
        data-renewal-enrolled="${escapeRenewalText(project.id)}"
        data-renewal-student-id="${escapeRenewalText(student.id)}"
        ${student.enrolled ? "checked" : ""}
        ${disabledAttr}
      >
      ${compact ? "" : `<span>${student.enrolled ? "已报" : "未报"}</span>`}
    </label>
  `;
}

function renderRenewalStudentNameCell(project, student, disabledAttr, extraClass = "") {
  const noteText = String(student.followup_note || "").trim();
  const noteCard = noteText ? `
    <button
      class="renewal-name-note-card"
      type="button"
      data-renewal-note-card="${escapeRenewalText(project.id)}"
      data-renewal-student-id="${escapeRenewalText(student.id)}"
      data-renewal-note-text="${escapeRenewalAttr(noteText)}"
      aria-label="查看备注，双击浮层编辑"
      title="查看备注"
      ${disabledAttr}
    ></button>
  ` : "";
  return `
    <td
      class="database-strong-cell renewal-student-name-hover renewal-student-name-cell ${extraClass}"
      data-renewal-name-note="${escapeRenewalAttr(student.followup_note || "暂无备注")}"
    >
      <span class="renewal-student-name-line">
        <span class="renewal-student-name-text">${escapeRenewalText(student.name || "-")}</span>
      </span>
      ${noteCard}
      ${renderRenewalEnrolledToggle(project, student, disabledAttr, true)}
    </td>
  `;
}

function renderRenewalWeekTime(student, weekKey) {
  const weekInfo = getRenewalWeekInfo(student, weekKey);
  const history = buildRenewalWeekHistory(weekInfo.records || []);
  return `<span class="renewal-week-time" title="${escapeRenewalAttr(history)}">${escapeRenewalText(weekInfo.latest_date_label || "-")}</span>`;
}

function renderRenewalWeekMethods(project, student, weekKey, disabledAttr) {
  const methods = renewalData?.followup_methods || RENEWAL_FOLLOWUP_METHODS;
  const weekInfo = getRenewalWeekInfo(student, weekKey);
  const latestMethods = weekInfo.latest_methods || [];
  const history = buildRenewalWeekHistory(weekInfo.records || []);
  return `
    <div class="renewal-method-options" title="${escapeRenewalAttr(history)}">
      <div class="renewal-method-checks">
        ${methods.map((method) => `
          <label>
            <input
              type="checkbox"
              value="${escapeRenewalText(method)}"
              data-renewal-week-method="${escapeRenewalText(project.id)}"
              data-renewal-student-id="${escapeRenewalText(student.id)}"
              data-renewal-week="${escapeRenewalText(weekKey)}"
              ${latestMethods.includes(method) ? "checked" : ""}
              ${disabledAttr}
            >
            <span>${escapeRenewalText(method)}</span>
          </label>
        `).join("")}
      </div>
      <button
        class="ghost-button compact-button renewal-week-save"
        type="button"
        data-renewal-week-save="${escapeRenewalText(project.id)}"
        data-renewal-student-id="${escapeRenewalText(student.id)}"
        data-renewal-week="${escapeRenewalText(weekKey)}"
        ${disabledAttr}
      >记录</button>
    </div>
  `;
}

function renderRenewalWeekCount(student, weekKey) {
  const weekInfo = getRenewalWeekInfo(student, weekKey);
  const history = buildRenewalWeekHistory(weekInfo.records || []);
  return `<span class="renewal-followup-count" title="${escapeRenewalAttr(history)}">${Number(weekInfo.count || 0)}</span>`;
}

function renderRenewalGeneralTime(student) {
  const followupInfo = getRenewalGeneralInfo(student);
  const history = buildRenewalWeekHistory(followupInfo.records || []);
  return `<span class="renewal-week-time" title="${escapeRenewalAttr(history)}">${escapeRenewalText(followupInfo.latest_date_label || "-")}</span>`;
}

function renderRenewalGeneralMethods(project, student, disabledAttr) {
  const methods = renewalData?.followup_methods || RENEWAL_FOLLOWUP_METHODS;
  const followupInfo = getRenewalGeneralInfo(student);
  const latestMethods = followupInfo.latest_methods || [];
  const history = buildRenewalWeekHistory(followupInfo.records || []);
  return `
    <div class="renewal-method-options" title="${escapeRenewalAttr(history)}">
      <div class="renewal-method-checks">
        ${methods.map((method) => `
          <label>
            <input
              type="checkbox"
              value="${escapeRenewalText(method)}"
              data-renewal-general-method="${escapeRenewalText(project.id)}"
              data-renewal-student-id="${escapeRenewalText(student.id)}"
              ${latestMethods.includes(method) ? "checked" : ""}
              ${disabledAttr}
            >
            <span>${escapeRenewalText(method)}</span>
          </label>
        `).join("")}
      </div>
      <button
        class="ghost-button compact-button renewal-week-save"
        type="button"
        data-renewal-general-save="${escapeRenewalText(project.id)}"
        data-renewal-student-id="${escapeRenewalText(student.id)}"
        ${disabledAttr}
      >记录</button>
    </div>
  `;
}

function renderRenewalGeneralCount(student) {
  const followupInfo = getRenewalGeneralInfo(student);
  const history = buildRenewalWeekHistory(followupInfo.records || []);
  return `<span class="renewal-followup-count" title="${escapeRenewalAttr(history)}">${Number(followupInfo.count || 0)}</span>`;
}

function renderRenewalCollapsedWeek(student, weekKey) {
  const weekInfo = getRenewalWeekInfo(student, weekKey);
  const history = buildRenewalWeekHistory(weekInfo.records || []);
  const count = Number(weekInfo.count || 0);
  const latestDate = weekInfo.latest_date_label ? `最新 ${weekInfo.latest_date_label}` : "暂无记录";
  return `
    <span
      class="renewal-week-collapsed-pill${count ? " has-records" : ""}"
      title="${escapeRenewalAttr(history)}"
    >
      ${count ? `${count}次` : "-"}
      <small>${escapeRenewalText(latestDate)}</small>
    </span>
  `;
}

function renderRenewalRemarkCell(project, student, disabledAttr) {
  return `
    <td class="renewal-current-note-cell">
      <div class="renewal-note-compose">
        <input
          class="renewal-followup-note"
          type="text"
          value=""
          placeholder="备注"
          data-renewal-followup-note="${escapeRenewalText(project.id)}"
          data-renewal-student-id="${escapeRenewalText(student.id)}"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
          ${disabledAttr}
        >
      </div>
    </td>
  `;
}

function renderRenewalWeekCells(project, student, week, currentWeekKey, disabledAttr) {
  if (week.key !== currentWeekKey) {
    return `
      <td class="renewal-week-collapsed-cell">
        ${renderRenewalCollapsedWeek(student, week.key)}
      </td>
    `;
  }
  return `
    <td>${renderRenewalWeekTime(student, week.key)}</td>
    <td>${renderRenewalWeekMethods(project, student, week.key, disabledAttr)}</td>
    <td>${renderRenewalWeekCount(student, week.key)}</td>
    ${renderRenewalRemarkCell(project, student, disabledAttr)}
  `;
}

function renderRenewalLeaderPlanCell(project, student, disabledAttr) {
  const canManage = Boolean(renewalData?.can_manage_all);
  const leaderActionType = RENEWAL_LEADER_ACTION_TYPES.includes(student.leader_action_type) ? student.leader_action_type : "留言";
  const isCallPlan = leaderActionType === "去电";
  const leaderNote = student.leader_note || "";
  const leaderTalkTitle = student.leader_talk_title || "";
  const leaderTalkType = student.leader_talk_type || "";
  const rawLeaderTalkText = student.leader_talk_text || "";
  const leaderTalkText = leaderTalkType === RENEWAL_MESSAGE_TALK_TYPE ? rawLeaderTalkText : "";
  const leaderTalkKeyword = student.leader_talk_keyword || leaderNote;
  const leaderSearchValue = leaderTalkText ? "" : leaderNote;
  const hasLeaderPlan = Boolean(leaderNote || leaderTalkText || isCallPlan);
  if (!canManage && !hasLeaderPlan) {
    return `<td class="renewal-leader-plan-cell is-empty"></td>`;
  }
  const leaderActionBadge = isCallPlan
    ? `<span class="renewal-leader-action-badge is-call">去电</span>`
    : `<span class="renewal-leader-action-badge">留言</span>`;
  const teacherLeaderNoteText = leaderNote || (leaderTalkText ? "这里有留言需跟进" : isCallPlan ? "组长建议去电了解情况" : "");
  const isDone = Boolean(student.leader_note_done);
  const adminPlanStatus = isDone ? "已完成" : hasLeaderPlan ? "待跟进" : "未设置";
  const doneTitle = student.leader_note_done
    ? `已完成${student.leader_note_done_at ? `：${student.leader_note_done_at}` : ""}`
    : "按盘单跟进完成后勾选";
  const teacherDoneControl = hasLeaderPlan && !canManage && !isDone ? `
    <label class="renewal-leader-done is-inline" title="${escapeRenewalAttr(doneTitle)}">
      <input
        type="checkbox"
        data-renewal-leader-done="${escapeRenewalText(project.id)}"
        data-renewal-student-id="${escapeRenewalText(student.id)}"
        ${disabledAttr}
      >
      <span>完成</span>
    </label>
  ` : "";
  const teacherPlanDetail = !canManage && hasLeaderPlan && !isDone ? `
    <details class="renewal-teacher-plan-detail">
      <summary>${leaderTalkText ? "查看话术" : "查看说明"}</summary>
      <div class="renewal-leader-note-text${hasLeaderPlan ? "" : " is-empty"}"${leaderTalkText ? ` data-renewal-talk-preview="${escapeRenewalAttr(leaderTalkText)}"` : ""}>
        ${escapeRenewalText(teacherLeaderNoteText)}
      </div>
      ${leaderTalkText ? `
        <div class="renewal-leader-talk-preview" data-renewal-talk-preview="${escapeRenewalAttr(leaderTalkText)}">
          <span>${escapeRenewalText(leaderTalkTitle || "已选话术")}</span>
          <button
            class="ghost-button compact-button renewal-talk-copy"
            type="button"
            data-renewal-copy-talk="${escapeRenewalAttr(leaderTalkText)}"
          >复制</button>
        </div>
      ` : ""}
    </details>
  ` : "";
  const noteContent = canManage ? `
    <details class="renewal-leader-editor">
      <summary class="renewal-leader-editor-summary">
        <span class="renewal-leader-summary-main">
          ${hasLeaderPlan ? leaderActionBadge : `<span class="renewal-leader-action-badge is-muted">盘单</span>`}
          <strong>${escapeRenewalText(adminPlanStatus)}</strong>
        </span>
        <span class="renewal-leader-edit-text">${hasLeaderPlan ? "编辑" : "添加"}</span>
      </summary>
      <div class="renewal-leader-admin-fields">
        <select
          class="renewal-leader-action-select"
          data-renewal-leader-action="${escapeRenewalText(project.id)}"
          data-renewal-student-id="${escapeRenewalText(student.id)}"
          title="选择组员需要执行的盘单动作"
          ${disabledAttr}
        >
          ${RENEWAL_LEADER_ACTION_TYPES.map((actionType) => `
            <option value="${escapeRenewalText(actionType)}"${leaderActionType === actionType ? " selected" : ""}>${escapeRenewalText(actionType)}</option>
          `).join("")}
        </select>
        <input
          class="renewal-leader-note-input"
          type="text"
          value="${escapeRenewalText(leaderSearchValue)}"
          data-renewal-leader-note="${escapeRenewalText(project.id)}"
          data-renewal-student-id="${escapeRenewalText(student.id)}"
          placeholder="关键词匹配留言"
          title="${escapeRenewalAttr("只用于筛选留言推荐，选中话术后会自动清空")}"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
          ${disabledAttr}
        >
        <select
          class="renewal-leader-talk-select"
          data-renewal-leader-talk="${escapeRenewalText(project.id)}"
          data-renewal-student-id="${escapeRenewalText(student.id)}"
          data-renewal-talk-title="${escapeRenewalAttr(leaderTalkTitle)}"
          data-renewal-talk-text="${escapeRenewalAttr(leaderTalkText)}"
          data-renewal-talk-type="${escapeRenewalAttr(leaderTalkType)}"
          data-renewal-talk-keyword="${escapeRenewalAttr(leaderTalkKeyword)}"
          ${disabledAttr}
        >
          ${renderRenewalTalkOptions(student, leaderTalkKeyword)}
        </select>
      </div>
    </details>
  ` : isDone && hasLeaderPlan ? `
    <div class="renewal-leader-done-summary">
      <strong>已完成</strong>
      <small>${escapeRenewalText(student.leader_note_done_at || "")}</small>
    </div>
  ` : `
    <div class="renewal-teacher-plan-summary">
      <span class="renewal-teacher-plan-main">
        ${leaderActionBadge}
        <strong>待跟进</strong>
      </span>
      ${teacherDoneControl}
    </div>
    ${teacherPlanDetail}
  `;
  return `
    <td class="renewal-leader-plan-cell">
      <div class="renewal-leader-plan${isDone ? " is-done" : ""}${hasLeaderPlan && !isDone ? " has-reminder" : ""}${!hasLeaderPlan ? " is-empty" : ""}${!canManage ? " is-teacher-view" : ""}">
        ${noteContent}
      </div>
    </td>
  `;
}

function renderRenewalProjectCard(project) {
  const classNote = project.class_note ? `<small>备注：${escapeRenewalText(project.class_note)}</small>` : "";
  const missingMark = project.class_missing ? `<em class="renewal-warning">班级已不在完课列表</em>` : "";
  const activityMark = project.completion_activity ? `<em class="renewal-activity-badge">完课活动班级</em>` : "";
  const pendingPlans = Number(project.pending_leader_plan_count || 0);
  const pendingPlanMark = pendingPlans ? `<em class="renewal-plan-reminder-badge">待处理盘单 ${pendingPlans}</em>` : "";
  const badges = [pendingPlanMark, activityMark, missingMark].filter(Boolean).join("");
  const disabledAttr = project.can_edit ? "" : "disabled";
  const dragAttr = project.can_edit ? ` draggable="true" title="按住拖动到其他阶段"` : "";
  return `
    <article
      class="renewal-project-card"
      data-renewal-project="${escapeRenewalText(project.id)}"
      data-renewal-current-stage="${escapeRenewalText(project.stage)}"
      ${dragAttr}
    >
      <div class="renewal-project-head">
        <div>
          <strong>${escapeRenewalText(project.class_name || "未命名班级")}</strong>
          ${classNote}
        </div>
        ${badges ? `<div class="renewal-project-badges">${badges}</div>` : ""}
      </div>
      <div class="renewal-data-card">
        <div>
          <span>续费人数</span>
          <strong>${Number(project.student_count || 0)}</strong>
          <small>完课当前 ${Number(project.source_student_count || 0)} 人</small>
        </div>
        <div>
          <span>已报名</span>
          <strong>${Number(project.enrolled_count || 0)}</strong>
        </div>
        <div>
          <span>续报率</span>
          <strong>${escapeRenewalText(formatRenewalRate(project.renewal_rate))}</strong>
        </div>
      </div>
      <div class="renewal-card-actions">
        <button class="ghost-button compact-button" type="button" data-renewal-open="${escapeRenewalText(project.id)}">进入跟进</button>
        <button class="danger-button compact-button" type="button" data-renewal-delete="${escapeRenewalText(project.id)}" ${disabledAttr}>移出项目</button>
      </div>
    </article>
  `;
}

function renderRenewalBoard(projects = []) {
  if (!renewalStageBoard) return;
  const stages = renewalData?.stages || Object.keys(RENEWAL_STAGE_DESCRIPTIONS);
  renewalStageBoard.innerHTML = stages.map((stage) => {
    const stageProjects = projects.filter((project) => project.stage === stage);
    return `
      <section class="renewal-stage-column" data-renewal-stage-column="${escapeRenewalText(stage)}">
        <header>
          <div>
            <h2>${escapeRenewalText(stage)}</h2>
            <p>${escapeRenewalText(RENEWAL_STAGE_DESCRIPTIONS[stage] || "")}</p>
          </div>
          <strong>${stageProjects.length}</strong>
        </header>
        <div class="renewal-project-list">
          ${stageProjects.length
            ? stageProjects.map(renderRenewalProjectCard).join("")
            : `<div class="empty-state compact-empty">暂无该阶段班级。</div>`
          }
        </div>
      </section>
    `;
  }).join("");
}

function renderRenewalHistoryUploadPanel(data = renewalData) {
  if (!renewalHistoryUploadPanel) return;
  renewalHistoryUploadPanel.classList.toggle("is-hidden", !data?.can_manage_all);
}

function renderRenewal(data) {
  renewalData = data;
  ensureRenewalTeacherSelection();
  const visibleProjects = renewalProjectsForActiveTeacher(data.projects || []);
  updateRenewalMenuBadge(data);
  renderRenewalTeacherPanel();
  renderRenewalHistoryUploadPanel(data);
  renderRenewalClassOptions(data.available_classes || []);
  renderRenewalBoard(visibleProjects);
}

function renewalPendingLeaderPlanCount(projects = []) {
  return projects.reduce((sum, project) => sum + Number(project.pending_leader_plan_count || 0), 0);
}

function updateRenewalMenuBadge(data = renewalData) {
  if (!renewalMenuBadge) return;
  const pendingPlans = renewalPendingLeaderPlanCount(data?.projects || []);
  const shouldShow = Boolean(!data?.can_manage_all && pendingPlans > 0);
  renewalMenuBadge.classList.toggle("is-hidden", !shouldShow);
  renewalMenuBadge.textContent = shouldShow ? String(pendingPlans > 99 ? "99+" : pendingPlans) : "";
  renewalMenuBadge.title = shouldShow ? `你有 ${pendingPlans} 条待处理盘单` : "";
  renewalMenuButton?.classList.toggle("has-reminder", shouldShow);
}

function refreshRenewalShellFromData(data) {
  renewalData = data;
  ensureRenewalTeacherSelection();
  updateRenewalMenuBadge(data);
  renderRenewalClassOptions(renewalData.available_classes || []);
  renderRenewalBoard(renewalProjectsForActiveTeacher(renewalData.projects || []));
  if (renewalDetailView?.classList.contains("is-hidden")) {
    renderRenewalTeacherPanel();
    renderRenewalHistoryUploadPanel(data);
  } else {
    renewalTeacherPanel?.classList.add("is-hidden");
    renewalHistoryUploadPanel?.classList.add("is-hidden");
  }
}

function showRenewalDetail(shouldShow) {
  renewalAddPanel?.classList.toggle("is-hidden", shouldShow);
  renewalTeacherPanel?.classList.toggle("is-hidden", shouldShow || !renewalData?.can_manage_all);
  renewalHistoryUploadPanel?.classList.toggle("is-hidden", shouldShow || !renewalData?.can_manage_all);
  renewalStageBoard?.classList.toggle("is-hidden", shouldShow);
  renewalDetailView?.classList.toggle("is-hidden", !shouldShow);
  if (!shouldShow) {
    renewalActiveDetailProject = null;
    renewalActiveDetailData = null;
    renderRenewalWeekSelect(null);
    renderRenewalTeacherPanel();
  }
}

function findRenewalDetailStudent(project, studentId) {
  return (project?.students || []).find((student) => String(student.id) === String(studentId)) || null;
}

function updateRenewalStudentRow(project, studentId) {
  const student = findRenewalDetailStudent(project, studentId);
  const row = Array.from(renewalStudentList?.querySelectorAll("[data-renewal-student-row]") || [])
    .find((item) => item.dataset.renewalStudentRow === String(studentId));
  if (!student || !row) return;
  const nameCell = row.querySelector("[data-renewal-name-note]");
  if (nameCell) {
    nameCell.dataset.renewalNameNote = student.followup_note || "暂无备注";
  }
  const timeCell = row.querySelector("[data-renewal-followup-time-cell]");
  if (timeCell) {
    timeCell.textContent = student.followup_time || "-";
  }
  const noteInput = row.querySelector("[data-renewal-followup-note]");
  if (noteInput && document.activeElement !== noteInput) {
    noteInput.value = "";
  }
}

function renderRenewalStandardStudentTable(project, students, disabledAttr) {
  return `
    <table class="database-table renewal-student-table">
      <thead>
        <tr>
          <th>学员姓名</th>
          <th>学员账号</th>
          <th>平均完课率</th>
          <th>跟进时间</th>
          <th>跟进情况</th>
          <th>备注</th>
        </tr>
      </thead>
      <tbody>
        ${students.map((student) => `
          <tr data-renewal-student-row="${escapeRenewalText(student.id)}">
            ${renderRenewalStudentNameCell(project, student, disabledAttr)}
            <td>${escapeRenewalText(student.account || "-")}</td>
            <td class="database-percent-cell">${escapeRenewalText(formatRenewalRate(student.average_completion))}</td>
            <td data-renewal-followup-time-cell>${escapeRenewalText(student.followup_time || "-")}</td>
            <td>
              <select
                class="renewal-followup-select"
                data-renewal-followup-status="${escapeRenewalText(project.id)}"
                data-renewal-student-id="${escapeRenewalText(student.id)}"
                ${disabledAttr}
              >
                ${renderRenewalFollowupOptions(student.followup_status || "")}
              </select>
            </td>
            ${renderRenewalRemarkCell(project, student, disabledAttr)}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function shouldShowRenewalLeaderPlanColumn(project, students) {
  return Boolean(
    renewalData?.can_manage_all
      || Number(project.leader_plan_count || 0)
      || students.some((student) => student.leader_note
        || student.leader_action_type === "去电"
        || (
          student.leader_talk_type === RENEWAL_MESSAGE_TALK_TYPE && student.leader_talk_text
        ))
  );
}

function renderRenewalFirstMonthStudentTable(project, students, disabledAttr) {
  const currentWeekKey = getRenewalSelectedWeekKey();
  const showLeaderPlanColumn = shouldShowRenewalLeaderPlanColumn(project, students);
  const firstMonthColumnCount = 4 + 1 + (showLeaderPlanColumn ? 1 : 0) + 3 + (RENEWAL_WEEKS.length - 1) + 1;
  const enrolledStudents = students.filter((student) => student.enrolled);
  const visibleStudents = renewalShowEnrolledStudents
    ? students
    : students.filter((student) => !student.enrolled);
  const enrolledToggle = enrolledStudents.length
    ? `
      <div class="renewal-student-toolbar">
        <button class="ghost-button compact-button" type="button" data-renewal-toggle-enrolled>
          ${renewalShowEnrolledStudents ? "隐藏已报名学员" : `展开已报名学员（${enrolledStudents.length}）`}
        </button>
        <span>${renewalShowEnrolledStudents ? "当前已展示全部学员" : "已报名学员默认收起"}</span>
      </div>
    `
    : "";
  return `
    ${enrolledToggle}
    <table class="database-table renewal-student-table renewal-first-month-table">
      <thead>
        <tr>
          <th class="renewal-sticky-group" colspan="4">基础信息</th>
          <th class="renewal-sticky-col renewal-sticky-blocker" rowspan="2">当前卡点</th>
          ${showLeaderPlanColumn ? `<th class="renewal-leader-plan-head" rowspan="2">盘单</th>` : ""}
          ${RENEWAL_WEEKS.map((week) => `
            ${week.key === currentWeekKey
              ? `
                <th class="renewal-week-current-head" colspan="3">${escapeRenewalText(week.label)}</th>
                <th class="renewal-current-note-head" rowspan="2">备注</th>
              `
              : `<th class="renewal-week-collapsed-head" rowspan="2">${escapeRenewalText(week.label)}</th>`
            }
          `).join("")}
        </tr>
        <tr>
          <th class="renewal-sticky-col renewal-sticky-name">学员姓名</th>
          <th class="renewal-sticky-col renewal-sticky-account">学习账号</th>
          <th class="renewal-sticky-col renewal-sticky-average">平均完课</th>
          <th class="renewal-sticky-col renewal-sticky-intention">铺垫情况</th>
          ${RENEWAL_WEEKS.map((week) => week.key === currentWeekKey ? `
            <th>跟进时间</th>
            <th>跟进方式</th>
            <th>跟进次数</th>
          ` : "").join("")}
        </tr>
      </thead>
      <tbody>
        ${visibleStudents.length ? visibleStudents.map((student) => `
          <tr data-renewal-student-row="${escapeRenewalText(student.id)}">
            ${renderRenewalStudentNameCell(project, student, disabledAttr, "renewal-sticky-col renewal-sticky-name")}
            <td class="renewal-sticky-col renewal-sticky-account">${escapeRenewalText(student.account || "-")}</td>
            <td class="database-percent-cell renewal-sticky-col renewal-sticky-average">${escapeRenewalText(formatRenewalRate(student.average_completion))}</td>
            <td class="renewal-sticky-col renewal-sticky-intention">
              <span class="renewal-intention-pill">${escapeRenewalText(student.followup_status || "未填写")}</span>
            </td>
            <td class="renewal-sticky-col renewal-sticky-blocker">
              <select
                class="renewal-followup-select renewal-blocker-select"
                data-renewal-current-blocker="${escapeRenewalText(project.id)}"
                data-renewal-student-id="${escapeRenewalText(student.id)}"
                data-renewal-current-value="${escapeRenewalText(student.current_blocker || "")}"
                ${disabledAttr}
              >
                ${renderRenewalBlockerOptions(student.current_blocker || "")}
              </select>
            </td>
            ${showLeaderPlanColumn ? renderRenewalLeaderPlanCell(project, student, disabledAttr) : ""}
            ${RENEWAL_WEEKS.map((week) => renderRenewalWeekCells(project, student, week, currentWeekKey, disabledAttr)).join("")}
          </tr>
        `).join("") : `
          <tr>
            <td class="renewal-hidden-enrolled-empty" colspan="${firstMonthColumnCount}">已报名学员已自动隐藏，点击上方按钮可展开查看。</td>
          </tr>
        `}
      </tbody>
    </table>
  `;
}

function renderRenewalSecondMonthStudentTable(project, students, disabledAttr) {
  const showLeaderPlanColumn = shouldShowRenewalLeaderPlanColumn(project, students);
  const secondMonthColumnCount = 4 + 1 + (showLeaderPlanColumn ? 1 : 0) + 4;
  const enrolledStudents = students.filter((student) => student.enrolled);
  const visibleStudents = renewalShowEnrolledStudents
    ? students
    : students.filter((student) => !student.enrolled);
  const enrolledToggle = enrolledStudents.length
    ? `
      <div class="renewal-student-toolbar">
        <button class="ghost-button compact-button" type="button" data-renewal-toggle-enrolled>
          ${renewalShowEnrolledStudents ? "隐藏已报名学员" : `展开已报名学员（${enrolledStudents.length}）`}
        </button>
        <span>${renewalShowEnrolledStudents ? "当前已展示全部学员" : "已报名学员默认收起"}</span>
      </div>
    `
    : "";
  return `
    ${enrolledToggle}
    <table class="database-table renewal-student-table renewal-first-month-table renewal-second-month-table">
      <thead>
        <tr>
          <th class="renewal-sticky-group" colspan="4">基础信息</th>
          <th class="renewal-sticky-col renewal-sticky-blocker" rowspan="2">当前卡点</th>
          ${showLeaderPlanColumn ? `<th class="renewal-leader-plan-head" rowspan="2">盘单</th>` : ""}
          <th class="renewal-week-current-head" colspan="4">跟进记录</th>
        </tr>
        <tr>
          <th class="renewal-sticky-col renewal-sticky-name">学员姓名</th>
          <th class="renewal-sticky-col renewal-sticky-account">学习账号</th>
          <th class="renewal-sticky-col renewal-sticky-average">平均完课</th>
          <th class="renewal-sticky-col renewal-sticky-intention">铺垫情况</th>
          <th>跟进时间</th>
          <th>跟进方式</th>
          <th>次数</th>
          <th class="renewal-current-note-head">备注</th>
        </tr>
      </thead>
      <tbody>
        ${visibleStudents.length ? visibleStudents.map((student) => `
          <tr data-renewal-student-row="${escapeRenewalText(student.id)}">
            ${renderRenewalStudentNameCell(project, student, disabledAttr, "renewal-sticky-col renewal-sticky-name")}
            <td class="renewal-sticky-col renewal-sticky-account">${escapeRenewalText(student.account || "-")}</td>
            <td class="database-percent-cell renewal-sticky-col renewal-sticky-average">${escapeRenewalText(formatRenewalRate(student.average_completion))}</td>
            <td class="renewal-sticky-col renewal-sticky-intention">
              <span class="renewal-intention-pill">${escapeRenewalText(student.followup_status || "未填写")}</span>
            </td>
            <td class="renewal-sticky-col renewal-sticky-blocker">
              <select
                class="renewal-followup-select renewal-blocker-select"
                data-renewal-current-blocker="${escapeRenewalText(project.id)}"
                data-renewal-student-id="${escapeRenewalText(student.id)}"
                data-renewal-current-value="${escapeRenewalText(student.current_blocker || "")}"
                ${disabledAttr}
              >
                ${renderRenewalBlockerOptions(student.current_blocker || "")}
              </select>
            </td>
            ${showLeaderPlanColumn ? renderRenewalLeaderPlanCell(project, student, disabledAttr) : ""}
            <td>${renderRenewalGeneralTime(student)}</td>
            <td>${renderRenewalGeneralMethods(project, student, disabledAttr)}</td>
            <td>${renderRenewalGeneralCount(student)}</td>
            ${renderRenewalRemarkCell(project, student, disabledAttr)}
          </tr>
        `).join("") : `
          <tr>
            <td class="renewal-hidden-enrolled-empty" colspan="${secondMonthColumnCount}">已报名学员已自动隐藏，点击上方按钮可展开查看。</td>
          </tr>
        `}
      </tbody>
    </table>
  `;
}

function renderRenewalDetail(project) {
  if (!renewalDetailView || !project) return;
  hideRenewalNameNote();
  renewalDetailView.dataset.renewalActiveProject = project.id || "";
  renewalActiveDetailProject = project.id || null;
  renewalActiveDetailData = project;
  renderRenewalWeekSelect(project);
  if (renewalDetailTitle) renewalDetailTitle.textContent = project.class_name || "班级续费明细";
  if (renewalDetailMeta) {
    renewalDetailMeta.textContent = `${project.teacher_name || "未分配"} · 续费锁定 ${Number(project.student_count || 0)} 人 · 已报名 ${Number(project.enrolled_count || 0)} 人 · 完课当前 ${Number(project.source_student_count || 0)} 人`;
  }
  if (renewalDetailSummary) {
    const pendingPlans = Number(project.pending_leader_plan_count || 0);
    const totalPlans = Number(project.leader_plan_count || 0);
    const disabledAttr = project.can_edit ? "" : "disabled";
    const countEditor = project.can_edit ? `
      <input
        class="renewal-count-input"
        type="number"
        min="0"
        max="9999"
        step="1"
        value="${Number(project.student_count || 0)}"
        data-renewal-student-count="${escapeRenewalText(project.id)}"
        aria-label="续费锁定人数"
        ${disabledAttr}
      >
    ` : `<strong>${Number(project.student_count || 0)}</strong>`;
    const countNoteEditor = `
      <input
        class="renewal-count-note-input"
        type="text"
        value="${escapeRenewalText(project.student_count_note || "")}"
        placeholder="人数说明，如：进入首月续费时锁定"
        data-renewal-student-count-note="${escapeRenewalText(project.id)}"
        ${disabledAttr}
      >
    `;
    const planSummaryCard = totalPlans ? `
      <article class="renewal-plan-summary${pendingPlans ? " has-pending" : " is-clear"}">
        <span>盘单提醒</span>
        <strong>${pendingPlans}</strong>
        <small>${pendingPlans ? `还有 ${pendingPlans} 条待完成` : "盘单已处理完成"}</small>
      </article>
    ` : "";
    renewalDetailSummary.innerHTML = `
      <article class="renewal-count-summary">
        <span>续费锁定人数</span>
        ${countEditor}
        <small>续报率按这里作为分母；完课当前 ${Number(project.source_student_count || 0)} 人</small>
        ${countNoteEditor}
      </article>
      <article>
        <span>已报名</span>
        <strong>${Number(project.enrolled_count || 0)}</strong>
      </article>
      <article>
        <span>续报率</span>
        <strong>${escapeRenewalText(formatRenewalRate(project.renewal_rate))}</strong>
      </article>
      ${planSummaryCard}
    `;
  }
  if (!renewalStudentList) return;
  const students = project.students || [];
  if (!students.length) {
    renewalStudentList.innerHTML = `<div class="empty-state compact-empty">暂无学员数据，请先在完课班级中上传学员信息。</div>`;
    return;
  }
  const disabledAttr = project.can_edit ? "" : "disabled";
  if (isRenewalFourWeekStage(project)) {
    renewalStudentList.innerHTML = renderRenewalFirstMonthStudentTable(project, students, disabledAttr);
  } else if (isRenewalSingleFollowupStage(project)) {
    renewalStudentList.innerHTML = renderRenewalSecondMonthStudentTable(project, students, disabledAttr);
  } else {
    renewalStudentList.innerHTML = renderRenewalStandardStudentTable(project, students, disabledAttr);
  }
}

async function openRenewalProject(projectId) {
  setRenewalMessage("正在读取班级续费明细...");
  try {
    const data = await renewalApiRequest(`/api/renewal/projects/${encodeURIComponent(projectId)}`);
    renderRenewalDetail(data.project);
    showRenewalDetail(true);
    setRenewalMessage("");
  } catch (error) {
    updateRenewalMenuBadge({ can_manage_all: true, projects: [] });
    setRenewalMessage(error.message, true);
  }
}

async function loadRenewal() {
  if (!renewalStageBoard) return;
  setRenewalMessage("正在读取续费项目...");
  try {
    const data = await renewalApiRequest("/api/renewal");
    renderRenewal(data);
    const pendingPlans = renewalPendingLeaderPlanCount(data.projects || []);
    setRenewalMessage(!data.can_manage_all && pendingPlans ? `你有 ${pendingPlans} 条待处理盘单，进入班级后点击完成即可收起。` : "");
  } catch (error) {
    setRenewalMessage(error.message, true);
  }
}

async function uploadRenewalHistory(file) {
  if (!file) return;
  const formData = new FormData();
  formData.append("file", file);
  setRenewalMessage("正在导入续费历史数据...");
  if (renewalHistoryUploadButton) renewalHistoryUploadButton.disabled = true;
  try {
    const response = await fetch("/api/renewal/history-upload", {
      method: "POST",
      body: formData,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "续费历史数据导入失败，请稍后重试。");
    }
    if (data.board) {
      showRenewalDetail(false);
      renderRenewal(data.board);
    } else {
      await loadRenewal();
    }
    const skippedRows = Array.isArray(data.skipped_rows) ? data.skipped_rows : [];
    const skippedPreview = skippedRows.length
      ? `；跳过示例：${skippedRows.slice(0, 3).map((item) => `${item.row || ""}${item.reason ? ` ${item.reason}` : ""}`).join(" / ")}`
      : "";
    setRenewalMessage(`已导入 ${Number(data.imported_count || 0)} 条续费记录，新建 ${Number(data.created_project_count || 0)} 个续费班级，跳过 ${Number(data.skipped_count || 0)} 行${skippedPreview}`);
  } catch (error) {
    setRenewalMessage(error.message, true);
  } finally {
    if (renewalHistoryUploadButton) renewalHistoryUploadButton.disabled = false;
    if (renewalHistoryFileInput) renewalHistoryFileInput.value = "";
  }
}

async function addRenewalProject(event) {
  event.preventDefault();
  const classId = renewalClassSelect?.value || "";
  const stage = renewalStageSelect?.value || "铺垫阶段";
  if (!classId) {
    setRenewalMessage("请先选择要加入续费项目的班级。", true);
    return;
  }
  setRenewalMessage("正在添加续费班级...");
  try {
    const data = await renewalApiRequest("/api/renewal/projects", {
      method: "POST",
      body: JSON.stringify({ class_id: classId, stage }),
    });
    renderRenewal(data);
    if (renewalAddForm) renewalAddForm.reset();
    setRenewalMessage("已添加到续费项目。");
  } catch (error) {
    setRenewalMessage(error.message, true);
  }
}

async function updateRenewalProject(projectId, payload, successMessage) {
  setRenewalMessage("正在保存续费项目...");
  try {
    const data = await renewalApiRequest(`/api/renewal/projects/${encodeURIComponent(projectId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    renderRenewal(data);
    setRenewalMessage(successMessage);
  } catch (error) {
    setRenewalMessage(error.message, true);
  }
}

async function saveRenewalProjectSettings(projectId, payload, successMessage = "续费设置已保存。") {
  if (!projectId) return;
  setRenewalMessage("正在保存续费设置...");
  try {
    const data = await renewalApiRequest(`/api/renewal/projects/${encodeURIComponent(projectId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    refreshRenewalShellFromData(data);
    if (renewalActiveDetailProject === projectId) {
      const detailData = await renewalApiRequest(`/api/renewal/projects/${encodeURIComponent(projectId)}`);
      renderRenewalDetail(detailData.project);
      showRenewalDetail(true);
    }
    setRenewalMessage(successMessage);
  } catch (error) {
    setRenewalMessage(error.message, true);
  }
}

async function updateRenewalStudent(projectId, studentId, payload, options = {}) {
  const shouldRenderDetail = options.renderDetail !== false;
  const successMessage = options.successMessage || "跟进数据已同步。";
  setRenewalMessage("正在同步跟进数据...");
  try {
    const data = await renewalApiRequest(`/api/renewal/projects/${encodeURIComponent(projectId)}/students/${encodeURIComponent(studentId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    refreshRenewalShellFromData(data.board);
    renewalActiveDetailData = data.project;
    if (shouldRenderDetail) {
      renderRenewalDetail(data.project);
    } else {
      updateRenewalStudentRow(data.project, studentId);
    }
    setRenewalMessage(successMessage);
    return data;
  } catch (error) {
    setRenewalMessage(error.message, true);
    return null;
  }
}

async function saveRenewalFollowupNote(noteInput) {
  const noteText = noteInput.value.trim();
  if (!noteText) {
    noteInput.value = "";
    return;
  }
  if (noteInput.dataset.renewalSaving === "true") return;
  noteInput.dataset.renewalSaving = "true";
  noteInput.classList.add("is-saving");
  try {
    const data = await updateRenewalStudent(
      noteInput.dataset.renewalFollowupNote,
      noteInput.dataset.renewalStudentId,
      { followup_note: noteText },
      { successMessage: "备注已保存。" }
    );
    if (data && noteInput.value.trim() === noteText) noteInput.value = "";
  } finally {
    delete noteInput.dataset.renewalSaving;
    noteInput.classList.remove("is-saving");
  }
}

async function editRenewalNoteText(projectId, studentId, previousText = "") {
  hideRenewalNameNote();
  const nextText = await openRenewalNoteEditor(previousText);
  if (nextText === null) return;
  const normalizedText = String(nextText || "").trim();
  if (normalizedText === previousText.trim()) {
    setRenewalMessage("备注未变化。");
    return;
  }
  await updateRenewalStudent(
    projectId,
    studentId,
    { followup_note_replace: normalizedText },
    { successMessage: normalizedText ? "备注已更新。" : "备注已删除。" }
  );
}

function renewalCountNoteInput(projectId) {
  return Array.from(renewalDetailSummary?.querySelectorAll("[data-renewal-student-count-note]") || [])
    .find((input) => input.dataset.renewalStudentCountNote === projectId) || null;
}

function saveRenewalStudentCount(countInput) {
  const projectId = countInput.dataset.renewalStudentCount;
  const count = Math.max(0, Math.min(9999, Number.parseInt(countInput.value, 10) || 0));
  countInput.value = String(count);
  saveRenewalProjectSettings(
    projectId,
    {
      student_count: count,
      student_count_note: renewalCountNoteInput(projectId)?.value || "",
    },
    "续费人数已保存。"
  );
}

function saveRenewalStudentCountNote(noteInput) {
  saveRenewalProjectSettings(
    noteInput.dataset.renewalStudentCountNote,
    { student_count_note: noteInput.value.trim() },
    "人数说明已保存。"
  );
}

async function createRenewalBlockerOption(option) {
  if (!option) {
    setRenewalMessage("请先填写要新增的当前卡点。", true);
    return null;
  }
  setRenewalMessage("正在新增当前卡点选项...");
  const data = await renewalApiRequest("/api/renewal/blockers", {
    method: "POST",
    body: JSON.stringify({ option }),
  });
  renewalData = data;
  renderRenewalClassOptions(renewalData.available_classes || []);
  renderRenewalBoard(renewalData.projects || []);
  return option;
}

async function addRenewalInlineBlockerOption(blockerSelect) {
  const previousValue = blockerSelect.dataset.renewalCurrentValue || "";
  blockerSelect.value = previousValue;
  const option = window.prompt("请输入新的当前卡点选项");
  const normalizedOption = String(option || "").trim().slice(0, 24);
  if (!normalizedOption) {
    setRenewalMessage("已取消新增当前卡点。");
    return;
  }
  try {
    const createdOption = await createRenewalBlockerOption(normalizedOption);
    if (!createdOption) return;
    await updateRenewalStudent(
      blockerSelect.dataset.renewalCurrentBlocker,
      blockerSelect.dataset.renewalStudentId,
      { current_blocker: createdOption }
    );
    setRenewalMessage("当前卡点已新增并应用。");
  } catch (error) {
    setRenewalMessage(error.message, true);
  }
}

function collectRenewalWeeklyDraft(projectId, studentId, weekKey) {
  const matchesStudentWeek = (element) => (
    element.dataset.renewalStudentId === studentId
    && element.dataset.renewalWeek === weekKey
  );
  const methods = Array.from(renewalStudentList?.querySelectorAll("[data-renewal-week-method]") || [])
    .filter((input) => input.dataset.renewalWeekMethod === projectId && matchesStudentWeek(input) && input.checked)
    .map((input) => input.value);
  return {
    week: Number(weekKey),
    date: todayRenewalDateValue(),
    methods,
  };
}

function saveRenewalWeeklyFollowup(projectId, studentId, weekKey) {
  const draft = collectRenewalWeeklyDraft(projectId, studentId, weekKey);
  if (!draft.methods.length) {
    setRenewalMessage("请先选择私信或电话，再点击记录。", true);
    return;
  }
  updateRenewalStudent(projectId, studentId, { weekly_followup: draft });
}

function collectRenewalGeneralDraft(projectId, studentId) {
  const methods = Array.from(renewalStudentList?.querySelectorAll("[data-renewal-general-method]") || [])
    .filter((input) => (
      input.dataset.renewalGeneralMethod === projectId
      && input.dataset.renewalStudentId === studentId
      && input.checked
    ))
    .map((input) => input.value);
  return {
    date: todayRenewalDateValue(),
    methods,
  };
}

function saveRenewalGeneralFollowup(projectId, studentId) {
  const draft = collectRenewalGeneralDraft(projectId, studentId);
  if (!draft.methods.length) {
    setRenewalMessage("请先选择私信或电话，再点击记录。", true);
    return;
  }
  updateRenewalStudent(projectId, studentId, { general_followup: draft });
}

function findRenewalProject(projectId) {
  return (renewalData?.projects || []).find((project) => project.id === projectId);
}

function clearRenewalDropTargets() {
  renewalStageBoard?.querySelectorAll(".renewal-stage-column.is-drop-target").forEach((column) => {
    column.classList.remove("is-drop-target");
  });
}

function handleRenewalDragStart(event) {
  const card = event.target.closest("[data-renewal-project]");
  if (!card) return;
  if (event.target.closest("button, input, select, label")) {
    event.preventDefault();
    return;
  }
  const projectId = card.dataset.renewalProject;
  const project = findRenewalProject(projectId);
  if (!project?.can_edit) {
    event.preventDefault();
    return;
  }
  draggedRenewalProjectId = projectId;
  card.classList.add("is-dragging");
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", projectId);
  }
}

function handleRenewalDragEnd() {
  renewalStageBoard?.querySelectorAll(".renewal-project-card.is-dragging").forEach((card) => {
    card.classList.remove("is-dragging");
  });
  clearRenewalDropTargets();
  draggedRenewalProjectId = "";
}

function handleRenewalDragOver(event) {
  if (!draggedRenewalProjectId) return;
  const column = event.target.closest("[data-renewal-stage-column]");
  if (!column) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  clearRenewalDropTargets();
  column.classList.add("is-drop-target");
}

function handleRenewalDragLeave(event) {
  const column = event.target.closest("[data-renewal-stage-column]");
  if (!column) return;
  if (event.relatedTarget && column.contains(event.relatedTarget)) return;
  column.classList.remove("is-drop-target");
}

async function handleRenewalDrop(event) {
  if (!draggedRenewalProjectId) return;
  const column = event.target.closest("[data-renewal-stage-column]");
  if (!column) return;
  event.preventDefault();
  const projectId = event.dataTransfer?.getData("text/plain") || draggedRenewalProjectId;
  const targetStage = column.dataset.renewalStageColumn;
  clearRenewalDropTargets();
  const project = findRenewalProject(projectId);
  if (!project || !targetStage || project.stage === targetStage) {
    handleRenewalDragEnd();
    return;
  }
  await updateRenewalProject(projectId, { stage: targetStage }, "阶段已更新。");
  draggedRenewalProjectId = "";
}

async function deleteRenewalProject(projectId) {
  const confirmed = window.confirm("确认把这个班级移出续费项目吗？");
  if (!confirmed) return;
  setRenewalMessage("正在移出续费项目...");
  try {
    const data = await renewalApiRequest(`/api/renewal/projects/${encodeURIComponent(projectId)}`, {
      method: "DELETE",
    });
    renderRenewal(data);
    setRenewalMessage("已移出续费项目。");
  } catch (error) {
    setRenewalMessage(error.message, true);
  }
}

function initRenewal() {
  if (!renewalStageBoard) return;
  renewalAddForm?.addEventListener("submit", addRenewalProject);
  renewalHistoryUploadButton?.addEventListener("click", () => {
    renewalHistoryFileInput?.click();
  });
  renewalHistoryFileInput?.addEventListener("change", () => {
    uploadRenewalHistory(renewalHistoryFileInput.files?.[0]);
  });
  renewalMenuButton?.addEventListener("click", () => {
    showRenewalDetail(false);
    loadRenewal();
  });
  renewalBackButton?.addEventListener("click", () => {
    showRenewalDetail(false);
    if (renewalData) renderRenewal(renewalData);
  });
  renewalTeacherList?.addEventListener("click", (event) => {
    const teacherButton = event.target.closest("[data-renewal-teacher]");
    if (!teacherButton) return;
    renewalSelectedTeacherId = teacherButton.dataset.renewalTeacher || RENEWAL_ALL_TEACHERS;
    renderRenewal(renewalData);
    const activeTeacher = getRenewalSelectedTeacher();
    setRenewalMessage(activeTeacher ? `已进入 ${activeTeacher.teacher_name || activeTeacher.teacher_id} 的续费跟进。` : "已切回全部老师续费跟进。");
  });
  renewalWeekSelect?.addEventListener("change", () => {
    setRenewalSelectedWeekKey(renewalWeekSelect.value);
    if (renewalActiveDetailData) {
      renderRenewalDetail(renewalActiveDetailData);
    }
  });
  renewalDetailSummary?.addEventListener("change", (event) => {
    const countInput = event.target.closest("[data-renewal-student-count]");
    if (countInput) {
      saveRenewalStudentCount(countInput);
      return;
    }
    const countNoteInput = event.target.closest("[data-renewal-student-count-note]");
    if (countNoteInput) {
      saveRenewalStudentCountNote(countNoteInput);
    }
  });
  renewalDetailSummary?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const countInput = event.target.closest("[data-renewal-student-count]");
    if (countInput) {
      event.preventDefault();
      saveRenewalStudentCount(countInput);
      return;
    }
    const countNoteInput = event.target.closest("[data-renewal-student-count-note]");
    if (countNoteInput) {
      event.preventDefault();
      saveRenewalStudentCountNote(countNoteInput);
    }
  });
  renewalStageBoard.addEventListener("dragstart", handleRenewalDragStart);
  renewalStageBoard.addEventListener("dragend", handleRenewalDragEnd);
  renewalStageBoard.addEventListener("dragover", handleRenewalDragOver);
  renewalStageBoard.addEventListener("dragleave", handleRenewalDragLeave);
  renewalStageBoard.addEventListener("drop", (event) => {
    handleRenewalDrop(event);
  });
  renewalStageBoard.addEventListener("change", (event) => {
    const select = event.target.closest("[data-renewal-stage]");
    if (select) {
      updateRenewalProject(select.dataset.renewalStage, { stage: select.value }, "阶段已更新。");
    }
  });
  renewalStageBoard.addEventListener("click", (event) => {
    const openButton = event.target.closest("[data-renewal-open]");
    if (openButton) {
      openRenewalProject(openButton.dataset.renewalOpen);
      return;
    }
    const deleteButton = event.target.closest("[data-renewal-delete]");
    if (deleteButton) {
      deleteRenewalProject(deleteButton.dataset.renewalDelete);
    }
  });
  renewalStudentList?.addEventListener("input", (event) => {
    const leaderNote = event.target.closest("[data-renewal-leader-note]");
    if (leaderNote) refreshRenewalTalkSelectOptions(leaderNote);
  });
  renewalStudentList?.addEventListener("change", (event) => {
    const enrolledCheckbox = event.target.closest("[data-renewal-enrolled]");
    if (enrolledCheckbox) {
      updateRenewalStudent(
        enrolledCheckbox.dataset.renewalEnrolled,
        enrolledCheckbox.dataset.renewalStudentId,
        { enrolled: enrolledCheckbox.checked }
      );
      return;
    }
    const statusSelect = event.target.closest("[data-renewal-followup-status]");
    if (statusSelect) {
      updateRenewalStudent(
        statusSelect.dataset.renewalFollowupStatus,
        statusSelect.dataset.renewalStudentId,
        { followup_status: statusSelect.value }
      );
      return;
    }
    const blockerSelect = event.target.closest("[data-renewal-current-blocker]");
    if (blockerSelect) {
      if (blockerSelect.value === RENEWAL_ADD_BLOCKER_VALUE) {
        addRenewalInlineBlockerOption(blockerSelect);
        return;
      }
      updateRenewalStudent(
        blockerSelect.dataset.renewalCurrentBlocker,
        blockerSelect.dataset.renewalStudentId,
        { current_blocker: blockerSelect.value }
      );
      return;
    }
    const leaderAction = event.target.closest("[data-renewal-leader-action]");
    if (leaderAction) {
      updateRenewalStudent(
        leaderAction.dataset.renewalLeaderAction,
        leaderAction.dataset.renewalStudentId,
        { leader_action_type: leaderAction.value },
        { successMessage: leaderAction.value === "去电" ? "已标记为去电跟进。" : "已标记为留言跟进。" }
      );
      return;
    }
    const leaderDone = event.target.closest("[data-renewal-leader-done]");
    if (leaderDone) {
      updateRenewalStudent(
        leaderDone.dataset.renewalLeaderDone,
        leaderDone.dataset.renewalStudentId,
        { leader_note_done: leaderDone.checked }
      );
      return;
    }
    const leaderTalk = event.target.closest("[data-renewal-leader-talk]");
    if (leaderTalk) {
      if (leaderTalk.value === "__saved_talk__") return;
      const plan = leaderTalk.closest(".renewal-leader-plan");
      const noteInput = plan?.querySelector("[data-renewal-leader-note]");
      const selectedTrack = leaderTalk.value ? findRenewalTalkTrackById(leaderTalk.value) : null;
      const nextKeyword = String(noteInput?.value || "").trim();
      if (noteInput) noteInput.value = "";
      updateRenewalStudent(
        leaderTalk.dataset.renewalLeaderTalk,
        leaderTalk.dataset.renewalStudentId,
        {
          leader_note: "",
          leader_talk_keyword: selectedTrack ? nextKeyword : "",
          leader_talk_type: selectedTrack ? RENEWAL_MESSAGE_TALK_TYPE : "",
          leader_talk_title: selectedTrack?.scene || "",
          leader_talk_text: selectedTrack?.text || "",
        },
        { successMessage: selectedTrack ? "留言话术已选择，关键词已清空。" : "盘单话术已清空。" }
      );
      return;
    }
    const leaderNote = event.target.closest("[data-renewal-leader-note]");
    if (leaderNote) {
      refreshRenewalTalkSelectOptions(leaderNote);
      return;
    }
  });
  renewalStudentList?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const noteInput = event.target.closest("[data-renewal-followup-note]");
    if (!noteInput) return;
    event.preventDefault();
    saveRenewalFollowupNote(noteInput);
  });
  renewalStudentList?.addEventListener("dblclick", (event) => {
    const noteCard = event.target.closest("[data-renewal-note-card]");
    if (!noteCard) return;
    event.preventDefault();
    editRenewalNoteText(
      noteCard.dataset.renewalNoteCard,
      noteCard.dataset.renewalStudentId,
      noteCard.dataset.renewalNoteText || ""
    );
  });
  renewalStudentList?.addEventListener("click", (event) => {
    const copyTalkButton = event.target.closest("[data-renewal-copy-talk]");
    if (copyTalkButton) {
      copyRenewalText(copyTalkButton.dataset.renewalCopyTalk || "", copyTalkButton);
      return;
    }
    const enrolledToggle = event.target.closest("[data-renewal-toggle-enrolled]");
    if (enrolledToggle) {
      renewalShowEnrolledStudents = !renewalShowEnrolledStudents;
      const projectId = renewalDetailView?.dataset?.renewalActiveProject;
      if (projectId) {
        openRenewalProject(projectId);
      }
      return;
    }
    const generalSaveButton = event.target.closest("[data-renewal-general-save]");
    if (generalSaveButton) {
      saveRenewalGeneralFollowup(
        generalSaveButton.dataset.renewalGeneralSave,
        generalSaveButton.dataset.renewalStudentId
      );
      return;
    }
    const saveButton = event.target.closest("[data-renewal-week-save]");
    if (!saveButton) return;
    saveRenewalWeeklyFollowup(
      saveButton.dataset.renewalWeekSave,
      saveButton.dataset.renewalStudentId,
      saveButton.dataset.renewalWeek
    );
  });
  renewalStudentList?.addEventListener("mouseover", (event) => {
    const talkPreview = event.target.closest("[data-renewal-talk-preview]");
    if (talkPreview) {
      showRenewalTalkPreview(talkPreview);
      return;
    }
    const noteCard = event.target.closest("[data-renewal-note-card]");
    if (noteCard) showRenewalNameNote(noteCard);
  });
  renewalStudentList?.addEventListener("focusin", (event) => {
    const noteCard = event.target.closest("[data-renewal-note-card]");
    if (noteCard) showRenewalNameNote(noteCard);
  });
  renewalStudentList?.addEventListener("focusout", (event) => {
    const noteCard = event.target.closest("[data-renewal-note-card]");
    if (!noteCard) return;
    if (
      event.relatedTarget !== renewalNoteTooltip
      && !renewalNoteTooltip?.contains(event.relatedTarget)
    ) {
      scheduleRenewalNameNoteHide();
    }
  });
  renewalStudentList?.addEventListener("mouseout", (event) => {
    const talkPreview = event.target.closest("[data-renewal-talk-preview]");
    if (talkPreview && !talkPreview.contains(event.relatedTarget)) {
      hideRenewalNameNote();
      return;
    }
    const noteCard = event.target.closest("[data-renewal-note-card]");
    if (
      noteCard
      && !noteCard.contains(event.relatedTarget)
      && event.relatedTarget !== renewalNoteTooltip
      && !renewalNoteTooltip?.contains(event.relatedTarget)
    ) {
      scheduleRenewalNameNoteHide();
    }
  });
  renewalStudentList?.addEventListener("scroll", hideRenewalNameNote);
  loadRenewal();
}

initRenewal();
