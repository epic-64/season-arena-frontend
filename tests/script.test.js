const { createElement, updateActionLog } = require('../src/script');

describe('createElement', () => {
    beforeEach(() => {
        // Reset the document for each test
        document.body.innerHTML = '';
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
        document.body.innerHTML = '<div id="action-log"></div>';
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
