const toast = document.querySelector("#toast");

const featureNames = {
  crop: "图片裁剪",
  filter: "图片滤镜",
  title: "标题排版"
};

document.querySelectorAll(".tool-card").forEach((link) => {
  link.addEventListener("click", () => {
    trackEvent("tool_opened", {
      tool: link.getAttribute("href")?.replace(".html", "") || "unknown",
      source: "home"
    });
  });
});

document.querySelector(".primary-action")?.addEventListener("click", () => {
  trackEvent("workspace_opened", { source: "home" });
});

document.querySelectorAll("[data-feature]").forEach((button) => {
  button.addEventListener("click", () => {
    const name = featureNames[button.dataset.feature] || "该功能";
    showToast(`${name}模块已预留，当前先开放图片压缩。`);
  });
});

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2400);
}
