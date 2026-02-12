// Native Text Input for Android TV Platforms (Fire TV, Google TV)
// Uses h5vcc.tizentube.ShowKeyboard() to open an Android native text input dialog.
// Text entered by the user is injected as key events that YouTube TV processes.

function toast(msg) {
  try {
    const el = document.createElement("div");
    el.textContent = "NTI: " + msg;
    el.style.cssText =
      "position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:99999;" +
      "background:rgba(0,0,0,0.85);color:#0f0;padding:8px 16px;border-radius:6px;" +
      "font-size:14px;pointer-events:none;transition:opacity .5s;max-width:90%;";
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; }, 3000);
    setTimeout(() => el.remove(), 3500);
  } catch (_) {}
}

function enableNativeTextInput() {
  if (!window.h5vcc || !window.h5vcc.tizentube) return; // Cobalt only
  if (!window._yttv) {
    setTimeout(enableNativeTextInput, 250);
    return;
  }

  // Check if ShowKeyboard is available
  const hasShowKeyboard = typeof window.h5vcc.tizentube.ShowKeyboard === "function";
  toast(hasShowKeyboard
    ? "Native keyboard ready! Press Enter on search to type."
    : "ShowKeyboard not available in this build.");

  if (!hasShowKeyboard) {
    console.warn("NTI: h5vcc.tizentube.ShowKeyboard not available");
    return;
  }

  // Check if user is on the search keyboard area
  function isSearchActive() {
    const container = document.querySelector("ytlr-search-container");
    if (!container) return false;
    return !!container.querySelector(".zylon-focus");
  }

  // Intercept Enter key on the search keyboard to show native keyboard
  document.addEventListener("keydown", (e) => {
    if ((e.keyCode === 13 || e.key === "Enter") && isSearchActive()) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      toast("Opening native keyboard...");
      try {
        window.h5vcc.tizentube.ShowKeyboard();
      } catch (err) {
        toast("ShowKeyboard error: " + err.message);
        console.error("NTI ShowKeyboard error:", err);
      }
      return;
    }
  }, true); // capture phase
}

// --- Init ---
try {
  if (document.readyState === "complete" || document.readyState === "interactive") {
    enableNativeTextInput();
  } else {
    document.addEventListener("DOMContentLoaded", enableNativeTextInput);
  }
} catch (err) {
  console.error("NativeTextInput init failed:", err);
}
