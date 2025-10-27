// Listen for messages from background to update the panel iframe content
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request && request.message === 'display_css_in_panel') {
        const el = document.querySelector('#css-display code');
        if (el) el.textContent = request.css;
    }
});

// Copy to clipboard
document.getElementById('copy-button').addEventListener('click', () => {
    const cssCode = document.querySelector('#css-display code').textContent;
    navigator.clipboard.writeText(cssCode).then(() => {
        const button = document.getElementById('copy-button');
        button.textContent = 'Copied!';
        setTimeout(() => { button.textContent = 'Copy'; }, 1500);
    }).catch(err => {
        console.error('Clipboard write failed:', err);
    });
});