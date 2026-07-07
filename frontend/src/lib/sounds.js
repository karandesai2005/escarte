/**
 * Escarté sound library.
 * Pre-loads audio and provides simple play() helpers. Volume-tuned.
 * Also manages a looping background music track with route-aware volume.
 */

const SOUNDS = {
  click: {
    url: "https://customer-assets.emergentagent.com/job_spark-assess/artifacts/wx8rr4ca_button-click.mp3",
    volume: 0.35,
  },
  fire: {
    url: "https://customer-assets.emergentagent.com/job_spark-assess/artifacts/rbwogts9_37ecb736-12e1-4328-83c6-af7479b45b26-online-audio-converter.mp3",
    volume: 0.6,
  },
  confetti: {
    url: "https://customer-assets.emergentagent.com/job_spark-assess/artifacts/f2ohn07j_confetti-pop.mp3",
    volume: 0.55,
  },
  error: {
    url: "https://customer-assets.emergentagent.com/job_spark-assess/artifacts/4gnp8xqd_typing-error.mp3",
    volume: 0.5,
  },
};

const BG_MUSIC_URL =
  "https://customer-assets.emergentagent.com/job_spark-assess/artifacts/vnrfh2wl_ocean-background-mene.mp3";

const cache = {};

function get(name) {
  if (cache[name]) return cache[name];
  const cfg = SOUNDS[name];
  if (!cfg) return null;
  const a = new Audio(cfg.url);
  a.preload = "auto";
  a.volume = cfg.volume;
  cache[name] = a;
  return a;
}

export function playSound(name, { maxDuration } = {}) {
  try {
    const a = get(name);
    if (!a) return;
    const clone = a.cloneNode();
    clone.volume = SOUNDS[name].volume;
    clone.play().catch(() => {});
    if (maxDuration) {
      setTimeout(() => {
        try {
          // Fade out quickly, then pause
          const start = clone.volume;
          const t0 = performance.now();
          const fadeMs = 200;
          function step(now) {
            const t = Math.min(1, (now - t0) / fadeMs);
            clone.volume = Math.max(0, start * (1 - t));
            if (t < 1) requestAnimationFrame(step);
            else { try { clone.pause(); } catch { /* ignore */ } }
          }
          requestAnimationFrame(step);
        } catch { /* ignore */ }
      }, Math.max(50, maxDuration - 200));
    }
  } catch { /* ignore */ }
}

// ---------- Background music ----------
let bgAudio = null;
let bgStarted = false;
let bgTargetVolume = 0.4;

function ensureBg() {
  if (bgAudio) return bgAudio;
  bgAudio = new Audio(BG_MUSIC_URL);
  bgAudio.loop = true;
  bgAudio.volume = 0;
  bgAudio.preload = "auto";
  return bgAudio;
}

function fadeTo(target, ms = 800) {
  const a = ensureBg();
  const start = a.volume;
  const startTime = performance.now();
  function step(now) {
    const t = Math.min(1, (now - startTime) / ms);
    a.volume = Math.max(0, Math.min(1, start + (target - start) * t));
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/** Start BG music (must be called from a user-gesture handler). */
export function startBgMusic() {
  const a = ensureBg();
  if (bgStarted) return;
  a.play()
    .then(() => {
      bgStarted = true;
      fadeTo(bgTargetVolume, 1200);
    })
    .catch(() => { /* browser blocked — will retry on next gesture */ });
}

/** Set target volume (medium ~0.4, dim ~0.08). Fades smoothly. */
export function setBgVolume(target) {
  bgTargetVolume = target;
  if (!bgStarted) return; // will apply once started
  fadeTo(target, 900);
}

export function stopBgMusic() {
  const a = ensureBg();
  fadeTo(0, 400);
  setTimeout(() => { try { a.pause(); } catch { /* ignore */ } bgStarted = false; }, 500);
}

// Preload on first import
if (typeof window !== "undefined") {
  Object.keys(SOUNDS).forEach((k) => get(k));
  ensureBg();
}

/** Attach a global "any button click" listener. Call once at app root. */
export function installGlobalClickSound() {
  if (typeof window === "undefined" || window.__escarteClickInstalled) return;
  window.__escarteClickInstalled = true;
  document.addEventListener(
    "click",
    (e) => {
      // First user gesture — start BG music
      if (!bgStarted) startBgMusic();

      const el = e.target?.closest?.("button, a[href], [role='button']");
      if (!el) return;
      if (el.dataset?.noClickSound === "true") return;
      playSound("click");
    },
    true
  );

  // Also start on first key press or touch (in case landing has no click)
  const kick = () => { if (!bgStarted) startBgMusic(); };
  window.addEventListener("keydown", kick, { once: true });
  window.addEventListener("touchstart", kick, { once: true });
}
