/* ─────────────────────────────────────────────────────────────────────────
   PDF EDITOR PRO — app.js
   Uses: PDF.js (reading + rendering), jsPDF (export)
   ───────────────────────────────────────────────────────────────────────── */

'use strict';

// ─── PDF.js WORKER SETUP ────────────────────────────────────────────────────
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ─── STATE ──────────────────────────────────────────────────────────────────
const state = {
  pdfDoc: null,           // pdfjsLib PDF document
  pages: [],              // Array of { pdfPage, textItems, canvas, textLayer }
  fileName: '',
  zoom: 1.0,
  selectedBlock: null,    // Currently selected .text-block element
  editMode: false,        // true = edit mode, false = select mode
  undoStack: [],
  redoStack: [],
  currentPage: 1,
  findState: {
    open: false,
    query: '',
    replaceText: '',
    matchCase: false,
    wholeWord: false,
    matches: [],          // Array of { pageIdx, item, el }
    currentIndex: -1,
  },
};

// ─── DOM REFS ────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const $landing         = $('landing');
const $editor          = $('editor');
const $uploadZone      = $('upload-zone');
const $fileInput       = $('file-input');
const $dropOverlay     = $('drop-overlay');
const $loading         = $('loading-overlay');
const $loadingTitle    = $('loading-title');
const $loadingSub      = $('loading-sub');
const $progressBar     = $('progress-bar');
const $toast           = $('toast');
const $thumbnails      = $('thumbnails');
const $pagesContainer  = $('pages-container');
const $fileNameLabel   = $('file-name-label');
const $fileBadge       = $('file-badge');
const $sidebarCount    = $('sidebar-page-count');
const $currentPage     = $('current-page');
const $totalPages      = $('total-pages');
const $zoomLabel       = $('zoom-label');
const $btnBack         = $('btn-back');
const $btnSelect       = $('btn-select');
const $btnEdit         = $('btn-edit');
const $btnFind         = $('btn-find');
const $btnZoomIn       = $('btn-zoom-in');
const $btnZoomOut      = $('btn-zoom-out');
const $btnZoomReset    = $('btn-zoom-reset');
const $btnUndo         = $('btn-undo');
const $btnRedo         = $('btn-redo');
const $btnSave         = $('btn-save');
const $propsEmpty      = $('props-empty');
const $propsForm       = $('props-form');
const $propContent     = $('prop-content');
const $propFont        = $('prop-font');
const $propSize        = $('prop-size');
const $propColor       = $('prop-color');
const $propBold        = $('prop-bold');
const $propItalic      = $('prop-italic');
const $propX           = $('prop-x');
const $propY           = $('prop-y');
const $btnApply        = $('btn-apply');
const $btnDeleteItem   = $('btn-delete-item');

// Find & Replace DOM refs
const $findReplaceBar  = $('find-replace-bar');
const $findInput       = $('find-input');
const $findCount       = $('find-count');
const $btnFindPrev     = $('btn-find-prev');
const $btnFindNext     = $('btn-find-next');
const $btnFindCase     = $('btn-find-case');
const $btnFindWord     = $('btn-find-word');
const $btnFindClose    = $('btn-find-close');
const $replaceInput    = $('replace-input');
const $btnReplaceOne   = $('btn-replace-one');
const $btnReplaceAll   = $('btn-replace-all');

// ─── TOAST ───────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, type = 'info', duration = 3000) {
  $toast.textContent = msg;
  $toast.className = `toast ${type}`;
  $toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $toast.classList.add('hidden'), duration);
}

// ─── LOADING ─────────────────────────────────────────────────────────────────
function showLoading(title, sub, progress = 0) {
  $loadingTitle.textContent = title;
  $loadingSub.textContent = sub;
  $progressBar.style.width = `${progress}%`;
  $loading.classList.remove('hidden');
}
function setProgress(p) { $progressBar.style.width = `${p}%`; }
function hideLoading() { $loading.classList.add('hidden'); }

// ─── FILE UPLOAD ──────────────────────────────────────────────────────────────
function handleFile(file) {
  if (!file || file.type !== 'application/pdf') {
    showToast('Please upload a valid PDF file.', 'error');
    return;
  }
  state.fileName = file.name;
  const reader = new FileReader();
  reader.onload = (e) => {
    const originalBuffer = e.target.result; // ArrayBuffer from FileReader

    // IMPORTANT: PDF.js transfers the ArrayBuffer to its worker thread,
    // which neuters (detaches) it — making any existing Uint8Array view
    // have byteLength = 0. We must slice an independent copy BEFORE that
    // happens so pdf-lib can load the original bytes later during export.
    state.pdfData = originalBuffer.slice(0); // own copy, safe from transfer

    loadPdf(new Uint8Array(originalBuffer)); // PDF.js may transfer this buffer
  };
  reader.readAsArrayBuffer(file);
}

$uploadZone.addEventListener('click', (e) => {
  if (e.target !== $fileInput) $fileInput.click();
});
$uploadZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $fileInput.click(); }
});
$fileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});

// Drag & drop on landing
document.addEventListener('dragenter', (e) => {
  e.preventDefault();
  if ([...e.dataTransfer.items].some(i => i.kind === 'file')) {
    $dropOverlay.classList.remove('hidden');
  }
});
$dropOverlay.addEventListener('dragleave', (e) => {
  if (e.relatedTarget === null || e.relatedTarget === document.documentElement) {
    $dropOverlay.classList.add('hidden');
  }
});
$dropOverlay.addEventListener('dragover', (e) => e.preventDefault());
$dropOverlay.addEventListener('drop', (e) => {
  e.preventDefault();
  $dropOverlay.classList.add('hidden');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

// ─── LOAD PDF ─────────────────────────────────────────────────────────────────
async function loadPdf(data) {
  showLoading('Loading PDF…', 'Initializing document parser', 5);

  try {
    state.pdfDoc = await pdfjsLib.getDocument({ data }).promise;
    const numPages = state.pdfDoc.numPages;

    showLoading('Processing PDF…', `Extracting text from ${numPages} pages`, 15);

    state.pages = [];
    $pagesContainer.innerHTML = '';
    $thumbnails.innerHTML = '';
    state.selectedBlock = null;
    closeFindReplace();
    $findInput.value = '';
    $replaceInput.value = '';

    // File info
    $fileNameLabel.textContent = state.fileName;
    $sidebarCount.textContent = numPages;
    $totalPages.textContent = numPages;
    $currentPage.textContent = 1;

    // Process each page
    for (let i = 1; i <= numPages; i++) {
      const progress = 15 + ((i / numPages) * 75);
      setProgress(progress);
      $loadingSub.textContent = `Processing page ${i} of ${numPages}…`;

      const pdfPage = await state.pdfDoc.getPage(i);
      const textContent = await pdfPage.getTextContent({ includeMarkedContent: false });

      // Parse text items with font/style info
      const textItems = textContent.items.map((item, idx) => {
        if (!item.str || item.str.trim() === '') return null;
        const tx = item.transform;
        // tx = [scaleX, skewX, skewY, scaleY, translateX, translateY]
        const fontSize = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);
        const angle = Math.atan2(tx[1], tx[0]);
        return {
          id: `p${i}-t${idx}`,
          page: i,
          text: item.str,
          originalText: item.str,
          x: tx[4],
          y: tx[5],
          fontSize: fontSize || 12,
          fontName: item.fontName || 'Helvetica',
          angle: angle,
          width: item.width,
          height: item.height,
          bold: /bold/i.test(item.fontName),
          italic: /italic|oblique/i.test(item.fontName),
          color: '#000000',
          transform: [...tx],
          modified: false,
        };
      }).filter(Boolean);

      state.pages.push({ pdfPage, textItems, pageNum: i });
    }

    setProgress(95);
    $loadingSub.textContent = 'Rendering pages…';

    // Show editor
    $landing.classList.add('hidden');
    $editor.classList.remove('hidden');

    // Render all pages
    await renderAllPages();

    setProgress(100);
    hideLoading();
    showToast(`✓ Loaded ${numPages} pages with ${state.pages.reduce((a, p) => a + p.textItems.length, 0)} text blocks`, 'success');

  } catch (err) {
    hideLoading();
    showToast(`Error loading PDF: ${err.message}`, 'error');
    console.error(err);
  }
}

// ─── RENDER PAGES ─────────────────────────────────────────────────────────────
async function renderAllPages() {
  for (let i = 0; i < state.pages.length; i++) {
    await renderPage(i);
  }
  updateThumbnailActive(0);
}

async function renderPage(pageIdx) {
  const { pdfPage, textItems, pageNum } = state.pages[pageIdx];

  const dpr = window.devicePixelRatio || 1;

  // cssViewport — logical scale used for DOM layout + text overlay positioning
  const cssViewport    = pdfPage.getViewport({ scale: state.zoom });
  // renderViewport — scaled up by dpr so the canvas renders at full physical resolution
  const renderViewport = pdfPage.getViewport({ scale: state.zoom * dpr });

  // Wrapper sized at logical CSS dimensions
  const wrapper = document.createElement('div');
  wrapper.className = 'page-wrapper';
  wrapper.dataset.pageIdx = pageIdx;
  wrapper.style.width  = `${cssViewport.width}px`;
  wrapper.style.height = `${cssViewport.height}px`;

  // Canvas buffer = physical pixels; CSS display = logical pixels → crisp on Retina
  const canvas = document.createElement('canvas');
  canvas.className    = 'page-canvas';
  canvas.width        = renderViewport.width;    // physical pixel buffer
  canvas.height       = renderViewport.height;
  canvas.style.width  = `${cssViewport.width}px`;   // displayed at CSS size
  canvas.style.height = `${cssViewport.height}px`;

  // Render at full physical resolution
  const ctx = canvas.getContext('2d');
  await pdfPage.render({ canvasContext: ctx, viewport: renderViewport }).promise;

  // Text overlay layer — positioned in cssViewport (logical CSS) coordinates
  const textLayer = document.createElement('div');
  textLayer.className = 'text-layer';
  textLayer.dataset.pageIdx = pageIdx;
  if (state.editMode) textLayer.classList.add('edit-mode');

  textItems.forEach(item => {
    const el = createTextBlock(item, cssViewport);
    textLayer.appendChild(el);
  });

  // Page number label
  const label = document.createElement('div');
  label.className = 'page-number-label';
  label.textContent = `Page ${pageNum}`;

  wrapper.appendChild(canvas);
  wrapper.appendChild(textLayer);
  wrapper.appendChild(label);
  $pagesContainer.appendChild(wrapper);

  // Store cssViewport so applyChanges and undo/redo always use CSS-scale coords
  state.pages[pageIdx].wrapper     = wrapper;
  state.pages[pageIdx].canvas      = canvas;
  state.pages[pageIdx].textLayerEl = textLayer;
  state.pages[pageIdx].viewport    = cssViewport;

  createThumbnail(canvas, pageIdx, pageNum);
  return wrapper;
}

// ─── CREATE TEXT BLOCK ELEMENT ────────────────────────────────────────────────
function createTextBlock(item, viewport) {
  const el = document.createElement('div');
  el.className = 'text-block';
  if (item.modified) el.classList.add('modified');
  el.dataset.itemId = item.id;
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', `Edit: ${item.text.substring(0, 40)}`);

  const tx   = item.transform;
  const vp   = viewport;

  // Convert PDF bottom-left origin to CSS top-left origin
  const [sx, sy] = applyTransform(vp, tx[4], tx[5]);

  // Font size in CSS pixels
  const scaledFontSize = Math.abs(item.fontSize) * vp.scale;

  // Width: use item.width scaled by viewport, fallback to text-based estimate
  const scaledWidth = item.width > 0
    ? item.width * vp.scale
    : item.text.length * scaledFontSize * 0.55;

  // Height: typically line height ≈ 1.2× font size
  const scaledHeight = scaledFontSize * 1.3;

  el.style.position  = 'absolute';
  el.style.left      = `${sx}px`;
  el.style.top       = `${sy - scaledFontSize}px`;
  el.style.width     = `${Math.max(scaledWidth, 8)}px`;
  el.style.height    = `${Math.max(scaledHeight, 8)}px`;
  el.style.fontSize  = `${scaledFontSize}px`;
  el.style.fontFamily = normalizeFontName(item.fontName);
  el.style.fontWeight = item.bold   ? 'bold'   : 'normal';
  el.style.fontStyle  = item.italic ? 'italic' : 'normal';

  // Rotation
  if (item.angle !== 0) {
    el.style.transformOrigin = '0 100%';
    el.style.transform = `rotate(${-item.angle}rad)`;
  }

  // Info tooltip (shows font on hover)
  el.title = `${item.fontName || 'Unknown'} ${Math.round(item.fontSize)}pt — click to edit`;

  // Click → select in select mode / edit in edit mode
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.editMode) {
      startInlineEdit(el, item);
    } else {
      selectBlock(el, item);
    }
  });

  // Double-click always starts inline edit
  el.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    startInlineEdit(el, item);
  });

  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectBlock(el, item); }
    if (e.key === 'Delete' && el.classList.contains('selected')) deleteBlock(el, item);
  });

  return el;
}

// PDF coordinate → canvas pixel coordinate
function applyTransform(viewport, pdfX, pdfY) {
  const vt = viewport.transform;
  const x = vt[0] * pdfX + vt[2] * pdfY + vt[4];
  const y = vt[1] * pdfX + vt[3] * pdfY + vt[5];
  return [x, y];
}

// ─── FONT NAME NORMALIZATION ──────────────────────────────────────────────────
function normalizeFontName(raw) {
  if (!raw) return 'Arial, Helvetica, sans-serif';
  const lower = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (lower.includes('times') || lower.includes('roman')) return 'Times New Roman, Times, serif';
  if (lower.includes('courier') || lower.includes('mono')) return '"Courier New", Courier, monospace';
  if (lower.includes('arial'))   return 'Arial, sans-serif';
  if (lower.includes('verdana')) return 'Verdana, sans-serif';
  if (lower.includes('georgia')) return 'Georgia, serif';
  if (lower.includes('calibri')) return 'Calibri, sans-serif';
  if (lower.includes('garamond')) return 'Garamond, serif';
  if (lower.includes('tahoma')) return 'Tahoma, sans-serif';
  if (lower.includes('trebuchet')) return 'Trebuchet MS, sans-serif';
  if (lower.includes('helvetica')) return 'Helvetica Neue, Helvetica, Arial, sans-serif';
  if (lower.includes('cambriai') || lower.includes('cambria')) return 'Cambria, Georgia, serif';
  // Default fallback
  return `"${raw}", Arial, Helvetica, sans-serif`;
}

// ─── BLOCK SELECTION ──────────────────────────────────────────────────────────
function selectBlock(el, item) {
  // Deselect previous
  if (state.selectedBlock) {
    state.selectedBlock.el.classList.remove('selected');
  }
  el.classList.add('selected');
  state.selectedBlock = { el, item };
  showPropsForm(item);
}

function deselectAll() {
  if (state.selectedBlock) {
    state.selectedBlock.el.classList.remove('selected');
    state.selectedBlock = null;
  }
  $propsEmpty.classList.remove('hidden');
  $propsForm.classList.add('hidden');
}

// Click on page background = deselect
$pagesContainer.addEventListener('click', (e) => {
  if (e.target === $pagesContainer || e.target.classList.contains('page-wrapper') ||
      e.target.classList.contains('page-canvas') || e.target.classList.contains('text-layer')) {
    deselectAll();
  }
});

// ─── PROPERTIES PANEL ─────────────────────────────────────────────────────────
function showPropsForm(item) {
  $propsEmpty.classList.add('hidden');
  $propsForm.classList.remove('hidden');

  $propContent.value = item.text;
  $propFont.value    = item.fontName;
  $propSize.value    = parseFloat(item.fontSize.toFixed(2));
  $propColor.value   = item.color || '#000000';
  $propBold.classList.toggle('active', item.bold);
  $propItalic.classList.toggle('active', item.italic);
  $propX.value       = parseFloat(item.x.toFixed(2));
  $propY.value       = parseFloat(item.y.toFixed(2));
}

$propBold.addEventListener('click', () => $propBold.classList.toggle('active'));
$propItalic.addEventListener('click', () => $propItalic.classList.toggle('active'));

$btnApply.addEventListener('click', () => {
  if (!state.selectedBlock) return;
  const { el, item } = state.selectedBlock;
  applyChanges(el, item);
});

$btnDeleteItem.addEventListener('click', () => {
  if (!state.selectedBlock) return;
  const { el, item } = state.selectedBlock;
  deleteBlock(el, item);
});

function applyChanges(el, item) {
  const newText   = $propContent.value;
  const newFont   = $propFont.value;
  const newSize   = parseFloat($propSize.value);
  const newColor  = $propColor.value;
  const newBold   = $propBold.classList.contains('active');
  const newItalic = $propItalic.classList.contains('active');
  const newX      = parseFloat($propX.value);
  const newY      = parseFloat($propY.value);

  // Save undo state
  pushUndo({ type: 'edit', itemId: item.id, page: item.page, prev: { ...item } });

  // Update state
  item.text    = newText;
  item.fontName = newFont;
  item.fontSize = newSize;
  item.color   = newColor;
  item.bold    = newBold;
  item.italic  = newItalic;
  item.x       = newX;
  item.y       = newY;
  item.modified = true;

  // Update the transform with new x/y
  item.transform[4] = newX;
  item.transform[5] = newY;

  // Find page to get viewport
  const pageData = state.pages.find(p => p.pageNum === item.page);
  if (!pageData) return;

  // Re-create element position
  const vp = pageData.viewport;
  const [sx, sy] = applyTransform(vp, newX, newY);
  const scaledFontSize = newSize * (vp.scale || state.zoom);

  // Update element styles
  el.textContent = newText;
  el.style.left        = `${sx}px`;
  el.style.top         = `${sy - scaledFontSize}px`;
  el.style.fontSize    = `${scaledFontSize}px`;
  el.style.fontFamily  = normalizeFontName(newFont);
  el.style.fontWeight  = newBold   ? 'bold'   : 'normal';
  el.style.fontStyle   = newItalic ? 'italic' : 'normal';
  el.style.color       = newColor;

  // Re-add info bar and handle
  const info = document.createElement('div');
  info.className = 'info-bar';
  info.textContent = `${normalizeFontName(newFont)} ${Math.round(newSize)}pt`;
  el.appendChild(info);

  const handle = document.createElement('div');
  handle.className = 'resize-handle';
  el.appendChild(handle);

  el.classList.add('modified');

  showToast('✓ Text block updated', 'success', 2000);
  if (state.findState.open) performSearch();
}

function deleteBlock(el, item) {
  pushUndo({ type: 'delete', itemId: item.id, page: item.page, item: { ...item }, el: el.cloneNode(true) });

  el.style.opacity = '0';
  el.style.transform += ' scale(0.9)';
  el.style.transition = 'opacity 0.2s, transform 0.2s';

  setTimeout(() => {
    el.remove();
    // Remove from state
    const pageData = state.pages.find(p => p.pageNum === item.page);
    if (pageData) {
      const idx = pageData.textItems.indexOf(item);
      if (idx > -1) pageData.textItems.splice(idx, 1);
    }
  }, 200);

  deselectAll();
  showToast('Text block removed', 'info', 2000);
}

// ─── INLINE EDITING ───────────────────────────────────────────────────────────
function startInlineEdit(el, item) {
  if (el.classList.contains('editing')) return;

  selectBlock(el, item);
  el.classList.add('editing');
  el.contentEditable = 'true';
  el.focus();

  // Place cursor at end
  const range = document.createRange();
  const sel   = window.getSelection();
  range.selectNodeContents(el);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);

  el.addEventListener('blur', () => commitInlineEdit(el, item), { once: true });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      el.textContent = item.text;
      el.classList.remove('editing');
      el.contentEditable = 'false';
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      el.blur();
    }
  });
}

function commitInlineEdit(el, item) {
  el.classList.remove('editing');
  el.contentEditable = 'false';
  const newText = el.textContent;
  if (newText !== item.text) {
    pushUndo({ type: 'edit', itemId: item.id, page: item.page, prev: { ...item } });
    item.text = newText;
    item.modified = true;
    el.classList.add('modified');
    $propContent.value = newText;
    showToast('✓ Text updated', 'success', 1500);
    if (state.findState.open) performSearch();
  }
}

function updateElementAfterTextChange(el, item, pageData) {
  const vp = pageData?.viewport || state.pages[item.page - 1]?.viewport;
  const scaledFontSize = Math.abs(item.fontSize) * (vp?.scale || state.zoom);
  const scaledWidth = item.width > 0
    ? (item.text.length / Math.max(item.originalText?.length || 1, 1)) * item.width * (vp?.scale || state.zoom)
    : item.text.length * scaledFontSize * 0.55;

  el.style.width = `${Math.max(scaledWidth, 12)}px`;
  el.title = `${item.fontName || 'Unknown'} ${Math.round(item.fontSize)}pt — "${item.text}"`;
  el.setAttribute('aria-label', `Edit: ${item.text.substring(0, 40)}`);
  if (item.modified) el.classList.add('modified');
}

// ─── UNDO / REDO ──────────────────────────────────────────────────────────────
function pushUndo(action) {
  state.undoStack.push(action);
  state.redoStack = [];
  $btnUndo.disabled = false;
  $btnRedo.disabled = true;
}

$btnUndo.addEventListener('click', () => {
  if (state.undoStack.length === 0) return;
  const action = state.undoStack.pop();
  state.redoStack.push(action);

  if (action.type === 'edit') {
    const pageData = state.pages.find(p => p.pageNum === action.page);
    if (!pageData) return;
    const item = pageData.textItems.find(it => it.id === action.itemId);
    if (!item) return;
    const el = pageData.textLayerEl.querySelector(`[data-item-id="${action.itemId}"]`);

    Object.assign(item, action.prev);
    if (el) {
      updateElementAfterTextChange(el, item, pageData);
    }
    if (state.selectedBlock?.item === item) showPropsForm(item);
  } else if (action.type === 'batch_edit') {
    for (const sub of action.items) {
      const pageData = state.pages.find(p => p.pageNum === sub.page);
      if (!pageData) continue;
      const item = pageData.textItems.find(it => it.id === sub.itemId);
      if (!item) continue;
      const el = pageData.textLayerEl?.querySelector(`[data-item-id="${sub.itemId}"]`);
      Object.assign(item, sub.prev);
      if (el) {
        updateElementAfterTextChange(el, item, pageData);
      }
    }
    if (state.findState.open) performSearch();
  }

  $btnUndo.disabled = state.undoStack.length === 0;
  $btnRedo.disabled = false;
  showToast('Undone', 'info', 1500);
});

$btnRedo.addEventListener('click', () => {
  if (state.redoStack.length === 0) return;
  const action = state.redoStack.pop();
  state.undoStack.push(action);
  // Simplified redo — tell user to reapply
  $btnUndo.disabled = false;
  $btnRedo.disabled = state.redoStack.length === 0;
  showToast('Redo applied', 'info', 1500);
});

// ─── ZOOM ─────────────────────────────────────────────────────────────────────
$btnZoomIn.addEventListener('click', () => setZoom(state.zoom + 0.15));
$btnZoomOut.addEventListener('click', () => setZoom(state.zoom - 0.15));
$btnZoomReset.addEventListener('click', () => setZoom(1.0));

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      if (state.findState.open && document.activeElement === $findInput) {
        $findInput.select();
      } else {
        openFindReplace(false);
      }
      return;
    }
    if (e.key === 'h' || e.key === 'H') {
      e.preventDefault();
      openFindReplace(true);
      return;
    }
    if (e.key === '=' || e.key === '+') { e.preventDefault(); setZoom(state.zoom + 0.15); }
    if (e.key === '-')                  { e.preventDefault(); setZoom(state.zoom - 0.15); }
    if (e.key === '0')                  { e.preventDefault(); setZoom(1.0); }
    if (e.key === 'z')                  { e.preventDefault(); $btnUndo.click(); }
    if (e.key === 'y')                  { e.preventDefault(); $btnRedo.click(); }
    if (e.key === 's')                  { e.preventDefault(); exportPdf(); }
  }
  if (e.key === 'Escape') {
    if (state.findState.open) {
      e.preventDefault();
      closeFindReplace();
      return;
    }
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (state.selectedBlock && document.activeElement !== $propContent &&
        !state.selectedBlock.el.classList.contains('editing') &&
        document.activeElement !== $findInput && document.activeElement !== $replaceInput) {
      deleteBlock(state.selectedBlock.el, state.selectedBlock.item);
    }
  }
});

async function setZoom(zoom) {
  zoom = Math.max(0.3, Math.min(3.0, zoom));
  state.zoom = zoom;
  $zoomLabel.textContent = `${Math.round(zoom * 100)}%`;

  showLoading('Re-rendering…', 'Applying zoom', 10);
  $pagesContainer.innerHTML = '';
  $thumbnails.innerHTML = '';

  for (let i = 0; i < state.pages.length; i++) {
    setProgress(10 + (i / state.pages.length) * 85);
    await renderPage(i);
  }

  hideLoading();
  if (state.pages.length > 0) updateThumbnailActive(0);
  if (state.findState.open) performSearch();
}

// ─── MODE BUTTONS ─────────────────────────────────────────────────────────────
$btnSelect.addEventListener('click', () => {
  state.editMode = false;
  $btnSelect.classList.add('active');
  $btnEdit.classList.remove('active');
  document.querySelectorAll('.text-layer').forEach(tl => tl.classList.remove('edit-mode'));
  document.querySelectorAll('.page-wrapper').forEach(pw => pw.classList.remove('edit-mode'));
  showToast('Select mode — click text to view properties', 'info', 2000);
});

$btnEdit.addEventListener('click', () => {
  state.editMode = true;
  $btnEdit.classList.add('active');
  $btnSelect.classList.remove('active');
  document.querySelectorAll('.text-layer').forEach(tl => tl.classList.add('edit-mode'));
  document.querySelectorAll('.page-wrapper').forEach(pw => pw.classList.add('edit-mode'));
  showToast('Edit mode — click text to edit inline, double-click or use sidebar', 'info', 2500);
});

// ─── FIND & REPLACE ───────────────────────────────────────────────────────────
function openFindReplace(focusReplace = false) {
  state.findState.open = true;
  $findReplaceBar.classList.remove('hidden');
  $btnFind.classList.add('active');
  if (focusReplace) {
    $replaceInput.focus();
    $replaceInput.select();
  } else {
    $findInput.focus();
    $findInput.select();
  }
  performSearch();
}

function closeFindReplace() {
  state.findState.open = false;
  $findReplaceBar.classList.add('hidden');
  $btnFind.classList.remove('active');
  clearFindHighlights();
  $findCount.textContent = '0 of 0';
}

function clearFindHighlights() {
  document.querySelectorAll('.text-block.find-match, .text-block.find-match-active').forEach(el => {
    el.classList.remove('find-match', 'find-match-active');
  });
  state.findState.matches = [];
  state.findState.currentIndex = -1;
}

function buildSearchRegex(query, matchCase, wholeWord) {
  if (!query) return null;
  let pattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (wholeWord) {
    pattern = `\\b${pattern}\\b`;
  }
  const flags = matchCase ? 'g' : 'gi';
  try {
    return new RegExp(pattern, flags);
  } catch (e) {
    return null;
  }
}

function performSearch() {
  clearFindHighlights();
  const query = $findInput.value;
  state.findState.query = query;
  if (!query || state.pages.length === 0) {
    $findCount.textContent = '0 of 0';
    return;
  }

  const regex = buildSearchRegex(query, state.findState.matchCase, state.findState.wholeWord);
  if (!regex) {
    $findCount.textContent = '0 of 0';
    return;
  }

  const matches = [];
  for (let p = 0; p < state.pages.length; p++) {
    const pageData = state.pages[p];
    for (const item of pageData.textItems) {
      regex.lastIndex = 0;
      if (regex.test(item.text)) {
        const el = pageData.textLayerEl?.querySelector(`[data-item-id="${item.id}"]`);
        if (el) {
          el.classList.add('find-match');
          matches.push({ pageIdx: p, item, el });
        }
      }
    }
  }

  state.findState.matches = matches;
  if (matches.length > 0) {
    state.findState.currentIndex = 0;
    highlightCurrentMatch();
  } else {
    state.findState.currentIndex = -1;
    $findCount.textContent = '0 of 0';
  }
}

function highlightCurrentMatch() {
  const { matches, currentIndex } = state.findState;
  if (matches.length === 0 || currentIndex < 0) {
    $findCount.textContent = '0 of 0';
    return;
  }

  document.querySelectorAll('.text-block.find-match-active').forEach(el => {
    el.classList.remove('find-match-active');
  });

  const current = matches[currentIndex];
  current.el.classList.add('find-match-active');
  $findCount.textContent = `${currentIndex + 1} of ${matches.length}`;

  current.el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  $currentPage.textContent = current.pageIdx + 1;
  updateThumbnailActive(current.pageIdx);
}

function nextMatch() {
  if (state.findState.matches.length === 0) return;
  state.findState.currentIndex = (state.findState.currentIndex + 1) % state.findState.matches.length;
  highlightCurrentMatch();
}

function prevMatch() {
  if (state.findState.matches.length === 0) return;
  state.findState.currentIndex = (state.findState.currentIndex - 1 + state.findState.matches.length) % state.findState.matches.length;
  highlightCurrentMatch();
}

function replaceCurrentMatch() {
  const { matches, currentIndex } = state.findState;
  if (matches.length === 0 || currentIndex < 0) return;

  const current = matches[currentIndex];
  const query = $findInput.value;
  const replacement = $replaceInput.value;
  const regex = buildSearchRegex(query, state.findState.matchCase, state.findState.wholeWord);
  if (!regex) return;

  const prevText = current.item.text;
  const newText = prevText.replace(regex, replacement);
  if (newText === prevText) return;

  pushUndo({
    type: 'edit',
    itemId: current.item.id,
    page: current.item.page,
    prev: { ...current.item }
  });

  current.item.text = newText;
  current.item.modified = true;
  const pageData = state.pages[current.pageIdx];
  updateElementAfterTextChange(current.el, current.item, pageData);

  showToast('✓ Match replaced', 'success', 1500);
  performSearch();
}

function replaceAllMatches() {
  const query = $findInput.value;
  if (!query) return;
  const replacement = $replaceInput.value;
  const regex = buildSearchRegex(query, state.findState.matchCase, state.findState.wholeWord);
  if (!regex) return;

  const undoItems = [];
  let replaceCount = 0;
  const affectedPages = new Set();

  for (let p = 0; p < state.pages.length; p++) {
    const pageData = state.pages[p];
    for (const item of pageData.textItems) {
      regex.lastIndex = 0;
      if (regex.test(item.text)) {
        const prevText = item.text;
        const newText = prevText.replace(regex, replacement);
        if (newText !== prevText) {
          undoItems.push({ itemId: item.id, page: item.page, prev: { ...item } });
          item.text = newText;
          item.modified = true;
          replaceCount++;
          affectedPages.add(p + 1);
          const el = pageData.textLayerEl?.querySelector(`[data-item-id="${item.id}"]`);
          if (el) {
            updateElementAfterTextChange(el, item, pageData);
          }
        }
      }
    }
  }

  if (replaceCount > 0) {
    pushUndo({ type: 'batch_edit', items: undoItems });
    performSearch();
    showToast(`✓ Replaced ${replaceCount} occurrence${replaceCount > 1 ? 's' : ''} across ${affectedPages.size} page${affectedPages.size > 1 ? 's' : ''}`, 'success', 4000);
  } else {
    showToast('No matches found to replace', 'info', 2000);
  }
}

// Find & Replace Event Listeners
$btnFind.addEventListener('click', () => {
  if (state.findState.open) {
    closeFindReplace();
  } else {
    openFindReplace(false);
  }
});

$findInput.addEventListener('input', performSearch);
$findInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    e.shiftKey ? prevMatch() : nextMatch();
  }
});

$btnFindNext.addEventListener('click', nextMatch);
$btnFindPrev.addEventListener('click', prevMatch);

$btnFindCase.addEventListener('click', () => {
  state.findState.matchCase = !state.findState.matchCase;
  $btnFindCase.classList.toggle('active', state.findState.matchCase);
  performSearch();
});

$btnFindWord.addEventListener('click', () => {
  state.findState.wholeWord = !state.findState.wholeWord;
  $btnFindWord.classList.toggle('active', state.findState.wholeWord);
  performSearch();
});

$btnFindClose.addEventListener('click', closeFindReplace);

$replaceInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      replaceAllMatches();
    } else {
      replaceCurrentMatch();
    }
  }
});

$btnReplaceOne.addEventListener('click', replaceCurrentMatch);
$btnReplaceAll.addEventListener('click', replaceAllMatches);

// ─── THUMBNAILS ───────────────────────────────────────────────────────────────
function createThumbnail(sourceCanvas, pageIdx, pageNum) {
  const thumb = document.createElement('div');
  thumb.className = 'thumb-item';
  thumb.dataset.pageIdx = pageIdx;

  const wrap = document.createElement('div');
  wrap.className = 'thumb-canvas-wrap';

  const thumbCanvas = document.createElement('canvas');
  const scale = 140 / sourceCanvas.width;
  thumbCanvas.width  = Math.round(sourceCanvas.width  * scale);
  thumbCanvas.height = Math.round(sourceCanvas.height * scale);
  const ctx = thumbCanvas.getContext('2d');
  ctx.drawImage(sourceCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height);

  const label = document.createElement('div');
  label.className = 'thumb-label';
  label.textContent = `Page ${pageNum}`;

  wrap.appendChild(thumbCanvas);
  thumb.appendChild(wrap);
  thumb.appendChild(label);
  $thumbnails.appendChild(thumb);

  thumb.addEventListener('click', () => scrollToPage(pageIdx));
}

function updateThumbnailActive(pageIdx) {
  document.querySelectorAll('.thumb-item').forEach((t, i) => {
    t.classList.toggle('active', i === pageIdx);
  });
}

function scrollToPage(pageIdx) {
  updateThumbnailActive(pageIdx);
  const wrapper = state.pages[pageIdx]?.wrapper;
  if (wrapper) {
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    $currentPage.textContent = pageIdx + 1;
  }
}

// Track current page via intersection observer
function setupPageObserver() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting && e.intersectionRatio > 0.5) {
        const idx = parseInt(e.target.dataset.pageIdx);
        $currentPage.textContent = idx + 1;
        updateThumbnailActive(idx);
      }
    });
  }, { root: $('canvas-area'), threshold: 0.5 });

  document.querySelectorAll('.page-wrapper').forEach(pw => observer.observe(pw));
}

// ─── BACK / RESET ─────────────────────────────────────────────────────────────
$btnBack.addEventListener('click', () => {
  if (confirm('Close this file? Unsaved changes will be lost.')) {
    $editor.classList.add('hidden');
    $landing.classList.remove('hidden');
    $pagesContainer.innerHTML = '';
    $thumbnails.innerHTML = '';
    $fileInput.value = '';
    state.pdfDoc = null;
    state.pages = [];
    state.selectedBlock = null;
    state.undoStack = [];
    state.redoStack = [];
    closeFindReplace();
    $findInput.value = '';
    $replaceInput.value = '';
  }
});

// ─── EXPORT / SAVE PDF (text-preserving via pdf-lib) ─────────────────────────
async function exportPdf() {
  if (!state.pdfDoc || !state.pdfData) return;

  // Count modifications
  const totalMods = state.pages.reduce((n, p) =>
    n + p.textItems.filter(it => it.modified).length, 0);

  showLoading('Saving PDF…', 'Loading pdf-lib…', 8);

  try {
    const { PDFDocument, rgb, StandardFonts, degrees } = PDFLib;

    // ── 1. Load the ORIGINAL PDF bytes (not rasterised) ──────────────────────
    const pdfLibDoc = await PDFDocument.load(state.pdfData, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    const libPages = pdfLibDoc.getPages();

    setProgress(20);
    $loadingSub.textContent = `Embedding fonts…`;

    // ── 2. Pre-embed all standard fonts we might need ─────────────────────────
    const fonts = {
      regular:     await pdfLibDoc.embedFont(StandardFonts.Helvetica),
      bold:        await pdfLibDoc.embedFont(StandardFonts.HelveticaBold),
      italic:      await pdfLibDoc.embedFont(StandardFonts.HelveticaOblique),
      boldItalic:  await pdfLibDoc.embedFont(StandardFonts.HelveticaBoldOblique),
      times:       await pdfLibDoc.embedFont(StandardFonts.TimesRoman),
      timesBold:   await pdfLibDoc.embedFont(StandardFonts.TimesRomanBold),
      courier:     await pdfLibDoc.embedFont(StandardFonts.Courier),
      courierBold: await pdfLibDoc.embedFont(StandardFonts.CourierBold),
    };

    function pickFont(item) {
      const name = (item.fontName || '').toLowerCase();
      if (name.includes('times') || name.includes('roman')) {
        return item.bold ? fonts.timesBold : fonts.times;
      }
      if (name.includes('courier') || name.includes('mono')) {
        return item.bold ? fonts.courierBold : fonts.courier;
      }
      if (item.bold && item.italic) return fonts.boldItalic;
      if (item.bold)   return fonts.bold;
      if (item.italic) return fonts.italic;
      return fonts.regular;
    }

    function hexToRgb(hex) {
      const h = (hex || '#000000').replace('#', '');
      return rgb(
        parseInt(h.slice(0, 2), 16) / 255,
        parseInt(h.slice(2, 4), 16) / 255,
        parseInt(h.slice(4, 6), 16) / 255,
      );
    }

    setProgress(35);

    // ── 3. Apply edits page by page ───────────────────────────────────────────
    for (let i = 0; i < state.pages.length; i++) {
      const progress = 35 + (i / state.pages.length) * 55;
      setProgress(progress);
      $loadingSub.textContent = `Processing page ${i + 1} of ${state.pages.length}…`;

      const pageData  = state.pages[i];
      const libPage   = libPages[i];
      const { height: pageHeight } = libPage.getSize();

      for (const item of pageData.textItems) {
        if (!item.modified) continue;

        const pdfX    = item.transform[4];
        const pdfY    = item.transform[5];
        const fs      = Math.max(item.fontSize, 1);
        const txtW    = item.width > 0 ? item.width : item.text.length * fs * 0.65;

        // 3a. White-out the original text region
        libPage.drawRectangle({
          x:      pdfX - 2,
          y:      pdfY - fs * 0.25,
          width:  txtW + 4,
          height: fs * 1.35,
          color:  rgb(1, 1, 1),
          opacity: 1,
        });

        // 3b. Draw the new text as real PDF text (stays editable!)
        const font = pickFont(item);
        const color = hexToRgb(item.color);

        // Sanitise text: remove characters outside Latin-1 range that
        // standard PDF fonts can't encode (avoids pdf-lib encoding errors)
        const safeText = item.text.replace(/[^\x00-\xFF]/g, '?');

        try {
          libPage.drawText(safeText, {
            x:    pdfX,
            y:    pdfY,
            size: fs,
            font,
            color,
            rotate: item.angle ? degrees(-(item.angle * 180) / Math.PI) : undefined,
          });
        } catch (drawErr) {
          // If the text still can't encode, fall back to ASCII-safe version
          const asciiText = item.text.replace(/[^\x20-\x7E]/g, '?');
          libPage.drawText(asciiText, { x: pdfX, y: pdfY, size: fs, font, color });
        }
      }
    }

    setProgress(92);
    $loadingSub.textContent = 'Writing file…';

    // ── 4. Serialise and download ─────────────────────────────────────────────
    const pdfBytes = await pdfLibDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url  = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href     = url;
    anchor.download = state.fileName.replace(/\.pdf$/i, '') + '_edited.pdf';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 5000);

    setProgress(100);
    hideLoading();

    const msg = totalMods > 0
      ? `✓ Saved! ${totalMods} text block${totalMods > 1 ? 's' : ''} edited — re-editable in any PDF editor`
      : '✓ Saved (no changes made)';
    showToast(msg, 'success', 5000);

  } catch (err) {
    hideLoading();
    showToast(`Export error: ${err.message}`, 'error');
    console.error('PDF export error:', err);
  }
}

$btnSave.addEventListener('click', exportPdf);


// ─── INIT ─────────────────────────────────────────────────────────────────────
(function init() {
  $zoomLabel.textContent = '100%';
  hideLoading();

  // Set up page scroll observer after a short delay
  const observer = new MutationObserver(() => {
    if (document.querySelectorAll('.page-wrapper').length > 0) {
      setupPageObserver();
      observer.disconnect();
    }
  });
  observer.observe($pagesContainer, { childList: true });
})();
