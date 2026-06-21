const moduleButtons = document.querySelectorAll("[data-module]");
const menuItems = document.querySelectorAll(".side-menu-item");
const panels = document.querySelectorAll("[data-module-panel]");
const sidebarToggle = document.querySelector("[data-sidebar-toggle]");
const sidebarStorageKey = "pu6.sidebarCollapsed";

function getSavedSidebarState() {
  try {
    const savedValue = localStorage.getItem(sidebarStorageKey);
    return savedValue === null ? true : savedValue === "true";
  } catch (error) {
    return true;
  }
}

function saveSidebarState(isCollapsed) {
  try {
    localStorage.setItem(sidebarStorageKey, String(isCollapsed));
  } catch (error) {
    // Ignore storage errors so the menu still works in restricted browsers.
  }
}

function setSidebarCollapsed(isCollapsed, shouldSave = true) {
  document.body.classList.toggle("is-sidebar-collapsed", isCollapsed);

  if (sidebarToggle) {
    sidebarToggle.setAttribute("aria-expanded", String(!isCollapsed));
    sidebarToggle.title = isCollapsed ? "展开菜单" : "收起菜单";
    const toggleText = sidebarToggle.querySelector(".sidebar-toggle-text");
    if (toggleText) {
      toggleText.textContent = isCollapsed ? "展开菜单" : "收起菜单";
    }
  }

  if (shouldSave) {
    saveSidebarState(isCollapsed);
  }
}

function setActiveModule(moduleName) {
  menuItems.forEach((item) => {
    item.classList.toggle("is-active", item.dataset.module === moduleName);
  });

  panels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.modulePanel === moduleName);
  });
}

menuItems.forEach((item) => {
  const label = item.textContent.trim().replace(/\s+/g, " ");
  if (label) {
    item.title = label;
  }
});

setSidebarCollapsed(getSavedSidebarState(), false);

sidebarToggle?.addEventListener("click", () => {
  setSidebarCollapsed(!document.body.classList.contains("is-sidebar-collapsed"));
});

moduleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveModule(button.dataset.module);
  });
});
