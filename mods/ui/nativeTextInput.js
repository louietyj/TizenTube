// Native Text Input for Android TV Platforms (Fire TV, Google TV)
// Diagnostic + attempt to trigger native IME via all available APIs

function toast(msg) {
  try {
    const el = document.createElement("div");
    el.textContent = "NTI: " + msg;
    el.style.cssText =
      "position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:99999;" +
      "background:rgba(0,0,0,0.85);color:#0f0;padding:8px 16px;border-radius:6px;" +
      "font-size:14px;pointer-events:none;transition:opacity .5s;max-width:90%;word-break:break-all;";
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; }, 5000);
    setTimeout(() => el.remove(), 5500);
  } catch (_) {}
}

// Persistent debug log panel (bottom of screen)
let debugPanel = null;
function debugLog(msg) {
  console.log("NTI: " + msg);
  try {
    if (!debugPanel) {
      debugPanel = document.createElement("div");
      debugPanel.style.cssText =
        "position:fixed;bottom:0;left:0;width:100%;max-height:30%;overflow-y:auto;" +
        "z-index:99998;background:rgba(0,0,0,0.9);color:#0f0;font-size:12px;" +
        "font-family:monospace;padding:4px 8px;pointer-events:none;";
      document.body.appendChild(debugPanel);
    }
    const line = document.createElement("div");
    line.textContent = new Date().toLocaleTimeString() + " " + msg;
    debugPanel.appendChild(line);
    debugPanel.scrollTop = debugPanel.scrollHeight;
  } catch (_) {}
}

function enableNativeTextInput() {
  if (!window.h5vcc || !window.h5vcc.tizentube) return;
  if (!window._yttv) {
    setTimeout(enableNativeTextInput, 250);
    return;
  }

  // === DIAGNOSTIC: dump available APIs ===
  // h5vcc properties are non-enumerable, so Object.keys() returns [].
  // Probe known Cobalt h5vcc sub-objects and use getOwnPropertyNames + for..in
  const h5 = window.h5vcc;
  const knownH5vccProps = [
    "accessibility", "audioColumns", "cVal", "crashLog", "metrics",
    "runtime", "settings", "storage", "system", "traceEvent",
    "updater", "screen", "tizentube", "net", "sso", "speech",
    "pairDevice", "telephony", "time", "account"
  ];
  const foundProps = [];
  for (const name of knownH5vccProps) {
    try {
      if (h5[name] !== undefined) foundProps.push(name + ":" + typeof h5[name]);
    } catch (_) {}
  }
  // Also try getOwnPropertyNames and for..in
  try {
    const ownNames = Object.getOwnPropertyNames(h5);
    if (ownNames.length) foundProps.push("__own__=[" + ownNames.join(",") + "]");
  } catch (_) {}
  try {
    const inherited = [];
    for (const k in h5) inherited.push(k);
    if (inherited.length) foundProps.push("__forin__=[" + inherited.join(",") + "]");
  } catch (_) {}
  // Proto
  try {
    const proto = Object.getPrototypeOf(h5);
    if (proto && proto !== Object.prototype) {
      const protoNames = Object.getOwnPropertyNames(proto);
      foundProps.push("__proto__=[" + protoNames.join(",") + "]");
    }
  } catch (_) {}
  debugLog("=== h5vcc found: " + foundProps.join(" | "));

  // Deep-dump each found sub-object
  for (const name of knownH5vccProps) {
    try {
      const val = h5[name];
      if (val === undefined) continue;
      if (typeof val === "object" && val !== null) {
        const sub = [];
        // getOwnPropertyNames
        try { for (const k of Object.getOwnPropertyNames(val)) sub.push(k); } catch (_) {}
        // prototype
        try {
          const p = Object.getPrototypeOf(val);
          if (p && p !== Object.prototype) {
            for (const k of Object.getOwnPropertyNames(p)) {
              if (k !== "constructor") sub.push("(p)" + k);
            }
          }
        } catch (_) {}
        debugLog("  h5vcc." + name + ": " + sub.join(", "));
      } else {
        debugLog("  h5vcc." + name + " = " + typeof val + ": " + String(val).slice(0, 100));
      }
    } catch (e) {
      debugLog("  h5vcc." + name + " ERROR: " + e.message);
    }
  }

  // Check window.onScreenKeyboard
  const osk = window.onScreenKeyboard;
  if (osk) {
    debugLog("=== window.onScreenKeyboard EXISTS ===");
    try {
      const oskKeys = [];
      for (const k in osk) oskKeys.push(k);
      debugLog("onScreenKeyboard keys: " + oskKeys.join(", "));
      debugLog("onScreenKeyboard.shown = " + osk.shown);
      debugLog("onScreenKeyboard.data = " + JSON.stringify(osk.data));
      debugLog("onScreenKeyboard.suggestions_supported = " + osk.suggestions_supported);
    } catch (e) {
      debugLog("onScreenKeyboard inspect error: " + e.message);
    }
  } else {
    debugLog("=== window.onScreenKeyboard is UNDEFINED ===");
  }

  // Check navigator.virtualKeyboard
  if (navigator.virtualKeyboard) {
    debugLog("navigator.virtualKeyboard EXISTS: " + Object.keys(navigator.virtualKeyboard).join(", "));
  } else {
    debugLog("navigator.virtualKeyboard is undefined");
  }

  toast("Diagnostics dumped. Press Enter on search to test IME.");

  // === FUNCTIONAL: try to open keyboard on Enter ===
  let nativeInput = null;

  function patchSearchTextBox() {
    const searchTextBox = document.querySelector("ytlr-search-text-box");
    if (!searchTextBox || searchTextBox._ntiPatched) return;
    const textBox = searchTextBox.querySelector("ytlr-text-box");
    if (!textBox) return;
    if (textBox.querySelector("#nti-input")) return;

    const input = document.createElement("input");
    input.id = "nti-input";
    input.type = "text";
    input.inputMode = "text";
    input.autocomplete = "off";
    input.setAttribute("aria-label", "Search with keyboard");
    input.setAttribute("tabindex", "-1");
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

    input.addEventListener("focus", () => {
      input.style.opacity = "1";
      input.style.background = "rgba(255,255,255,0.95)";
      input.style.color = "#000";
      input.style.border = "3px solid #ff0000";
      input.style.borderRadius = "4px";
      debugLog("INPUT FOCUSED (JS event fired)");
    });

    input.addEventListener("blur", () => {
      input.style.opacity = "0";
      input.style.background = "transparent";
      input.style.color = "transparent";
      input.style.border = "none";
      debugLog("INPUT BLURRED");
    });

    input.addEventListener("input", () => {
      debugLog("INPUT EVENT: value='" + input.value + "'");
    });

    // Prevent removal
    const origRemoveChild = textBox.removeChild.bind(textBox);
    textBox.removeChild = function (node) {
      if (node === input) return node;
      return origRemoveChild(node);
    };

    debugLog("Search box patched with <input>");
  }

  // Attempt all known ways to trigger the keyboard
  function tryShowKeyboard() {
    debugLog("--- Attempting all keyboard triggers ---");

    // Method 1: .focus() on input
    if (nativeInput) {
      nativeInput.focus();
      debugLog("Method 1: input.focus() called. activeElement=" + document.activeElement?.id);
    }

    // Method 2: .click() on input
    if (nativeInput) {
      nativeInput.click();
      debugLog("Method 2: input.click() called");
    }

    // Method 3: Dispatch synthetic touch events
    if (nativeInput) {
      try {
        const rect = nativeInput.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        nativeInput.dispatchEvent(new TouchEvent("touchstart", {
          touches: [new Touch({ identifier: 1, target: nativeInput, clientX: x, clientY: y })],
          bubbles: true
        }));
        nativeInput.dispatchEvent(new TouchEvent("touchend", {
          changedTouches: [new Touch({ identifier: 1, target: nativeInput, clientX: x, clientY: y })],
          bubbles: true
        }));
        debugLog("Method 3: Synthetic touch events dispatched");
      } catch (e) {
        debugLog("Method 3 FAILED: " + e.message);
      }
    }

    // Method 4: window.onScreenKeyboard.Show()
    const osk = window.onScreenKeyboard;
    if (osk && typeof osk.Show === "function") {
      try {
        const promise = osk.Show();
        debugLog("Method 4: onScreenKeyboard.Show() called, returned: " + typeof promise);
        if (promise && typeof promise.then === "function") {
          promise.then(() => debugLog("Method 4: Show() promise RESOLVED"))
                 .catch(e => debugLog("Method 4: Show() promise REJECTED: " + e));
        }
      } catch (e) {
        debugLog("Method 4 FAILED: " + e.message);
      }
    } else {
      debugLog("Method 4: onScreenKeyboard.Show not available");
    }

    // Method 5: window.onScreenKeyboard.Focus()
    if (osk && typeof osk.Focus === "function") {
      try {
        const promise = osk.Focus();
        debugLog("Method 5: onScreenKeyboard.Focus() called");
        if (promise && typeof promise.then === "function") {
          promise.then(() => debugLog("Method 5: Focus() promise RESOLVED"))
                 .catch(e => debugLog("Method 5: Focus() promise REJECTED: " + e));
        }
      } catch (e) {
        debugLog("Method 5 FAILED: " + e.message);
      }
    } else {
      debugLog("Method 5: onScreenKeyboard.Focus not available");
    }

    // Method 6: Try contenteditable div
    try {
      let ce = document.getElementById("nti-contenteditable");
      if (!ce) {
        ce = document.createElement("div");
        ce.id = "nti-contenteditable";
        ce.contentEditable = "true";
        ce.setAttribute("tabindex", "0");
        ce.style.cssText =
          "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);" +
          "width:300px;height:50px;background:white;color:black;border:3px solid blue;" +
          "font-size:24px;z-index:99999;padding:8px;";
        document.body.appendChild(ce);
      }
      ce.focus();
      debugLog("Method 6: contenteditable div focused. activeElement=" + document.activeElement?.id);
    } catch (e) {
      debugLog("Method 6 FAILED: " + e.message);
    }

    // Method 7: Try textarea
    try {
      let ta = document.getElementById("nti-textarea");
      if (!ta) {
        ta = document.createElement("textarea");
        ta.id = "nti-textarea";
        ta.setAttribute("tabindex", "0");
        ta.style.cssText =
          "position:fixed;top:60%;left:50%;transform:translate(-50%,-50%);" +
          "width:300px;height:50px;background:white;color:black;border:3px solid green;" +
          "font-size:24px;z-index:99999;padding:8px;";
        document.body.appendChild(ta);
      }
      ta.focus();
      debugLog("Method 7: textarea focused. activeElement=" + document.activeElement?.id);
    } catch (e) {
      debugLog("Method 7 FAILED: " + e.message);
    }

    toast("All 7 methods attempted. Check debug log.");
  }

  // Check if search area is active
  function isSearchActive() {
    const container = document.querySelector("ytlr-search-container");
    if (!container) return false;
    return !!container.querySelector(".zylon-focus");
  }

  // Intercept Enter key
  document.addEventListener("keydown", (e) => {
    if ((e.keyCode === 13 || e.key === "Enter") && isSearchActive()) {
      if (document.activeElement === nativeInput) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      tryShowKeyboard();
      return;
    }
    if (e.keyCode === 27 || e.key === "Escape" || e.keyCode === 10009) {
      if (nativeInput && document.activeElement === nativeInput) {
        e.preventDefault();
        e.stopPropagation();
        nativeInput.blur();
        // Also remove contenteditable and textarea
        document.getElementById("nti-contenteditable")?.remove();
        document.getElementById("nti-textarea")?.remove();
        debugLog("Escape: blurred input, removed test elements");
        return;
      }
    }
  }, true);

  // Observer
  function startObserver() {
    if (!document.body) { setTimeout(startObserver, 50); return; }
    const observer = new MutationObserver(() => {
      try { patchSearchTextBox(); } catch (err) { debugLog("Patch error: " + err.message); }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    patchSearchTextBox();
  }
  startObserver();
}

try {
  if (document.readyState === "complete" || document.readyState === "interactive") {
    enableNativeTextInput();
  } else {
    document.addEventListener("DOMContentLoaded", enableNativeTextInput);
  }
} catch (err) {
  console.error("NativeTextInput init failed:", err);
}
