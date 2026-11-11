/**
 * Writes `src/icons/material-symbols.ts` from the Material Symbols font the app ships, so the list of icon names
 * always matches the font and doesn't need updating by hand when the font is upgraded.
 *
 * Every icon in the font is a ligature, e.g. the letters of `star` are replaced by the star glyph. The names are read
 * from the font's ligature substitutions (GSUB lookup type 4) and the characters each glyph maps to.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openSync } from 'fontkit';

const fontPath = fileURLToPath(new URL('../../../app/src/assets/fonts/material-symbols.woff2', import.meta.url));
const outputPath = fileURLToPath(new URL('../src/icons/material-symbols.ts', import.meta.url));

const LIGATURE_SUBSTITUTION = 4;
const EXTENSION_SUBSTITUTION = 7;

const font = openSync(fontPath);

const characterForGlyph = new Map();

for (const codePoint of font.characterSet) {
	const glyph = font.glyphForCodePoint(codePoint).id;
	const character = String.fromCodePoint(codePoint);

	// upper- and lowercase letters share a glyph; icon names are lowercase
	if (!characterForGlyph.has(glyph) || character === character.toLowerCase()) {
		characterForGlyph.set(glyph, character);
	}
}

const toArray = (value) => (Array.isArray(value) ? value : value.toArray());

const coverageGlyphs = (coverage) =>
	coverage.version === 1
		? coverage.glyphs
		: coverage.rangeRecords.flatMap(({ start, end }) => Array.from({ length: end - start + 1 }, (_, i) => start + i));

const names = new Set();

for (const lookup of font.GSUB.lookupList.toArray()) {
	for (const subTable of lookup.subTables) {
		const table = lookup.lookupType === EXTENSION_SUBSTITUTION ? subTable.extension : subTable;

		if ((subTable.lookupType ?? lookup.lookupType) !== LIGATURE_SUBSTITUTION) continue;

		const firstGlyphs = coverageGlyphs(table.coverage);

		toArray(table.ligatureSets).forEach((ligatureSet, index) => {
			for (const ligature of toArray(ligatureSet)) {
				const glyphs = [firstGlyphs[index], ...ligature.components];

				if (glyphs.every((glyph) => characterForGlyph.has(glyph))) {
					names.add(glyphs.map((glyph) => characterForGlyph.get(glyph)).join(''));
				}
			}
		});
	}
}

if (names.size === 0) {
	throw new Error(`No icon names found in ${fontPath}`);
}

const sorted = [...names].sort();

writeFileSync(
	outputPath,
	`// Generated from app/src/assets/fonts/material-symbols.woff2 by scripts/generate-material-symbols.js. Do not edit.

/** Every icon name (ligature) in the Material Symbols font the app ships. */
export const MATERIAL_SYMBOLS: readonly string[] = ${JSON.stringify(sorted, null, '\t').replace(/"/g, "'")};
`,
);

// eslint-disable-next-line no-console
console.log(`Wrote ${sorted.length} Material Symbols icon names to ${outputPath}`);
