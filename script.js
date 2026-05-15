// commit 1
(function () {
  'use strict';

  // SETUP CANVAS
  const cv  = document.getElementById('c');
  const ctx = cv.getContext('2d');

  // Ukuran dunia peta — sengaja dibuat lebih besar dari viewport
  const W = 3600, H = 2800;

  let zoom = 1, vx = 0, vy = 0;
  const ZMIN = 0.10, ZMAX = 5;

  // STATE GLOBAL
  let nodes = [], edges = [], buildings = [], parks = [], waterBodies = [];
  let startId = null, goalId = null;
  let path = [], pathEdges = [], totalLen = 0, traveled = 0;
  let objX = 0, objY = 0, objAngle = 0;
  let running = false, rafId = null, lastTime = null;

  const SPEED = 60; // kecepatan kendaraan (world-unit per detik)

  let vehicleType = 'car'; // 'mobil' | 'motor' | 'sepeda' | 'orang'

  // Follow kamera
  let followMode = true;
  const FOLLOW_ZOOM_TARGET = 2.0;
  const LERP_ZOOM = 0.06, LERP_PAN = 0.10;

  // commit 2
  // GENERATE BANGUNAN & TAMAN

  // Warna bangunan khas Kepulauan Riau (pastel hangat)
  const BLDG_PAL = [
    { fill: '#f5e6c8', stroke: '#c8a060', roof: '#d4956a' },
    { fill: '#e8d5b0', stroke: '#b89050', roof: '#c07840' },
    { fill: '#dce8d8', stroke: '#80a870', roof: '#6a9060' },
    { fill: '#d8e4ec', stroke: '#7898b8', roof: '#6080a0' },
    { fill: '#ecdccc', stroke: '#b88060', roof: '#a06040' },
    { fill: '#e4e0d4', stroke: '#908070', roof: '#807060' },
  ];

  function randInt(a, b) { return Math.floor(Math.random() * (b - a)) + a; }
  function rand(a, b)    { return Math.random() * (b - a) + a; }

  function generateBuildings() {
    buildings = [];
    const BW = 115, BH = 100;
    for (let bx = 60; bx < W - 60; bx += BW) {
      for (let by = 60; by < H - 60; by += BH) {
        if (Math.random() < 0.55) {
          const pad = 10, w = rand(28, 62), h = rand(22, 52);
          const x = bx + rand(pad, BW - w - pad);
          const y = by + rand(pad, BH - h - pad);
          let ok = true;
          for (const n of nodes) {
            if (Math.hypot(n.x - (x + w/2), n.y - (y + h/2)) < 55) { ok = false; break; }
          }
          if (!ok) continue;
          const pal = BLDG_PAL[randInt(0, BLDG_PAL.length)];
          buildings.push({
            x, y, w, h, pal,
            floors: randInt(1, 5),
            shadow: rand(3, 6),
            roofStyle: randInt(0, 3)
          });
        }
      }
    }
  }

  function generateParks() {
    parks = [];
    for (let i = 0; i < 18; i++) {
      const x = rand(60, W - 200), y = rand(60, H - 200);
      const w = rand(70, 180),     h = rand(60, 140);
      const trees = [];
      for (let j = 0; j < Math.floor(w * h / 1400); j++) {
        trees.push({
          x: x + rand(12, w - 12),
          y: y + rand(12, h - 12),
          r: rand(5, 11)
        });
      }
      parks.push({ x, y, w, h, trees });
    }
  }

  // Test — panggil sementara untuk verifikasi di console
  generateBuildings();
  generateParks();
  console.log("Buildings:", buildings.length, "| Parks:", parks.length);

   function resize() {
    cv.width  = window.innerWidth;
    cv.height = window.innerHeight;
    clamp();
    render();
  }
  window.addEventListener('resize', resize);

//COMMIT 3
  function resize() {
    cv.width  = window.innerWidth;
    cv.height = window.innerHeight;
    clamp();
    render();
  }
  window.addEventListener('resize', resize);

  //fitZoom
  function fitZoom() {
    zoom = Math.min(cv.width / W, cv.height / H) * 0.92;
  }

  //centerView — memposisikan kamera ke tengah peta.
  function centerView() {
    vx = W / 2 - cv.width  / (2 * zoom);
    vy = H / 2 - cv.height / (2 * zoom);
    clamp();
  }

  //COMMIT 4
    function clamp() {
    const mw = W * zoom, mh = H * zoom;
    vx = mw <= cv.width  ? (W - cv.width  / zoom) / 2 : Math.min(Math.max(vx, 0), W - cv.width  / zoom);
    vy = mh <= cv.height ? (H - cv.height / zoom) / 2 : Math.min(Math.max(vy, 0), H - cv.height / zoom);
  }

  //zoomAtPoint(sx, sy, factor) — zoom terhadap titik tertentu di layar.
  function zoomAtPoint(sx, sy, factor) {
    const oldZ = zoom;
    const newZ = Math.min(Math.max(oldZ * factor, ZMIN), ZMAX);
    if (newZ === oldZ) return;
    const wx = vx + sx / oldZ;
    const wy = vy + sy / oldZ;
    zoom = newZ;
    vx = wx - sx / zoom;
    vy = wy - sy / zoom;
    clamp();
    render();
  }

  //zoom dari titik tengah layar.
  function zoomAtCenter(factor) {
    zoomAtPoint(cv.width / 2, cv.height / 2, factor);
  }

  // Event Mouse (Pan/Scroll)
  let drag = false, dsx = 0, dsy = 0, dvx = 0, dvy = 0;

  cv.addEventListener('mousedown', e => {
    drag = true;
    dsx = e.clientX; dsy = e.clientY;
    dvx = vx;        dvy = vy;
  });

  window.addEventListener('mousemove', e => {
    if (!drag) return;
    if (followMode && running) disableFollow();
    vx = dvx - (e.clientX - dsx) / zoom;
    vy = dvy - (e.clientY - dsy) / zoom;
    clamp(); render();
  });

  window.addEventListener('mouseup', () => drag = false);

  // Scroll mouse = zoom
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    if (followMode && running) disableFollow();
    const r = cv.getBoundingClientRect();
    zoomAtPoint(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.15 : 0.87);
  }, { passive: false });

  // Event Touch (Drag & Pinch Zoom)
  let lastDist2 = 0;

  cv.addEventListener('touchstart', e => {
    e.preventDefault();
    if (e.touches.length === 1) {
      drag = true;
      dsx = e.touches[0].clientX; dsy = e.touches[0].clientY;
      dvx = vx; dvy = vy;
    }
    if (e.touches.length === 2) {
      drag = false;
      lastDist2 = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      );
    }
  }, { passive: false });

  cv.addEventListener('touchmove', e => {
    e.preventDefault();
    if (e.touches.length === 1 && drag) {
      if (followMode && running) disableFollow();
      vx = dvx - (e.touches[0].clientX - dsx) / zoom;
      vy = dvy - (e.touches[0].clientY - dsy) / zoom;
      clamp(); render();
    }
    if (e.touches.length === 2) {
      const nd = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      );
      if (lastDist2 > 0 && nd > 0) {
        if (followMode && running) disableFollow();
        const r = cv.getBoundingClientRect();
        const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left;
        const my = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top;
        zoomAtPoint(mx, my, nd / lastDist2);
      }
      lastDist2 = nd;
    }
  }, { passive: false });

  cv.addEventListener('touchend', e => {
    if (e.touches.length === 0) drag = false;
    if (e.touches.length < 2)  lastDist2 = 0;
  });

  // COMMIT 5
  // ── Fungsi Grafis Manual ──────────────────────────────────────

  function garisDAA(x1, y1, x2, y2, warna, tebal = 1) {
    ctx.strokeStyle = warna;
    ctx.lineWidth   = tebal;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function bzPt(p0, c1, c2, p3, t) {
    const m = 1 - t, m2 = m * m, t2 = t * t;
    return {
      x: m2*m*p0.x + 3*m2*t*c1.x + 3*m*t2*c2.x + t2*t*p3.x,
      y: m2*m*p0.y + 3*m2*t*c1.y + 3*m*t2*c2.y + t2*t*p3.y
    };
  }

  function bzDeriv(p0, c1, c2, p3, t) {
    const m = 1 - t;
    return {
      dx: 3*m*m*(c1.x-p0.x) + 6*m*t*(c2.x-c1.x) + 3*t*t*(p3.x-c2.x),
      dy: 3*m*m*(c1.y-p0.y) + 6*m*t*(c2.y-c1.y) + 3*t*t*(p3.y-c2.y)
    };
  }

  function bzLen(p0, c1, c2, p3) {
    let len = 0, prev = p0;
    for (let i = 1; i <= 32; i++) {
      const pt = bzPt(p0, c1, c2, p3, i / 32);
      len += Math.hypot(pt.x - prev.x, pt.y - prev.y);
      prev = pt;
    }
    return len;
  }
  
})();