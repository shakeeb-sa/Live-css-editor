document.getElementById('toggleEditor').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) {
      console.error('No active tab found.');
      return;
    }
    chrome.runtime.sendMessage({
      message: 'inject_content_script',
      tabId: tabs[0].id
    });
  });
});