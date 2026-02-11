// Native Text Input for Android TV Platforms
// Converts YouTube TV's custom search box to standard HTML input for native IME support
// This enables native keyboard and voice input on Fire TV and Google TV

function enableNativeTextInput() {
  const isCobalt = !window.h5vcc || !window.h5vcc.tizentube;
  if (!isCobalt) return;
  if (!window._yttv) {
    setTimeout(enableNativeTextInput, 250);
    return;
  }

  // Get keyboard callback reference (zd callback from any keyboard button)
  // Retries if keyboard is not yet available
  function getKeyboardCallback() {
    const keyboardButtons = Array.from(document.querySelectorAll("yt-keyboard-key"));
    const anyButton = keyboardButtons.find((btn) => {
      const text = btn.textContent?.trim();
      return text && text.length === 1 && /^[A-Z]$/i.test(text);
    });
    const callback = anyButton?.__instance?.props?.zd;
    if (typeof callback === "function") {
      return callback;
    }
    return null;
  }

  // Get special button callbacks (backspace, space, clear)
  function getSpecialButtonCallback(action) {
    const keyboardButtons = Array.from(document.querySelectorAll("yt-keyboard-key"));
    const button = keyboardButtons.find((btn) => {
      const text = btn.textContent?.trim();
      if (action === "BACKSPACE") return text === "Backspace";
      if (action === "SPACE") return text === "SPACE";
      if (action === "CLEAR") return text === "CLEAR";
      return false;
    });
    const callback = button?.__instance?.props?.zd;
    if (typeof callback === "function") {
      return callback;
    }
    return null;
  }

  function patchSearchTextBox() {
    const searchTextBox = document.querySelector("ytlr-search-text-box");
    if (!searchTextBox) return;
    if (searchTextBox._ttNativeInputPatched) return;
    const textBox = searchTextBox.querySelector("ytlr-text-box");
    if (!textBox) return;
    if (textBox.querySelector("input")) return;

    // Remove role="button" and tabIndex from parent to allow input to be focusable
    textBox.removeAttribute("role");
    textBox.removeAttribute("tabindex");

    // Create standard input element
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Search";
    input.setAttribute("aria-label", "Search");
    input.style.cssText =
      "width: 100%; height: 100%; background: transparent; border: none; color: inherit; font-size: inherit; font-family: inherit; padding: 0; margin: 0; outline: none;";

    // Replace content with input
    textBox.innerHTML = "";
    textBox.appendChild(input);
    searchTextBox._ttNativeInputPatched = true;

    // Prevent YouTube TV from replacing our input by intercepting innerHTML setter
    const originalInnerHTML = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(textBox),
      "innerHTML"
    );
    
    let isUpdatingFromInput = false;
    
    Object.defineProperty(textBox, "innerHTML", {
      get: function() {
        // Return a structure that YouTube TV expects, but keep our input
        if (isUpdatingFromInput) {
          return originalInnerHTML ? originalInnerHTML.get.call(this) : "";
        }
        // When YouTube TV reads innerHTML, return the input's value formatted
        const value = input.value;
        if (!value) return "";
        return `<div dir="ltr" class="e4W0B"><div class="DvQL1c"><span class="PyCend"><span class="wzNiJf w5DDBc">${value}</span></span></div></div>`;
      },
      set: function(value) {
        // Extract text from YouTube TV's HTML structure
        if (!isUpdatingFromInput && value) {
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = value;
          const extractedText = tempDiv.textContent || tempDiv.innerText || "";
          if (extractedText !== input.value) {
            input.value = extractedText;
            // Trigger input event to update YouTube TV's search state
            const inputEvent = new InputEvent("input", {
              bubbles: true,
              cancelable: true,
              inputType: "insertText",
              data: extractedText
            });
            input.dispatchEvent(inputEvent);
            textBox.dispatchEvent(inputEvent);
            searchTextBox.dispatchEvent(inputEvent);
          }
        }
        // Don't actually set innerHTML - keep our input
      },
      configurable: true
    });
    
    // Override textContent to sync with input value
    Object.defineProperty(textBox, "textContent", {
      get: function() {
        return input.value;
      },
      set: function(value) {
        if (value !== input.value) {
          input.value = value;
          // Trigger YouTube TV's update mechanism
          const inputEvent = new InputEvent("input", {
            bubbles: true,
            cancelable: true,
            inputType: "insertText",
            data: value
          });
          input.dispatchEvent(inputEvent);
          textBox.dispatchEvent(inputEvent);
          searchTextBox.dispatchEvent(inputEvent);
        }
      },
      configurable: true
    });
    
    // Track previous value to detect changes
    let previousValue = input.value;

    // Listen for input changes and sync to YouTube TV via keyboard callback
    input.addEventListener("input", (e) => {
      const value = input.value;
      const inputType = e.inputType || "insertText";
      
      // Get keyboard callback
      const zdCallback = getKeyboardCallback();
      if (zdCallback && typeof zdCallback === "function") {
        // Detect what changed
        if (inputType === "deleteContentBackward" || inputType === "deleteBackward") {
          // Backspace was pressed
          const backspaceCallback = getSpecialButtonCallback("BACKSPACE");
          if (backspaceCallback && typeof backspaceCallback === "function") {
            backspaceCallback({
              label: "Backspace",
              action: "BACKSPACE",
              ariaLabel: "backspace"
            });
          }
        } else if (value.length > previousValue.length) {
          // Characters were added
          const addedChars = value.slice(previousValue.length);
          for (let i = 0; i < addedChars.length; i++) {
            const char = addedChars[i];
            if (char === " ") {
              // Space character
              const spaceCallback = getSpecialButtonCallback("SPACE");
              if (spaceCallback && typeof spaceCallback === "function") {
                spaceCallback({
                  label: "SPACE",
                  action: "SPACE",
                  ariaLabel: "space"
                });
              }
            } else if (/^[a-zA-Z0-9\-']$/.test(char)) {
              // Regular character
              zdCallback({
                label: char.toUpperCase(),
                action: "TEXT",
                ariaLabel: char.toLowerCase()
              });
            }
          }
        } else if (value.length < previousValue.length) {
          // Characters were deleted (but not via backspace - might be cut/delete)
          // Use backspace callback for each deleted character
          const deletedCount = previousValue.length - value.length;
          const backspaceCallback = getSpecialButtonCallback("BACKSPACE");
          if (backspaceCallback && typeof backspaceCallback === "function") {
            for (let i = 0; i < deletedCount; i++) {
              backspaceCallback({
                label: "Backspace",
                action: "BACKSPACE",
                ariaLabel: "backspace"
              });
            }
          }
        }
      }
      
      previousValue = value;
      
      // Update YouTube TV's display by setting textContent (which triggers innerHTML getter)
      isUpdatingFromInput = true;
      textBox.textContent = value;
      isUpdatingFromInput = false;
      
      // Dispatch events for YouTube TV's listeners
      const textBoxEvent = new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        inputType: inputType,
        data: value
      });
      textBox.dispatchEvent(textBoxEvent);
      searchTextBox.dispatchEvent(textBoxEvent);
    });

    input.addEventListener("focus", () => {
      input.focus();
    });
    
    // Sync on paste - trigger zd callback for each pasted character
    input.addEventListener("paste", (e) => {
      setTimeout(() => {
        const value = input.value;
        const zdCallback = getKeyboardCallback();
        
        if (zdCallback && typeof zdCallback === "function") {
          // Get the pasted portion (difference between old and new value)
          const pastedText = value.slice(previousValue.length);
          for (let i = 0; i < pastedText.length; i++) {
            const char = pastedText[i];
            if (char === " ") {
              const spaceCallback = getSpecialButtonCallback("SPACE");
              if (spaceCallback && typeof spaceCallback === "function") {
                spaceCallback({
                  label: "SPACE",
                  action: "SPACE",
                  ariaLabel: "space"
                });
              }
            } else if (/^[a-zA-Z0-9\-']$/.test(char)) {
              zdCallback({
                label: char.toUpperCase(),
                action: "TEXT",
                ariaLabel: char.toLowerCase()
              });
            }
          }
        }
        
        previousValue = value;
        isUpdatingFromInput = true;
        textBox.textContent = value;
        isUpdatingFromInput = false;
        
        const event = new InputEvent("input", {
          bubbles: true,
          cancelable: true,
          inputType: "insertFromPaste",
          data: value
        });
        textBox.dispatchEvent(event);
        searchTextBox.dispatchEvent(event);
      }, 0);
    });
    
    // Watch for when YouTube TV tries to replace our input
    const textBoxObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList" && !textBox.querySelector("input")) {
          // YouTube TV replaced our input, re-apply patch
          setTimeout(() => {
            if (!textBox.querySelector("input")) {
              patchSearchTextBox();
            }
          }, 0);
        }
      });
    });
    
    textBoxObserver.observe(textBox, { childList: true, subtree: true });

    console.log(
      "TizenTube Native Text Input: Converted search text box to native input",
    );
  }

  // Watch for search text box elements
  const observer = new MutationObserver(() => {
    patchSearchTextBox();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  patchSearchTextBox();
}

if (
  document.readyState === "complete" ||
  document.readyState === "interactive"
) {
  enableNativeTextInput();
} else {
  document.addEventListener("DOMContentLoaded", enableNativeTextInput);
  window.addEventListener("load", enableNativeTextInput);
}
