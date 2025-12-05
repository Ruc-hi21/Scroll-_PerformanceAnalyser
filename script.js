(() =>{
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const exportBtn = document.getElementById('exportBtn');
    const currentFpsE1 = document.getElementById('currentFps');
    const avgFpsE1 = document.getElementById('avgFps');
    const droppedFramesE1 = document.getElementById('droppedFrames');
    const layoutShiftE1 = document.getElementById('layoutShift');
    const longTaskCountE1 = document.getElementById('longTaskCount');
    const reportArea = document.getElemnetById('reportArea');
    const fpsThresholdInput = document.getElementById('fpsThreshold');
    const testContentWrapper = document.getElementById('testContent');
    const testContent = document.querySelector('.big-grid');
    const testTargetSelect = document.getElementById('testTarget');

})

function populateTiles(n=60){
    if (!testContent) return;
    testContemt.innerHTML = '';
    for(let i=1; i<=n; i++){
        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.innerHTML = `<h3> Tile ${i} </h3><div>Content for Test because it is there. ${i}</div>`
        testContent.appendChild(tile);
    }
}

const ctx = document.getElementById('fpsChart').getContext('2d');
const chartData = {
    labels: [],
    datasets: [{
        label: 'FPS Over Time',
        data: [],
        tension: 0.2,
        fill: false,
        pointRadius: 0,
        borderWidth: 2,
    }]
  };       
const fpsChart = new Chart(ctx, {
    type: 'line',
    data: chartData,
    options :{
      animation:false,
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { min: 0, max: 60, ticks: { stepSize: 5 } }
      },
      plugins: { legend: { display: false } }
    }
  });

let running = false;
let rafId = null;
let lastFrameTs = performance.now();
let frameCount = 0;
let fpsSamples = [];
let droppedFrames = 0;
let layoutShiftScore = 0;
let longTaskCount = 0;
let capturedEntries = {
    frames: [],
    layoutShifts: [],
    longTasks: []
  };

function measureFrame(ts){
    if (!running) return;
    frameCount++;
    const delta = ts - lastFrameTs;

    if (delta >= 1000) {
      const fps = Math.round((frameCount * 1000) / delta);
      const expectedFrames = Math.round(delta / (1000 / 60));
      const dropped = Math.max(0, expectedFrames - frameCount);
      droppedFrames += dropped;

      fpsSamples.push({ ts: Date.now(), fps, dropped });
      capturedEntries.frames.push({ ts: Date.now(), fps, dropped });

      updateMetricsUI(fps);
      pushToChart(fps);

      frameCount = 0;
      lastFrameTs = ts;
    }
    rafId = requestAnimationFrame(measureFrame);
}
function updateMetricsUI(currentFps){
    currentFpsE1.textContent = currentFps;
    const avg = Math.round((fpsSamples.reduce((s, x) => s + x.fps, 0) / Math.max(1, fpsSamples.length)) * 10) / 10;
    avgFpsEl.textContent = (avg || '—');
    droppedFramesEl.textContent = droppedFrames;
    layoutShiftEl.textContent = layoutShiftScore.toFixed ? layoutShiftScore.toFixed(3) : layoutShiftScore;
    longTaskCountEl.textContent = longTaskCount;
  }

function pushToChart(fps){
    const label = new Data().toLocaleTimeString();
    chartData.labels.push(label);
    chartData.datasets[0].data.push(fps);
    if (chartData.labels.length > 60){
        chartData.labels.shift();
        chartData.datasets[0].data.shift();
}
    fpsChart.update('none');
}

let layoutObserver = null;
let longTaskObserver = null;

function setupObservers(){
    try{
        layoutObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            for (const e of entries){
                layoutShiftScore += e.value || 0;
                capturedEntries.layoutShifts.push({
                    ts: Date.now(),
                    value: e.value,
                    sources: (e.sources || []).map(s => s.node ? (s.node.tagName || 'NODE'):(s.type || 'source'))
                });
    }
});
        layoutObserver.observe({ type: 'layout-shift', buffered: true });
    } catch (err) {
        console.warn('Layout Shift observation not supported:', err);
    }

    try {
      longTaskObserver = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          longTaskCount++;
          capturedEntries.longTasks.push({
            ts: Date.now(),
            name: e.name,
            startTime: e.startTime,
            duration: e.duration
          });
        }
      });
      longTaskObserver.observe({ type: 'longtask', buffered: true });
    } catch (err) {
      console.warn('LongTask observer not supported:', err);
    }
  }

  function disconnectObservers() {
    try { layoutObserver && layoutObserver.disconnect(); } catch(e){}
    try { longTaskObserver && longTaskObserver.disconnect(); } catch(e){}
  }

  function startTest() {
    if (running) return;
    running = true;

    fpsSamples = [];
    capturedEntries = { frames: [], layoutShifts: [], longTasks: [] };
    frameCount = 0;
    droppedFrames = 0;
    layoutShiftScore = 0;
    longTaskCount = 0;
    chartData.labels = [];
    chartData.datasets[0].data = [];
    fpsChart.update();

    setupObservers();

    lastFrameTs = performance.now();
    rafId = requestAnimationFrame(measureFrame);

    startBtn.disabled = true;
    stopBtn.disabled = false;
    exportBtn.disabled = true;
    reportArea.textContent = 'Running... Scroll inside the test area to exercise the page.';
  }

  function stopTest() {
    if (!running) return;
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    disconnectObservers();

    const avg = Math.round((fpsSamples.reduce((s, x) => s + x.fps, 0) / Math.max(1, fpsSamples.length)) * 10) / 10;
    const worst = fpsSamples.length ? Math.min(...fpsSamples.map(s=>s.fps)) : null;
    const droppedTotal = droppedFrames;
    const lshift = layoutShiftScore;
    const longTasks = longTaskCount;

    const suggestions = generateSuggestions(avg, lshift, longTasks);

    const report = {
      timestamp: new Date().toISOString(),
      averageFps: avg || null,
      worstFps: worst,
      samples: fpsSamples.length,
      droppedFrames: droppedTotal,
      layoutShiftScore: lshift,
      longTaskCount: longTasks,
      suggestions
    };

    reportArea.textContent = JSON.stringify(report, null, 2);
    exportBtn.disabled = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    updateMetricsUI(Math.round(avg || 0));
  }

  function generateSuggestions(avgFps, layoutShift, longTasks) {
    const thr = parseInt(fpsThresholdInput.value || '45', 10);
    const out = [];

    if (avgFps === null) {
      out.push('Not enough data to provide suggestions.');
      return out;
    }

    if (avgFps < thr) {
      out.push(`Average FPS ${avgFps} is below threshold ${thr}. Investigate expensive paints/reflows and long JS tasks.`);
      out.push('Use Chrome DevTools Performance tab to record and inspect long tasks; look at "Main" thread flame chart for scripting/painting.');
    } else {
      out.push(`Average FPS ${avgFps} is above threshold ${thr}.`);
    }

    if (layoutShift > 0.05) {
      out.push(`Significant layout shift detected (score ${layoutShift.toFixed(3)}). Consider reserving space for images/ads and avoid layout-changing DOM inserts during scroll.`);
    } else {
      out.push('Layout shift score is low.');
    }

    if (longTasks > 0) {
      out.push(`Found ${longTasks} long tasks. Consider breaking large tasks into smaller chunks (use requestIdleCallback, web workers or chunking).`);
    } else {
      out.push('No long tasks detected in this run.');
    }

    out.push('Consider debouncing/throttling scroll handlers and using transform/opacity for animations instead of layout-triggering properties (width/height/left/top).');
    return out;
  }

  function exportJSON() {
    const payload = {
      captured: capturedEntries,
      summaryText: reportArea.textContent,
      meta: {
        exportedAt: new Date().toISOString(),
        userAgent: navigator.userAgent
      }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scroll-analyzer-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  startBtn.addEventListener('click', () => {
    startTest();
  });
  stopBtn.addEventListener('click', stopTest);
  exportBtn.addEventListener('click', exportJSON);

  console.info('Scroll Performance Analyzer loaded. Click Start Test and scroll inside the "Local Scroll Test Content" area.');

  if (typeof PerformanceObserver === 'undefined') {
    console.warn('PerformanceObserver not supported in this browser. Some metrics will be unavailable.');
  }

  // "s" key convenience for start/stop
  window.addEventListener('keydown', (e) => {
    if (e.key === 's') {
      if (running) stopTest(); else startTest();
    }
    }
);
