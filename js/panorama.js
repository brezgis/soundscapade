// Panorama scenes: one long image strip per channel, one panel per sound.
// Panels overlap by OVERLAP of their length and cross-fade (each panel's
// leading edge is feathered), so the strip reads as one continuous picture.
// The camera creeps slowly across the current panel and glides to the next
// one when the sound changes. A panel may also have a transparent foreground
// layer that slides DEPTH times faster for parallax; the procedural layers
// (mist, light, particles) draw between the two.
//
// dir: 'left'  content drifts left   (next place arrives from the right)
//      'right' content drifts right  (next place arrives from the left)
//      'up'    content drifts up     (descending: next place rises from below)
//      'down'  content drifts down   (ascending: next place comes from above)

const OVERLAP = 0.3;          // fraction of a panel that cross-fades with its neighbour
const CREEP = 0.13;          // how far either side of centre the camera wanders on one sound (panels)
const GLIDE = 7;             // seconds to travel to the next place
const DEPTH = 1.6;           // foreground speed relative to the background
const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);

const images = new Map();
function loadImage(src) {
  if (!images.has(src)) {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    images.set(src, img);
  }
  return images.get(src);
}

// Panel geometry: a panel always fills the screen across the axis. Along the
// axis it is as long as its image's aspect allows (cfg.aspect = along/across),
// never shorter than the screen, so tall portrait panels in a vertical strip keep
// their whole height and the camera travels down through them.
export function panorama(cfg) {
  const N = cfg.panels.length;
  const vertical = cfg.dir === 'up' || cfg.dir === 'down';
  const mirrored = cfg.dir === 'right' || cfg.dir === 'down';
  const overlap = cfg.overlap ?? OVERLAP;
  let W = 0, H = 0, L = 0, X = 0, Lp = 0, S = 0, creepPx = 0, centre = 0;
  // Positions along the strip, in px. Panels normally overlap their neighbour, but
  // a panel's `gapAfter` (in screen lengths) leaves empty space before the next one:
  // room between the planets.
  let P = [], T = 0;
  let cache = [];            // per panel: feathered canvas, or null until loaded
  let fronts = [];           // per panel: foreground canvas, null until loaded, false if none
  const rects = [];          // per panel: where the image sits inside it (for image-anchored overlays)
  // the camera: c is where the view starts along the strip
  let c = 0, from = 0, to = 0, glideStart = -1, glideFor = GLIDE, creepStart = 0, creepFor = 90;
  let t = 0, placed = false, frameNo = 0, lastC = 0, vel = 0, stars = null;
  const fx = cfg.panels.map((p) => (p.fx || []).map((o) => overlay(o)));

  cfg.panels.forEach((p) => { loadImage(p.img); if (p.front) loadImage(p.front); });

  const PW = () => (vertical ? W : Lp), PH = () => (vertical ? Lp : H);
  const wrap = (v) => v - T * Math.floor(v / T);
  const home = (i) => P[i] + centre;          // camera position that centres panel i

  // a smooth ramp along the axis, as gradient stops
  function ramp(grad, a0, a1, v0 = 0, v1 = 1) {
    for (let k = 0; k <= 8; k++) {
      const x = k / 8, v = v0 + (v1 - v0) * x * x * (3 - 2 * x);
      grad.addColorStop(a0 + (a1 - a0) * x, `rgba(0,0,0,${v})`);
    }
  }
  const mask = (g, grad, pw, ph) => { g.globalCompositeOperation = 'destination-in'; g.fillStyle = grad; g.fillRect(0, 0, pw, ph); };

  function build(i) {
    const p = cfg.panels[i], img = loadImage(p.img);
    if (!img.complete || !img.naturalWidth) return null;
    const pw = PW(), ph = PH();
    const c2 = document.createElement('canvas');
    c2.width = pw; c2.height = ph;
    const g = c2.getContext('2d');
    if (p.fit === 'print') drawPrint(g, img, p, pw, ph, cfg);
    else rects[i] = drawCover(g, img, p, pw, ph);
    if (p.fit === 'contain') {                  // a floating picture: soften all four edges into space
      const r = rects[i], e = 0.08;
      const gx = g.createLinearGradient(r.x, 0, r.x + r.w, 0), gy = g.createLinearGradient(0, r.y, 0, r.y + r.h);
      for (const gr of [gx, gy]) { ramp(gr, 0, e); ramp(gr, 1 - e, 1, 1, 0); }
      mask(g, gx, pw, ph); mask(g, gy, pw, ph);
      g.globalCompositeOperation = 'source-over';
    }
    // feather the leading edge (where it overlaps the previous panel), and the
    // trailing edge too if empty space follows
    const f = Lp * overlap, trail = (p.gapAfter || 0) > 0;
    const along = vertical ? ph : pw;
    let grad = vertical ? g.createLinearGradient(0, 0, 0, ph) : g.createLinearGradient(0, 0, pw, 0);
    const lead = f / along;
    if (!mirrored) { ramp(grad, 0, lead); if (trail) ramp(grad, 1 - lead, 1, 1, 0); }
    else { if (trail) ramp(grad, 0, lead); else grad.addColorStop(0, 'rgba(0,0,0,1)'); ramp(grad, 1 - lead, 1, 1, 0); }
    mask(g, grad, pw, ph);
    return c2;
  }

  // Foregrounds: both ends along the axis softened so they never cut off hard.
  function buildFront(i) {
    const p = cfg.panels[i];
    if (!p.front) return false;
    const img = loadImage(p.front);
    if (!img.complete || !img.naturalWidth) return null;
    const pw = PW(), ph = PH();
    const c2 = document.createElement('canvas');
    c2.width = pw; c2.height = ph;
    const g = c2.getContext('2d');
    drawCover(g, img, { focus: p.frontFocus || [0.5, 1] }, pw, ph);
    const grad = vertical ? g.createLinearGradient(0, 0, 0, ph) : g.createLinearGradient(0, 0, pw, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(0.1, 'rgba(0,0,0,1)');
    grad.addColorStop(0.9, 'rgba(0,0,0,1)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    mask(g, grad, pw, ph);
    return c2;
  }

  // where something starting `along` px into the view (and `len` long) sits on screen
  const place = (along, len = Lp) => {
    const pos = mirrored ? L - along - len : along;
    return vertical ? [0, pos] : [pos, 0];
  };

  // a field of stars that drifts with the camera (slower, as if far away) and
  // streaks a little when it is moving fast
  function drawStars(ctx, cw) {
    if (!stars) {
      const tile = L * 2;
      stars = { tile, pts: Array.from({ length: Math.round((X * tile) / 2200) }, () => ({ a: rnd(0, tile), x: rnd(0, X), s: rnd(0.5, 1.7), k: rnd(0.15, 0.6), ph: rnd(0, TAU) })) };
    }
    ctx.fillStyle = '#e8eeff';
    for (const s of stars.pts) {
      let pos = (s.a - cw * s.k) % stars.tile; if (pos < 0) pos += stars.tile;
      if (pos > L) continue;
      const len = Math.max(s.s, Math.min(24, Math.abs(vel) * s.k * 0.012));
      const along = mirrored ? L - pos : pos;
      ctx.globalAlpha = 0.35 + 0.5 * Math.sin(t * 0.8 + s.ph) ** 2;
      if (vertical) ctx.fillRect(s.x, along - len / 2, s.s, len);
      else ctx.fillRect(along - len / 2, s.x, len, s.s);
    }
    ctx.globalAlpha = 1;
  }

  return {
    panorama: true,
    init(w, h) {
      W = Math.round(w); H = Math.round(h);
      L = vertical ? H : W;
      X = vertical ? W : H;
      Lp = Math.max(L, Math.round(X * (cfg.aspect || 0)));
      S = Lp * (1 - overlap);
      centre = (Lp - L) / 2;
      // on a panel longer than the screen, wander through most of its length
      creepPx = Math.max((cfg.creep ?? CREEP) * S, centre * 0.85);
      P = []; let pos = 0;
      for (const p of cfg.panels) { P.push(pos); pos += S + (p.gapAfter || 0) * L; }
      T = pos;
      stars = null;
      cache = cfg.panels.map(() => null);
      fronts = cfg.panels.map(() => null);
      fx.flat().forEach((o) => o.init && o.init(W, H));
    },

    // Coming back to this channel later: land on the next sound instead of gliding to it.
    unplace() { placed = false; },

    // Leaving this channel: drop the decoded panels (they rebuild cheaply on return).
    release() { cache = cache.map(() => null); fronts = fronts.map(() => null); },

    // Called when a new sound starts on this channel.
    goTo(i, duration) {
      const target = home(i) - creepPx;
      creepFor = Math.max(20, duration - GLIDE);
      if (!placed) {                              // first sound on this channel: just be there, no long glide
        placed = true;
        c = from = to = lastC = target; glideStart = -1; creepStart = t;
        return;
      }
      let d = wrap(target - c);                  // always travel forward, round the loop
      if (d > T - S * 0.5) d -= T;               // (tiny backwards nudges are fine)
      from = c; to = c + d;
      glideStart = t;
      // longer journeys take longer, but not proportionally (that would take all day)
      glideFor = GLIDE + 1.6 * Math.sqrt(Math.max(0, Math.abs(d) / L - 1));
    },

    draw(ctx, w, h, time, dt, a) {
      t = time;
      if (glideStart >= 0) {
        const k = Math.min(1, (t - glideStart) / glideFor);
        c = from + (to - from) * ease(k);
        if (k >= 1) { glideStart = -1; creepStart = t; from = c; }
      } else {
        c = from + Math.min(1, (t - creepStart) / creepFor) * creepPx * 2;
      }
      vel = dt > 0 ? vel + ((c - lastC) / dt - vel) * Math.min(1, dt * 4) : vel;
      lastC = c;

      ctx.fillStyle = cfg.haze;
      ctx.fillRect(0, 0, w, h);
      const cw = wrap(c);
      if (cfg.starfield) drawStars(ctx, c);

      const pw = PW(), ph = PH();
      const near = [];                           // [i, along] for every panel copy in view

      // panels in view, drawn in strip order so each one fades in over the last
      for (const m of [-1, 0, 1]) {
        for (let i = 0; i < N; i++) {
          const along = P[i] + m * T - cw;
          if (along > L || along + Lp < 0) continue;
          near.push([i, along]);
          if (!cache[i]) cache[i] = build(i);
          const [x, y] = place(along);
          if (cache[i]) {
            if (cfg.breathe) {                   // a slow zoom in and out, so still photographs feel alive
              const z = 1 + cfg.breathe * (0.5 + 0.5 * Math.sin(t * 0.04 + i * 1.7));
              ctx.drawImage(cache[i], x - (pw * (z - 1)) / 2, y - (ph * (z - 1)) / 2, pw * z, ph * z);
            } else ctx.drawImage(cache[i], x, y);
          }

          // this panel's living layers, faded as it leaves the screen
          const weight = Math.max(0, 1 - Math.abs(along + centre) / S / (1 - overlap) * 0.9);
          if (weight > 0.01) {
            for (const o of fx[i]) {
              if (o.screen) o.draw(ctx, w, h, t, dt, a, weight, 0, 0);
              else if (o.onImage && rects[i]) { const r = rects[i]; o.draw(ctx, r.w, r.h, t, dt, a, weight, x + r.x, y + r.y); }
              else o.draw(ctx, pw, ph, t, dt, a, weight, x, y);
            }
          }
        }
      }

      // while the camera is out in one of the gaps, a quiet label holds in the middle of the screen
      ctx.textAlign = 'center';
      ctx.font = '300 16px "Alegreya Sans", system-ui, sans-serif';
      const cv = cw + L / 2;                      // the strip position at the centre of the screen
      for (let i = 0; i < N; i++) {
        const label = cfg.panels[i].gapLabel;
        if (!label) continue;
        const g0 = P[i] + Lp * 0.85, g1 = (i === N - 1 ? T : P[i + 1]) + Lp * 0.15;
        for (const m of [-1, 0, 1]) {
          const v = cv - m * T;
          if (v < g0 || v > g1) continue;
          const fade = Math.min(1, (v - g0) / (L * 0.4), (g1 - v) / (L * 0.4));
          ctx.fillStyle = `rgba(232,236,245,${0.7 * fade})`;
          ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 8;
          ctx.fillText(label, W / 2, H / 2);
          ctx.shadowBlur = 0;
        }
      }

      // foregrounds, sliding faster than the scene behind them
      const sway = Math.sin(t * 0.23) * 5 + Math.sin(t * 0.61) * 2;
      for (const [i, along0] of near) {
        if (fronts[i] === false) continue;
        const along = (along0 + centre) * DEPTH - centre;
        if (along > L || along + Lp < 0) continue;
        if (!fronts[i]) fronts[i] = buildFront(i);
        if (!fronts[i]) continue;
        const [x, y] = place(along);
        if (vertical) ctx.drawImage(fronts[i], x + sway - pw * 0.02, y, pw * 1.04, ph);
        else ctx.drawImage(fronts[i], x, y + sway - ph * 0.01, pw, ph * 1.04);
      }

      // keep memory bounded: forget panels well away from the camera
      if (glideStart < 0 && (++frameNo % 120) === 0) {
        const keep = new Set(near.map(([i]) => i));
        for (let i = 0; i < N; i++) {
          if (keep.has(i)) continue;
          const d = Math.min(...[-1, 0, 1].map((m) => Math.abs(P[i] + m * T - cw + centre))) / S;
          if (d > 1.6) { cache[i] = null; if (fronts[i]) fronts[i] = null; }
        }
      }

      if (cfg.post) cfg.post(ctx, w, h, t, a);
    },
  };
}

// fit 'cover' fills the panel (cropping); fit 'contain' shows the whole image
// floating in the haze colour (zoom < 1 leaves room around it). Returns where
// the image landed, so overlays can be placed on features of the picture.
function drawCover(g, img, p, W, H) {
  const [fxp, fyp] = p.focus || [0.5, 0.5];
  const fit = p.fit === 'contain' ? Math.min : Math.max;
  const s = fit(W / img.naturalWidth, H / img.naturalHeight) * (p.zoom || 1);
  const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
  let x, y;
  if (p.fit === 'contain') { x = W * fxp - dw / 2; y = H * fyp - dh / 2; }
  else { x = Math.min(0, Math.max(W - dw, W / 2 - dw * fxp)); y = Math.min(0, Math.max(H - dh, H / 2 - dh * fyp)); }
  if (p.filter) g.filter = p.filter;
  g.drawImage(img, x, y, dw, dh);
  g.filter = 'none';
  return { x, y, w: dw, h: dh };
}

// An archival print on paper: the image contained, toned, with a timeline beneath.
function drawPrint(g, img, p, W, H, cfg) {
  // the paper itself is the channel's haze colour; panels stay transparent around
  // the print so a neighbour's edge never covers it. Just a little grain here.
  // paper grain
  const grain = g.createImageData(256, 256);
  for (let i = 0; i < grain.data.length; i += 4) {
    const v = Math.random() * 255;
    grain.data[i] = grain.data[i + 1] = grain.data[i + 2] = v; grain.data[i + 3] = 10;
  }
  const tile = document.createElement('canvas'); tile.width = tile.height = 256;
  tile.getContext('2d').putImageData(grain, 0, 0);
  g.fillStyle = g.createPattern(tile, 'repeat');
  g.fillRect(0, 0, W, H);

  const maxH = H * 0.6, maxW = W * 0.3;
  const s = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
  const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
  const cx = W * (p.at ?? 0.58), cy = H * 0.42;
  const x = cx - dw / 2, y = cy - dh / 2;
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 40; g.shadowOffsetY = 12;
  g.fillStyle = '#e8dcc4';
  const m = Math.max(10, dw * 0.035);
  g.fillRect(x - m, y - m, dw + m * 2, dh + m * 2.6);   // mount, deeper at the bottom
  g.restore();
  g.filter = p.filter || 'sepia(0.55) contrast(1.05) brightness(0.95)';
  g.drawImage(img, x, y, dw, dh);
  g.filter = 'none';

  // the timeline
  const ly = H * 0.86;
  g.strokeStyle = 'rgba(232,220,196,0.22)';
  g.lineWidth = 1;
  g.beginPath(); g.moveTo(0, ly); g.lineTo(W, ly); g.stroke();
  g.beginPath(); g.moveTo(cx, ly - 8); g.lineTo(cx, ly + 8); g.stroke();
  if (p.year) {
    g.fillStyle = 'rgba(232,220,196,0.6)';
    g.font = '13px "IBM Plex Mono", monospace';
    g.textAlign = 'center';
    g.fillText(p.year, cx, ly + 30);
  }
}

// ------------------------------------------------------------------ overlays
// Small living layers. Positions given in 0..1 of the panel; x/y offsets
// passed to draw() keep anything anchored moving with the picture.

function overlay(o) {
  const make = OVERLAYS[o.type];
  if (!make) throw new Error('unknown overlay ' + o.type);
  const made = make(o);
  if (o.onImage) made.onImage = true;          // coordinates are fractions of the picture, not the panel
  return made;
}

const OVERLAYS = {
  // brief bursts of light inside a region, fired by the sound: lightning in a
  // storm, a meteoroid strike. Busier sound, more flashes.
  flash(o) {
    let fl = [];
    const [x0, y0, x1, y1] = o.region || [0, 0, 1, 1];
    const col = o.color || '235,240,255';
    return {
      draw(ctx, w, h, t, dt, a, wt, ox, oy) {
        if (a.peak || Math.random() < a.level * dt * (o.rate ?? 4)) {
          fl.push({ x: rnd(x0, x1), y: rnd(y0, y1), t0: t, r: rnd(0.6, 1.4) * (o.r ?? 0.06) });
        }
        fl = fl.filter((f) => t - f.t0 < (o.life ?? 0.9));
        ctx.globalCompositeOperation = 'lighter';
        for (const f of fl) {
          const k = (t - f.t0) / (o.life ?? 0.9), al = (1 - k) ** 2 * (o.alpha ?? 0.6) * wt;
          const x = ox + f.x * w, y = oy + f.y * h, r = f.r * Math.min(w, h) * (1 + k * 0.6);
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, `rgba(${col},${al})`); g.addColorStop(0.35, `rgba(${col},${al * 0.35})`); g.addColorStop(1, `rgba(${col},0)`);
          ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }
        ctx.globalCompositeOperation = 'source-over';
      },
    };
  },

  // a wide, soft band of light drifting slowly across the picture, like sun moving over a surface
  sheen(o) {
    const col = o.color || '255,240,215';
    return {
      draw(ctx, w, h, t, dt, a, wt, ox, oy) {
        const period = o.period ?? 40, k = ((t / period) % 1.4) - 0.2;   // a pause between passes
        const cx = ox + k * w, ang = o.angle ?? 0.35, bw = w * (o.width ?? 0.18);
        const al = ((o.alpha ?? 0.08) + a.level * 0.05) * wt;
        ctx.save();
        ctx.beginPath(); ctx.rect(ox, oy, w, h); ctx.clip();
        ctx.translate(cx, oy + h / 2); ctx.rotate(ang);
        const g = ctx.createLinearGradient(-bw, 0, bw, 0);
        g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(0.5, `rgba(${col},${al})`); g.addColorStop(1, `rgba(${col},0)`);
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = g; ctx.fillRect(-bw, -h, bw * 2, h * 2);
        ctx.restore();
      },
    };
  },

  // drifting specks: dust in light, marine snow, spores
  motes(o) {
    let ps = [];
    const col = o.color || '230,240,255', n = o.n || 90, fall = o.fall ?? 6, drift = o.drift ?? -3;
    return {
      screen: true,
      init(W, H) { ps = Array.from({ length: n }, () => ({ x: rnd(0, W), y: rnd(0, H), z: rnd(0.25, 1), ph: rnd(0, TAU) })); },
      draw(ctx, w, h, t, dt, a, wt) {
        ctx.fillStyle = `rgb(${col})`;
        for (const p of ps) {
          p.y += dt * fall * p.z * (1 + a.level); p.x += dt * drift * p.z + Math.sin(t * 0.5 + p.ph) * 0.12;
          if (p.y > h) p.y = -2; if (p.y < -2) p.y = h;
          if (p.x < -2) p.x = w; if (p.x > w + 2) p.x = 0;
          ctx.globalAlpha = p.z * (o.alpha ?? 0.4) * wt;
          const s = p.z * (o.size ?? 1.8);
          ctx.fillRect(p.x, p.y, s, s);
        }
        ctx.globalAlpha = 1;
      },
    };
  },

  snow(o) { return OVERLAYS.motes({ color: '255,255,255', n: 160, fall: 22, drift: -6, size: 2.4, alpha: 0.55, ...o }); },

  // slanting light shafts from above, swaying, brighter on loud moments
  rays(o) {
    const n = o.n || 6;
    const shafts = Array.from({ length: n }, (_, i) => ({ x: (i + rnd(0.2, 0.8)) / n, w: rnd(0.03, 0.09), ph: rnd(0, TAU), sp: rnd(0.05, 0.12) }));
    const col = o.color || '200,245,255';
    return {
      draw(ctx, w, h, t, dt, a, wt, ox, oy) {
        ctx.globalCompositeOperation = 'lighter';
        for (const s of shafts) {
          const sway = Math.sin(t * s.sp + s.ph) * 0.12 * h;
          const x0 = ox + s.x * w, len = h * (o.len ?? 0.9);
          const al = ((o.alpha ?? 0.06) + 0.03 * Math.sin(t * 0.3 + s.ph) + a.level * 0.08) * wt;
          const g = ctx.createLinearGradient(0, oy, 0, oy + len);
          g.addColorStop(0, `rgba(${col},${al})`); g.addColorStop(1, `rgba(${col},0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(x0 - s.w * w * 0.25, oy); ctx.lineTo(x0 + s.w * w * 0.25, oy);
          ctx.lineTo(x0 + sway + s.w * w, oy + len); ctx.lineTo(x0 + sway - s.w * w, oy + len);
          ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      },
    };
  },

  // soft fog bands drifting sideways at given heights
  mist(o) {
    const bands = (o.at || [0.6, 0.75]).map((y) => ({ y, ph: rnd(0, TAU), sp: rnd(4, 10) }));
    const col = o.color || '240,236,228';
    return {
      draw(ctx, w, h, t, dt, a, wt, ox, oy) {
        for (const b of bands) {
          const y = oy + b.y * h, bh = h * (o.height ?? 0.12);
          for (let k = 0; k < 3; k++) {
            const x = ((ox + t * b.sp * (k + 1) * 0.6 + k * w * 0.37) % (w * 1.6)) - w * 0.3;
            const g = ctx.createRadialGradient(x, y, 0, x, y, w * 0.45);
            const al = ((o.alpha ?? 0.12) + a.level * 0.06) * wt * (0.7 + 0.3 * Math.sin(t * 0.1 + b.ph + k));
            g.addColorStop(0, `rgba(${col},${al})`); g.addColorStop(1, `rgba(${col},0)`);
            ctx.save(); ctx.translate(x, y); ctx.scale(1, bh / (w * 0.45)); ctx.translate(-x, -y);
            ctx.fillStyle = g; ctx.fillRect(x - w * 0.45, y - w * 0.45, w * 0.9, w * 0.9);
            ctx.restore();
          }
        }
      },
    };
  },

  // twinkling points scattered over a region (for dark skies)
  stars(o) {
    let st = [];
    const [x0, y0, x1, y1] = o.region || [0, 0, 1, 0.5];
    return {
      init() { st = Array.from({ length: o.n || 120 }, () => ({ x: rnd(x0, x1), y: rnd(y0, y1), s: rnd(0.5, 1.6), ph: rnd(0, TAU), sp: rnd(0.4, 1.8) })); },
      draw(ctx, w, h, t, dt, a, wt, ox, oy) {
        ctx.fillStyle = '#f2f5ff';
        for (const s of st) {
          ctx.globalAlpha = wt * (o.alpha ?? 0.8) * Math.sin(t * s.sp + s.ph) ** 2;
          ctx.fillRect(ox + s.x * w, oy + s.y * h, s.s, s.s);
        }
        ctx.globalAlpha = 1;
      },
    };
  },

  // a soft light at a spot in the picture that breathes with the sound
  glow(o) {
    const col = o.color || '255,210,150';
    return {
      draw(ctx, w, h, t, dt, a, wt, ox, oy) {
        const x = ox + o.x * w, y = oy + o.y * h, r = Math.min(w, h) * (o.r ?? 0.25);
        const al = ((o.alpha ?? 0.15) + a.level * (o.react ?? 0.35)) * wt * (0.85 + 0.15 * Math.sin(t * (o.pulse ?? 0.8)));
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${col},${al})`); g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.globalCompositeOperation = 'source-over';
      },
    };
  },

  fireflies(o) {
    let fl = [];
    const [x0, y0, x1, y1] = o.region || [0, 0.55, 1, 0.95];
    return {
      init() { fl = Array.from({ length: o.n || 35 }, () => ({ x: rnd(x0, x1), y: rnd(y0, y1), ph: rnd(0, TAU), sp: rnd(0.3, 0.9) })); },
      draw(ctx, w, h, t, dt, a, wt, ox, oy) {
        ctx.globalCompositeOperation = 'lighter';
        for (const f of fl) {
          const x = ox + (f.x + Math.sin(t * f.sp * 0.4 + f.ph) * 0.02) * w, y = oy + (f.y + Math.cos(t * f.sp * 0.3 + f.ph) * 0.015) * h;
          const g0 = Math.max(0, Math.sin(t * f.sp * 2 + f.ph)) ** 3 * wt * (0.6 + a.level);
          if (g0 < 0.02) continue;
          const g = ctx.createRadialGradient(x, y, 0, x, y, 8);
          g.addColorStop(0, `rgba(220,255,140,${Math.min(1, g0)})`); g.addColorStop(1, 'rgba(220,255,140,0)');
          ctx.fillStyle = g; ctx.fillRect(x - 8, y - 8, 16, 16);
        }
        ctx.globalCompositeOperation = 'source-over';
      },
    };
  },

  rain(o) {
    let drops = [];
    return {
      screen: true,
      init(W, H) { drops = Array.from({ length: o.n || 220 }, () => ({ x: rnd(0, W), y: rnd(0, H), z: rnd(0.3, 1) })); },
      draw(ctx, w, h, t, dt, a, wt) {
        ctx.strokeStyle = `rgba(210,225,255,${(o.alpha ?? 0.25) * wt})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const d of drops) {
          d.y += dt * 700 * d.z; d.x -= dt * 80 * d.z;
          if (d.y > h) { d.y = -20; d.x = rnd(0, w + 100); }
          ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + 4 * d.z, d.y - 16 * d.z);
        }
        ctx.stroke();
      },
    };
  },

  // gentle wavering light on a water surface, near the top of the panel
  shimmer(o) {
    return {
      draw(ctx, w, h, t, dt, a, wt, ox, oy) {
        ctx.strokeStyle = `rgba(220,250,255,${(o.alpha ?? 0.07) * wt})`;
        ctx.lineWidth = 1.5;
        for (let k = 0; k < (o.n || 6); k++) {
          ctx.beginPath();
          for (let x = 0; x <= w; x += 14) {
            const y = oy + h * (o.y ?? 0.04) + k * 10 + Math.sin(x * 0.014 + t * (0.6 + k * 0.1) + k) * 4 + Math.sin(x * 0.04 - t) * 2;
            x ? ctx.lineTo(ox + x, y) : ctx.moveTo(ox + x, y);
          }
          ctx.stroke();
        }
      },
    };
  },
};
