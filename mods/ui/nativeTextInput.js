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
  
  // Wait for search bar to appear and make it focusable
  let searchBarCheckInterval = null;
  let searchBar = null;

  function makeSearchBarFocusable() {
    searchBar = document.querySelector('ytlr-search-text-box ytlr-text-box');
    
    if (searchBar && !searchBar.getAttribute('hybridnavfocusable')) {
      searchBar.setAttribute('hybridnavfocusable', 'true');
      searchBar.setAttribute('aria-label', 'Search');
      toast("Search bar is now focusable!");
      return true;
    }
    return false;
  }

  // Check periodically for search bar and make it focusable
  searchBarCheckInterval = setInterval(() => {
    if (makeSearchBarFocusable()) {
      // Keep checking in case page changes
    }
  }, 500);

  // Initial check
  makeSearchBarFocusable();
  toast("Native keyboard ready! Click search bar to type.");

  // Get current search text from the search bar display
  function getCurrentSearchText() {
    try {
      const textSpan = document.querySelector('ytlr-search-text-box .wzNiJf');
      const text = textSpan?.textContent || '';
      // Return empty string if it's just the placeholder "Search"
      return text === 'Search' ? '' : text;
    } catch (err) {
      return '';
    }
  }

  // Clear the search text by sending backspace events
  function clearSearchText() {
    try {
      const currentText = getCurrentSearchText();
      if (!currentText) return;
      
      // Send backspace events to clear existing text
      for (let i = 0; i < currentText.length + 5; i++) {
        const event = new KeyboardEvent('keydown', {
          key: 'Backspace',
          keyCode: 8,
          code: 'Backspace',
          bubbles: true,
          cancelable: true
        });
        document.dispatchEvent(event);
      }
    } catch (err) {
      console.warn("NTI: Could not clear search text:", err);
    }
  }

  // Trigger native keyboard and populate with current search text
  function openNativeKeyboard() {
    const currentText = getCurrentSearchText();
    toast("Opening keyboard" + (currentText ? ` (current: "${currentText}")` : "..."));

    // Clear existing text so the new input replaces it
    if (currentText) {
      clearSearchText();
    }

    try {
      window.h5vcc.tizentube.ShowKeyboard();
    } catch (err) {
      toast("ShowKeyboard error: " + err.message);
      console.error("NTI ShowKeyboard error:", err);
    }
  }

  // Use event delegation since search bar might not exist yet
  document.addEventListener('click', (e) => {
    const target = e.target.closest('ytlr-search-text-box ytlr-text-box');
    if (target) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      toast("Search bar clicked!");
      openNativeKeyboard();
      return false;
    }
  }, true); // capture phase

  // Also intercept Enter key when search bar is focused
  document.addEventListener("keydown", (e) => {
    if (e.keyCode === 13 || e.key === "Enter") {
      const currentSearchBar = document.querySelector('ytlr-search-text-box ytlr-text-box');
      if (document.activeElement === currentSearchBar) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        toast("Enter pressed on search bar!");
        openNativeKeyboard();
        return false;
      }
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
