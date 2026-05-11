<<<<<<< HEAD
=======
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


})();
>>>>>>> bd90803638cd02bb663e52b4feb4898478fcb7ed
