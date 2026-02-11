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

  // Get the search container's w1 method which updates search state and triggers autocomplete
  // This is the proper entry point: (1) replace source of truth (2) trigger autocomplete entry point
  function getSearchStateUpdater() {
    const searchContainer = document.querySelector("ytlr-search-container");
    if (!searchContainer || !searchContainer.__instance) {
      return null;
    }
    const w1Method = searchContainer.__instance.w1;
    if (typeof w1Method === "function") {
      return w1Method.bind(searchContainer.__instance);
    }
    return null;
  }

  // Get current search state from the container
  function getCurrentSearchState() {
    const searchContainer = document.querySelector("ytlr-search-container");
    if (!searchContainer || !searchContainer.__instance) {
      return null;
    }
    return searchContainer.__instance.state?.searchState || null;
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
    // Make input invisible but keep it functional for Fire TV's native IME
    // opacity: 0 makes it invisible, but it remains focusable and functional
    input.style.cssText =
      "position: absolute; width: 100%; height: 100%; background: transparent; border: none; color: transparent; font-size: inherit; font-family: inherit; padding: 0; margin: 0; outline: none; opacity: 0;";
    
    // Ensure textBox has position relative so absolute positioning works
    const textBoxStyle = window.getComputedStyle(textBox);
    if (textBoxStyle.position === 'static') {
      textBox.style.position = 'relative';
    }

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
        // Extract text from YouTube TV's HTML structure and update input
        // But DON'T actually set innerHTML - keep our input element
        if (!isUpdatingFromInput && value && input && input.parentNode === textBox) {
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
        // Don't call original setter - prevent YouTube TV from replacing our input
        // If input was removed somehow, re-apply patch
        if (!textBox.querySelector("input")) {
          setTimeout(() => patchSearchTextBox(), 0);
        }
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

    // Listen for input changes and sync to YouTube TV via w1 method
    // This updates the source of truth and triggers autocomplete in one call
    input.addEventListener("input", (e) => {
      const value = input.value;
      const inputType = e.inputType || "insertText";
      
      // Get the search state updater (w1 method)
      const updateSearchState = getSearchStateUpdater();
      const currentState = getCurrentSearchState();
      
      if (updateSearchState && currentState) {
        // Update searchQuery with the new value
        // Structure: { userInput: "text", tc: "", uc: "PRE_FETCH_SUGGESTION" }
        const newSearchQuery = {
          userInput: value,
          tc: "",
          uc: "PRE_FETCH_SUGGESTION"
        };
        
        // Create partial searchState update with new searchQuery
        const searchStateUpdate = {
          ...currentState,
          searchQuery: newSearchQuery
        };
        
        // Call w1 to update source of truth and trigger autocomplete
        try {
          updateSearchState(searchStateUpdate);
        } catch (err) {
          console.warn("TizenTube Native Text Input: Failed to update search state", err);
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
    
    // Prevent YouTube TV from replacing our input by intercepting DOM manipulation methods
    const originalReplaceChildren = textBox.replaceChildren;
    const originalAppendChild = textBox.appendChild;
    const originalRemoveChild = textBox.removeChild;
    
    textBox.replaceChildren = function(...nodes) {
      // If trying to replace with non-input elements, extract text and update input instead
      const hasInput = nodes.some(node => node.tagName === "INPUT");
      if (!hasInput && input && input.parentNode === textBox) {
        // Extract text from nodes
        const tempDiv = document.createElement("div");
        nodes.forEach(node => tempDiv.appendChild(node.cloneNode(true)));
        const extractedText = tempDiv.textContent || tempDiv.innerText || "";
        if (extractedText !== input.value) {
          input.value = extractedText;
          const inputEvent = new InputEvent("input", {
            bubbles: true,
            cancelable: true,
            inputType: "insertText",
            data: extractedText
          });
          input.dispatchEvent(inputEvent);
        }
        return; // Don't actually replace children
      }
      return originalReplaceChildren.apply(this, nodes);
    };
    
    textBox.appendChild = function(node) {
      // If trying to append a non-input when we have an input, update input value instead
      if (node.tagName !== "INPUT" && input && input.parentNode === textBox) {
        const extractedText = node.textContent || node.innerText || "";
        if (extractedText && extractedText !== input.value) {
          input.value = extractedText;
          const inputEvent = new InputEvent("input", {
            bubbles: true,
            cancelable: true,
            inputType: "insertText",
            data: extractedText
          });
          input.dispatchEvent(inputEvent);
        }
        return node; // Return node but don't actually append
      }
      return originalAppendChild.apply(this, arguments);
    };
    
    textBox.removeChild = function(node) {
      // Prevent removal of our input element
      if (node === input) {
        console.warn("TizenTube Native Text Input: Prevented removal of input element");
        return node; // Return node but don't actually remove
      }
      return originalRemoveChild.apply(this, arguments);
    };
    
    // Watch for when YouTube TV tries to replace our input
    const textBoxObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList" && !textBox.querySelector("input")) {
          // YouTube TV replaced our input, re-apply patch immediately
          if (!textBox.querySelector("input")) {
            patchSearchTextBox();
          }
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
