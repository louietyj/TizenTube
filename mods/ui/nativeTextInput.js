// Native Text Input for Android TV Platforms (Fire TV, Google TV)
// Intercepts YouTube TV's on-screen keyboard and provides native IME input instead.
//
// How it works:
// 1. When the search page is detected, we inject a hidden <input> element
// 2. We listen for Enter/OK key presses on the search keyboard area
// 3. On Enter, we programmatically .focus() the input, which triggers the Android IME
// 4. Text typed in the IME is synced back to YouTube's search state
// 5. On blur/back, focus returns to YouTube's navigation

function toast(msg) {
  try {
    const el = document.createElement("div");
    el.textContent = "NTI: " + msg;
    el.style.cssText =
      "position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:99999;" +
      "background:rgba(0,0,0,0.85);color:#0f0;padding:8px 16px;border-radius:6px;" +
      "font-size:16px;pointer-events:none;transition:opacity .5s;";
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

  toast("NTI module found: waiting for search box");

  // --- Search state updater ---
  function updateSearchState(value) {
    const container = document.querySelector("ytlr-search-container");
    const instance = container?.__instance;
    const searchState = instance?.state?.searchState;
    if (!searchState) return false;

    // Find the state updater function on the instance
    // It's the method whose source mentions "searchState" but isn't a lifecycle method
    const propNames = Object.getOwnPropertyNames(Object.getPrototypeOf(instance) || instance);
    for (const name of propNames) {
      if (name === "template" || name === "constructor") continue;
      try {
        const fn = instance[name];
        if (typeof fn !== "function") continue;
        const src = fn.toString();
        if (src.includes("searchState") && !src.includes(".call(this,")) {
          fn.call(instance, {
            searchQuery: {
              ...searchState.searchQuery,
              userInput: value,
            },
          });
          return true;
        }
      } catch (_) {}
    }
    return false;
  }

  // --- Check if user is currently on the search keyboard ---
  function isSearchKeyboardActive() {
    // The search keyboard is the grid of letter keys inside ytlr-search-container
    const container = document.querySelector("ytlr-search-container");
    if (!container) return false;

    // Check if search container or any child has zylon-focus (= YouTube TV focus)
    const focused = container.querySelector(".zylon-focus");
    if (focused) return true;

    // Also check if the search text box area has focus
    const textBox = document.querySelector("ytlr-search-text-box > .zylon-focus");
    if (textBox) return true;

    return false;
  }

  let nativeInput = null;

  // --- Patch the search text box with our hidden input ---
  function patchSearchTextBox() {
    const searchTextBox = document.querySelector("ytlr-search-text-box");
    if (!searchTextBox || searchTextBox._ntiPatched) return;

    const textBox = searchTextBox.querySelector("ytlr-text-box");
    if (!textBox) return;

    // Don't patch if input already exists
    if (textBox.querySelector("#nti-input")) return;

    const input = document.createElement("input");
    input.id = "nti-input";
    input.type = "text";
    input.setAttribute("aria-label", "Search with keyboard");
    input.setAttribute("tabindex", "-1"); // Not D-pad focusable; we focus it programmatically

    // Visible but positioned over the text display area
    input.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;" +
      "opacity:0;border:none;outline:none;background:transparent;" +
      "color:transparent;font-size:24px;padding:0 8px;z-index:10;";

    if (getComputedStyle(textBox).position === "static") {
      textBox.style.position = "relative";
    }
    textBox.appendChild(input);
    nativeInput = input;
    searchTextBox._ntiPatched = true;

    // --- Event handlers ---

    // On input change, update YouTube TV's search state
    input.addEventListener("input", () => {
      const ok = updateSearchState(input.value);
      toast("typing: '" + input.value + "' synced=" + ok);
    });

    // On focus, show visual indicator
    input.addEventListener("focus", () => {
      input.style.opacity = "1";
      input.style.background = "rgba(255,255,255,0.95)";
      input.style.color = "#000";
      input.style.border = "3px solid #ff0000";
      input.style.borderRadius = "4px";
      toast("FOCUSED - native keyboard should appear");
    });

    // On blur, hide visual indicator and return to YouTube navigation
    input.addEventListener("blur", () => {
      input.style.opacity = "0";
      input.style.background = "transparent";
      input.style.color = "transparent";
      input.style.border = "none";
      toast("Keyboard dismissed");
    });

    // Prevent YouTube's framework from removing our input
    const origRemoveChild = textBox.removeChild.bind(textBox);
    textBox.removeChild = function (node) {
      if (node === input) return node;
      return origRemoveChild(node);
    };

    toast("patched! Press Enter on search keyboard to type");
    console.log("NTI: patched search box, input injected");
  }

  // --- Global key listener to intercept Enter on search keyboard ---
  document.addEventListener(
    "keydown",
    (e) => {
      // Enter/OK key (keyCode 13) or Center D-pad
      if (e.keyCode === 13 || e.key === "Enter") {
        if (nativeInput && isSearchKeyboardActive()) {
          // If the input is already focused, let Enter pass through (submit, etc.)
          if (document.activeElement === nativeInput) return;

          // Focus the native input to bring up the IME
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          // Sync current search text to input before focusing
          const container = document.querySelector("ytlr-search-container");
          const instance = container?.__instance;
          const currentQuery =
            instance?.state?.searchState?.searchQuery?.userInput || "";
          nativeInput.value = currentQuery;

          nativeInput.focus();
          // Also try click() which may help on some Cobalt versions
          nativeInput.click();

          toast("Focusing native input...");
          return;
        }
      }

      // Back button (keyCode 27 = Escape, or 10009 on some Tizen/Cobalt)
      if (
        e.keyCode === 27 ||
        e.key === "Escape" ||
        e.keyCode === 10009
      ) {
        if (nativeInput && document.activeElement === nativeInput) {
          e.preventDefault();
          e.stopPropagation();
          nativeInput.blur();
          toast("Back to YouTube keyboard");
          return;
        }
      }
    },
    true // capture phase - run before YouTube's handlers
  );

  // --- MutationObserver to patch when search page appears ---
  function startObserver() {
    if (!document.body) {
      setTimeout(startObserver, 50);
      return;
    }

    const observer = new MutationObserver(() => {
      try {
        patchSearchTextBox();
      } catch (err) {
        console.error("NTI patch error:", err);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    patchSearchTextBox();
  }

  startObserver();
}

// --- Init ---
try {
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    enableNativeTextInput();
  } else {
    document.addEventListener("DOMContentLoaded", enableNativeTextInput);
  }
} catch (err) {
  console.error("NativeTextInput init failed:", err);
}
