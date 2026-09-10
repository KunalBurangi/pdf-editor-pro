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
const $btnAddPage      = $('btn-add-page');
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

      const unscaledVp = pdfPage.getViewport({ scale: 1.0 });
      state.pages.push({
        pdfPage,
        textItems,
        pageNum: i,
        originalIndex: i - 1,
        rotation: 0,
        isNewPage: false,
        width: unscaledVp.width,
        height: unscaledVp.height,
        wrapper: null,
        canvas: null,
        textLayerEl: null,
        viewport: null,
      });
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
  $pagesContainer.innerHTML = '';
  for (let i = 0; i < state.pages.length; i++) {
    await renderPage(i);
  }
  renderAllThumbnails();
  setupPageObserver();
  updateThumbnailActive(0);
}

async function renderPage(pageIdx, insertBeforeEl = null, replaceEl = null) {
  const pageData = state.pages[pageIdx];
  const { pdfPage, textItems, pageNum, rotation, isNewPage } = pageData;

  const dpr = window.devicePixelRatio || 1;
  let cssViewport, renderViewport;

  if (isNewPage || !pdfPage) {
    const baseW = pageData.width || 595.28;
    const baseH = pageData.height || 841.89;
    const isSwapped = (rotation % 180 !== 0);
    const unscaledW = isSwapped ? baseH : baseW;
    const unscaledH = isSwapped ? baseW : baseH;

    const cssW = unscaledW * state.zoom;
    const cssH = unscaledH * state.zoom;
    cssViewport = {
      width: cssW,
      height: cssH,
      scale: state.zoom,
      rotation: (rotation || 0) % 360,
      transform: [state.zoom, 0, 0, -state.zoom, 0, cssH],
    };
    renderViewport = {
      width: cssW * dpr,
      height: cssH * dpr,
      scale: state.zoom * dpr,
    };
  } else {
    const totalRotation = ((pdfPage.rotate || 0) + (rotation || 0)) % 360;
    cssViewport    = pdfPage.getViewport({ scale: state.zoom, rotation: totalRotation });
    renderViewport = pdfPage.getViewport({ scale: state.zoom * dpr, rotation: totalRotation });
  }

  // Wrapper sized at logical CSS dimensions
  const wrapper = document.createElement('div');
  wrapper.className = 'page-wrapper';
  wrapper.dataset.pageIdx = pageIdx;
  wrapper.style.width  = `${cssViewport.width}px`;
  wrapper.style.height = `${cssViewport.height}px`;
  if (state.editMode) wrapper.classList.add('edit-mode');

  // Canvas buffer = physical pixels; CSS display = logical pixels
  const canvas = document.createElement('canvas');
  canvas.className    = 'page-canvas';
  canvas.width        = Math.round(renderViewport.width);
  canvas.height       = Math.round(renderViewport.height);
  canvas.style.width  = `${cssViewport.width}px`;
  canvas.style.height = `${cssViewport.height}px`;

  const ctx = canvas.getContext('2d');
  if (isNewPage || !pdfPage) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    await pdfPage.render({ canvasContext: ctx, viewport: renderViewport }).promise;
  }

  // Text overlay layer
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

  if (replaceEl && replaceEl.parentNode) {
    replaceEl.parentNode.replaceChild(wrapper, replaceEl);
  } else if (insertBeforeEl && insertBeforeEl.parentNode) {
    insertBeforeEl.parentNode.insertBefore(wrapper, insertBeforeEl);
  } else {
    $pagesContainer.appendChild(wrapper);
  }

  // Store references
  state.pages[pageIdx].wrapper     = wrapper;
  state.pages[pageIdx].canvas      = canvas;
  state.pages[pageIdx].textLayerEl = textLayer;
  state.pages[pageIdx].viewport    = cssViewport;

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
  el.style.width     = `${Math.max(scaledWidth, 8)}px`;
  el.style.height    = `${Math.max(scaledHeight, 8)}px`;
  el.style.fontSize  = `${scaledFontSize}px`;
  el.style.fontFamily = normalizeFontName(item.fontName);
  el.style.fontWeight = item.bold   ? 'bold'   : 'normal';
  el.style.fontStyle  = item.italic ? 'italic' : 'normal';

  // Rotation positioning
  const rotDeg = ((viewport.rotation || 0) % 360 + 360) % 360;
  if (rotDeg === 90) {
    el.style.left = `${sx + scaledFontSize}px`;
    el.style.top  = `${sy}px`;
    el.style.transformOrigin = '0 0';
    el.style.transform = `rotate(${90 - (item.angle * 180 / Math.PI)}deg)`;
  } else if (rotDeg === 180) {
    el.style.left = `${sx}px`;
    el.style.top  = `${sy + scaledFontSize}px`;
    el.style.transformOrigin = '0 0';
    el.style.transform = `rotate(${180 - (item.angle * 180 / Math.PI)}deg)`;
  } else if (rotDeg === 270) {
    el.style.left = `${sx - scaledFontSize}px`;
    el.style.top  = `${sy}px`;
    el.style.transformOrigin = '0 0';
    el.style.transform = `rotate(${270 - (item.angle * 180 / Math.PI)}deg)`;
  } else {
    // 0 deg default
    el.style.left = `${sx}px`;
    el.style.top  = `${sy - scaledFontSize}px`;
    if (item.angle !== 0) {
      el.style.transformOrigin = '0 100%';
      el.style.transform = `rotate(${-item.angle}rad)`;
    }
  }

  if (item.modified) {
    el.classList.add('modified');
    el.textContent = item.text;
    el.style.color = item.color || '#000000';
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

  el.style.left = `${sx}px`;
  el.style.top  = `${sy - scaledFontSize}px`;

  updateElementAfterTextChange(el, item, pageData);

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
  el.textContent = item.text;
  el.style.color = item.color || '#000000';
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
      el.contentEditable = 'false';
      el.classList.remove('editing');
      const pageData = state.pages.find(p => p.pageNum === item.page);
      updateElementAfterTextChange(el, item, pageData);
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
  const pageData = state.pages.find(p => p.pageNum === item.page);
  if (newText !== item.text) {
    pushUndo({ type: 'edit', itemId: item.id, page: item.page, prev: { ...item } });
    item.text = newText;
    item.modified = true;
    updateElementAfterTextChange(el, item, pageData);
    $propContent.value = newText;
    showToast('✓ Text updated', 'success', 1500);
    if (state.findState.open) performSearch();
  } else {
    updateElementAfterTextChange(el, item, pageData);
  }
}

function updateElementAfterTextChange(el, item, pageData) {
  const vp = pageData?.viewport || state.pages[item.page - 1]?.viewport;
  const scale = vp?.scale || state.zoom || 1.0;
  const scaledFontSize = Math.abs(item.fontSize) * scale;
  const scaledWidth = item.width > 0
    ? (item.text.length / Math.max(item.originalText?.length || 1, 1)) * item.width * scale
    : item.text.length * scaledFontSize * 0.55;

  el.style.width = `${Math.max(scaledWidth, 12)}px`;
  el.style.height = `${Math.max(scaledFontSize * 1.3, 14)}px`;
  el.style.fontSize = `${scaledFontSize}px`;
  el.style.fontFamily = normalizeFontName(item.fontName);
  el.style.fontWeight = item.bold ? 'bold' : 'normal';
  el.style.fontStyle = item.italic ? 'italic' : 'normal';
  el.title = `${item.fontName || 'Unknown'} ${Math.round(item.fontSize)}pt — "${item.text}"`;
  el.setAttribute('aria-label', `Edit: ${item.text.substring(0, 40)}`);

  if (item.modified) {
    el.classList.add('modified');
    el.textContent = item.text;
    el.style.color = item.color || '#000000';
  } else {
    el.classList.remove('modified');
    el.textContent = '';
  }
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

  for (let i = 0; i < state.pages.length; i++) {
    setProgress(10 + (i / state.pages.length) * 85);
    await renderPage(i);
  }

  setupPageObserver();
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

// ─── THUMBNAILS & PAGE MANAGEMENT ──────────────────────────────────────────
let draggedPageIdx = null;

function renderAllThumbnails() {
  $thumbnails.innerHTML = '';
  state.pages.forEach((pageData, idx) => {
    createThumbnailItem(pageData, idx);
  });
  updateThumbnailActive(state.currentPage ? state.currentPage - 1 : 0);
}

function createThumbnailItem(pageData, idx) {
  const thumb = document.createElement('div');
  thumb.className = 'thumb-item';
  thumb.dataset.pageIdx = idx;
  thumb.draggable = true;

  // Wrap for canvas + hover actions
  const wrap = document.createElement('div');
  wrap.className = 'thumb-canvas-wrap';

  // Preview canvas
  const thumbCanvas = document.createElement('canvas');
  const sourceCanvas = pageData.canvas;
  const targetW = 140;

  if (sourceCanvas && sourceCanvas.width > 0) {
    const scale = targetW / sourceCanvas.width;
    thumbCanvas.width  = targetW;
    thumbCanvas.height = Math.round(sourceCanvas.height * scale);
    const ctx = thumbCanvas.getContext('2d');
    ctx.drawImage(sourceCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
  } else {
    thumbCanvas.width  = targetW;
    thumbCanvas.height = Math.round(targetW * 1.414);
    const ctx = thumbCanvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, thumbCanvas.width, thumbCanvas.height);
  }
  wrap.appendChild(thumbCanvas);

  // Hover action buttons (Rotate, Duplicate, Delete)
  const actions = document.createElement('div');
  actions.className = 'thumb-actions';

  // Rotate button (90° clockwise)
  const btnRot = document.createElement('button');
  btnRot.className = 'thumb-act-btn';
  btnRot.title = 'Rotate 90° clockwise';
  btnRot.setAttribute('aria-label', `Rotate page ${idx + 1}`);
  btnRot.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>`;
  btnRot.addEventListener('click', (e) => {
    e.stopPropagation();
    rotatePage(idx);
  });

  // Duplicate button
  const btnDup = document.createElement('button');
  btnDup.className = 'thumb-act-btn';
  btnDup.title = 'Duplicate page';
  btnDup.setAttribute('aria-label', `Duplicate page ${idx + 1}`);
  btnDup.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
  btnDup.addEventListener('click', (e) => {
    e.stopPropagation();
    duplicatePage(idx);
  });

  // Delete button
  const btnDel = document.createElement('button');
  btnDel.className = 'thumb-act-btn danger';
  btnDel.title = state.pages.length <= 1 ? 'Cannot delete the only page' : 'Delete page';
  btnDel.setAttribute('aria-label', `Delete page ${idx + 1}`);
  btnDel.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>`;
  btnDel.addEventListener('click', (e) => {
    e.stopPropagation();
    deletePage(idx);
  });

  actions.appendChild(btnRot);
  actions.appendChild(btnDup);
  actions.appendChild(btnDel);
  wrap.appendChild(actions);

  // Footer: drag handle + page number label
  const footer = document.createElement('div');
  footer.className = 'thumb-footer';

  const dragHandle = document.createElement('span');
  dragHandle.className = 'thumb-drag-handle';
  dragHandle.title = 'Drag to reorder';
  dragHandle.textContent = '⋮⋮';

  const label = document.createElement('span');
  label.className = 'thumb-label';
  label.textContent = `Page ${pageData.pageNum}`;

  footer.appendChild(dragHandle);
  footer.appendChild(label);

  thumb.appendChild(wrap);
  thumb.appendChild(footer);

  // Drag & drop event listeners
  thumb.addEventListener('dragstart', (e) => {
    draggedPageIdx = idx;
    thumb.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  });

  thumb.addEventListener('dragend', () => {
    thumb.classList.remove('dragging');
    document.querySelectorAll('.thumb-item').forEach(t => {
      t.classList.remove('drag-over-top', 'drag-over-bottom');
    });
    draggedPageIdx = null;
  });

  thumb.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (draggedPageIdx === null || draggedPageIdx === idx) return;
    e.dataTransfer.dropEffect = 'move';
    const rect = thumb.getBoundingClientRect();
    const isTop = e.clientY < (rect.top + rect.height / 2);
    thumb.classList.toggle('drag-over-top', isTop);
    thumb.classList.toggle('drag-over-bottom', !isTop);
  });

  thumb.addEventListener('dragleave', () => {
    thumb.classList.remove('drag-over-top', 'drag-over-bottom');
  });

  thumb.addEventListener('drop', (e) => {
    e.preventDefault();
    thumb.classList.remove('drag-over-top', 'drag-over-bottom');
    if (draggedPageIdx === null || draggedPageIdx === idx) return;

    const rect = thumb.getBoundingClientRect();
    const isAfter = e.clientY >= (rect.top + rect.height / 2);
    reorderPages(draggedPageIdx, idx, isAfter);
  });

  // Click thumbnail to scroll to that page
  thumb.addEventListener('click', () => scrollToPage(idx));

  $thumbnails.appendChild(thumb);
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

// ─── PAGE MANAGEMENT ACTIONS ──────────────────────────────────────────────────
function reorderPages(fromIdx, targetIdx, insertAfter) {
  if (fromIdx === targetIdx) return;

  const [moved] = state.pages.splice(fromIdx, 1);
  let destIdx = targetIdx;
  if (fromIdx < targetIdx) {
    destIdx = insertAfter ? targetIdx : targetIdx - 1;
  } else {
    destIdx = insertAfter ? targetIdx + 1 : targetIdx;
  }
  destIdx = Math.max(0, Math.min(state.pages.length, destIdx));
  state.pages.splice(destIdx, 0, moved);

  // Sync DOM order in container (moving existing nodes preserves canvas & listeners)
  state.pages.forEach(p => {
    if (p.wrapper) $pagesContainer.appendChild(p.wrapper);
  });

  refreshAfterPageChange(destIdx);
  showToast(`✓ Moved Page ${fromIdx + 1} to position ${destIdx + 1}`, 'success', 2000);
}

async function rotatePage(pageIdx) {
  const pageData = state.pages[pageIdx];
  if (!pageData) return;

  pageData.rotation = ((pageData.rotation || 0) + 90) % 360;

  // Re-render this page in place
  const oldWrapper = pageData.wrapper;
  await renderPage(pageIdx, null, oldWrapper);

  // Re-render thumbnails to reflect new orientation
  renderAllThumbnails();
  setupPageObserver();

  showToast(`✓ Page ${pageData.pageNum} rotated 90° clockwise`, 'success', 2000);
  if (state.findState.open) performSearch();
}

async function duplicatePage(pageIdx) {
  const src = state.pages[pageIdx];
  if (!src) return;

  showLoading('Duplicating page…', `Cloning page ${src.pageNum}`, 30);

  // Deep clone text items with fresh unique IDs
  const dupPrefix = `p${Date.now()}`;
  const clonedTextItems = src.textItems.map((item, idx) => ({
    ...item,
    id: `${dupPrefix}-t${idx}`,
    modified: item.modified,
    transform: [...item.transform],
  }));

  const newPageData = {
    pdfPage: src.pdfPage,
    textItems: clonedTextItems,
    pageNum: pageIdx + 2,
    originalIndex: src.isNewPage ? null : src.originalIndex,
    rotation: src.rotation || 0,
    isNewPage: src.isNewPage || false,
    width: src.width,
    height: src.height,
    wrapper: null,
    canvas: null,
    textLayerEl: null,
    viewport: null,
  };

  state.pages.splice(pageIdx + 1, 0, newPageData);

  // Insert DOM wrapper after source wrapper
  const nextSibling = src.wrapper ? src.wrapper.nextSibling : null;
  await renderPage(pageIdx + 1, nextSibling);

  refreshAfterPageChange(pageIdx + 1);
  hideLoading();
  showToast(`✓ Duplicated Page ${pageIdx + 1}`, 'success', 2500);
}

function deletePage(pageIdx) {
  if (state.pages.length <= 1) {
    showToast('Cannot delete the only page in the document.', 'error', 3000);
    return;
  }

  const targetPage = state.pages[pageIdx];
  const confirmMsg = targetPage.textItems.length > 0
    ? `Delete Page ${pageIdx + 1}? All text and edits on this page will be removed.`
    : `Delete Page ${pageIdx + 1}?`;

  if (!confirm(confirmMsg)) return;

  const [removed] = state.pages.splice(pageIdx, 1);
  if (removed.wrapper && removed.wrapper.parentNode) {
    removed.wrapper.remove();
  }

  if (state.selectedBlock && state.selectedBlock.item.page === removed.pageNum) {
    deselectAll();
  }

  const nextFocus = Math.min(pageIdx, state.pages.length - 1);
  refreshAfterPageChange(nextFocus);
  showToast(`✓ Deleted Page ${removed.pageNum}`, 'info', 2000);
}

async function addBlankPage() {
  if (state.pages.length === 0) return;

  const newIdx = state.pages.length;
  showLoading('Adding page…', 'Creating blank page', 40);

  const newPageData = {
    pdfPage: null,
    textItems: [],
    pageNum: newIdx + 1,
    originalIndex: null,
    rotation: 0,
    isNewPage: true,
    width: 595.28,   // Standard A4 width in pt
    height: 841.89,  // Standard A4 height in pt
    wrapper: null,
    canvas: null,
    textLayerEl: null,
    viewport: null,
  };

  state.pages.push(newPageData);
  await renderPage(newIdx);

  refreshAfterPageChange(newIdx);
  hideLoading();
  showToast(`✓ Added blank Page ${newIdx + 1} at end`, 'success', 2500);
}

function refreshAfterPageChange(focusIdx = -1) {
  const total = state.pages.length;
  $sidebarCount.textContent = total;
  $totalPages.textContent = total;

  state.pages.forEach((p, i) => {
    p.pageNum = i + 1;
    if (p.wrapper) {
      p.wrapper.dataset.pageIdx = i;
      const lbl = p.wrapper.querySelector('.page-number-label');
      if (lbl) lbl.textContent = `Page ${i + 1}`;
    }
    if (p.textLayerEl) {
      p.textLayerEl.dataset.pageIdx = i;
    }
    p.textItems.forEach(it => { it.page = i + 1; });
  });

  renderAllThumbnails();
  setupPageObserver();

  if (focusIdx >= 0 && focusIdx < total) {
    scrollToPage(focusIdx);
  }
}

// Bind Add Page button in sidebar header
if ($btnAddPage) {
  $btnAddPage.addEventListener('click', addBlankPage);
}

// Track current page via intersection observer
let pageObserver = null;
function setupPageObserver() {
  if (pageObserver) pageObserver.disconnect();

  pageObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting && e.intersectionRatio > 0.5) {
        const idx = parseInt(e.target.dataset.pageIdx);
        if (!isNaN(idx)) {
          $currentPage.textContent = idx + 1;
          updateThumbnailActive(idx);
        }
      }
    });
  }, { root: $('canvas-area'), threshold: 0.5 });

  document.querySelectorAll('.page-wrapper').forEach(pw => pageObserver.observe(pw));
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
    state.pdfData = null;
    state.pages = [];
    state.selectedBlock = null;
    state.undoStack = [];
    state.redoStack = [];
    closeFindReplace();
    $findInput.value = '';
    $replaceInput.value = '';
  }
});

// ─── EXPORT / SAVE PDF (copyPages order + text modifications) ────────────────
async function exportPdf() {
  if (!state.pages || state.pages.length === 0) return;

  const totalMods = state.pages.reduce((n, p) =>
    n + p.textItems.filter(it => it.modified).length, 0);

  showLoading('Saving PDF…', 'Initializing document builder…', 8);

  try {
    const { PDFDocument, rgb, StandardFonts, degrees } = PDFLib;

    // ── 1. Fresh output document ──────────────────────────────────────────────
    const outDoc = await PDFDocument.create();

    // Load original PDF if available
    let sourceDoc = null;
    if (state.pdfData) {
      sourceDoc = await PDFDocument.load(state.pdfData, {
        ignoreEncryption: true,
        updateMetadata: false,
      });
    }

    setProgress(20);
    $loadingSub.textContent = `Embedding fonts…`;

    // ── 2. Pre-embed standard fonts into outDoc ───────────────────────────────
    const fonts = {
      regular:     await outDoc.embedFont(StandardFonts.Helvetica),
      bold:        await outDoc.embedFont(StandardFonts.HelveticaBold),
      italic:      await outDoc.embedFont(StandardFonts.HelveticaOblique),
      boldItalic:  await outDoc.embedFont(StandardFonts.HelveticaBoldOblique),
      times:       await outDoc.embedFont(StandardFonts.TimesRoman),
      timesBold:   await outDoc.embedFont(StandardFonts.TimesRomanBold),
      courier:     await outDoc.embedFont(StandardFonts.Courier),
      courierBold: await outDoc.embedFont(StandardFonts.CourierBold),
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

    // ── 3. Build destination pages in their current user order ────────────────
    for (let i = 0; i < state.pages.length; i++) {
      const progress = 35 + (i / state.pages.length) * 55;
      setProgress(progress);
      $loadingSub.textContent = `Processing page ${i + 1} of ${state.pages.length}…`;

      const pageData = state.pages[i];
      let libPage;

      if (!pageData.isNewPage && sourceDoc && pageData.originalIndex != null) {
        // Copy original page from source document
        const [copiedPage] = await outDoc.copyPages(sourceDoc, [pageData.originalIndex]);
        libPage = outDoc.addPage(copiedPage);
      } else {
        // Blank page (A4 default: 595.28 x 841.89)
        const w = pageData.width || 595.28;
        const h = pageData.height || 841.89;
        libPage = outDoc.addPage([w, h]);
      }

      // Apply page rotation
      if (pageData.rotation) {
        const currentAngle = libPage.getRotation().angle || 0;
        libPage.setRotation(degrees((currentAngle + pageData.rotation) % 360));
      }

      // Apply modified text items to libPage
      for (const item of pageData.textItems) {
        if (!item.modified) continue;

        const pdfX = item.transform[4];
        const pdfY = item.transform[5];
        const fs   = Math.max(item.fontSize, 1);
        const txtW = item.width > 0 ? item.width : item.text.length * fs * 0.65;

        // White-out original text region in native PDF coordinates
        libPage.drawRectangle({
          x:      pdfX - 2,
          y:      pdfY - fs * 0.25,
          width:  txtW + 4,
          height: fs * 1.35,
          color:  rgb(1, 1, 1),
          opacity: 1,
        });

        // Draw replacement text
        const font = pickFont(item);
        const color = hexToRgb(item.color);
        const safeText = item.text.replace(/[^\x00-\xFF]/g, '?');

        try {
          libPage.drawText(safeText, {
            x: pdfX,
            y: pdfY,
            size: fs,
            font,
            color,
            rotate: item.angle ? degrees(-(item.angle * 180) / Math.PI) : undefined,
          });
        } catch (drawErr) {
          const asciiText = item.text.replace(/[^\x20-\x7E]/g, '?');
          libPage.drawText(asciiText, { x: pdfX, y: pdfY, size: fs, font, color });
        }
      }
    }

    setProgress(92);
    $loadingSub.textContent = 'Writing file…';

    // ── 4. Serialise and download ─────────────────────────────────────────────
    const pdfBytes = await outDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url  = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href     = url;
    anchor.download = (state.fileName || 'document').replace(/\.pdf$/i, '') + '_edited.pdf';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 5000);

    setProgress(100);
    hideLoading();

    const msg = totalMods > 0
      ? `✓ Saved ${state.pages.length} page${state.pages.length > 1 ? 's' : ''}! (${totalMods} edited block${totalMods > 1 ? 's' : ''})`
      : `✓ Saved ${state.pages.length} page${state.pages.length > 1 ? 's' : ''}!`;
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
