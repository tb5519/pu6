const wn = (id) => document.getElementById(`wn-${id}`);

const workNavList = wn("linkList");
const workNavStatus = wn("status");
const workNavSearchInput = wn("searchInput");
const workNavForm = wn("linkForm");
const workNavFormTitle = wn("formTitle");
const workNavFormStatus = wn("formStatus");
const workNavCancelEdit = wn("cancelEdit");

let workNavLinks = [];

function escapeWorkNavText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setWorkNavStatus(message, isError = false) {
  if (!workNavStatus) return;
  workNavStatus.textContent = message || "";
  workNavStatus.classList.toggle("is-error", isError);
}

function setWorkNavFormStatus(message, isError = false) {
  if (!workNavFormStatus) return;
  workNavFormStatus.textContent = message || "";
  workNavFormStatus.classList.toggle("is-error", isError);
}

function workNavMatches(link, keyword) {
  if (!keyword) return true;
  return [
    link.title,
    link.keywords,
    link.description,
    link.url,
  ].join(" ").toLowerCase().includes(keyword);
}

function filteredWorkNavLinks() {
  const keyword = String(workNavSearchInput?.value || "").trim().toLowerCase();
  return workNavLinks.filter((link) => workNavMatches(link, keyword));
}

function resetWorkNavForm() {
  if (!workNavForm) return;
  workNavForm.reset();
  wn("linkId").value = "";
  wn("openInput").checked = true;
  if (workNavFormTitle) workNavFormTitle.textContent = "新增工作链接";
  workNavCancelEdit?.classList.add("is-hidden");
  setWorkNavFormStatus("可设置是否开放给组员");
}

function fillWorkNavForm(link) {
  if (!workNavForm) return;
  wn("linkId").value = link.id || "";
  wn("titleInput").value = link.title || "";
  wn("urlInput").value = link.url || "";
  wn("keywordsInput").value = link.keywords || "";
  wn("descriptionInput").value = link.description || "";
  wn("openInput").checked = Boolean(link.is_open);
  if (workNavFormTitle) workNavFormTitle.textContent = "编辑工作链接";
  workNavCancelEdit?.classList.remove("is-hidden");
  setWorkNavFormStatus("修改后保存即可同步给可见范围内的老师");
}

function renderWorkNavLinks() {
  if (!workNavList) return;
  const links = filteredWorkNavLinks();
  const keyword = String(workNavSearchInput?.value || "").trim();
  setWorkNavStatus(keyword ? `匹配到 ${links.length} / ${workNavLinks.length} 个链接` : `${workNavLinks.length} 个工作链接`);

  if (!workNavLinks.length) {
    workNavList.innerHTML = `<div class="empty-state compact-empty">暂无工作链接，Joanna添加后即可使用。</div>`;
    return;
  }
  if (!links.length) {
    workNavList.innerHTML = `<div class="empty-state compact-empty">没有匹配到链接，换个关键词试试。</div>`;
    return;
  }

  workNavList.innerHTML = links
    .map((link) => `
      <article class="work-nav-card" title="${escapeWorkNavText([link.title, link.keywords, link.description, link.url].filter(Boolean).join("\n"))}">
        <a class="work-nav-name" href="${escapeWorkNavText(link.url)}" target="_blank" rel="noopener">
          ${escapeWorkNavText(link.title)}
        </a>
        ${link.is_open ? `<em class="work-nav-badge is-open">开放</em>` : `<em class="work-nav-badge is-private">私密</em>`}
        <div class="work-nav-actions">
          <a class="primary-button compact-button" href="${escapeWorkNavText(link.url)}" target="_blank" rel="noopener">打开</a>
          ${link.can_manage ? `<button class="ghost-button compact-button" type="button" data-edit-work-link="${escapeWorkNavText(link.id)}">编辑</button>` : ""}
          ${link.can_manage ? `<button class="ghost-button compact-button danger-button" type="button" data-delete-work-link="${escapeWorkNavText(link.id)}">删</button>` : ""}
        </div>
      </article>
    `)
    .join("");

  workNavList.querySelectorAll("[data-edit-work-link]").forEach((button) => {
    button.addEventListener("click", () => {
      const link = workNavLinks.find((item) => item.id === button.dataset.editWorkLink);
      if (link) fillWorkNavForm(link);
    });
  });

  workNavList.querySelectorAll("[data-delete-work-link]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!window.confirm("确认删除这个工作链接吗？")) return;
      button.disabled = true;
      try {
        const data = await workNavApi(`/api/work-navigation/${encodeURIComponent(button.dataset.deleteWorkLink)}`, {
          method: "DELETE",
        });
        if (data.ok) {
          await loadWorkNavigation();
          resetWorkNavForm();
        }
      } catch (error) {
        setWorkNavStatus(error.message, true);
        button.disabled = false;
      }
    });
  });
}

async function workNavApi(url, options = {}) {
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

async function loadWorkNavigation() {
  if (!workNavList) return;
  setWorkNavStatus("正在读取工作链接...");
  try {
    const data = await workNavApi("/api/work-navigation");
    workNavLinks = data.links || [];
    renderWorkNavLinks();
  } catch (error) {
    workNavLinks = [];
    renderWorkNavLinks();
    setWorkNavStatus(error.message, true);
  }
}

function collectWorkNavForm() {
  return {
    title: wn("titleInput")?.value.trim() || "",
    url: wn("urlInput")?.value.trim() || "",
    keywords: wn("keywordsInput")?.value.trim() || "",
    description: wn("descriptionInput")?.value.trim() || "",
    is_open: Boolean(wn("openInput")?.checked),
  };
}

async function submitWorkNavForm(event) {
  event.preventDefault();
  const payload = collectWorkNavForm();
  const linkId = wn("linkId")?.value || "";
  const submitButton = workNavForm.querySelector("button[type='submit']");
  if (submitButton) submitButton.disabled = true;
  setWorkNavFormStatus("正在保存工作链接...");
  try {
    await workNavApi(linkId ? `/api/work-navigation/${encodeURIComponent(linkId)}` : "/api/work-navigation", {
      method: linkId ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });
    resetWorkNavForm();
    await loadWorkNavigation();
    setWorkNavFormStatus("工作链接已保存。");
  } catch (error) {
    setWorkNavFormStatus(error.message, true);
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

function initWorkNavigation() {
  if (!workNavList) return;
  workNavSearchInput?.addEventListener("input", renderWorkNavLinks);
  workNavForm?.addEventListener("submit", submitWorkNavForm);
  workNavCancelEdit?.addEventListener("click", resetWorkNavForm);
  loadWorkNavigation();
}

initWorkNavigation();
