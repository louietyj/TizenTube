// Native Text Input for Android TV (Fire TV, Google TV)
//
// YouTube TV's built-in voice search relies on ACR/microphone APIs that are
// unavailable inside the Cobalt browser shell. This module replaces the
// non-functional voice-search button with a native Android text-input dialog
// exposed via h5vcc.tizentube.ShowKeyboard(). Text entered in the dialog is
// injected back as SbKey events that YouTube TV treats as on-screen keyboard
// presses.

function enableNativeTextInput() {
  if (!window.h5vcc?.tizentube) return;

  // Wait for YouTube TV app framework to initialize
  if (!window._yttv) {
    setTimeout(enableNativeTextInput, 250);
    return;
  }

  if (typeof window.h5vcc.tizentube.ShowKeyboard !== "function") {
    console.warn("NTI: h5vcc.tizentube.ShowKeyboard not available");
    return;
  }

  // Read current query from YouTube TV's internal state
  function getCurrentSearchQuery() {
    try {
      const box = document.querySelector("ytlr-search-text-box");
      return box?.__instance?.props?.searchQuery?.userInput || "";
    } catch (_) {
      return "";
    }
  }

  // Clear the search bar by dispatching Backspace key events
  function clearSearchQuery() {
    const query = getCurrentSearchQuery();
    if (!query) return;
    for (let i = 0; i < query.length + 5; i++) {
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Backspace",
          keyCode: 8,
          code: "Backspace",
          bubbles: true,
          cancelable: true,
        })
      );
    }
  }

  function openNativeKeyboard() {
    clearSearchQuery();
    try {
      window.h5vcc.tizentube.ShowKeyboard();
    } catch (err) {
      console.error("NTI: ShowKeyboard error:", err);
    }
  }

  // Replace the voice-search button with a clone that only triggers our
  // native keyboard. Cloning strips every listener YouTube attached.
  function overrideVoiceButton() {
    const btn = document.querySelector("ytlr-search-voice-mic-button");
    if (!btn || btn._ntiOverridden) return;
    btn._ntiOverridden = true;

    const clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);
    clone._ntiOverridden = true;

    clone.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        openNativeKeyboard();
      },
      true
    );

    clone.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Enter" || e.keyCode === 13) {
          e.preventDefault();
          e.stopImmediatePropagation();
          openNativeKeyboard();
        }
      },
      true
    );
  }

  // Override whenever the button appears (e.g. navigating to search page)
  new MutationObserver(() => overrideVoiceButton()).observe(document.body, {
    childList: true,
    subtree: true,
  });
  overrideVoiceButton();
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
