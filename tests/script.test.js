const { createElement } = require('../src/script');
const { JSDOM } = require('jsdom');

describe('createElement', () => {
    beforeAll(() => {
        const dom = new JSDOM('<!DOCTYPE html>');
        global.window = dom.window;
        global.document = dom.window.document;
    });

    it('creates a div with text and class', () => {
        const el = createElement('div', { text: 'Hello', classes: ['greeting'] });
        expect(el.tagName).toBe('DIV');
        expect(el.textContent).toBe('Hello');
        expect(el.classList.contains('greeting')).toBe(true);
    });
});
