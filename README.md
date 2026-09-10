# ✦ PDF Editor Pro

> Edit PDFs in-browser with matched fonts, sharp HiDPI rendering, and re-editable PDF export.

**[🚀 Live Demo](https://kunalburangi.github.io/pdf-editor-pro/)**

---

## Features

| Feature | Details |
|---|---|
| 🔍 **Text Extraction** | Reads every text block from any PDF — position, font, size, bold/italic |
| 🖱️ **Click to Select** | Hover any text region to see blue highlights; click to view properties |
| ✏️ **Inline Editing** | Double-click to edit text directly on the page |
| 📐 **Properties Panel** | Edit font family, size, color, bold/italic, X/Y position |
| 🔄 **Undo / Redo** | Full undo stack (`Ctrl+Z` / `Ctrl+Y`) |
| 🔎 **Zoom** | `Ctrl++` / `Ctrl+-` / `Ctrl+0` |
| 📄 **Re-editable Export** | Saves as a real PDF (text layer preserved) using **pdf-lib** — not an image scan |
| 🖥️ **HiDPI / Retina** | Sharp rendering on all displays using `devicePixelRatio` canvas scaling |

## How to Use

1. Open the [live app](https://kunalburangi.github.io/pdf-editor-pro/)
2. Drag & drop a PDF or click to upload
3. **Hover** over any area — blue boxes appear over text regions
4. **Click** a text box → view font/size/color in the right panel
5. **Double-click** → edit text inline
6. Click **Save PDF** → downloads a re-editable PDF

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Ctrl+S` | Save PDF |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl++` | Zoom in |
| `Ctrl+-` | Zoom out |
| `Ctrl+0` | Reset zoom |
| `Delete` | Remove selected text block |

## Tech Stack

- **[PDF.js](https://mozilla.github.io/pdf.js/)** — PDF parsing, text extraction, canvas rendering
- **[pdf-lib](https://pdf-lib.js.org/)** — Text-preserving PDF export (writes real text, not images)
- Vanilla JS, HTML5 Canvas — no framework dependencies

## Local Development

```bash
npx serve . --listen 3000
# Open http://localhost:3000
```

---

Made with ✦ by [Kunal Burangi](https://github.com/KunalBurangi)
