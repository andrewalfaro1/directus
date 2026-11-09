---
'@directus/app': patch
---

Fixed the WYSIWYG editor saving list items as `<li><p>…</p></li>`, appending an empty `<p></p>` after a final list or other block, and warning that plain `<li>` markup would be removed
