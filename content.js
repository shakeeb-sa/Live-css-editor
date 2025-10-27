(function() {
    // Prevent script from running multiple times
    if (window.liveCssEditorActive) return;
    window.liveCssEditorActive = true;

    let selectedElement = null;
    let generatedStyles = {};
    let panelIframe = null;
    let selectionOverlay = null;

    // --- INITIALIZATION ---
    createPanel();
    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);
    document.addEventListener('click', handleElementSelect, true); // Use capture phase

    // --- UI CREATION ---
    function createPanel() {
        panelIframe = document.createElement('iframe');
        panelIframe.id = 'live-css-panel-iframe';
        panelIframe.src = chrome.runtime.getURL('panel.html');
        document.body.appendChild(panelIframe);

        // Make panel draggable after it loads
        panelIframe.onload = () => {
             try {
                 const panelHeader = panelIframe.contentDocument.getElementById('header');
                 if (panelHeader) {
                     makeDraggable(panelIframe, panelHeader);
                 }
             } catch (err) {
                 // Accessing iframe.contentDocument may throw on some pages - ignore safely
                 console.warn('Could not access iframe document for dragging:', err);
             }
        };
    }

    function createSelectionOverlay(element) {
        if (selectionOverlay) selectionOverlay.remove();
        selectionOverlay = document.createElement('div');
        selectionOverlay.id = 'live-css-selection-overlay';

        const rect = element.getBoundingClientRect();
        positionOverlay(rect);

        // Create resize handles
        const handles = ['nw', 'ne', 'sw', 'se'];
        handles.forEach(handleName => {
            const handle = document.createElement('div');
            handle.className = `live-css-resize-handle ${handleName}`;
            handle.addEventListener('mousedown', (e) => initResize(e, handleName));
            selectionOverlay.appendChild(handle);
        });

        document.body.appendChild(selectionOverlay);
    }

    function positionOverlay(rect) {
        if (!selectionOverlay) return;
        selectionOverlay.style.top = `${rect.top + window.scrollY}px`;
        selectionOverlay.style.left = `${rect.left + window.scrollX}px`;
        selectionOverlay.style.width = `${rect.width}px`;
        selectionOverlay.style.height = `${rect.height}px`;
    }

    // --- EVENT HANDLERS ---
    function handleMouseOver(e) {
        e.target.classList.add('live-css-highlight');
    }

    function handleMouseOut(e) {
        e.target.classList.remove('live-css-highlight');
    }

    function handleElementSelect(e) {
        // Don't select elements from our own UI
        if (e.target.id && e.target.id.startsWith('live-css-')) return;
        if (e.target.closest && e.target.closest('#live-css-panel-iframe')) return;

        e.preventDefault();
        e.stopPropagation();

        selectedElement = e.target;
        selectedElement.classList.remove('live-css-highlight');

        createSelectionOverlay(selectedElement);
        // Initial CSS generation for selected element
        updateStyleAndGenerateCSS(null, null);
    }

    // --- CORE LOGIC ---
    function updateStyleAndGenerateCSS(property, value) {
        if (!selectedElement) return;

        // Apply style if provided
        if (property && value) {
            selectedElement.style[property] = value;
        }

        const selector = generateUniqueSelector(selectedElement);

        // Store or update the rule
        if (!generatedStyles[selector]) generatedStyles[selector] = {};
        if (property && value) {
             const kebabCaseProperty = property.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
             generatedStyles[selector][kebabCaseProperty] = value;
        }

        // Format and send the complete CSS to the panel
        const fullCssString = formatCss(generatedStyles);
        try {
            chrome.runtime.sendMessage({ message: 'css_updated', css: fullCssString });
        } catch (err) {
            // In case runtime.sendMessage fails, log but don't break execution
            console.warn('Failed to send css_updated message:', err);
        }
    }

    function formatCss(stylesObject) {
        let cssString = '';
        for (const selector in stylesObject) {
            cssString += `${selector} {\n`;
            for (const property in stylesObject[selector]) {
                cssString += `  ${property}: ${stylesObject[selector][property]};\n`;
            }
            cssString += `}\n\n`;
        }
        return cssString;
    }

    function generateUniqueSelector(element) {
        if (element.id) return `#${element.id}`;

        let path = '';
        let current = element;
        while (current.parentElement && current.tagName.toLowerCase() !== 'body') {
            const tagName = current.tagName.toLowerCase();
            const siblings = Array.from(current.parentElement.children);
            const sameTagSiblings = siblings.filter(e => e.tagName === current.tagName);

            if (sameTagSiblings.length > 1) {
                const index = sameTagSiblings.indexOf(current) + 1;
                path = ` > ${tagName}:nth-of-type(${index})${path}`;
            } else {
                 path = ` > ${tagName}${path}`;
            }
            current = current.parentElement;
        }
        return `body${path}`;
    }

    // --- INTERACTIVITY (RESIZING & DRAGGING) ---
    function initResize(e, handleName) {
        e.stopPropagation();
        const startRect = selectedElement.getBoundingClientRect();
        const startX = e.clientX;
        const startY = e.clientY;

        function doResize(moveEvent) {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;

            let newWidth = startRect.width;
            let newHeight = startRect.height;
            // Note: This simplified logic doesn't handle top/left resizing yet
            if (handleName.includes('e')) newWidth = startRect.width + dx;
            if (handleName.includes('w')) newWidth = startRect.width - dx;
            if (handleName.includes('s')) newHeight = startRect.height + dy;
            if (handleName.includes('n')) newHeight = startRect.height - dy;

            // Apply style and update CSS panel in REAL-TIME
            updateStyleAndGenerateCSS('width', `${Math.max(10, newWidth)}px`);
            updateStyleAndGenerateCSS('height', `${Math.max(10, newHeight)}px`);

            // Update the visual overlay
            positionOverlay(selectedElement.getBoundingClientRect());
        }

        function stopResize() {
            window.removeEventListener('mousemove', doResize);
            window.removeEventListener('mouseup', stopResize);
        }

        window.addEventListener('mousemove', doResize);
        window.addEventListener('mouseup', stopResize);
    }

    function makeDraggable(element, handle) {
        let offsetX, offsetY;

        function doDrag(e) {
            element.style.left = `${e.clientX - offsetX}px`;
            element.style.top = `${e.clientY - offsetY}px`;
        }
        function stopDrag() {
            window.removeEventListener('mousemove', doDrag);
            window.removeEventListener('mouseup', stopDrag);
        }
        handle.addEventListener('mousedown', (e) => {
            offsetX = e.clientX - element.offsetLeft;
            offsetY = e.clientY - element.offsetTop;
            window.addEventListener('mousemove', doDrag);
            window.addEventListener('mouseup', stopDrag);
        });
    }

})();