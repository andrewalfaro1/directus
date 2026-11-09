import { type Editor, EditorContent } from '@tiptap/vue-3';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import { createI18n } from 'vue-i18n';
import Interface from './input-rich-text-html.vue';

/**
 * Save-and-stay whiplashes props.value html -> null -> html across back-to-back flushes.
 * Dispatching a setContent per intermediate value tears down Vue-managed node views mid-churn
 * and corrupts ProseMirror's view tree; external syncs must coalesce to the settled value.
 */
const VALUE = [
	'<p>intro text</p>',
	'<video width="300" height="150" controls=""><source src="http://localhost/assets/a" type="video/mp4"></video>',
	'<p>middle</p>',
	'<audio controls=""><source src="http://localhost/assets/b" type="audio/wav"></audio>',
	'<img src="http://localhost/assets/c.jpg" alt="pic">',
	'<!-- pagebreak -->',
	'<p>outro</p>',
].join('');

async function mountWithValue(value: string) {
	const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': {} } });

	const wrapper = mount(Interface, {
		props: { value },
		attachTo: document.body,
		global: {
			plugins: [createPinia(), i18n],
			stubs: {
				Toolbar: true,
				TableBubbleMenu: true,
				ImageDrawer: true,
				LinkDrawer: true,
				MediaDrawer: true,
				SourceCodeDrawer: true,
				NormalizationWarningDialog: true,
				InterfaceInputCode: true,
			},
		},
	});

	await flushPromises();
	await nextTick();
	const editor = wrapper.findComponent(EditorContent).props('editor') as Editor;
	return { wrapper, editor };
}

describe('external value sync coalescing', () => {
	test('transient null between flushes never reaches the editor', async () => {
		const { wrapper, editor } = await mountWithValue(VALUE);

		editor.commands.focus('end');
		await nextTick();

		await wrapper.setProps({ value: null });
		// the settled value arrives one flush later (refresh/collab refetch)
		await wrapper.setProps({ value: VALUE });
		await flushPromises();
		await nextTick();

		expect(editor.getHTML()).toContain('intro text');
		expect(editor.getHTML()).toContain('outro');
	});

	test('a value change that settles still applies', async () => {
		const { wrapper, editor } = await mountWithValue(VALUE);

		await wrapper.setProps({ value: '<p>replaced</p>' });
		await flushPromises();
		await nextTick();
		await nextTick();

		expect(editor.getHTML()).toContain('replaced');
	});

	test('a sustained null clears the editor (unset/discard)', async () => {
		const { wrapper, editor } = await mountWithValue(VALUE);

		await wrapper.setProps({ value: null });
		await flushPromises();
		await nextTick();
		await nextTick();

		expect(editor.isEmpty).toBe(true);
	});
});

describe('stored form', () => {
	test('an edit emits list items without the lone-paragraph wrapper and no trailing paragraph', async () => {
		const value = '<p>test</p><ul><li>1</li><li>2</li></ul>';
		const { wrapper, editor } = await mountWithValue(value);

		// TrailingNode has appended its caret paragraph by now, and ListItem wraps each item's text
		expect(editor.getHTML()).toBe('<p>test</p><ul><li><p>1</p></li><li><p>2</p></li></ul><p></p>');

		editor.commands.insertContentAt(editor.state.doc.content.size - 1, 'x');
		editor.commands.undo();
		await nextTick();

		const emitted = wrapper.emitted('input')!;
		expect(emitted.at(-1)).toEqual([value]);
	});
});
