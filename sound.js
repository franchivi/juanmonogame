/* ===========================================================
   JUAN MONO — Motor de sonido (Web Audio API)
   Todos los efectos se sintetizan en tiempo real: sin archivos.
   Incluye también una música de fondo alegre (loop sintetizado).
   =========================================================== */

(() => {
'use strict';

let ctx = null;          // AudioContext
let masterGain = null;   // volumen general
let musicGain = null;    // volumen de la música
let sfxGain = null;      // volumen de efectos
let musicOn = true;
let sfxOn = true;

let musicTimer = null;   // id del bucle de música
let musicStep = 0;

/* ----------------------------------------------------------
   Inicialización perezosa (el AudioContext debe crearse
   tras un gesto del usuario por restricciones del navegador).
---------------------------------------------------------- */
function init() {
  if (ctx) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.7;
    masterGain.connect(ctx.destination);

    musicGain = ctx.createGain();
    musicGain.gain.value = 0.35;
    musicGain.connect(masterGain);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.85;
    sfxGain.connect(masterGain);
  } catch (e) {
    console.warn('Web Audio no disponible', e);
  }
}

function resume() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

/* ----------------------------------------------------------
   Utilidad: tocar un tono simple (oscilador + envelope).
---------------------------------------------------------- */
function tone(freq, dur, type = 'square', vol = 0.3, attack = 0.005, release = 0.05, target = sfxGain) {
  if (!ctx || !sfxOn) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(target);
  osc.start(t);
  osc.stop(t + dur + release);
  return osc;
}

function slide(f1, f2, dur, type = 'square', vol = 0.3) {
  if (!ctx || !sfxOn) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f1, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(sfxGain);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/* Ruido blanco filtrado (para percusión / viento) */
function noise(dur, vol = 0.2, filterFreq = 1000, type = 'lowpass') {
  if (!ctx || !sfxOn) return;
  const t = ctx.currentTime;
  const bufferSize = Math.floor(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = filterFreq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(sfxGain);
  src.start(t);
  src.stop(t + dur);
}

/* ----------------------------------------------------------
   Efectos concretos del juego
---------------------------------------------------------- */
const sfx = {
  init,
  resume,

  jump() {
    slide(300, 620, 0.18, 'square', 0.22);
  },

  deodorant() {
    // spray fresco: chasquido + do-re-mi brillante
    noise(0.06, 0.18, 4000, 'highpass');
    tone(880, 0.08, 'triangle', 0.25);
    setTimeout(() => tone(1175, 0.08, 'triangle', 0.25), 60);
    setTimeout(() => tone(1568, 0.12, 'triangle', 0.25), 120);
  },

  stomp() {
    // pisotón sobre enemigo: golpe grave + chasquido
    slide(420, 90, 0.18, 'square', 0.3);
    noise(0.1, 0.25, 2200, 'highpass');
  },

  land() {
    slide(200, 120, 0.07, 'sine', 0.18);
  },

  hurt() {
    slide(400, 120, 0.35, 'sawtooth', 0.28);
    setTimeout(() => slide(300, 80, 0.3, 'square', 0.2), 80);
  },

  death() {
    // melodía descendente tipo "game over"
    const notes = [523, 440, 349, 262, 175];
    notes.forEach((f, i) => setTimeout(() => tone(f, 0.25, 'square', 0.3), i * 130));
  },

  victory() {
    // fanfarria
    const seq = [
      [523, 0], [659, 130], [784, 260], [1047, 390],
      [784, 560], [1047, 690], [1319, 820],
    ];
    seq.forEach(([f, t]) => setTimeout(() => tone(f, 0.3, 'square', 0.3), t));
  },

  levelUp() {
    // arpegio ascendente corto
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => tone(f, 0.15, 'triangle', 0.28), i * 80));
  },

  click() {
    tone(660, 0.05, 'square', 0.18);
  },

  start() {
    [392, 523, 659, 784].forEach((f, i) =>
      setTimeout(() => tone(f, 0.12, 'square', 0.25), i * 70));
  },
};

/* ----------------------------------------------------------
   Música de fondo: bucle alegre con bajo + melodía
   Secuenciador sencillo basado en setTimeout.
---------------------------------------------------------- */
// Escala: Do mayor. Notas en Hz.
const N = {
  C4:261.63, D4:293.66, E4:329.63, F4:349.23, G4:392.00, A4:440.00, B4:493.88,
  C5:523.25, D5:587.33, E5:659.25, F5:698.46, G5:783.99, A5:880.00,
  REST: 0,
};

// Melodía principal (32 pasos, 16avos). Alegre y pegadiza.
const MELODY = [
  N.C5, N.E4, N.G4, N.E4,  N.C5, N.E4, N.G4, N.E4,
  N.D5, N.G4, N.B4, N.G4,  N.D5, N.G4, N.B4, N.G4,
  N.E5, N.A4, N.C5, N.A4,  N.E5, N.A4, N.C5, N.A4,
  N.G4, N.B4, N.D5, N.B4,  N.G4, N.B4, N.D5, N.G5,
];

// Bajo (una nota por cada 2 pasos de melodía = 8avos)
const BASS = [
  N.C4, N.C4, N.G4, N.G4, N.A4, N.A4, N.E4, N.E4,
  N.F4, N.F4, N.C4, N.C4, N.G4, N.G4, N.G4, N.G4,
];

function startMusic() {
  if (!ctx || !musicOn || musicTimer !== null) return;
  musicStep = 0;
  const stepMs = 145; // tempo alegre
  const tick = () => {
    if (!musicOn || !ctx) { musicTimer = null; return; }
    const step = musicStep % MELODY.length;
    // melodía
    const m = MELODY[step];
    if (m > 0) playMusicNote(m, stepMs / 1000 * 0.9, 'square', 0.12);
    // bajo cada 2 pasos
    if (step % 2 === 0) {
      const b = BASS[Math.floor(step / 2) % BASS.length];
      if (b > 0) playMusicNote(b, stepMs / 1000 * 1.6, 'triangle', 0.18);
    }
    // bombo en los tiempos fuertes (cada 4 pasos)
    if (step % 4 === 0) noise(0.06, 0.12, 120, 'lowpass');
    musicStep++;
    musicTimer = setTimeout(tick, stepMs);
  };
  tick();
}

function playMusicNote(freq, dur, type, vol) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.setValueAtTime(vol, t + dur * 0.5);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(musicGain);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function stopMusic() {
  if (musicTimer !== null) { clearTimeout(musicTimer); musicTimer = null; }
}

function setMusicOn(on) {
  musicOn = on;
  if (!on) stopMusic();
}

function setSfxOn(on) { sfxOn = on; }
function isMusicOn() { return musicOn; }
function isSfxOn() { return sfxOn; }

// API pública
window.JMSound = {
  sfx,
  startMusic,
  stopMusic,
  setMusicOn,
  setSfxOn,
  isMusicOn,
  isSfxOn,
  init,
  resume,
};

})();
