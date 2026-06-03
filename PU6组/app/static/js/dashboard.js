const moduleButtons = document.querySelectorAll("[data-module]");
const menuItems = document.querySelectorAll(".side-menu-item");
const panels = document.querySelectorAll("[data-module-panel]");

function setActiveModule(moduleName) {
  menuItems.forEach((item) => {
    item.classList.toggle("is-active", item.dataset.module === moduleName);
  });

  panels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.modulePanel === moduleName);
  });
}

moduleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveModule(button.dataset.module);
  });
});
