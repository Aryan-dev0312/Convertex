/**
 * ============================================================================
 * ConvertX – Web-Based File Converter & PDF/Image Toolkit
 * JavaScript Engine (Pure Vanilla JS, 100% Client-Side)
 * ============================================================================
 * 
 * Architecture Overview:
 * 1. ConvertX Core: State management, theme toggle, notifications, and navigation
 * 2. File Handling: Drag & drop, validation, staging, and thumbnail rendering
 * 3. PDF Operations: Powered by pdf-lib and Mozilla's pdf.js
 * 4. Image Processing: Powered by Canvas API, browser-image-compression & JSZip
 * 5. Utility Generators: Base64 encoder/decoder, QR Code generator, Text to PDF
 */

'use strict';

// Safe PDF.js worker setup
if (typeof window !== 'undefined' && window.pdfjsLib) {
  try {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  } catch (e) {
    console.warn('PDF.js worker initialization notice:', e);
  }
}

// Standard Page Sizes in PostScript points (1 pt = 1/72 inch)
const PAGE_SIZES = {
  a4: [595.28, 841.89],
  letter: [612.0, 792.0]
};

/* ============================================================================
   Global Application State
   ============================================================================ */
const ConvertX = {
  // Current active tool key (null when in gallery view)
  activeTool: null,

  // Staged files for processing
  stagedFiles: [],

  // Metadata for PDF pages (for page-level tools like reorder, remove, rotate)
  pdfPagesData: [],

  // Holds original ArrayBuffer of active PDF document
  currentPdfBuffer: null,

  // Holds loaded PDFLib document instance
  currentPdfDoc: null,

  // Generated result blob ready for download
  resultBlob: null,
  resultFileName: 'download',

  // Tool definitions registry
  tools: {
    'img-to-pdf': {
      title: 'JPG / PNG to PDF',
      desc: 'Convert multiple images into a single organized PDF with custom page size and orientation.',
      icon: 'fa-images',
      badge: 'PDF',
      category: 'pdf',
      accepts: '.jpg,.jpeg,.png,.webp',
      multiple: true,
      maxSizeMB: 50,
      processBtnText: 'Convert Images to PDF'
    },
    'merge-pdf': {
      title: 'Merge PDF',
      desc: 'Combine multiple PDF documents into a single consolidated PDF in any order you choose.',
      icon: 'fa-object-group',
      badge: 'PDF',
      category: 'pdf',
      accepts: '.pdf',
      multiple: true,
      maxSizeMB: 100,
      processBtnText: 'Merge All PDFs'
    },
    'remove-pages': {
      title: 'Remove Pages from PDF',
      desc: 'Select unwanted pages from visual thumbnails or enter page ranges (e.g., 2, 4-6) to remove.',
      icon: 'fa-file-circle-minus',
      badge: 'PDF',
      category: 'pdf',
      accepts: '.pdf',
      multiple: false,
      maxSizeMB: 100,
      processBtnText: 'Remove Selected Pages'
    },
    'compress-image': {
      title: 'Compress Image',
      desc: 'Reduce image file size with an adjustable quality slider and real-time savings counter.',
      icon: 'fa-file-zipper',
      badge: 'Image',
      category: 'image',
      accepts: '.jpg,.jpeg,.png,.webp',
      multiple: true,
      maxSizeMB: 40,
      processBtnText: 'Compress Images'
    },
    'pdf-to-img': {
      title: 'PDF to JPG / PNG',
      desc: 'Render high-resolution JPG or PNG images from each PDF page and download individually or as a ZIP.',
      icon: 'fa-file-image',
      badge: 'PDF',
      category: 'pdf',
      accepts: '.pdf',
      multiple: false,
      maxSizeMB: 100,
      processBtnText: 'Render Pages to Images'
    },
    'split-pdf': {
      title: 'Split PDF',
      desc: 'Extract specific page ranges or extract every page into separate individual PDF files.',
      icon: 'fa-scissors',
      badge: 'PDF',
      category: 'pdf',
      accepts: '.pdf',
      multiple: false,
      maxSizeMB: 100,
      processBtnText: 'Split & Extract PDF'
    },
    'rotate-pdf': {
      title: 'Rotate PDF Pages',
      desc: 'Rotate individual pages or the entire document by 90°, 180°, or 270° clockwise with live visual feedback.',
      icon: 'fa-rotate',
      badge: 'PDF',
      category: 'pdf',
      accepts: '.pdf',
      multiple: false,
      maxSizeMB: 100,
      processBtnText: 'Apply Rotations & Save'
    },
    'reorder-pdf': {
      title: 'Reorder PDF Pages',
      desc: 'Rearrange PDF pages seamlessly with intuitive drag-and-drop thumbnail cards.',
      icon: 'fa-arrow-down-1-9',
      badge: 'PDF',
      category: 'pdf',
      accepts: '.pdf',
      multiple: false,
      maxSizeMB: 100,
      processBtnText: 'Save Reordered PDF'
    },
    'convert-img': {
      title: 'Image Format Converter',
      desc: 'Convert single or batch images seamlessly between JPG, PNG, and WEBP formats.',
      icon: 'fa-arrows-split-up-and-left',
      badge: 'Image',
      category: 'image',
      accepts: '.jpg,.jpeg,.png,.webp,.gif,.bmp',
      multiple: true,
      maxSizeMB: 50,
      processBtnText: 'Convert Image Formats'
    },
    'resize-img': {
      title: 'Resize Image',
      desc: 'Scale images by specific pixel dimensions or percentage while maintaining aspect ratio.',
      icon: 'fa-up-right-and-down-left-from-center',
      badge: 'Image',
      category: 'image',
      accepts: '.jpg,.jpeg,.png,.webp',
      multiple: false,
      maxSizeMB: 50,
      processBtnText: 'Resize Image'
    },
    'watermark-pdf': {
      title: 'Add Watermark to PDF',
      desc: 'Stamp custom text watermarks across pages with controllable opacity, rotation, and colors.',
      icon: 'fa-stamp',
      badge: 'PDF',
      category: 'pdf',
      accepts: '.pdf',
      multiple: false,
      maxSizeMB: 100,
      processBtnText: 'Apply Watermark to PDF'
    },
    'page-numbers-pdf': {
      title: 'Add Page Numbers to PDF',
      desc: 'Insert formatted page numbers (e.g. Page X of Y) into your PDF with custom position and font sizing.',
      icon: 'fa-hashtag',
      badge: 'PDF',
      category: 'pdf',
      accepts: '.pdf',
      multiple: false,
      maxSizeMB: 100,
      processBtnText: 'Add Page Numbers'
    },
    'text-to-pdf': {
      title: 'Text to PDF',
      desc: 'Type, paste or load a text document to generate a cleanly styled, paginated PDF.',
      icon: 'fa-file-lines',
      badge: 'Utility',
      category: 'utility',
      accepts: '.txt',
      multiple: false,
      maxSizeMB: 10,
      processBtnText: 'Generate PDF from Text'
    },
    'qr-base64': {
      title: 'Base64 & QR Code Generator',
      desc: 'Encode images into Base64 / Data URIs and generate high-resolution QR codes from text or links.',
      icon: 'fa-qrcode',
      badge: 'Utility',
      category: 'utility',
      accepts: '.jpg,.jpeg,.png,.webp,.svg',
      multiple: false,
      maxSizeMB: 20,
      processBtnText: 'Generate Output'
    }
  }
};

// Bind to window object for reliable HTML access
window.ConvertX = ConvertX;

/* ============================================================================
   Initialization & Event Listeners
   ============================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNavigation();
  initToolSearchAndFilters();
  initToolCards();
  initWorkspaceCore();
  initDragAndDrop();
});

/**
 * Initialize Light/Dark Theme based on localStorage or user system preference
 */
function initTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  const savedTheme = localStorage.getItem('convertx_theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('convertx_theme', newTheme);
      showToast(`Switched to ${newTheme} mode`, 'info');
    });
  }
}

/**
 * Initialize Navigation, Sticky Header, Mobile Menu & Smooth Scrolling
 */
function initNavigation() {
  const mobileBtn = document.getElementById('mobile-menu-btn');
  const navLinks = document.getElementById('nav-links');
  const backToTopBtn = document.getElementById('back-to-top');

  // Mobile drawer toggle
  if (mobileBtn && navLinks) {
    mobileBtn.addEventListener('click', () => {
      navLinks.classList.toggle('mobile-open');
      const expanded = navLinks.classList.contains('mobile-open');
      mobileBtn.setAttribute('aria-expanded', expanded);
    });

    // Close mobile menu on link click
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('mobile-open');
        mobileBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Back to Top button
  if (backToTopBtn) {
    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Update current year in footer
  const yearElem = document.getElementById('current-year');
  if (yearElem) {
    yearElem.textContent = new Date().getFullYear();
  }

  // Active section indicator on scroll
  const sections = document.querySelectorAll('section[id], header[id]');
  window.addEventListener('scroll', () => {
    let scrollY = window.pageYOffset;
    sections.forEach(current => {
      const sectionHeight = current.offsetHeight;
      const sectionTop = current.offsetTop - 120;
      const sectionId = current.getAttribute('id');
      const navItem = document.querySelector(`.nav-links a[href*="${sectionId}"]`);
      if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
        if (navItem) {
          document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
          navItem.classList.add('active');
        }
      }
    });
  });
}

/**
 * Initialize Tool Search & Category Filter Buttons
 */
function initToolSearchAndFilters() {
  const searchInput = document.getElementById('tool-search-input');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  const categoryTabs = document.querySelectorAll('.category-tab');
  const toolCards = document.querySelectorAll('.tool-card');
  const noResults = document.getElementById('no-results');
  const countText = document.getElementById('tools-count-text');
  const resetSearchBtn = document.getElementById('reset-search-btn');

  let activeCategory = 'all';

  function filterTools() {
    const query = searchInput.value.toLowerCase().trim();
    let visibleCount = 0;

    if (query.length > 0) {
      clearSearchBtn.classList.remove('hidden');
    } else {
      clearSearchBtn.classList.add('hidden');
    }

    toolCards.forEach(card => {
      const toolId = card.getAttribute('data-tool');
      const category = card.getAttribute('data-category');
      const title = card.querySelector('.tool-card-title').textContent.toLowerCase();
      const desc = card.querySelector('.tool-card-desc').textContent.toLowerCase();

      const matchesCategory = activeCategory === 'all' || category === activeCategory;
      const matchesSearch = query === '' || title.includes(query) || desc.includes(query) || toolId.includes(query);

      if (matchesCategory && matchesSearch) {
        card.classList.remove('hidden');
        visibleCount++;
      } else {
        card.classList.add('hidden');
      }
    });

    if (visibleCount === 0) {
      if (noResults) noResults.classList.remove('hidden');
      if (countText) countText.textContent = 'No tools matched your criteria';
    } else {
      if (noResults) noResults.classList.add('hidden');
      if (countText) countText.textContent = `Showing ${visibleCount} of 14 tools`;
    }
  }

  if (searchInput) searchInput.addEventListener('input', filterTools);

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchInput.focus();
      filterTools();
    });
  }

  if (resetSearchBtn) {
    resetSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      activeCategory = 'all';
      categoryTabs.forEach(tab => {
        tab.classList.toggle('active', tab.getAttribute('data-category') === 'all');
      });
      filterTools();
    });
  }

  categoryTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      categoryTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeCategory = tab.getAttribute('data-category');
      filterTools();
    });
  });
}

/**
 * Initialize Tool Cards click & keyboard events
 */
function initToolCards() {
  const toolCards = document.querySelectorAll('.tool-card');
  toolCards.forEach(card => {
    const toolKey = card.getAttribute('data-tool');
    card.addEventListener('click', () => openTool(toolKey));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openTool(toolKey);
      }
    });
  });
}

/**
 * Initialize Workspace Core Elements
 */
function initWorkspaceCore() {
  const closeBtn = document.getElementById('close-workspace-btn');
  const resetBtn = document.getElementById('reset-tool-btn');
  const clearAllBtn = document.getElementById('clear-all-files-btn');
  const addMoreBtn = document.getElementById('add-more-files-btn');
  const processBtn = document.getElementById('process-btn');
  const convertAnotherBtn = document.getElementById('convert-another-btn');
  const fileInput = document.getElementById('file-input');

  if (closeBtn) closeBtn.addEventListener('click', closeWorkspace);
  if (resetBtn) resetBtn.addEventListener('click', resetCurrentTool);
  if (clearAllBtn) clearAllBtn.addEventListener('click', clearStagedFiles);
  if (convertAnotherBtn) convertAnotherBtn.addEventListener('click', resetCurrentTool);

  if (addMoreBtn && fileInput) {
    addMoreBtn.addEventListener('click', () => {
      fileInput.click();
    });
  }

  if (processBtn) {
    processBtn.addEventListener('click', () => {
      processActiveTool();
    });
  }
}

/* ============================================================================
   Workspace Navigation: Open & Close Tool
   ============================================================================ */

/**
 * Opens a specific tool in the workspace panel
 * @param {string} toolKey - Unique tool identifier
 */
function openTool(toolKey) {
  const tool = ConvertX.tools[toolKey];
  if (!tool) {
    showToast(`Tool "${toolKey}" not found.`, 'error');
    return;
  }

  ConvertX.activeTool = toolKey;
  resetCurrentTool();

  // Update Workspace Header Elements
  const titleElem = document.getElementById('workspace-title');
  const descElem = document.getElementById('workspace-desc');
  const iconElem = document.getElementById('ws-tool-icon');
  const fileInput = document.getElementById('file-input');
  const dropzoneInfo = document.getElementById('dropzone-info');
  const processBtnText = document.getElementById('process-btn-text');
  const workspaceSection = document.getElementById('tool-workspace');

  if (titleElem) titleElem.textContent = tool.title;
  if (descElem) descElem.textContent = tool.desc;
  if (iconElem) iconElem.innerHTML = `<i class="fa-solid ${tool.icon}"></i>`;
  if (processBtnText) processBtnText.textContent = tool.processBtnText;

  // Configure Native File Input
  if (fileInput) {
    fileInput.value = '';
    fileInput.accept = tool.accepts;
    fileInput.multiple = tool.multiple;
  }

  if (dropzoneInfo) {
    dropzoneInfo.textContent = `Supports: ${tool.accepts.toUpperCase()} (Up to ${tool.maxSizeMB}MB per file)`;
  }

  // Render Tool Options Panel
  renderToolOptions(toolKey);

  // Show Workspace and Scroll Smoothly
  if (workspaceSection) {
    workspaceSection.classList.remove('hidden');
    setTimeout(() => {
      workspaceSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }

  // Special behavior for text-to-pdf (no dropzone required initially)
  const dropzone = document.getElementById('dropzone');
  if (dropzone) {
    if (toolKey === 'text-to-pdf') {
      dropzone.classList.add('hidden');
    } else {
      dropzone.classList.remove('hidden');
    }
  }
}

ConvertX.openTool = openTool;

/**
 * Closes workspace and scrolls back to tools grid
 */
function closeWorkspace() {
  const workspaceSection = document.getElementById('tool-workspace');
  if (workspaceSection) workspaceSection.classList.add('hidden');
  ConvertX.activeTool = null;
  resetCurrentTool();

  const toolsSection = document.getElementById('tools');
  if (toolsSection) {
    toolsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/**
 * Resets state of the current active tool
 */
function resetCurrentTool() {
  clearStagedFiles();
  ConvertX.resultBlob = null;
  ConvertX.pdfPagesData = [];
  ConvertX.currentPdfBuffer = null;
  ConvertX.currentPdfDoc = null;

  const progressContainer = document.getElementById('progress-container');
  const resultsContainer = document.getElementById('results-container');
  const workspaceFooter = document.getElementById('workspace-footer');

  if (progressContainer) progressContainer.classList.add('hidden');
  if (resultsContainer) resultsContainer.classList.add('hidden');
  if (workspaceFooter) workspaceFooter.classList.remove('hidden');
  updateProgress(0, '');
}

/* ============================================================================
   File Upload, Drag & Drop, and Validation
   ============================================================================ */

function initDragAndDrop() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');

  // Prevent browser window from navigating away when dropping files outside dropzone
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    window.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  if (!dropzone || !fileInput) return;

  // Visual cues on dropzone
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    });
  });

  // Handle files dropped directly onto dropzone
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('dragover');
    const files = e.dataTransfer ? e.dataTransfer.files : null;
    if (files && files.length > 0) {
      handleIncomingFiles(Array.from(files));
    }
  });

  // Handle files selected through browser file picker
  fileInput.addEventListener('change', (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleIncomingFiles(Array.from(files));
    }
  });
}

/**
 * Validates and stages files dropped or selected by the user
 * @param {File[]} rawFiles - Array of File objects
 */
async function handleIncomingFiles(rawFiles) {
  const tool = ConvertX.tools[ConvertX.activeTool];
  if (!tool) return;

  const acceptedExtensions = tool.accepts.split(',').map(ext => ext.trim().toLowerCase());
  const validFiles = [];

  for (const file of rawFiles) {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    
    // Validate file type: check extension match OR check mime type match
    const isExtensionMatch = acceptedExtensions.includes(ext);
    const isMimeMatch = file.type && (
      (tool.category === 'image' && file.type.startsWith('image/')) ||
      (tool.category === 'pdf' && file.type === 'application/pdf') ||
      (tool.accepts.toLowerCase().includes(file.type.toLowerCase()))
    );

    if (!isExtensionMatch && !isMimeMatch) {
      showToast(`Invalid file type: "${file.name}". Expected: ${tool.accepts}`, 'error');
      continue;
    }

    // Validate size
    const maxSizeBytes = tool.maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      showToast(`File "${file.name}" exceeds limit of ${tool.maxSizeMB}MB.`, 'error');
      continue;
    }

    validFiles.push(file);
  }

  if (validFiles.length === 0) return;

  // Single file tools enforce only one staged file
  if (!tool.multiple) {
    ConvertX.stagedFiles = [validFiles[0]];
  } else {
    ConvertX.stagedFiles = [...ConvertX.stagedFiles, ...validFiles];
  }

  updateStagingUI();

  // Pre-load ArrayBuffer for any PDF operation so it is immediately ready
  if (tool.category === 'pdf' && ConvertX.stagedFiles.length > 0) {
    try {
      ConvertX.currentPdfBuffer = await ConvertX.stagedFiles[0].arrayBuffer();
    } catch (err) {
      console.error('Error pre-buffering PDF:', err);
    }
  }

  // If this tool requires rendering pages (remove, rotate, reorder), parse PDF thumbnails
  if (['remove-pages', 'rotate-pdf', 'reorder-pdf'].includes(ConvertX.activeTool)) {
    await loadAndRenderPdfPages(ConvertX.stagedFiles[0]);
  }
}

/**
 * Updates the file staging list UI
 */
function updateStagingUI() {
  const stagingElem = document.getElementById('files-staging');
  const fileCountElem = document.getElementById('file-count');
  const totalSizeElem = document.getElementById('total-file-size');
  const filesListElem = document.getElementById('files-list');

  if (!stagingElem || !fileCountElem || !filesListElem) return;

  if (ConvertX.stagedFiles.length === 0) {
    stagingElem.classList.add('hidden');
    filesListElem.innerHTML = '';
    return;
  }

  stagingElem.classList.remove('hidden');
  fileCountElem.textContent = ConvertX.stagedFiles.length;

  const totalBytes = ConvertX.stagedFiles.reduce((acc, f) => acc + f.size, 0);
  if (totalSizeElem) totalSizeElem.textContent = formatBytes(totalBytes);

  // If it's a page-level PDF tool, rendering is handled separately by loadAndRenderPdfPages
  if (['remove-pages', 'rotate-pdf', 'reorder-pdf'].includes(ConvertX.activeTool)) {
    return;
  }

  // Render individual file cards
  filesListElem.innerHTML = '';

  ConvertX.stagedFiles.forEach((file, index) => {
    const card = document.createElement('div');
    card.className = 'file-card';
    card.setAttribute('draggable', 'true');
    card.dataset.index = index;

    const isImage = file.type.startsWith('image/');

    card.innerHTML = `
      <div class="file-order-badge">${index + 1}</div>
      <button class="file-remove-btn" title="Remove file" aria-label="Remove file">
        <i class="fa-solid fa-xmark"></i>
      </button>
      <div class="file-thumb-wrapper">
        ${isImage ? `<img src="" alt="${file.name}" class="file-thumb-img" id="thumb-${index}">` : `<i class="fa-solid fa-file-pdf file-icon-placeholder"></i>`}
      </div>
      <div class="file-info">
        <div class="file-name" title="${file.name}">${file.name}</div>
        <div class="file-meta">
          <span>${formatBytes(file.size)}</span>
          <span class="file-ext">${file.name.split('.').pop().toUpperCase()}</span>
        </div>
      </div>
    `;

    // Asynchronously create image thumbnail preview
    if (isImage) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = card.querySelector(`#thumb-${index}`);
        if (img) img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }

    // Remove file listener
    const removeBtn = card.querySelector('.file-remove-btn');
    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeStagedFile(index);
      });
    }

    // Drag-and-drop reordering for multi-file tools
    if (ConvertX.tools[ConvertX.activeTool] && ConvertX.tools[ConvertX.activeTool].multiple) {
      attachDragReorderingEvents(card, index);
    }

    filesListElem.appendChild(card);
  });
}

/**
 * Removes a staged file by its index
 * @param {number} index 
 */
function removeStagedFile(index) {
  ConvertX.stagedFiles.splice(index, 1);
  updateStagingUI();
  showToast('File removed', 'info');
}

/**
 * Clears all currently staged files
 */
function clearStagedFiles() {
  ConvertX.stagedFiles = [];
  ConvertX.pdfPagesData = [];
  const fileInput = document.getElementById('file-input');
  if (fileInput) fileInput.value = '';
  updateStagingUI();
}

/**
 * Attaches drag and drop reordering handlers to file/page cards
 */
function attachDragReorderingEvents(card, index) {
  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', index);
    card.classList.add('dragging');
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
  });

  card.addEventListener('dragover', (e) => {
    e.preventDefault();
    card.classList.add('drag-over');
  });

  card.addEventListener('dragleave', () => {
    card.classList.remove('drag-over');
  });

  card.addEventListener('drop', (e) => {
    e.preventDefault();
    card.classList.remove('drag-over');
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    const toIndex = index;

    if (fromIndex !== toIndex && !isNaN(fromIndex)) {
      if (['reorder-pdf'].includes(ConvertX.activeTool)) {
        const movedItem = ConvertX.pdfPagesData.splice(fromIndex, 1)[0];
        ConvertX.pdfPagesData.splice(toIndex, 0, movedItem);
        renderPdfThumbnails();
      } else {
        const movedFile = ConvertX.stagedFiles.splice(fromIndex, 1)[0];
        ConvertX.stagedFiles.splice(toIndex, 0, movedFile);
        updateStagingUI();
      }
      showToast('Items reordered successfully', 'info');
    }
  });
}

/* ============================================================================
   PDF Page-Level Thumbnail Extraction & Rendering (via PDF.js)
   ============================================================================ */

/**
 * Loads a PDF file and extracts individual page thumbnails
 * @param {File} file - PDF file to render
 */
async function loadAndRenderPdfPages(file) {
  const progressContainer = document.getElementById('progress-container');
  if (progressContainer) progressContainer.classList.remove('hidden');
  updateProgress(10, 'Reading PDF structure...');

  try {
    const arrayBuffer = await file.arrayBuffer();
    ConvertX.currentPdfBuffer = arrayBuffer;

    if (!window.pdfjsLib) {
      throw new Error('PDF.js library is not available.');
    }

    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    ConvertX.pdfPagesData = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      updateProgress(
        10 + Math.round((pageNum / numPages) * 70),
        `Rendering thumbnail for page ${pageNum} of ${numPages}...`
      );

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 0.35 });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: ctx, viewport }).promise;

      ConvertX.pdfPagesData.push({
        originalIndex: pageNum - 1, // 0-based index for pdf-lib
        pageNumber: pageNum,
        thumbDataUrl: canvas.toDataURL('image/jpeg', 0.85),
        rotation: 0,
        markedForRemoval: false
      });
    }

    updateProgress(100, 'Thumbnails ready!');
    setTimeout(() => {
      if (progressContainer) progressContainer.classList.add('hidden');
      updateProgress(0, '');
    }, 400);

    renderPdfThumbnails();

  } catch (error) {
    console.error('PDF Thumbnail Error:', error);
    // Graceful fallback for environments where PDF.js cannot render thumbnails
    showToast('Document loaded. (Thumbnails preview skipped)', 'info');
    if (progressContainer) progressContainer.classList.add('hidden');

    // Create fallback page metadata using pdf-lib
    try {
      const { PDFDocument } = PDFLib;
      const doc = await PDFDocument.load(ConvertX.currentPdfBuffer);
      const count = doc.getPageCount();
      ConvertX.pdfPagesData = [];
      for (let i = 1; i <= count; i++) {
        ConvertX.pdfPagesData.push({
          originalIndex: i - 1,
          pageNumber: i,
          thumbDataUrl: '',
          rotation: 0,
          markedForRemoval: false
        });
      }
      renderPdfThumbnails();
    } catch (e) {
      console.error('PDF fallback load failed:', e);
    }
  }
}

/**
 * Renders thumbnail cards for page-level PDF tools (remove, rotate, reorder)
 */
function renderPdfThumbnails() {
  const stagingElem = document.getElementById('files-staging');
  const fileCountElem = document.getElementById('file-count');
  const filesListElem = document.getElementById('files-list');

  if (!stagingElem || !filesListElem) return;

  stagingElem.classList.remove('hidden');
  if (fileCountElem) fileCountElem.textContent = `${ConvertX.pdfPagesData.length} Pages`;
  filesListElem.innerHTML = '';

  ConvertX.pdfPagesData.forEach((pageData, idx) => {
    const card = document.createElement('div');
    card.className = 'page-thumb-card';
    card.dataset.index = idx;

    if (pageData.markedForRemoval) {
      card.classList.add('selected-remove');
    }

    let actionButtonsHtml = '';

    if (ConvertX.activeTool === 'rotate-pdf') {
      actionButtonsHtml = `
        <div class="page-actions-row">
          <button class="page-action-btn rotate-single-btn" title="Rotate 90° Clockwise">
            <i class="fa-solid fa-rotate-right"></i> Rotate 90°
          </button>
        </div>
      `;
    } else if (ConvertX.activeTool === 'reorder-pdf') {
      card.setAttribute('draggable', 'true');
      actionButtonsHtml = `
        <div class="page-actions-row">
          <button class="page-action-btn move-left-btn" ${idx === 0 ? 'disabled' : ''} title="Move Earlier">
            <i class="fa-solid fa-arrow-left"></i>
          </button>
          <span style="font-size:0.75rem; font-weight:700;">Pos: ${idx + 1}</span>
          <button class="page-action-btn move-right-btn" ${idx === ConvertX.pdfPagesData.length - 1 ? 'disabled' : ''} title="Move Later">
            <i class="fa-solid fa-arrow-right"></i>
          </button>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="file-order-badge">#${pageData.pageNumber}</div>
      ${pageData.markedForRemoval ? `<div class="page-remove-overlay"><i class="fa-solid fa-trash-can"></i> Remove</div>` : ''}
      <div class="file-thumb-wrapper">
        ${pageData.thumbDataUrl ? `
          <img 
            src="${pageData.thumbDataUrl}" 
            alt="Page ${pageData.pageNumber}" 
            class="file-thumb-img" 
            style="transform: rotate(${pageData.rotation}deg);"
          >
        ` : `
          <div style="text-align:center; padding:1rem; font-size:1.8rem; color:var(--color-coffee-brown);">
            <i class="fa-solid fa-file-pdf"></i>
          </div>
        `}
      </div>
      <div class="file-info text-center">
        <span style="font-size:0.8rem; font-weight:700;">Page ${pageData.pageNumber}</span>
      </div>
      ${actionButtonsHtml}
    `;

    // Click to toggle removal
    if (ConvertX.activeTool === 'remove-pages') {
      card.addEventListener('click', () => {
        pageData.markedForRemoval = !pageData.markedForRemoval;
        renderPdfThumbnails();
        syncRemovePagesInput();
      });
    }

    // Rotate single page
    if (ConvertX.activeTool === 'rotate-pdf') {
      const rotBtn = card.querySelector('.rotate-single-btn');
      if (rotBtn) {
        rotBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          pageData.rotation = (pageData.rotation + 90) % 360;
          renderPdfThumbnails();
        });
      }
    }

    // Reorder move left/right
    if (ConvertX.activeTool === 'reorder-pdf') {
      attachDragReorderingEvents(card, idx);

      const leftBtn = card.querySelector('.move-left-btn');
      const rightBtn = card.querySelector('.move-right-btn');

      if (leftBtn && !leftBtn.disabled) {
        leftBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const item = ConvertX.pdfPagesData.splice(idx, 1)[0];
          ConvertX.pdfPagesData.splice(idx - 1, 0, item);
          renderPdfThumbnails();
        });
      }

      if (rightBtn && !rightBtn.disabled) {
        rightBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const item = ConvertX.pdfPagesData.splice(idx, 1)[0];
          ConvertX.pdfPagesData.splice(idx + 1, 0, item);
          renderPdfThumbnails();
        });
      }
    }

    filesListElem.appendChild(card);
  });
}

/**
 * Synchronizes text input for page ranges with clicked thumbnails in remove-pages
 */
function syncRemovePagesInput() {
  const rangeInput = document.getElementById('remove-range-input');
  if (!rangeInput) return;

  const markedPages = ConvertX.pdfPagesData
    .filter(p => p.markedForRemoval)
    .map(p => p.pageNumber);

  rangeInput.value = formatNumberListToRanges(markedPages);
}

/**
 * Parses user-typed page range string (e.g. "1, 3-5, 8") and marks thumbnails
 */
function applyTypedRemoveRanges(rangeString) {
  const totalPages = ConvertX.pdfPagesData.length;
  const pagesToRemove = parsePageRangeString(rangeString, totalPages);

  ConvertX.pdfPagesData.forEach(p => {
    p.markedForRemoval = pagesToRemove.includes(p.pageNumber);
  });

  renderPdfThumbnails();
}

/* ============================================================================
   Dynamic Tool Options Panels
   ============================================================================ */

/**
 * Injects tool-specific settings and customization controls into the workspace
 * @param {string} toolKey 
 */
function renderToolOptions(toolKey) {
  const panel = document.getElementById('tool-options-panel');
  if (!panel) return;
  panel.innerHTML = '';

  switch (toolKey) {
    case 'img-to-pdf':
      panel.innerHTML = `
        <div class="options-grid">
          <div class="option-group">
            <label class="option-label" for="opt-page-size">Page Size</label>
            <select id="opt-page-size" class="form-control">
              <option value="a4" selected>A4 (Standard 210 × 297 mm)</option>
              <option value="letter">US Letter (8.5 × 11 in)</option>
              <option value="fit">Fit to Image Size</option>
            </select>
          </div>
          <div class="option-group">
            <label class="option-label" for="opt-orientation">Page Orientation</label>
            <select id="opt-orientation" class="form-control">
              <option value="portrait" selected>Portrait</option>
              <option value="landscape">Landscape</option>
              <option value="auto">Auto (Match Image)</option>
            </select>
          </div>
          <div class="option-group">
            <label class="option-label" for="opt-margin">Margin</label>
            <select id="opt-margin" class="form-control">
              <option value="none">No Margin (0mm)</option>
              <option value="small" selected>Small Margin (10mm)</option>
              <option value="normal">Normal Margin (20mm)</option>
            </select>
          </div>
        </div>
      `;
      break;

    case 'merge-pdf':
      panel.innerHTML = `
        <p style="font-size:0.9rem; color:var(--text-secondary);">
          <i class="fa-solid fa-info-circle"></i> Drag and drop file cards in the list above to reorder how the documents are merged into one.
        </p>
      `;
      break;

    case 'remove-pages':
      panel.innerHTML = `
        <div class="options-grid">
          <div class="option-group" style="grid-column: 1 / -1;">
            <label class="option-label" for="remove-range-input">
              Pages to Delete
              <span class="option-value-badge">Click cards above or enter range</span>
            </label>
            <input 
              type="text" 
              id="remove-range-input" 
              class="form-control" 
              placeholder="e.g. 2, 4-6, 8"
            >
            <small style="color:var(--text-muted); margin-top:4px;">
              Enter comma-separated page numbers or ranges. Clicking a page thumbnail above will automatically update this field.
            </small>
          </div>
        </div>
      `;
      setTimeout(() => {
        const input = document.getElementById('remove-range-input');
        if (input) {
          input.addEventListener('input', (e) => {
            applyTypedRemoveRanges(e.target.value);
          });
        }
      }, 50);
      break;

    case 'compress-image':
      panel.innerHTML = `
        <div class="options-grid">
          <div class="option-group">
            <label class="option-label">
              Compression Quality
              <span class="option-value-badge" id="quality-val-badge">75%</span>
            </label>
            <input type="range" id="opt-quality-slider" class="range-slider" min="10" max="95" value="75">
            <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-muted); margin-top:4px;">
              <span>Small File (10%)</span>
              <span>Balanced (75%)</span>
              <span>High Quality (95%)</span>
            </div>
          </div>
          <div class="option-group">
            <label class="option-label" for="opt-max-width">Maximum Resolution</label>
            <select id="opt-max-width" class="form-control">
              <option value="original" selected>Keep Original Dimensions</option>
              <option value="1920">Full HD (1920px max)</option>
              <option value="1280">HD (1280px max)</option>
              <option value="800">Compact (800px max)</option>
            </select>
          </div>
        </div>
      `;
      setTimeout(() => {
        const slider = document.getElementById('opt-quality-slider');
        const badge = document.getElementById('quality-val-badge');
        if (slider && badge) {
          slider.addEventListener('input', (e) => {
            badge.textContent = `${e.target.value}%`;
          });
        }
      }, 50);
      break;

    case 'pdf-to-img':
      panel.innerHTML = `
        <div class="options-grid">
          <div class="option-group">
            <label class="option-label" for="opt-render-fmt">Output Format</label>
            <select id="opt-render-fmt" class="form-control">
              <option value="jpeg" selected>JPG (Smaller file size)</option>
              <option value="png">PNG (Lossless & transparent)</option>
            </select>
          </div>
          <div class="option-group">
            <label class="option-label" for="opt-render-scale">Resolution Scale</label>
            <select id="opt-render-scale" class="form-control">
              <option value="1.0">Standard Quality (72 DPI)</option>
              <option value="1.5" selected>Enhanced Quality (108 DPI)</option>
              <option value="2.0">High Definition (144 DPI)</option>
            </select>
          </div>
        </div>
      `;
      break;

    case 'split-pdf':
      panel.innerHTML = `
        <div class="options-grid">
          <div class="option-group">
            <label class="option-label" for="opt-split-mode">Split Method</label>
            <select id="opt-split-mode" class="form-control">
              <option value="range" selected>Extract Specific Range (into 1 PDF)</option>
              <option value="all-pages">Extract All Pages into Separate PDFs (ZIP)</option>
            </select>
          </div>
          <div class="option-group" id="split-range-group">
            <label class="option-label" for="opt-split-range">Page Range to Extract</label>
            <input type="text" id="opt-split-range" class="form-control" placeholder="e.g. 1-3, 5">
          </div>
        </div>
      `;
      setTimeout(() => {
        const mode = document.getElementById('opt-split-mode');
        const rangeGroup = document.getElementById('split-range-group');
        if (mode && rangeGroup) {
          mode.addEventListener('change', () => {
            rangeGroup.style.display = mode.value === 'range' ? 'block' : 'none';
          });
        }
      }, 50);
      break;

    case 'rotate-pdf':
      panel.innerHTML = `
        <div class="options-grid">
          <div class="option-group" style="grid-column: 1 / -1;">
            <label class="option-label">Bulk Rotation</label>
            <div style="display:flex; gap:0.75rem; flex-wrap:wrap; margin-top:0.5rem;">
              <button type="button" class="btn btn-outline btn-sm" id="rotate-all-90-btn">
                <i class="fa-solid fa-rotate-right"></i> Rotate All +90°
              </button>
              <button type="button" class="btn btn-outline btn-sm" id="rotate-all-180-btn">
                <i class="fa-solid fa-rotate"></i> Rotate All 180°
              </button>
              <button type="button" class="btn btn-outline btn-sm" id="rotate-all-270-btn">
                <i class="fa-solid fa-rotate-left"></i> Rotate All +270° (-90°)
              </button>
              <button type="button" class="btn btn-ghost btn-sm" id="reset-rotations-btn">
                <i class="fa-solid fa-arrow-rotate-left"></i> Reset Rotations
              </button>
            </div>
          </div>
        </div>
      `;
      setTimeout(() => {
        document.getElementById('rotate-all-90-btn')?.addEventListener('click', () => bulkRotatePages(90));
        document.getElementById('rotate-all-180-btn')?.addEventListener('click', () => bulkRotatePages(180));
        document.getElementById('rotate-all-270-btn')?.addEventListener('click', () => bulkRotatePages(270));
        document.getElementById('reset-rotations-btn')?.addEventListener('click', () => bulkRotatePages(0, true));
      }, 50);
      break;

    case 'reorder-pdf':
      panel.innerHTML = `
        <p style="font-size:0.9rem; color:var(--text-secondary);">
          <i class="fa-solid fa-hand-pointer"></i> Drag and drop page cards or use the Left/Right arrow buttons on each card to reorder pages.
        </p>
      `;
      break;

    case 'convert-img':
      panel.innerHTML = `
        <div class="options-grid">
          <div class="option-group">
            <label class="option-label" for="opt-conv-fmt">Target Format</label>
            <select id="opt-conv-fmt" class="form-control">
              <option value="jpeg" selected>JPG (Standard photo)</option>
              <option value="png">PNG (Lossless & transparency)</option>
              <option value="webp">WEBP (Modern optimized web)</option>
            </select>
          </div>
          <div class="option-group">
            <label class="option-label">
              Quality
              <span class="option-value-badge" id="conv-quality-badge">85%</span>
            </label>
            <input type="range" id="opt-conv-quality" class="range-slider" min="20" max="100" value="85">
          </div>
        </div>
      `;
      setTimeout(() => {
        const slider = document.getElementById('opt-conv-quality');
        const badge = document.getElementById('conv-quality-badge');
        if (slider && badge) {
          slider.addEventListener('input', (e) => {
            badge.textContent = `${e.target.value}%`;
          });
        }
      }, 50);
      break;

    case 'resize-img':
      panel.innerHTML = `
        <div class="options-grid">
          <div class="option-group">
            <label class="option-label" for="opt-resize-mode">Resize Mode</label>
            <select id="opt-resize-mode" class="form-control">
              <option value="dimensions" selected>By Exact Dimensions (Pixels)</option>
              <option value="percentage">By Percentage (%)</option>
            </select>
          </div>
          <div class="option-group" id="group-resize-dims">
            <div style="display:flex; gap:0.75rem;">
              <div style="flex:1;">
                <label class="option-label" for="opt-resize-w">Width (px)</label>
                <input type="number" id="opt-resize-w" class="form-control" placeholder="Width">
              </div>
              <div style="flex:1;">
                <label class="option-label" for="opt-resize-h">Height (px)</label>
                <input type="number" id="opt-resize-h" class="form-control" placeholder="Height">
              </div>
            </div>
            <label style="font-size:0.8rem; margin-top:0.4rem; display:flex; align-items:center; gap:0.4rem; cursor:pointer;">
              <input type="checkbox" id="opt-lock-ratio" checked> Maintain aspect ratio
            </label>
          </div>
          <div class="option-group hidden" id="group-resize-pct">
            <label class="option-label">
              Scale Percentage
              <span class="option-value-badge" id="pct-badge">50%</span>
            </label>
            <input type="range" id="opt-resize-pct" class="range-slider" min="10" max="200" value="50">
          </div>
        </div>
      `;
      initResizeImageOptions();
      break;

    case 'watermark-pdf':
      panel.innerHTML = `
        <div class="options-grid">
          <div class="option-group">
            <label class="option-label" for="opt-wm-text">Watermark Text</label>
            <input type="text" id="opt-wm-text" class="form-control" value="CONFIDENTIAL" placeholder="e.g. DRAFT, CONFIDENTIAL">
          </div>
          <div class="option-group">
            <label class="option-label">
              Font Size
              <span class="option-value-badge" id="wm-size-badge">48 pt</span>
            </label>
            <input type="range" id="opt-wm-size" class="range-slider" min="16" max="96" value="48">
          </div>
          <div class="option-group">
            <label class="option-label">
              Opacity
              <span class="option-value-badge" id="wm-opacity-badge">30%</span>
            </label>
            <input type="range" id="opt-wm-opacity" class="range-slider" min="10" max="100" value="30">
          </div>
          <div class="option-group">
            <label class="option-label" for="opt-wm-color">Color Theme</label>
            <select id="opt-wm-color" class="form-control">
              <option value="brown" selected>Coffee Brown (#6F4E37)</option>
              <option value="blue">Sky Blue (#87CEEB)</option>
              <option value="gray">Subtle Gray (#888888)</option>
              <option value="red">Warning Red (#D32F2F)</option>
              <option value="black">Solid Black (#111111)</option>
            </select>
          </div>
          <div class="option-group">
            <label class="option-label" for="opt-wm-layout">Orientation</label>
            <select id="opt-wm-layout" class="form-control">
              <option value="diagonal" selected>Diagonal (45° angle)</option>
              <option value="horizontal">Horizontal (0° angle)</option>
            </select>
          </div>
        </div>
      `;
      setTimeout(() => {
        const sizeSlider = document.getElementById('opt-wm-size');
        const sizeBadge = document.getElementById('wm-size-badge');
        if (sizeSlider && sizeBadge) {
          sizeSlider.addEventListener('input', (e) => { sizeBadge.textContent = `${e.target.value} pt`; });
        }
        const opSlider = document.getElementById('opt-wm-opacity');
        const opBadge = document.getElementById('wm-opacity-badge');
        if (opSlider && opBadge) {
          opSlider.addEventListener('input', (e) => { opBadge.textContent = `${e.target.value}%`; });
        }
      }, 50);
      break;

    case 'page-numbers-pdf':
      panel.innerHTML = `
        <div class="options-grid">
          <div class="option-group">
            <label class="option-label" for="opt-num-format">Format</label>
            <select id="opt-num-format" class="form-control">
              <option value="page-x-of-y" selected>Page X of Y</option>
              <option value="page-x">Page X</option>
              <option value="x-of-y">X / Y</option>
              <option value="x-only">X (Number only)</option>
            </select>
          </div>
          <div class="option-group">
            <label class="option-label" for="opt-num-pos">Position</label>
            <select id="opt-num-pos" class="form-control">
              <option value="bottom-center" selected>Bottom Center</option>
              <option value="bottom-right">Bottom Right</option>
              <option value="bottom-left">Bottom Left</option>
              <option value="top-right">Top Right</option>
              <option value="top-center">Top Center</option>
            </select>
          </div>
          <div class="option-group">
            <label class="option-label" for="opt-num-size">Font Size</label>
            <select id="opt-num-size" class="form-control">
              <option value="10">Small (10pt)</option>
              <option value="12" selected>Medium (12pt)</option>
              <option value="14">Large (14pt)</option>
            </select>
          </div>
          <div class="option-group">
            <label class="option-label" for="opt-num-start">Starting Number</label>
            <input type="number" id="opt-num-start" class="form-control" value="1" min="1">
          </div>
        </div>
      `;
      break;

    case 'text-to-pdf':
      panel.innerHTML = `
        <div class="options-grid">
          <div class="option-group" style="grid-column: 1 / -1;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
              <label class="option-label" for="opt-text-content">Enter or Paste Document Text</label>
              <button type="button" class="btn btn-ghost btn-sm" id="load-sample-txt-btn">
                <i class="fa-solid fa-file-pen"></i> Insert Sample Text
              </button>
            </div>
            <textarea 
              id="opt-text-content" 
              class="form-control" 
              rows="10" 
              placeholder="Start typing your document text here, or paste content from your clipboard..."
            ></textarea>
          </div>
          <div class="option-group">
            <label class="option-label" for="opt-doc-title">Document Title</label>
            <input type="text" id="opt-doc-title" class="form-control" placeholder="Document Title (optional)">
          </div>
          <div class="option-group">
            <label class="option-label" for="opt-text-font">Font Family</label>
            <select id="opt-text-font" class="form-control">
              <option value="helvetica" selected>Helvetica (Clean Sans-Serif)</option>
              <option value="times">Times New Roman (Classic Serif)</option>
              <option value="courier">Courier (Monospace)</option>
            </select>
          </div>
          <div class="option-group">
            <label class="option-label" for="opt-text-size">Body Font Size</label>
            <select id="opt-text-size" class="form-control">
              <option value="10">Compact (10pt)</option>
              <option value="12" selected>Standard (12pt)</option>
              <option value="14">Large (14pt)</option>
            </select>
          </div>
        </div>
      `;
      setTimeout(() => {
        document.getElementById('load-sample-txt-btn')?.addEventListener('click', () => {
          const sample = "ConvertX Client-Side Document\n\n1. Introduction\nConvertX is a high-performance web-based PDF and image toolkit designed with strict privacy principles. All processing occurs locally within your web browser using modern Web APIs such as WebAssembly, HTML5 Canvas, and FileReader.\n\n2. Key Advantages\n- Zero Server Uploads: Confidential documents never traverse the network.\n- Blazing Speed: Processing is bounded solely by device hardware.\n- Offline Capable: Can execute without an active internet connection once loaded.\n\nThank you for choosing ConvertX!";
          const textarea = document.getElementById('opt-text-content');
          if (textarea) textarea.value = sample;
        });
      }, 50);
      break;

    case 'qr-base64':
      panel.innerHTML = `
        <div class="options-grid">
          <div class="option-group" style="grid-column: 1 / -1;">
            <label class="option-label">Choose Action</label>
            <div class="radio-cards-group">
              <div class="radio-card active" data-subtab="base64">
                <i class="fa-solid fa-code"></i> Image to Base64
              </div>
              <div class="radio-card" data-subtab="qr">
                <i class="fa-solid fa-qrcode"></i> QR Code Generator
              </div>
            </div>
          </div>

          <!-- Base64 Subtab -->
          <div class="option-group" id="subtab-base64-group" style="grid-column: 1 / -1;">
            <p style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:0.75rem;">
              Upload an image above to generate an immediate Data URI and Base64 string for embedding into HTML, CSS or Markdown.
            </p>
          </div>

          <!-- QR Code Subtab -->
          <div class="option-group hidden" id="subtab-qr-group" style="grid-column: 1 / -1;">
            <label class="option-label" for="opt-qr-text">Text or URL to Encode</label>
            <input type="text" id="opt-qr-text" class="form-control" placeholder="https://example.com or any text" value="https://convertx.local">
            <div style="margin-top:1rem; display:flex; gap:1rem; flex-wrap:wrap;">
              <div>
                <label class="option-label" for="opt-qr-size">Size (px)</label>
                <select id="opt-qr-size" class="form-control">
                  <option value="128">128 × 128 px</option>
                  <option value="256" selected>256 × 256 px</option>
                  <option value="384">384 × 384 px</option>
                </select>
              </div>
              <div>
                <label class="option-label" for="opt-qr-color">QR Color</label>
                <select id="opt-qr-color" class="form-control">
                  <option value="#6F4E37" selected>Coffee Brown</option>
                  <option value="#111111">Classic Black</option>
                  <option value="#87CEEB">Sky Blue</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      `;
      initQrBase64Tabs();
      break;

    default:
      panel.innerHTML = '';
  }
}

/**
 * Bulk rotates all pages in the rotate-pdf tool
 */
function bulkRotatePages(angle, isReset = false) {
  ConvertX.pdfPagesData.forEach(p => {
    if (isReset) {
      p.rotation = 0;
    } else {
      p.rotation = (p.rotation + angle) % 360;
    }
  });
  renderPdfThumbnails();
  showToast(isReset ? 'Rotations reset' : `Rotated all pages by ${angle}°`, 'info');
}

/**
 * Initializes controls for Resize Image tool
 */
function initResizeImageOptions() {
  setTimeout(() => {
    const modeSelect = document.getElementById('opt-resize-mode');
    const dimsGroup = document.getElementById('group-resize-dims');
    const pctGroup = document.getElementById('group-resize-pct');
    const widthInput = document.getElementById('opt-resize-w');
    const heightInput = document.getElementById('opt-resize-h');
    const lockRatio = document.getElementById('opt-lock-ratio');
    const pctSlider = document.getElementById('opt-resize-pct');
    const pctBadge = document.getElementById('pct-badge');

    let originalW = 0;
    let originalH = 0;

    if (ConvertX.stagedFiles.length > 0) {
      const img = new Image();
      img.onload = () => {
        originalW = img.naturalWidth;
        originalH = img.naturalHeight;
        if (widthInput) widthInput.value = originalW;
        if (heightInput) heightInput.value = originalH;
      };
      img.src = URL.createObjectURL(ConvertX.stagedFiles[0]);
    }

    if (modeSelect) {
      modeSelect.addEventListener('change', () => {
        if (modeSelect.value === 'dimensions') {
          dimsGroup.classList.remove('hidden');
          pctGroup.classList.add('hidden');
        } else {
          dimsGroup.classList.add('hidden');
          pctGroup.classList.remove('hidden');
        }
      });
    }

    if (widthInput && heightInput && lockRatio) {
      widthInput.addEventListener('input', () => {
        if (lockRatio.checked && originalW > 0) {
          const ratio = originalH / originalW;
          heightInput.value = Math.round(widthInput.value * ratio);
        }
      });

      heightInput.addEventListener('input', () => {
        if (lockRatio.checked && originalH > 0) {
          const ratio = originalW / originalH;
          widthInput.value = Math.round(heightInput.value * ratio);
        }
      });
    }

    if (pctSlider && pctBadge) {
      pctSlider.addEventListener('input', (e) => {
        pctBadge.textContent = `${e.target.value}%`;
      });
    }
  }, 50);
}

/**
 * Initializes subtabs for QR Code and Base64 tool
 */
function initQrBase64Tabs() {
  setTimeout(() => {
    const radioCards = document.querySelectorAll('.radio-cards-group .radio-card');
    const b64Group = document.getElementById('subtab-base64-group');
    const qrGroup = document.getElementById('subtab-qr-group');
    const dropzone = document.getElementById('dropzone');

    radioCards.forEach(card => {
      card.addEventListener('click', () => {
        radioCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        const subtab = card.getAttribute('data-subtab');

        if (subtab === 'base64') {
          b64Group.classList.remove('hidden');
          qrGroup.classList.add('hidden');
          if (dropzone) dropzone.classList.remove('hidden');
        } else {
          b64Group.classList.add('hidden');
          qrGroup.classList.remove('hidden');
          if (dropzone) dropzone.classList.add('hidden');
        }
      });
    });
  }, 50);
}

/* ============================================================================
   Core Execution Router: processActiveTool()
   ============================================================================ */

/**
 * Dispatches the active tool to its dedicated processing algorithm
 */
async function processActiveTool() {
  const toolKey = ConvertX.activeTool;
  if (!toolKey) return;

  // Validation: Check if input files are required
  if (toolKey !== 'text-to-pdf') {
    if (toolKey === 'qr-base64') {
      const activeSubtab = document.querySelector('.radio-cards-group .radio-card.active')?.getAttribute('data-subtab');
      if (activeSubtab === 'base64' && ConvertX.stagedFiles.length === 0) {
        showToast('Please select or drop an image to convert to Base64.', 'warning');
        return;
      }
    } else if (ConvertX.stagedFiles.length === 0) {
      showToast('Please select or drop at least one file before processing.', 'warning');
      return;
    }
  }

  // Ensure current PDF buffer is populated for PDF tools
  const tool = ConvertX.tools[toolKey];
  if (tool && tool.category === 'pdf' && toolKey !== 'img-to-pdf') {
    if (!ConvertX.currentPdfBuffer && ConvertX.stagedFiles.length > 0) {
      ConvertX.currentPdfBuffer = await ConvertX.stagedFiles[0].arrayBuffer();
    }
  }

  const progressContainer = document.getElementById('progress-container');
  const resultsContainer = document.getElementById('results-container');
  const workspaceFooter = document.getElementById('workspace-footer');

  if (resultsContainer) resultsContainer.classList.add('hidden');
  if (progressContainer) progressContainer.classList.remove('hidden');
  if (workspaceFooter) workspaceFooter.classList.add('hidden');

  updateProgress(5, 'Preparing workspace...');

  try {
    switch (toolKey) {
      case 'img-to-pdf':
        await executeImagesToPdf();
        break;
      case 'merge-pdf':
        await executeMergePdfs();
        break;
      case 'remove-pages':
        await executeRemovePages();
        break;
      case 'compress-image':
        await executeCompressImages();
        break;
      case 'pdf-to-img':
        await executePdfToImages();
        break;
      case 'split-pdf':
        await executeSplitPdf();
        break;
      case 'rotate-pdf':
        await executeRotatePdf();
        break;
      case 'reorder-pdf':
        await executeReorderPdf();
        break;
      case 'convert-img':
        await executeConvertImages();
        break;
      case 'resize-img':
        await executeResizeImage();
        break;
      case 'watermark-pdf':
        await executeWatermarkPdf();
        break;
      case 'page-numbers-pdf':
        await executePageNumbersPdf();
        break;
      case 'text-to-pdf':
        await executeTextToPdf();
        break;
      case 'qr-base64':
        await executeQrOrBase64();
        break;
      default:
        showToast('Unknown tool execution routine', 'error');
    }
  } catch (err) {
    console.error('Processing Execution Error:', err);
    showToast(`Error processing task: ${err.message || 'Operation failed'}`, 'error');
    if (progressContainer) progressContainer.classList.add('hidden');
    if (workspaceFooter) workspaceFooter.classList.remove('hidden');
  }
}

/* ============================================================================
   Tool 1: Images to PDF (JPG / PNG to PDF)
   ============================================================================ */
async function executeImagesToPdf() {
  updateProgress(20, 'Loading PDF engine...');
  if (!window.PDFLib) {
    throw new Error('PDF-lib engine is still loading. Please check your internet connection.');
  }

  const { PDFDocument } = PDFLib;
  const pdfDoc = await PDFDocument.create();

  const pageSizeOpt = document.getElementById('opt-page-size')?.value || 'a4';
  const orientationOpt = document.getElementById('opt-orientation')?.value || 'portrait';
  const marginOpt = document.getElementById('opt-margin')?.value || 'small';

  let marginPt = 0;
  if (marginOpt === 'small') marginPt = 28.35; // ~10mm
  if (marginOpt === 'normal') marginPt = 56.7; // ~20mm

  const totalFiles = ConvertX.stagedFiles.length;

  for (let i = 0; i < totalFiles; i++) {
    const file = ConvertX.stagedFiles[i];
    updateProgress(
      20 + Math.round(((i + 1) / totalFiles) * 70),
      `Embedding image ${i + 1} of ${totalFiles}...`
    );

    const arrayBuffer = await file.arrayBuffer();
    let embeddedImg;

    if (file.type === 'image/jpeg' || file.name.match(/\.(jpg|jpeg)$/i)) {
      embeddedImg = await pdfDoc.embedJpg(arrayBuffer);
    } else if (file.type === 'image/png' || file.name.match(/\.png$/i)) {
      embeddedImg = await pdfDoc.embedPng(arrayBuffer);
    } else {
      const convertedBlob = await convertImageToFormat(file, 'image/png', 1.0);
      const convertedBuffer = await convertedBlob.arrayBuffer();
      embeddedImg = await pdfDoc.embedPng(convertedBuffer);
    }

    const imgDims = embeddedImg.scale(1);
    let pageW, pageH;

    if (pageSizeOpt === 'a4') {
      [pageW, pageH] = PAGE_SIZES.a4;
    } else if (pageSizeOpt === 'letter') {
      [pageW, pageH] = PAGE_SIZES.letter;
    } else {
      pageW = imgDims.width + marginPt * 2;
      pageH = imgDims.height + marginPt * 2;
    }

    // Apply orientation
    if (orientationOpt === 'landscape' && pageH > pageW) {
      [pageW, pageH] = [pageH, pageW];
    } else if (orientationOpt === 'portrait' && pageW > pageH) {
      [pageW, pageH] = [pageH, pageW];
    } else if (orientationOpt === 'auto') {
      if (imgDims.width > imgDims.height && pageH > pageW) {
        [pageW, pageH] = [pageH, pageW];
      }
    }

    const page = pdfDoc.addPage([pageW, pageH]);

    const printableW = pageW - marginPt * 2;
    const printableH = pageH - marginPt * 2;
    const scale = Math.min(printableW / imgDims.width, printableH / imgDims.height);

    const drawW = imgDims.width * scale;
    const drawH = imgDims.height * scale;
    const drawX = marginPt + (printableW - drawW) / 2;
    const drawY = marginPt + (printableH - drawH) / 2;

    page.drawImage(embeddedImg, {
      x: drawX,
      y: drawY,
      width: drawW,
      height: drawH
    });
  }

  updateProgress(95, 'Generating PDF byte stream...');
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });

  finishProcessing(
    blob,
    'convertx_images.pdf',
    'Images Converted to PDF',
    [
      { label: 'Total Pages', value: totalFiles },
      { label: 'File Size', value: formatBytes(blob.size) }
    ]
  );
}

/* ============================================================================
   Tool 2: Merge PDF
   ============================================================================ */
async function executeMergePdfs() {
  if (ConvertX.stagedFiles.length < 2) {
    showToast('Please stage at least 2 PDF files to merge.', 'warning');
    throw new Error('Minimum 2 files required for merge.');
  }

  updateProgress(20, 'Initializing merge container...');
  const { PDFDocument } = PDFLib;
  const mergedPdf = await PDFDocument.create();

  const totalFiles = ConvertX.stagedFiles.length;
  let totalPagesMerged = 0;

  for (let i = 0; i < totalFiles; i++) {
    const file = ConvertX.stagedFiles[i];
    updateProgress(
      20 + Math.round(((i + 1) / totalFiles) * 70),
      `Merging ${file.name} (${i + 1} of ${totalFiles})...`
    );

    const arrayBuffer = await file.arrayBuffer();
    const doc = await PDFDocument.load(arrayBuffer);
    const pageIndices = doc.getPageIndices();
    const copiedPages = await mergedPdf.copyPages(doc, pageIndices);

    copiedPages.forEach(p => mergedPdf.addPage(p));
    totalPagesMerged += copiedPages.length;
  }

  updateProgress(95, 'Compiling consolidated document...');
  const pdfBytes = await mergedPdf.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });

  finishProcessing(
    blob,
    'convertx_merged.pdf',
    'PDFs Merged Successfully',
    [
      { label: 'Files Merged', value: totalFiles },
      { label: 'Total Pages', value: totalPagesMerged },
      { label: 'Consolidated Size', value: formatBytes(blob.size) }
    ]
  );
}

/* ============================================================================
   Tool 3: Remove Pages from PDF
   ============================================================================ */
async function executeRemovePages() {
  let markedIndices = ConvertX.pdfPagesData
    .filter(p => p.markedForRemoval)
    .map(p => p.originalIndex);

  // If user typed range without thumbnails
  const rangeInput = document.getElementById('remove-range-input')?.value.trim();
  if (markedIndices.length === 0 && rangeInput) {
    const { PDFDocument } = PDFLib;
    const doc = await PDFDocument.load(ConvertX.currentPdfBuffer);
    const total = doc.getPageCount();
    const pages = parsePageRangeString(rangeInput, total);
    markedIndices = pages.map(p => p - 1);
  }

  if (markedIndices.length === 0) {
    showToast('Please select at least one page to remove.', 'warning');
    throw new Error('No pages selected.');
  }

  updateProgress(30, 'Cloning document structure...');
  const { PDFDocument } = PDFLib;
  const originalDoc = await PDFDocument.load(ConvertX.currentPdfBuffer);
  const newDoc = await PDFDocument.create();

  const allIndices = originalDoc.getPageIndices();
  const keepIndices = allIndices.filter(idx => !markedIndices.includes(idx));

  if (keepIndices.length === 0) {
    showToast('Cannot remove all pages! At least 1 page must remain.', 'error');
    throw new Error('All pages selected for removal.');
  }

  updateProgress(60, `Retaining ${keepIndices.length} pages...`);
  const copiedPages = await newDoc.copyPages(originalDoc, keepIndices);
  copiedPages.forEach(p => newDoc.addPage(p));

  updateProgress(90, 'Saving sanitized document...');
  const pdfBytes = await newDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });

  finishProcessing(
    blob,
    'convertx_pages_removed.pdf',
    'Pages Removed Successfully',
    [
      { label: 'Pages Removed', value: markedIndices.length },
      { label: 'Pages Remaining', value: keepIndices.length },
      { label: 'Output Size', value: formatBytes(blob.size) }
    ]
  );
}

/* ============================================================================
   Tool 4: Compress Image
   ============================================================================ */
async function executeCompressImages() {
  const quality = parseInt(document.getElementById('opt-quality-slider')?.value || '75', 10) / 100;
  const maxWidthChoice = document.getElementById('opt-max-width')?.value || 'original';
  const maxWidth = maxWidthChoice === 'original' ? undefined : parseInt(maxWidthChoice, 10);

  const totalFiles = ConvertX.stagedFiles.length;
  const compressedResults = [];

  let totalOriginalBytes = 0;
  let totalCompressedBytes = 0;

  for (let i = 0; i < totalFiles; i++) {
    const file = ConvertX.stagedFiles[i];
    totalOriginalBytes += file.size;

    updateProgress(
      15 + Math.round(((i + 1) / totalFiles) * 75),
      `Compressing ${file.name} (${i + 1} of ${totalFiles})...`
    );

    let compressedBlob;

    if (window.imageCompression) {
      try {
        const options = {
          maxSizeMB: 20,
          maxWidthOrHeight: maxWidth || 4096,
          useWebWorker: false, // Set false for stable execution on local file protocol
          initialQuality: quality
        };
        compressedBlob = await window.imageCompression(file, options);
      } catch (e) {
        console.warn('Fallback to canvas compression:', e);
        compressedBlob = await compressImageViaCanvas(file, quality, maxWidth);
      }
    } else {
      compressedBlob = await compressImageViaCanvas(file, quality, maxWidth);
    }

    totalCompressedBytes += compressedBlob.size;
    compressedResults.push({
      blob: compressedBlob,
      name: file.name
    });
  }

  const percentSaved = Math.max(0, Math.round(((totalOriginalBytes - totalCompressedBytes) / totalOriginalBytes) * 100));

  if (compressedResults.length === 1) {
    const res = compressedResults[0];
    finishProcessing(
      res.blob,
      `compressed_${res.name}`,
      'Image Compressed Successfully',
      [
        { label: 'Original Size', value: formatBytes(totalOriginalBytes) },
        { label: 'Compressed Size', value: formatBytes(res.blob.size) },
        { label: 'Space Saved', value: `${percentSaved}%`, highlight: true }
      ]
    );
  } else {
    updateProgress(92, 'Packaging ZIP archive...');
    const zip = new JSZip();
    compressedResults.forEach(item => {
      zip.file(`compressed_${item.name}`, item.blob);
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    finishProcessing(
      zipBlob,
      'convertx_compressed_images.zip',
      'Batch Images Compressed',
      [
        { label: 'Files Processed', value: totalFiles },
        { label: 'Original Total', value: formatBytes(totalOriginalBytes) },
        { label: 'New Total', value: formatBytes(totalCompressedBytes) },
        { label: 'Total Saved', value: `${percentSaved}%`, highlight: true }
      ]
    );
  }
}

/**
 * Pure Canvas-based image compression fallback
 */
function compressImageViaCanvas(file, quality, maxWidth) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (maxWidth && width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const outMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas compression returned null.'));
        }, outMime, quality);
      };
      img.onerror = () => reject(new Error('Failed to load image for canvas compression.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

/* ============================================================================
   Tool 5: PDF to JPG / PNG
   ============================================================================ */
async function executePdfToImages() {
  updateProgress(15, 'Loading PDF document...');
  const format = document.getElementById('opt-render-fmt')?.value || 'jpeg';
  const scale = parseFloat(document.getElementById('opt-render-scale')?.value) || 1.5;

  const mime = format === 'png' ? 'image/png' : 'image/jpeg';
  const ext = format === 'png' ? 'png' : 'jpg';

  if (!window.pdfjsLib) {
    throw new Error('PDF.js renderer is not loaded. Please ensure you are connected to the internet.');
  }

  const loadingTask = pdfjsLib.getDocument({ data: ConvertX.currentPdfBuffer });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  const renderedBlobs = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    updateProgress(
      15 + Math.round((pageNum / numPages) * 75),
      `Rendering page ${pageNum} of ${numPages} (${ext.toUpperCase()})...`
    );

    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    await page.render({ canvasContext: ctx, viewport }).promise;

    const blob = await new Promise(res => canvas.toBlob(res, mime, 0.92));
    renderedBlobs.push({ pageNum, blob });
  }

  if (renderedBlobs.length === 1) {
    finishProcessing(
      renderedBlobs[0].blob,
      `page_1.${ext}`,
      'PDF Page Converted to Image',
      [
        { label: 'Page Number', value: '1 of 1' },
        { label: 'Format', value: ext.toUpperCase() },
        { label: 'File Size', value: formatBytes(renderedBlobs[0].blob.size) }
      ]
    );
  } else {
    updateProgress(93, 'Archiving images into ZIP...');
    const zip = new JSZip();
    renderedBlobs.forEach(item => {
      zip.file(`page_${item.pageNum}.${ext}`, item.blob);
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    finishProcessing(
      zipBlob,
      'convertx_pdf_pages.zip',
      'All Pages Rendered to Images',
      [
        { label: 'Total Pages', value: numPages },
        { label: 'Format', value: ext.toUpperCase() },
        { label: 'Archive Size', value: formatBytes(zipBlob.size) }
      ]
    );
  }
}

/* ============================================================================
   Tool 6: Split PDF
   ============================================================================ */
async function executeSplitPdf() {
  updateProgress(20, 'Reading PDF structure...');
  const { PDFDocument } = PDFLib;
  const originalDoc = await PDFDocument.load(ConvertX.currentPdfBuffer);
  const totalPages = originalDoc.getPageCount();

  const mode = document.getElementById('opt-split-mode')?.value || 'range';

  if (mode === 'all-pages') {
    const zip = new JSZip();

    for (let i = 0; i < totalPages; i++) {
      updateProgress(
        20 + Math.round(((i + 1) / totalPages) * 70),
        `Extracting page ${i + 1} of ${totalPages}...`
      );

      const singleDoc = await PDFDocument.create();
      const [copiedPage] = await singleDoc.copyPages(originalDoc, [i]);
      singleDoc.addPage(copiedPage);

      const bytes = await singleDoc.save();
      zip.file(`page_${i + 1}.pdf`, bytes);
    }

    updateProgress(95, 'Building ZIP archive...');
    const zipBlob = await zip.generateAsync({ type: 'blob' });

    finishProcessing(
      zipBlob,
      'convertx_split_all_pages.zip',
      'PDF Split into Individual Pages',
      [
        { label: 'Extracted Pages', value: totalPages },
        { label: 'ZIP Size', value: formatBytes(zipBlob.size) }
      ]
    );

  } else {
    const rangeStr = document.getElementById('opt-split-range')?.value.trim();
    if (!rangeStr) {
      showToast('Please specify a page range (e.g. 1-3, 5).', 'warning');
      throw new Error('No range provided.');
    }

    const pagesToExtract = parsePageRangeString(rangeStr, totalPages);
    if (pagesToExtract.length === 0) {
      showToast('Invalid page range entered.', 'error');
      throw new Error('Invalid range.');
    }

    updateProgress(50, `Extracting ${pagesToExtract.length} pages...`);
    const newDoc = await PDFDocument.create();
    const indicesToCopy = pagesToExtract.map(p => p - 1);
    const copiedPages = await newDoc.copyPages(originalDoc, indicesToCopy);
    copiedPages.forEach(p => newDoc.addPage(p));

    updateProgress(90, 'Saving extracted PDF...');
    const pdfBytes = await newDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });

    finishProcessing(
      blob,
      'convertx_extracted_pages.pdf',
      'Pages Extracted Successfully',
      [
        { label: 'Pages Extracted', value: pagesToExtract.length },
        { label: 'Range Query', value: rangeStr },
        { label: 'New File Size', value: formatBytes(blob.size) }
      ]
    );
  }
}

/* ============================================================================
   Tool 7: Rotate PDF Pages
   ============================================================================ */
async function executeRotatePdf() {
  updateProgress(25, 'Loading PDF document...');
  const { PDFDocument, degrees } = PDFLib;
  const pdfDoc = await PDFDocument.load(ConvertX.currentPdfBuffer);
  const pages = pdfDoc.getPages();

  let modifiedCount = 0;

  ConvertX.pdfPagesData.forEach((pageData, idx) => {
    if (pageData.rotation !== 0 && pages[idx]) {
      const page = pages[idx];
      const existingRot = page.getRotation().angle;
      page.setRotation(degrees((existingRot + pageData.rotation) % 360));
      modifiedCount++;
    }
  });

  // If no individual rotation but bulk rotated
  if (modifiedCount === 0 && pages.length > 0) {
    // Check if user clicked bulk without thumbnails
    pages.forEach(page => {
      const existingRot = page.getRotation().angle;
      page.setRotation(degrees((existingRot + 90) % 360));
    });
    modifiedCount = pages.length;
  }

  updateProgress(85, 'Rendering rotated pages...');
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });

  finishProcessing(
    blob,
    'convertx_rotated.pdf',
    'PDF Rotated Successfully',
    [
      { label: 'Total Pages', value: pages.length },
      { label: 'Rotated Pages', value: modifiedCount },
      { label: 'Output Size', value: formatBytes(blob.size) }
    ]
  );
}

/* ============================================================================
   Tool 8: Reorder PDF Pages
   ============================================================================ */
async function executeReorderPdf() {
  updateProgress(25, 'Loading original PDF...');
  const { PDFDocument } = PDFLib;
  const originalDoc = await PDFDocument.load(ConvertX.currentPdfBuffer);
  const newDoc = await PDFDocument.create();

  const newOrderIndices = ConvertX.pdfPagesData.map(p => p.originalIndex);

  updateProgress(60, 'Assembling pages in new sequence...');
  const copiedPages = await newDoc.copyPages(originalDoc, newOrderIndices);
  copiedPages.forEach(p => newDoc.addPage(p));

  updateProgress(90, 'Writing reordered document...');
  const pdfBytes = await newDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });

  finishProcessing(
    blob,
    'convertx_reordered.pdf',
    'Pages Reordered Successfully',
    [
      { label: 'Total Pages', value: newOrderIndices.length },
      { label: 'Output Size', value: formatBytes(blob.size) }
    ]
  );
}

/* ============================================================================
   Tool 9: Image Format Converter
   ============================================================================ */
async function executeConvertImages() {
  const targetFmt = document.getElementById('opt-conv-fmt')?.value || 'jpeg';
  const quality = parseInt(document.getElementById('opt-conv-quality')?.value || '85', 10) / 100;

  const mimeMap = {
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp'
  };
  const targetMime = mimeMap[targetFmt] || 'image/jpeg';
  const targetExt = targetFmt === 'jpeg' ? 'jpg' : targetFmt;

  const totalFiles = ConvertX.stagedFiles.length;
  const convertedItems = [];

  for (let i = 0; i < totalFiles; i++) {
    const file = ConvertX.stagedFiles[i];
    updateProgress(
      15 + Math.round(((i + 1) / totalFiles) * 75),
      `Converting ${file.name} to ${targetExt.toUpperCase()}...`
    );

    const convertedBlob = await convertImageToFormat(file, targetMime, quality);
    const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

    convertedItems.push({
      blob: convertedBlob,
      name: `${baseName}.${targetExt}`
    });
  }

  if (convertedItems.length === 1) {
    const item = convertedItems[0];
    finishProcessing(
      item.blob,
      item.name,
      'Image Format Converted',
      [
        { label: 'Target Format', value: targetExt.toUpperCase() },
        { label: 'Output Size', value: formatBytes(item.blob.size) }
      ]
    );
  } else {
    updateProgress(92, 'Creating ZIP archive...');
    const zip = new JSZip();
    convertedItems.forEach(item => {
      zip.file(item.name, item.blob);
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    finishProcessing(
      zipBlob,
      `convertx_converted_${targetExt}.zip`,
      'Batch Image Conversion Complete',
      [
        { label: 'Files Converted', value: totalFiles },
        { label: 'Target Format', value: targetExt.toUpperCase() },
        { label: 'Archive Size', value: formatBytes(zipBlob.size) }
      ]
    );
  }
}

/**
 * Universal canvas-based image format converter
 */
function convertImageToFormat(file, targetMime, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');

        if (targetMime === 'image/jpeg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.drawImage(img, 0, 0);

        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Format conversion failed.'));
        }, targetMime, quality);
      };
      img.onerror = () => reject(new Error('Failed to load image for format conversion.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

/* ============================================================================
   Tool 10: Resize Image
   ============================================================================ */
async function executeResizeImage() {
  const file = ConvertX.stagedFiles[0];
  const mode = document.getElementById('opt-resize-mode')?.value || 'dimensions';

  updateProgress(20, 'Reading original dimensions...');

  const img = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  let targetW, targetH;

  if (mode === 'percentage') {
    const pct = parseInt(document.getElementById('opt-resize-pct')?.value || '50', 10) / 100;
    targetW = Math.round(img.naturalWidth * pct);
    targetH = Math.round(img.naturalHeight * pct);
  } else {
    targetW = parseInt(document.getElementById('opt-resize-w')?.value, 10);
    targetH = parseInt(document.getElementById('opt-resize-h')?.value, 10);
  }

  if (!targetW || !targetH || targetW <= 0 || targetH <= 0) {
    showToast('Invalid target dimensions.', 'error');
    throw new Error('Invalid dimensions.');
  }

  updateProgress(60, `Scaling image to ${targetW} × ${targetH} px...`);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, targetW, targetH);

  updateProgress(85, 'Exporting resized image...');
  const outMime = file.type || 'image/jpeg';
  const resizedBlob = await new Promise(res => canvas.toBlob(res, outMime, 0.92));

  finishProcessing(
    resizedBlob,
    `resized_${file.name}`,
    'Image Resized Successfully',
    [
      { label: 'Original Dims', value: `${img.naturalWidth} × ${img.naturalHeight}` },
      { label: 'New Dims', value: `${targetW} × ${targetH}` },
      { label: 'Output Size', value: formatBytes(resizedBlob.size) }
    ]
  );
}

/* ============================================================================
   Tool 11: Add Watermark to PDF
   ============================================================================ */
async function executeWatermarkPdf() {
  updateProgress(20, 'Loading PDF document...');
  const { PDFDocument, rgb, degrees } = PDFLib;
  const pdfDoc = await PDFDocument.load(ConvertX.currentPdfBuffer);
  
  const fontName = PDFLib.StandardFonts ? PDFLib.StandardFonts.HelveticaBold : 'Helvetica-Bold';
  const font = await pdfDoc.embedFont(fontName);

  const text = document.getElementById('opt-wm-text')?.value.trim() || 'CONFIDENTIAL';
  const fontSize = parseInt(document.getElementById('opt-wm-size')?.value || '48', 10);
  const opacity = parseInt(document.getElementById('opt-wm-opacity')?.value || '30', 10) / 100;
  const colorChoice = document.getElementById('opt-wm-color')?.value || 'brown';
  const layout = document.getElementById('opt-wm-layout')?.value || 'diagonal';

  let colorRgb;
  switch (colorChoice) {
    case 'brown': colorRgb = rgb(111 / 255, 78 / 255, 55 / 255); break; // Coffee brown
    case 'blue': colorRgb = rgb(135 / 255, 206 / 255, 235 / 255); break; // Sky blue
    case 'red': colorRgb = rgb(211 / 255, 47 / 255, 47 / 255); break;
    case 'black': colorRgb = rgb(17 / 255, 17 / 255, 17 / 255); break;
    case 'gray':
    default: colorRgb = rgb(136 / 255, 136 / 255, 136 / 255); break;
  }

  const pages = pdfDoc.getPages();
  const totalPages = pages.length;

  for (let i = 0; i < totalPages; i++) {
    updateProgress(
      20 + Math.round(((i + 1) / totalPages) * 70),
      `Watermarking page ${i + 1} of ${totalPages}...`
    );

    const page = pages[i];
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const textHeight = font.heightAtSize(fontSize);

    const rotationAngle = layout === 'diagonal' ? 45 : 0;

    const x = (width - textWidth) / 2;
    const y = (height - textHeight) / 2;

    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color: colorRgb,
      opacity,
      rotate: degrees(rotationAngle)
    });
  }

  updateProgress(95, 'Saving watermarked document...');
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });

  finishProcessing(
    blob,
    'convertx_watermarked.pdf',
    'Watermark Applied Successfully',
    [
      { label: 'Watermark Text', value: `"${text}"` },
      { label: 'Pages Stamped', value: totalPages },
      { label: 'Output Size', value: formatBytes(blob.size) }
    ]
  );
}

/* ============================================================================
   Tool 12: Add Page Numbers to PDF
   ============================================================================ */
async function executePageNumbersPdf() {
  updateProgress(20, 'Loading PDF document...');
  const { PDFDocument, rgb } = PDFLib;
  const pdfDoc = await PDFDocument.load(ConvertX.currentPdfBuffer);
  
  const fontName = PDFLib.StandardFonts ? PDFLib.StandardFonts.Helvetica : 'Helvetica';
  const font = await pdfDoc.embedFont(fontName);

  const format = document.getElementById('opt-num-format')?.value || 'page-x-of-y';
  const pos = document.getElementById('opt-num-pos')?.value || 'bottom-center';
  const fontSize = parseInt(document.getElementById('opt-num-size')?.value || '12', 10);
  const startNum = parseInt(document.getElementById('opt-num-start')?.value || '1', 10);

  const pages = pdfDoc.getPages();
  const totalPages = pages.length;
  const marginFromEdge = 25; // pts

  for (let i = 0; i < totalPages; i++) {
    updateProgress(
      20 + Math.round(((i + 1) / totalPages) * 70),
      `Numbering page ${i + 1} of ${totalPages}...`
    );

    const page = pages[i];
    const { width, height } = page.getSize();
    const currentNum = startNum + i;

    let textStr = '';
    switch (format) {
      case 'page-x-of-y': textStr = `Page ${currentNum} of ${totalPages + startNum - 1}`; break;
      case 'page-x': textStr = `Page ${currentNum}`; break;
      case 'x-of-y': textStr = `${currentNum} / ${totalPages + startNum - 1}`; break;
      case 'x-only':
      default: textStr = `${currentNum}`; break;
    }

    const textWidth = font.widthOfTextAtSize(textStr, fontSize);
    const textHeight = font.heightAtSize(fontSize);

    let x = marginFromEdge;
    let y = marginFromEdge;

    if (pos.includes('center')) {
      x = (width - textWidth) / 2;
    } else if (pos.includes('right')) {
      x = width - marginFromEdge - textWidth;
    } else {
      x = marginFromEdge;
    }

    if (pos.includes('top')) {
      y = height - marginFromEdge - textHeight;
    } else {
      y = marginFromEdge;
    }

    page.drawText(textStr, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(17 / 255, 17 / 255, 17 / 255)
    });
  }

  updateProgress(95, 'Writing numbered PDF...');
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });

  finishProcessing(
    blob,
    'convertx_numbered.pdf',
    'Page Numbers Added Successfully',
    [
      { label: 'Total Pages', value: totalPages },
      { label: 'Format Style', value: format },
      { label: 'Output Size', value: formatBytes(blob.size) }
    ]
  );
}

/* ============================================================================
   Tool 13: Text to PDF (via jsPDF)
   ============================================================================ */
async function executeTextToPdf() {
  const textContent = document.getElementById('opt-text-content')?.value.trim();
  if (!textContent) {
    showToast('Please enter or paste some text content.', 'warning');
    throw new Error('Text content is empty.');
  }

  updateProgress(30, 'Formatting document layout...');
  const title = document.getElementById('opt-doc-title')?.value.trim();
  const fontFamily = document.getElementById('opt-text-font')?.value || 'helvetica';
  const fontSize = parseInt(document.getElementById('opt-text-size')?.value || '12', 10);

  const jsPDFConstructor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
  if (!jsPDFConstructor) {
    throw new Error('jsPDF library is not loaded. Please verify internet connection.');
  }

  const doc = new jsPDFConstructor({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const margin = 20; // 20mm margin
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxLineWidth = pageWidth - margin * 2;

  let currentY = margin;

  if (title) {
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(fontSize + 6);
    doc.setTextColor(111, 78, 55); // Coffee brown title
    doc.text(title, margin, currentY);
    currentY += 12;
  }

  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(fontSize);
  doc.setTextColor(17, 17, 17); // Body black

  const splitLines = doc.splitTextToSize(textContent, maxLineWidth);
  const lineHeight = fontSize * 0.45;

  for (let i = 0; i < splitLines.length; i++) {
    if (currentY + lineHeight > pageHeight - margin) {
      doc.addPage();
      currentY = margin;
    }
    doc.text(splitLines[i], margin, currentY);
    currentY += lineHeight;
  }

  updateProgress(90, 'Generating PDF file...');
  const blob = doc.output('blob');

  finishProcessing(
    blob,
    'convertx_document.pdf',
    'Text to PDF Converted',
    [
      { label: 'Pages Created', value: doc.getNumberOfPages() },
      { label: 'Lines Formatted', value: splitLines.length },
      { label: 'File Size', value: formatBytes(blob.size) }
    ]
  );
}

/* ============================================================================
   Tool 14: QR Code & Base64 Generator
   ============================================================================ */
async function executeQrOrBase64() {
  const activeSubtab = document.querySelector('.radio-cards-group .radio-card.active')?.getAttribute('data-subtab');

  if (activeSubtab === 'qr') {
    const textToEncode = document.getElementById('opt-qr-text')?.value.trim();
    if (!textToEncode) {
      showToast('Please enter text or a URL to generate QR code.', 'warning');
      throw new Error('Empty QR text.');
    }

    updateProgress(40, 'Rendering QR matrix...');
    const size = parseInt(document.getElementById('opt-qr-size')?.value || '256', 10);
    const color = document.getElementById('opt-qr-color')?.value || '#6F4E37';

    if (!window.QRCode) {
      throw new Error('QRCode.js library is not available.');
    }

    const qrContainer = document.createElement('div');
    new QRCode(qrContainer, {
      text: textToEncode,
      width: size,
      height: size,
      colorDark: color,
      colorLight: '#FFFFFF',
      correctLevel: QRCode.CorrectLevel.H
    });

    await new Promise(r => setTimeout(r, 150));

    const canvas = qrContainer.querySelector('canvas');
    if (!canvas) throw new Error('QRCode render canvas failed.');

    const qrBlob = await new Promise(res => canvas.toBlob(res, 'image/png'));

    finishProcessing(
      qrBlob,
      'convertx_qrcode.png',
      'QR Code Generated',
      [
        { label: 'Resolution', value: `${size} × ${size} px` },
        { label: 'Content Encoded', value: textToEncode.substring(0, 30) + (textToEncode.length > 30 ? '...' : '') }
      ]
    );

  } else {
    if (ConvertX.stagedFiles.length === 0) {
      showToast('Please upload an image to convert to Base64.', 'warning');
      throw new Error('No image staged.');
    }

    const file = ConvertX.stagedFiles[0];
    updateProgress(50, 'Encoding binary data to Base64 string...');

    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });

    const base64String = dataUrl.split(',')[1];
    const textBlob = new Blob([dataUrl], { type: 'text/plain' });

    finishProcessing(
      textBlob,
      'convertx_base64.txt',
      'Image Converted to Base64',
      [
        { label: 'Original Size', value: formatBytes(file.size) },
        { label: 'Base64 Length', value: `${base64String.length.toLocaleString()} chars` }
      ]
    );
  }
}

/* ============================================================================
   Common Completion & Result Handling
   ============================================================================ */

/**
 * Common completion handler: updates progress, sets download link and renders stats
 * @param {Blob} blob - Output file Blob
 * @param {string} fileName - Suggested filename
 * @param {string} title - Success title
 * @param {Array<{label: string, value: any, highlight?: boolean}>} stats 
 */
function finishProcessing(blob, fileName, title, stats = []) {
  updateProgress(100, 'Processing complete!');

  ConvertX.resultBlob = blob;
  ConvertX.resultFileName = fileName;

  setTimeout(() => {
    const progressContainer = document.getElementById('progress-container');
    const resultsContainer = document.getElementById('results-container');
    const resultTitle = document.getElementById('result-title');
    const resultStats = document.getElementById('result-stats');
    const downloadBtn = document.getElementById('download-result-btn');

    if (progressContainer) progressContainer.classList.add('hidden');
    if (resultsContainer) resultsContainer.classList.remove('hidden');

    if (resultTitle) resultTitle.textContent = title;

    // Render Stats
    if (resultStats) {
      resultStats.innerHTML = '';
      stats.forEach(stat => {
        const box = document.createElement('div');
        box.className = 'stat-box';
        box.innerHTML = `
          <span class="stat-label">${stat.label}</span>
          <span class="stat-value ${stat.highlight ? 'highlight-saved' : ''}">${stat.value}</span>
        `;
        resultStats.appendChild(box);
      });
    }

    // Configure Download Button
    if (downloadBtn) {
      const url = URL.createObjectURL(blob);
      downloadBtn.href = url;
      downloadBtn.download = fileName;
    }

    showToast('Task completed! Ready for download.', 'success');
  }, 400);
}

/**
 * Updates progress bar percentage and status label
 * @param {number} percent - 0 to 100
 * @param {string} statusText - Description of current step
 */
function updateProgress(percent, statusText) {
  const fill = document.getElementById('progress-fill');
  const percentText = document.getElementById('progress-percent');
  const statusElem = document.getElementById('progress-status');

  if (fill) fill.style.width = `${percent}%`;
  if (percentText) percentText.textContent = `${percent}%`;
  if (statusElem && statusText) statusElem.textContent = statusText;
}

/* ============================================================================
   Toast Notification System
   ============================================================================ */

/**
 * Displays a toast notification on the top right
 * @param {string} message - Message text
 * @param {'success'|'error'|'info'|'warning'} type - Toast type
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconMap = {
    success: 'fa-circle-check',
    error: 'fa-circle-exclamation',
    warning: 'fa-triangle-exclamation',
    info: 'fa-circle-info'
  };

  toast.innerHTML = `
    <i class="fa-solid ${iconMap[type] || 'fa-bell'}"></i>
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close-btn" aria-label="Dismiss toast">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;

  const timer = setTimeout(() => {
    dismissToast(toast);
  }, 4000);

  const closeBtn = toast.querySelector('.toast-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      clearTimeout(timer);
      dismissToast(toast);
    });
  }

  container.appendChild(toast);
}

function dismissToast(toast) {
  toast.style.opacity = '0';
  toast.style.transform = 'translateX(50px)';
  setTimeout(() => {
    if (toast.parentElement) toast.remove();
  }, 250);
}

/* ============================================================================
   Helper Utility Functions
   ============================================================================ */

/**
 * Formats bytes to human-readable size string (KB, MB, GB)
 * @param {number} bytes 
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Sanitizes HTML input for safety
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Parses page range syntax (e.g. "1, 3-5, 8") into an array of distinct page numbers
 * @param {string} rangeStr 
 * @param {number} maxPage 
 * @returns {number[]} Array of 1-based page numbers
 */
function parsePageRangeString(rangeStr, maxPage) {
  const result = new Set();
  const parts = rangeStr.split(',');

  for (let part of parts) {
    part = part.trim();
    if (!part) continue;

    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);

      if (!isNaN(start) && !isNaN(end)) {
        const min = Math.max(1, Math.min(start, end));
        const max = Math.min(maxPage, Math.max(start, end));
        for (let i = min; i <= max; i++) {
          result.add(i);
        }
      }
    } else {
      const single = parseInt(part, 10);
      if (!isNaN(single) && single >= 1 && single <= maxPage) {
        result.add(single);
      }
    }
  }

  return Array.from(result).sort((a, b) => a - b);
}

/**
 * Formats a list of page numbers into clean range syntax (e.g. [1, 2, 3, 5] -> "1-3, 5")
 * @param {number[]} numbers 
 * @returns {string}
 */
function formatNumberListToRanges(numbers) {
  if (!numbers || numbers.length === 0) return '';
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  const ranges = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i <= sorted.length; i++) {
    const current = sorted[i];
    if (current === prev + 1) {
      prev = current;
    } else {
      if (start === prev) {
        ranges.push(`${start}`);
      } else {
        ranges.push(`${start}-${prev}`);
      }
      start = current;
      prev = current;
    }
  }

  return ranges.join(', ');
}
