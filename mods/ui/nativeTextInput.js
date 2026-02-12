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
  
  toast("Native keyboard ready! Click voice button to type.");

  // Get current search query from YouTube TV's internal state (source of truth)
  function getCurrentSearchQuery() {
    try {
      const searchTextBox = document.querySelector('ytlr-search-text-box');
      const searchQuery = searchTextBox?.__instance?.props?.searchQuery?.userInput;
      return searchQuery || '';
    } catch (err) {
      console.warn("NTI: Could not get search query:", err);
      return '';
    }
  }

  // Clear the search query by sending backspace events
  function clearSearchQuery() {
    try {
      const currentQuery = getCurrentSearchQuery();
      if (!currentQuery) return;
      
      toast(`Clearing "${currentQuery}"...`);
      
      // Send backspace events to clear existing text
      for (let i = 0; i < currentQuery.length + 5; i++) {
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
      console.warn("NTI: Could not clear search query:", err);
    }
  }

  // Trigger native keyboard with current search query prepopulated
  function openNativeKeyboard() {
    const currentQuery = getCurrentSearchQuery();
    toast("Opening keyboard" + (currentQuery ? ` (current: "${currentQuery}")` : "..."));

    // Clear existing query so the new input replaces it
    if (currentQuery) {
      clearSearchQuery();
    }

    try {
      window.h5vcc.tizentube.ShowKeyboard();
    } catch (err) {
      toast("ShowKeyboard error: " + err.message);
      console.error("NTI ShowKeyboard error:", err);
    }
  }

  // Override voice mic button behavior
  function overrideVoiceButton() {
    const voiceMicButton = document.querySelector('ytlr-search-voice-mic-button');
    if (!voiceMicButton) {
      return; // Will retry
    }
    
    // Mark as overridden
    if (voiceMicButton._ntiOverridden) {
      return;
    }
    voiceMicButton._ntiOverridden = true;
    
    toast("Voice button found - replacing completely...");
    
    // Nuclear option: Clone the element to remove ALL event listeners
    const newButton = voiceMicButton.cloneNode(true);
    voiceMicButton.parentNode.replaceChild(newButton, voiceMicButton);
    newButton._ntiOverridden = true; // Mark the clone
    
    // Add our handler to the fresh clone
    newButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      toast("Voice button: opening native keyboard!");
      openNativeKeyboard();
      return false;
    }, true);
    
    // Intercept Enter key when focused
    newButton.addEventListener('keydown', (e) => {
      if (e.keyCode === 13 || e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        toast("Voice button Enter: opening native keyboard!");
        openNativeKeyboard();
        return false;
      }
    }, true);
  }
  
  // Run periodically to catch dynamically added buttons
  setInterval(overrideVoiceButton, 500);
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
