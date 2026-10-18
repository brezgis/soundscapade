// Four living backgrounds, one per channel. Each scene draws into its own
// canvas so the main loop can cross-fade between them cleanly.
// draw(ctx, w, h, t, dt, a): a = smoothed audio { level, low, high, freq, peak }

import { LAND } from './land.js';

const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, k) => a + (b - a) * k;
const mix = (c1, c2, k) => `rgb(${c1.map((v, i) => Math.round(lerp(v, c2[i], k))).join(',')})`;

// A layered-sine ridge line: smooth, never repeating within a screen.
function ridgeFn(scale = 1) {
  const p = Array.from({ length: 5 }, () => rnd(0, TAU));
  const f = [0.0017, 0.0041, 0.0093, 0.021, 0.047].map((v) => v * scale);
  const a = [0.5, 0.27, 0.13, 0.07, 0.03];
  return (x) => {
    let y = 0;
    for (let i = 0; i < 5; i++) y += Math.sin(x * f[i] + p[i]) * a[i];
    return y;
  };
}

function fillRidge(ctx, w, h, fn, scroll, base, amp, color) {
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w + 8; x += 8) ctx.lineTo(x, base + fn(x + scroll) * amp);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

// ---------------------------------------------------------------- ABOVE
// Night sky turning around the pole, aurora curtains that brighten with the sound.
function above() {
  let stars = [], ridges, sprite;
  return {
    init(w, h) {
      const diag = Math.hypot(w, h) * 1.2;
      stars = Array.from({ length: Math.round((w * h) / 2600) }, () => ({
        r: Math.sqrt(Math.random()) * diag, a: rnd(0, TAU),
        s: Math.random() < 0.08 ? rnd(1.2, 2) : rnd(0.4, 1.1), tw: rnd(0, TAU), ts: rnd(0.5, 2),
      }));
      ridges = [ridgeFn(0.8), ridgeFn(1.3)];
      // one vertical gradient strip, stretched per aurora column
      sprite = document.createElement('canvas');
      sprite.width = 1; sprite.height = 256;
      const g = sprite.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, 'rgba(150,80,220,0)');
      gr.addColorStop(0.45, 'rgba(120,110,230,0.25)');
      gr.addColorStop(0.8, 'rgba(70,240,170,0.75)');
      gr.addColorStop(0.93, 'rgba(160,255,200,0.95)');
      gr.addColorStop(1, 'rgba(70,240,170,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 1, 256);
    },
    draw(ctx, w, h, t, dt, a) {
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#03050d'); sky.addColorStop(0.55, '#0a1430'); sky.addColorStop(1, '#16223f');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

      const px = w * 0.64, py = -h * 0.08, rot = t * 0.005;
      for (const s of stars) {
        const x = px + Math.cos(s.a + rot) * s.r, y = py + Math.sin(s.a + rot) * s.r;
        if (x < -2 || x > w + 2 || y < -2 || y > h) continue;
        ctx.globalAlpha = (0.45 + 0.55 * Math.sin(t * s.ts + s.tw) ** 2) * (1 - (y / h) * 0.5);
        ctx.fillStyle = '#e6ecff';
        ctx.fillRect(x, y, s.s, s.s);
      }
      ctx.globalAlpha = 1;

      // aurora
      ctx.globalCompositeOperation = 'lighter';
      const bright = 0.22 + a.level * 0.9 + a.high * 0.6;
      for (let c = 0; c < 2; c++) {
        const off = c * 1.7;
        for (let x = -4; x < w + 4; x += 3) {
          const u = x / w;
          const base = h * (0.5 + c * 0.07 + 0.07 * Math.sin(u * 3.1 + t * 0.045 + off) + 0.03 * Math.sin(u * 9 - t * 0.11 + off));
          const fold = Math.sin(x * 0.012 - t * 0.35 + Math.sin(u * 4 + t * 0.07 + off) * 3);
          const len = h * (0.22 + 0.08 * Math.sin(u * 5 + t * 0.09 + off)) * (0.85 + a.level * 0.5);
          const alpha = (0.18 + 0.5 * fold * fold) * bright * (c ? 0.6 : 1) * (0.6 + 0.4 * Math.sin(u * Math.PI));
          if (alpha <= 0.01) continue;
          ctx.globalAlpha = Math.min(1, alpha);
          ctx.drawImage(sprite, x, base - len, 3, len);
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      // low glow on the horizon from the aurora
      const glow = ctx.createLinearGradient(0, h * 0.62, 0, h);
      glow.addColorStop(0, 'rgba(60,200,150,0)');
      glow.addColorStop(1, `rgba(60,200,150,${0.05 + bright * 0.05})`);
      ctx.fillStyle = glow; ctx.fillRect(0, h * 0.62, w, h);

      fillRidge(ctx, w, h, ridges[0], t * 4, h * 0.8, h * 0.09, '#0b1222');
      fillRidge(ctx, w, h, ridges[1], t * 10, h * 0.9, h * 0.06, '#05080f');
    },
  };
}

// ---------------------------------------------------------------- BELOW
// Looking up through cold water: swaying light shafts, marine snow, the seafloor
// rolling past, and rings that spread out when something loud happens.
function below() {
  let snow = [], ridges, rings = [], shafts;
  return {
    init(w, h) {
      snow = Array.from({ length: Math.round((w * h) / 5000) }, () => ({
        x: rnd(0, w), y: rnd(0, h), z: rnd(0.2, 1), ph: rnd(0, TAU),
      }));
      ridges = [ridgeFn(0.7), ridgeFn(1.1), ridgeFn(1.6)];
      shafts = Array.from({ length: 7 }, (_, i) => ({ x: (i + rnd(0.2, 0.8)) / 7, w: rnd(40, 140), ph: rnd(0, TAU), sp: rnd(0.05, 0.13) }));
    },
    draw(ctx, w, h, t, dt, a) {
      const sea = ctx.createLinearGradient(0, 0, 0, h);
      sea.addColorStop(0, '#0f5a6c'); sea.addColorStop(0.35, '#08333f'); sea.addColorStop(1, '#020a10');
      ctx.fillStyle = sea; ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = 'lighter';
      for (const s of shafts) {
        const sway = Math.sin(t * s.sp + s.ph) * 0.18;
        const x0 = s.x * w, x1 = x0 + sway * h, len = h * 0.95;
        const g = ctx.createLinearGradient(0, 0, 0, len);
        const al = (0.05 + 0.04 * Math.sin(t * 0.3 + s.ph) + a.level * 0.12);
        g.addColorStop(0, `rgba(170,240,255,${al})`); g.addColorStop(1, 'rgba(170,240,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x0 - s.w * 0.3, 0); ctx.lineTo(x0 + s.w * 0.3, 0);
        ctx.lineTo(x1 + s.w, len); ctx.lineTo(x1 - s.w, len);
        ctx.fill();
      }
      // surface shimmer
      ctx.strokeStyle = 'rgba(200,250,255,0.06)';
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 5; k++) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 12) {
          const y = 6 + k * 9 + Math.sin(x * 0.015 + t * (0.6 + k * 0.1) + k) * 4 + Math.sin(x * 0.041 - t * 0.9) * 2;
          x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';

      // rings from loud moments
      if (a.peak) rings.push({ x: rnd(0.2, 0.8) * w, y: rnd(0.3, 0.6) * h, t0: t, s: 0.6 + a.level });
      rings = rings.filter((r) => t - r.t0 < 6);
      for (const r of rings) {
        const k = (t - r.t0) / 6;
        for (let j = 0; j < 3; j++) {
          const kk = k - j * 0.08;
          if (kk <= 0) continue;
          ctx.strokeStyle = `rgba(190,245,255,${(1 - kk) * 0.18 * r.s})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.ellipse(r.x, r.y, kk * w * 0.25 * r.s, kk * h * 0.06 * r.s, 0, 0, TAU);
          ctx.stroke();
        }
      }

      // marine snow
      ctx.fillStyle = '#d8f4ff';
      for (const p of snow) {
        p.y += dt * (3 + 9 * p.z);
        p.x += dt * (-4 * p.z) + Math.sin(t * 0.5 + p.ph) * 0.15;
        if (p.y > h) { p.y = -2; p.x = rnd(0, w); }
        if (p.x < -2) p.x = w + 2;
        ctx.globalAlpha = p.z * 0.45 * (1 - p.y / h * 0.4);
        const s = p.z * 1.8;
        ctx.fillRect(p.x, p.y, s, s);
      }
      ctx.globalAlpha = 1;

      fillRidge(ctx, w, h, ridges[0], t * 3, h * 0.78, h * 0.07, '#041820');
      fillRidge(ctx, w, h, ridges[1], t * 6, h * 0.86, h * 0.06, '#031117');
      fillRidge(ctx, w, h, ridges[2], t * 11, h * 0.94, h * 0.04, '#01080c');
    },
  };
}

// ---------------------------------------------------------------- WILD
// Mountain ranges and pine forest rolling past in layers of haze, the light
// slowly cycling through dawn, haze, dusk and blue hour. A flock crosses now
// and then; after dusk the fireflies come out.
const PALETTES = [
  { top: [74, 92, 140], hor: [244, 186, 160], sun: [255, 226, 190], far: [176, 140, 160], near: [40, 34, 56] },   // dawn
  { top: [98, 140, 178], hor: [226, 220, 196], sun: [255, 248, 225], far: [150, 168, 176], near: [36, 52, 58] },  // haze
  { top: [56, 50, 104], hor: [236, 140, 110], sun: [255, 190, 140], far: [150, 96, 120], near: [30, 22, 42] },    // dusk
  { top: [14, 22, 50], hor: [64, 84, 130], sun: [200, 214, 240], far: [52, 66, 100], near: [10, 14, 28] },        // blue hour
];

const hash = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };

// A ridge with pines standing on it, spaced on a world grid so they scroll with the land.
function fillForest(ctx, w, h, fn, scroll, base, amp, color, size, gap) {
  fillRidge(ctx, w, h, fn, scroll, base, amp, color);
  ctx.fillStyle = color;
  ctx.beginPath();
  const k0 = Math.floor((scroll - size) / gap), k1 = Math.ceil((scroll + w + size) / gap);
  for (let k = k0; k <= k1; k++) {
    if (hash(k * 1.7) < 0.25) continue;                     // clearings
    const wx = k * gap + hash(k) * gap * 0.8, x = wx - scroll;
    const th = size * (0.55 + hash(k * 3.1) * 0.6), tw = th * 0.32;
    const y = base + fn(wx) * amp + 4;
    for (let tier = 0; tier < 3; tier++) {                  // three stacked tiers
      const ty = y - th * tier * 0.28, tt = tw * (1 - tier * 0.22);
      ctx.moveTo(x - tt, ty); ctx.lineTo(x, ty - th * 0.5); ctx.lineTo(x + tt, ty);
    }
  }
  ctx.fill();
}

function wild() {
  let ridges, birds = null, nextBirds = 20, flies = [];
  return {
    init(w, h) {
      ridges = [0.6, 0.85, 1.1, 1.45, 1.9].map(ridgeFn);
      flies = Array.from({ length: 45 }, () => ({ x: rnd(0, w), y: rnd(0.7, 0.97) * h, ph: rnd(0, TAU), sp: rnd(0.3, 0.9) }));
    },
    draw(ctx, w, h, t, dt, a) {
      const cyc = (t / 75) % PALETTES.length;            // ~5 minutes for the whole cycle
      const i = Math.floor(cyc), k = (1 - Math.cos((cyc - i) * Math.PI)) / 2;
      const P = PALETTES[i], Q = PALETTES[(i + 1) % PALETTES.length];
      const c = (key) => P[key].map((v, j) => lerp(v, Q[key][j], k));

      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.75);
      sky.addColorStop(0, mix(c('top'), c('top'), 0)); sky.addColorStop(1, mix(c('hor'), c('hor'), 0));
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

      const sun = c('sun'), sx = w * 0.68, sy = h * 0.42, sr = Math.min(w, h) * (0.05 + a.low * 0.02);
      const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 9);
      halo.addColorStop(0, `rgba(${sun.join(',')},${0.55 + a.level * 0.3})`);
      halo.addColorStop(0.12, `rgba(${sun.join(',')},0.25)`);
      halo.addColorStop(1, `rgba(${sun.join(',')},0)`);
      ctx.fillStyle = halo; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = `rgba(${sun.join(',')},0.9)`;
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();

      // birds
      nextBirds -= dt;
      if (!birds && nextBirds <= 0) birds = { x: w + 40, y: rnd(0.15, 0.35) * h, n: 5 + Math.floor(rnd(0, 6)), sp: rnd(18, 30) };
      if (birds) {
        birds.x -= birds.sp * dt;
        ctx.strokeStyle = mix(c('near'), c('far'), 0.3);
        ctx.lineWidth = 1.3;
        for (let b = 0; b < birds.n; b++) {
          const bx = birds.x + b * 16 + Math.abs(b - birds.n / 2) * 10, by = birds.y + Math.abs(b - birds.n / 2) * 8;
          const flap = Math.sin(t * 6 + b) * 3;
          ctx.beginPath(); ctx.moveTo(bx - 5, by - flap); ctx.lineTo(bx, by); ctx.lineTo(bx + 5, by - flap); ctx.stroke();
        }
        if (birds.x < -birds.n * 30) { birds = null; nextBirds = rnd(50, 110); }
      }

      const far = c('far'), near = c('near'), hor = c('hor');
      const layers = 5;
      for (let L = 0; L < layers; L++) {
        const d = L / (layers - 1);
        const base = h * lerp(0.56, 0.95, d), amp = h * lerp(0.1, 0.07, d);
        if (L >= 2) fillForest(ctx, w, h, ridges[L], t * lerp(2, 18, d), base, amp, mix(far, near, d), h * lerp(0.05, 0.13, d), lerp(14, 30, d));
        else fillRidge(ctx, w, h, ridges[L], t * lerp(2, 18, d), base, amp, mix(far, near, d));
        // mist pooled in front of each layer except the last
        if (L < layers - 1) {
          const top = base - amp * 0.6, bot = base + h * 0.1;
          const mist = ctx.createLinearGradient(0, top, 0, bot);
          const ma = (0.16 + 0.06 * Math.sin(t * 0.07 + L * 1.3) + a.level * 0.1) * (1 - d * 0.5);
          mist.addColorStop(0, `rgba(${hor.join(',')},0)`);
          mist.addColorStop(0.6, `rgba(${hor.join(',')},${ma})`);
          mist.addColorStop(1, `rgba(${hor.join(',')},0)`);
          ctx.fillStyle = mist; ctx.fillRect(0, top, w, bot - top);
        }
      }

      // fireflies: only once the light is going (dusk → blue hour → back toward dawn)
      const night = [0, 0, 0.45, 1][i] * (1 - k) + [0, 0, 0.45, 1][(i + 1) % 4] * k;
      if (night > 0.05) {
        ctx.globalCompositeOperation = 'lighter';
        for (const f of flies) {
          f.x += Math.sin(t * f.sp + f.ph) * 0.4 + dt * 3; f.y += Math.cos(t * f.sp * 0.7 + f.ph) * 0.25;
          if (f.x > w + 10) f.x = -10;
          const glow = Math.max(0, Math.sin(t * f.sp * 2 + f.ph)) ** 3 * night * (0.7 + a.level);
          if (glow < 0.02) continue;
          const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 9);
          g.addColorStop(0, `rgba(220,255,140,${Math.min(1, glow)})`); g.addColorStop(1, 'rgba(220,255,140,0)');
          ctx.fillStyle = g; ctx.fillRect(f.x - 9, f.y - 9, 18, 18);
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    },
  };
}

// ---------------------------------------------------------------- NOW
// A dotted globe that turns to face whichever microphone you're hearing, with
// the sound itself drawn as a halo around it.
function now() {
  let pts = [], lon0 = 0, lat0 = 20, target = { lat: 30, lon: 0 }, pins = [], pulses = [], lastPulse = 0;
  const rad = Math.PI / 180;
  return {
    init() {
      pts = [];
      for (let la = -78; la <= 78; la += 7.2) {
        const step = 7.2 / Math.max(0.25, Math.cos(la * rad));   // even spacing on the sphere
        for (let lo = -180; lo < 180; lo += step) pts.push([la, lo, 0]);
      }
      for (let i = 0; i < LAND.length; i += 2) pts.push([LAND[i], LAND[i + 1], 1]);
    },
    setPins(list, active) { pins = list; target = active || target; },
    draw(ctx, w, h, t, dt, a) {
      const bg = ctx.createRadialGradient(w / 2, h * 0.47, 0, w / 2, h * 0.47, Math.max(w, h) * 0.7);
      bg.addColorStop(0, '#111827'); bg.addColorStop(1, '#05070b');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

      // ease toward the active location, plus a slow drift so it never sits dead still
      let dl = ((target.lon - lon0 + 540) % 360) - 180;
      lon0 += dl * Math.min(1, dt * 0.6);
      lat0 += (target.lat * 0.7 - lat0) * Math.min(1, dt * 0.6);
      const L0 = (lon0 + Math.sin(t * 0.05) * 6) * rad, P0 = lat0 * rad;

      const R = Math.min(w, h) * 0.28, cx = w / 2, cy = h * 0.47;
      const proj = (la, lo) => {
        const p = la * rad, l = lo * rad - L0;
        const x = Math.cos(p) * Math.sin(l);
        const y = Math.cos(P0) * Math.sin(p) - Math.sin(P0) * Math.cos(p) * Math.cos(l);
        const z = Math.sin(P0) * Math.sin(p) + Math.cos(P0) * Math.cos(p) * Math.cos(l);
        return [cx + x * R, cy - y * R, z];
      };

      // sound halo
      const n = 128, f = a.freq;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const k = i % n, bin = f ? f[2 + Math.floor((k < n / 2 ? k : n - k) * 1.6)] / 255 : 0;
        const r = R * 1.07 + bin * R * 0.22 * (0.5 + a.level);
        const ang = (k / n) * TAU - Math.PI / 2 + t * 0.02;
        const x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = `rgba(255,196,140,${0.18 + a.level * 0.4})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // sphere
      const rim = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R);
      rim.addColorStop(0, 'rgba(70,90,130,0.25)'); rim.addColorStop(1, 'rgba(20,28,44,0.5)');
      ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();

      for (const [la, lo, land] of pts) {
        const [x, y, z] = proj(la, lo);
        if (z <= 0) continue;
        ctx.globalAlpha = land ? 0.25 + z * 0.65 : z * 0.22;
        ctx.fillStyle = land ? '#c7d5f0' : '#7f93bb';
        const s = land ? 2 : 1.3;
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;

      // pins and pulses
      if (t - lastPulse > 1.6 - a.level) { pulses.push(t); lastPulse = t; }
      pulses = pulses.filter((p) => t - p < 4);
      for (const pin of pins) {
        const [x, y, z] = proj(pin.lat, pin.lon);
        if (z <= 0) continue;
        const on = pin === target;
        ctx.fillStyle = on ? '#ffcf9a' : 'rgba(255,207,154,0.4)';
        ctx.beginPath(); ctx.arc(x, y, on ? 3.5 : 2, 0, TAU); ctx.fill();
        if (on) {
          for (const p of pulses) {
            const k = (t - p) / 4;
            ctx.strokeStyle = `rgba(255,207,154,${(1 - k) * (0.35 + a.level * 0.5)})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(x, y, 4 + k * R * 0.35, 0, TAU); ctx.stroke();
          }
        }
      }
    },
  };
}


// ---------------------------------------------------------------- CITIES
// A night city sliding past as if from a slow train: three depths of skyline,
// windows switching on and off, and out-of-focus lights drifting in front.
function cities() {
  let bokeh = [];
  const LAYERS = [
    { speed: 4, slot: 46, minH: 0.12, maxH: 0.3, base: 0.74, col: '#1a1c33', win: 0 },
    { speed: 9, slot: 70, minH: 0.14, maxH: 0.42, base: 0.84, col: '#11121f', win: 0.16 },
    { speed: 18, slot: 110, minH: 0.12, maxH: 0.5, base: 0.98, col: '#08080f', win: 0.3 },
  ];
  return {
    init(w, h) {
      bokeh = Array.from({ length: 22 }, () => ({
        x: rnd(0, w), y: rnd(0.15, 0.95) * h, r: rnd(18, 70), sp: rnd(6, 22),
        c: [[255, 190, 110], [255, 120, 90], [120, 220, 255], [255, 230, 170]][Math.floor(rnd(0, 4))], ph: rnd(0, TAU),
      }));
    },
    draw(ctx, w, h, t, dt, a) {
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#05060f'); sky.addColorStop(0.55, '#1b1838'); sky.addColorStop(0.8, '#4a2d4a'); sky.addColorStop(1, '#6b3b3f');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

      LAYERS.forEach((L, li) => {
        const scroll = t * L.speed, k0 = Math.floor(scroll / L.slot) - 1, k1 = Math.ceil((scroll + w) / L.slot) + 1;
        for (let k = k0; k <= k1; k++) {
          const seed = k * 7.31 + li * 101;
          const bw = L.slot * (0.45 + hash(seed) * 0.55), x = k * L.slot - scroll + hash(seed + 1) * (L.slot - bw);
          const bh = h * lerp(L.minH, L.maxH, hash(seed + 2) ** 1.6), top = h * L.base - bh;
          ctx.fillStyle = L.col;
          ctx.fillRect(x, top, bw, bh + h);
          if (hash(seed + 3) > 0.7) ctx.fillRect(x + bw * 0.45, top - bh * 0.12, 2, bh * 0.12);   // antenna
          if (hash(seed + 3) > 0.7 && li > 0) {                                                    // its red light
            ctx.fillStyle = `rgba(255,60,60,${0.4 + 0.6 * (Math.sin(t * 2 + seed) > 0.6)})`;
            ctx.fillRect(x + bw * 0.45 - 1, top - bh * 0.12 - 3, 4, 4);
          }
          if (!L.win) continue;
          const cw = 4 + li * 2, ch = 5 + li * 2, gx = cw + 4 + li * 2, gy = ch + 6 + li * 2;
          for (let wy = top + 8; wy < h * L.base - 6; wy += gy) {
            for (let wx = x + 6; wx < x + bw - cw - 4; wx += gx) {
              const id = seed * 13 + Math.round(wx - x) * 3.7 + Math.round(wy - top) * 1.3;
              const period = 6 + hash(id) * 30;                     // each window has its own rhythm
              const on = hash(id + Math.floor((t + hash(id + 9) * period) / period)) < L.win;
              if (!on) continue;
              const warm = hash(id + 5) > 0.2;
              ctx.fillStyle = warm ? `rgba(255,200,120,${0.55 + a.level * 0.4})` : `rgba(170,210,255,${0.45 + a.level * 0.4})`;
              ctx.fillRect(wx, wy, cw, ch);
            }
          }
        }
      });

      // out-of-focus lights in front, as if seen through glass
      ctx.globalCompositeOperation = 'lighter';
      for (const b of bokeh) {
        b.x -= b.sp * dt;
        if (b.x < -b.r) { b.x = w + b.r; b.y = rnd(0.15, 0.95) * h; }
        const al = (0.05 + 0.04 * Math.sin(t * 0.7 + b.ph)) * (1 + a.level * 1.5);
        const g = ctx.createRadialGradient(b.x, b.y, b.r * 0.6, b.x, b.y, b.r);
        g.addColorStop(0, `rgba(${b.c.join(',')},${al})`); g.addColorStop(1, `rgba(${b.c.join(',')},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}

// ---------------------------------------------------------------- VOICES
// A golden record turning slowly in a dark room. The grooves ripple with the
// voice being played; dust drifts through the light.
function voices() {
  let dust = [];
  return {
    init(w, h) {
      dust = Array.from({ length: 70 }, () => ({ x: rnd(0, w), y: rnd(0, h), z: rnd(0.3, 1), ph: rnd(0, TAU) }));
    },
    draw(ctx, w, h, t, dt, a) {
      const cx = w * 0.62, cy = h * 0.47, R = Math.min(w, h) * 0.37;
      const bg = ctx.createRadialGradient(cx, cy * 0.6, 0, cx, cy, Math.max(w, h) * 0.8);
      bg.addColorStop(0, '#2a1d10'); bg.addColorStop(0.5, '#140d07'); bg.addColorStop(1, '#070403');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

      // shadow, then the disc
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath(); ctx.arc(cx + R * 0.04, cy + R * 0.06, R * 1.01, 0, TAU); ctx.fill();
      const disc = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.4, R * 0.1, cx, cy, R);
      disc.addColorStop(0, '#e2c27e'); disc.addColorStop(0.6, '#b38b45'); disc.addColorStop(1, '#7a5a26');
      ctx.fillStyle = disc; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();

      // grooves: each ring listens to its own band
      const f = a.freq, rot = t * 0.06;
      for (let i = 0; i < 70; i++) {
        const rr = R * (0.36 + 0.62 * (i / 70));
        const v = f ? f[3 + i * 3] / 255 : 0;
        ctx.strokeStyle = `rgba(60,38,10,${0.12 + v * 0.35})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let s = 0; s <= 96; s++) {
          const ang = (s / 96) * TAU;
          const wob = v * 2.2 * Math.sin(ang * 6 + rot * 8 + i);
          const x = cx + Math.cos(ang) * (rr + wob), y = cy + Math.sin(ang) * (rr + wob);
          s ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }

      // turning sheen: two soft highlight wedges that sweep round with the record
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      for (const off of [0, Math.PI]) {
        const ang = rot + off;
        const g = ctx.createLinearGradient(cx + Math.cos(ang - 0.5) * R, cy + Math.sin(ang - 0.5) * R, cx + Math.cos(ang + 0.5) * R, cy + Math.sin(ang + 0.5) * R);
        g.addColorStop(0, 'rgba(255,240,200,0)');
        g.addColorStop(0.5, `rgba(255,240,200,${0.1 + a.level * 0.15})`);
        g.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, ang - 0.35, ang + 0.35); ctx.closePath(); ctx.fill();
      }
      ctx.restore();

      // label and spindle
      const lab = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.32);
      lab.addColorStop(0, '#8d6a2e'); lab.addColorStop(1, '#6a4c1c');
      ctx.fillStyle = lab; ctx.beginPath(); ctx.arc(cx, cy, R * 0.32, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,230,170,0.25)';
      ctx.lineWidth = 1;
      for (let k = 0; k < 14; k++) {                 // faint engraved ticks, turning with the disc
        const ang = rot + (k / 14) * TAU, r0 = R * 0.2, r1 = R * (0.24 + (k % 3) * 0.025);
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0); ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1); ctx.stroke();
      }
      ctx.fillStyle = '#120b05'; ctx.beginPath(); ctx.arc(cx, cy, R * 0.025, 0, TAU); ctx.fill();

      // dust in the light
      ctx.fillStyle = '#ffe9b8';
      for (const p of dust) {
        p.y -= dt * 2 * p.z; p.x += Math.sin(t * 0.3 + p.ph) * 0.12;
        if (p.y < 0) { p.y = h; p.x = rnd(0, w); }
        ctx.globalAlpha = p.z * 0.25 * (0.6 + 0.4 * Math.sin(t + p.ph));
        ctx.fillRect(p.x, p.y, p.z * 1.6, p.z * 1.6);
      }
      ctx.globalAlpha = 1;
    },
  };
}

// ---------------------------------------------------------------- SIGNALS
// A radio waterfall: every frame the spectrum of what you're hearing is
// printed as a new line and the history scrolls down, like an SDR display.
function signals() {
  let fall, fctx, W = 0, H = 0, row;
  return {
    init(w, h) {
      W = Math.ceil(w); H = Math.ceil(h);
      fall = document.createElement('canvas'); fall.width = W; fall.height = H;
      fctx = fall.getContext('2d');
      row = fctx.createImageData(W, 1);
      // start full of receiver noise rather than empty
      const img = fctx.createImageData(W, H), d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const k = 0.035 + Math.random() * 0.03;
        d[i] = 30 + 220 * k ** 2.2; d[i + 1] = 12 + 243 * k ** 0.9; d[i + 2] = 18 + 120 * k ** 1.6; d[i + 3] = 255;
      }
      fctx.putImageData(img, 0, 0);
    },
    draw(ctx, w, h, t, dt, a) {
      const f = a.freq;
      fctx.drawImage(fall, 0, 0, W, H - 1, 0, 1, W, H - 1);   // scroll down a line
      const d = row.data, lo = 2, hi = f ? f.length * 0.7 : 1;
      for (let x = 0; x < W; x++) {
        const bin = f ? Math.floor(lo * Math.pow(hi / lo, x / W)) : 0;   // log frequency axis
        const v = f ? (f[bin] / 255) ** 1.8 : 0;
        const n = 0.035 + Math.random() * 0.03;                          // receiver noise floor
        const k = Math.min(1, v + n);
        d[x * 4] = 30 + 220 * k ** 2.2;          // phosphor: dark green → green → pale yellow
        d[x * 4 + 1] = 12 + 243 * k ** 0.9;
        d[x * 4 + 2] = 18 + 120 * k ** 1.6;
        d[x * 4 + 3] = 255;
      }
      fctx.putImageData(row, 0, 0);

      ctx.drawImage(fall, 0, 0, w, h);

      // graticule and scale
      ctx.strokeStyle = 'rgba(140,255,190,0.07)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 10; i++) { const x = (w * i) / 10; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let i = 1; i < 6; i++) { const y = (h * i) / 6; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.fillStyle = 'rgba(160,255,200,0.35)';
      ctx.font = '11px "IBM Plex Mono", monospace';
      const nyq = 22.05, binHz = nyq / (f ? f.length : 1024);
      for (let i = 1; i < 10; i++) {
        const bin = lo * Math.pow(hi / lo, i / 10);
        ctx.fillText((bin * binHz).toFixed(bin * binHz < 1 ? 2 : 1) + ' kHz', (w * i) / 10 + 4, 16);
      }

      // live spectrum trace along the top
      if (f) {
        ctx.strokeStyle = 'rgba(200,255,210,0.55)';
        ctx.beginPath();
        for (let x = 0; x < w; x += 2) {
          const bin = Math.floor(lo * Math.pow(hi / lo, x / w));
          const y = 70 - (f[bin] / 255) * 46;
          x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }

      // scanlines and vignette
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
      const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.75)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
    },
  };
}

export const SCENES = { above, below, wild, cities, voices, signals, now };
