# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

黄氏家族谱: a static, dependency-free family-tree website (plain HTML/CSS/JS front end, no package manager, no tests; `data.js` is generated from a Google Sheet). Clicking a name expands the next generation. Deployed via GitHub Pages from `main` / root. UI text and comments are in Simplified Chinese; keep new user-facing text and comments consistent with that. The README (`README.md`) is written for a non-technical maintainer, so keep the update workflow simple.

## Running

Open `index.html` directly in a browser. There is no lint or test command; regenerate data with `python -X utf8 build_data.py` (see below). Google Fonts are loaded from the network in `index.html`.

## Architecture

- The source of truth is a **Google Sheet** with tabs 族谱 (full list, locked), 新加入成员 (public intake: 姓名 + 父亲编号) and 说明. Its 族谱 tab is "published to the web" as CSV; that URL lives in `sheet_url.txt` (lines starting with `#` are ignored). `google_sheet/Code.gs` is the Apps Script to paste into the sheet: a daily time-driven trigger (`RUN_HOUR`, installed by running `setup()`; also a manual menu item) validates intake rows, assigns IDs (max+1), appends them to 族谱 and clears them from the intake tab. `google_sheet/说明.txt` is the text for the 说明 tab. Keep `说明.txt` and the sheet's 说明 tab in sync. The sheet itself isn't in the repo; Claude can't create it or install the script.
- `build_data.py` reads a published-CSV URL (default: the first `http` line in `sheet_url.txt`; errors if none) or a local `.csv`. It reads columns A–C only (row 1 = header), validates (duplicate IDs, missing father, cycles, exactly one root, bad names) and regenerates `data.js`; on any error it prints all problems and exits 1 without touching any file. When the list changed (or the file is missing) it also writes `族谱备份.xlsx` next to `data.js`: a read-only, values-only copy of the whole 族谱 tab (needs `openpyxl`). `python build_data.py [source] [out]`.
- `.github/workflows/build-data.yml` runs `build_data.py` monthly (cron, 1st at 02:00 UTC), on manual dispatch, and on pushes touching `sheet_url.txt`, then commits `data.js`, `族谱备份.xlsx` and `.last_sync` as a bot. `.last_sync` is a keepalive: GitHub disables scheduled workflows after 60 days without repo commits. **Never hand-edit `data.js`** — it is overwritten.
- `data.js` defines a single global `FAMILY_DATA` template-literal string: one person per line as tab-separated `编号 姓名 父亲编号`; the ancestor (始祖) has an empty father ID.
- `app.js` (IIFE, loaded after `data.js`) parses that string into a tree and renders it:
  - `parse()` skips non-numeric-ID lines (header row), warns on duplicate IDs and unknown father IDs (orphans become roots), and sorts siblings by numeric ID — **lower ID = elder brother**, so ID order determines display order.
  - Rendering is lazy: `open()` builds a child `<ul>` only when a node is clicked and `close()` removes it from the DOM. Each `<li>` carries `_node`, `_gen`, `_open` as expando properties. Generation class `g<N>` (and `deep` for N ≥ 4) is set from depth and is what `style.css` keys off.
  - Names are rendered one `<span>` per character so CSS can lay them out vertically.
  - Open branches are capped per generation (`MAX_OPEN_PER_GENERATION`, and `..._PHONE` for ≤640px) across the whole tree, not per sibling group: `openByGen[gen]` lists open nodes oldest-first and `open()` closes the oldest when full. `close()` must `forget()` every open descendant too, since removing the `<ul>` destroys them.
  - The header text (e.g. "N代 · M人") is computed from the data in `cnNumber`/`depthOf`.
- Zoom (`#zoom-*` buttons in `.zoombar`, logic in `app.js` `setZoom`/`fitZoom`) uses the CSS `zoom` property on `#tree`; "适应" measures the tree at zoom 1 and scales it to fit `#stage`. The `.stage` top padding leaves room for the bar.
- `index.html` also holds a fixed bottom-right link card (`#addbox`, styled like a name tag) that opens the Google Sheet's edit URL in a new tab (only invited editors can open it). It provides `#meta`, `#stage` (horizontally scrollable container, scrolled by `reveal()`), and `#tree`; `style.css` holds all visuals (decorative SVG hills, frame corners, vertical name tags). It sets `noindex, nofollow` so search engines skip the site (the page is still public).

## Notes

- Updating the genealogy means only editing the Google Sheet; the front-end code should not need changes. The site itself never reads the sheet, only the generated `data.js`.
- `族谱备份.xlsx` is auto-generated and overwritten; never edit it. It, the published sheet CSV and `sheet_url.txt` are public, so keep private notes out of the 族谱 tab (including 备注).
- On Windows run Python with `-X utf8` (default console encoding is cp1252).
