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


   // COMMIT 6
   function ensureConnected(edgeSet) {
    const adj = nodes.map(() => []);
    edges.forEach(e => { adj[e.a].push(e.b); adj[e.b].push(e.a); });

    const vis = new Array(nodes.length).fill(false);
    const comps = [];

    function bfs(start) {
      const comp = [], q = [start];
      vis[start] = true;
      while (q.length) {
        const n = q.shift();
        comp.push(n);
        adj[n].forEach(nb => { if (!vis[nb]) { vis[nb] = true; q.push(nb); } });
      }
      return comp;
    }

    nodes.forEach((_, i) => { if (!vis[i]) comps.push(bfs(i)); });

    const set2 = new Set(edges.map(e => Math.min(e.a, e.b) + ',' + Math.max(e.a, e.b)));
    for (let i = 1; i < comps.length; i++) {
      const a = comps[0][randInt(0, comps[0].length)];
      const b = comps[i][randInt(0, comps[i].length)];
      const k = Math.min(a, b) + ',' + Math.max(a, b);
      if (!set2.has(k)) {
        const na = nodes[a], nb = nodes[b];
        const dx = nb.x - na.x, dy = nb.y - na.y, len = Math.hypot(dx, dy);
        const c1 = { x: na.x + dx*.33, y: na.y + dy*.33 };
        const c2 = { x: na.x + dx*.67, y: na.y + dy*.67 };
        edges.push({ id: edges.length, a, b, c1, c2, len, roadLen: len, type: 'collector' });
        set2.add(k);
      }
    }
  }
  
  // COMMIT 7
  function dijkstra(src, dst) {
    const INF = 1e18;
    const dist     = new Array(nodes.length).fill(INF);
    const prev     = new Array(nodes.length).fill(-1);
    const prevEdge = new Array(nodes.length).fill(-1);
    const visited  = new Array(nodes.length).fill(false);
    dist[src] = 0;

    // Bangun adjacency list
    const adj = nodes.map(() => []);
    edges.forEach((e, i) => {
      adj[e.a].push({ n: e.b, w: e.len, ei: i });
      adj[e.b].push({ n: e.a, w: e.len, ei: i });
    });

    // Priority queue sederhana
    const pq = [{ n: src, d: 0 }];
    while (pq.length) {
      pq.sort((a, b) => a.d - b.d);
      const { n, d } = pq.shift();
      if (visited[n]) continue;
      visited[n] = true;
      if (n === dst) break;
      for (const nb of adj[n]) {
        const nd = d + nb.w;
        if (nd < dist[nb.n]) {
          dist[nb.n] = nd;
          prev[nb.n] = n;
          prevEdge[nb.n] = nb.ei;
          pq.push({ n: nb.n, d: nd });
        }
      }
    }

    if (dist[dst] === INF) return { nodes: [], edges: [] };

    // Rekonstruksi path dari dst ke src
    const nodeSeq = [], edgeSeq = [];
    let cur = dst;
    while (cur !== src) { nodeSeq.unshift(cur); edgeSeq.unshift(prevEdge[cur]); cur = prev[cur]; }
    nodeSeq.unshift(src);
    return { nodes: nodeSeq, edges: edgeSeq };
  }

  //mengacak posisi titik START dan FINISH.
  function randomStartGoal() {
    if (startId !== null && nodes[startId]) nodes[startId].isStart = false;
    if (goalId  !== null && nodes[goalId])  nodes[goalId].isGoal   = false;

    startId = randInt(0, nodes.length);
    goalId  = randInt(0, nodes.length);
    while (goalId === startId) goalId = randInt(0, nodes.length);

    nodes[startId].isStart = true;
    nodes[goalId].isGoal   = true;
    path = []; pathEdges = []; totalLen = 0; traveled = 0;
    if (nodes[startId]) { objX = nodes[startId].x; objY = nodes[startId].y; }
    document.getElementById('tRoute').textContent = '—';
  }

  //menghitung dan menyiapkan rute aktif
  function computeRoute() {
    if (startId === null || goalId === null) return;
    const result = dijkstra(startId, goalId);
    path = result.nodes;
    const eids = result.edges;

    if (path.length < 2) {
      document.getElementById('tRoute').textContent = 'Tak ada rute';
      pathEdges = []; totalLen = 0; return;
    }

    pathEdges = []; totalLen = 0;
    for (let i = 0; i < eids.length; i++) {
      const e = edges[eids[i]], fromNode = path[i];
      let p0, c1, c2, p3;
      // Sesuaikan arah Bezier dengan arah perjalanan
      if (e.a === fromNode) { p0 = nodes[e.a]; c1 = e.c1; c2 = e.c2; p3 = nodes[e.b]; }
      else                  { p0 = nodes[e.b]; c1 = e.c2; c2 = e.c1; p3 = nodes[e.a]; }
      pathEdges.push({ p0, c1, c2, p3, len: e.len });
      totalLen += e.len;
    }

    traveled = 0;
    objX = nodes[startId].x; objY = nodes[startId].y;
    document.getElementById('tRoute').textContent = `${path.length - 1} seg · ${Math.round(totalLen)}m`;
  }

  // COMMIT 8
  //menggambar highlight rute Dijkstra di peta
  function drawRouteHighlight() {
    if (pathEdges.length === 0) return;
    // Glow luar
    for (const seg of pathEdges) {
      ctx.beginPath(); ctx.moveTo(seg.p0.x, seg.p0.y);
      ctx.bezierCurveTo(seg.c1.x, seg.c1.y, seg.c2.x, seg.c2.y, seg.p3.x, seg.p3.y);
      ctx.strokeStyle = 'rgba(45,106,79,0.18)'; ctx.lineWidth = 26; ctx.stroke();
    }
    // Garis rute
    for (const seg of pathEdges) {
      ctx.beginPath(); ctx.moveTo(seg.p0.x, seg.p0.y);
      ctx.bezierCurveTo(seg.c1.x, seg.c1.y, seg.c2.x, seg.c2.y, seg.p3.x, seg.p3.y);
      ctx.strokeStyle = '#2d6a4f'; ctx.lineWidth = 4; ctx.setLineDash([]); ctx.stroke();
    }
    // Titik penanda jarak di sepanjang rute
    ctx.fillStyle = 'rgba(45,106,79,0.5)';
    for (let d = 180; d < totalLen; d += 260) {
      let acc = 0;
      for (const seg of pathEdges) {
        if (acc + seg.len >= d) {
          const tp = (d - acc) / seg.len;
          const pt = bzPt(seg.p0, seg.c1, seg.c2, seg.p3, tp);
          lingkaranNode(pt.x, pt.y, 4, 'rgba(45,106,79,0.5)', true);
          break;
        }
        acc += seg.len;
      }
    }
  }

  //menggambar node persimpangan di peta
  function drawNodes() {
    for (const n of nodes) {
      if (n.isStart || n.isGoal) continue;
      const onPath = path.includes(n.id);
      lingkaranNode(n.x, n.y, onPath ? 5 : 3, onPath ? '#2d6a4f' : '#a09070', true);
      lingkaranNode(n.x, n.y, onPath ? 3 : 1.5, '#ffffff', true);
    }
  }

  //menggambar tanda START/FINISH
  function drawBendera(x, y, warna, label) {
    ctx.save();
    // Lingkaran dasar
    ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fillStyle = warna + '33'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fillStyle = warna; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    // Tiang bendera
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 36);
    ctx.strokeStyle = '#5a3e1b'; ctx.lineWidth = 2; ctx.stroke();
    // Bendera segitiga (polygon manual)
    ctx.beginPath();
    ctx.moveTo(x,      y - 36);
    ctx.lineTo(x + 18, y - 28);
    ctx.lineTo(x,      y - 20);
    ctx.closePath();
    ctx.fillStyle = warna; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 0.8; ctx.stroke();
    // Label kotak
    ctx.font = 'bold 10px Segoe UI,sans-serif';
    ctx.textAlign = 'center';
    const tw = ctx.measureText(label).width + 10;
    ctx.fillStyle = 'rgba(255,252,245,0.92)';
    ctx.strokeStyle = warna; ctx.lineWidth = 1;
    ctx.fillRect(x - tw/2, y - 52, tw, 14);
    ctx.strokeRect(x - tw/2, y - 52, tw, 14);
    ctx.fillStyle = warna;
    ctx.fillText(label, x, y - 41);
    ctx.restore();
  }



})();
