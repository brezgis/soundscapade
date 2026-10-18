import { CHANNELS } from './channels.js';
import { SCENES } from './scenes.js';
import { panorama } from './panorama.js';
import { Engine } from './audio.js';

const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);
const FADE = 3.5;   // scene cross-fade, seconds

let W = 0, H = 0, dpr = 1;
const layers = {};   // channel id -> { scene, canvas, ctx, t }
let active = null, previous = null, fadeStart = 0;
let engine = null, channelIdx = -1, liveTimer = null, capToken = 0;

function layer(id) {
  if (!layers[id]) {
    const c = document.createElement('canvas');
    const ch = CHANNELS.find((x) => x.id === id);
    const scene = ch.pano ? panorama({ ...ch.pano, panels: ch.tracks.map((t) => t.art) }) : SCENES[id]();
    layers[id] = { scene, canvas: c, ctx: c.getContext('2d'), t: Math.random() * 500 };
    sizeLayer(layers[id]);
  }
  return layers[id];
}
function sizeLayer(L) {
  L.canvas.width = W * dpr; L.canvas.height = H * dpr;
  L.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  L.scene.init(W, H);
}
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  W = innerWidth; H = innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  Object.values(layers).forEach(sizeLayer);
}
addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- render loop
const audio = { level: 0, low: 0, high: 0, freq: null, peak: false };
let slow = 0, cooldown = 0, last = performance.now();

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  if (engine) {
    const s = engine.sample();
    audio.level += (s.level - audio.level) * Math.min(1, dt * 6);
    audio.low += (s.low - audio.low) * Math.min(1, dt * 4);
    audio.high += (s.high - audio.high) * Math.min(1, dt * 4);
    slow += (s.level - slow) * dt * 0.6;
    cooldown -= dt;
    audio.peak = cooldown <= 0 && s.level > 0.12 && s.level > slow * 1.8;
    if (audio.peak) cooldown = 1.2;
    audio.freq = engine.freqData;
    audio.wave = engine.timeData;
  }

  const k = previous ? Math.min(1, (now / 1000 - fadeStart) / FADE) : 1;
  for (const L of [previous, active]) {
    if (!L) continue;
    L.t += dt;
    L.scene.draw(L.ctx, W, H, L.t, dt, audio);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (previous) ctx.drawImage(previous.canvas, 0, 0);
  if (active) {
    ctx.globalAlpha = previous ? k * k * (3 - 2 * k) : 1;
    ctx.drawImage(active.canvas, 0, 0);
    ctx.globalAlpha = 1;
  }
  if (k >= 1 && previous) { if (previous.scene.release) previous.scene.release(); previous = null; }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- channels
const nav = $('channels');
CHANNELS.forEach((ch, i) => {
  const b = document.createElement('button');
  b.textContent = ch.name;
  b.title = ch.blurb;
  b.onclick = () => selectChannel(i);
  nav.appendChild(b);
  // a line break that only exists at phone width, so the row wraps 4 / 3
  if (i === 3) { const br = document.createElement('i'); br.className = 'br'; nav.appendChild(br); }
});

function selectChannel(i) {
  if (i === channelIdx) return;                  // already here: don't restart it
  channelIdx = i;
  const ch = CHANNELS[i];
  [...nav.querySelectorAll('button')].forEach((b, j) => { b.classList.toggle('on', j === i); b.setAttribute('aria-pressed', j === i); });
  const next = layer(ch.id);
  if (next !== active) {
    if (previous && previous !== next && previous.scene.release) previous.scene.release();
    previous = active;
    active = next;
    if (next.scene.unplace) next.scene.unplace();
    fadeStart = performance.now() / 1000;
  }
  if (ch.id === 'now') next.scene.setPins(ch.tracks, null);
  hideCaption();
  if (engine) engine.playChannel(ch);
}

// ---------------------------------------------------------------- caption
const cap = $('caption');
let capTimer = null;

// any pending caption belongs to whatever was playing before, so invalidate it
function hideCaption() { capToken++; clearInterval(liveTimer); cap.classList.remove('show'); }

function showTrack(ch, track, index, duration) {
  const L = layers[ch.id];
  if (L && L.scene.goTo) L.scene.goTo(index, duration);
  if (ch.id === 'now') layers.now.scene.setPins(ch.tracks, track);
  hideCaption();
  const token = capToken;
  setTimeout(() => {
    if (token !== capToken) return;              // a newer sound or channel got here first
    $('c-title').textContent = track.title;
    $('c-place').textContent = track.place + (track.mode === 'live' ? '  ·  live' : '');
    if (track.mode === 'live') {
      const tick = () => {
        const time = new Date().toLocaleTimeString([], { timeZone: track.tz, hour: 'numeric', minute: '2-digit' });
        $('c-story').textContent = `Heard through an open microphone, right now. It's ${time} there.`;
      };
      tick();
      liveTimer = setInterval(tick, 20000);
      $('c-credit').textContent = 'Locus Sonus open microphone network';
    } else {
      // the description is quoted from a real source; the credit line says whose words and whose recording
      $('c-story').textContent = track.about;
      const credits = ['Text: ' + track.source, 'Sound: ' + track.credit];
      if (track.art && track.art.credit) credits.push(track.art.credit);
      $('c-credit').textContent = credits.join('  ·  ');
    }
    cap.classList.add('show');
    wake();
  }, 900);
}

// ---------------------------------------------------------------- idle UI
let idleTimer = null;
function wake() {
  document.body.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => document.body.classList.add('idle'), 7000);
}
['mousemove', 'pointerdown', 'keydown', 'touchstart'].forEach((e) => addEventListener(e, wake, { passive: true }));

// ---------------------------------------------------------------- controls
let muted = false;
$('next').onclick = () => engine && engine.next();
$('mute').onclick = toggleMute;
function toggleMute() {
  if (unlocking || document.body.classList.contains('locked')) return;
  muted = !muted;
  engine && engine.setMuted(muted);
  $('mute').textContent = muted ? 'sound off' : 'sound on';
}
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;   // leave browser shortcuts alone
  if (e.key >= '1' && e.key <= String(CHANNELS.length)) selectChannel(+e.key - 1);
  else if (e.key === 'ArrowRight' || e.key === 'n') engine && engine.next();
  else if (e.key === 'ArrowDown') selectChannel((channelIdx + 1) % CHANNELS.length);
  else if (e.key === 'ArrowUp') selectChannel((channelIdx + CHANNELS.length - 1) % CHANNELS.length);
  else if (e.key === 'm') toggleMute();
});

// ---------------------------------------------------------------- start
// Open straight into the scene. Browsers only allow sound after a gesture, so
// the engine runs silently until the first click, tap or key anywhere.
engine = new Engine();
engine.onTrack = showTrack;
let unlocking = false;
function unlock() {
  if (!document.body.classList.contains('locked')) return;
  unlocking = true;                           // so the same click doesn't also mute
  setTimeout(() => (unlocking = false), 400);
  engine.ctx.resume().then(() => {
    document.body.classList.remove('locked');
    $('mute').textContent = muted ? 'sound off' : 'sound on';
  });
}
['pointerdown', 'keydown', 'touchstart'].forEach((e) => addEventListener(e, unlock, { capture: true }));

// open on a random channel (not the live one, which can't make a sound until the first click)
const startable = CHANNELS.map((c, i) => i).filter((i) => CHANNELS[i].id !== 'now');
selectChannel(startable[Math.floor(Math.random() * startable.length)]);
requestAnimationFrame(frame);
