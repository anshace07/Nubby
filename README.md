# Nubby

**A paper notebook for typed notes.** Free, local, offline. For Windows.

<!-- Hero GIF goes here: a 10-second screen recording of typing a page, pasting a picture and dropping a sticky note. -->

Notebooks felt lifeless, so I made one that doesn't. Nubby looks and feels like the notebook on your desk — cream paper, handwriting fonts, ink colours, sticky notes — but you type, so it's fast, neat and searchable.

## What it does

- **A shelf of notebooks** with real-looking covers: linen, kraft paper, leather, felt and plain colours, each with a handwritten label.
- **Paper you choose** — cream or white; dotted, ruled, grid, blank or Cornell. Per notebook, or per page.
- **Handwriting fonts** — Patrick Hand by default, plus Kalam, Gochi Hand, Caveat, Shadows Into Light, and clean Questrial, Inter and EB Garamond.
- **Ink colours** — black, blue, red, purple, green or any custom colour — and highlighters.
- **Study-note styles** — a big title with a marker swipe, `#HEADING:` on a peach pill, subheadings with a wavy line, the tilted green **L.P.** tag, dashed boxes for Q&A, grey boxes, bullets, numbers, checklists and little stickers.
- **Pictures anywhere** — paste with Ctrl+V, drag a file in, or Import. Thin black border; drag, resize and snap them anywhere on the page.
- **Sticky notes** — yellow, pink, mint or blue paper notes, slightly tilted, anywhere on a page. Click a note's curled corner and it folds up into its glued strip (in 3D) so you can read what's underneath; double-click the strip to open it again. Plus a loose sticky board.
- **Pop-out mini window** — one click (or Ctrl+Shift+M) shrinks Nubby to just the page, in a small window that can stay on top of everything else. Keep it beside a lecture video or an article and take notes as you go; one click brings the full app back.
- **Search every page** with Ctrl+K.
- **Export** a page as PDF or PNG.
- **Night desk** — the room goes dark, the paper stays paper.
- **Autosave**, with crash-safe writes. Your notes are plain files in `Documents\Nubby`.

No account. No cloud. No tracking.

## Install (Windows 10 / 11)

1. Download `Nubby_<version>_x64-setup.exe` from [Releases](../../releases).
2. Run it. Nubby isn't code-signed yet, so Windows SmartScreen may say *"Windows protected your PC"* — click **More info → Run anyway**.
3. Nubby installs just for you (no admin rights) and adds Start menu and desktop shortcuts.

Nubby draws its pages with Microsoft Edge WebView2, which comes with Windows 11 and up-to-date Windows 10. If it's missing, the installer points you to Microsoft's free download.

**Uninstall:** Settings → Apps → Nubby → Uninstall. Your notes stay in `Documents\Nubby`.

## Where your notes live

```text
Documents\Nubby\
  shelf.json                       order of notebooks on the shelf
  board.json                       the loose sticky board
  notebooks\<id>\notebook.json     name, cover, paper, page order
  notebooks\<id>\pages\<id>.json   one file per page (text, pictures, sticky notes)
  notebooks\<id>\assets\           pasted and imported pictures
  Exports\                         PNG exports
```

Back up that folder and you've backed up everything.

## Shortcuts

| Keys | Does |
| --- | --- |
| `##` then space | Big title with a marker swipe |
| `#` then space | Peach heading pill |
| `###` then space | Subheading with a wavy line |
| Ctrl Alt 0 | Back to normal text |
| `LP:` then space | Green L.P. tag |
| `>` then space | Dashed box |
| `-` / `1.` / `[ ]` then space | Bullets / numbers / checklist |
| `->` | → |
| Ctrl 1 … 5 | Black, blue, red, purple, green ink |
| Ctrl B / I / U | Bold, italic, underline |
| Ctrl Shift H / L | Highlight / label tag |
| Ctrl V | Paste a picture onto the page |
| Ctrl Shift I | Import a picture |
| Ctrl Shift N | New sticky note (click its corner to fold it away) |
| Ctrl N | New page |
| Ctrl Shift M | Pop the page out into a mini window, and back |
| Alt ← / → | Turn the page |
| Ctrl K | Search every page |
| Ctrl P / Ctrl Shift E | Save page as PDF / PNG |
| Ctrl click | Open a link |

## Build from source

You need [Node.js](https://nodejs.org) 20+ and [Rust](https://rustup.rs). On Windows, also install the Microsoft C++ Build Tools (the "Desktop development with C++" workload).

```bash
npm install
npm run tauri dev     # run Nubby with hot reload
npm run tauri build   # installers land in src-tauri/target/release/bundle/
```

Every push to `main` builds Nubby on Windows with GitHub Actions (`.github/workflows/build-windows.yml`) as a check; the installers it makes are on each run's page under Artifacts.

The setup on the [Releases](../../releases) page is made with `installer/nubby.nsi` — a small per-user installer that updates Nubby in place and never touches your notes. `scripts/cross-build-windows.sh` builds it on Linux, without a Windows machine.

## How it's built

[Tauri 2](https://tauri.app) (a small Rust backend that only reads and writes files in your Nubby folder) with React, TypeScript, Vite and the [TipTap](https://tiptap.dev) editor. The whole app is about 9 MB.

```text
src/components/   shelf, page, toolbar, sticky notes, pictures
src/editor/       the custom note styles (heading pill, L.P. tag, boxes, stickers)
src/lib/          file storage, data model, fonts, inks, covers
src/styles/       the paper and the comic-ink look
src-tauri/        the Rust side: safe file store, window, search
```

## Contributing

Issues and pull requests are welcome. One rule: keep it feeling like paper, not like a productivity dashboard.

## License

MIT © 2026 Ayush Mishra. Bundled fonts are under the SIL Open Font License 1.1.
