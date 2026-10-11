# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

黄氏家族谱: a static, dependency-free family-tree website (plain HTML/CSS/JS front end, no package manager, no tests; `data.js` is generated from `data.xlsx`). Clicking a name expands the next generation. Deployed via GitHub Pages from `main` / root. UI text and comments are in Simplified Chinese; keep new user-facing text and comments consistent with that. The README (`README.md`) is written for a non-technical maintainer, so keep the update workflow simple.

## Running

Open `index.html` directly in a browser. There is no lint or test command; regenerate data with `python -X utf8 build_data.py` (see below). Google Fonts are loaded from the network in `index.html`.

## Architecture

- `data.xlsx` (sheet 「族谱」, columns A–C: 编号, 姓名, 父亲编号) is the **single source of truth** edited by the maintainer. `build_data.py` (needs `openpyxl`) validates it (duplicate IDs, missing father, cycles, exactly one root, bad names) and regenerates `data.js`; on any error it prints all problems and exits 1 without touching `data.js`. Run it with `python build_data.py [xlsx] [out]`. Other sheet columns (formulas in D–F, 备注) are never exported.
- `.github/workflows/build-data.yml` runs `build_data.py` on pushes to `main` that touch `data.xlsx`, then commits `data.js` as a bot, which triggers the Pages redeploy. **Never hand-edit `data.js`** — it is overwritten.
- `data.js` defines a single global `FAMILY_DATA` template-literal string: one person per line as tab-separated `编号 姓名 父亲编号`; the ancestor (始祖) has an empty father ID.
- `app.js` (IIFE, loaded after `data.js`) parses that string into a tree and renders it:
  - `parse()` skips non-numeric-ID lines (header row), warns on duplicate IDs and unknown father IDs (orphans become roots), and sorts siblings by numeric ID — **lower ID = elder brother**, so ID order determines display order.
  - Rendering is lazy: `open()` builds a child `<ul>` only when a node is clicked and `close()` removes it from the DOM. Each `<li>` carries `_node`, `_gen`, `_open` as expando properties. Generation class `g<N>` (and `deep` for N ≥ 4) is set from depth and is what `style.css` keys off.
  - Names are rendered one `<span>` per character so CSS can lay them out vertically.
  - `ONE_BRANCH_AT_A_TIME` (top of `app.js`) auto-collapses sibling branches on open.
  - The header text (e.g. "N代 · M人") is computed from the data in `cnNumber`/`depthOf`.
- `index.html` provides `#meta`, `#stage` (horizontally scrollable container, scrolled by `reveal()`), and `#tree`; `style.css` holds all visuals (decorative SVG hills, frame corners, vertical name tags). It sets `noindex, nofollow` so search engines skip the site (the page is still public).

## Notes

- Updating the genealogy means only editing `data.xlsx`; the front-end code should not need changes. The site itself never reads the xlsx, only the generated `data.js`.
- `data.xlsx` is committed to the public repo, so its notes column is publicly visible.
- On Windows run Python with `-X utf8` (default console encoding is cp1252).
