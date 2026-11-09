import type { Editor } from '@tiptap/core';
import { DOMSerializer } from '@tiptap/pm/model';

/**
 * The editor's HTML in the form the field stores: the same serialization as `editor.getHTML()`, passed
 * through `tidyStoredMarkup`. Every site that compares against or produces the stored value must use
 * this rather than `getHTML()`.
 */
export function getStoredHtml(editor: Pick<Editor, 'schema' | 'state'>): string {
	const fragment = DOMSerializer.fromSchema(editor.schema).serializeFragment(editor.state.doc.content);
	const container = document.implementation.createHTMLDocument().createElement('div');
	container.appendChild(fragment);

	tidyStoredMarkup(container);

	return container.innerHTML;
}

/**
 * Strips two structural artifacts of the schema from the children of `root`, in place. The parser
 * restores both on load, so stripping them loses nothing:
 *
 * - ListItem's content is `paragraph block*`, so `<li>1</li>` serializes as `<li><p>1</p></li>`. An item
 *   holding only one plain paragraph is stored without the wrapper.
 * - TrailingNode appends an empty paragraph after a final non-paragraph block (a list, table, image…)
 *   to keep a caret target below it. That paragraph is dropped; TrailingNode re-adds it on load. One
 *   that follows another paragraph is user content (TrailingNode never adds it) and is kept, so the
 *   stored value stays stable across reloads.
 *
 * Whitespace-only text is ignored, so hand-written (pretty-printed) markup tidies the same way as the
 * editor's own output.
 */
export function tidyStoredMarkup(root: Element) {
	unwrapListItemParagraphs(root);
	dropTrailingParagraph(root);
}

function unwrapListItemParagraphs(root: Element) {
	for (const item of Array.from(root.querySelectorAll('li'))) {
		const parent = item.parentElement?.tagName;
		if (parent !== 'UL' && parent !== 'OL') continue;

		const content = significantChildren(item);
		if (content.length !== 1) continue;

		const paragraph = content[0]!;
		if (!isPlainParagraph(paragraph)) continue;

		item.replaceChildren(...Array.from(paragraph.childNodes));
	}
}

function dropTrailingParagraph(root: Element) {
	const content = significantChildren(root);
	const last = content.at(-1);
	const previous = content.at(-2);

	if (!last || !previous) return;
	if (!isPlainParagraph(last) || last.childNodes.length > 0) return;
	if (isElement(previous, 'P')) return;

	last.remove();
}

function significantChildren(element: Element): ChildNode[] {
	return Array.from(element.childNodes).filter(
		(node) => !(node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() === ''),
	);
}

// the editor's container lives in its own document, so compare node types rather than `instanceof`
function isElement(node: ChildNode, tagName: string): node is Element {
	return node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === tagName;
}

function isPlainParagraph(node: ChildNode): node is Element {
	return isElement(node, 'P') && node.attributes.length === 0;
}
