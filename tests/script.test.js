const { createElement, updateActionLog } = require('../src/script');
const { JSDOM } = require('jsdom');

// Helper to set up DOM
function setupDOM(html = '<!DOCTYPE html>') {
    const dom = new JSDOM(html);
    global.window = dom.window;
    global.document = dom.window.document;
}

describe('createElement', () => {
    beforeEach(() => {
        setupDOM();
    });
    afterEach(() => {
        delete global.window;
        delete global.document;
    });

    it('creates a div with text and class', () => {
        const el = createElement('div', { text: 'Hello', classes: ['greeting'] });
        expect(el.tagName).toBe('DIV');
        expect(el.textContent).toBe('Hello');
        expect(el.classList.contains('greeting')).toBe(true);
    });

    it('creates an element with id and styles', () => {
        const el = createElement('span', {
            id: 'my-span',
            styles: { color: 'red', fontWeight: 'bold' }
        });
        expect(el.tagName).toBe('SPAN');
        expect(el.id).toBe('my-span');
        expect(el.style.color).toBe('red');
        expect(el.style.fontWeight).toBe('bold');
    });
});

describe('updateActionLog', () => {
    beforeEach(() => {
        setupDOM('<!DOCTYPE html><div id="action-log"></div>');
    });
    afterEach(() => {
        delete global.window;
        delete global.document;
    });

    it('keeps only the last 3 messages in the log', () => {
        const logContainer = document.getElementById('action-log');
        logContainer.innerHTML = '';
        updateActionLog('Message 1');
        updateActionLog('Message 2');
        updateActionLog('Message 3');
        updateActionLog('Message 4');
        expect(logContainer.children.length).toBe(3);
        expect(logContainer.children[0].textContent).toBe('Message 2');
        expect(logContainer.children[1].textContent).toBe('Message 3');
        expect(logContainer.children[2].textContent).toBe('Message 4');
    });
});
