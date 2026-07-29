const renewalAddForm = document.querySelector("#renewal-addForm");
const renewalClassSelect = document.querySelector("#renewal-classSelect");
const renewalStageSelect = document.querySelector("#renewal-stageSelect");
const renewalMessage = document.querySelector("#renewal-message");
const renewalTeacherPanel = document.querySelector("#renewal-teacherPanel");
const renewalTeacherList = document.querySelector("#renewal-teacherList");
const renewalTeacherActiveLabel = document.querySelector("#renewal-teacherActiveLabel");
const renewalStageBoard = document.querySelector("#renewal-stageBoard");
const renewalGoalPanel = document.querySelector("#renewal-goalPanel");
const renewalGoalBody = document.querySelector("#renewal-goalBody");
const renewalGoalMonth = document.querySelector("#renewal-goalMonth");
const renewalGoalSummary = document.querySelector("#renewal-goalSummary");
const renewalGoalRows = document.querySelector("#renewal-goalRows");
const renewalIntentOverview = document.querySelector("#renewal-intentOverview");
const renewalFollowupOverview = document.querySelector("#renewal-followupOverview");
const renewalSectionHub = document.querySelector("#renewal-sectionHub");
const renewalSectionToolbar = document.querySelector("#renewal-sectionToolbar");
const renewalSectionBack = document.querySelector("#renewal-sectionBack");
const renewalSectionTitle = document.querySelector("#renewal-sectionTitle");
const renewalMenuButton = document.querySelector('.side-menu-item[data-module="续费"]');
const renewalMenuBadge = document.querySelector("#renewal-menuBadge");
const renewalAddPanel = document.querySelector(".renewal-add-shell");
const renewalDetailView = document.querySelector("#renewal-detailView");
const renewalBackButton = document.querySelector("#renewal-backButton");
const renewalDetailTitle = document.querySelector("#renewal-detailTitle");
const renewalDetailMeta = document.querySelector("#renewal-detailMeta");
const renewalDetailSummary = document.querySelector("#renewal-detailSummary");
const renewalStudentList = document.querySelector("#renewal-studentList");
const renewalWeekSelect = document.querySelector("#renewal-weekSelect");
const renewalModule = document.querySelector('[data-module-panel="续费"]');

const RENEWAL_PREP_STAGE = "铺垫阶段";
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
const RENEWAL_FOLLOWUP_PRIORITIES = ["重点跟进", "高意向", "可继续沟通", "暂缓跟进"];
const RENEWAL_FOLLOWUP_METHODS = ["私信", "电话"];
const RENEWAL_LEADER_ACTION_TYPES = ["留言", "去电", "跟进"];
const RENEWAL_BLOCKER_OPTIONS = ["升初中", "时间紧张", "经济", "学员问题", "线下", "效果不满意", "不知道顾虑", "不回复", "拒绝早报"];
const RENEWAL_ADD_BLOCKER_VALUE = "__add_current_blocker__";
const RENEWAL_WEEK_STORAGE_KEY = "pu6RenewalSelectedWeek";
const RENEWAL_MESSAGE_TALK_TYPE = "留言推荐";
const RENEWAL_ALL_TEACHERS = "__all_teachers__";
const RENEWAL_RATE_TIERS = [0.3, 0.35, 0.4, 0.45, 0.5];
const DEFAULT_RENEWAL_WEEKS = [
  { key: "1", label: "第一周" },
  { key: "2", label: "第二周" },
  { key: "3", label: "第三周" },
  { key: "4", label: "第四周" },
];
const RENEWAL_WEEK_LABELS = ["第一周", "第二周", "第三周", "第四周", "第五周", "第六周", "第七周", "第八周"];

function isRenewalFourWeekStage(projectOrStage) {
  const stage = typeof projectOrStage === "string" ? projectOrStage : projectOrStage?.stage;
  return stage === RENEWAL_FIRST_MONTH_STAGE || stage === RENEWAL_SECOND_MONTH_STAGE;
}

function isRenewalSingleFollowupStage(projectOrStage) {
  const stage = typeof projectOrStage === "string" ? projectOrStage : projectOrStage?.stage;
  return stage === RENEWAL_CLOSING_STAGE;
}

function renewalWeekOptions(project = null) {
  const projectOptions = Array.isArray(project?.followup_week_options) ? project.followup_week_options : [];
  const dataOptions = Array.isArray(renewalData?.followup_week_options) ? renewalData.followup_week_options : [];
  const options = projectOptions.length ? projectOptions : dataOptions;
  const normalized = options
    .map((week, index) => {
      const key = String(week?.key || index + 1);
      return {
        key,
        label: String(week?.label || RENEWAL_WEEK_LABELS[Number(key) - 1] || `第${key}周`),
      };
    })
    .filter((week) => week.key);
  return normalized.length ? normalized : DEFAULT_RENEWAL_WEEKS;
}

let renewalData = null;
let draggedRenewalProjectId = "";
let renewalShowEnrolledStudents = false;
let renewalNoteTooltip = null;
let renewalActiveDetailProject = null;
let renewalActiveDetailData = null;
let renewalSelectedWeekKey = "";
let renewalSelectedTeacherId = RENEWAL_ALL_TEACHERS;
let renewalTeacherPanelExpanded = false;
let renewalGoalPanelExpanded = false;
let renewalIntentOverviewExpanded = false;
let renewalFollowupOverviewExpanded = true;
let renewalOverviewDate = todayRenewalDateValue();
let renewalFollowupExpandedClasses = new Set();
let renewalActiveSection = "home";
let renewalActiveNoteContext = null;
let renewalNoteHideTimer = null;
let renewalNoteEditorModal = null;
let renewalNoteEditorResolve = null;
let renewalFollowupDateFilter = "";

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

function isRenewalInteractiveClick(target) {
  return Boolean(target?.closest("input, select, textarea, button, a, label, [contenteditable='true']"));
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
  const todayCount = Number(teacher.today_followup_count || 0);
  const pendingPlans = Number(teacher.pending_leader_plan_count || 0);
  return `
    <button
      class="renewal-teacher-card${isActive ? " is-active" : ""}"
      type="button"
      data-renewal-teacher="${escapeRenewalText(teacher.teacher_id)}"
    >
      <strong>${escapeRenewalText(teacher.teacher_name || teacher.teacher_id || "未命名老师")}</strong>
      <span>总续费班级 ${Number(teacher.project_count || 0)} 个</span>
      <span>今日跟进 ${todayCount} 人</span>
      <small class="${pendingPlans ? "has-pending" : ""}">盘单待跟进 ${pendingPlans} 条</small>
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
  renewalTeacherPanel.classList.toggle("is-collapsed", !renewalTeacherPanelExpanded);
  renewalTeacherList.classList.toggle("is-hidden", !renewalTeacherPanelExpanded);
  const teachers = getRenewalTeacherOptions();
  const projects = renewalData?.projects || [];
  const totalTodayFollowups = teachers.reduce((sum, teacher) => sum + Number(teacher.today_followup_count || 0), 0);
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
        <span>总续费班级 ${projects.length} 个</span>
        <span>今日跟进 ${totalTodayFollowups} 人</span>
        <small class="${totalPendingPlans ? "has-pending" : ""}">盘单待跟进 ${totalPendingPlans} 条</small>
      </button>
    `,
    ...teachers.map(renderRenewalTeacherCard),
  ].join("");
}

function renewalSectionLabel(section) {
  const labels = {
    followup: "今日跟进",
    goals: "本月目标",
    projects: "续费班级",
    intent: "意向看板",
    teachers: "老师跟进",
  };
  return labels[section] || "续费项目";
}

function renewalHubGoalSummary(projects = []) {
  const targetProjects = renewalTargetProjects(projects);
  const summary = renewalGoalSummaryFor(targetProjects);
  if (!targetProjects.length) {
    return { value: "未设置", meta: "进入后设置本月目标", tone: "muted" };
  }
  const gap = summary.target_gap;
  return {
    value: gap === null ? "未设置" : gap > 0 ? `还差${gap}` : "已达成",
    meta: `目标 ${summary.target_count || "-"} · 已报 ${summary.month_enrolled_count}`,
    tone: gap > 0 || gap === null ? "warning" : "success",
  };
}

function renewalHubIntentSummary(projects = []) {
  const keyCount = projects.reduce((sum, project) => {
    const summary = renewalIntentSummary(project);
    return sum + renewalIntentCount(summary, "priority", "重点跟进") + renewalIntentCount(summary, "priority", "高意向");
  }, 0);
  return {
    value: keyCount,
    meta: "重点/高意向学员",
    tone: keyCount ? "warning" : "muted",
  };
}

function renewalHubCards(projects = []) {
  const overview = renewalOverviewForActiveTeacher();
  const goal = renewalHubGoalSummary(projects);
  const intentProjects = renewalData?.can_manage_all ? renewalData.projects || [] : projects;
  const intent = renewalHubIntentSummary(intentProjects);
  const teacherCount = (renewalData?.teacher_overview || []).length;
  const cards = [
    {
      section: "followup",
      title: "今日跟进",
      value: Number(overview.student_count || 0),
      meta: `${Number(overview.project_count || 0)} 个班级 · ${Number(overview.teacher_count || 0)} 位老师`,
      tone: Number(overview.student_count || 0) ? "success" : "muted",
    },
    {
      section: "goals",
      title: "本月目标",
      value: goal.value,
      meta: goal.meta,
      tone: goal.tone,
    },
    {
      section: "projects",
      title: "续费班级",
      value: projects.length,
      meta: "添加班级、进入跟进、移动阶段",
      tone: projects.length ? "default" : "muted",
    },
  ];
  if (renewalData?.can_manage_all) {
    cards.push(
      {
        section: "intent",
        title: "意向看板",
        value: intent.value,
        meta: intent.meta,
        tone: intent.tone,
      },
      {
        section: "teachers",
        title: "老师跟进",
        value: teacherCount,
        meta: "按老师查看续费项目",
        tone: teacherCount ? "default" : "muted",
      }
    );
  }
  return cards.filter((card) => card.section !== "teachers");
}

function renderRenewalSectionHub(projects = []) {
  if (!renewalSectionHub) return;
  renewalSectionHub.innerHTML = renewalHubCards(projects).map((card) => `
    <button class="renewal-hub-card is-${escapeRenewalText(card.tone)}" type="button" data-renewal-section="${escapeRenewalText(card.section)}">
      <span>${escapeRenewalText(card.title)}</span>
      <strong>${escapeRenewalText(card.value)}</strong>
      <small>${escapeRenewalText(card.meta)}</small>
    </button>
  `).join("");
}

function setRenewalSection(section) {
  renewalActiveSection = section || "home";
  if (renewalActiveSection === "goals") renewalGoalPanelExpanded = true;
  if (renewalActiveSection === "intent") renewalIntentOverviewExpanded = true;
  if (renewalActiveSection === "followup") renewalFollowupOverviewExpanded = true;
  if (renewalActiveSection === "teachers") renewalTeacherPanelExpanded = true;
  if (renewalData) renderRenewal(renewalData);
}

function applyRenewalSectionVisibility() {
  const allProjects = renewalData?.projects || [];
  const visibleProjects = renewalProjectsForActiveTeacher(renewalData?.projects || []);
  const isDetail = !renewalDetailView?.classList.contains("is-hidden");
  const isHome = renewalActiveSection === "home" && !isDetail;
  const targetProjects = renewalTargetProjects(visibleProjects);
  renewalSectionHub?.classList.toggle("is-hidden", !isHome);
  renewalSectionToolbar?.classList.toggle("is-hidden", isHome || isDetail);
  if (renewalSectionTitle) renewalSectionTitle.textContent = renewalSectionLabel(renewalActiveSection);
  renewalAddPanel?.classList.toggle("is-hidden", isDetail || renewalActiveSection !== "projects");
  renewalTeacherPanel?.classList.toggle("is-hidden", isDetail || renewalActiveSection !== "projects" || !renewalData?.can_manage_all);
  renewalFollowupOverview?.classList.toggle("is-hidden", isDetail || renewalActiveSection !== "followup" || !visibleProjects.length);
  renewalGoalPanel?.classList.toggle("is-hidden", isDetail || renewalActiveSection !== "goals" || !targetProjects.length);
  renewalIntentOverview?.classList.toggle("is-hidden", isDetail || renewalActiveSection !== "intent" || !(renewalData?.can_manage_all && allProjects.length));
  renewalStageBoard?.classList.toggle("is-hidden", isDetail || renewalActiveSection !== "projects");
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

function renewalStatusClass(status) {
  if (status === "愿意继续学") return "is-willing";
  if (status === "需要考虑") return "is-considering";
  if (status === "拒绝") return "is-refused";
  if (status === "未接听") return "is-unanswered";
  return "is-empty";
}

function renewalBlockerClass(blocker) {
  const text = String(blocker || "").trim();
  if (!text) return "is-empty";
  if (text.includes("升")) return "is-transition";
  if (text.includes("时间")) return "is-time";
  if (text.includes("经济")) return "is-money";
  if (text.includes("学员")) return "is-student";
  if (text.includes("线下")) return "is-offline";
  if (text.includes("效果")) return "is-effect";
  if (text.includes("不回")) return "is-no-reply";
  if (text.includes("拒绝")) return "is-refused";
  if (text.includes("不知道") || text.includes("顾虑")) return "is-unknown";
  return "is-custom";
}

function renewalPriorityClass(priority) {
  if (priority === "重点跟进") return "is-key";
  if (priority === "高意向") return "is-high";
  if (priority === "可继续沟通") return "is-warm";
  if (priority === "暂缓跟进") return "is-paused";
  return "is-empty";
}

function renderRenewalPriorityOptions(activePriority) {
  const priorities = renewalData?.followup_priorities || RENEWAL_FOLLOWUP_PRIORITIES;
  return [
    `<option value="">无标记</option>`,
    ...priorities.map((priority) => `
      <option value="${escapeRenewalText(priority)}"${priority === activePriority ? " selected" : ""}>
        ${escapeRenewalText(priority)}
      </option>
    `),
  ].join("");
}

function renderRenewalPrioritySelect(project, student, disabledAttr) {
  const priority = student.followup_priority || "";
  return `
    <select
      class="renewal-priority-select ${renewalPriorityClass(priority)}"
      data-renewal-followup-priority="${escapeRenewalText(project.id)}"
      data-renewal-student-id="${escapeRenewalText(student.id)}"
      title="跟进优先级"
      ${disabledAttr}
    >
      ${renderRenewalPriorityOptions(priority)}
    </select>
  `;
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

function renewalTalkPreviewText(track) {
  return [
    track.scene ? `场景：${track.scene}` : "",
    track.keywords ? `关键词：${track.keywords}` : "",
    String(track.text || "").trim(),
  ].filter(Boolean).join("\n\n");
}

function getRenewalTalkCandidates(student, keyword, limit = 32) {
  const searchKeyword = String(keyword || student?.leader_talk_keyword || student?.leader_note || "").trim();
  const sourceTracks = getRenewalLibraryTalkTracks();
  const scoredTracks = sourceTracks
    .map((track) => ({ track, ...renewalTalkMatch(track, searchKeyword) }))
    .sort((a, b) => (b.score - a.score) || (Number(b.track.priority || 0) - Number(a.track.priority || 0)));
  const matchedTracks = searchKeyword
    ? scoredTracks.filter((item) => item.matched)
    : scoredTracks;
  return {
    sourceTracks,
    matchedTracks,
    tracks: matchedTracks.slice(0, limit).map((item) => item.track),
    searchKeyword,
  };
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
  const { sourceTracks, matchedTracks, tracks, searchKeyword } = getRenewalTalkCandidates(student, keyword, 32);

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
        title="${escapeRenewalAttr(renewalTalkPreviewText(track))}"
        ${renewalTalkMatchesSelected(track, student) ? " selected" : ""}
      >${escapeRenewalText(renewalTalkLabel(track, searchKeyword))}</option>
    `),
  ].join("");
}

function renderRenewalTalkCandidateButtons(project, student, keyword) {
  const { sourceTracks, matchedTracks, tracks, searchKeyword } = getRenewalTalkCandidates(student, keyword, 4);
  if (!sourceTracks.length) {
    return `<div class="renewal-leader-talk-candidate-wrap" data-renewal-talk-candidates><div class="renewal-leader-talk-empty">暂无留言推荐</div></div>`;
  }
  if (searchKeyword && !matchedTracks.length) {
    return `<div class="renewal-leader-talk-candidate-wrap" data-renewal-talk-candidates><div class="renewal-leader-talk-empty">没有匹配留言，可直接写自定义留言</div></div>`;
  }
  if (!tracks.length) return `<div class="renewal-leader-talk-candidate-wrap" data-renewal-talk-candidates></div>`;
  return `
    <div class="renewal-leader-talk-candidate-wrap" data-renewal-talk-candidates>
      <div class="renewal-leader-talk-candidates" aria-label="留言话术候选">
        ${tracks.map((track) => `
          <button
            class="renewal-leader-talk-candidate"
            type="button"
            data-renewal-select-talk="${escapeRenewalText(project.id)}"
            data-renewal-student-id="${escapeRenewalText(student.id)}"
            data-renewal-talk-id="${escapeRenewalAttr(track.id)}"
            data-renewal-talk-preview="${escapeRenewalAttr(renewalTalkPreviewText(track))}"
            title="悬停预览完整话术，点击选用"
          >
            <span>${escapeRenewalText(renewalTalkLabel(track, searchKeyword))}</span>
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function findRenewalTalkTrackById(trackId) {
  return getRenewalLibraryTalkTracks().find((track) => track.id === trackId) || null;
}

function refreshRenewalTalkSelectOptions(input) {
  const plan = input?.closest(".renewal-leader-plan");
  const select = plan?.querySelector("[data-renewal-leader-talk]");
  const candidateWrap = plan?.querySelector("[data-renewal-talk-candidates]");
  const previousValue = select?.value || "";
  const savedKeyword = select?.dataset?.renewalTalkKeyword || "";
  const shouldKeepSelection = String(input.value || "").trim() === String(savedKeyword || "").trim();
  const selectedStudent = {
    leader_talk_title: shouldKeepSelection ? select?.dataset?.renewalTalkTitle || "" : "",
    leader_talk_text: shouldKeepSelection ? select?.dataset?.renewalTalkText || "" : "",
    leader_talk_type: shouldKeepSelection ? select?.dataset?.renewalTalkType || "" : "",
    leader_talk_keyword: input.value,
    leader_note: input.value,
    id: input.dataset.renewalStudentId || select?.dataset?.renewalStudentId || "",
  };
  if (select) {
    select.innerHTML = renderRenewalTalkOptions(selectedStudent, input.value);
  }
  if (select && Array.from(select.options).some((option) => option.value === previousValue)) {
    select.value = previousValue;
  }
  if (candidateWrap) {
    candidateWrap.outerHTML = renderRenewalTalkCandidateButtons(
      { id: input.dataset.renewalLeaderNote || select?.dataset?.renewalLeaderTalk || "" },
      selectedStudent,
      input.value
    );
  }
}

function saveRenewalLeaderTalkSelection(projectId, studentId, selectedTrack, keyword = "") {
  return updateRenewalStudent(
    projectId,
    studentId,
    {
      leader_note: "",
      leader_action_type: "留言",
      leader_talk_keyword: selectedTrack ? keyword : "",
      leader_talk_type: selectedTrack ? RENEWAL_MESSAGE_TALK_TYPE : "",
      leader_talk_title: selectedTrack?.scene || "",
      leader_talk_text: selectedTrack?.text || "",
    },
    { successMessage: selectedTrack ? "留言话术已选择，关键词已清空。" : "盘单话术已清空。" }
  );
}

function saveRenewalLeaderTextPlan(trigger) {
  const projectId = trigger?.dataset?.renewalLeaderTextSave || trigger?.dataset?.renewalLeaderTextNote;
  const studentId = trigger?.dataset?.renewalStudentId;
  const mode = trigger?.dataset?.renewalLeaderPlanMode === "call" ? "call" : "custom";
  const plan = trigger?.closest(".renewal-leader-plan");
  const input = plan?.querySelector(`[data-renewal-leader-text-note][data-renewal-leader-plan-mode="${mode}"]`);
  const noteText = String(input?.value || "").trim();
  if (!projectId || !studentId || !input) return null;
  return updateRenewalStudent(
    projectId,
    studentId,
    {
      leader_action_type: mode === "call" ? "去电" : "跟进",
      leader_note: noteText,
      leader_talk_keyword: "",
      leader_talk_type: "",
      leader_talk_title: "",
      leader_talk_text: "",
    },
    { successMessage: noteText ? "盘单内容已保存。" : "盘单内容已清空。" }
  );
}

function setRenewalLeaderEditorMode(button) {
  const plan = button?.closest(".renewal-leader-plan");
  const mode = button?.dataset?.renewalLeaderModeButton || "";
  if (!plan || !mode) return;
  plan.querySelectorAll("[data-renewal-leader-mode-button]").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.renewalLeaderModeButton === mode);
  });
  plan.querySelectorAll("[data-renewal-leader-mode-panel]").forEach((panel) => {
    panel.classList.toggle("is-hidden", panel.dataset.renewalLeaderModePanel !== mode);
  });
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
  const weeks = renewalWeekOptions(project);
  const activeWeekKey = getRenewalSelectedWeekKey(project);
  renewalWeekSelect.innerHTML = weeks.map((week) => `
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

function formatRenewalCount(value, emptyText = "未定") {
  if (value === null || value === undefined || value === "") return emptyText;
  const number = Number(value);
  if (Number.isNaN(number)) return emptyText;
  return String(Math.max(0, Math.trunc(number)));
}

function renewalTargetValue(project) {
  if (project?.target_count === null || project?.target_count === undefined || project?.target_count === "") return "";
  const number = Number(project.target_count);
  return Number.isNaN(number) ? "" : String(Math.max(0, Math.trunc(number)));
}

function renewalManualEnrolledValue(project) {
  if (project?.manual_enrolled_count === null || project?.manual_enrolled_count === undefined || project?.manual_enrolled_count === "") return "";
  const number = Number(project.manual_enrolled_count);
  return Number.isNaN(number) ? "" : String(Math.max(0, Math.trunc(number)));
}

function renderRenewalEnrolledMetric(project, disabledAttr = "", tagName = "div") {
  const enrolledCount = Number(project?.enrolled_count || 0);
  const isOverridden = Boolean(project?.enrolled_count_overridden);
  const projectId = escapeRenewalText(project?.id || "");
  const tag = tagName === "article" ? "article" : "div";
  return `
    <${tag} class="renewal-editable-metric${isOverridden ? " is-overridden" : ""}" title="双击编辑已报名人数">
      <span>已报名 / 续报率</span>
      <strong
        tabindex="${disabledAttr ? "-1" : "0"}"
        data-renewal-enrolled-count="${projectId}"
        data-renewal-enrolled-value="${escapeRenewalText(String(enrolledCount))}"
        data-renewal-enrolled-manual="${escapeRenewalText(renewalManualEnrolledValue(project))}"
      >${enrolledCount} 人</strong>
      <small>${escapeRenewalText(formatRenewalRate(project?.renewal_rate))}</small>
    </${tag}>
  `;
}

function renewalTargetGapText(project) {
  if (project?.target_gap === null || project?.target_gap === undefined || project?.target_gap === "") return "先定目标";
  const gap = Number(project.target_gap || 0);
  return gap > 0 ? `本月还差 ${gap}` : "本月已达成";
}

function renewalGapClass(value) {
  if (value === null || value === undefined || value === "") return "is-unset";
  return Number(value || 0) > 0 ? "is-behind" : "is-done";
}

function renewalNextTierInfo(project) {
  const studentCount = Number(project?.student_count || 0);
  const enrolledCount = Number(project?.enrolled_count || 0);
  if (!studentCount) {
    return {
      label: "暂无续费人数，暂不能计算跳档差距。",
      gap: null,
      tier: null,
    };
  }
  for (const tier of RENEWAL_RATE_TIERS) {
    const targetCount = Math.ceil(studentCount * tier);
    if (enrolledCount < targetCount) {
      const gap = Math.max(0, targetCount - enrolledCount);
      return {
        label: `距离 ${formatRenewalRate(tier * 100)} 档还差 ${gap} 人`,
        gap,
        tier,
      };
    }
  }
  return {
    label: "已达到最高续费率档位。",
    gap: 0,
    tier: RENEWAL_RATE_TIERS[RENEWAL_RATE_TIERS.length - 1],
  };
}

function renewalGoalRowTooltip(project) {
  return [
    project?.class_name || "",
    `当前续费率：${formatRenewalRate(project?.renewal_rate)}`,
    renewalNextTierInfo(project).label,
  ].filter(Boolean).join("\n");
}

function renewalIntentSummary(project) {
  const summary = project?.intent_summary || {};
  return {
    student_count: Number(summary.student_count || project?.student_count || 0),
    completion_over_60_count: Number(summary.completion_over_60_count || 0),
    status_counts: summary.status_counts || {},
    priority_counts: summary.priority_counts || {},
    enrolled_count: Number(summary.enrolled_count || project?.enrolled_count || 0),
  };
}

function renewalIntentCount(summary, group, key, fallbackKey = "") {
  const counts = group === "status" ? summary.status_counts : summary.priority_counts;
  return Number(counts?.[key] ?? (fallbackKey ? counts?.[fallbackKey] : 0) ?? 0);
}

function renewalIntentItems(project) {
  const summary = renewalIntentSummary(project);
  if (project?.stage === RENEWAL_PREP_STAGE) {
    return [
      { label: "完课60%+", value: summary.completion_over_60_count, tone: "completion" },
      { label: "愿意继续学", value: renewalIntentCount(summary, "status", "愿意继续学"), tone: "positive" },
      { label: "需要考虑", value: renewalIntentCount(summary, "status", "需要考虑"), tone: "warm" },
      { label: "拒绝", value: renewalIntentCount(summary, "status", "拒绝"), tone: "danger" },
      { label: "未接听", value: renewalIntentCount(summary, "status", "未接听"), tone: "muted" },
    ];
  }
  return [
    { label: "重点跟进", value: renewalIntentCount(summary, "priority", "重点跟进"), tone: "danger" },
    { label: "高意向", value: renewalIntentCount(summary, "priority", "高意向"), tone: "positive" },
    { label: "可持续跟进", value: renewalIntentCount(summary, "priority", "可继续沟通", "可持续跟进"), tone: "warm" },
    { label: "本月新增报名", value: Number(project?.month_enrolled_count || 0), tone: "completion" },
    { label: "总报名量", value: summary.enrolled_count, tone: "completion" },
    { label: "续报率", value: formatRenewalRate(project?.renewal_rate), tone: "completion" },
  ];
}

function renewalIntentBoardTitle(project) {
  return project?.stage === RENEWAL_PREP_STAGE ? "铺垫情况数据" : "意向跟进数据";
}

function renderRenewalIntentStats(project, mode = "detail") {
  const items = renewalIntentItems(project);
  return `
    <div class="renewal-intent-stats renewal-intent-stats-${mode}">
      ${items.map((item) => `
        <span class="renewal-intent-stat is-${escapeRenewalText(item.tone)}">
          <em>${escapeRenewalText(item.label)}</em>
          <strong>${escapeRenewalText(item.value ?? 0)}</strong>
        </span>
      `).join("")}
    </div>
  `;
}

function renderRenewalDetailIntentCard(project) {
  return `
    <article class="renewal-intent-summary-card">
      <div class="renewal-intent-summary-head">
        <span>${escapeRenewalText(renewalIntentBoardTitle(project))}</span>
        <small>${project?.stage === RENEWAL_PREP_STAGE ? "按铺垫电话填写情况统计" : "按老师标记的意向度统计"}</small>
      </div>
      ${renderRenewalIntentStats(project, "detail")}
    </article>
  `;
}

function renewalIntentOverviewProjects(projects = []) {
  return [...projects].sort((first, second) => {
    const firstTeacher = first.teacher_name || first.teacher_id || "";
    const secondTeacher = second.teacher_name || second.teacher_id || "";
    const teacherOrder = firstTeacher.localeCompare(secondTeacher, "zh-Hans-CN");
    if (teacherOrder) return teacherOrder;
    const classOrder = String(first.class_name || "").localeCompare(String(second.class_name || ""), "zh-Hans-CN");
    if (classOrder) return classOrder;
    return String(first.stage || "").localeCompare(String(second.stage || ""), "zh-Hans-CN");
  });
}

function renewalIntentTeacherKey(project) {
  return project?.teacher_id || project?.teacher_name || "-";
}

function renewalIntentOverviewCell(value, tone = "", muted = false) {
  const displayValue = value === null || value === undefined || value === "" ? "-" : value;
  return `<td class="renewal-intent-count-cell ${tone ? `is-${escapeRenewalText(tone)}` : ""}${muted ? " is-muted-value" : ""}">${escapeRenewalText(displayValue)}</td>`;
}

function renewalIntentOverviewMetric(project, type, key, fallbackKey = "") {
  return renewalIntentCount(renewalIntentSummary(project), type, key, fallbackKey);
}

function renderRenewalIntentOverview(projects = []) {
  if (!renewalIntentOverview) return;
  const overviewProjects = renewalIntentOverviewProjects(projects);
  const shouldShow = Boolean(renewalData?.can_manage_all && overviewProjects.length);
  renewalIntentOverview.classList.toggle("is-hidden", !shouldShow);
  renewalIntentOverview.classList.toggle("is-collapsed", !renewalIntentOverviewExpanded);
  if (!shouldShow) {
    renewalIntentOverview.innerHTML = "";
    return;
  }

  const teacherCount = new Set(overviewProjects.map(renewalIntentTeacherKey)).size;
  const titleSuffix = `${teacherCount} 位老师 · ${overviewProjects.length} 个续费班级`;
  let previousTeacherKey = "";
  const rowsHtml = overviewProjects.map((project) => {
    const teacherKey = renewalIntentTeacherKey(project);
    const isGroupStart = teacherKey !== previousTeacherKey;
    previousTeacherKey = teacherKey;
    const summary = renewalIntentSummary(project);
    const isPrepStage = project.stage === RENEWAL_PREP_STAGE;
    return `
      <tr class="${isGroupStart ? "is-group-start" : ""}">
        <td class="renewal-intent-teacher-cell">${escapeRenewalText(project.teacher_name || "-")}</td>
        <td>${escapeRenewalText(project.class_name || "-")}</td>
        <td>${escapeRenewalText(project.stage || "-")}</td>
        ${renewalIntentOverviewCell(summary.student_count || project.student_count || 0)}
        ${renewalIntentOverviewCell(isPrepStage ? summary.completion_over_60_count || 0 : "-", "completion", !isPrepStage)}
        ${renewalIntentOverviewCell(isPrepStage ? renewalIntentOverviewMetric(project, "status", "愿意继续学") : "-", "positive", !isPrepStage)}
        ${renewalIntentOverviewCell(isPrepStage ? renewalIntentOverviewMetric(project, "status", "需要考虑") : "-", "warm", !isPrepStage)}
        ${renewalIntentOverviewCell(isPrepStage ? renewalIntentOverviewMetric(project, "status", "拒绝") : "-", "danger", !isPrepStage)}
        ${renewalIntentOverviewCell(isPrepStage ? renewalIntentOverviewMetric(project, "status", "未接听") : "-", "muted", !isPrepStage)}
        ${renewalIntentOverviewCell(isPrepStage ? "-" : renewalIntentOverviewMetric(project, "priority", "重点跟进"), "danger", isPrepStage)}
        ${renewalIntentOverviewCell(isPrepStage ? "-" : renewalIntentOverviewMetric(project, "priority", "高意向"), "positive", isPrepStage)}
        ${renewalIntentOverviewCell(isPrepStage ? "-" : renewalIntentOverviewMetric(project, "priority", "可继续沟通", "可持续跟进"), "warm", isPrepStage)}
        ${renewalIntentOverviewCell(isPrepStage ? "-" : Number(project.month_enrolled_count || 0), "completion", isPrepStage)}
        ${renewalIntentOverviewCell(isPrepStage ? "-" : summary.enrolled_count || project.enrolled_count || 0, "completion", isPrepStage)}
        ${renewalIntentOverviewCell(isPrepStage ? "-" : formatRenewalRate(project.renewal_rate), "completion", isPrepStage)}
      </tr>
    `;
  }).join("");
  renewalIntentOverview.innerHTML = `
    <div class="renewal-intent-overview-head">
      <div>
        <h2>续费意向看板</h2>
        <span>${escapeRenewalText(titleSuffix)}</span>
      </div>
    </div>
    <div class="renewal-intent-overview-body${renewalIntentOverviewExpanded ? "" : " is-hidden"}">
      <div class="renewal-intent-overview-table-wrap">
        <table class="renewal-intent-overview-table">
          <thead>
            <tr>
              <th rowspan="2">老师</th>
              <th rowspan="2">班级</th>
              <th rowspan="2">阶段</th>
              <th rowspan="2">人数</th>
              <th colspan="5">铺垫阶段</th>
              <th colspan="6">续费阶段</th>
            </tr>
            <tr>
              <th>完课60%+</th>
              <th>愿意</th>
              <th>考虑</th>
              <th>拒绝</th>
              <th>未接听</th>
              <th>重点</th>
              <th>高意向</th>
              <th>可继续</th>
              <th>本月新增</th>
              <th>总报名</th>
              <th>续费率</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function todayRenewalDateValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function renewalOverviewForActiveTeacher() {
  const overview = renewalData?.followup_overview || {
    date: renewalOverviewDate || todayRenewalDateValue(),
    date_label: "",
    teacher_count: 0,
    project_count: 0,
    student_count: 0,
    teachers: [],
  };
  const teachers = Array.isArray(overview.teachers) ? overview.teachers : [];
  if (!renewalData?.can_manage_all || renewalSelectedTeacherId === RENEWAL_ALL_TEACHERS) {
    return { ...overview, teachers };
  }
  const filteredTeachers = teachers.filter((teacher) => teacher.teacher_id === renewalSelectedTeacherId);
  const rows = filteredTeachers.flatMap((teacher) => teacher.rows || []);
  return {
    ...overview,
    teachers: filteredTeachers,
    teacher_count: filteredTeachers.filter((teacher) => Number(teacher.student_count || 0) > 0).length,
    project_count: new Set(rows.map((row) => row.project_id).filter(Boolean)).size,
    student_count: rows.length,
  };
}

function renewalOverviewSummaryText(overview) {
  const dateLabel = overview?.date_label || overview?.date || "今日";
  const teacherCount = Number(overview?.teacher_count || 0);
  const projectCount = Number(overview?.project_count || 0);
  const studentCount = Number(overview?.student_count || 0);
  return `${dateLabel} · ${teacherCount} 位老师 · ${projectCount} 个班级 · ${studentCount} 人`;
}

function renderRenewalFollowupRow(row) {
  const methods = Array.isArray(row.methods) && row.methods.length ? row.methods.join("、") : "已记录";
  const sourceText = Array.isArray(row.sources) && row.sources.length ? row.sources.join("、") : "";
  const content = String(row.note || "").trim() || (methods === "已记录" ? sourceText || "已跟进" : `${methods}跟进`);
  const meta = [
    row.stage || "",
    sourceText,
    row.latest_time || "",
  ].filter(Boolean).join(" · ");
  return `
    <button
      class="renewal-followup-student"
      type="button"
      data-renewal-followup-open="${escapeRenewalText(row.project_id || "")}"
      title="${escapeRenewalAttr(meta || "点击进入该续费班级")}"
    >
      <strong>${escapeRenewalText(row.student_name || "未命名学员")}</strong>
      <em>${escapeRenewalText(content)}</em>
      <small>${escapeRenewalText(row.latest_time ? row.latest_time.slice(5) : "")}</small>
    </button>
  `;
}

function renewalFollowupClassGroups(rows = []) {
  const groups = [];
  const groupMap = new Map();
  rows.forEach((row) => {
    const key = row.project_id || row.class_name || "unknown";
    if (!groupMap.has(key)) {
      const group = {
        project_id: row.project_id || "",
        class_name: row.class_name || "-",
        stage: row.stage || "",
        rows: [],
      };
      groupMap.set(key, group);
      groups.push(group);
    }
    groupMap.get(key).rows.push(row);
  });
  return groups;
}

function renderRenewalFollowupClassGroup(group) {
  const groupKey = group.project_id || group.class_name || "";
  const isOpen = renewalFollowupExpandedClasses.has(groupKey);
  return `
    <section class="renewal-followup-class-group${isOpen ? " is-open" : ""}">
      <button
        class="renewal-followup-class-head"
        type="button"
        data-renewal-followup-class-toggle="${escapeRenewalAttr(groupKey)}"
        aria-expanded="${isOpen ? "true" : "false"}"
      >
        <strong>${escapeRenewalText(group.class_name || "-")}</strong>
        <span>${escapeRenewalText(group.stage || "")}</span>
        <em>${Number(group.rows?.length || 0)} 人</em>
      </button>
      <div class="renewal-followup-student-list${isOpen ? "" : " is-hidden"}">
        ${(group.rows || []).map(renderRenewalFollowupRow).join("")}
      </div>
    </section>
  `;
}

function renderRenewalFollowupTeacher(teacher) {
  const rows = Array.isArray(teacher.rows) ? teacher.rows : [];
  const classCount = new Set(rows.map((row) => row.project_id).filter(Boolean)).size;
  const pendingPlans = Number(teacher.pending_leader_plan_count || 0);
  const classGroups = renewalFollowupClassGroups(rows);
  return `
    <article class="renewal-followup-teacher${rows.length ? "" : " is-empty"}">
      <div class="renewal-followup-teacher-head">
        <strong>${escapeRenewalText(teacher.teacher_name || teacher.teacher_id || "未命名老师")}</strong>
        <span>跟进 ${rows.length} 人</span>
        <span>涉及 ${classCount} 班</span>
        ${pendingPlans ? `<span class="has-pending">盘单待跟进 ${pendingPlans}</span>` : ""}
      </div>
      ${rows.length
        ? `<div class="renewal-followup-class-list">${classGroups.map(renderRenewalFollowupClassGroup).join("")}</div>`
        : `<div class="renewal-followup-empty">当天暂无跟进记录</div>`
      }
    </article>
  `;
}

function renderRenewalFollowupOverview() {
  if (!renewalFollowupOverview) return;
  const projects = renewalProjectsForActiveTeacher(renewalData?.projects || []);
  const shouldShow = Boolean(projects.length);
  renewalFollowupOverview.classList.toggle("is-hidden", !shouldShow);
  renewalFollowupOverview.classList.toggle("is-collapsed", !renewalFollowupOverviewExpanded);
  if (!shouldShow) {
    renewalFollowupOverview.innerHTML = "";
    return;
  }
  const overview = renewalOverviewForActiveTeacher();
  const activeTeacher = getRenewalSelectedTeacher();
  const titleSuffix = activeTeacher ? activeTeacher.teacher_name || activeTeacher.teacher_id : "全部老师";
  const teachers = Array.isArray(overview.teachers) ? overview.teachers : [];
  renewalFollowupOverview.innerHTML = `
    <div class="renewal-followup-overview-head">
      <div>
        <h2>续费跟进看板</h2>
        <span>${escapeRenewalText(titleSuffix)} · ${escapeRenewalText(renewalOverviewSummaryText(overview))}</span>
      </div>
      <label class="renewal-followup-date-picker">
        <span>日期</span>
        <input
          type="date"
          value="${escapeRenewalText(renewalOverviewDate || overview.date || todayRenewalDateValue())}"
          data-renewal-overview-date
        >
      </label>
    </div>
    <div class="renewal-followup-overview-body${renewalFollowupOverviewExpanded ? "" : " is-hidden"}">
      ${teachers.length
        ? teachers.map(renderRenewalFollowupTeacher).join("")
        : `<div class="empty-state compact-empty">暂无续费班级。</div>`
      }
    </div>
  `;
}

function parseRenewalDateValue(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function getRenewalCurrentWeekKey(project = null, date = new Date()) {
  const weeks = renewalWeekOptions(project);
  const periodStart = parseRenewalDateValue(renewalData?.followup_period?.start_date);
  let weekIndex = 1;
  if (periodStart) {
    const currentDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.floor((currentDate - periodStart) / 86400000);
    weekIndex = diffDays >= 0 ? Math.floor(diffDays / 7) + 1 : 1;
  } else {
    const day = Number(date.getDate()) || 1;
    weekIndex = Math.ceil(day / 7);
  }
  weekIndex = Math.min(weeks.length, Math.max(1, weekIndex));
  return String(weekIndex);
}

function isValidRenewalWeekKey(weekKey, project = null) {
  return renewalWeekOptions(project).some((week) => week.key === String(weekKey));
}

function renewalWeekPeriodSignature() {
  const period = renewalData?.followup_period || {};
  return `${period.start_date || ""}|${period.end_date || ""}`;
}

function getSavedRenewalWeekKey(project = null) {
  try {
    const rawValue = window.localStorage?.getItem(RENEWAL_WEEK_STORAGE_KEY);
    let savedWeek = rawValue;
    let savedPeriod = "";
    try {
      const parsed = JSON.parse(rawValue || "");
      if (parsed && typeof parsed === "object") {
        savedWeek = parsed.week;
        savedPeriod = parsed.period || "";
      }
    } catch (error) {
      savedPeriod = "";
    }
    const currentPeriod = renewalWeekPeriodSignature();
    if (currentPeriod && savedPeriod && savedPeriod !== currentPeriod) return getRenewalCurrentWeekKey(project);
    if (currentPeriod && !savedPeriod && renewalData?.followup_period?.is_custom) return getRenewalCurrentWeekKey(project);
    if (isValidRenewalWeekKey(savedWeek, project)) return savedWeek;
  } catch (error) {
    // Ignore storage issues and fall back to the date-based default.
  }
  return getRenewalCurrentWeekKey(project);
}

function getRenewalSelectedWeekKey(project = null) {
  if (!isValidRenewalWeekKey(renewalSelectedWeekKey, project)) {
    renewalSelectedWeekKey = getSavedRenewalWeekKey(project);
  }
  return renewalSelectedWeekKey;
}

function setRenewalSelectedWeekKey(weekKey, project = null) {
  const nextWeekKey = isValidRenewalWeekKey(weekKey, project) ? String(weekKey) : getRenewalCurrentWeekKey(project);
  renewalSelectedWeekKey = nextWeekKey;
  try {
    window.localStorage?.setItem(RENEWAL_WEEK_STORAGE_KEY, JSON.stringify({
      week: nextWeekKey,
      period: renewalWeekPeriodSignature(),
    }));
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

function renewalDateKey(value) {
  const text = String(value || "").trim();
  const match = text.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
}

function renewalFollowupRecordsForFilter(project, student) {
  if (isRenewalFourWeekStage(project)) {
    return getRenewalWeekInfo(student, getRenewalSelectedWeekKey()).records || [];
  }
  const records = getRenewalGeneralInfo(student).records || [];
  if (records.length) return records;
  const followedDate = renewalDateKey(student.followup_time);
  return followedDate ? [{ date: followedDate, date_label: followedDate }] : [];
}

function renewalStudentFollowupDates(project, student) {
  return Array.from(new Set(
    renewalFollowupRecordsForFilter(project, student)
      .map((record) => renewalDateKey(record.date || record.created_at || record.date_label))
      .filter(Boolean)
  ));
}

function renewalStudentMatchesFollowupDate(project, student) {
  if (!renewalFollowupDateFilter) return true;
  return renewalStudentFollowupDates(project, student).includes(renewalFollowupDateFilter);
}

function renewalFollowupDateMeta(project, students = []) {
  const dateMap = new Map();
  students.forEach((student) => {
    renewalStudentFollowupDates(project, student).forEach((dateKey) => {
      if (!dateMap.has(dateKey)) dateMap.set(dateKey, []);
      const names = dateMap.get(dateKey);
      const name = String(student.name || student.account || "未命名学员").trim();
      if (name && !names.includes(name)) names.push(name);
    });
  });
  const dates = Array.from(dateMap.keys()).sort().reverse();
  if (renewalFollowupDateFilter && !dateMap.has(renewalFollowupDateFilter)) {
    renewalFollowupDateFilter = "";
  }
  const selectedNames = renewalFollowupDateFilter ? dateMap.get(renewalFollowupDateFilter) || [] : [];
  return { dateMap, dates, selectedNames };
}

function renderRenewalFollowupDateFilter(project, students = []) {
  const { dateMap, dates, selectedNames } = renewalFollowupDateMeta(project, students);
  const disabledAttr = dates.length ? "" : "disabled";
  const summary = renewalFollowupDateFilter
    ? `当天跟进 ${selectedNames.length} 人：${selectedNames.slice(0, 12).join("、")}${selectedNames.length > 12 ? ` 等${selectedNames.length}人` : ""}`
    : dates.length
      ? "选择日期后，可查看当天跟进人数和名单。"
      : "暂无跟进记录。";
  return `
    <div class="renewal-followup-filter">
      <label>
        <span>跟进时间</span>
        <select data-renewal-followup-date-filter ${disabledAttr}>
          <option value="">全部日期</option>
          ${dates.map((dateKey) => `
            <option value="${escapeRenewalText(dateKey)}"${dateKey === renewalFollowupDateFilter ? " selected" : ""}>
              ${escapeRenewalText(dateKey)}（${Number(dateMap.get(dateKey)?.length || 0)}人）
            </option>
          `).join("")}
        </select>
      </label>
      <small>${escapeRenewalText(summary)}</small>
    </div>
  `;
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
  const studentName = String(student.name || "").trim();
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
        <input
          class="renewal-student-name-input"
          type="text"
          value="${escapeRenewalAttr(studentName)}"
          data-renewal-student-name="${escapeRenewalText(project.id)}"
          data-renewal-student-id="${escapeRenewalText(student.id)}"
          data-renewal-original-name="${escapeRenewalAttr(studentName)}"
          aria-label="编辑学员姓名"
          autocomplete="off"
          ${disabledAttr}
        >
        ${renderRenewalPrioritySelect(project, student, disabledAttr)}
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
  const leaderTalkSearchValue = leaderTalkText ? leaderTalkKeyword : "";
  const activeLeaderMode = isCallPlan ? "call" : leaderTalkText ? "talk" : "custom";
  const callLeaderNoteValue = isCallPlan ? leaderNote : "";
  const customLeaderNoteValue = !isCallPlan && !leaderTalkText ? leaderNote : "";
  const hasLeaderPlan = Boolean(leaderNote || leaderTalkText || isCallPlan);
  if (!canManage && !hasLeaderPlan) {
    return `<td class="renewal-leader-plan-cell is-empty"></td>`;
  }
  const leaderActionBadge = isCallPlan
    ? `<span class="renewal-leader-action-badge is-call">去电</span>`
    : leaderActionType === "跟进"
      ? `<span class="renewal-leader-action-badge is-custom">跟进</span>`
      : `<span class="renewal-leader-action-badge">留言</span>`;
  const teacherLeaderNoteText = leaderNote || (leaderTalkText ? "这里有留言需跟进" : isCallPlan ? "组长建议去电了解情况" : "组长有跟进动作需处理");
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
    <div class="renewal-teacher-plan-detail">
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
    </div>
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
        <div class="renewal-leader-mode-row">
          ${[
            ["call", "去电"],
            ["talk", "留言话术"],
            ["custom", "自定义"],
          ].map(([mode, label]) => `
            <button
              class="renewal-leader-mode-button${activeLeaderMode === mode ? " is-active" : ""}"
              type="button"
              data-renewal-leader-mode-button="${mode}"
              ${disabledAttr}
            >${label}</button>
          `).join("")}
        </div>
        <div class="renewal-leader-mode-panel${activeLeaderMode === "call" ? "" : " is-hidden"}" data-renewal-leader-mode-panel="call">
          <textarea
            class="renewal-leader-text-input"
            rows="3"
            maxlength="500"
            data-renewal-leader-text-note="${escapeRenewalText(project.id)}"
            data-renewal-leader-plan-mode="call"
            data-renewal-student-id="${escapeRenewalText(student.id)}"
            placeholder="写一下建议去电时重点沟通什么"
            ${disabledAttr}
          >${escapeRenewalText(callLeaderNoteValue)}</textarea>
          <button
            class="ghost-button compact-button renewal-leader-text-save"
            type="button"
            data-renewal-leader-text-save="${escapeRenewalText(project.id)}"
            data-renewal-leader-plan-mode="call"
            data-renewal-student-id="${escapeRenewalText(student.id)}"
            ${disabledAttr}
          >保存</button>
        </div>
        <div class="renewal-leader-mode-panel${activeLeaderMode === "talk" ? "" : " is-hidden"}" data-renewal-leader-mode-panel="talk">
          <input
            class="renewal-leader-note-input"
            type="text"
            value="${escapeRenewalText(leaderTalkSearchValue)}"
            data-renewal-leader-note="${escapeRenewalText(project.id)}"
            data-renewal-student-id="${escapeRenewalText(student.id)}"
            placeholder="输入关键词匹配留言话术"
            title="${escapeRenewalAttr("输入关键词后，下方会推荐留言话术")}"
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
            ${disabledAttr}
          >
          ${renderRenewalTalkCandidateButtons(project, student, leaderTalkSearchValue)}
        </div>
        <div class="renewal-leader-mode-panel${activeLeaderMode === "custom" ? "" : " is-hidden"}" data-renewal-leader-mode-panel="custom">
          <textarea
            class="renewal-leader-text-input"
            rows="3"
            maxlength="500"
            data-renewal-leader-text-note="${escapeRenewalText(project.id)}"
            data-renewal-leader-plan-mode="custom"
            data-renewal-student-id="${escapeRenewalText(student.id)}"
            placeholder="写给组员的其他跟进动作"
            ${disabledAttr}
          >${escapeRenewalText(customLeaderNoteValue)}</textarea>
          <button
            class="ghost-button compact-button renewal-leader-text-save"
            type="button"
            data-renewal-leader-text-save="${escapeRenewalText(project.id)}"
            data-renewal-leader-plan-mode="custom"
            data-renewal-student-id="${escapeRenewalText(student.id)}"
            ${disabledAttr}
          >保存</button>
        </div>
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

function renewalGoalSummaryFor(projects = []) {
  const targetProjects = projects.filter((project) => project.target_count !== null && project.target_count !== undefined && project.target_count !== "");
  const targetCount = targetProjects.reduce((sum, project) => sum + Number(project.target_count || 0), 0);
  const monthEnrolledCount = projects.reduce((sum, project) => sum + Number(project.month_enrolled_count || 0), 0);
  const enrolledCount = projects.reduce((sum, project) => sum + Number(project.enrolled_count || 0), 0);
  return {
    class_count: projects.length,
    target_projects: targetProjects.length,
    target_count: targetCount,
    month_enrolled_count: monthEnrolledCount,
    enrolled_count: enrolledCount,
    target_gap: targetProjects.length ? Math.max(0, targetCount - monthEnrolledCount) : null,
    target_progress_rate: targetCount ? (monthEnrolledCount / targetCount) * 100 : null,
  };
}

function renewalTargetProjects(projects = []) {
  return projects.filter((project) => project.stage !== RENEWAL_PREP_STAGE);
}

function renderRenewalGoalPanel(projects = []) {
  if (!renewalGoalPanel || !renewalGoalRows || !renewalGoalSummary) return;
  const targetProjects = renewalTargetProjects(projects);
  const shouldShow = Boolean(targetProjects.length);
  renewalGoalPanel.classList.toggle("is-hidden", !shouldShow);
  renewalGoalPanel.classList.toggle("is-collapsed", !renewalGoalPanelExpanded);
  renewalGoalBody?.classList.toggle("is-hidden", !renewalGoalPanelExpanded);
  if (!shouldShow) {
    renewalGoalRows.innerHTML = "";
    renewalGoalSummary.innerHTML = "";
    return;
  }
  const summary = renewalGoalSummaryFor(targetProjects);
  const activeTeacher = getRenewalSelectedTeacher();
  const monthLabel = targetProjects.find((project) => project.target_month)?.target_month || renewalData?.summary?.target_month || "";
  if (renewalGoalMonth) {
    renewalGoalMonth.textContent = `${monthLabel ? `${monthLabel} · ` : ""}${activeTeacher ? activeTeacher.teacher_name || activeTeacher.teacher_id : "整组目标"}`;
  }
  renewalGoalSummary.innerHTML = `
    <span>本月目标 <strong>${summary.target_projects ? summary.target_count : "-"}</strong></span>
    <span>本月已报 <strong>${summary.month_enrolled_count}</strong></span>
    <span class="renewal-goal-summary-gap ${renewalGapClass(summary.target_gap)}">本月还差 <strong>${summary.target_gap === null ? "-" : summary.target_gap}</strong></span>
    <span>达成 <strong>${escapeRenewalText(formatRenewalRate(summary.target_progress_rate))}</strong></span>
  `;
  renewalGoalRows.innerHTML = targetProjects.map((project) => {
    const targetInput = renewalData?.can_manage_all ? `
      <input
        class="renewal-goal-input"
        type="number"
        min="0"
        max="9999"
        step="1"
        value="${escapeRenewalText(renewalTargetValue(project))}"
        placeholder="未定"
        data-renewal-target-count="${escapeRenewalText(project.id)}"
        aria-label="${escapeRenewalText(project.class_name || "班级")} 续费目标"
      >
    ` : `<strong>${escapeRenewalText(formatRenewalCount(project.target_count))}</strong>`;
    const rowTooltip = renewalGoalRowTooltip(project);
    return `
      <tr title="${escapeRenewalAttr(rowTooltip)}">
        <td>${escapeRenewalText(project.teacher_name || "-")}</td>
        <td class="renewal-goal-class-cell" title="${escapeRenewalAttr(rowTooltip)}">${escapeRenewalText(project.class_name || "-")}</td>
        <td>${targetInput}</td>
        <td>${Number(project.month_enrolled_count || 0)}</td>
        <td>
          <span class="renewal-goal-gap-pill ${renewalGapClass(project.target_gap)}">
            ${escapeRenewalText(renewalTargetGapText(project))}
          </span>
        </td>
        <td>${escapeRenewalText(formatRenewalRate(project.target_progress_rate))}</td>
        <td class="renewal-goal-enrolled-cell">
          <strong>${Number(project.enrolled_count || 0)}</strong>
          <small>${escapeRenewalText(formatRenewalRate(project.renewal_rate))}</small>
        </td>
      </tr>
    `;
  }).join("");
}

function renderRenewalProjectTarget(project, disabledAttr) {
  if (project?.stage === RENEWAL_PREP_STAGE) return "";
  const targetText = formatRenewalCount(project.target_count);
  const gapText = renewalTargetGapText(project);
  if (renewalData?.can_manage_all) {
    return `
      <label class="renewal-target-card">
        <span>本月目标 / 还差</span>
        <input
          type="number"
          min="0"
          max="9999"
          step="1"
          value="${escapeRenewalText(renewalTargetValue(project))}"
          placeholder="未定"
          data-renewal-target-count="${escapeRenewalText(project.id)}"
          aria-label="${escapeRenewalText(project.class_name || "班级")} 续费目标"
          ${disabledAttr}
        >
        <small>本月已报 ${Number(project.month_enrolled_count || 0)} · ${escapeRenewalText(gapText)}</small>
      </label>
    `;
  }
  return `
    <div class="renewal-target-card">
      <span>本月目标 / 还差</span>
      <strong>${escapeRenewalText(targetText)}</strong>
      <small>本月已报 ${Number(project.month_enrolled_count || 0)} · ${escapeRenewalText(gapText)}</small>
    </div>
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
        ${renderRenewalEnrolledMetric(project, disabledAttr)}
        ${renderRenewalProjectTarget(project, disabledAttr)}
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

function renderRenewal(data) {
  renewalData = data;
  ensureRenewalTeacherSelection();
  const visibleProjects = renewalProjectsForActiveTeacher(data.projects || []);
  updateRenewalMenuBadge(data);
  renderRenewalTeacherPanel();
  renderRenewalClassOptions(data.available_classes || []);
  renderRenewalFollowupOverview();
  renderRenewalGoalPanel(visibleProjects);
  renderRenewalIntentOverview(data.projects || []);
  renderRenewalBoard(visibleProjects);
  renderRenewalSectionHub(visibleProjects);
  applyRenewalSectionVisibility();
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
  const visibleProjects = renewalProjectsForActiveTeacher(renewalData.projects || []);
  renderRenewalFollowupOverview();
  renderRenewalGoalPanel(visibleProjects);
  renderRenewalIntentOverview(renewalData.projects || []);
  renderRenewalBoard(visibleProjects);
  renderRenewalSectionHub(visibleProjects);
  applyRenewalSectionVisibility();
  if (renewalDetailView?.classList.contains("is-hidden")) {
    renderRenewalTeacherPanel();
    applyRenewalSectionVisibility();
  } else {
    renewalTeacherPanel?.classList.add("is-hidden");
    renewalFollowupOverview?.classList.add("is-hidden");
    renewalGoalPanel?.classList.add("is-hidden");
    renewalIntentOverview?.classList.add("is-hidden");
    renewalStageBoard?.classList.add("is-hidden");
    renewalSectionHub?.classList.add("is-hidden");
    renewalSectionToolbar?.classList.add("is-hidden");
  }
}

function showRenewalDetail(shouldShow) {
  const visibleProjects = renewalProjectsForActiveTeacher(renewalData?.projects || []);
  renewalAddPanel?.classList.toggle("is-hidden", shouldShow);
  renewalTeacherPanel?.classList.toggle("is-hidden", shouldShow || !renewalData?.can_manage_all);
  renewalGoalPanel?.classList.toggle("is-hidden", shouldShow || !renewalTargetProjects(visibleProjects).length);
  renewalIntentOverview?.classList.toggle("is-hidden", shouldShow || !(renewalData?.can_manage_all && (renewalData?.projects || []).length));
  renewalFollowupOverview?.classList.toggle("is-hidden", shouldShow || renewalActiveSection !== "followup");
  renewalSectionHub?.classList.toggle("is-hidden", shouldShow || renewalActiveSection !== "home");
  renewalSectionToolbar?.classList.toggle("is-hidden", shouldShow || renewalActiveSection === "home");
  renewalStageBoard?.classList.toggle("is-hidden", shouldShow);
  renewalDetailView?.classList.toggle("is-hidden", !shouldShow);
  if (!shouldShow) {
    renewalActiveDetailProject = null;
    renewalActiveDetailData = null;
    renderRenewalWeekSelect(null);
    renderRenewalTeacherPanel();
    renderRenewalGoalPanel(visibleProjects);
    renderRenewalIntentOverview(renewalData?.projects || []);
    renderRenewalFollowupOverview();
    renderRenewalSectionHub(visibleProjects);
    applyRenewalSectionVisibility();
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
  const completionLabel = project.completion_label || "上月完课";
  const followupFilter = renderRenewalFollowupDateFilter(project, students);
  const visibleStudents = students.filter((student) => renewalStudentMatchesFollowupDate(project, student));
  return `
    ${followupFilter}
    <table class="database-table renewal-student-table">
      <thead>
        <tr>
          <th>学员姓名</th>
          <th>学员账号</th>
          <th>${escapeRenewalText(completionLabel)}</th>
          <th>跟进时间</th>
          <th>跟进情况</th>
          <th>备注</th>
        </tr>
      </thead>
      <tbody>
        ${visibleStudents.length ? visibleStudents.map((student) => `
          <tr data-renewal-student-row="${escapeRenewalText(student.id)}">
            ${renderRenewalStudentNameCell(project, student, disabledAttr)}
            <td>${escapeRenewalText(student.account || "-")}</td>
            <td class="database-percent-cell">${escapeRenewalText(formatRenewalRate(student.average_completion))}</td>
            <td data-renewal-followup-time-cell>${escapeRenewalText(student.followup_time || "-")}</td>
            <td>
              <select
                class="renewal-followup-select renewal-status-select ${renewalStatusClass(student.followup_status || "")}"
                data-renewal-followup-status="${escapeRenewalText(project.id)}"
                data-renewal-student-id="${escapeRenewalText(student.id)}"
                ${disabledAttr}
              >
                ${renderRenewalFollowupOptions(student.followup_status || "")}
              </select>
            </td>
            ${renderRenewalRemarkCell(project, student, disabledAttr)}
          </tr>
        `).join("") : `
          <tr>
            <td class="renewal-hidden-enrolled-empty" colspan="6">
              ${renewalFollowupDateFilter ? "当天暂无匹配学员。" : "暂无学员数据。"}
            </td>
          </tr>
        `}
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
  const weeks = renewalWeekOptions(project);
  const currentWeekKey = getRenewalSelectedWeekKey(project);
  const completionLabel = project.completion_label || "上月完课";
  const showLeaderPlanColumn = shouldShowRenewalLeaderPlanColumn(project, students);
  const firstMonthColumnCount = 4 + 1 + (showLeaderPlanColumn ? 1 : 0) + 3 + (weeks.length - 1) + 1;
  const followupFilter = renderRenewalFollowupDateFilter(project, students);
  const enrolledStudents = students.filter((student) => student.enrolled);
  const visibleStudents = renewalShowEnrolledStudents
    ? students.filter((student) => renewalStudentMatchesFollowupDate(project, student))
    : students.filter((student) => !student.enrolled && renewalStudentMatchesFollowupDate(project, student));
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
    ${followupFilter}
    ${enrolledToggle}
    <table class="database-table renewal-student-table renewal-first-month-table">
      <thead>
        <tr>
          <th class="renewal-sticky-group" colspan="4">基础信息</th>
          <th class="renewal-sticky-col renewal-sticky-blocker" rowspan="2">当前卡点</th>
          ${showLeaderPlanColumn ? `<th class="renewal-leader-plan-head" rowspan="2">盘单</th>` : ""}
          ${weeks.map((week) => `
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
          <th class="renewal-sticky-col renewal-sticky-average">${escapeRenewalText(completionLabel)}</th>
          <th class="renewal-sticky-col renewal-sticky-intention">铺垫情况</th>
          ${weeks.map((week) => week.key === currentWeekKey ? `
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
              <span class="renewal-intention-pill ${renewalStatusClass(student.followup_status || "")}">${escapeRenewalText(student.followup_status || "未填写")}</span>
            </td>
            <td class="renewal-sticky-col renewal-sticky-blocker">
              <select
                class="renewal-followup-select renewal-blocker-select ${renewalBlockerClass(student.current_blocker || "")}"
                data-renewal-current-blocker="${escapeRenewalText(project.id)}"
                data-renewal-student-id="${escapeRenewalText(student.id)}"
                data-renewal-current-value="${escapeRenewalText(student.current_blocker || "")}"
                ${disabledAttr}
              >
                ${renderRenewalBlockerOptions(student.current_blocker || "")}
              </select>
            </td>
            ${showLeaderPlanColumn ? renderRenewalLeaderPlanCell(project, student, disabledAttr) : ""}
            ${weeks.map((week) => renderRenewalWeekCells(project, student, week, currentWeekKey, disabledAttr)).join("")}
          </tr>
        `).join("") : `
          <tr>
            <td class="renewal-hidden-enrolled-empty" colspan="${firstMonthColumnCount}">
              ${renewalFollowupDateFilter ? "当天暂无匹配学员。" : "已报名学员已自动隐藏，点击上方按钮可展开查看。"}
            </td>
          </tr>
        `}
      </tbody>
    </table>
  `;
}

function renderRenewalSecondMonthStudentTable(project, students, disabledAttr) {
  const showLeaderPlanColumn = shouldShowRenewalLeaderPlanColumn(project, students);
  const completionLabel = project.completion_label || "上月完课";
  const secondMonthColumnCount = 4 + 1 + (showLeaderPlanColumn ? 1 : 0) + 4;
  const followupFilter = renderRenewalFollowupDateFilter(project, students);
  const enrolledStudents = students.filter((student) => student.enrolled);
  const visibleStudents = renewalShowEnrolledStudents
    ? students.filter((student) => renewalStudentMatchesFollowupDate(project, student))
    : students.filter((student) => !student.enrolled && renewalStudentMatchesFollowupDate(project, student));
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
    ${followupFilter}
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
          <th class="renewal-sticky-col renewal-sticky-average">${escapeRenewalText(completionLabel)}</th>
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
              <span class="renewal-intention-pill ${renewalStatusClass(student.followup_status || "")}">${escapeRenewalText(student.followup_status || "未填写")}</span>
            </td>
            <td class="renewal-sticky-col renewal-sticky-blocker">
              <select
                class="renewal-followup-select renewal-blocker-select ${renewalBlockerClass(student.current_blocker || "")}"
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
            <td class="renewal-hidden-enrolled-empty" colspan="${secondMonthColumnCount}">
              ${renewalFollowupDateFilter ? "当天暂无匹配学员。" : "已报名学员已自动隐藏，点击上方按钮可展开查看。"}
            </td>
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
    const completionLabel = project.completion_label || "上月完课";
    renewalDetailMeta.textContent = `${project.teacher_name || "未分配"} · 续费锁定 ${Number(project.student_count || 0)} 人 · 已报名 ${Number(project.enrolled_count || 0)} 人 · 完课数据：${completionLabel}`;
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
    const targetSummaryCard = project.stage !== RENEWAL_PREP_STAGE ? `
      <article>
        <span>本月目标</span>
        <strong>${escapeRenewalText(formatRenewalCount(project.target_count))}</strong>
        <small>本月已报 ${Number(project.month_enrolled_count || 0)} · ${escapeRenewalText(renewalTargetGapText(project))} · 达成 ${escapeRenewalText(formatRenewalRate(project.target_progress_rate))}</small>
      </article>
    ` : "";
    renewalDetailSummary.innerHTML = `
      <article class="renewal-count-summary">
        <span>续费锁定人数</span>
        ${countEditor}
        <small>续报率按这里作为分母；完课班级当前 ${Number(project.source_student_count || 0)} 人</small>
        ${countNoteEditor}
      </article>
      ${renderRenewalEnrolledMetric(project, disabledAttr, "article")}
      ${targetSummaryCard}
      ${planSummaryCard}
      ${renderRenewalDetailIntentCard(project)}
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
    const params = new URLSearchParams();
    params.set("followup_date", renewalOverviewDate || todayRenewalDateValue());
    const data = await renewalApiRequest(`/api/renewal?${params.toString()}`);
    renewalOverviewDate = data?.followup_overview?.date || renewalOverviewDate || todayRenewalDateValue();
    renderRenewal(data);
    const pendingPlans = renewalPendingLeaderPlanCount(data.projects || []);
    setRenewalMessage(!data.can_manage_all && pendingPlans ? `你有 ${pendingPlans} 条待处理盘单，进入班级后点击完成即可收起。` : "");
  } catch (error) {
    setRenewalMessage(error.message, true);
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
  if (!projectId) return false;
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
    return true;
  } catch (error) {
    setRenewalMessage(error.message, true);
    return false;
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

async function saveRenewalStudentName(nameInput) {
  const projectId = nameInput.dataset.renewalStudentName;
  const studentId = nameInput.dataset.renewalStudentId;
  const previousName = String(nameInput.dataset.renewalOriginalName || "").trim();
  const nextName = String(nameInput.value || "").trim();
  if (!projectId || !studentId) return;
  if (!nextName) {
    nameInput.value = previousName;
    setRenewalMessage("请输入学员姓名。", true);
    return;
  }
  if (nextName === previousName) {
    nameInput.value = previousName;
    return;
  }
  nameInput.disabled = true;
  nameInput.classList.add("is-saving");
  const data = await updateRenewalStudent(
    projectId,
    studentId,
    { student_name: nextName },
    { successMessage: "学员姓名已更新。" }
  );
  if (!data) {
    nameInput.value = previousName;
    nameInput.disabled = false;
    nameInput.classList.remove("is-saving");
    return;
  }
  nameInput.dataset.renewalOriginalName = nextName;
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

function saveRenewalTargetCount(targetInput) {
  const projectId = targetInput.dataset.renewalTargetCount;
  if (!projectId || !renewalData?.can_manage_all) return;
  const rawValue = String(targetInput.value || "").trim();
  const targetCount = rawValue === "" ? "" : Math.max(0, Math.min(9999, Number.parseInt(rawValue, 10) || 0));
  if (rawValue !== "") targetInput.value = String(targetCount);
  targetInput.disabled = true;
  saveRenewalProjectSettings(
    projectId,
    { target_count: targetCount },
    rawValue === "" ? "续费目标已清空。" : "续费目标已保存。"
  ).finally(() => {
    targetInput.disabled = false;
  });
}

function startRenewalEnrolledCountEdit(target) {
  if (!target || target.dataset.editing === "true") return;
  const projectId = target.dataset.renewalEnrolledCount || "";
  if (!projectId) return;
  const project = findRenewalProject(projectId) || (renewalActiveDetailData?.id === projectId ? renewalActiveDetailData : null);
  if (!project?.can_edit) {
    setRenewalMessage("这个班级只有所属老师或管理员可以修正已报名人数。", true);
    return;
  }
  target.dataset.editing = "true";
  const previousHtml = target.innerHTML;
  const manualValue = String(target.dataset.renewalEnrolledManual || "");
  const displayValue = String(target.dataset.renewalEnrolledValue || "");
  const input = document.createElement("input");
  input.className = "renewal-inline-count-input";
  input.type = "number";
  input.min = "0";
  input.max = "9999";
  input.step = "1";
  input.value = manualValue || displayValue;
  input.setAttribute("aria-label", "编辑已报名人数");
  target.innerHTML = "";
  target.appendChild(input);

  let committed = false;
  const cancel = () => {
    if (committed) return;
    committed = true;
    target.innerHTML = previousHtml;
    delete target.dataset.editing;
  };
  const commit = () => {
    if (committed) return;
    committed = true;
    const rawValue = String(input.value || "").trim();
    const nextCount = rawValue === "" ? "" : Math.max(0, Math.min(9999, Number.parseInt(rawValue, 10) || 0));
    input.disabled = true;
    saveRenewalProjectSettings(
      projectId,
      { manual_enrolled_count: nextCount },
      rawValue === "" ? "已恢复按学员勾选统计报名人数。" : "已报名人数已更新。"
    ).then((saved) => {
      if (!saved) {
        target.innerHTML = previousHtml;
        delete target.dataset.editing;
      }
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

function activateRenewalEnrolledCount(event, allowClick = false) {
  const enrolledCount = event.target.closest("[data-renewal-enrolled-count]");
  if (!enrolledCount) return false;
  if (!allowClick && event.type === "click") return false;
  if (event.type === "keydown" && event.key !== "Enter" && event.key !== "F2") return false;
  event.preventDefault();
  event.stopPropagation();
  startRenewalEnrolledCountEdit(enrolledCount);
  return true;
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
  renewalMenuButton?.addEventListener("click", () => {
    renewalActiveSection = "home";
    showRenewalDetail(false);
    loadRenewal();
  });
  renewalSectionHub?.addEventListener("click", (event) => {
    const sectionButton = event.target.closest("[data-renewal-section]");
    if (!sectionButton) return;
    setRenewalSection(sectionButton.dataset.renewalSection || "home");
  });
  renewalModule?.addEventListener("dblclick", (event) => {
    activateRenewalEnrolledCount(event);
  });
  renewalModule?.addEventListener("keydown", (event) => {
    activateRenewalEnrolledCount(event);
  });
  renewalSectionBack?.addEventListener("click", () => {
    setRenewalSection("home");
  });
  renewalBackButton?.addEventListener("click", () => {
    showRenewalDetail(false);
    if (renewalData) renderRenewal(renewalData);
  });
  renewalTeacherList?.addEventListener("click", (event) => {
    const teacherButton = event.target.closest("[data-renewal-teacher]");
    if (!teacherButton) return;
    renewalSelectedTeacherId = teacherButton.dataset.renewalTeacher || RENEWAL_ALL_TEACHERS;
    renewalTeacherPanelExpanded = false;
    renderRenewal(renewalData);
    const activeTeacher = getRenewalSelectedTeacher();
    setRenewalMessage(activeTeacher ? `已进入 ${activeTeacher.teacher_name || activeTeacher.teacher_id} 的续费跟进。` : "已切回全部老师续费跟进。");
  });
  renewalTeacherPanel?.addEventListener("click", (event) => {
    if (isRenewalInteractiveClick(event.target) || !event.target.closest(".renewal-teacher-panel-head")) return;
    renewalTeacherPanelExpanded = !renewalTeacherPanelExpanded;
    renderRenewalTeacherPanel();
  });
  renewalFollowupOverview?.addEventListener("click", (event) => {
    const classToggle = event.target.closest("[data-renewal-followup-class-toggle]");
    if (classToggle) {
      const classKey = classToggle.dataset.renewalFollowupClassToggle || "";
      if (classKey) {
        if (renewalFollowupExpandedClasses.has(classKey)) {
          renewalFollowupExpandedClasses.delete(classKey);
        } else {
          renewalFollowupExpandedClasses.add(classKey);
        }
        renderRenewalFollowupOverview();
      }
      return;
    }
    const openButton = event.target.closest("[data-renewal-followup-open]");
    if (openButton) {
      const projectId = openButton.dataset.renewalFollowupOpen;
      if (projectId) openRenewalProject(projectId);
      return;
    }
    if (isRenewalInteractiveClick(event.target) || !event.target.closest(".renewal-followup-overview-head")) return;
    renewalFollowupOverviewExpanded = !renewalFollowupOverviewExpanded;
    renderRenewalFollowupOverview();
  });
  renewalFollowupOverview?.addEventListener("change", (event) => {
    const dateInput = event.target.closest("[data-renewal-overview-date]");
    if (!dateInput) return;
    renewalOverviewDate = dateInput.value || todayRenewalDateValue();
    renewalFollowupExpandedClasses = new Set();
    loadRenewal();
  });
  renewalGoalPanel?.addEventListener("change", (event) => {
    const targetInput = event.target.closest("[data-renewal-target-count]");
    if (targetInput) saveRenewalTargetCount(targetInput);
  });
  renewalGoalPanel?.addEventListener("click", (event) => {
    if (!isRenewalInteractiveClick(event.target) && event.target.closest(".renewal-goal-head")) {
      renewalGoalPanelExpanded = !renewalGoalPanelExpanded;
      renderRenewalGoalPanel(renewalProjectsForActiveTeacher(renewalData?.projects || []));
    }
  });
  renewalIntentOverview?.addEventListener("click", (event) => {
    if (isRenewalInteractiveClick(event.target) || !event.target.closest(".renewal-intent-overview-head")) return;
    renewalIntentOverviewExpanded = !renewalIntentOverviewExpanded;
    renderRenewalIntentOverview(renewalData?.projects || []);
  });
  renewalGoalPanel?.addEventListener("keydown", (event) => {
    const targetInput = event.target.closest("[data-renewal-target-count]");
    if (targetInput && event.key === "Enter") {
      event.preventDefault();
      targetInput.blur();
    }
  });
  renewalWeekSelect?.addEventListener("change", () => {
    setRenewalSelectedWeekKey(renewalWeekSelect.value, renewalActiveDetailData);
    renewalFollowupDateFilter = "";
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
  renewalDetailSummary?.addEventListener("dblclick", (event) => {
    const enrolledCount = event.target.closest("[data-renewal-enrolled-count]");
    if (!enrolledCount) return;
    event.preventDefault();
    startRenewalEnrolledCountEdit(enrolledCount);
  });
  renewalDetailSummary?.addEventListener("keydown", (event) => {
    const enrolledCount = event.target.closest("[data-renewal-enrolled-count]");
    if (!enrolledCount || (event.key !== "Enter" && event.key !== "F2")) return;
    event.preventDefault();
    startRenewalEnrolledCountEdit(enrolledCount);
  });
  renewalStageBoard.addEventListener("dragstart", handleRenewalDragStart);
  renewalStageBoard.addEventListener("dragend", handleRenewalDragEnd);
  renewalStageBoard.addEventListener("dragover", handleRenewalDragOver);
  renewalStageBoard.addEventListener("dragleave", handleRenewalDragLeave);
  renewalStageBoard.addEventListener("drop", (event) => {
    handleRenewalDrop(event);
  });
  renewalStageBoard.addEventListener("change", (event) => {
    const targetInput = event.target.closest("[data-renewal-target-count]");
    if (targetInput) {
      saveRenewalTargetCount(targetInput);
      return;
    }
    const select = event.target.closest("[data-renewal-stage]");
    if (select) {
      updateRenewalProject(select.dataset.renewalStage, { stage: select.value }, "阶段已更新。");
    }
  });
  renewalStageBoard.addEventListener("keydown", (event) => {
    const enrolledCount = event.target.closest("[data-renewal-enrolled-count]");
    if (enrolledCount && (event.key === "Enter" || event.key === "F2")) {
      event.preventDefault();
      startRenewalEnrolledCountEdit(enrolledCount);
      return;
    }
    const targetInput = event.target.closest("[data-renewal-target-count]");
    if (targetInput && event.key === "Enter") {
      event.preventDefault();
      targetInput.blur();
    }
  });
  renewalStageBoard.addEventListener("dblclick", (event) => {
    const enrolledCount = event.target.closest("[data-renewal-enrolled-count]");
    if (!enrolledCount) return;
    event.preventDefault();
    startRenewalEnrolledCountEdit(enrolledCount);
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
    const studentNameInput = event.target.closest("[data-renewal-student-name]");
    if (studentNameInput) {
      saveRenewalStudentName(studentNameInput);
      return;
    }

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
      statusSelect.className = `renewal-followup-select renewal-status-select ${renewalStatusClass(statusSelect.value)}`;
      updateRenewalStudent(
        statusSelect.dataset.renewalFollowupStatus,
        statusSelect.dataset.renewalStudentId,
        { followup_status: statusSelect.value }
      );
      return;
    }
    const followupDateFilter = event.target.closest("[data-renewal-followup-date-filter]");
    if (followupDateFilter) {
      renewalFollowupDateFilter = followupDateFilter.value || "";
      if (renewalActiveDetailData) {
        renderRenewalDetail(renewalActiveDetailData);
      }
      return;
    }
    const prioritySelect = event.target.closest("[data-renewal-followup-priority]");
    if (prioritySelect) {
      prioritySelect.className = `renewal-priority-select ${renewalPriorityClass(prioritySelect.value)}`;
      updateRenewalStudent(
        prioritySelect.dataset.renewalFollowupPriority,
        prioritySelect.dataset.renewalStudentId,
        { followup_priority: prioritySelect.value },
        { successMessage: "跟进优先级已更新。" }
      );
      return;
    }
    const blockerSelect = event.target.closest("[data-renewal-current-blocker]");
    if (blockerSelect) {
      if (blockerSelect.value === RENEWAL_ADD_BLOCKER_VALUE) {
        addRenewalInlineBlockerOption(blockerSelect);
        return;
      }
      blockerSelect.className = `renewal-followup-select renewal-blocker-select ${renewalBlockerClass(blockerSelect.value)}`;
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
      saveRenewalLeaderTalkSelection(
        leaderTalk.dataset.renewalLeaderTalk,
        leaderTalk.dataset.renewalStudentId,
        selectedTrack,
        nextKeyword
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
    const studentNameInput = event.target.closest("[data-renewal-student-name]");
    if (studentNameInput) {
      event.preventDefault();
      studentNameInput.blur();
      return;
    }

    const noteInput = event.target.closest("[data-renewal-followup-note]");
    if (noteInput) {
      event.preventDefault();
      saveRenewalFollowupNote(noteInput);
      return;
    }
    const leaderTextNote = event.target.closest("[data-renewal-leader-text-note]");
    if (leaderTextNote && event.ctrlKey) {
      event.preventDefault();
      saveRenewalLeaderTextPlan(leaderTextNote);
    }
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
    const leaderModeButton = event.target.closest("[data-renewal-leader-mode-button]");
    if (leaderModeButton) {
      setRenewalLeaderEditorMode(leaderModeButton);
      return;
    }
    const leaderTalkCandidate = event.target.closest("[data-renewal-select-talk]");
    if (leaderTalkCandidate) {
      const plan = leaderTalkCandidate.closest(".renewal-leader-plan");
      const noteInput = plan?.querySelector("[data-renewal-leader-note]");
      const selectedTrack = findRenewalTalkTrackById(leaderTalkCandidate.dataset.renewalTalkId || "");
      const nextKeyword = String(noteInput?.value || "").trim();
      if (noteInput) noteInput.value = "";
      saveRenewalLeaderTalkSelection(
        leaderTalkCandidate.dataset.renewalSelectTalk,
        leaderTalkCandidate.dataset.renewalStudentId,
        selectedTrack,
        nextKeyword
      );
      return;
    }
    const leaderTextSave = event.target.closest("[data-renewal-leader-text-save]");
    if (leaderTextSave) {
      saveRenewalLeaderTextPlan(leaderTextSave);
      return;
    }
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
  window.addEventListener("pu6:monthly-archived", () => {
    loadRenewal();
  });
  loadRenewal();
}

initRenewal();
