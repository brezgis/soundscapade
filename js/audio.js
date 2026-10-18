// Sound engine: a synthesized bed per channel (never loops audibly) plus real
// recordings cycling on top. Everything routes through one analyser so the
// visuals can listen too.

import { LIVE_BASE } from './channels.js';

const XFADE = 4;          // seconds between tracks
const LOOP_MIN = 70;      // a looping track plays at least this long...
const LOOP_MAX = 130;     // ...and at most this long
const EVENTS_FOR = 65;    // how long a recurring short clip keeps recurring
const LIVE_FOR = 150;
const LIVE_TARGET_DB = -30;   // RMS the live mics are levelled toward (clips sit around -23)
const LIVE_MAX_BOOST = 30;    // dB; more than this just amplifies hiss
const LIVE_DEAD_DB = -80;     // below this it's dead air, not a quiet place

const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));
const rand = (a, b) => a + Math.random() * (b - a);

export class Engine {
  constructor() {
    const ctx = (this.ctx = new AudioContext());
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);

    this.trackBus = ctx.createGain();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.6;
    this.trackBus.connect(this.analyser);
    this.trackBus.connect(this.master);
    this.timeData = new Float32Array(this.analyser.fftSize);
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);

    this.buffers = new Map();
    this.current = null;     // { stop(fade) }
    this.runId = 0;
    this.onTrack = () => {};
    this._buildBeds();
  }

  // ---------- beds ----------
  _buildBeds() {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 6;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {          // pinkish noise (Paul Kellet's filter)
      const d = buf.getChannelData(c);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;    b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;    b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf; noise.loop = true; noise.start();

    const lfo = (freq, depth, param) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = freq; g.gain.value = depth;
      o.connect(g).connect(param); o.start();
    };
    const chain = (type, freq, q) => {
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const swell = ctx.createGain(); swell.gain.value = 1;
      const out = ctx.createGain(); out.gain.value = 0;
      noise.connect(f).connect(swell).connect(out).connect(this.master);
      return { f, swell, out };
    };

    // air: a high, thin shimmer, like listening to an empty sky
    const air = chain('bandpass', 2400, 0.6);
    lfo(0.05, 0.35, air.swell.gain); lfo(0.031, 700, air.f.frequency);
    // deep: low pressure swell, the weight of water overhead
    const deep = chain('lowpass', 240, 0.8);
    lfo(0.07, 0.5, deep.swell.gain); lfo(0.023, 60, deep.f.frequency);
    // wind: a moving band that gusts
    const wind = chain('bandpass', 520, 1.4);
    lfo(0.09, 0.55, wind.swell.gain); lfo(0.043, 260, wind.f.frequency);

    this.beds = { air: [air, 0.09], deep: [deep, 0.5], wind: [wind, 0.16] };
  }

  setBed(name) {
    const t = this.ctx.currentTime;
    for (const [key, [node, level]] of Object.entries(this.beds)) {
      node.out.gain.cancelScheduledValues(t);
      node.out.gain.setValueAtTime(node.out.gain.value, t);
      node.out.gain.linearRampToValueAtTime(key === name ? level : 0, t + 5);
    }
  }

  // ---------- tracks ----------
  async load(file) {
    if (!this.buffers.has(file)) {
      this.buffers.set(file, fetch(`sounds/${file}.mp3`)
        .then((r) => r.arrayBuffer())
        .then((a) => this.ctx.decodeAudioData(a)));
    }
    return this.buffers.get(file);
  }

  // Start cycling a channel. Cancels whatever was running.
  playChannel(channel, startIndex = 0) {
    const id = ++this.runId;
    this.setBed(channel.bed);
    if (this.current) this.current.stop(2.5);
    this.current = null;
    // panorama channels play in strip order so each change glides to the neighbouring place
    const idx = channel.tracks.map((_, i) => i);
    const order = channel.pano ? idx : shuffle(idx);
    // start somewhere random: shuffled channels from the top of the shuffle, strips at a random place
    let k = channel.pano ? Math.floor(Math.random() * idx.length) : 0;
    this.skip = null;

    let failures = 0;
    const run = async () => {
      while (id === this.runId) {
        const index = order[k % order.length], track = channel.tracks[index];
        k++;
        // warm the next one while this plays
        const next = channel.tracks[order[k % order.length]];
        if (next.file) this.load(next.file);

        let handle;
        try {
          handle = track.mode === 'live' ? await this._playLive(track) : await this._playBuffer(track);
        } catch (e) {
          console.warn('track failed', track.title || track.stream, e);
          // after a whole lap of failures (all mics offline, network down) back off before trying again
          failures++;
          await sleep(failures % order.length === 0 ? 20 : 0.5);
          continue;
        }
        failures = 0;
        if (id !== this.runId) { handle.stop(1.5); return; }
        if (this.current) this.current.stop(XFADE);
        this.current = handle;
        this.onTrack(channel, track, index, handle.duration);

        await Promise.race([sleep(Math.max(5, handle.duration - XFADE)), handle.failed,
          new Promise((r) => (this.skip = r))]);
      }
    };
    run();
  }

  next() { if (this.skip) this.skip(); }

  async _playBuffer(track) {
    const ctx = this.ctx, buf = await this.load(track.file);
    const out = ctx.createGain();
    out.connect(this.trackBus);
    const t0 = ctx.currentTime + 0.05;
    out.gain.setValueAtTime(0, t0);
    out.gain.linearRampToValueAtTime(1, t0 + XFADE);
    const sources = [];
    const once = (when, offset = 0, dur = buf.duration - offset) => {
      const s = ctx.createBufferSource(), g = ctx.createGain();
      s.buffer = buf; s.connect(g).connect(out);
      const f = Math.min(1.5, dur / 4);
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(1, when + f);
      g.gain.setValueAtTime(1, when + dur - f);
      g.gain.linearRampToValueAtTime(0, when + dur);
      s.start(when, offset, dur);
      sources.push(s);
    };

    let duration;
    if (track.mode === 'events') {
      duration = EVENTS_FOR;
      let t = t0 + 1, end = t;
      do {                                       // always at least once, however long the clip
        once(t);
        end = t + buf.duration;
        t = end + rand(4, 11);
      } while (t < t0 + duration - buf.duration);
      duration = Math.max(duration, end - t0 + 1);
    } else {
      duration = Math.min(LOOP_MAX, Math.max(LOOP_MIN, buf.duration));
      // long recordings: start somewhere inside so it's not always the same opening
      let t = t0, offset = buf.duration > LOOP_MAX ? rand(0, buf.duration - LOOP_MAX) : 0;
      while (t < t0 + duration) {
        const dur = buf.duration - offset;
        once(t, offset, dur);
        t += dur - 1.5;           // overlap the seams
        offset = 0;
      }
    }

    return {
      duration,
      failed: new Promise(() => {}),
      stop: (fade) => {
        const t = ctx.currentTime;
        out.gain.cancelScheduledValues(t);
        out.gain.setValueAtTime(out.gain.value, t);
        out.gain.linearRampToValueAtTime(0, t + fade);
        setTimeout(() => { sources.forEach((s) => { try { s.stop(); } catch {} }); out.disconnect(); }, fade * 1000 + 200);
      },
    };
  }

  // Which mounts the Icecast server says are on air. Cached briefly; null if unknown.
  async _liveMounts() {
    if (this._mounts && performance.now() - this._mounts.at < 60000) return this._mounts.set;
    try {
      const r = await fetch(LIVE_BASE + 'status-json.xsl', { cache: 'no-store' });
      let src = (await r.json()).icestats.source || [];
      if (!Array.isArray(src)) src = [src];
      const set = new Set(src.map((x) => (x.listenurl || '').split('/').pop()));
      this._mounts = { at: performance.now(), set };
      return set;
    } catch {
      return null;   // can't tell, so just try the stream
    }
  }

  // Resolves once the stream is actually playing and not dead air; rejects otherwise.
  // Open mics vary by 20+ dB, so each stream is metered and levelled on the fly:
  //   src ─┬─ meter
  //        └─ level (auto gain) ─ limiter ─ fade ─ trackBus
  async _playLive(track) {
    // a stream can't start before the page is allowed to play sound
    while (this.ctx.state !== 'running') await sleep(0.5);
    const mounts = await this._liveMounts();
    if (mounts && !mounts.has(track.stream + '.mp3')) throw new Error('stream offline');

    const ctx = this.ctx;
    const el = new Audio();
    el.crossOrigin = 'anonymous';
    el.preload = 'none';
    el.src = LIVE_BASE + track.stream + '.mp3';
    const src = ctx.createMediaElementSource(el);
    const meter = ctx.createAnalyser();
    meter.fftSize = 2048;
    const level = ctx.createGain();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10; limiter.knee.value = 6; limiter.ratio.value = 12;
    limiter.attack.value = 0.005; limiter.release.value = 0.4;
    const fade = ctx.createGain();
    fade.gain.value = 0;
    src.connect(meter);
    src.connect(level).connect(limiter).connect(fade).connect(this.trackBus);

    const buf = new Float32Array(meter.fftSize);
    let avgDb = null, quietFor = 0, stalledAt = null, ticker = null;
    const kill = () => {
      clearInterval(ticker);
      el.pause(); el.removeAttribute('src'); el.load();
      fade.disconnect();
    };
    let failLater;
    const failed = new Promise((r) => (failLater = r));
    el.addEventListener('error', () => failLater());
    el.addEventListener('ended', () => failLater());
    el.addEventListener('waiting', () => { stalledAt ??= performance.now(); });
    el.addEventListener('playing', () => { stalledAt = null; });

    // every 250 ms: meter, level, and watch for dead air or a stall that never recovers
    const tick = () => {
      meter.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const db = 10 * Math.log10(sum / buf.length + 1e-12);
      avgDb = avgDb === null ? db : avgDb + (db - avgDb) * 0.06;   // ~4 s memory

      quietFor = db < LIVE_DEAD_DB ? quietFor + 0.25 : 0;
      if (quietFor >= 8) failLater();
      if (stalledAt && performance.now() - stalledAt > 10000) failLater();

      const boost = Math.min(LIVE_MAX_BOOST, Math.max(0, LIVE_TARGET_DB - avgDb));
      level.gain.setTargetAtTime(10 ** (boost / 20), ctx.currentTime, 1.5);
    };

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { kill(); reject(new Error('stream timeout')); }, 12000);
      el.addEventListener('playing', () => { clearTimeout(timeout); resolve(); }, { once: true });
      el.play().catch((e) => { clearTimeout(timeout); kill(); reject(e); });
    });

    // listen for a moment before fading in, so the level starts right
    // and a stream that's sending pure silence never gets shown at all
    ticker = setInterval(tick, 250);
    const deadline = performance.now() + 8000;
    for (;;) {
      await sleep(0.25);
      if (avgDb !== null && avgDb > LIVE_DEAD_DB && performance.now() > deadline - 6500) break;
      if (performance.now() > deadline) { kill(); throw new Error('dead air'); }
    }
    level.gain.cancelScheduledValues(ctx.currentTime);
    level.gain.value = 10 ** (Math.min(LIVE_MAX_BOOST, Math.max(0, LIVE_TARGET_DB - avgDb)) / 20);
    const t = ctx.currentTime;
    fade.gain.setValueAtTime(0, t);
    fade.gain.linearRampToValueAtTime(1, t + XFADE);

    return {
      duration: LIVE_FOR, failed,
      stop: (f) => {
        const t = ctx.currentTime;
        fade.gain.cancelScheduledValues(t);
        fade.gain.setValueAtTime(fade.gain.value, t);
        fade.gain.linearRampToValueAtTime(0, t + f);
        setTimeout(kill, f * 1000 + 200);
      },
    };
  }

  // ---------- listening ----------
  // Returns { level 0..1, low, high } smoothed by the caller.
  sample() {
    this.analyser.getFloatTimeDomainData(this.timeData);
    let sum = 0;
    for (let i = 0; i < this.timeData.length; i++) sum += this.timeData[i] ** 2;
    const rms = Math.sqrt(sum / this.timeData.length);
    this.analyser.getByteFrequencyData(this.freqData);
    const n = this.freqData.length;
    let lo = 0, hi = 0;
    for (let i = 1; i < 24; i++) lo += this.freqData[i];
    for (let i = 60; i < n / 3; i++) hi += this.freqData[i];
    return {
      level: Math.min(1, rms * 5),
      low: lo / (23 * 255),
      high: hi / ((n / 3 - 60) * 255),
    };
  }

  setMuted(m) {
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(m ? 0 : 1, t + 0.6);
  }
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
