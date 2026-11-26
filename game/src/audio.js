// audio.js — every sound is synthesized with WebAudio: no audio files.
// A detuned saw pair hums like the prop engine, looped noise rushes like
// wind, and short blips mark gates, landings and warnings. The context is
// created on the first user gesture, so browsers never block it.

import { mulberry32 } from './seed.js';

export function makeAudio() {
  let ctx = null;
  let engineOsc1 = null;
  let engineOsc2 = null;
  let engineGain = null;
  let engineFilter = null;
  let windSrc = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) {
      if (ctx && ctx.state === 'suspended') ctx.resume();
      return;
    }
    started = true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    engineOsc1 = ctx.createOscillator();
    engineOsc1.type = 'sawtooth';
    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'square';
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc1.connect(engineFilter);
    engineOsc2.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc1.start();
    engineOsc2.start();
    // Wind: a 2-second noise buffer looped through a band-pass. The noise
    // itself comes from the seeded generator, like everything else here.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    const rnd = mulberry32(20261126);
    for (let i = 0; i < len; i++) ch[i] = rnd() * 2 - 1;
    windSrc = ctx.createBufferSource();
    windSrc.buffer = buf;
    windSrc.loop = true;
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 700;
    windFilter.Q.value = 0.6;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ctx.destination);
    windSrc.start();
  }

  function blip(freq, dur, vol, when) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + (when || 0);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  return {
    unlock() { ensure(); },
    toggleMute() {
      muted = !muted;
      if (ctx) ctx.destination.gain && (engineGain.gain.value = muted ? 0 : engineGain.gain.value);
      return muted;
    },
    isMuted() { return muted; },
    // Called every frame: engine pitch follows throttle, wind follows speed.
    update(throttle, speed, stalled) {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      const f = 52 + throttle * 88 + (stalled ? 14 : 0);
      engineOsc1.frequency.setTargetAtTime(f, t, 0.08);
      engineOsc2.frequency.setTargetAtTime(f * 1.5 + 3, t, 0.08);
      engineFilter.frequency.setTargetAtTime(320 + throttle * 900, t, 0.1);
      engineGain.gain.setTargetAtTime(0.05 + throttle * 0.075, t, 0.1);
      windFilter.frequency.setTargetAtTime(420 + speed * 9, t, 0.12);
      windGain.gain.setTargetAtTime(Math.min(0.16, speed * 0.0016), t, 0.12);
    },
    gate() { blip(660, 0.16, 0.22); blip(990, 0.22, 0.2, 0.09); },
    land() { blip(330, 0.2, 0.2); blip(495, 0.3, 0.18, 0.1); },
    deliver() {
      blip(523, 0.16, 0.22);
      blip(659, 0.16, 0.22, 0.1);
      blip(784, 0.3, 0.22, 0.2);
    },
    stallWarn() { blip(220, 0.12, 0.16); },
    thud() {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(90, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.18);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.25);
    },
  };
}
