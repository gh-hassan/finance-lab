// @ts-nocheck
/* Little sounds for the home page story, made with the browser's own sound tools, so there are no sound files to download.
   Nothing plays until the visitor turns sound on, because browsers do not allow sound before a tap or click. */

export function makeSound() {
  let ctx = null, master = null, noise = null;
  const ensure = () => {
    if (!ctx) {
      const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return false;
      ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
      noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.2), ctx.sampleRate);
      const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  };
  /** A short burst of noise, like a key or a pencil: filtered, then faded out quickly. */
  const burst = (at, ms, type, freq, vol) => {
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noise; f.type = type; f.frequency.value = freq; g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0008, at + ms / 1000);
    src.connect(f); f.connect(g); g.connect(master); src.start(at); src.stop(at + ms / 1000 + 0.02);
  };
  /** A soft tone that fades away, optionally sliding to another pitch. */
  const tone = (at, ms, from, to, vol, kind = 'sine') => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = kind; o.frequency.setValueAtTime(from, at); if (to) o.frequency.exponentialRampToValueAtTime(to, at + ms / 1000);
    g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0008, at + ms / 1000);
    o.connect(g); g.connect(master); o.start(at); o.stop(at + ms / 1000 + 0.02);
  };
  const SOUNDS = {
    click: at => { burst(at, 35, 'highpass', 1800, 0.5); tone(at, 45, 900, 500, 0.12); },
    tick: at => tone(at, 40, 1500, 1200, 0.16),
    scribble: at => { for (let i = 0; i < 4; i++) burst(at + i * 0.07, 45, 'bandpass', 2600 + i * 250, 0.12); },
    swish: at => { burst(at, 260, 'bandpass', 1800, 0.1); },
    chime: at => { tone(at, 450, 784, 0, 0.15); tone(at + 0.09, 600, 1175, 0, 0.13); },
    pop: at => tone(at, 110, 500, 950, 0.16)
  };
  return {
    /** Call from a click or tap, so the browser allows sound. Returns whether sound can play. */
    enable: ensure,
    play(name) { if (ctx && SOUNDS[name]) SOUNDS[name](ctx.currentTime + 0.005); },
    close() { if (ctx) { try { ctx.close(); } catch (e) { /* already closed */ } ctx = null; } }
  };
}
