// Background service worker with robust checks and error handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && request.message === 'inject_content_script') {
    if (!request.tabId) {
      console.error('inject_content_script missing tabId');
      return;
    }
    chrome.scripting.executeScript({
      target: { tabId: request.tabId },
      files: ['content.js']
    }).catch(err => {
      console.error('Failed to inject content.js:', err);
    });
    return;
  }

  // Receive CSS updates from content script and forward to the same tab where the content script runs
  if (request && request.message === 'css_updated') {
    const tabId = sender && sender.tab && sender.tab.id;
    if (typeof tabId !== 'undefined') {
      chrome.tabs.sendMessage(tabId, {
        message: 'display_css_in_panel',
        css: request.css
      }, (resp) => {
        if (chrome.runtime.lastError) {
          // It's possible the frame isn't ready to receive messages yet
          console.warn('Could not send message to tab:', chrome.runtime.lastError.message);
        }
      });
    } else {
      console.warn('css_updated received but sender.tab is undefined. Dropping message.');
    }
    return;
  }
});