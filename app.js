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
  pages: [],              // Array of { pdfPage, textItems, canvas, textLayer, annotCanvas, widgets }
  fileName: '',
  zoom: 1.0,
  selectedBlock: null,    // Currently selected .text-block element
  selectedWidget: null,   // Currently selected .pdf-widget element
  editMode: false,        // true = edit mode, false = select mode
  currentTool: 'select',  // 'select' | 'edit' | 'draw' | 'highlight' | 'sticky'
  drawConfig: {
    color: '#000000',
    size: 2,
    isHighlighter: false,
  },
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
const $btnSign         = $('btn-sign');
const $btnImage        = $('btn-image');
const $btnDraw         = $('btn-draw');
const $btnHighlight    = $('btn-highlight');
const $btnSticky       = $('btn-sticky');
const $imageFileInput  = $('image-file-input');

// Annotation Sub-Toolbar
const $annotToolbar    = $('annotation-toolbar');
const $btnClearDrawings = $('btn-clear-drawings');

// Signature Modal DOM Refs
const $modalSig            = $('modal-signature');
const $btnCloseSig         = $('btn-close-sig');
const $btnCancelSig        = $('btn-cancel-sig');
const $btnInsertSig        = $('btn-insert-sig');
const $tabSigDraw          = $('tab-sig-draw');
const $tabSigType          = $('tab-sig-type');
const $tabSigUpload        = $('tab-sig-upload');
const $paneSigDraw         = $('pane-sig-draw');
const $paneSigType         = $('pane-sig-type');
const $paneSigUpload       = $('pane-sig-upload');
const $sigPadCanvas        = $('sig-pad-canvas');
const $btnClearSigPad      = $('btn-clear-sig-pad');
const $sigTypeInput        = $('sig-type-input');
const $sigFontPreviews     = $('sig-font-previews');
const $sigUploadDropzone   = $('sig-upload-dropzone');
const $sigFileInput        = $('sig-file-input');
const $sigUploadEmpty      = $('sig-upload-empty');
const $sigUploadPreviewWrap= $('sig-upload-preview-wrap');
const $sigUploadPreviewImg = $('sig-upload-preview-img');
const $btnRemoveUploadedSig= $('btn-remove-uploaded-sig');

// Merge Modal DOM Refs
const $btnMerge            = $('btn-merge');
const $btnMergeSidebar     = $('btn-merge-sidebar');
const $modalMerge          = $('modal-merge');
const $btnCloseMerge       = $('btn-close-merge');
const $btnCancelMerge      = $('btn-cancel-merge');
const $btnConfirmMerge     = $('btn-confirm-merge');
const $mergeFileInput      = $('merge-file-input');
const $mergeUploadZone     = $('merge-upload-zone');
const $mergeUploadEmpty    = $('merge-upload-empty');
const $mergeFilePreview    = $('merge-file-preview');
const $mergeFileName       = $('merge-file-name');
const $mergeFilePages      = $('merge-file-pages');
const $btnChangeMergeFile  = $('btn-change-merge-file');
const $mergeEndPageNum     = $('merge-end-page-num');
const $mergeCurrentPageNum = $('merge-current-page-num');

// Resize Modal DOM Refs
const $btnResize           = $('btn-resize');
const $modalResize         = $('modal-resize');
const $btnCloseResize      = $('btn-close-resize');
const $btnCancelResize     = $('btn-cancel-resize');
const $btnApplyResize      = $('btn-apply-resize');
const $resizeCustomRow     = $('resize-custom-row');
const $resizeCustomW       = $('resize-custom-w');
const $resizeCustomH       = $('resize-custom-h');
const $btnOrientPortrait   = $('btn-orient-portrait');
const $btnOrientLandscape  = $('btn-orient-landscape');
const $btnScopeAll         = $('btn-scope-all');
const $btnScopeCurrent     = $('btn-scope-current');
const $resizeTargetText    = $('resize-target-text');

const $btnZoomIn       = $('btn-zoom-in');
const $btnZoomOut      = $('btn-zoom-out');
const $btnZoomReset    = $('btn-zoom-reset');
const $btnUndo         = $('btn-undo');
const $btnRedo         = $('btn-redo');
const $btnSave         = $('btn-save');
const $btnThemeLanding = $('btn-theme-toggle-landing');
const $btnThemeEditor  = $('btn-theme-toggle-editor');
const $editorThemeIcon = $('editor-theme-icon');
const $btnHelp         = $('btn-help');
const $modalHelp       = $('modal-help');
const $btnCloseHelp    = $('btn-close-help');
const $btnDismissHelp  = $('btn-dismiss-help');
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
        sourcePdfData: state.pdfData,
        width: unscaledVp.width,
        height: unscaledVp.height,
        wrapper: null,
        canvas: null,
        textLayerEl: null,
        annotCanvas: null,
        annotDataUrl: null,
        widgets: [],
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
  } else if (pageData.resized) {
    const totalRotation = ((pdfPage.rotate || 0) + (rotation || 0)) % 360;
    const isSwapped = (totalRotation % 180 !== 0);
    const baseW = isSwapped ? pageData.height : pageData.width;
    const baseH = isSwapped ? pageData.width : pageData.height;

    const cssW = baseW * state.zoom;
    const cssH = baseH * state.zoom;
    cssViewport = {
      width: cssW,
      height: cssH,
      scale: state.zoom,
      rotation: totalRotation,
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
  } else if (pageData.resized) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    try {
      const origVp = pdfPage.getViewport({ scale: 1.0, rotation: ((pdfPage.rotate || 0) + (rotation || 0)) % 360 });
      const scaleFactor = (pageData.resized.mode === 'fit')
        ? Math.min(renderViewport.width / origVp.width, renderViewport.height / origVp.height)
        : state.zoom * dpr;
      const scaledVp = pdfPage.getViewport({ scale: scaleFactor, rotation: ((pdfPage.rotate || 0) + (rotation || 0)) % 360 });
      await pdfPage.render({ canvasContext: ctx, viewport: scaledVp }).promise;
    } catch (renderErr) {
      console.warn('Fallback render on resized page:', renderErr);
    }
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

  // Annotation drawing canvas
  const annotCanvas = document.createElement('canvas');
  annotCanvas.className = 'annotation-canvas';
  annotCanvas.width = Math.round(renderViewport.width);
  annotCanvas.height = Math.round(renderViewport.height);
  annotCanvas.style.width = `${cssViewport.width}px`;
  annotCanvas.style.height = `${cssViewport.height}px`;

  if (pageData.annotDataUrl) {
    const annotImg = new Image();
    annotImg.onload = () => {
      const actx = annotCanvas.getContext('2d');
      actx.drawImage(annotImg, 0, 0, annotCanvas.width, annotCanvas.height);
    };
    annotImg.src = pageData.annotDataUrl;
  }

  // Page number label
  const label = document.createElement('div');
  label.className = 'page-number-label';
  label.textContent = `Page ${pageNum}`;

  wrapper.appendChild(canvas);
  wrapper.appendChild(annotCanvas);
  wrapper.appendChild(textLayer);
  wrapper.appendChild(label);

  // Setup drawing listeners on annotCanvas
  setupDrawingForPage(annotCanvas, pageIdx, dpr);

  // Click on wrapper for sticky note placement
  wrapper.addEventListener('click', (e) => {
    if (state.currentTool === 'sticky') {
      const rect = wrapper.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      addStickyNote(pageIdx, clickX, clickY);
      setTool('select');
    }
  });

  // Mount any existing widgets (signatures, images, sticky notes)
  (pageData.widgets || []).forEach(w => {
    if (w.type === 'sticky') {
      mountStickyNoteElement(w, wrapper, pageIdx);
    } else {
      mountWidgetElement(w, wrapper, pageIdx);
    }
  });

  const isDraw = (state.currentTool === 'draw' || state.currentTool === 'highlight');
  if (isDraw) wrapper.classList.add('draw-mode-active');

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
  state.pages[pageIdx].annotCanvas = annotCanvas;
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
    if ($modalHelp && !$modalHelp.classList.contains('hidden')) {
      e.preventDefault();
      closeHelpModal();
      return;
    }
    if (state.findState.open) {
      e.preventDefault();
      closeFindReplace();
      return;
    }
  }
  if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) && !document.activeElement?.isContentEditable) {
    e.preventDefault();
    if ($modalHelp && !$modalHelp.classList.contains('hidden')) {
      closeHelpModal();
    } else {
      openHelpModal();
    }
    return;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (state.selectedWidget) {
      deleteWidget(state.selectedWidget.el, state.selectedWidget.widget);
      return;
    }
    if (state.selectedBlock && document.activeElement !== $propContent &&
        !state.selectedBlock.el.classList.contains('editing') &&
        document.activeElement !== $findInput && document.activeElement !== $replaceInput &&
        document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
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

// ─── TOOL MODES ───────────────────────────────────────────────────────────────
function setTool(tool) {
  state.currentTool = tool;

  // Tool buttons active state
  $btnSelect?.classList.toggle('active', tool === 'select');
  $btnEdit?.classList.toggle('active', tool === 'edit');
  $btnDraw?.classList.toggle('active', tool === 'draw');
  $btnHighlight?.classList.toggle('active', tool === 'highlight');
  $btnSticky?.classList.toggle('active', tool === 'sticky');

  state.editMode = (tool === 'edit');

  document.querySelectorAll('.text-layer').forEach(tl => {
    tl.classList.toggle('edit-mode', state.editMode);
  });

  const isDraw = (tool === 'draw' || tool === 'highlight');
  document.querySelectorAll('.page-wrapper').forEach(pw => {
    pw.classList.toggle('draw-mode-active', isDraw);
  });

  if (isDraw) {
    state.drawConfig.isHighlighter = (tool === 'highlight');
    $annotToolbar?.classList.remove('hidden');
    if (tool === 'highlight' && state.drawConfig.color === '#000000') {
      setDrawColor('#f59e0b');
    }
  } else {
    $annotToolbar?.classList.add('hidden');
  }

  if (isDraw || tool === 'sticky') {
    deselectAll();
    deselectWidget();
  }

  if (tool === 'sticky') {
    showToast('Click anywhere on a page to drop a sticky note', 'info', 2500);
  } else if (tool === 'draw') {
    showToast('Pen active — draw freehand anywhere on the page', 'info', 2000);
  } else if (tool === 'highlight') {
    showToast('Highlighter active — highlight text and areas', 'info', 2000);
  } else if (tool === 'select') {
    showToast('Select mode — click text or items to select', 'info', 1500);
  } else if (tool === 'edit') {
    showToast('Edit mode — click text to edit inline', 'info', 1500);
  }
}

$btnSelect?.addEventListener('click', () => setTool('select'));
$btnEdit?.addEventListener('click', () => setTool('edit'));
$btnDraw?.addEventListener('click', () => setTool(state.currentTool === 'draw' ? 'select' : 'draw'));
$btnHighlight?.addEventListener('click', () => setTool(state.currentTool === 'highlight' ? 'select' : 'highlight'));
$btnSticky?.addEventListener('click', () => setTool(state.currentTool === 'sticky' ? 'select' : 'sticky'));

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

// ─── HELPER: DATA URL TO UINT8ARRAY ──────────────────────────────────────────
function dataUrlToUint8Array(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ─── DRAWING & ANNOTATIONS ───────────────────────────────────────────────────
function setupDrawingForPage(annotCanvas, pageIdx, dpr) {
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;

  annotCanvas.addEventListener('pointerdown', (e) => {
    if (state.currentTool !== 'draw' && state.currentTool !== 'highlight') return;
    isDrawing = true;
    annotCanvas.setPointerCapture(e.pointerId);

    const rect = annotCanvas.getBoundingClientRect();
    const scaleX = annotCanvas.width / rect.width;
    const scaleY = annotCanvas.height / rect.height;
    lastX = (e.clientX - rect.left) * scaleX;
    lastY = (e.clientY - rect.top) * scaleY;

    const ctx = annotCanvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
  });

  annotCanvas.addEventListener('pointermove', (e) => {
    if (!isDrawing) return;
    const rect = annotCanvas.getBoundingClientRect();
    const scaleX = annotCanvas.width / rect.width;
    const scaleY = annotCanvas.height / rect.height;
    const curX = (e.clientX - rect.left) * scaleX;
    const curY = (e.clientY - rect.top) * scaleY;

    const ctx = annotCanvas.getContext('2d');
    if (state.currentTool === 'highlight') {
      ctx.strokeStyle = hexToRgba(state.drawConfig.color, 0.35);
      ctx.lineWidth = Math.max(state.drawConfig.size * 2.5 * dpr, 8);
      ctx.lineCap = 'square';
      ctx.lineJoin = 'miter';
    } else {
      ctx.strokeStyle = state.drawConfig.color;
      ctx.lineWidth = Math.max(state.drawConfig.size * dpr, 1.5);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }

    const midX = (lastX + curX) / 2;
    const midY = (lastY + curY) / 2;
    ctx.quadraticCurveTo(lastX, lastY, midX, midY);
    ctx.stroke();

    lastX = curX;
    lastY = curY;
  });

  const stopDrawing = () => {
    if (!isDrawing) return;
    isDrawing = false;
    const ctx = annotCanvas.getContext('2d');
    ctx.lineTo(lastX, lastY);
    ctx.stroke();
    state.pages[pageIdx].annotDataUrl = annotCanvas.toDataURL();
  };

  annotCanvas.addEventListener('pointerup', stopDrawing);
  annotCanvas.addEventListener('pointercancel', stopDrawing);
}

function hexToRgba(hex, alpha = 1.0) {
  const h = (hex || '#000000').replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function setDrawColor(color) {
  state.drawConfig.color = color;
  document.querySelectorAll('.color-dot').forEach(dot => {
    dot.classList.toggle('active', dot.dataset.color === color);
  });
}

function setDrawSize(size) {
  state.drawConfig.size = parseInt(size, 10);
  document.querySelectorAll('.size-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.size, 10) === state.drawConfig.size);
  });
}

function clearCurrentPageDrawings() {
  const curPageIdx = Math.max(0, state.currentPage - 1);
  const pageData = state.pages[curPageIdx];
  if (!pageData || !pageData.annotCanvas) return;

  const ctx = pageData.annotCanvas.getContext('2d');
  ctx.clearRect(0, 0, pageData.annotCanvas.width, pageData.annotCanvas.height);
  pageData.annotDataUrl = null;
  showToast(`✓ Cleared annotations on Page ${curPageIdx + 1}`, 'info', 2000);
}

// Annotation Sub-toolbar listeners
document.querySelectorAll('.color-dot').forEach(dot => {
  dot.addEventListener('click', () => setDrawColor(dot.dataset.color));
});
document.querySelectorAll('.size-btn').forEach(btn => {
  btn.addEventListener('click', () => setDrawSize(btn.dataset.size));
});
if ($btnClearDrawings) {
  $btnClearDrawings.addEventListener('click', clearCurrentPageDrawings);
}

// ─── INTERACTIVE PDF WIDGETS (SIGNATURES & IMAGES) ───────────────────────────
function createWidget({ type, pageIdx, dataUrl, width, height, x, y }) {
  const pageData = state.pages[pageIdx];
  if (!pageData || !pageData.wrapper) return;

  const wrapperRect = pageData.wrapper.getBoundingClientRect();
  const pageW = wrapperRect.width || (pageData.viewport ? pageData.viewport.width : 595);
  const pageH = wrapperRect.height || (pageData.viewport ? pageData.viewport.height : 842);

  const initW = width || 180;
  const initH = height || 80;
  const initX = x != null ? x : Math.max(20, (pageW - initW) / 2);
  const initY = y != null ? y : Math.max(30, (pageH - initH) * 0.35);

  const widget = {
    id: `widget-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    type,
    pageIdx,
    dataUrl,
    x: Math.round(initX),
    y: Math.round(initY),
    width: Math.round(initW),
    height: Math.round(initH),
  };

  if (!pageData.widgets) pageData.widgets = [];
  pageData.widgets.push(widget);

  mountWidgetElement(widget, pageData.wrapper, pageIdx);
  return widget;
}

function mountWidgetElement(widget, wrapper, pageIdx) {
  const el = document.createElement('div');
  el.className = 'pdf-widget';
  el.dataset.widgetId = widget.id;
  el.style.left = `${widget.x}px`;
  el.style.top = `${widget.y}px`;
  el.style.width = `${widget.width}px`;
  el.style.height = `${widget.height}px`;

  // Action overlay (Duplicate, Delete)
  const actions = document.createElement('div');
  actions.className = 'widget-actions';

  const btnDup = document.createElement('button');
  btnDup.className = 'widget-act-btn';
  btnDup.title = 'Duplicate';
  btnDup.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
  btnDup.addEventListener('click', (e) => {
    e.stopPropagation();
    duplicateWidget(widget, pageIdx);
  });

  const btnDel = document.createElement('button');
  btnDel.className = 'widget-act-btn danger';
  btnDel.title = 'Delete';
  btnDel.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>`;
  btnDel.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteWidget(el, widget);
  });

  actions.appendChild(btnDup);
  actions.appendChild(btnDel);
  el.appendChild(actions);

  // Content image
  const content = document.createElement('div');
  content.className = 'widget-content';
  const img = document.createElement('img');
  img.src = widget.dataUrl;
  content.appendChild(img);
  el.appendChild(content);

  // 8 Resize handles
  const handles = ['nw', 'ne', 'se', 'sw', 'n', 's', 'e', 'w'];
  handles.forEach(h => {
    const handleEl = document.createElement('div');
    handleEl.className = `widget-handle ${h}`;
    handleEl.dataset.handle = h;
    el.appendChild(handleEl);
  });

  wrapper.appendChild(el);
  setupWidgetInteractions(el, widget, pageIdx);
  selectWidget(el, widget);
}

function selectWidget(el, widget) {
  deselectAll();
  deselectWidget();
  el.classList.add('selected');
  state.selectedWidget = { el, widget };
}

function deselectWidget() {
  if (state.selectedWidget) {
    state.selectedWidget.el.classList.remove('selected');
    state.selectedWidget = null;
  }
}

function deleteWidget(el, widget) {
  el.remove();
  const pageData = state.pages[widget.pageIdx];
  if (pageData && pageData.widgets) {
    pageData.widgets = pageData.widgets.filter(w => w.id !== widget.id);
  }
  if (state.selectedWidget?.widget.id === widget.id) {
    state.selectedWidget = null;
  }
  showToast(`✓ Removed ${widget.type || 'item'}`, 'info', 1500);
}

function duplicateWidget(widget, pageIdx) {
  createWidget({
    type: widget.type,
    pageIdx,
    dataUrl: widget.dataUrl,
    width: widget.width,
    height: widget.height,
    x: widget.x + 20,
    y: widget.y + 20,
  });
  showToast(`✓ Duplicated ${widget.type || 'item'}`, 'success', 1500);
}

function setupWidgetInteractions(el, widget, pageIdx) {
  const pageData = state.pages[pageIdx];

  // Drag to move
  el.addEventListener('pointerdown', (e) => {
    if (e.target.classList.contains('widget-handle') || e.target.closest('.widget-actions')) return;
    e.stopPropagation();
    selectWidget(el, widget);

    const startX = e.clientX;
    const startY = e.clientY;
    const initLeft = widget.x;
    const initTop = widget.y;

    const pw = pageData.wrapper.getBoundingClientRect();
    const maxW = pw.width;
    const maxH = pw.height;

    const onPointerMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      widget.x = Math.max(0, Math.min(maxW - widget.width, initLeft + dx));
      widget.y = Math.max(0, Math.min(maxH - widget.height, initTop + dy));
      el.style.left = `${widget.x}px`;
      el.style.top  = `${widget.y}px`;
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  });

  // Resize handles
  el.querySelectorAll('.widget-handle').forEach(handleEl => {
    handleEl.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      const dir = handleEl.dataset.handle;
      const startX = e.clientX;
      const startY = e.clientY;
      const initX = widget.x;
      const initY = widget.y;
      const initW = widget.width;
      const initH = widget.height;
      const aspectRatio = initW / initH;

      const onResizeMove = (ev) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

        let newW = initW;
        let newH = initH;
        let newX = initX;
        let newY = initY;

        if (dir.includes('e')) newW = Math.max(30, initW + dx);
        if (dir.includes('s')) newH = Math.max(20, initH + dy);
        if (dir.includes('w')) {
          newW = Math.max(30, initW - dx);
          newX = initX + (initW - newW);
        }
        if (dir.includes('n')) {
          newH = Math.max(20, initH - dy);
          newY = initY + (initH - newH);
        }

        if (dir === 'se' || dir === 'nw' || dir === 'ne' || dir === 'sw') {
          if (Math.abs(dx) > Math.abs(dy)) {
            newH = Math.max(20, newW / aspectRatio);
          } else {
            newW = Math.max(30, newH * aspectRatio);
          }
          if (dir === 'nw') {
            newX = initX + (initW - newW);
            newY = initY + (initH - newH);
          } else if (dir === 'ne') {
            newY = initY + (initH - newH);
          } else if (dir === 'sw') {
            newX = initX + (initW - newW);
          }
        }

        widget.x = Math.round(newX);
        widget.y = Math.round(newY);
        widget.width = Math.round(newW);
        widget.height = Math.round(newH);

        el.style.left = `${widget.x}px`;
        el.style.top  = `${widget.y}px`;
        el.style.width  = `${widget.width}px`;
        el.style.height = `${widget.height}px`;
      };

      const onResizeUp = () => {
        window.removeEventListener('pointermove', onResizeMove);
        window.removeEventListener('pointerup', onResizeUp);
      };

      window.addEventListener('pointermove', onResizeMove);
      window.addEventListener('pointerup', onResizeUp);
    });
  });
}

// ─── STICKY NOTES ─────────────────────────────────────────────────────────────
function addStickyNote(pageIdx, x, y, initialText = '') {
  const pageData = state.pages[pageIdx];
  if (!pageData) return;

  const note = {
    id: `note-${Date.now()}`,
    type: 'sticky',
    pageIdx,
    x: Math.round(x),
    y: Math.round(y),
    text: initialText,
  };

  if (!pageData.widgets) pageData.widgets = [];
  pageData.widgets.push(note);

  mountStickyNoteElement(note, pageData.wrapper, pageIdx);
  showToast('✓ Sticky note added', 'success', 2000);
}

function mountStickyNoteElement(note, wrapper, pageIdx) {
  const el = document.createElement('div');
  el.className = 'sticky-note';
  el.dataset.noteId = note.id;
  el.style.left = `${note.x}px`;
  el.style.top  = `${note.y}px`;

  // Badge
  const badge = document.createElement('div');
  badge.className = 'sticky-badge';
  badge.title = 'Click to open/close note';
  badge.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;

  // Card
  const card = document.createElement('div');
  card.className = 'sticky-card';

  const header = document.createElement('div');
  header.className = 'sticky-header';
  const title = document.createElement('span');
  title.className = 'sticky-title';
  title.textContent = 'Note';

  const btnDel = document.createElement('button');
  btnDel.className = 'sticky-close-btn';
  btnDel.title = 'Delete note';
  btnDel.innerHTML = '🗑';
  btnDel.addEventListener('click', (e) => {
    e.stopPropagation();
    el.remove();
    const pageData = state.pages[pageIdx];
    if (pageData && pageData.widgets) {
      pageData.widgets = pageData.widgets.filter(w => w.id !== note.id);
    }
    showToast('✓ Sticky note deleted', 'info', 1500);
  });

  header.appendChild(title);
  header.appendChild(btnDel);

  const textarea = document.createElement('textarea');
  textarea.className = 'sticky-textarea';
  textarea.placeholder = 'Type a note…';
  textarea.value = note.text || '';
  textarea.addEventListener('input', () => {
    note.text = textarea.value;
  });

  card.appendChild(header);
  card.appendChild(textarea);

  el.appendChild(badge);
  el.appendChild(card);

  // Toggle card on badge click
  badge.addEventListener('click', (e) => {
    e.stopPropagation();
    card.classList.toggle('hidden');
    if (!card.classList.contains('hidden')) {
      textarea.focus();
    }
  });

  // Drag note badge to move
  badge.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const initX = note.x;
    const initY = note.y;

    const onMove = (ev) => {
      note.x = Math.max(0, initX + (ev.clientX - startX));
      note.y = Math.max(0, initY + (ev.clientY - startY));
      el.style.left = `${note.x}px`;
      el.style.top  = `${note.y}px`;
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });

  wrapper.appendChild(el);
  setTimeout(() => textarea.focus(), 50);
}

// ─── SIGNATURE MODAL CONTROLLER ───────────────────────────────────────────────
let sigPadCtx = null;
let isSigDrawing = false;
let sigLastX = 0, sigLastY = 0;
let selectedSigTab = 'draw';
let selectedSigFont = 'Dancing Script';
let sigInkColor = '#000000';
let uploadedSigDataUrl = null;

function resizeSigPad() {
  if (!$sigPadCanvas) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = $sigPadCanvas.getBoundingClientRect();
  const w = rect.width > 0 ? rect.width : 520;
  const h = rect.height > 0 ? rect.height : 180;
  $sigPadCanvas.width = Math.round(w * dpr);
  $sigPadCanvas.height = Math.round(h * dpr);
  sigPadCtx = $sigPadCanvas.getContext('2d');
  sigPadCtx.scale(dpr, dpr);
}

function initSignatureModal() {
  if (!$sigPadCanvas) return;

  resizeSigPad();

  $sigPadCanvas.addEventListener('pointerdown', (e) => {
    isSigDrawing = true;
    $sigPadCanvas.setPointerCapture(e.pointerId);
    const r = $sigPadCanvas.getBoundingClientRect();
    sigLastX = e.clientX - r.left;
    sigLastY = e.clientY - r.top;
    sigPadCtx.beginPath();
    sigPadCtx.moveTo(sigLastX, sigLastY);
  });

  $sigPadCanvas.addEventListener('pointermove', (e) => {
    if (!isSigDrawing) return;
    const r = $sigPadCanvas.getBoundingClientRect();
    const curX = e.clientX - r.left;
    const curY = e.clientY - r.top;

    sigPadCtx.strokeStyle = sigInkColor;
    sigPadCtx.lineWidth = 2.5;
    sigPadCtx.lineCap = 'round';
    sigPadCtx.lineJoin = 'round';

    const midX = (sigLastX + curX) / 2;
    const midY = (sigLastY + curY) / 2;
    sigPadCtx.quadraticCurveTo(sigLastX, sigLastY, midX, midY);
    sigPadCtx.stroke();

    sigLastX = curX;
    sigLastY = curY;
  });

  const stopSigDraw = () => {
    if (!isSigDrawing) return;
    isSigDrawing = false;
    sigPadCtx.lineTo(sigLastX, sigLastY);
    sigPadCtx.stroke();
  };
  $sigPadCanvas.addEventListener('pointerup', stopSigDraw);
  $sigPadCanvas.addEventListener('pointercancel', stopSigDraw);

  $btnClearSigPad?.addEventListener('click', clearSigPad);

  document.querySelectorAll('.sig-color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      sigInkColor = dot.dataset.color;
      document.querySelectorAll('.sig-color-dot').forEach(d => d.classList.toggle('active', d === dot));
    });
  });

  $tabSigDraw?.addEventListener('click', () => switchSigTab('draw'));
  $tabSigType?.addEventListener('click', () => switchSigTab('type'));
  $tabSigUpload?.addEventListener('click', () => switchSigTab('upload'));

  document.querySelectorAll('.sig-font-card').forEach(card => {
    card.addEventListener('click', () => {
      selectedSigFont = card.dataset.font;
      document.querySelectorAll('.sig-font-card').forEach(c => c.classList.toggle('active', c === card));
    });
  });

  $sigTypeInput?.addEventListener('input', () => {
    const text = $sigTypeInput.value.trim() || 'Your Signature';
    document.querySelectorAll('.sig-preview-text').forEach(el => {
      el.textContent = text;
    });
  });

  $sigUploadDropzone?.addEventListener('click', () => $sigFileInput?.click());
  $sigFileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleSignatureUpload(file);
  });
  $btnRemoveUploadedSig?.addEventListener('click', (e) => {
    e.stopPropagation();
    uploadedSigDataUrl = null;
    $sigUploadPreviewWrap?.classList.add('hidden');
    $sigUploadEmpty?.classList.remove('hidden');
    if ($sigFileInput) $sigFileInput.value = '';
  });

  $btnSign?.addEventListener('click', openSignatureModal);
  $btnCloseSig?.addEventListener('click', closeSignatureModal);
  $btnCancelSig?.addEventListener('click', closeSignatureModal);
  $btnInsertSig?.addEventListener('click', insertSignature);
}

function clearSigPad() {
  if (!sigPadCtx || !$sigPadCanvas) return;
  sigPadCtx.save();
  sigPadCtx.setTransform(1, 0, 0, 1, 0, 0);
  sigPadCtx.clearRect(0, 0, $sigPadCanvas.width, $sigPadCanvas.height);
  sigPadCtx.restore();
}

function switchSigTab(tab) {
  selectedSigTab = tab;
  $tabSigDraw?.classList.toggle('active', tab === 'draw');
  $tabSigType?.classList.toggle('active', tab === 'type');
  $tabSigUpload?.classList.toggle('active', tab === 'upload');

  $paneSigDraw?.classList.toggle('hidden', tab !== 'draw');
  $paneSigType?.classList.toggle('hidden', tab !== 'type');
  $paneSigUpload?.classList.toggle('hidden', tab !== 'upload');

  if (tab === 'draw') {
    setTimeout(resizeSigPad, 50);
  }
}

function openSignatureModal() {
  $modalSig?.classList.remove('hidden');
  switchSigTab('draw');
  setTimeout(() => {
    resizeSigPad();
    clearSigPad();
  }, 50);
}

function closeSignatureModal() {
  $modalSig?.classList.add('hidden');
}

function handleSignatureUpload(file) {
  if (!file.type.startsWith('image/')) {
    showToast('Please select a valid image file', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    uploadedSigDataUrl = e.target.result;
    $sigUploadPreviewImg.src = uploadedSigDataUrl;
    $sigUploadEmpty?.classList.add('hidden');
    $sigUploadPreviewWrap?.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function insertSignature() {
  const targetPageIdx = Math.max(0, state.currentPage - 1);
  if (state.pages.length === 0) {
    showToast('Please load a PDF first', 'error');
    closeSignatureModal();
    return;
  }

  let finalDataUrl = null;
  let initW = 200;
  let initH = 80;

  if (selectedSigTab === 'draw') {
    const imgData = sigPadCtx.getImageData(0, 0, $sigPadCanvas.width, $sigPadCanvas.height);
    let hasStrokes = false;
    for (let i = 3; i < imgData.data.length; i += 4) {
      if (imgData.data[i] > 10) { hasStrokes = true; break; }
    }
    if (!hasStrokes) {
      showToast('Please draw your signature first', 'info');
      return;
    }
    finalDataUrl = $sigPadCanvas.toDataURL('image/png');
  } else if (selectedSigTab === 'type') {
    const text = ($sigTypeInput?.value || '').trim() || 'Signature';
    const offCanvas = document.createElement('canvas');
    offCanvas.width = 600;
    offCanvas.height = 200;
    const offCtx = offCanvas.getContext('2d');
    offCtx.font = `64px "${selectedSigFont}", cursive`;
    offCtx.fillStyle = sigInkColor;
    offCtx.textBaseline = 'middle';
    offCtx.fillText(text, 20, 100);
    finalDataUrl = offCanvas.toDataURL('image/png');
    initW = 220;
    initH = 75;
  } else if (selectedSigTab === 'upload') {
    if (!uploadedSigDataUrl) {
      showToast('Please upload a signature image first', 'info');
      return;
    }
    finalDataUrl = uploadedSigDataUrl;
  }

  if (finalDataUrl) {
    createWidget({
      type: 'signature',
      pageIdx: targetPageIdx,
      dataUrl: finalDataUrl,
      width: initW,
      height: initH,
    });
    closeSignatureModal();
    showToast('✓ Signature placed on Page ' + (targetPageIdx + 1), 'success', 2500);
  }
}

// ─── IMAGE INSERTION ──────────────────────────────────────────────────────────
if ($btnImage && $imageFileInput) {
  $btnImage.addEventListener('click', () => {
    if (state.pages.length === 0) {
      showToast('Please load a PDF first', 'error');
      return;
    }
    $imageFileInput.click();
  });

  $imageFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      const img = new Image();
      img.onload = () => {
        const targetPageIdx = Math.max(0, state.currentPage - 1);
        const maxW = 260;
        const w = Math.min(maxW, img.width || maxW);
        const h = w * (img.height / (img.width || 1));

        createWidget({
          type: 'image',
          pageIdx: targetPageIdx,
          dataUrl,
          width: Math.round(w),
          height: Math.round(h),
        });
        showToast(`✓ Image inserted on Page ${targetPageIdx + 1}`, 'success', 2000);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    $imageFileInput.value = '';
  });
}

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

  // Resize button
  const btnRes = document.createElement('button');
  btnRes.className = 'thumb-act-btn';
  btnRes.title = 'Resize page dimensions';
  btnRes.setAttribute('aria-label', `Resize page ${idx + 1}`);
  btnRes.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
  btnRes.addEventListener('click', (e) => {
    e.stopPropagation();
    openResizeModal(idx);
  });

  actions.appendChild(btnRot);
  actions.appendChild(btnRes);
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

// ─── MERGE PDF CONTROLLER ───────────────────────────────────────────────────
let pendingMergeBytes = null;
let pendingMergeDoc = null;
let pendingMergeFileName = '';

function initMergeModal() {
  if (!$modalMerge) return;

  $btnMerge?.addEventListener('click', openMergeModal);
  $btnMergeSidebar?.addEventListener('click', openMergeModal);
  $btnCloseMerge?.addEventListener('click', closeMergeModal);
  $btnCancelMerge?.addEventListener('click', closeMergeModal);

  $mergeUploadZone?.addEventListener('click', () => $mergeFileInput?.click());

  $mergeFileInput?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) await handleMergeFile(file);
  });

  $btnChangeMergeFile?.addEventListener('click', (e) => {
    e.stopPropagation();
    resetMergeFile();
    $mergeFileInput?.click();
  });

  // Drag & drop on upload zone
  $mergeUploadZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    $mergeUploadZone.classList.add('dragover');
  });
  $mergeUploadZone?.addEventListener('dragleave', () => {
    $mergeUploadZone.classList.remove('dragover');
  });
  $mergeUploadZone?.addEventListener('drop', async (e) => {
    e.preventDefault();
    $mergeUploadZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.name.toLowerCase().endsWith('.pdf')) {
      await handleMergeFile(file);
    } else {
      showToast('Please select a valid PDF file to merge', 'error');
    }
  });

  // Radio selection highlighting
  document.querySelectorAll('input[name="merge-pos"]').forEach(radio => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('.merge-radio-card').forEach(card => {
        const r = card.querySelector('input[type="radio"]');
        card.classList.toggle('active', r && r.checked);
      });
    });
  });

  $btnConfirmMerge?.addEventListener('click', insertMergedPages);
}

function openMergeModal() {
  if (state.pages.length === 0) {
    showToast('Please open or create a document first', 'error');
    return;
  }
  resetMergeFile();
  if ($mergeEndPageNum) $mergeEndPageNum.textContent = state.pages.length;
  if ($mergeCurrentPageNum) $mergeCurrentPageNum.textContent = state.currentPage;
  $modalMerge?.classList.remove('hidden');
}

function closeMergeModal() {
  $modalMerge?.classList.add('hidden');
  resetMergeFile();
}

function resetMergeFile() {
  pendingMergeBytes = null;
  pendingMergeDoc = null;
  pendingMergeFileName = '';
  if ($mergeFileInput) $mergeFileInput.value = '';
  $mergeUploadEmpty?.classList.remove('hidden');
  $mergeFilePreview?.classList.add('hidden');
  if ($btnConfirmMerge) $btnConfirmMerge.disabled = true;
}

async function handleMergeFile(file) {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    showToast('Please select a valid PDF document', 'error');
    return;
  }
  try {
    showLoading('Inspecting PDF…', 'Reading file headers and pages…', 20);
    const arrayBuffer = await file.arrayBuffer();
    pendingMergeBytes = new Uint8Array(arrayBuffer);
    pendingMergeFileName = file.name;

    // Parse with PDF.js
    pendingMergeDoc = await pdfjsLib.getDocument({ data: pendingMergeBytes.slice(0) }).promise;

    if ($mergeFileName) $mergeFileName.textContent = file.name;
    if ($mergeFilePages) $mergeFilePages.textContent = `${pendingMergeDoc.numPages} page${pendingMergeDoc.numPages > 1 ? 's' : ''} ready to merge`;

    $mergeUploadEmpty?.classList.add('hidden');
    $mergeFilePreview?.classList.remove('hidden');
    if ($btnConfirmMerge) $btnConfirmMerge.disabled = false;

    hideLoading();
    showToast(`✓ Found ${pendingMergeDoc.numPages} pages in ${file.name}`, 'info', 2000);
  } catch (err) {
    hideLoading();
    showToast(`Failed to read PDF: ${err.message}`, 'error', 3500);
    resetMergeFile();
  }
}

async function insertMergedPages() {
  if (!pendingMergeDoc || !pendingMergeBytes) return;

  const numToMerge = pendingMergeDoc.numPages;
  const posRadio = document.querySelector('input[name="merge-pos"]:checked');
  const pos = posRadio ? posRadio.value : 'end';

  let insertIdx = state.pages.length;
  if (pos === 'start') {
    insertIdx = 0;
  } else if (pos === 'current') {
    insertIdx = Math.min(state.currentPage, state.pages.length);
  }

  closeMergeModal();
  showLoading('Merging PDF…', `Importing ${numToMerge} pages…`, 10);

  try {
    const importedPages = [];

    for (let i = 1; i <= numToMerge; i++) {
      const progress = 10 + (i / numToMerge) * 75;
      setProgress(progress);
      $loadingSub.textContent = `Extracting page ${i} of ${numToMerge}…`;

      const pdfPage = await pendingMergeDoc.getPage(i);
      const textContent = await pdfPage.getTextContent({ normalizeWhitespace: true });

      const textItems = textContent.items.map((item, itemIdx) => {
        if (!item.str || item.str.trim() === '') return null;
        const tx = item.transform;
        const fontSize = Math.hypot(tx[2], tx[3]) || Math.hypot(tx[0], tx[1]);
        const angle = Math.atan2(tx[1], tx[0]);

        return {
          id: `page-m-${Date.now()}-${i}-${itemIdx}`,
          page: 0,
          text: item.str,
          originalText: item.str,
          fontSize: fontSize || 12,
          fontName: item.fontName || 'Helvetica',
          angle,
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

      importedPages.push({
        pdfPage,
        textItems,
        pageNum: 0,
        originalIndex: i - 1,
        rotation: 0,
        isNewPage: false,
        sourcePdfData: pendingMergeBytes,
        width: unscaledVp.width,
        height: unscaledVp.height,
        wrapper: null,
        canvas: null,
        textLayerEl: null,
        annotCanvas: null,
        annotDataUrl: null,
        widgets: [],
        viewport: null,
      });
    }

    // Insert imported pages into state.pages at insertIdx
    state.pages.splice(insertIdx, 0, ...importedPages);

    setProgress(90);
    $loadingSub.textContent = 'Rendering merged document…';

    // Full refresh of page numbering, thumbnails, and DOM
    await renderAllPages();
    refreshAfterPageChange(insertIdx);

    hideLoading();
    showToast(`✓ Successfully merged ${numToMerge} page${numToMerge > 1 ? 's' : ''}!`, 'success', 3500);

  } catch (err) {
    hideLoading();
    showToast(`Merge error: ${err.message}`, 'error', 3500);
    console.error('Merge error:', err);
  }
}

// ─── RESIZE PDF CONTROLLER ──────────────────────────────────────────────────
const PRESET_DIMS = {
  a4:     { w: 595.28, h: 841.89, name: 'A4' },
  letter: { w: 612,    h: 792,    name: 'US Letter' },
  legal:  { w: 612,    h: 1008,   name: 'US Legal' },
  a3:     { w: 841.89, h: 1190.55,name: 'A3' },
  a5:     { w: 419.53, h: 595.28, name: 'A5' },
};

let resizeState = {
  preset: 'a4',
  customW: 595,
  customH: 842,
  orientation: 'portrait',
  scope: 'all',
  scaleMode: 'fit',
  targetPageIdx: null,
};

function initResizeModal() {
  if (!$modalResize) return;

  $btnResize?.addEventListener('click', () => openResizeModal());
  $btnCloseResize?.addEventListener('click', closeResizeModal);
  $btnCancelResize?.addEventListener('click', closeResizeModal);

  // Preset chips
  document.querySelectorAll('.resize-preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.resize-preset-chip').forEach(c => c.classList.toggle('active', c === chip));
      resizeState.preset = chip.dataset.preset;
      const isCustom = resizeState.preset === 'custom';
      $resizeCustomRow?.classList.toggle('hidden', !isCustom);
      updateResizeSummary();
    });
  });

  // Custom inputs
  $resizeCustomW?.addEventListener('input', () => {
    resizeState.customW = parseFloat($resizeCustomW.value) || 595;
    updateResizeSummary();
  });
  $resizeCustomH?.addEventListener('input', () => {
    resizeState.customH = parseFloat($resizeCustomH.value) || 842;
    updateResizeSummary();
  });

  // Orientation toggle
  $btnOrientPortrait?.addEventListener('click', () => {
    resizeState.orientation = 'portrait';
    $btnOrientPortrait.classList.add('active');
    $btnOrientLandscape.classList.remove('active');
    updateResizeSummary();
  });
  $btnOrientLandscape?.addEventListener('click', () => {
    resizeState.orientation = 'landscape';
    $btnOrientLandscape.classList.add('active');
    $btnOrientPortrait.classList.remove('active');
    updateResizeSummary();
  });

  // Scope toggle
  $btnScopeAll?.addEventListener('click', () => {
    resizeState.scope = 'all';
    $btnScopeAll.classList.add('active');
    $btnScopeCurrent.classList.remove('active');
  });
  $btnScopeCurrent?.addEventListener('click', () => {
    resizeState.scope = 'current';
    $btnScopeCurrent.classList.add('active');
    $btnScopeAll.classList.remove('active');
  });

  // Scale mode radio cards
  document.querySelectorAll('input[name="scale-mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('.scale-radio').forEach(card => {
        const r = card.querySelector('input[type="radio"]');
        card.classList.toggle('active', r && r.checked);
      });
      resizeState.scaleMode = radio.value;
    });
  });

  $btnApplyResize?.addEventListener('click', applyPageResize);
}

function openResizeModal(targetIdx = null) {
  if (state.pages.length === 0) {
    showToast('Please open a document first', 'error');
    return;
  }

  resizeState.targetPageIdx = targetIdx;
  if (targetIdx !== null) {
    resizeState.scope = 'current';
    $btnScopeCurrent?.classList.add('active');
    $btnScopeAll?.classList.remove('active');
  } else {
    resizeState.scope = 'all';
    $btnScopeAll?.classList.add('active');
    $btnScopeCurrent?.classList.remove('active');
  }

  updateResizeSummary();
  $modalResize?.classList.remove('hidden');
}

function closeResizeModal() {
  $modalResize?.classList.add('hidden');
}

function getTargetDimensions() {
  let w, h, name;
  if (resizeState.preset === 'custom') {
    w = resizeState.customW;
    h = resizeState.customH;
    name = 'Custom';
  } else {
    const p = PRESET_DIMS[resizeState.preset] || PRESET_DIMS.a4;
    w = p.w;
    h = p.h;
    name = p.name;
  }

  // Handle landscape/portrait
  if (resizeState.orientation === 'landscape' && w < h) {
    const tmp = w; w = h; h = tmp;
  } else if (resizeState.orientation === 'portrait' && w > h) {
    const tmp = w; w = h; h = tmp;
  }

  return { w: Math.round(w * 100) / 100, h: Math.round(h * 100) / 100, name };
}

function updateResizeSummary() {
  if (!$resizeTargetText) return;
  const { w, h, name } = getTargetDimensions();
  const orientStr = resizeState.orientation.charAt(0).toUpperCase() + resizeState.orientation.slice(1);
  $resizeTargetText.textContent = `${name} ${orientStr} (${Math.round(w)} × ${Math.round(h)} pt)`;
}

async function applyPageResize() {
  const { w: targetW, h: targetH, name } = getTargetDimensions();
  const targetIndices = resizeState.scope === 'current'
    ? [resizeState.targetPageIdx !== null ? resizeState.targetPageIdx : Math.max(0, state.currentPage - 1)]
    : state.pages.map((_, i) => i);

  closeResizeModal();
  showLoading('Resizing pages…', `Applying ${name} (${Math.round(targetW)}×${Math.round(targetH)} pt)…`, 30);

  try {
    for (const idx of targetIndices) {
      const pageData = state.pages[idx];
      if (!pageData) continue;

      const oldW = pageData.width || 595.28;
      const oldH = pageData.height || 841.89;
      const scaleX = targetW / oldW;
      const scaleY = targetH / oldH;

      if (resizeState.scaleMode === 'fit') {
        // Proportionally scale text blocks
        (pageData.textItems || []).forEach(it => {
          it.transform[0] *= scaleX;
          it.transform[3] *= scaleY;
          it.transform[4] *= scaleX;
          it.transform[5] *= scaleY;
          it.fontSize     *= Math.min(scaleX, scaleY);
          it.width        *= scaleX;
          it.height       *= scaleY;
          it.modified = true;
        });

        // Proportionally scale widgets (signatures, images, notes)
        (pageData.widgets || []).forEach(w => {
          w.x      = Math.round(w.x * scaleX);
          w.y      = Math.round(w.y * scaleY);
          w.width  = Math.round((w.width || 180) * scaleX);
          w.height = Math.round((w.height || 80) * scaleY);
        });

        pageData.resized = {
          targetW,
          targetH,
          scaleX,
          scaleY,
          mode: 'fit',
        };
      } else {
        pageData.resized = {
          targetW,
          targetH,
          mode: 'canvas',
        };
      }

      pageData.width = targetW;
      pageData.height = targetH;
    }

    setProgress(80);
    $loadingSub.textContent = 'Updating view…';

    // Re-render pages and thumbnails
    await renderAllPages();
    refreshAfterPageChange(targetIndices[0]);

    hideLoading();
    const count = targetIndices.length;
    showToast(`✓ Resized ${count} page${count > 1 ? 's' : ''} to ${name} (${Math.round(targetW)}×${Math.round(targetH)} pt)!`, 'success', 3500);

  } catch (err) {
    hideLoading();
    showToast(`Resize error: ${err.message}`, 'error', 3500);
    console.error('Resize error:', err);
  }
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

  const totalTextMods = state.pages.reduce((n, p) =>
    n + (p.textItems ? p.textItems.filter(it => it.modified).length : 0), 0);
  const totalWidgetMods = state.pages.reduce((n, p) =>
    n + (p.widgets ? p.widgets.length : 0), 0);
  const totalAnnotMods = state.pages.reduce((n, p) =>
    n + (p.annotDataUrl ? 1 : 0), 0);
  const totalMods = totalTextMods + totalWidgetMods + totalAnnotMods;

  showLoading('Saving PDF…', 'Initializing document builder…', 8);

  try {
    const { PDFDocument, rgb, StandardFonts, degrees } = PDFLib;

    // ── 1. Fresh output document ──────────────────────────────────────────────
    const outDoc = await PDFDocument.create();

    // Cache of loaded source PDFDocuments (supports multiple merged PDFs)
    const sourceDocsMap = new Map();
    if (state.pdfData) {
      try {
        const doc = await PDFDocument.load(state.pdfData, {
          ignoreEncryption: true,
          updateMetadata: false,
        });
        sourceDocsMap.set(state.pdfData, doc);
      } catch (e) {
        console.warn('Failed to load main sourceDoc:', e);
      }
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

      const srcBytes = pageData.sourcePdfData || state.pdfData;
      let pageSourceDoc = null;
      if (srcBytes) {
        if (!sourceDocsMap.has(srcBytes)) {
          try {
            const doc = await PDFDocument.load(srcBytes, {
              ignoreEncryption: true,
              updateMetadata: false,
            });
            sourceDocsMap.set(srcBytes, doc);
          } catch (e) {
            console.warn('Failed to load page source document:', e);
          }
        }
        pageSourceDoc = sourceDocsMap.get(srcBytes);
      }

      if (!pageData.isNewPage && pageSourceDoc && pageData.originalIndex != null) {
        if (pageData.resized && pageData.resized.mode === 'fit') {
          // Fit & Scale Content: create target-sized page and embed source page
          const targetW = pageData.width;
          const targetH = pageData.height;
          libPage = outDoc.addPage([targetW, targetH]);
          try {
            const [srcPage] = await outDoc.copyPages(pageSourceDoc, [pageData.originalIndex]);
            const embeddedPage = await outDoc.embedPage(srcPage);
            libPage.drawPage(embeddedPage, {
              x: 0,
              y: 0,
              width: targetW,
              height: targetH,
            });
          } catch (scaleErr) {
            console.warn('Failed to embed scaled page, falling back to setSize:', scaleErr);
            libPage.setSize(targetW, targetH);
          }
        } else {
          // Copy original page from source document
          const [copiedPage] = await outDoc.copyPages(pageSourceDoc, [pageData.originalIndex]);
          libPage = outDoc.addPage(copiedPage);
          if (pageData.resized) {
            libPage.setSize(pageData.width, pageData.height);
          }
        }
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
      for (const item of (pageData.textItems || [])) {
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

      const { width: pW, height: pH } = libPage.getSize();
      const scale = (pageData.viewport && pageData.viewport.scale) ? pageData.viewport.scale : state.zoom;
      const rotAngle = (libPage.getRotation().angle || 0) % 360;

      // ── Embed freehand drawing / highlighter canvas ───────────────
      if (pageData.annotDataUrl) {
        try {
          const annotBytes = dataUrlToUint8Array(pageData.annotDataUrl);
          const annotImg = await outDoc.embedPng(annotBytes);

          if (rotAngle === 90) {
            libPage.drawImage(annotImg, {
              x: pW,
              y: 0,
              width: pH,
              height: pW,
              rotate: degrees(90),
            });
          } else if (rotAngle === 180) {
            libPage.drawImage(annotImg, {
              x: pW,
              y: pH,
              width: pW,
              height: pH,
              rotate: degrees(180),
            });
          } else if (rotAngle === 270) {
            libPage.drawImage(annotImg, {
              x: 0,
              y: pH,
              width: pH,
              height: pW,
              rotate: degrees(270),
            });
          } else {
            libPage.drawImage(annotImg, {
              x: 0,
              y: 0,
              width: pW,
              height: pH,
            });
          }
        } catch (annotErr) {
          console.warn('Failed to embed freehand annotations on page ' + (i + 1), annotErr);
        }
      }

      // ── Embed widgets (signatures, images, sticky notes) ───────────
      const widgets = pageData.widgets || [];
      for (const w of widgets) {
        if (w.type === 'sticky') {
          try {
            const noteW = Math.max(120, Math.min(180, (w.text || '').length * 6));
            const noteH = 60;
            const nx = Math.min(pW - noteW - 10, Math.max(10, w.x / scale));
            const ny = Math.max(10, Math.min(pH - noteH - 10, pH - ((w.y / scale) + noteH)));

            // Note background (warm yellow)
            libPage.drawRectangle({
              x: nx,
              y: ny,
              width: noteW,
              height: noteH,
              color: rgb(254 / 255, 240 / 255, 138 / 255),
              borderColor: rgb(234 / 255, 179 / 255, 8 / 255),
              borderWidth: 1,
            });

            // Note header stripe
            libPage.drawRectangle({
              x: nx,
              y: ny + noteH - 14,
              width: noteW,
              height: 14,
              color: rgb(253 / 255, 224 / 255, 71 / 255),
            });

            libPage.drawText('Note', {
              x: nx + 6,
              y: ny + noteH - 11,
              size: 8,
              font: fonts.bold,
              color: rgb(113 / 255, 63 / 255, 18 / 255),
            });

            // Note body text
            if (w.text) {
              const cleanText = w.text.replace(/[^\x20-\x7E\n]/g, ' ');
              const lines = cleanText.split('\n').slice(0, 4);
              let lineY = ny + noteH - 25;
              for (const line of lines) {
                if (lineY < ny + 6) break;
                const truncated = line.length > 28 ? line.substring(0, 25) + '...' : line;
                libPage.drawText(truncated, {
                  x: nx + 6,
                  y: lineY,
                  size: 8,
                  font: fonts.regular,
                  color: rgb(30 / 255, 41 / 255, 59 / 255),
                });
                lineY -= 10;
              }
            }
          } catch (stickyErr) {
            console.warn('Failed to draw sticky note on page ' + (i + 1), stickyErr);
          }
        } else if (w.dataUrl) {
          try {
            const imgBytes = dataUrlToUint8Array(w.dataUrl);
            const isJpg = w.dataUrl.startsWith('data:image/jpeg') || w.dataUrl.startsWith('data:image/jpg');
            const embeddedImg = isJpg
              ? await outDoc.embedJpg(imgBytes)
              : await outDoc.embedPng(imgBytes);

            const sw = (w.width || 180) / scale;
            const sh = (w.height || 80) / scale;
            const sx = (w.x || 0) / scale;
            const sy = (w.y || 0) / scale;

            let wx = sx;
            let wy = pH - (sy + sh);
            let rotateVal = undefined;

            if (rotAngle === 90) {
              wx = sy + sh;
              wy = sx;
              rotateVal = degrees(-90);
            } else if (rotAngle === 180) {
              wx = pW - sx;
              wy = sy + sh;
              rotateVal = degrees(-180);
            } else if (rotAngle === 270) {
              wx = pW - sy;
              wy = pH - sx;
              rotateVal = degrees(-270);
            }

            libPage.drawImage(embeddedImg, {
              x: wx,
              y: wy,
              width: sw,
              height: sh,
              rotate: rotateVal,
            });
          } catch (imgErr) {
            console.warn('Failed to embed widget image on page ' + (i + 1), imgErr);
          }
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
      ? `✓ Saved ${state.pages.length} page${state.pages.length > 1 ? 's' : ''}! (${totalMods} modification${totalMods > 1 ? 's' : ''})`
      : `✓ Saved ${state.pages.length} page${state.pages.length > 1 ? 's' : ''}!`;
    showToast(msg, 'success', 5000);

  } catch (err) {
    hideLoading();
    showToast(`Export error: ${err.message}`, 'error');
    console.error('PDF export error:', err);
  }
}

$btnSave.addEventListener('click', exportPdf);


// ─── THEME CONTROLLER ────────────────────────────────────────────────────────
const THEME_KEY = 'pdf_editor_theme';

function getCurrentTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return 'light'; // Default is Light mode
}

function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    if ($btnThemeLanding) {
      const icon = $btnThemeLanding.querySelector('.theme-icon');
      const label = $btnThemeLanding.querySelector('.theme-label');
      if (icon) icon.textContent = '🌙';
      if (label) label.textContent = 'Dark Mode';
    }
    if ($editorThemeIcon) {
      $editorThemeIcon.textContent = '🌙';
      if ($btnThemeEditor) $btnThemeEditor.title = 'Switch to Dark theme';
    }
  } else {
    document.documentElement.removeAttribute('data-theme');
    if ($btnThemeLanding) {
      const icon = $btnThemeLanding.querySelector('.theme-icon');
      const label = $btnThemeLanding.querySelector('.theme-label');
      if (icon) icon.textContent = '☀️';
      if (label) label.textContent = 'Light Mode';
    }
    if ($editorThemeIcon) {
      $editorThemeIcon.textContent = '☀️';
      if ($btnThemeEditor) $btnThemeEditor.title = 'Switch to Light theme';
    }
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  const next = current === 'light' ? 'dark' : 'light';
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
  showToast(`Switched to ${next === 'light' ? 'Light' : 'Dark'} mode`, 'info', 1500);
}

function initTheme() {
  const initialTheme = getCurrentTheme();
  applyTheme(initialTheme);

  $btnThemeLanding?.addEventListener('click', toggleTheme);
  $btnThemeEditor?.addEventListener('click', toggleTheme);
}


// ─── HELP MODAL CONTROLLER ───────────────────────────────────────────────────
function openHelpModal() {
  if ($modalHelp) {
    $modalHelp.classList.remove('hidden');
  }
}

function closeHelpModal() {
  if ($modalHelp) {
    $modalHelp.classList.add('hidden');
  }
}

function initHelpModal() {
  $btnHelp?.addEventListener('click', openHelpModal);
  $btnCloseHelp?.addEventListener('click', closeHelpModal);
  $btnDismissHelp?.addEventListener('click', closeHelpModal);
  $modalHelp?.addEventListener('click', (e) => {
    if (e.target === $modalHelp) closeHelpModal();
  });
}


// ─── INIT ─────────────────────────────────────────────────────────────────────
(function init() {
  $zoomLabel.textContent = '100%';
  hideLoading();
  initTheme();
  initHelpModal();
  initSignatureModal();
  initMergeModal();
  initResizeModal();

  // Set up page scroll observer after a short delay
  const observer = new MutationObserver(() => {
    if (document.querySelectorAll('.page-wrapper').length > 0) {
      setupPageObserver();
      observer.disconnect();
    }
  });
  observer.observe($pagesContainer, { childList: true });
})();
