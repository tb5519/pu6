const accountAdminRoot = document.querySelector("[data-account-admin]");
const accountMessage = document.querySelector("#account-message");
const accountCreateForm = document.querySelector("#account-createForm");
const accountUsernameInput = document.querySelector("#account-username");
const accountDisplayNameInput = document.querySelector("#account-displayName");
const accountPasswordInput = document.querySelector("#account-password");
const accountRows = document.querySelector("#account-rows");

let accountList = [];

function setAccountMessage(message, isError = false) {
  if (!accountMessage) return;
  accountMessage.textContent = message || "";
  accountMessage.classList.toggle("is-error", isError);
}

function escapeAccountText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAccountSelector(value) {
  if (window.CSS?.escape) return window.CSS.escape(String(value ?? ""));
  return String(value ?? "").replace(/["\\]/g, "\\$&");
}

async function accountApiRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: options.body ? { "Content-Type": "application/json" } : {},
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "账号管理请求失败，请稍后重试。");
  }
  return data;
}

function accountRoleLabel(account) {
  if (account.is_super_admin) return "超级管理员";
  if (account.role === "leader") return "管理员";
  return "组员";
}

function renderAccounts() {
  if (!accountRows) return;
  if (!accountList.length) {
    accountRows.innerHTML = `<tr><td colspan="7" class="database-empty-cell">暂无账号。</td></tr>`;
    return;
  }

  accountRows.innerHTML = accountList
    .map((account) => {
      const active = account.active !== false;
      const statusLabel = active ? "启用中" : "已停用";
      const actionLabel = active ? "停用" : "启用";
      const actionTitle = active ? "停用后该账号不能登录，但历史数据会保留" : "启用后该账号可以重新登录";
      const actionButton = account.is_super_admin
        ? `<span class="account-action-muted">不可停用</span>`
        : `
          <button
            class="ghost-button compact-button account-status-button${active ? " is-danger" : " is-enable"}"
            type="button"
            title="${escapeAccountText(actionTitle)}"
            data-account-status="${escapeAccountText(account.username)}"
            data-account-active="${active ? "false" : "true"}"
          >${actionLabel}</button>
        `;
      return `
      <tr class="${active ? "" : "is-inactive-account"}">
        <td class="database-strong-cell">${escapeAccountText(account.username)}</td>
        <td>${escapeAccountText(account.display_name || "-")}</td>
        <td>${escapeAccountText(account.teacher_name || "未绑定")}</td>
        <td><span class="account-role-badge${account.is_super_admin ? " is-admin" : ""}">${accountRoleLabel(account)}</span></td>
        <td><span class="account-status-badge${active ? "" : " is-inactive"}">${statusLabel}</span></td>
        <td>
          <div class="account-password-reset">
            <input
              type="password"
              placeholder="输入新密码"
              autocomplete="new-password"
              data-account-password="${escapeAccountText(account.username)}"
            >
            <button class="ghost-button compact-button" type="button" data-account-reset="${escapeAccountText(account.username)}">
              重置
            </button>
          </div>
        </td>
        <td>${actionButton}</td>
      </tr>
    `;
    })
    .join("");
}

async function loadAccounts() {
  if (!accountAdminRoot) return;
  setAccountMessage("正在读取账号...");
  const data = await accountApiRequest("/api/accounts");
  accountList = data.accounts || [];
  renderAccounts();
  setAccountMessage("");
}

async function createAccount(event) {
  event.preventDefault();
  const username = accountUsernameInput?.value.trim() || "";
  const displayName = accountDisplayNameInput?.value.trim() || "";
  const password = accountPasswordInput?.value || "";

  if (!username || !password) {
    setAccountMessage("请填写登录账号和初始密码。", true);
    return;
  }

  setAccountMessage("正在创建账号...");
  await accountApiRequest("/api/accounts", {
    method: "POST",
    body: JSON.stringify({
      username,
      display_name: displayName,
      password,
    }),
  });
  accountCreateForm?.reset();
  await loadAccounts();
  setAccountMessage("账号已创建。");
}

async function resetAccountPassword(username) {
  const input = document.querySelector(`[data-account-password="${escapeAccountSelector(username)}"]`);
  const password = input?.value || "";
  if (!password) {
    setAccountMessage("请输入新密码。", true);
    input?.focus();
    return;
  }

  setAccountMessage("正在重置密码...");
  await accountApiRequest(`/api/accounts/${encodeURIComponent(username)}/password`, {
    method: "PUT",
    body: JSON.stringify({ password }),
  });
  if (input) input.value = "";
  await loadAccounts();
  setAccountMessage(`账号 ${username} 的密码已重置。`);
}

async function updateAccountStatus(username, active) {
  const shouldEnable = active === true || active === "true";
  if (!shouldEnable) {
    const confirmed = window.confirm(`确定停用账号 ${username} 吗？停用后该账号将不能登录，但历史数据会保留。`);
    if (!confirmed) return;
  }

  setAccountMessage(shouldEnable ? "正在启用账号..." : "正在停用账号...");
  await accountApiRequest(`/api/accounts/${encodeURIComponent(username)}/status`, {
    method: "PUT",
    body: JSON.stringify({ active: shouldEnable }),
  });
  await loadAccounts();
  setAccountMessage(`账号 ${username} 已${shouldEnable ? "启用" : "停用"}。`);
}

function initAccountAdmin() {
  if (!accountAdminRoot) return;
  accountCreateForm?.addEventListener("submit", (event) => {
    createAccount(event).catch((error) => setAccountMessage(error.message, true));
  });
  accountRows?.addEventListener("click", (event) => {
    const statusButton = event.target.closest("[data-account-status]");
    if (statusButton) {
      updateAccountStatus(
        statusButton.dataset.accountStatus,
        statusButton.dataset.accountActive
      ).catch((error) => setAccountMessage(error.message, true));
      return;
    }
    const button = event.target.closest("[data-account-reset]");
    if (!button) return;
    resetAccountPassword(button.dataset.accountReset).catch((error) => setAccountMessage(error.message, true));
  });
  loadAccounts().catch((error) => setAccountMessage(error.message, true));
}

initAccountAdmin();
