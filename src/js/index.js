import { initializeScene } from "./scene";

document.addEventListener("DOMContentLoaded", () => {
  initializeScene().catch((error) => {
    // Keep failure visible in devtools but avoid breaking other scripts.
    // eslint-disable-next-line no-console
    console.error("Scene initialization failed:", error);
  });
});
