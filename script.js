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
  
})();