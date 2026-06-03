const toggle = document.querySelector("[data-password-toggle]");
const password = document.querySelector("#password");

if (toggle && password) {
  toggle.addEventListener("click", () => {
    const isHidden = password.type === "password";
    password.type = isHidden ? "text" : "password";
    toggle.textContent = isHidden ? "隐藏" : "显示";
  });
}
