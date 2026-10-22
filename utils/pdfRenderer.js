'use client';

import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// NEW APPROACH: Full HTML template for iframe - exact same as localhost:3001
const PDF_HTML_TEMPLATE = (pageContent, pageIndex) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Odito AI Report - Page ${pageIndex + 1}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap" rel="stylesheet" />
  
  <!-- PDF Ready System - Initialize in PARENT window -->
  <script>
    /**
     * Global PDF Ready Signal System
     * 
     * CRITICAL: Initialize in PARENT window, not iframe!
     * Components and renderer expect it in parent context.
     */
    (function() {
      'use strict';

      // Determine target window (parent for iframe, current for standalone)
      const targetWindow = window.parent && window.parent !== window ? window.parent : window;
      
      // Only initialize once
      if (targetWindow.__PDF_READY__) {
        return;
      }

      // Initialize PDF Ready System in target window
      targetWindow.__PDF_READY__ = {
        components: {},
        
        register: function(name) {
          if (!this.components[name]) {
            this.components[name] = { ready: false };
          }
        },
        
        markReady: function(name) {
          if (!this.components[name]) {
            this.components[name] = {};
          }
          this.components[name].ready = true;
          
          // Check if all components are ready
          if (this.isAllReady()) {
            targetWindow.__PDF_ALL_READY__ = true;
          }
        },
        
        isAllReady: function() {
          return Object.values(this.components).every(c => c.ready);
        },
        
        getStatus: function() {
          const componentList = Object.entries(this.components).map(([id, comp]) => ({
            id: id,
            name: id,
            ready: comp.ready
          }));
          
          const readyCount = componentList.filter(c => c.ready).length;
          const totalCount = componentList.length;
          
          return {
            allReady: this.isAllReady(),
            readyCount: readyCount,
            totalCount: totalCount,
            components: componentList
          };
        },
        
        reset: function() {
          this.components = {};
          targetWindow.__PDF_ALL_READY__ = false;
        }
      };

      // Initialize global flag
      targetWindow.__PDF_ALL_READY__ = false;
      
      // Debug logs
      
      // Legacy compatibility - expose old API
      targetWindow.__PDF_REGISTER_COMPONENT__ = function(id, name) {
        targetWindow.__PDF_READY__.register(name || id);
      };
      
      targetWindow.__PDF_SET_READY__ = function(id, ready, name) {
        if (ready) {
          targetWindow.__PDF_READY__.markReady(name || id);
        }
      };
      
      targetWindow.__PDF_GET_STATUS__ = function() {
        return targetWindow.__PDF_READY__.getStatus();
      };
      
      targetWindow.__PDF_RESET_READY__ = function() {
        targetWindow.__PDF_READY__.reset();
      };
    })();
  </script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap');

    :root {
      --bg-dark: #070B1A;
      --bg-card: #0F1428;
      --bg-card2: #111830;
      --bg-section: #0D1235;
      --accent-blue: #4F6EF7;
      --accent-cyan: #00D4FF;
      --accent-purple: #7B5CF0;
      --text-primary: #FFFFFF;
      --text-secondary: #8892C4;
      --text-muted: #4A5280;
      --border: rgba(79,110,247,0.2);
      --border-light: rgba(255,255,255,0.07);
      --red: #FF5A5A;
      --orange: #FF9C41;
      --yellow: #FFD166;
      --green: #2DD4A0;
      --blue-light: #60A5FA;

      /* Light page vars */
      --page-bg: #FFFFFF;
      --page-text: #111827;
      --page-muted: #6B7280;
      --page-border: #E5E7EB;
      --page-card: #F9FAFB;
      --page-header-bg: #111827;
      
      /* Font families */
      --font-display: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
      --font-body: 'DM Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
    }

    * { 
      box-sizing: border-box; 
      margin: 0; 
      padding: 0;
      font-family: var(--font-body) !important;
    }

    html, body {
      font-family: var(--font-body);
      background: #fff;
      color: #111827;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    h1, h2, h3, h4, h5, h6 {
      font-family: var(--font-display);
    }

    /* Ensure all text elements use the correct fonts */
    p, span, div, a, button, label, input, textarea, select {
      font-family: var(--font-body);
    }

    button, input, textarea, select {
      font-family: var(--font-body);
    }

    /* Font-loaded classes for conditional letter-spacing */
    .font-loaded .letter-spacing-neg1 { letter-spacing: -1px; }
    .font-loaded .letter-spacing-neg10 { letter-spacing: -10px; }
    .font-loaded .letter-spacing-1 { letter-spacing: 1px; }
    .font-loaded .letter-spacing-2 { letter-spacing: 2px; }

    body {
      margin: 0;
      padding: 0;
      background: #fff;
    }
  </style>
</head>
<body>
  <div id="root" class="font-loaded">
    ${pageContent}
  </div>
</body>
</html>
`;

/**
 * Add inline component registration and ready calls to HTML
 */
function addInlineComponentRegistration(pageContent, pageIndex, registration = null) {
  // Define component mappings based on page index
  // Full Website Audit pages pass an explicit `registration` ({ id, name,
  // needsData }) taken from pdf/src/reportPages.jsx, so they no longer depend on
  // fixed page indices. Only the Homepage Audit pages (indices 30-41) are
  // looked up here.
  const componentMap = {
    // Homepage Audit PDF pages (indices 30-41). They have no `registration`, so
    // needsDataFetch is false, which is correct: these pages take pre-fetched
    // pdfData as a prop and never fetch internally, so they are ready as soon
    // as they render.
    //
    // V3 architecture: one major topic per page (was 8 pages with 3 of them
    // combining two unrelated topics each — Score+OnPage, Technical+Security,
    // Performance+Accessibility — which caused Chrome's print fragmentation
    // to split those pages unpredictably as issue counts grew). Now 12 pages
    // (the closing CTA section is itself split across 30-40/30-41 — cards
    // 1-3 alone, then cards 4-6 + closing copy + button — since the single
    // combined version was overflowing onto an extra physical page).
    30: { id: 'homepage-cover-score-overview', name: 'Homepage Cover & Score Overview' },
    31: { id: 'homepage-score-breakdown', name: 'Homepage Score Breakdown' },
    32: { id: 'homepage-on-page-seo', name: 'Homepage On Page SEO' },
    33: { id: 'homepage-technical-seo', name: 'Homepage Technical SEO' },
    34: { id: 'homepage-security-audit', name: 'Homepage Security Audit' },
    35: { id: 'homepage-ai-visibility-geo', name: 'Homepage AI Visibility & GEO' },
    36: { id: 'homepage-performance', name: 'Homepage Performance & Core Web Vitals' },
    37: { id: 'homepage-accessibility', name: 'Homepage Accessibility' },
    38: { id: 'homepage-social-profiles', name: 'Homepage Social Profiles' },
    39: { id: 'homepage-local-business', name: 'Homepage Local Business Presence' },
    40: { id: 'homepage-audit-benefits', name: 'Homepage Audit Benefits' },
    41: { id: 'homepage-final-cta', name: 'Homepage Final CTA' },
  };

  const component = registration || componentMap[pageIndex];
  if (!component) {
    return pageContent;
  }

  // Add inline registration and ready script at the beginning of the content
  const inlineScript = `
    <script>
      (function() {
        // Helper to get correct PDF window (parent for iframe context)
        var getPDFWindow = function() {
          return window.parent && window.parent !== window ? window.parent : window;
        };
        
        var pdfWindow = getPDFWindow();
        
        // Debug: Check if system exists
        
        if (pdfWindow.__PDF_READY__) {
          pdfWindow.__PDF_READY__.register('${component.name}');
        } else if (pdfWindow.__PDF_REGISTER_COMPONENT__) {
          pdfWindow.__PDF_REGISTER_COMPONENT__('${component.id}', '${component.name}');
        } else {
        }
        
        // For pages that don't fetch data, mark as ready immediately
        // For pages that fetch data, they'll call SET_READY when done
        var needsDataFetch = ${registration?.needsData ? 'true' : 'false'};
        
        if (!needsDataFetch) {
          if (pdfWindow.__PDF_READY__) {
            pdfWindow.__PDF_READY__.markReady('${component.name}');
          } else if (pdfWindow.__PDF_SET_READY__) {
            pdfWindow.__PDF_SET_READY__('${component.id}', true, '${component.name}');
          } else {
          }
        } else {
        }
      })();
    </script>
  `;

  return inlineScript + pageContent;
}

/**
 * Utility for rendering React components to PDF
 */
export class PDFRenderer {
  constructor() {
    this.container = null;
    this.pdf = null;
  }

  /**
   * NEW APPROACH: Initialize PDF document
   */
  initialize() {
    // Create PDF document (A4 size)
    this.pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    return this.pdf;
  }

  /**
   * NEW APPROACH: Render React component in iframe and capture
   *
   * @param {ReactNode} component
   * @param {number} pageIndex
   * @param {number} totalPages
   * @param {object} [options] - Capture size/background overrides. Defaults
   *   preserve Full Audit's exact original behavior (960x1280, white bg)
   *   for any existing call site that doesn't pass this argument. Homepage
   *   Audit passes its own theme's real A4 dimensions here instead of
   *   resizing its page components to match Full Audit's fixed size.
   * @param {number} [options.width=960]
   * @param {number} [options.height=1280]
   * @param {string} [options.backgroundColor='#ffffff']
   */
  async renderComponent(component, pageIndex, totalPages, options = {}) {
    const { width = 960, height = 1280, backgroundColor = '#ffffff', registration = null } = options;

    return new Promise(async (resolve, reject) => {
      let iframe = null;

      try {

        // Create hidden iframe
        iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.left = '-9999px';
        iframe.style.top = '0';
        iframe.style.width = `${width}px`;
        iframe.style.height = `${height}px`;
        iframe.style.border = 'none';
        iframe.style.overflow = 'hidden';

        document.body.appendChild(iframe);

        // Wait for iframe to load
        await new Promise((resolve) => {
          iframe.onload = resolve;
          // Some browsers need a small delay
          setTimeout(resolve, 100);
        });

        // Get iframe document
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;


        // Render React component to HTML string
        const tempContainer = document.createElement('div');
        tempContainer.style.width = `${width}px`;
        tempContainer.style.minHeight = `${height}px`;
        tempContainer.style.background = backgroundColor;
        tempContainer.style.fontFamily = "'DM Sans', sans-serif";
        tempContainer.style.position = 'relative';
        tempContainer.className = 'font-loaded';

        const root = createRoot(tempContainer);
        root.render(component);

        // Wait for React to render
        await new Promise(resolve => setTimeout(resolve, 200));

        // Get the rendered HTML
        const pageContent = tempContainer.innerHTML;

        // Clean up React root
        root.unmount();

        // Write full HTML to iframe with inline component registration
        const pageWithRegistration = addInlineComponentRegistration(pageContent, pageIndex, registration);
        iframeDoc.open();
        iframeDoc.write(PDF_HTML_TEMPLATE(pageWithRegistration, pageIndex));
        iframeDoc.close();

        // Give PDF ready system time to initialize
        await new Promise(resolve => setTimeout(resolve, 50));

        // CRITICAL: Wait for page to be ready (data loaded) BEFORE font loading

        // Debug: Check window contexts

        await new Promise((resolve, reject) => {
          const maxTime = 30000;
          const start = Date.now();

          const checkReady = () => {
            // Check parent window for ready state (NEW: system is in parent)
            const isReady = window.__PDF_ALL_READY__;

            if (isReady === true) {
              resolve();
            } else if (Date.now() - start > maxTime) {
              const status = window.__PDF_GET_STATUS__?.();
              const statusStr = status ? ` (${status.readyCount}/${status.totalCount} components ready)` : '';
              reject(new Error(`PDF render timeout: data not ready after ${maxTime}ms${statusStr}`));
            } else {
              // Log status every 2 seconds
              const waited = Date.now() - start;
              if (waited % 2000 === 0) {
                const status = window.__PDF_GET_STATUS__?.();
                if (status) {
                } else {
                }
              }
              setTimeout(checkReady, 100);
            }
          };

          checkReady();
        });

        // Now wait for fonts to load AFTER data is ready.
        //
        // Font readiness gate: `.load('1em Inter')` alone only requests the
        // 400 weight (no weight descriptor in the shorthand = 'normal').
        // This page set uses fontWeight 700/800 heavily (Brand Name, section
        // headers, score values, severity/status badges) — those faces were
        // being captured before they'd actually loaded, confirmed via
        // document.fonts.check('700'/'800' ... 'Inter') both returning false
        // at the moment html2canvas() ran. Explicitly request every weight
        // this page set uses, then gate on document.fonts.check() for each
        // (not just the load() promises resolving) before capturing.
        const fontsDoc = iframe.contentWindow.document;
        await Promise.all([
          fontsDoc.fonts.load('400 1em Inter'),
          fontsDoc.fonts.load('700 1em Inter'),
          fontsDoc.fonts.load('800 1em Inter'),
          fontsDoc.fonts.load('1em DM Sans'),
          fontsDoc.fonts.ready
        ]);

        await new Promise((resolveFonts) => {
          const maxFontWait = 5000;
          const fontWaitStart = Date.now();
          const checkFontsReady = () => {
            const inter700Ready = fontsDoc.fonts.check('700 1em Inter');
            const inter800Ready = fontsDoc.fonts.check('800 1em Inter');
            if ((inter700Ready && inter800Ready) || Date.now() - fontWaitStart > maxFontWait) {
              resolveFonts();
            } else {
              setTimeout(checkFontsReady, 50);
            }
          };
          checkFontsReady();
        });

        console.log('[PDF Renderer] Font status before capture:', {
          pageIndex,
          inter400: fontsDoc.fonts.check('400 1em Inter'),
          inter700: fontsDoc.fonts.check('700 1em Inter'),
          inter800: fontsDoc.fonts.check('800 1em Inter'),
        });

        // Capture iframe body
        const canvas = await html2canvas(iframeDoc.body, {
          width,
          height,
          scale: 2, // Retina quality
          useCORS: true,
          allowTaint: true,
          backgroundColor,
          logging: false,
          removeContainer: false,
          foreignObjectRendering: false,
          imageTimeout: 15000,
          // No onclone needed - iframe already has proper fonts and CSS
          onclone: null
        });

        resolve(canvas);

      } catch (error) {
        reject(error);
      } finally {
        // Clean up iframe
        if (iframe && iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }
    });
  }

  /**
   * Add canvas to PDF
   */
  addCanvasToPDF(canvas, isFirstPage = false) {
    if (!this.pdf) {
      throw new Error('PDF not initialized');
    }

    // Add new page if not first
    if (!isFirstPage) {
      this.pdf.addPage();
    }

    const pageWidth = this.pdf.internal.pageSize.getWidth();
    const pageHeight = this.pdf.internal.pageSize.getHeight();

    // Calculate dimensions to fit A4 page
    const imgWidth = pageWidth;
    let imgHeight = (canvas.height * imgWidth) / canvas.width;
    // A4-ratio captures (Full Audit) fill the page exactly; the <0.5% difference
    // from integer pixel rounding is absorbed instead of leaving a sliver.
    if (Math.abs(imgHeight - pageHeight) / pageHeight < 0.005) imgHeight = pageHeight;

    // Add image to PDF
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    this.pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
  }

  /**
   * Save PDF with filename
   */
  save(filename) {
    if (!this.pdf) {
      throw new Error('PDF not initialized');
    }
    this.pdf.save(filename);
  }

  /**
   * Get PDF as blob (for API responses)
   */
  getBlob() {
    if (!this.pdf) {
      throw new Error('PDF not initialized');
    }

    // Convert jsPDF to blob
    const pdfOutput = this.pdf.output('blob');
    return pdfOutput;
  }

  /**
   * NEW APPROACH: Clean up resources
   */
  cleanup() {
    // No persistent container to clean up with iframe approach
    this.pdf = null;
  }
}

export default PDFRenderer;
