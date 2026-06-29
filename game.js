/* ===========================================================
   REY GORILA COLECTOR 🐒👑
   Juego de plataformas 2D en canvas.
   Un gorila coleccionista recoge cartuchos de NES por la jungla.
   =========================================================== */

(() => {
'use strict';

/* ----------------------------------------------------------
   0. Referencias del DOM
---------------------------------------------------------- */
const canvas   = document.getElementById('game');
const ctx      = canvas.getContext('2d');
const el = {
  menu:       document.getElementById('menu'),
  help:       document.getElementById('help'),
  hud:        document.getElementById('hud'),
  pause:      document.getElementById('pause'),
  gameover:   document.getElementById('gameover'),
  victory:    document.getElementById('victory'),
  leveldone:  document.getElementById('leveldone'),
  touch:      document.getElementById('touch'),
  bananas:    document.getElementById('hud-bananas'),
  total:      document.getElementById('hud-total'),
  lives:      document.getElementById('hud-lives'),
  time:       document.getElementById('hud-time'),
  levelLabel: document.getElementById('hud-level'),
  goBananas:  document.getElementById('go-bananas'),
  goTime:     document.getElementById('go-time'),
  vcBananas:  document.getElementById('vc-bananas'),
  vcTotal:    document.getElementById('vc-total'),
  vcTime:     document.getElementById('vc-time'),
  newRecord:  document.getElementById('new-record'),
  record:     document.getElementById('record'),
  ldLevel:    document.getElementById('ld-level'),
  ldName:     document.getElementById('ld-name'),
  ldBananas:  document.getElementById('ld-bananas'),
  ldTotal:    document.getElementById('ld-total'),
  ldTime:     document.getElementById('ld-time'),
};

/* ----------------------------------------------------------
   1. Dimensiones del canvas (resolución lógica)
   El mundo se dibuja a una resolución fija y se escala al viewport.
---------------------------------------------------------- */
const VIEW_W = 960;
const VIEW_H = 540;
let scale = 1;

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const ratio = Math.min(w / VIEW_W, h / VIEW_H);
  canvas.width  = VIEW_W;
  canvas.height = VIEW_H;
  canvas.style.width  = (VIEW_W * ratio) + 'px';
  canvas.style.height = (VIEW_H * ratio) + 'px';
  scale = ratio;
}
window.addEventListener('resize', resize);
resize();

/* ----------------------------------------------------------
   2. Constantes de física
---------------------------------------------------------- */
const GRAVITY    = 2000;   // px/s^2
const MOVE_SPEED = 290;    // px/s
const JUMP_VEL   = -720;   // px/s
const MAX_FALL   = 1100;   // velocidad de caída máxima
const COYOTE     = 0.10;   // tiempo "coyote" (s) tras salir de plataforma
const JUMP_BUF   = 0.12;   // buffer de salto (s)

/* ----------------------------------------------------------
   3. Estado del juego
---------------------------------------------------------- */
const STATE = { MENU:'menu', PLAY:'play', PAUSE:'pause', OVER:'over', WIN:'win', LEVELEDONE:'leveldone' };
let state = STATE.MENU;

let level = null;          // datos del nivel activo
let player = null;
let enemies = [];
let items = [];            // cartuchos NES
let particles = [];
let camera = { x: 0, y: 0 };
let keys = {};
let jumpBuffer = 0;
let coyoteTimer = 0;
let lives = 3;
let cartridgesCollected = 0;
let elapsed = 0;
let lastTime = 0;
let goalAnim = 0;
let goalMsg = '';
let goalMsgTimer = 0;
let currentLevel = 0;       // índice del nivel activo (0-2)
let totalElapsed = 0;       // tiempo acumulado de toda la partida
let levelStartTime = 0;     // para calcular tiempo por nivel

let record = parseFloat(localStorage.getItem('reygorila_record')) || Infinity;

/* ----------------------------------------------------------
   4. Definición de los niveles
   Coordenadas en px del mundo. El suelo "y" es la PARTE SUPERIOR.
   Tres niveles con dificultad creciente:
     1 — "El Taller"        : introducción, saltos amplios, 4 barriles
     2 — "Las Cuevas"       : más huecos, plataformas estrechas, 6 barriles
     3 — "La Fundición"     : nivel largo, plataformas altas, 8 barriles veloces
---------------------------------------------------------- */
const LEVELS = [
  // ==================== NIVEL 1 — EL TALLER ====================
  {
    name: 'El Taller',
    theme: 'taller',
    worldW: 3600,
    platforms: [
      { x: 0,    y: 480, w: 900,  h: 60, type: 'ground' },
      { x: 1040, y: 480, w: 760,  h: 60, type: 'ground' },
      { x: 1960, y: 480, w: 1640, h: 60, type: 'ground' },

      { x: 360,  y: 370, w: 120, h: 30, type: 'crate' },
      { x: 560,  y: 290, w: 120, h: 30, type: 'crate' },
      { x: 760,  y: 360, w: 100, h: 30, type: 'plat' },   // puente
      { x: 1180, y: 350, w: 130, h: 30, type: 'crate' },
      { x: 1380, y: 260, w: 120, h: 30, type: 'crate' },
      { x: 1560, y: 360, w: 120, h: 30, type: 'plat' },   // puente
      { x: 2080, y: 360, w: 160, h: 30, type: 'crate' },
      { x: 2320, y: 280, w: 120, h: 30, type: 'crate' },
      { x: 2540, y: 360, w: 140, h: 30, type: 'plat' },
      { x: 2780, y: 270, w: 130, h: 30, type: 'crate' },
      { x: 3000, y: 360, w: 140, h: 30, type: 'crate' },
    ],
    cartridges: [
      [120,440],[260,440],[400,330],[480,440],
      [600,250],[700,440],[790,320],
      [1220,310],[1320,440],[1420,220],
      [1620,320],[1700,440],[1800,440],
      [2120,320],[2220,440],[2360,240],
      [2580,320],[2820,230],[3040,320],[3200,440],[3340,440],
    ],
    enemies: [
      { x: 300,  patrolMin: 60,   patrolMax: 880,  speed: 100 },
      { x: 1300, patrolMin: 1060, patrolMax: 1780, speed: 120 },
      { x: 2200, patrolMin: 1980, patrolMax: 2700, speed: 120 },
      { x: 3100, patrolMin: 2780, patrolMax: 3560, speed: 130 },
    ],
    goal: { x: 3480, y: 400, w: 60, h: 80 },
  },

  // ==================== NIVEL 2 — LAS CUEVAS ====================
  {
    name: 'Las Cuevas',
    theme: 'cueva',
    worldW: 4000,
    platforms: [
      { x: 0,    y: 480, w: 600,  h: 60, type: 'ground' },
      { x: 760,  y: 480, w: 420,  h: 60, type: 'ground' },
      { x: 1380, y: 480, w: 360,  h: 60, type: 'ground' },
      { x: 1960, y: 480, w: 460,  h: 60, type: 'ground' },
      { x: 2620, y: 480, w: 380,  h: 60, type: 'ground' },
      { x: 3200, y: 480, w: 800,  h: 60, type: 'ground' },

      // Sección 1: escalera ascendente sobre hueco
      { x: 300,  y: 380, w: 100, h: 30, type: 'plat' },
      { x: 480,  y: 300, w: 100, h: 30, type: 'plat' },
      { x: 640,  y: 220, w: 100, h: 30, type: 'plat' },
      // Puente estrecho sobre hueco 1
      { x: 800,  y: 380, w: 80,  h: 30, type: 'plat' },
      // Sección 2
      { x: 1060, y: 360, w: 100, h: 30, type: 'crate' },
      { x: 1220, y: 260, w: 90,  h: 30, type: 'plat' },
      // Puente sobre hueco 2
      { x: 1400, y: 380, w: 80,  h: 30, type: 'plat' },
      { x: 1580, y: 300, w: 100, h: 30, type: 'crate' },
      // Puente sobre hueco 3
      { x: 1980, y: 360, w: 90,  h: 30, type: 'plat' },
      { x: 2160, y: 260, w: 100, h: 30, type: 'plat' },
      { x: 2340, y: 340, w: 90,  h: 30, type: 'crate' },
      // Puente sobre hueco 4
      { x: 2640, y: 380, w: 80,  h: 30, type: 'plat' },
      { x: 2820, y: 280, w: 100, h: 30, type: 'plat' },
      { x: 3020, y: 360, w: 90,  h: 30, type: 'crate' },
      // Tramo final elevado
      { x: 3260, y: 370, w: 140, h: 30, type: 'crate' },
      { x: 3480, y: 280, w: 120, h: 30, type: 'crate' },
      { x: 3680, y: 360, w: 140, h: 30, type: 'crate' },
    ],
    cartridges: [
      [140,440],[340,340],[380,440],
      [520,260],[680,180],[820,440],
      [840,340],[900,440],[1100,320],
      [1260,220],[1440,340],[1620,260],
      [1820,440],[2020,320],[2200,220],
      [2380,300],[2680,340],[2860,240],
      [3060,320],[3300,330],[3530,240],
      [3730,320],[3900,440],
    ],
    enemies: [
      { x: 300,  patrolMin: 40,   patrolMax: 560,  speed: 120 },
      { x: 900,  patrolMin: 780,  patrolMax: 1140, speed: 130 },
      { x: 1500, patrolMin: 1400, patrolMax: 1700, speed: 140 },
      { x: 2100, patrolMin: 1980, patrolMax: 2380, speed: 140 },
      { x: 2800, patrolMin: 2640, patrolMax: 2980, speed: 150 },
      { x: 3400, patrolMin: 3220, patrolMax: 3960, speed: 150 },
    ],
    goal: { x: 3880, y: 400, w: 60, h: 80 },
  },

  // ==================== NIVEL 3 — LA FUNDICIÓN ====================
  {
    name: 'La Fundición',
    theme: 'fundicion',
    worldW: 4600,
    platforms: [
      { x: 0,    y: 480, w: 480,  h: 60, type: 'ground' },
      { x: 640,  y: 480, w: 340,  h: 60, type: 'ground' },
      { x: 1160, y: 480, w: 300,  h: 60, type: 'ground' },
      { x: 1680, y: 480, w: 320,  h: 60, type: 'ground' },
      { x: 2200, y: 480, w: 360,  h: 60, type: 'ground' },
      { x: 2760, y: 480, w: 300,  h: 60, type: 'ground' },
      { x: 3280, y: 480, w: 380,  h: 60, type: 'ground' },
      { x: 3840, y: 480, w: 760,  h: 60, type: 'ground' },

      // Torre inicial (hueco grande -> requiere saltos precisos)
      { x: 260, y: 380, w: 80,  h: 30, type: 'plat' },
      { x: 400, y: 300, w: 80,  h: 30, type: 'plat' },
      { x: 540, y: 220, w: 80,  h: 30, type: 'plat' },
      { x: 680, y: 380, w: 70,  h: 30, type: 'plat' }, // puente corto
      // Sección media: zig-zag estrecho
      { x: 860,  y: 320, w: 90, h: 30, type: 'plat' },
      { x: 1000, y: 240, w: 80, h: 30, type: 'plat' },
      { x: 1180, y: 380, w: 80, h: 30, type: 'plat' },
      { x: 1340, y: 300, w: 80, h: 30, type: 'plat' },
      { x: 1500, y: 220, w: 80, h: 30, type: 'plat' },
      { x: 1700, y: 360, w: 80, h: 30, type: 'plat' },
      { x: 1860, y: 280, w: 80, h: 30, type: 'plat' },
      { x: 2020, y: 360, w: 80, h: 30, type: 'plat' },
      { x: 2220, y: 300, w: 80, h: 30, type: 'plat' },
      // Plataformas altas de bonificación
      { x: 2400, y: 200, w: 100, h: 30, type: 'crate' },
      { x: 2580, y: 320, w: 80, h: 30, type: 'plat' },
      { x: 2780, y: 240, w: 80, h: 30, type: 'plat' },
      { x: 2960, y: 340, w: 80, h: 30, type: 'plat' },
      { x: 3140, y: 250, w: 80, h: 30, type: 'plat' },
      // Tramo final
      { x: 3320, y: 360, w: 120, h: 30, type: 'crate' },
      { x: 3520, y: 270, w: 110, h: 30, type: 'crate' },
      { x: 3720, y: 350, w: 110, h: 30, type: 'crate' },
      { x: 3940, y: 260, w: 120, h: 30, type: 'crate' },
      { x: 4160, y: 350, w: 120, h: 30, type: 'crate' },
    ],
    cartridges: [
      [120,440],[290,340],[430,260],
      [570,180],[720,340],[880,440],
      [900,280],[1040,200],[1220,340],
      [1380,260],[1540,180],[1740,320],
      [1900,240],[2060,320],[2260,260],
      [2440,160],[2620,280],[2820,200],
      [3000,300],[3180,210],[3360,320],
      [3560,230],[3760,310],[3980,220],
      [4200,310],[4350,440],[4500,440],
    ],
    enemies: [
      { x: 200,  patrolMin: 20,   patrolMax: 440,  speed: 130 },
      { x: 760,  patrolMin: 660,  patrolMax: 940,  speed: 150 },
      { x: 1280, patrolMin: 1180, patrolMax: 1420, speed: 160 },
      { x: 1820, patrolMin: 1700, patrolMax: 1970, speed: 160 },
      { x: 2360, patrolMin: 2220, patrolMax: 2540, speed: 170 },
      { x: 2900, patrolMin: 2780, patrolMax: 3040, speed: 170 },
      { x: 3450, patrolMin: 3300, patrolMax: 3640, speed: 180 },
      { x: 4100, patrolMin: 3860, patrolMax: 4560, speed: 190 },
    ],
    goal: { x: 4480, y: 400, w: 60, h: 80 },
  },
];

/* Construye un nivel a partir de su índice. */
function buildLevel(index) {
  const def = LEVELS[index];
  const items = def.cartridges.map(([x, y]) => ({
    x, y, w: 26, h: 30, collected: false, t: Math.random() * Math.PI * 2,
  }));
  return {
    platforms: def.platforms,
    items,
    enemies: def.enemies,
    goal: { ...def.goal },
    worldW: def.worldW,
    deathY: 700,
    theme: def.theme,
    name: def.name,
  };
}

/* ----------------------------------------------------------
   5. Entidades
---------------------------------------------------------- */
function makePlayer(x, y) {
  return {
    x, y, w: 38, h: 52,
    vx: 0, vy: 0,
    onGround: false,
    facing: 1,        // 1 = derecha, -1 = izquierda
    walkTime: 0,
    invuln: 0,        // tiempo de invulnerabilidad tras daño
    blink: 0,         // animación de parpadeo
    squash: 1,        // efecto de aplastamiento al aterrizar
  };
}

function makeEnemy(def) {
  return {
    x: def.x, y: 0, w: 46, h: 46,
    vx: def.speed * (Math.random() < 0.5 ? 1 : -1),
    patrolMin: def.patrolMin,
    patrolMax: def.patrolMax,
    speed: def.speed,
    rot: 0,
    alive: true,
  };
}

/* ----------------------------------------------------------
   6. Colisiones (AABB contra plataformas sólidas)
---------------------------------------------------------- */
function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

function resolveCollisions(p, platforms) {
  p.onGround = false;

  // Eje X primero
  p.x += p.vx * dt;
  for (const pl of platforms) {
    if (rectsOverlap(p, pl)) {
      if (p.vx > 0) p.x = pl.x - p.w;
      else if (p.vx < 0) p.x = pl.x + pl.w;
      p.vx = 0;
    }
  }
  // Eje Y
  p.y += p.vy * dt;
  for (const pl of platforms) {
    if (rectsOverlap(p, pl)) {
      if (p.vy > 0) {            // cayendo -> aterriza
        p.y = pl.y - p.h;
        if (p.vy > 400) p.squash = 0.6;  // animación al aterrizar
        p.vy = 0;
        p.onGround = true;
      } else if (p.vy < 0) {     // saltando -> golpea techo
        p.y = pl.y + pl.h;
        p.vy = 0;
      }
    }
  }
}

/* ----------------------------------------------------------
   7. Bucle y actualización
---------------------------------------------------------- */
let dt = 0;

function update() {
  if (state !== STATE.PLAY) return;

  elapsed += dt;

  // ---- Entrada del jugador ----
  let dir = 0;
  if (keys.left)  dir -= 1;
  if (keys.right) dir += 1;

  // Buffer de salto
  if (jumpBuffer > 0) jumpBuffer -= dt;
  if (keys.jumpQueued) { jumpBuffer = JUMP_BUF; keys.jumpQueued = false; }

  // Coyote time
  if (player.onGround) coyoteTimer = COYOTE;
  else if (coyoteTimer > 0) coyoteTimer -= dt;

  // Movimiento horizontal
  player.vx = dir * MOVE_SPEED;
  if (dir !== 0) player.facing = dir;

  // Salto (con coyote + buffer)
  if (jumpBuffer > 0 && coyoteTimer > 0) {
    player.vy = JUMP_VEL;
    player.onGround = false;
    coyoteTimer = 0;
    jumpBuffer = 0;
    player.squash = 1.25; // estiramiento al saltar
    spawnDust(player.x + player.w/2, player.y + player.h, 6);
    if (window.JMSound) JMSound.sfx.jump();
  }

  // Variable jump height (soltar salto corta el salto)
  if (!keys.jump && player.vy < -250) player.vy = -250;

  // Gravedad
  player.vy += GRAVITY * dt;
  if (player.vy > MAX_FALL) player.vy = MAX_FALL;

  // Colisiones
  const wasOnGround = player.onGround;
  const fallSpeed = player.vy;
  resolveCollisions(player, level.platforms);
  // Sonido de aterrizaje (acaba de tocar suelo tras caer)
  if (!wasOnGround && player.onGround && fallSpeed > 350) {
    if (window.JMSound) JMSound.sfx.land();
  }

  // Límites del mundo
  if (player.x < 0) { player.x = 0; player.vx = 0; }
  if (player.x + player.w > level.worldW) {
    player.x = level.worldW - player.w; player.vx = 0;
  }

  // Animación
  if (player.onGround && Math.abs(player.vx) > 10) player.walkTime += dt * 12;
  else player.walkTime = 0;
  player.squash += (1 - player.squash) * Math.min(1, dt * 12);
  if (player.invuln > 0) player.invuln -= dt;
  player.blink += dt;

  // ---- Caída al vacío ----
  if (player.y > level.deathY) {
    hurtPlayer(true);
    return;
  }

  // ---- Items (cartuchos NES) ----
  for (const it of items) {
    if (it.collected) continue;
    it.t += dt * 4;
    if (rectsOverlap(player, it)) {
      it.collected = true;
      cartridgesCollected++;
      spawnSparkle(it.x + it.w/2, it.y + it.h/2);
      if (window.JMSound) JMSound.sfx.cartridge();
      updateHud();
    }
  }

  // ---- Enemigos (barriles) ----
  for (const e of enemies) {
    if (!e.alive) continue;
    e.x += e.vx * dt;
    if (e.x < e.patrolMin) { e.x = e.patrolMin; e.vx *= -1; }
    if (e.x + e.w > e.patrolMax) { e.x = e.patrolMax - e.w; e.vx *= -1; }
    e.rot += e.vx * dt * 0.05;

    // Posicionar el barril sobre la plataforma bajo él
    const ground = findGroundUnder(e, level.platforms);
    e.y = ground - e.h;

    // Colisión con jugador
    if (rectsOverlap(player, e)) {
      // ¿Pisada? (jugador cayendo y encima del enemigo)
      if (player.vy > 150 && player.y + player.h - e.y < 24) {
        e.alive = false;
        player.vy = JUMP_VEL * 0.6; // rebote
        spawnPoof(e.x + e.w/2, e.y + e.h/2);
        if (window.JMSound) JMSound.sfx.stomp();
      } else if (player.invuln <= 0) {
        hurtPlayer(false);
      }
    }
  }

  // ---- Meta ----
  goalAnim += dt;
  if (rectsOverlap(player, level.goal)) {
    if (cartridgesCollected >= items.length) {
      winGame();
      return;
    } else if (goalMsgTimer <= 0) {
      goalMsg = `¡Faltan ${items.length - cartridgesCollected} cartuchos NES!`;
      goalMsgTimer = 2.5;
    }
  }
  if (goalMsgTimer > 0) goalMsgTimer -= dt;

  // ---- Cámara (sigue al jugador suavemente) ----
  const targetX = player.x + player.w/2 - VIEW_W/2;
  camera.x += (targetX - camera.x) * Math.min(1, dt * 6);
  camera.x = Math.max(0, Math.min(camera.x, level.worldW - VIEW_W));
  camera.y = 0;

  // ---- Partículas ----
  updateParticles();
}

function findGroundUnder(e, platforms) {
  // Busca la plataforma más alta (menor y) cuyo techo esté a la altura
  // esperada del enemigo y que se solape horizontalmente con él.
  // Para barriles que patrolan por el suelo, esto devuelve el suelo.
  const desiredTop = e.y + e.h; // pies del barril
  let best = null;
  for (const pl of platforms) {
    // ¿Se solapan horizontalmente?
    if (e.x + e.w <= pl.x || e.x >= pl.x + pl.w) continue;
    // ¿La plataforma está a la altura de los pies (±6px) o justo bajo ellos?
    if (Math.abs(pl.y - desiredTop) <= 6) {
      if (best === null || pl.y < best) best = pl.y;
    }
  }
  // Si no encuentra coincidencia exacta, busca el suelo (type ground) más cercano bajo el barril
  if (best === null) {
    for (const pl of platforms) {
      if (e.x + e.w <= pl.x || e.x >= pl.x + pl.w) continue;
      if (pl.y >= desiredTop - 4 && pl.y < 520) {
        if (best === null || pl.y < best) best = pl.y;
      }
    }
  }
  return best !== null ? best : level.deathY;
}

/* ----------------------------------------------------------
   8. Daño y vidas
---------------------------------------------------------- */
function hurtPlayer(fell) {
  if (player.invuln > 0 && !fell) return;
  lives--;
  spawnPoof(player.x + player.w/2, player.y + player.h/2);
  if (window.JMSound) JMSound.sfx.hurt();
  updateHud();

  if (lives <= 0) {
    gameOver();
    return;
  }

  // Knockback + respawn seguro
  player.invuln = 1.5;
  player.vy = -300;
  player.vx = -player.facing * 200;
  if (fell) {
    // Reaparecer cerca de donde cayó, en plataforma segura
    respawnNearSafe();
  }
}

function respawnNearSafe() {
  // Buscar plataforma sólida cercana a la izquierda
  let best = null;
  for (const pl of level.platforms) {
    if (pl.type === 'ground' && pl.x < player.x && pl.x + pl.w > player.x - 200) {
      best = pl;
    }
  }
  if (best) {
    player.x = best.x + best.w / 2;
    player.y = best.y - player.h - 10;
  } else {
    player.x = 50; player.y = 400;
  }
  player.vx = 0; player.vy = 0;
}

/* ----------------------------------------------------------
   9. Partículas
---------------------------------------------------------- */
function spawnDust(x, y, n) {
  for (let i = 0; i < n; i++) {
    particles.push({
      x, y, vx: (Math.random()-0.5)*120, vy: -Math.random()*120,
      life: 0.5, max: 0.5, size: 3 + Math.random()*3, color: '#d4a76a', type:'dust'
    });
  }
}
function spawnSparkle(x, y) {
  for (let i = 0; i < 12; i++) {
    const a = Math.random()*Math.PI*2;
    const s = 80 + Math.random()*120;
    particles.push({
      x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s,
      life: 0.6, max: 0.6, size: 2+Math.random()*4, color: '#fff176', type:'spark'
    });
  }
}
function spawnPoof(x, y) {
  for (let i = 0; i < 14; i++) {
    const a = Math.random()*Math.PI*2;
    const s = 60 + Math.random()*140;
    particles.push({
      x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s - 60,
      life: 0.5, max: 0.5, size: 4+Math.random()*6, color: '#9e9e9e', type:'poof'
    });
  }
}
function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 600 * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

/* ----------------------------------------------------------
   10. Render
---------------------------------------------------------- */
function draw() {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  drawBackground();

  ctx.save();
  ctx.translate(-Math.round(camera.x), -Math.round(camera.y));

  // Plataformas
  for (const pl of level.platforms) drawPlatform(pl);

  // Meta
  drawGoal(level.goal);

  // Items
  for (const it of items) if (!it.collected) drawCartridge(it);

  // Enemigos
  for (const e of enemies) if (e.alive) drawBarrel(e);

  // Jugador
  drawPlayer(player);

  // Partículas
  for (const p of particles) drawParticle(p);

  ctx.restore();

  // Mensaje de meta bloqueada
  if (goalMsgTimer > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(255, 60, 60, ${Math.min(1, goalMsgTimer)})`;
    ctx.font = 'bold 22px "Baloo 2"';
    ctx.textAlign = 'center';
    ctx.fillText(goalMsg, VIEW_W/2, 70);
    ctx.restore();
  }
}

/* ---- Fondo parallax (temático por nivel) ---- */
function drawBackground() {
  const theme = level ? level.theme : 'taller';

  if (theme === 'cueva') {
    // === CUEVA: oscura con cristales brillantes ===
    const sky = ctx.createLinearGradient(0,0,0,VIEW_H);
    sky.addColorStop(0, '#1a0a2e');
    sky.addColorStop(0.5, '#2d1b3d');
    sky.addColorStop(1, '#1a0a1e');
    ctx.fillStyle = sky;
    ctx.fillRect(0,0,VIEW_W,VIEW_H);

    // Cristales brillantes (parallax lento)
    const off1 = (camera.x * 0.15) % 300;
    for (let i = -1; i < 5; i++) {
      const bx = i * 300 - off1;
      ctx.fillStyle = 'rgba(180, 100, 255, 0.35)';
      ctx.beginPath();
      ctx.moveTo(bx + 50, 420);
      ctx.lineTo(bx + 70, 260);
      ctx.lineTo(bx + 90, 420);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(100, 200, 255, 0.25)';
      ctx.beginPath();
      ctx.moveTo(bx + 150, 430);
      ctx.lineTo(bx + 165, 330);
      ctx.lineTo(bx + 180, 430);
      ctx.closePath();
      ctx.fill();
    }

    // Estalactitas colgantes
    const off2 = (camera.x * 0.3) % 200;
    ctx.fillStyle = 'rgba(60, 40, 70, 0.6)';
    for (let i = -1; i < 6; i++) {
      const bx = i * 200 - off2;
      ctx.beginPath();
      ctx.moveTo(bx, 0);
      ctx.lineTo(bx + 30, 0);
      ctx.lineTo(bx + 15, 50 + (i % 3) * 25);
      ctx.closePath();
      ctx.fill();
    }

    // Partículas de polvo brillante
    ctx.fillStyle = 'rgba(200, 180, 255, 0.12)';
    for (let i = 0; i < 20; i++) {
      const px = (i * 73 + camera.x * 0.1) % VIEW_W;
      const py = (i * 47) % VIEW_H;
      ctx.beginPath();
      ctx.arc(px, py, 1.5, 0, Math.PI*2);
      ctx.fill();
    }

  } else if (theme === 'fundicion') {
    // === FUNDICIÓN: cielo rojo industrial con lava ===
    const sky = ctx.createLinearGradient(0,0,0,VIEW_H);
    sky.addColorStop(0, '#2a0a0a');
    sky.addColorStop(0.4, '#4a1010');
    sky.addColorStop(0.8, '#6a2010');
    sky.addColorStop(1, '#ff4500');
    ctx.fillStyle = sky;
    ctx.fillRect(0,0,VIEW_W,VIEW_H);

    // Resplandor de lava en el fondo
    const lavaGlow = ctx.createRadialGradient(VIEW_W/2, VIEW_H, 50, VIEW_W/2, VIEW_H, 350);
    lavaGlow.addColorStop(0, 'rgba(255, 100, 0, 0.35)');
    lavaGlow.addColorStop(1, 'rgba(255, 100, 0, 0)');
    ctx.fillStyle = lavaGlow;
    ctx.fillRect(0, VIEW_H - 200, VIEW_W, 200);

    // Chimeneas industriales (parallax)
    const off1 = (camera.x * 0.25) % 280;
    for (let i = -1; i < 5; i++) {
      const bx = i * 280 - off1;
      ctx.fillStyle = 'rgba(50, 30, 20, 0.7)';
      ctx.fillRect(bx + 40, 200, 40, 280);
      ctx.fillRect(bx + 35, 190, 50, 15);
      // Humo
      ctx.fillStyle = 'rgba(80, 60, 50, 0.25)';
      ctx.beginPath();
      ctx.arc(bx + 60, 170, 25, 0, Math.PI*2);
      ctx.arc(bx + 70, 145, 20, 0, Math.PI*2);
      ctx.arc(bx + 55, 125, 18, 0, Math.PI*2);
      ctx.fill();
    }

    // Tubos / cañerías horizontales
    const off2 = (camera.x * 0.4) % 240;
    ctx.fillStyle = 'rgba(80, 50, 30, 0.45)';
    for (let i = -1; i < 5; i++) {
      const bx = i * 240 - off2;
      ctx.fillRect(bx, 350, 180, 12);
      ctx.fillRect(bx + 50, 380, 140, 8);
    }

    // Chispas / brasas flotantes
    ctx.fillStyle = 'rgba(255, 150, 50, 0.5)';
    for (let i = 0; i < 15; i++) {
      const px = (i * 67 + camera.x * 0.2) % VIEW_W;
      const py = VIEW_H - ((i * 53 + goalAnim * 30) % 400);
      ctx.beginPath();
      ctx.arc(px, py, 1 + (i % 3), 0, Math.PI*2);
      ctx.fill();
    }

  } else {
    // === TALLER: cielo azul con colinas y engranajes ===
    const sky = ctx.createLinearGradient(0,0,0,VIEW_H);
    sky.addColorStop(0, '#5ec6e8');
    sky.addColorStop(0.6, '#a8e0c8');
    sky.addColorStop(1, '#c8b88a');
    ctx.fillStyle = sky;
    ctx.fillRect(0,0,VIEW_W,VIEW_H);

    // Sol
    ctx.fillStyle = 'rgba(255, 235, 150, 0.9)';
    ctx.beginPath();
    ctx.arc(VIEW_W - 120, 90, 50, 0, Math.PI*2);
    ctx.fill();

    // Capa lejana: colinas
    ctx.fillStyle = '#7ec850';
    const off1 = (camera.x * 0.2) % 400;
    for (let i = -1; i < 4; i++) {
      const bx = i*400 - off1;
      ctx.beginPath();
      ctx.moveTo(bx, 420);
      ctx.quadraticCurveTo(bx+100, 300, bx+200, 420);
      ctx.quadraticCurveTo(bx+300, 320, bx+400, 420);
      ctx.lineTo(bx+400, VIEW_H);
      ctx.lineTo(bx, VIEW_H);
      ctx.fill();
    }

    // Capa media: árboles
    const off2 = (camera.x * 0.4) % 300;
    ctx.fillStyle = '#4a9a3a';
    for (let i = -1; i < 5; i++) {
      const bx = i*300 - off2;
      ctx.fillRect(bx+40, 360, 16, 120);
      ctx.beginPath();
      ctx.arc(bx+48, 350, 45, 0, Math.PI*2);
      ctx.fill();
    }

    // Engranajes decorativos flotantes
    ctx.fillStyle = 'rgba(120, 90, 50, 0.35)';
    const off3 = (camera.x * 0.15) % 500;
    for (let i = -1; i < 4; i++) {
      const bx = i*500 - off3;
      drawGear(bx + 120, 130, 38, goalAnim * 0.3 + i);
      drawGear(bx + 360, 200, 28, -goalAnim * 0.4 + i);
    }
  }
}

function drawGear(cx, cy, r, rot) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.beginPath();
  const teeth = 10;
  for (let i = 0; i < teeth*2; i++) {
    const ang = (i / (teeth*2)) * Math.PI * 2;
    const rr = (i % 2 === 0) ? r : r * 0.78;
    const px = Math.cos(ang) * rr;
    const py = Math.sin(ang) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  // agujero
  ctx.fillStyle = 'rgba(135,206,235,0.6)';
  ctx.beginPath();
  ctx.arc(0,0,r*0.35,0,Math.PI*2);
  ctx.fill();
  ctx.fillStyle = 'rgba(120, 90, 50, 0.35)';
  ctx.restore();
}

/* ---- Plataformas ---- */
function drawPlatform(pl) {
  if (pl.type === 'ground') {
    // Tierra con hierba
    ctx.fillStyle = '#6b3410';
    ctx.fillRect(pl.x, pl.y + 8, pl.w, pl.h);
    ctx.fillStyle = '#5a8c3a';
    ctx.fillRect(pl.x, pl.y, pl.w, 14);
    ctx.fillStyle = '#7ec850';
    ctx.fillRect(pl.x, pl.y, pl.w, 6);
    // textura de tierra
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    for (let i = 0; i < pl.w; i += 28) {
      ctx.fillRect(pl.x + i + 6, pl.y + 20, 4, 4);
      ctx.fillRect(pl.x + i + 16, pl.y + 34, 5, 5);
    }
  } else if (pl.type === 'crate') {
    // Caja de madera de chapero
    ctx.fillStyle = '#c08850';
    ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
    ctx.strokeStyle = '#6b3410';
    ctx.lineWidth = 3;
    ctx.strokeRect(pl.x+1.5, pl.y+1.5, pl.w-3, pl.h-3);
    // vetas
    ctx.strokeStyle = 'rgba(107,52,16,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pl.x, pl.y); ctx.lineTo(pl.x+pl.w, pl.y+pl.h);
    ctx.moveTo(pl.x+pl.w, pl.y); ctx.lineTo(pl.x, pl.y+pl.h);
    ctx.stroke();
  } else {
    // Plataforma metálica
    ctx.fillStyle = '#9e9e9e';
    ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
    ctx.fillStyle = '#cfcfcf';
    ctx.fillRect(pl.x, pl.y, pl.w, 5);
    ctx.fillStyle = '#707070';
    ctx.fillRect(pl.x, pl.y + pl.h - 5, pl.w, 5);
    // tornillos
    ctx.fillStyle = '#505050';
    for (let i = 10; i < pl.w; i += 30) {
      ctx.beginPath(); ctx.arc(pl.x + i, pl.y + 8, 2.5, 0, Math.PI*2); ctx.fill();
    }
  }
}

/* ---- Cartucho NES ---- */
function drawCartridge(it) {
  const cx = it.x + it.w/2;
  const cy = it.y + it.h/2 + Math.sin(it.t)*4;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(0.05);
  // Cuerpo del bote (cilindro azul fresco)
  ctx.fillStyle = '#4fc3f7';
  ctx.strokeStyle = '#0277bd';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-9, -10, 18, 24, 3);
  ctx.fill();
  ctx.stroke();
  // Etiqueta blanca
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-7, -4, 14, 10);
  // Marca "DX" en la etiqueta
  ctx.fillStyle = '#0277bd';
  ctx.font = 'bold 7px "Baloo 2"';
  ctx.textAlign = 'center';
  ctx.fillText('DX', 0, 4);
  // Tapón superior
  ctx.fillStyle = '#eceff1';
  ctx.strokeStyle = '#90a4ae';
  ctx.beginPath();
  ctx.roundRect(-6, -15, 12, 6, 2);
  ctx.fill();
  ctx.stroke();
  // Boquilla
  ctx.fillStyle = '#78909c';
  ctx.fillRect(-2, -17, 4, 3);
  // Brillo
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(-7, -8, 3, 18);
  ctx.restore();
}

/* ---- Barril enemigo ---- */
function drawBarrel(e) {
  const cx = e.x + e.w/2;
  const cy = e.y + e.h/2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(e.rot);
  // cuerpo
  ctx.fillStyle = '#8b4513';
  ctx.fillRect(-e.w/2, -e.h/2, e.w, e.h);
  ctx.strokeStyle = '#5a2d0c';
  ctx.lineWidth = 3;
  ctx.strokeRect(-e.w/2, -e.h/2, e.w, e.h);
  // aros metálicos
  ctx.strokeStyle = '#b0b0b0';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-e.w/2, -10); ctx.lineTo(e.w/2, -10);
  ctx.moveTo(-e.w/2, 10);  ctx.lineTo(e.w/2, 10);
  ctx.stroke();
  // vetas verticales
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.5;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(i*12, -e.h/2+4); ctx.lineTo(i*12, e.h/2-4);
    ctx.stroke();
  }
  ctx.restore();
}

function drawStar(cx, cy, outerR, innerR, points, fill, stroke) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const ang = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(ang) * r;
    const y = Math.sin(ang) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();
}

/* ---- Meta: Estrella NES dorada ---- */
function drawGoal(g) {
  const bob = Math.sin(goalAnim * 3) * 6;
  const cx = g.x + g.w/2;
  const cy = g.y + g.h/2 + bob;
  ctx.save();
  ctx.translate(cx, cy);

  const allDone = cartridgesCollected >= items.length;
  const glow = ctx.createRadialGradient(0,0,5, 0,0,60);
  glow.addColorStop(0, allDone ? 'rgba(255,235,100,0.55)' : 'rgba(255,90,90,0.45)');
  glow.addColorStop(1, allDone ? 'rgba(255,235,100,0)' : 'rgba(255,90,90,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-65,-65,130,130);

  // estrella de 5 puntas dorada (tamaño NES)
  drawStar(0, -6, 22, 12, 5, '#ffd700', '#b8860b');

  ctx.restore();

  // banderín "META"
  ctx.save();
  ctx.translate(g.x + g.w/2, g.y - 10 + bob*0.3);
  ctx.fillStyle = '#ff3b3b';
  ctx.beginPath();
  ctx.moveTo(0,0); ctx.lineTo(0,24); ctx.lineTo(40,12); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px "Baloo 2"';
  ctx.textAlign = 'center';
  ctx.fillText('META', 14, 16);
  ctx.restore();
}

/* ---- El protagonista: REY GORILA ---- */
function drawPlayer(p) {
  // Parpadeo por invulnerabilidad
  if (p.invuln > 0 && Math.floor(p.invuln * 16) % 2 === 0) return;

  const cx = p.x + p.w/2;
  const baseY = p.y + p.h;
  const sq = p.squash;
  const sx = 1 / Math.sqrt(sq);   // al estirar vertical, se estrecha
  const sy = sq;

  ctx.save();
  ctx.translate(cx, baseY);
  ctx.scale(p.facing * sx, sy);

  const W = p.w;   // 44
  const H = p.h;   // 54
  // Origen: pies en (0,0), cuerpo hacia arriba (negativo)
  const top    = -H;
  const headY  = -H + 16;   // centro de la cabeza
  const bodyTop= -H + 26;

  // Sombra
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 0, W*0.55, 5, 0, 0, Math.PI*2);
  ctx.fill();

  // === PIERNAS y PIES tipo DK: robustos ===
  const legSwing = Math.sin(p.walkTime) * 6;
  const legSwing2 = Math.sin(p.walkTime + Math.PI) * 6;
  ctx.fillStyle = '#1f1208'; // pelaje oscuro piernas
  // pierna izq
  ctx.fillRect(-14, -16, 11, 16 + (p.onGround ? legSwing*0.5 : 0));
  // pierna der
  ctx.fillRect(3, -16, 11, 16 + (p.onGround ? legSwing2*0.5 : 0));
  // pies grandes
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(-17, -3 + (p.onGround ? legSwing*0.5 : 0), 14, 6);
  ctx.fillRect(3, -3 + (p.onGround ? legSwing2*0.5 : 0), 14, 6);

  // === CUERPO más ancho y musculoso ===
  ctx.fillStyle = '#7a4f2a'; // pelaje torso DK
  ctx.beginPath();
  ctx.roundRect(-18, bodyTop, 36, 26, 7);
  ctx.fill();

  // peto/pecho más claro
  ctx.fillStyle = '#9e6b3e';
  ctx.beginPath();
  ctx.roundRect(-15, bodyTop, 30, 12, 5);
  ctx.fill();

  // === CORBATA ROJA corta de DK ===
  ctx.fillStyle = '#d11a1a';
  ctx.beginPath();
  ctx.moveTo(-3, bodyTop + 2);
  ctx.lineTo(3, bodyTop + 2);
  ctx.lineTo(0, bodyTop + 12);
  ctx.closePath();
  ctx.fill();

  // bolsillo grande
  ctx.strokeStyle = '#5a3820';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-9, bodyTop+14, 18, 9);

  // === BRAZOS: peludos y más gruesos ===
  ctx.fillStyle = '#7a4f2a';
  const armSwing = p.onGround ? Math.sin(p.walkTime + Math.PI/2) * 5 : 0;
  // brazo trasero
  ctx.fillStyle = '#5e3b20';
  ctx.fillRect(-21, bodyTop+2, 8, 17);
  // brazo delantero
  ctx.fillStyle = '#7a4f2a';
  ctx.save();
  ctx.translate(18, bodyTop+3);
  ctx.rotate(armSwing * 0.05);
  ctx.fillRect(-4, 0, 8, 17);
  // mano grande
  ctx.fillStyle = '#5e3b20';
  ctx.beginPath(); ctx.arc(0, 18, 5, 0, Math.PI*2); ctx.fill();
  ctx.restore();

  // === CABEZA: cara ancha y hocico marcado estilo DK ===
  // cara / hocico
  ctx.fillStyle = '#d9a066';
  ctx.beginPath();
  ctx.ellipse(0, headY+5, 11, 9, 0, 0, Math.PI*2);
  ctx.fill();
  // cabeza peluda
  ctx.fillStyle = '#7a4f2a';
  ctx.beginPath();
  ctx.ellipse(0, headY-1, 14, 13, 0, 0, Math.PI*2);
  ctx.fill();
  // cresta/pelillo superior
  ctx.fillStyle = '#6a4020';
  ctx.beginPath();
  ctx.ellipse(-2, headY-11, 5, 4, -0.2, 0, Math.PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(4, headY-12, 5, 4, 0.2, 0, Math.PI*2);
  ctx.fill();

  // orejas más redondeadas
  ctx.fillStyle = '#7a4f2a';
  ctx.beginPath(); ctx.arc(-14, headY-2, 6, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(14, headY-2, 6, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#d9a066';
  ctx.beginPath(); ctx.arc(-14, headY-2, 3, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(14, headY-2, 3, 0, Math.PI*2); ctx.fill();

  // cejas/pómulos marcados
  ctx.fillStyle = '#6a4020';
  ctx.beginPath(); ctx.arc(-5, headY-5, 3.2, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(5, headY-5, 3.2, 0, Math.PI*2); ctx.fill();

  // ojos
  const blink = (Math.sin(p.blink * 1.3) > 0.97) ? 0.3 : 1;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(-5, headY-2, 3.5, 3.5*blink, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(5, headY-2, 3.5, 3.5*blink, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.arc(-5 + (p.facing>0?0.5:0), headY-2, 1.7, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(5 + (p.facing>0?0.5:0), headY-2, 1.7, 0, Math.PI*2); ctx.fill();

  // fosas nasales
  ctx.fillStyle = '#2a1508';
  ctx.beginPath(); ctx.arc(-2, headY+5, 1.8, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(2, headY+5, 1.8, 0, Math.PI*2); ctx.fill();

  // boca (sonrisa más ancha)
  ctx.strokeStyle = '#2a1508';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, headY+9, 4, 0.25, Math.PI - 0.25);
  ctx.stroke();

  ctx.restore();
}

/* ---- Items: cartucho NES dibujado con canvas ---- */
function drawCartridge(it) {
  const cx = it.x + it.w / 2;
  const cy = it.y + it.h / 2 + Math.sin(it.t) * 2.5;

  ctx.save();
  ctx.translate(cx, cy);

  // cuerpo principal
  ctx.fillStyle = '#2b2b2b';
  ctx.fillRect(-11, -9, 22, 18);

  // etiqueta superior roja
  ctx.fillStyle = '#d62828';
  ctx.fillRect(-10, -9, 20, 6);

  // cinta dorada NES
  ctx.fillStyle = '#ffd700';
  ctx.fillRect(-10, 2, 20, 3);

  // borde blanco sutil
  ctx.strokeStyle = '#f1faee';
  ctx.lineWidth = 1;
  ctx.strokeRect(-11, -9, 22, 18);

  // brillo
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(-10, -7, 6, 13);

  ctx.restore();
}

/* ---- Partículas ---- */
function drawParticle(p) {
  const a = Math.max(0, p.life / p.max);
  ctx.globalAlpha = a;
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.size * a, 0, Math.PI*2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/* ----------------------------------------------------------
   11. Bucle principal
---------------------------------------------------------- */
function loop(t) {
  if (!lastTime) lastTime = t;
  dt = Math.min(0.033, (t - lastTime) / 1000);
  lastTime = t;

  if (state === STATE.PLAY) {
    update();
    draw();
    el.time.textContent = elapsed.toFixed(1);
  } else if (state === STATE.PAUSE) {
    draw(); // dibuja el último frame congelado
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ----------------------------------------------------------
   12. HUD y pantallas
---------------------------------------------------------- */
function updateHud() {
  el.bananas.textContent = cartridgesCollected;
  el.lives.textContent = lives;
}
function showOverlay(name) {
  [el.menu, el.help, el.pause, el.gameover, el.victory, el.leveldone].forEach(o => o.classList.add('hidden'));
  if (name) document.getElementById(name).classList.remove('hidden');
}

/* ----------------------------------------------------------
   13. Flujo del juego
---------------------------------------------------------- */
/* Inicia una partida completa desde el nivel 1. */
function startGame() {
  if (window.JMSound) { JMSound.init(); JMSound.resume(); JMSound.sfx.start(); }
  currentLevel = 0;
  lives = 3;
  totalElapsed = 0;
  loadLevel(0);
  if (window.JMSound) JMSound.startMusic();
}

/* Carga un nivel concreto: construye entidades, resetea cámara, etc. */
function loadLevel(idx) {
  currentLevel = idx;
  level = buildLevel(idx);
  player = makePlayer(60, 420);
  enemies = level.enemies.map(makeEnemy);
  items = level.items;
  particles = [];
  camera = { x: 0, y: 0 };
  cartridgesCollected = 0;
  elapsed = 0;
  levelStartTime = performance.now();
  jumpBuffer = 0; coyoteTimer = 0;
  goalMsg = ''; goalMsgTimer = 0;
  keys = {};
  el.total.textContent = items.length;
  el.levelLabel.textContent = `Nivel ${idx + 1}/${LEVELS.length} — ${level.name}`;
  updateHud();
  el.hud.classList.remove('hidden');
  detectTouch();
  showOverlay(null);
  state = STATE.PLAY;
}

function pauseGame() {
  if (state !== STATE.PLAY) return;
  state = STATE.PAUSE;
  showOverlay('pause');
}
function resumeGame() {
  if (state !== STATE.PAUSE) return;
  state = STATE.PLAY;
  showOverlay(null);
  lastTime = 0; // reinicia delta
}

function gameOver() {
  state = STATE.OVER;
  if (window.JMSound) { JMSound.stopMusic(); JMSound.sfx.death(); }
  el.goBananas.textContent = cartridgesCollected;
  el.goTime.textContent = totalElapsed.toFixed(1);
  el.hud.classList.add('hidden');
  el.touch.classList.add('hidden');
  showOverlay('gameover');
}

/* El jugador llega a la meta del nivel actual. */
function winGame() {
  totalElapsed += elapsed;
  // ¿Era el último nivel? -> victoria final
  if (currentLevel >= LEVELS.length - 1) {
    state = STATE.WIN;
    if (window.JMSound) { JMSound.stopMusic(); JMSound.sfx.victory(); }
    el.vcBananas.textContent = cartridgesCollected;
    el.vcTotal.textContent = items.length;
    el.vcTime.textContent = totalElapsed.toFixed(1);
    el.hud.classList.add('hidden');
    el.touch.classList.add('hidden');
    // récord: menor tiempo total con todos los cartuchos NES
    const isRecord = totalElapsed < record;
    if (isRecord) {
      record = totalElapsed;
      localStorage.setItem('reygorila_record', String(record));
      el.newRecord.classList.remove('hidden');
    } else {
      el.newRecord.classList.add('hidden');
    }
    updateRecordDisplay();
    showOverlay('victory');
  } else {
    // Nivel superado -> pantalla intermedia
    if (window.JMSound) JMSound.sfx.levelUp();
    state = STATE.LEVELEDONE;
    el.ldLevel.textContent = `Nivel ${currentLevel + 1}`;
    el.ldName.textContent = level.name;
    el.ldBananas.textContent = cartridgesCollected;
    el.ldTotal.textContent = items.length;
    el.ldTime.textContent = elapsed.toFixed(1);
    el.hud.classList.add('hidden');
    el.touch.classList.add('hidden');
    showOverlay('leveldone');
  }
}

function nextLevel() {
  loadLevel(currentLevel + 1);
}

function backToMenu() {
  state = STATE.MENU;
  if (window.JMSound) JMSound.stopMusic();
  el.hud.classList.add('hidden');
  el.touch.classList.add('hidden');
  updateRecordDisplay();
  showOverlay('menu');
}

function updateRecordDisplay() {
  el.record.textContent = (record === Infinity) ? '—' : record.toFixed(1) + 's';
}
/* ----------------------------------------------------------
   14. Entrada (teclado + táctil)
---------------------------------------------------------- */
const KEY_MAP = {
  'ArrowLeft':'left','a':'left','A':'left',
  'ArrowRight':'right','d':'right','D':'right',
  'ArrowUp':'jump','w':'jump','W':'jump',' ':'jump',
};
const JUMP_KEYS = new Set(['ArrowUp','w','W',' ']);

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    if (state === STATE.PLAY) pauseGame();
    else if (state === STATE.PAUSE) resumeGame();
    return;
  }
  const action = KEY_MAP[e.key];
  if (!action) return;
  e.preventDefault();
  keys[action] = true;
  if (JUMP_KEYS.has(e.key)) {
    if (!keys.jumpHeld) { keys.jumpQueued = true; keys.jumpHeld = true; }
  }
});
window.addEventListener('keyup', (e) => {
  const action = KEY_MAP[e.key];
  if (!action) return;
  keys[action] = false;
  if (JUMP_KEYS.has(e.key)) keys.jumpHeld = false;
});

// Táctil
function bindTouchBtn(id, action) {
  const btn = document.getElementById(id);
  const press = (e) => { e.preventDefault(); keys[action] = true;
    if (action === 'jump') keys.jumpQueued = true; };
  const release = (e) => { e.preventDefault(); keys[action] = false; };
  btn.addEventListener('touchstart', press, {passive:false});
  btn.addEventListener('touchend', release, {passive:false});
  btn.addEventListener('touchcancel', release, {passive:false});
  btn.addEventListener('mousedown', press);
  btn.addEventListener('mouseup', release);
  btn.addEventListener('mouseleave', release);
}
bindTouchBtn('t-left','left');
bindTouchBtn('t-right','right');
bindTouchBtn('t-jump','jump');

function detectTouch() {
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    document.body.classList.add('touch-mode');
    el.touch.classList.remove('hidden');
  }
}

/* ----------------------------------------------------------
   15. Botones de la UI
---------------------------------------------------------- */
document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-help').addEventListener('click', () => showOverlay('help'));
document.getElementById('btn-help-back').addEventListener('click', () => showOverlay('menu'));
document.getElementById('btn-resume').addEventListener('click', resumeGame);
document.getElementById('btn-quit').addEventListener('click', backToMenu);
document.getElementById('btn-retry').addEventListener('click', startGame);
document.getElementById('btn-go-menu').addEventListener('click', backToMenu);
document.getElementById('btn-play-again').addEventListener('click', startGame);
document.getElementById('btn-vc-menu').addEventListener('click', backToMenu);
document.getElementById('btn-next-level').addEventListener('click', nextLevel);
document.getElementById('btn-ld-menu').addEventListener('click', backToMenu);

// Botones de sonido (toggle SFX y música) — siempre disponibles
document.getElementById('btn-sfx').addEventListener('click', () => {
  if (!window.JMSound) return;
  JMSound.init();
  const on = !JMSound.isSfxOn();
  JMSound.setSfxOn(on);
  document.getElementById('btn-sfx').textContent = on ? '🔊' : '🔇';
  if (on) JMSound.sfx.click();
});
document.getElementById('btn-music').addEventListener('click', () => {
  if (!window.JMSound) return;
  JMSound.init();
  const on = !JMSound.isMusicOn();
  JMSound.setMusicOn(on);
  document.getElementById('btn-music').textContent = on ? '🎵' : '🎶';
  if (on && state === STATE.PLAY) JMSound.startMusic();
});

// Polyfill para roundRect (navegadores antiguos)
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x,y,w,h,r) {
    if (typeof r === 'number') r = {tl:r,tr:r,br:r,bl:r};
    else r = {tl:r[0],tr:r[1],br:r[2],bl:r[3]};
    this.beginPath();
    this.moveTo(x+r.tl, y);
    this.lineTo(x+w-r.tr, y);
    this.quadraticCurveTo(x+w, y, x+w, y+r.tr);
    this.lineTo(x+w, y+h-r.br);
    this.quadraticCurveTo(x+w, y+h, x+w-r.br, y+h);
    this.lineTo(x+r.bl, y+h);
    this.quadraticCurveTo(x, y+h, x, y+h-r.bl);
    this.lineTo(x, y+r.tl);
    this.quadraticCurveTo(x, y, x+r.tl, y);
    this.closePath();
    return this;
  };
}

// Inicializar
updateRecordDisplay();
detectTouch();

})();
