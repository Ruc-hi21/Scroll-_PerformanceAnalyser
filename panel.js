const perfDebugButton  = document.getElementById('perfDebugButton');
  const perfPanel        = document.getElementById('perfPanel');
  const perfPanelClose   = document.getElementById('perfPanelClose');
  const runReflowBtn     = document.getElementById('runReflowBtn');
  const reflowOutput     = document.getElementById('reflowOutput');
  const runPaintBtn      = document.getElementById('runPaintBtn');
  const paintOutput      = document.getElementById('paintOutput');
  const scrollModeSelect = document.getElementById('scrollModeSelect');
  const scrollModeStats  = document.getElementById('scrollModeStats');

  function togglePerfPanel(forceOpen) {
    if (!perfPanel) return;
    const isVisible = perfPanel.classList.contains('perf-panel--visible');
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !isVisible;

    if (shouldOpen) {
      perfPanel.classList.add('perf-panel--visible');
      perfPanel.classList.remove('perf-panel--hidden');
      perfPanel.setAttribute('aria-hidden', 'false');
    } else {
      perfPanel.classList.remove('perf-panel--visible');
      perfPanel.classList.add('perf-panel--hidden');
      perfPanel.setAttribute('aria-hidden', 'true');
    }
  }

  if (perfDebugButton) {
    perfDebugButton.addEventListener('click', () => togglePerfPanel());
  }
  if (perfPanelClose) {
    perfPanelClose.addEventListener('click', () => togglePerfPanel(false));
  }

  
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
      e.preventDefault();
      togglePerfPanel();
    }
  });

  // Forced Reflow Detector 
  function runForcedReflowScan() {
    if (!testContent) {
      reflowOutput.textContent = 'No local test grid available.';
      return;
    }
    const tiles = testContent.querySelectorAll('.tile');
    if (!tiles.length) {
      reflowOutput.textContent = 'No tiles to scan.';
      return;
    }

    const t0 = performance.now();
    let totalHeight = 0;
    tiles.forEach(tile => {
      totalHeight += tile.offsetHeight;
    });
    const t1 = performance.now();

    const total = (t1 - t0);
    const perTile = total / tiles.length;
    const severity =
      total > 32 ? 'HIGH (expensive layout)' :
      total > 16 ? 'MEDIUM' :
      'OK';

    reflowOutput.textContent =
      `${total.toFixed(2)}ms total, ` +
      `${perTile.toFixed(3)}ms/tile → ${severity}. ` +
      `(sum height: ${totalHeight})`;
  }

  if (runReflowBtn && reflowOutput) {
    runReflowBtn.addEventListener('click', runForcedReflowScan);
  }

  // Paint Cost Estimator 
  function runPaintCostEstimate() {
    if (!testContent) {
      paintOutput.textContent = 'No local test grid available.';
      return;
    }
    const tiles = testContent.querySelectorAll('.tile');
    if (!tiles.length) {
      paintOutput.textContent = 'No tiles to test.';
      return;
    }


    const t0 = performance.now();
    tiles.forEach(tile => tile.classList.add('paint-test'));
    void testContent.offsetHeight; 
    const t1 = performance.now();

    
    tiles.forEach(tile => tile.classList.remove('paint-test'));
    void testContent.offsetHeight;
    const t2 = performance.now();

    const addCost = t1 - t0;
    const removeCost = t2 - t1;
    const avgCost = (addCost + removeCost) / 2;

    const severity =
      avgCost > 32 ? 'VERY HIGH' :
      avgCost > 16 ? 'HIGH' :
      avgCost > 8  ? 'MEDIUM' :
      'LOW';

    paintOutput.textContent =
      `avg ~${avgCost.toFixed(2)}ms per toggle ` +
      `(add: ${addCost.toFixed(2)}ms, remove: ${removeCost.toFixed(2)}ms) → ${severity}`;
  }

  if (runPaintBtn && paintOutput) {
    runPaintBtn.addEventListener('click', runPaintCostEstimate);
  }

  // What-if Throttle/Debounce Modes

  function throttle(fn, wait) {
    let last = 0;
    let timer = null;
    return function (...args) {
      const now = performance.now();
      if (now - last >= wait) {
        last = now;
        fn.apply(this, args);
      } else if (!timer) {
        const remaining = wait - (now - last);
        timer = setTimeout(() => {
          last = performance.now();
          timer = null;
          fn.apply(this, args);
        }, remaining);
      }
    };
  }

  function debounce(fn, wait) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  let scrollRawCount = 0;
  let scrollHandledCount = 0;
  let scrollListener = null;
  let statsIntervalId = null;

  function baseScrollHandler(e) {
    scrollHandledCount++;
    if (testContentWrapper) {
      const st = testContentWrapper.scrollTop;
      void st;
    }
  }

  function applyScrollMode(mode) {
    if (!testContentWrapper) {
      if (scrollModeStats) scrollModeStats.textContent = 'No local scroll container available.';
      return;
    }

    
    if (scrollListener) {
      testContentWrapper.removeEventListener('scroll', scrollListener);
      scrollListener = null;
    }


    if (statsIntervalId) {
      clearInterval(statsIntervalId);
      statsIntervalId = null;
    }

    scrollRawCount = 0;
    scrollHandledCount = 0;

    let handlerImpl = baseScrollHandler;

    if (mode === 'off') {
      handlerImpl = baseScrollHandler;
    } else if (mode === 'throttle-60') {
      handlerImpl = throttle(baseScrollHandler, 60);
    } else if (mode === 'throttle-120') {
      handlerImpl = throttle(baseScrollHandler, 120);
    } else if (mode === 'debounce-120') {
      handlerImpl = debounce(baseScrollHandler, 120);
    }

    scrollListener = function (e) {
      scrollRawCount++;
      handlerImpl(e);
    };

    testContentWrapper.addEventListener('scroll', scrollListener);

    statsIntervalId = setInterval(() => {
      if (!scrollModeStats) return;
      scrollModeStats.textContent =
        `${scrollHandledCount} handler calls / ${scrollRawCount} scroll events (last ~5s).`;
      scrollRawCount = 0;
      scrollHandledCount = 0;
    }, 5000);
  }

  if (scrollModeSelect && scrollModeStats) {
    applyScrollMode(scrollModeSelect.value);

    scrollModeSelect.addEventListener('change', (e) => {
      const mode = e.target.value;
      applyScrollMode(mode);
    });
  }
