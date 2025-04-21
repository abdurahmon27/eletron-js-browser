// Communicate with main process via the preload script
const { ipcRenderer } = window.electron || {};

// Store browser state
let activeTabId = "tab-1";

let tabs = {
  "tab-1": { id: "tab-1", title: "New Tab", url: "", isReady: false },
};

let bookmarks = JSON.parse(localStorage.getItem("bookmarks") || "[]");

// DOM Elements
const tabsContainer = document.getElementById("tabs");
const newTabBtn = document.getElementById("new-tab-btn");
const backBtn = document.getElementById("back-btn");
const forwardBtn = document.getElementById("forward-btn");
const reloadBtn = document.getElementById("reload-btn");
const homeBtn = document.getElementById("home-btn");
const urlInput = document.getElementById("url-input");
const goBtn = document.getElementById("go-btn");
const bookmarkBtn = document.getElementById("bookmark-btn");
const bookmarksBar = document.getElementById("bookmarks-bar");
const webContentsContainer = document.getElementById("web-contents-container");

// Initialize the browser
function initBrowser() {
  // Create the initial webview for first tab
  const firstWebview = document.createElement("webview");
  firstWebview.id = "webview-tab-1"; // This ID format is important - must match later lookups
  firstWebview.className = "web-contents active"; // Make sure it's active
  firstWebview.setAttribute("src", "about:blank");
  firstWebview.setAttribute("allowpopups", "true");
  
  // Configure webview with explicit display styles
  firstWebview.style.width = "100%";
  firstWebview.style.height = "100%";
  firstWebview.style.position = "absolute";
  firstWebview.style.top = "0";
  firstWebview.style.left = "0";
  firstWebview.style.zIndex = "10";
  firstWebview.style.display = "block";
  
  webContentsContainer.appendChild(firstWebview);
  
  // Now set up the first tab UI
  setupFirstTab();
  
  // Set up event listeners for the webview
  setupWebviewEventListeners(firstWebview, "tab-1");
  
  renderBookmarks();
  setupEventListeners();

  // Disable navigation buttons initially
  backBtn.disabled = true;
  forwardBtn.disabled = true;
}

// Set up the first tab properly
function setupFirstTab() {
  // Get the existing first tab from DOM
  const firstTabElement = document.querySelector(`.tab[data-tab-id="tab-1"]`);
  
  if (firstTabElement) {
    // Clear and recreate contents to ensure proper structure
    firstTabElement.innerHTML = "";
    
    // Create title container for proper truncation
    const titleContainer = document.createElement("div");
    titleContainer.className = "tab-title";
    titleContainer.textContent = "New Tab";
    firstTabElement.appendChild(titleContainer);
    
    // Add close button
    const closeBtn = document.createElement("span");
    closeBtn.className = "close-tab";
    closeBtn.innerHTML = "&times;";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeTab("tab-1");
    });
    firstTabElement.appendChild(closeBtn);
    
    // Make sure it has a click handler - use a direct function instead of an arrow function
    firstTabElement.onclick = function() {
      activateTab("tab-1");
    };
  }
}

// Setup webview event listeners
function setupWebviewEventListeners(webview, tabId) {
  // Mark the tab as ready when DOM is ready
  webview.addEventListener("dom-ready", () => {
    console.log(`WebView ${tabId} is now ready`);
    tabs[tabId].isReady = true;

    // Enhanced CSS injection to ensure content displays properly
    webview.insertCSS(`
      :host {
        height: 100% !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
      }
      
      html, body {
        height: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        flex: 1 1 auto !important;
        min-height: 0 !important;
        overflow: hidden !important;
      }
      
      iframe, webview, object, embed {
        flex: 1 1 auto !important;
        height: 100% !important;
        min-height: 0 !important;
        width: 100% !important;
        display: block !important;
        border: 0 !important;
        outline: none !important;
      }
      
      /* Fix for common layout issues with embeds */
      div[role="main"], main, .content-area, .main-content, #content, #main, .content {
        display: flex !important;
        flex-direction: column !important;
        flex: 1 1 auto !important;
        min-height: 0 !important;
      }
    `);
    
    // Update navigation state if this is the active tab
    if (tabId === activeTabId) {
      setTimeout(() => {
        updateNavigationState(webview);
      }, 100);
    }
  });

  // Handle loading errors
  webview.addEventListener("did-fail-load", (e) => {
    // Only handle if error is significant (ignore aborted loads, etc)
    if (e.errorCode !== -3 && e.errorCode !== 0) {
      console.error("Failed to load URL:", e.validatedURL, "Error:", e.errorDescription);
      
      // Display error page
      const errorHTML = `
        <html>
          <head>
            <title>Error loading page</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                color: #333;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                background-color: #f8f8f8;
              }
              .error-container {
                max-width: 600px;
                text-align: center;
                padding: 20px;
                background-color: white;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              }
              h1 { color: #d32f2f; margin-top: 0; }
              .url { font-family: monospace; word-break: break-all; }
              .error-code { opacity: 0.7; font-size: 0.9em; margin-top: 20px; }
              button {
                background-color: #4285f4;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                margin-top: 20px;
              }
              button:hover { background-color: #3367d6; }
            </style>
          </head>
          <body>
            <div class="error-container">
              <h1>Webpage not available</h1>
              <p>The webpage at <strong class="url">${e.validatedURL}</strong> could not be loaded.</p>
              <p>${e.errorDescription || "The site might be temporarily down or may have moved permanently to a new web address."}</p>
              <p class="error-code">Error code: ${e.errorCode}</p>
              <button onclick="window.location.reload()">Try Again</button>
            </div>
          </body>
        </html>
      `;
      
      webview.executeJavaScript(`
        document.open();
        document.write(${JSON.stringify(errorHTML)});
        document.close();
      `);
      
      // Update tab title to reflect error
      updateTabTitle(tabId, `Error: ${new URL(e.validatedURL).hostname || "Page"}`);
      
      // Clear loading state
      const tabElement = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
      if (tabElement) tabElement.classList.remove("loading");
    }
  });
  
  // Update tab title when page title changes
  webview.addEventListener("page-title-updated", (e) => {
    updateTabTitle(tabId, e.title);
  });
  
  // Handle loading state
  webview.addEventListener("did-start-loading", () => {
    if (tabId === activeTabId) {
      // Indicate loading state
      const tabElement = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
      if (tabElement) tabElement.classList.add("loading");
    }
  });
  
  webview.addEventListener("did-stop-loading", () => {
    const tabElement = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
    if (tabElement) tabElement.classList.remove("loading");
    
    // Update navigation state if this is the active tab and is ready
    if (tabId === activeTabId && tabs[tabId].isReady) {
      updateNavigationState(webview);
    }
  });
  
  // Handle navigation
  webview.addEventListener("did-navigate", (e) => {
    updateUrlBar(e.url);
    updateTabUrl(tabId, e.url);
    
    // Update navigation state if this is the active tab and is ready
    if (tabId === activeTabId && tabs[tabId].isReady) {
      updateNavigationState(webview);
    }
  });
  
  webview.addEventListener("did-navigate-in-page", (e) => {
    updateUrlBar(e.url);
    updateTabUrl(tabId, e.url);
    
    // Update navigation state if this is the active tab and is ready
    if (tabId === activeTabId && tabs[tabId].isReady) {
      updateNavigationState(webview);
    }
  });
}

// Create a new tab
function createTab(tabId, activate = false) {
  if (!tabs[tabId]) {
    tabs[tabId] = { id: tabId, title: "New Tab", url: "", isReady: false };
  }

  // Create the tab element if it doesn't exist
  let tabElement = document.querySelector(`.tab[data-tab-id="${tabId}"]`);

  if (!tabElement) {
    tabElement = document.createElement("div");
    tabElement.className = "tab";
    tabElement.setAttribute("data-tab-id", tabId);
    
    // Use direct onclick property assignment - this is crucial for reliable tab switching
    tabElement.onclick = function() {
      activateTab(tabId);
    };

    // Create title container for proper truncation
    const titleContainer = document.createElement("div");
    titleContainer.className = "tab-title";
    titleContainer.textContent = tabs[tabId].title;
    tabElement.appendChild(titleContainer);

    // Add close button
    const closeBtn = document.createElement("span");
    closeBtn.className = "close-tab";
    closeBtn.innerHTML = "&times;";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeTab(tabId);
    });

    tabElement.appendChild(closeBtn);

    tabsContainer.insertBefore(tabElement, newTabBtn);
  }

  // Create webview with a consistent ID format
  const webviewId = `webview-${tabId}`;
  let webview = document.querySelector(`#${webviewId}`);
  
  if (!webview) {
    // Create new webview
    webview = document.createElement("webview");
    webview.id = webviewId;
    webview.className = "web-contents";  // Will add 'active' class if needed
    webview.setAttribute("src", "about:blank");
    webview.setAttribute("allowpopups", "true");
    
    // Set explicit styles for visibility and positioning
    webview.style.position = "absolute";
    webview.style.width = "100%";
    webview.style.height = "100%";
    webview.style.top = "0";
    webview.style.left = "0";
    webview.style.display = "none";
    webview.style.zIndex = "0";
    
    // Add to container first so it's in the DOM before we try to use it
    webContentsContainer.appendChild(webview);
    
    // Set up all necessary event listeners
    setupWebviewEventListeners(webview, tabId);
  }

  // If this tab should be active, activate it now
  if (activate) {
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      activateTab(tabId);
    }, 0);
  }
}

// Activate a tab
function activateTab(tabId) {
  console.log(`Activating tab: ${tabId}`);
  
  // Update activeTabId first
  activeTabId = tabId;
  
  // Deactivate all tabs in the UI
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.remove("active");
  });
  
  // Hide all webviews - first remove the class, then set explicit styles
  document.querySelectorAll(".web-contents").forEach((content) => {
    content.classList.remove("active");
    content.style.display = "none";
    content.style.zIndex = "0";
    content.style.visibility = "hidden";
  });

  // Activate the selected tab in the UI
  const tabElement = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
  if (tabElement) {
    tabElement.classList.add("active");
  } else {
    console.error(`Tab element not found for ID: ${tabId}`);
    return; // Don't proceed if we can't find the tab element
  }
  
  // Find the webview for this tab - handle both ID formats
  let webviewId = `webview-${tabId}`;
  let webview = document.querySelector(`#${webviewId}`);
  
  // Special handling for the first tab which might have a different ID format
  if (!webview && tabId === "tab-1") {
    webview = document.querySelector("#webview-tab-1");
  }
  
  if (webview) {
    console.log(`Found webview for tab ${tabId}: `, webviewId);
    
    // Make this webview visible with explicit styling
    webview.classList.add("active");
    webview.style.display = "block";
    webview.style.zIndex = "10";
    webview.style.visibility = "visible";
    
    // Update URL bar with tab URL
    updateUrlBar(tabs[tabId]?.url || "");

    // Update navigation buttons after a small delay
    setTimeout(() => {
      try {
        updateNavigationState(webview);
      } catch (e) {
        console.error("Error updating navigation state:", e);
        backBtn.disabled = true;
        forwardBtn.disabled = true;
      }
    }, 100);
    
    console.log(`Tab ${tabId} activated successfully`);
  } else {
    console.error(`Webview not found for tab ${tabId}`);
  }
}

// Update navigation buttons based on webview state
function updateNavigationState(webview) {
  if (!webview) return;

  try {
    // Safely check navigation state
    if (webview.canGoBack) {
      backBtn.disabled = !webview.canGoBack();
    } else {
      backBtn.disabled = true;
    }

    if (webview.canGoForward) {
      forwardBtn.disabled = !webview.canGoForward();
    } else {
      forwardBtn.disabled = true;
    }
  } catch (e) {
    console.error("Error updating navigation state:", e);
    // Set default state (disabled) if there's an error
    backBtn.disabled = true;
    forwardBtn.disabled = true;
  }
}

// Close a tab
function closeTab(tabId) {
  const tabElement = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
  const webview = document.querySelector(`#webview-${tabId}`);

  if (tabElement) tabElement.remove();
  if (webview) webview.remove();

  delete tabs[tabId];

  // If we closed the active tab, switch to another tab or create a new one
  if (tabId === activeTabId) {
    const tabIds = Object.keys(tabs);
    if (tabIds.length > 0) {
      activateTab(tabIds[0]);
    } else {
      const newTabId = `tab-${Date.now()}`;
      createTab(newTabId, true);
    }
  }
}

// Update tab title
function updateTabTitle(tabId, title) {
  const tabElement = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
  if (tabElement) {
    // Save the old onclick handler before clearing content
    const oldClickHandler = tabElement.onclick;
    
    // Clear the tab element's content
    tabElement.innerHTML = "";

    // Create title container for proper truncation
    const titleContainer = document.createElement("div");
    titleContainer.className = "tab-title";
    titleContainer.textContent = title || "New Tab";
    tabElement.appendChild(titleContainer);

    // Add close button
    const closeBtn = document.createElement("span");
    closeBtn.className = "close-tab";
    closeBtn.innerHTML = "&times;";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeTab(tabId);
    });
    tabElement.appendChild(closeBtn);
    
    // Restore the click handler
    tabElement.onclick = oldClickHandler || function() {
      activateTab(tabId);
    };
  }

  if (tabs[tabId]) {
    tabs[tabId].title = title || "New Tab";
  }
}

// Update tab URL
function updateTabUrl(tabId, url) {
  if (tabs[tabId]) {
    tabs[tabId].url = url;
  }
}

// Update URL bar
function updateUrlBar(url) {
  // Check if the URL is empty or about:blank || the code that I add || TODO: if any error,type: check first
  if (url == "about:blank" && url.startsWith("about")) {
    url = "";
  }

  urlInput.value = url || "";
}

// Navigate to URL
function navigateToUrl(url) {
  if (!url) return;

  // Add http:// if protocol is missing
  if (!/^(https?|file|about):\/\//i.test(url)) {
    // Check if it's a valid domain format or use search
    if (/^[a-zA-Z0-9][a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/.test(url)) {
      url = `http://${url}`;
    } else {
      url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
    }
  }

  const webview = document.querySelector(`#webview-${activeTabId}`);
  if (webview) {
    try {
      // Show loading state in the tab
      const tabElement = document.querySelector(
        `.tab[data-tab-id="${activeTabId}"]`
      );
      if (tabElement) tabElement.classList.add("loading");

      console.log(`Navigating to: ${url}`);
      
      // For URLs that frequently fail with DNS issues, try using a proxy
      if (url.includes('bekzotovich.uz') || isKnownProblematicDomain(url)) {
        // Try using a different approach - redirecting to a search engine instead
        const searchUrl = `https://www.google.com/search?q=site:${encodeURIComponent(new URL(url).hostname)}`;
        console.log(`URL might be unreachable, redirecting to search: ${searchUrl}`);
        webview.setAttribute("src", searchUrl);
      } else {
        // Use normal navigation for all other URLs
        webview.setAttribute("src", url);
      }
      
      updateTabUrl(activeTabId, url);

      // Monitor if the navigation was successful
      const loadTimeout = setTimeout(() => {
        if (tabs[activeTabId] && tabs[activeTabId].url === url) {
          const tabElement = document.querySelector(
            `.tab[data-tab-id="${activeTabId}"]`
          );
          if (tabElement && tabElement.classList.contains("loading")) {
            console.log(`Navigation timeout for: ${url}`);
            tabElement.classList.remove("loading");
            
            // For timeout errors, show a helpful error page
            showErrorPage(
              webview,
              url,
              "Connection Timed Out",
              `The connection to ${url} timed out. This might be due to a network issue or the server might be unavailable.`,
              -1
            );
          }
        }
      }, 15000); // 15 seconds timeout

      // Add an event listener to clear the timeout if navigation succeeds
      const successHandler = () => {
        clearTimeout(loadTimeout);
        webview.removeEventListener("did-finish-load", successHandler);
      };
      webview.addEventListener("did-finish-load", successHandler);
    } catch (error) {
      console.error("Error navigating to URL:", error);

      // Remove loading state
      const tabElement = document.querySelector(
        `.tab[data-tab-id="${activeTabId}"]`
      );
      if (tabElement) tabElement.classList.remove("loading");

      // Show a more helpful error message
      showErrorPage(
        webview,
        url,
        "Navigation Error",
        `Failed to load ${url}: ${
          error.message || "Unknown error"
        }. Please check your internet connection and try again.`,
        -1
      );
    }
  }
}

// Check if a domain is known to have issues
function isKnownProblematicDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    // List of domains that have known DNS or other issues
    const problematicDomains = [
      'bekzotovich.uz',
      // Add other problematic domains here
    ];
    
    return problematicDomains.some(domain => hostname.includes(domain));
  } catch (e) {
    return false;
  }
}

// Show error page in webview
function showErrorPage(webview, url, title, message, errorCode) {
  if (!webview) return;

  const parsedUrl = url ? new URL(url) : { hostname: "unknown" };
  const errorHTML = `
    <html>
      <head>
        <title>${title}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #333;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background-color: #f8f8f8;
          }
          .error-container {
            max-width: 600px;
            text-align: center;
            padding: 20px;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          h1 { color: #d32f2f; margin-top: 0; }
          .url { font-family: monospace; word-break: break-all; }
          .error-code { opacity: 0.7; font-size: 0.9em; margin-top: 20px; }
          button {
            background-color: #4285f4;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 20px;
          }
          button:hover { background-color: #3367d6; }
        </style>
      </head>
      <body>
        <div class="error-container">
          <h1>${title}</h1>
          <p>The webpage at <strong class="url">${url}</strong> could not be loaded.</p>
          <p>${message}</p>
          ${
            errorCode
              ? `<p class="error-code">Error code: ${errorCode}</p>`
              : ""
          }
          <button onclick="window.location.reload()">Try Again</button>
        </div>
      </body>
    </html>
  `;

  setTimeout(() => {
    try {
      webview
        .executeJavaScript(
          `
        document.open();
        document.write(${JSON.stringify(errorHTML)});
        document.close();
      `
        )
        .catch((e) => console.error("Could not inject error page:", e));
    } catch (e) {
      console.error("Failed to show error page:", e);
    }
  }, 100); // Short delay to ensure webview is ready
}

// Add bookmark
function addBookmark() {
  const url = tabs[activeTabId]?.url;
  const title = tabs[activeTabId]?.title || url;

  if (!url) return;

  // Check if bookmark already exists
  const bookmarkExists = bookmarks.some((bookmark) => bookmark.url === url);
  if (!bookmarkExists) {
    bookmarks.push({ url, title });
    localStorage.setItem("bookmarks", JSON.stringify(bookmarks));
    renderBookmarks();
  }
}

// Render bookmarks
function renderBookmarks() {
  bookmarksBar.innerHTML = "";

  bookmarks.forEach((bookmark, index) => {
    const bookmarkElement = document.createElement("div");
    bookmarkElement.className = "bookmark";
    bookmarkElement.textContent = bookmark.title;
    bookmarkElement.title = bookmark.url;
    bookmarkElement.addEventListener("click", () =>
      navigateToUrl(bookmark.url)
    );

    const removeBtn = document.createElement("span");
    removeBtn.className = "remove-bookmark";
    removeBtn.innerHTML = "&times;";
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      bookmarks.splice(index, 1);
      localStorage.setItem("bookmarks", JSON.stringify(bookmarks));
      renderBookmarks();
    });

    bookmarkElement.appendChild(removeBtn);
    bookmarksBar.appendChild(bookmarkElement);
  });
}

// Set up event listeners
function setupEventListeners() {
  // New tab button
  newTabBtn.addEventListener("click", () => {
    const newTabId = `tab-${Date.now()}`;
    createTab(newTabId, true);
  });

  // Navigation buttons
  backBtn.addEventListener("click", () => {
    const webview = document.querySelector(`#webview-${activeTabId}`);
    if (
      webview &&
      tabs[activeTabId].isReady &&
      webview.canGoBack &&
      webview.canGoBack()
    ) {
      webview.goBack();
    }
  });

  forwardBtn.addEventListener("click", () => {
    const webview = document.querySelector(`#webview-${activeTabId}`);
    if (
      webview &&
      tabs[activeTabId].isReady &&
      webview.canGoForward &&
      webview.canGoForward()
    ) {
      webview.goForward();
    }
  });

  reloadBtn.addEventListener("click", () => {
    const webview = document.querySelector(`#webview-${activeTabId}`);
    if (webview && tabs[activeTabId].isReady) {
      webview.reload();
    }
  });

  homeBtn.addEventListener("click", () => {
    navigateToUrl("https://www.google.com");
  });

  // URL input and go button
  urlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      navigateToUrl(urlInput.value);
    }
  });

  goBtn.addEventListener("click", () => {
    navigateToUrl(urlInput.value);
  });

  // Bookmark button
  bookmarkBtn.addEventListener("click", addBookmark);
}

// Initialize the browser when DOM is ready
document.addEventListener("DOMContentLoaded", initBrowser);
