import { Editor } from '@tiptap/core';
import { describe, expect, test } from 'vitest';
import { fieldEditorExtensions } from '../extensions';
import { computeNormalizationDiff, computeValueNormalizationDiff, roundTrip } from './normalization-diff';
import { getStoredHtml } from './stored-html';

function stored(html: string): string {
	const editor = new Editor({ extensions: fieldEditorExtensions([]), content: html });
	// a dispatched transaction runs appendTransaction plugins, as typing does, so TrailingNode adds its paragraph
	editor.commands.focus('end');
	const out = getStoredHtml(editor);
	editor.destroy();
	return out;
}

describe('getStoredHtml', () => {
	test('stores a list item holding one plain paragraph without the wrapper', () => {
		expect(stored('<ul><li><p>1</p></li><li><p>2</p></li></ul>')).toBe('<ul><li>1</li><li>2</li></ul>');
		expect(stored('<ol><li><p>a <strong>b</strong></p></li></ol>')).toBe('<ol><li>a <strong>b</strong></li></ol>');
	});

	test('keeps the wrapper when an item holds more than one block', () => {
		expect(stored('<ul><li><p>a</p><p>b</p></li></ul>')).toBe('<ul><li><p>a</p><p>b</p></li></ul>');

		expect(stored('<ul><li><p>a</p><ul><li><p>b</p></li></ul></li></ul>')).toBe(
			'<ul><li><p>a</p><ul><li>b</li></ul></li></ul>',
		);
	});

	test('keeps the wrapper when the paragraph carries attributes', () => {
		expect(stored('<ul><li><p style="text-align: center;">a</p></li></ul>')).toContain('<p style=');
	});

	test('drops the empty paragraph TrailingNode appends after a final non-paragraph block', () => {
		expect(stored('<p>test</p><ul><li>1</li><li>2</li><li>3</li><li>4</li></ul>')).toBe(
			'<p>test</p><ul><li>1</li><li>2</li><li>3</li><li>4</li></ul>',
		);

		expect(stored('<h2>title</h2>')).toBe('<h2>title</h2>');
	});

	test('keeps an empty paragraph that follows another paragraph', () => {
		expect(stored('<p>a</p><p></p>')).toBe('<p>a</p><p></p>');
	});

	test('round trips to itself, so a reload does not change the stored value', () => {
		for (const html of [
			'<p>test</p><ul><li>1</li><li>2</li></ul>',
			'<ul><li><p>a</p><p>b</p></li></ul>',
			'<p>a</p><p></p>',
		]) {
			expect(roundTrip(html)).toBe(html);
		}
	});
});

describe('normalization warnings on list markup', () => {
	test('do not flag bare list items, or the wrapped form, as markup loss', () => {
		const bare = '<p>test</p>\n<ul>\n  <li>1</li>\n  <li>2</li>\n</ul>';
		const wrapped = '<p>test</p>\n<ul>\n  <li>\n    <p>1</p>\n  </li>\n  <li>\n    <p>2</p>\n  </li>\n</ul>\n<p></p>';

		expect(computeNormalizationDiff(bare)).toBeNull();
		expect(computeNormalizationDiff(wrapped)).toBeNull();
		expect(computeValueNormalizationDiff(bare)).toBeNull();
		expect(computeValueNormalizationDiff(wrapped)).toBeNull();
	});
});
