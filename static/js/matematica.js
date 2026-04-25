const canvas = document.getElementById('graph-canvas');
const ctx = canvas.getContext('2d');
const area = document.getElementById('canvas-area');

/* ── Stato ── */
let view = { xMin: -6, xMax: 6, yMin: -8, yMax: 8 };
let dragging = false, dragStart = {}, dragView = {};
let mouseX = null, mouseY = null;
let cache = null;
let fetchTimer = null;

/* ── Resize ── */
function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = area.clientWidth * dpr;
  canvas.height = area.clientHeight * dpr;
  canvas.style.width = area.clientWidth + 'px';
  canvas.style.height = area.clientHeight + 'px';
  draw();
}
window.addEventListener('resize', resize);

/* ── Coordinate ── */
function toCanvas(wx, wy) {
  const W = canvas.width, H = canvas.height;
  return {
    cx: (wx - view.xMin) / (view.xMax - view.xMin) * W,
    cy: H - (wy - view.yMin) / (view.yMax - view.yMin) * H
  };
}
function toWorld(cx, cy) {
  const W = canvas.width, H = canvas.height;
  return {
    x: view.xMin + cx / W * (view.xMax - view.xMin),
    y: view.yMin + (H - cy) / H * (view.yMax - view.yMin)
  };
}

/* ── Griglia ── */
function niceStep(rough) {
  const e = Math.pow(10, Math.floor(Math.log10(rough)));
  const f = rough / e;
  if (f < 1.5) return e;
  if (f < 3.5) return 2 * e;
  if (f < 7.5) return 5 * e;
  return 10 * e;
}
function fmtN(n) {
  if (Math.abs(n) >= 1e4 || (Math.abs(n) < 0.01 && n !== 0)) return n.toExponential(1);
  return (+n.toFixed(2)) + '';
}

function drawGrid() {
  const W = canvas.width, H = canvas.height;
  const stepX = niceStep((view.xMax - view.xMin) / 8);
  const stepY = niceStep((view.yMax - view.yMin) / 6);
  const dpr = window.devicePixelRatio || 1;
  ctx.save();

  ctx.strokeStyle = '#e8e4dc';
  ctx.lineWidth = 0.8;
  ctx.setLineDash([]);
  
  for (let xv = Math.ceil(view.xMin / stepX) * stepX; xv <= view.xMax; xv += stepX) {
    if (Math.abs(xv) < 0.01) continue;
    const { cx } = toCanvas(xv, 0);
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
  }
  for (let yv = Math.ceil(view.yMin / stepY) * stepY; yv <= view.yMax; yv += stepY) {
    if (Math.abs(yv) < 0.01) continue;
    const { cy } = toCanvas(0, yv);
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();
  }

  const o = toCanvas(0, 0);
  
  ctx.lineWidth = 2.0;
  ctx.strokeStyle = '#3d3a35';
  
  ctx.beginPath();
  ctx.moveTo(0, o.cy);
  ctx.lineTo(W, o.cy);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(o.cx, 0);
  ctx.lineTo(o.cx, H);
  ctx.stroke();

  ctx.fillStyle = '#5a5a54';
  ctx.font = `${9 * dpr}px DM Mono, monospace`;
  
  ctx.textAlign = 'center';
  for (let xv = Math.ceil(view.xMin / stepX) * stepX; xv <= view.xMax; xv += stepX) {
    if (Math.abs(xv) < stepX * 0.01) continue;
    const { cx, cy: oy } = toCanvas(xv, 0);
    const ly = Math.min(Math.max(oy + 16 * dpr, 10 * dpr), H - 4);
    ctx.fillText(fmtN(xv), cx, ly);
  }
  
  ctx.textAlign = 'right';
  for (let yv = Math.ceil(view.yMin / stepY) * stepY; yv <= view.yMax; yv += stepY) {
    if (Math.abs(yv) < stepY * 0.01) continue;
    const { cx: ox, cy } = toCanvas(0, yv);
    const lx = Math.min(Math.max(ox - 12 * dpr, 4), W - 4);
    ctx.fillText(fmtN(yv), lx, cy + 3 * dpr);
  }

  if (o.cx > 30 && o.cx < W - 30 && o.cy > 30 && o.cy < H - 30) {
    ctx.fillStyle = '#3d3a35';
    ctx.font = `bold ${10 * dpr}px DM Mono, monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('0', o.cx + 12, o.cy + 5);
  }

  ctx.fillStyle = '#3d3a35';
  
  if (o.cx < W - 40) {
    ctx.beginPath();
    ctx.moveTo(W - 12, o.cy - 4);
    ctx.lineTo(W, o.cy);
    ctx.lineTo(W - 12, o.cy + 4);
    ctx.fill();
  }
  
  if (o.cx > 40) {
    ctx.beginPath();
    ctx.moveTo(12, o.cy - 4);
    ctx.lineTo(0, o.cy);
    ctx.lineTo(12, o.cy + 4);
    ctx.fill();
  }
  
  if (o.cy > 40) {
    ctx.beginPath();
    ctx.moveTo(o.cx - 4, 12);
    ctx.lineTo(o.cx, 0);
    ctx.lineTo(o.cx + 4, 12);
    ctx.fill();
  }
  
  if (o.cy < H - 40) {
    ctx.beginPath();
    ctx.moveTo(o.cx - 4, H - 12);
    ctx.lineTo(o.cx, H);
    ctx.lineTo(o.cx + 4, H - 12);
    ctx.fill();
  }

  ctx.restore();
}

function drawCurveFromData(xs, ys, color, lw, dash = []) {
  if (!xs || !ys) return;
  const dpr = window.devicePixelRatio || 1;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw * dpr;
  ctx.setLineDash(dash);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  let pen = false;
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] < view.xMin || xs[i] > view.xMax) { pen = false; continue; }
    if (ys[i] === null || ys[i] === undefined || !isFinite(ys[i])) { pen = false; continue; }
    const { cx, cy } = toCanvas(xs[i], ys[i]);
    if (cy < -canvas.height || cy > canvas.height * 2) { pen = false; continue; }
    if (!pen) { ctx.moveTo(cx, cy); pen = true; }
    else ctx.lineTo(cx, cy);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawAsymptotes(asymptotes) {
  if (!asymptotes) return;
  const dpr = window.devicePixelRatio || 1;
  ctx.save();
  asymptotes.forEach(asi => {
    if (asi.type === 'verticale') {
      const { cx } = toCanvas(asi.value, 0);
      if (cx >= 0 && cx <= canvas.width) {
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, canvas.height);
        ctx.strokeStyle = '#e76f51';
        ctx.lineWidth = 1.2 * dpr;
        ctx.setLineDash([8 * dpr, 6 * dpr]);
        ctx.stroke();
      }
    } else if (asi.type === 'orizzontale') {
      const { cy } = toCanvas(0, asi.value);
      if (cy >= 0 && cy <= canvas.height) {
        ctx.beginPath();
        ctx.moveTo(0, cy);
        ctx.lineTo(canvas.width, cy);
        ctx.strokeStyle = '#e76f51';
        ctx.lineWidth = 1.2 * dpr;
        ctx.setLineDash([8 * dpr, 6 * dpr]);
        ctx.stroke();
      }
    }
  });
  ctx.setLineDash([]);
  ctx.restore();
}

function drawCritical(pts) {
  if (!pts || !pts.length) return;
  const dpr = window.devicePixelRatio || 1;
  const colors = { massimo: '#c46050', minimo: '#2a9d8f', flesso: '#e9c46a', critico: '#9c9890' };
  ctx.save();
  pts.forEach(p => {
    if (p.x < view.xMin - 0.5 || p.x > view.xMax + 0.5) return;
    const { cx, cy } = toCanvas(p.x, p.y);
    if (cy < -50 || cy > canvas.height + 50) return;
    ctx.beginPath();
    ctx.arc(cx, cy, 6 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = colors[p.type] || '#9c9890';
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2 * dpr;
    ctx.stroke();
  });
  ctx.restore();
}

function drawTangent(wx, fx, d1x) {
  if (fx === null || d1x === null) return;
  const dpr = window.devicePixelRatio || 1;
  ctx.save();
  ctx.strokeStyle = '#8aab80';
  ctx.lineWidth = 1.5 * dpr;
  ctx.setLineDash([6 * dpr, 4 * dpr]);
  const x1 = view.xMin, y1 = fx + d1x * (x1 - wx);
  const x2 = view.xMax, y2 = fx + d1x * (x2 - wx);
  const p1 = toCanvas(x1, y1), p2 = toCanvas(x2, y2);
  ctx.beginPath(); ctx.moveTo(p1.cx, p1.cy); ctx.lineTo(p2.cx, p2.cy); ctx.stroke();
  ctx.restore();
}

function drawCrosshair(wx) {
  const dpr = window.devicePixelRatio || 1;
  const { cx } = toCanvas(wx, 0);
  ctx.save();
  ctx.strokeStyle = '#c8c0b0';
  ctx.lineWidth = 0.8 * dpr;
  ctx.setLineDash([4 * dpr, 4 * dpr]);
  ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, canvas.height); ctx.stroke();
  
  if (cache && cache.xs) {
    const idx = Math.round((wx - cache.xs[0]) / (cache.xs[cache.xs.length - 1] - cache.xs[0]) * (cache.xs.length - 1));
    if (idx >= 0 && idx < cache.ys.length && cache.ys[idx] !== null) {
      const { cy } = toCanvas(wx, cache.ys[idx]);
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(cx, cy, 5 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = '#6344D4';
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1.5 * dpr;
      ctx.stroke();
    }
  }
  ctx.restore();
}

function updateHoverUI(wx, fx, d1, d2) {
  const crosshairBox = document.getElementById('crosshair-box');
  
  // Aggiorna i valori
  const fmt = (v) => v !== null && v !== undefined ? v.toFixed(4) : '—';
  document.getElementById('ci-x').textContent = fmt(wx);
  document.getElementById('ci-fx').textContent = fmt(fx);
  document.getElementById('ci-d1').textContent = fmt(d1);
  document.getElementById('ci-d2').textContent = fmt(d2);
  
  // Mostra il box
  crosshairBox.style.opacity = '1';
  crosshairBox.style.visibility = 'visible';
  crosshairBox.classList.add('visible');
}

/* ── Draw principale ── */
function draw() {
  if (!canvas.width || !canvas.height) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  if (!cache) return;

  const showD2 = document.getElementById('show-d2').checked;
  const showD1 = document.getElementById('show-d1').checked;
  const showF = document.getElementById('show-f').checked;
  const showCP = document.getElementById('show-cp').checked;
  const showTan = document.getElementById('show-tan').checked;

  drawAsymptotes(cache.asymptotes);

  if (showD2 && cache.d2s) drawCurveFromData(cache.xs, cache.d2s, '#2a9d8f', 1.5, [8, 4]);
  if (showD1 && cache.d1s) drawCurveFromData(cache.xs, cache.d1s, '#e76f51', 1.8, [6, 4]);
  if (showF && cache.ys) drawCurveFromData(cache.xs, cache.ys, '#6344D4', 2.5, []);
  if (showCP) drawCritical(cache.critical_points);

  // CROSSHAIR - SEMPRE VISIBILE se c'è il mouse
  if (mouseX !== null && mouseY !== null && cache && cache.xs) {
    const wx = toWorld(mouseX, 0).x;
    drawCrosshair(wx);

    const idx = Math.round((wx - cache.xs[0]) / (cache.xs[cache.xs.length - 1] - cache.xs[0]) * (cache.xs.length - 1));
    const fxv = (idx >= 0 && cache.ys) ? cache.ys[idx] : null;
    const d1v = (idx >= 0 && cache.d1s) ? cache.d1s[idx] : null;
    const d2v = (idx >= 0 && cache.d2s) ? cache.d2s[idx] : null;

    if (showTan && fxv !== null && d1v !== null) drawTangent(wx, fxv, d1v);
    updateHoverUI(wx, fxv, d1v, d2v);
  } else {
    const crosshairBox = document.getElementById('crosshair-box');
    if (crosshairBox) {
      crosshairBox.style.opacity = '0';
      crosshairBox.style.visibility = 'hidden';
      crosshairBox.classList.remove('visible');
    }
  }
}

function fmtV(v) { return v !== null && v !== undefined ? (+v).toFixed(4) : '—'; }

function updateSidebar(data) {
  document.getElementById('d1-expr').innerHTML = data.d1_expr ? `$${data.d1_expr}$` : '—';
  document.getElementById('d2-expr').innerHTML = data.d2_expr ? `$${data.d2_expr}$` : '—';
  document.getElementById('current-func').innerHTML = data.f_latex ? `$${data.f_latex}$` : '—';

  const cpList = document.getElementById('cp-list');
  if (data.critical_points && data.critical_points.length) {
    cpList.innerHTML = data.critical_points.map(p =>
      `<div class="cp-item">x = <span class="cp-x">${p.x}</span> → <span class="cp-type-${p.type}">${p.type}</span> (y = ${p.y})</div>`
    ).join('');
  } else {
    cpList.innerHTML = '<span style="color:var(--muted)">nessuno</span>';
  }

  const asyList = document.getElementById('asymptote-list');
  if (data.asymptotes && data.asymptotes.length) {
    asyList.innerHTML = data.asymptotes.map(a =>
      `<div class="asymptote-item">$${a.equation}$</div>`
    ).join('');
  } else {
    asyList.innerHTML = '<span style="color:var(--muted)">nessuno</span>';
  }

  document.getElementById('domain-display').innerHTML = `$${data.dominio || '\\mathbb{R}'}$`;

  const signList = document.getElementById('sign-list');
  if (data.segno && data.segno.length) {
    signList.innerHTML = data.segno.map(s =>
      `<div class="sign-row"><span class="sign-interval">$${s.intervallo}$</span><span class="${s.segno === '> 0' ? 'sign-pos' : 'sign-neg'}">${s.segno}</span></div>`
    ).join('');
  } else {
    signList.innerHTML = '<span style="color:var(--muted)">non determinabile</span>';
  }

  if (window.MathJax) MathJax.typesetPromise();
}

async function fetchData(expr, xMin, xMax) {
  if (!expr) return;
  const spinner = document.getElementById('spinner');
  spinner.classList.add('active');
  try {
    const resp = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expr, x_min: xMin, x_max: xMax, n_points: 1200 })
    });
    const data = await resp.json();
    if (data.error) {
      showError(data.error);
      cache = null;
    } else {
      clearError();
      cache = data;
      updateSidebar(data);
    }
  } catch (e) {
    showError('Errore di connessione');
  } finally {
    spinner.classList.remove('active');
    draw();
  }
}

function showError(msg) {
  const el = document.getElementById('error-badge');
  el.textContent = msg;
  el.classList.add('visible');
}
function clearError() {
  document.getElementById('error-badge').classList.remove('visible');
}

function scheduleRefresh() {
  clearTimeout(fetchTimer);
  fetchTimer = setTimeout(() => {
    const expr = document.getElementById('fx-input').value.trim();
    const xMin = parseFloat(document.getElementById('x-min').value);
    const xMax = parseFloat(document.getElementById('x-max').value);
    if (expr && !isNaN(xMin) && !isNaN(xMax) && xMin < xMax) {
      view.xMin = xMin;
      view.xMax = xMax;
      fetchData(expr, xMin, xMax);
    }
  }, 400);
}

document.getElementById('fx-input').addEventListener('input', scheduleRefresh);
document.getElementById('x-min').addEventListener('change', scheduleRefresh);
document.getElementById('x-max').addEventListener('change', scheduleRefresh);
document.getElementById('analyze-btn').addEventListener('click', scheduleRefresh);

['show-f', 'show-d1', 'show-d2', 'show-cp', 'show-tan'].forEach(id =>
  document.getElementById(id).addEventListener('change', draw)
);

document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('fx-input').value = btn.dataset.f;
    scheduleRefresh();
  });
});

canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  mouseX = (e.clientX - rect.left) * scaleX;
  mouseY = (e.clientY - rect.top) * scaleY;

  if (dragging) {
    const dx = (mouseX - dragStart.x) / canvas.width * (dragView.xMax - dragView.xMin);
    const dy = (mouseY - dragStart.y) / canvas.height * (dragView.yMax - dragView.yMin);
    view.xMin = dragView.xMin - dx;
    view.xMax = dragView.xMax - dx;
    view.yMin = dragView.yMin + dy;
    view.yMax = dragView.yMax + dy;
  }
  draw();
});

canvas.addEventListener('mouseleave', () => {
  mouseX = null;
  mouseY = null;
  draw();
});

canvas.addEventListener('mousedown', e => {
  dragging = true;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  dragStart = {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
  dragView = { ...view };
  canvas.style.cursor = 'grabbing';
});

window.addEventListener('mouseup', () => {
  dragging = false;
  canvas.style.cursor = 'crosshair';
});

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX / canvas.width;
  const my = (e.clientY - rect.top) * scaleY / canvas.height;
  const f = e.deltaY > 0 ? 1.1 : 0.9;
  const xR = view.xMax - view.xMin;
  const yR = view.yMax - view.yMin;
  const cx = view.xMin + mx * xR;
  const cy = view.yMin + (1 - my) * yR;
  view.xMin = cx - mx * xR * f;
  view.xMax = cx + (1 - mx) * xR * f;
  view.yMin = cy - (1 - my) * yR * f;
  view.yMax = cy + my * yR * f;
  draw();
}, { passive: false });

// Syntax panel toggle
document.getElementById('syntax-btn').addEventListener('click', () => {
  const panel = document.getElementById('syntax-panel');
  const btn = document.getElementById('syntax-btn');
  panel.classList.toggle('open');
  btn.classList.toggle('active');
});

resize();
scheduleRefresh();

// DEBUG: stampa in console
console.log('main.js caricato, crosshair-box:', document.getElementById('crosshair-box'));