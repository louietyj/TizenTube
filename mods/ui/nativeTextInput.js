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
  toast("NTI init: checking h5vcc...");
  
  if (!window.h5vcc || !window.h5vcc.tizentube) {
    toast("NTI: No h5vcc.tizentube - not Cobalt or wrong build");
    return;
  }
  
  if (!window._yttv) {
    toast("NTI: Waiting for YouTube TV app to load...");
    setTimeout(enableNativeTextInput, 250);
    return;
  }

  // Check if ShowKeyboard is available
  const hasShowKeyboard = typeof window.h5vcc.tizentube.ShowKeyboard === "function";
  toast("h5vcc.tizentube.ShowKeyboard: " + (hasShowKeyboard ? "AVAILABLE ✓" : "NOT FOUND"));

  if (!hasShowKeyboard) {
    console.warn("NTI: h5vcc.tizentube.ShowKeyboard not available");
    return;
  }
  
  toast("Native keyboard ready! Press Enter on search to type.");

  // Check if the mic button is focused (the button that triggers voice search)
  function isMicButtonFocused() {
    const micButton = document.querySelector('ytlr-search-box-buttons button[aria-label*="voice" i], ytlr-search-box-buttons button[aria-label*="mic" i]');
    return micButton && micButton.classList.contains('zylon-focus');
  }

  // Clear the search input before showing keyboard
  function clearSearchInput() {
    try {
      const searchInput = document.querySelector('ytlr-search-box input, ytlr-search-box #input');
      if (searchInput) {
        searchInput.value = '';
        // Dispatch input event to notify YouTube TV
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } catch (err) {
      console.warn("NTI: Could not clear search input:", err);
    }
  }

  // Intercept Enter key ONLY when mic button is focused
  document.addEventListener("keydown", (e) => {
    if ((e.keyCode === 13 || e.key === "Enter") && isMicButtonFocused()) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // Clear existing search text
      clearSearchInput();

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
