// 라이트/다크 테마: 저장된 선택이 있으면 그것을, 없으면 시스템 설정을 따릅니다.
// <head>에서 먼저 실행되어 화면이 깜박이지 않게 합니다.

(function () {
  const STORAGE_KEY = "ssc-theme";
  const root = document.documentElement;
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

  function readStoredTheme() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value === "light" || value === "dark" ? value : null;
    } catch (error) {
      return null;
    }
  }

  function storeTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      // 저장이 막힌 환경에서는 이번 방문에만 적용
    }
  }

  function effectiveTheme() {
    return root.dataset.theme || (systemDark.matches ? "dark" : "light");
  }

  function updateButton() {
    const button = document.getElementById("theme-toggle-button");
    if (!button) return;

    const isDark = effectiveTheme() === "dark";
    button.textContent = isDark ? "☀️" : "🌙";

    const label = isDark ? "라이트 모드로 전환" : "다크 모드로 전환";
    button.title = label;
    button.setAttribute("aria-label", label);
  }

  const stored = readStoredTheme();
  if (stored) {
    root.dataset.theme = stored;
  }

  document.addEventListener("DOMContentLoaded", () => {
    updateButton();

    document
      .getElementById("theme-toggle-button")
      ?.addEventListener("click", () => {
        const next = effectiveTheme() === "dark" ? "light" : "dark";
        root.dataset.theme = next;
        storeTheme(next);
        updateButton();
      });
  });

  systemDark.addEventListener?.("change", updateButton);
})();
