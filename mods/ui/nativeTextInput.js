// Native Text Input for Android TV Platforms
// Adds invisible <input> to search box for native IME support (Fire TV, Google TV)

function enableNativeTextInput() {
  if (!window.h5vcc || !window.h5vcc.tizentube) return; // Cobalt only
  if (!window._yttv) {
    setTimeout(enableNativeTextInput, 250);
    return;
  }

  function updateSearchState(value) {
    const container = document.querySelector("ytlr-search-container");
    const instance = container?.__instance;
    const state = instance?.state?.searchState;
    const w1 = instance?.w1;
    if (!state || typeof w1 !== "function") return false;
    w1.call(instance, {
      ...state,
      searchQuery: { userInput: value, tc: "", uc: "PRE_FETCH_SUGGESTION" },
    });
    return true;
  }

  function patchSearchTextBox() {
    const searchTextBox = document.querySelector("ytlr-search-text-box");
    if (!searchTextBox || searchTextBox._ttPatched) return;
    const textBox = searchTextBox.querySelector("ytlr-text-box");
    if (!textBox || textBox.querySelector("input")) return;

    const input = document.createElement("input");
    input.type = "text";
    input.setAttribute("aria-label", "Search");
    input.style.cssText =
      "position:absolute;width:100%;height:100%;opacity:0;border:none;outline:none;background:transparent;color:transparent;";

    if (getComputedStyle(textBox).position === "static") {
      textBox.style.position = "relative";
    }
    textBox.appendChild(input);
    searchTextBox._ttPatched = true;

    // On input change, update YouTube TV's search state directly
    input.addEventListener("input", () => {
      updateSearchState(input.value);
    });

    // Prevent framework from removing our input
    const origRemoveChild = textBox.removeChild.bind(textBox);
    textBox.removeChild = function (node) {
      if (node === input) return node;
      return origRemoveChild(node);
    };

    console.log("TizenTube Native Text Input: patched search box");
  }

  const observer = new MutationObserver(() => patchSearchTextBox());
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
}
