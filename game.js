const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayScore = document.getElementById('overlayScore');
const overlayBtn = document.getElementById('overlayBtn');

const W = canvas.width;
const H = canvas.height;

// --- Audio ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function beep(freq, type, duration, vol = 0.15) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function shootSound() { beep(880, 'square', 0.08); }
function invaderShootSound() { beep(220, 'sawtooth', 0.12); }
function explosionSound() { beep(80, 'sawtooth', 0.25, 0.3); }
function ufoSound() { beep(440 + Math.random() * 200, 'square', 0.1, 0.05); }

// March sounds
const marchFreqs = [160, 130, 100, 80];
let marchIndex = 0;
function marchSound() {
  beep(marchFreqs[marchIndex % marchFreqs.length], 'square', 0.06, 0.2);
  marchIndex++;
}

// --- Invader shapes (pixel art, 11x8 grid scaled) ---
const INVADER_SHAPES = {
  // type A (top 1 row) - squid
  A: [
    [0,0,1,0,0,0,0,0,1,0,0],
    [0,0,0,1,0,0,0,1,0,0,0],
    [0,0,1,1,1,1,1,1,1,0,0],
    [0,1,1,0,1,1,1,0,1,1,0],
    [1,1,1,1,1,1,1,1,1,1,1],
    [1,0,1,1,1,1,1,1,1,0,1],
    [1,0,1,0,0,0,0,0,1,0,1],
    [0,0,0,1,1,0,1,1,0,0,0],
  ],
  // type B (middle 2 rows) - crab
  B: [
    [0,0,1,0,0,0,0,0,1,0,0],
    [1,0,0,1,0,0,0,1,0,0,1],
    [1,0,1,1,1,1,1,1,1,0,1],
    [1,1,1,0,1,1,1,0,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1],
    [0,1,1,1,1,1,1,1,1,1,0],
    [0,0,1,0,0,0,0,0,1,0,0],
    [0,1,0,0,0,0,0,0,0,1,0],
  ],
  // type C (bottom 2 rows) - octopus
  C: [
    [0,0,0,0,1,1,1,1,0,0,0,0],
    [0,1,1,1,1,1,1,1,1,1,1,0],
    [1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,0,0,1,1,0,0,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1],
    [0,0,1,1,1,0,0,1,1,1,0,0],
    [0,1,1,0,0,1,1,0,0,1,1,0],
    [1,1,0,0,0,0,0,0,0,0,1,1],
  ],
};

// Scale factors
const CELL = 3; // pixels per grid cell
const INV_W = 11 * CELL + 10; // invader width
const INV_H = 8 * CELL + 6;  // invader height
const INV_COLS = 11;
const INV_ROWS = 5;
const INV_XGAP = 16;
const INV_YGAP = 12;

// Colors per row
const INV_COLORS = ['#ff44ff', '#44ffff', '#44ffff', '#33ff33', '#33ff33'];

// Shield shape
const SHIELD_W = 64;
const SHIELD_H = 42;

function buildShieldPixels() {
  const px = [];
  for (let r = 0; r < SHIELD_H; r++) {
    for (let c = 0; c < SHIELD_W; c++) {
      // dome top
      let inShield = true;
      // Cut corners at top
      const topDome = SHIELD_H * 0.55;
      if (r < topDome) {
        const cx = SHIELD_W / 2;
        const rx = SHIELD_W / 2;
        const ry = topDome;
        const dx = (c - cx) / rx;
        const dy = (r - ry) / ry;
        if (dx * dx + dy * dy > 1) inShield = false;
      }
      // notch at bottom center
      if (r > SHIELD_H * 0.6 && c > SHIELD_W * 0.3 && c < SHIELD_W * 0.7) inShield = false;
      if (inShield) px.push([c, r]);
    }
  }
  return px;
}

// --- Game state ---
let state = {};

function initGame() {
  state = {
    score: 0,
    hiScore: state.hiScore || 0,
    lives: 3,
    level: 1,

    // Player
    player: { x: W / 2, y: H - 56, w: 40, h: 20, speed: 5 },
    playerBullet: null,
    playerFlash: 0,

    // Invaders
    invaders: [],
    invDir: 1,
    invSpeed: 0.5,
    invMoveTimer: 0,
    invMoveInterval: 60,
    invDropPending: false,
    invBullets: [],
    invShootTimer: 0,
    invShootInterval: 80,

    // UFO
    ufo: null,
    ufoTimer: 0,
    ufoInterval: 600,

    // Shields
    shields: [],

    // March
    marchTimer: 0,
    marchInterval: 60,

    // Input
    keys: {},

    // Explosions
    explosions: [],

    running: true,
  };

  // Build invaders
  for (let row = 0; row < INV_ROWS; row++) {
    for (let col = 0; col < INV_COLS; col++) {
      const type = row === 0 ? 'A' : row < 3 ? 'B' : 'C';
      const points = row === 0 ? 30 : row < 3 ? 20 : 10;
      state.invaders.push({
        col, row, type, points,
        x: 80 + col * (INV_W + INV_XGAP),
        y: 80 + row * (INV_H + INV_YGAP),
        alive: true,
        frame: 0,
      });
    }
  }

  // Build shields
  const shieldPixels = buildShieldPixels();
  const positions = [130, 270, 410, 550, 690];
  for (const sx of positions) {
    state.shields.push({
      x: sx - SHIELD_W / 2,
      y: H - 130,
      pixels: shieldPixels.map(([c, r]) => [c, r, true]),
    });
  }
}

// --- Drawing helpers ---
function drawInvader(inv, frame) {
  const shape = INVADER_SHAPES[inv.type];
  const color = INV_COLORS[inv.row];
  ctx.fillStyle = color;
  // Alternate animation frame: shift legs
  const cols = shape[0].length;
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < cols; c++) {
      let pixel;
      if (frame === 1 && r === shape.length - 1) {
        pixel = shape[r][(c + 2) % cols];
      } else {
        pixel = shape[r][c];
      }
      if (pixel) {
        ctx.fillRect(inv.x + c * CELL, inv.y + r * CELL, CELL, CELL);
      }
    }
  }
}

function drawPlayer() {
  if (state.playerFlash > 0 && Math.floor(state.playerFlash / 4) % 2 === 0) return;
  const p = state.player;
  ctx.fillStyle = '#33ff33';
  // Body
  ctx.fillRect(p.x - p.w / 2, p.y, p.w, p.h * 0.6);
  // Cannon
  ctx.fillRect(p.x - 3, p.y - p.h * 0.5, 6, p.h * 0.55);
  // Base wings
  ctx.fillRect(p.x - p.w / 2 - 4, p.y + p.h * 0.4, p.w + 8, p.h * 0.3);
}

function drawBullet(b, color) {
  ctx.fillStyle = color;
  ctx.fillRect(b.x - 2, b.y - 8, 4, 12);
}

function drawUFO(ufo) {
  ctx.fillStyle = '#ff4444';
  // Dome
  ctx.beginPath();
  ctx.ellipse(ufo.x, ufo.y + 4, 22, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff8888';
  ctx.beginPath();
  ctx.ellipse(ufo.x, ufo.y, 14, 7, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffcccc';
  // Windows
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.arc(ufo.x + i * 7, ufo.y - 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawShields() {
  ctx.fillStyle = '#33ff33';
  for (const sh of state.shields) {
    for (const [cx, cy, alive] of sh.pixels) {
      if (alive) ctx.fillRect(sh.x + cx, sh.y + cy, 1, 1);
    }
  }
}

function drawExplosions() {
  for (const ex of state.explosions) {
    ctx.globalAlpha = ex.life / ex.maxLife;
    ctx.fillStyle = ex.color || '#ffffff';
    for (let i = 0; i < ex.parts.length; i++) {
      const [px, py] = ex.parts[i];
      ctx.fillRect(ex.x + px, ex.y + py, 3, 3);
    }
    ctx.globalAlpha = 1;
  }
}

function drawHUD() {
  ctx.fillStyle = '#33ff33';
  ctx.font = 'bold 18px "Courier New"';
  ctx.fillText(`SCORE: ${state.score}`, 20, 30);
  ctx.fillText(`HI: ${state.hiScore}`, W / 2 - 50, 30);
  ctx.fillText(`LIVES: ${'♥ '.repeat(state.lives)}`, W - 180, 30);

  // Ground line
  ctx.strokeStyle = '#33ff33';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, H - 40);
  ctx.lineTo(W, H - 40);
  ctx.stroke();
}

function spawnExplosion(x, y, color) {
  const parts = [];
  for (let i = 0; i < 12; i++) {
    parts.push([
      (Math.random() - 0.5) * 30,
      (Math.random() - 0.5) * 30,
    ]);
  }
  state.explosions.push({ x, y, color, parts, life: 30, maxLife: 30 });
}

// --- Collision helpers ---
function bulletHitsShield(bx, by) {
  for (const sh of state.shields) {
    const lx = bx - sh.x;
    const ly = by - sh.y;
    if (lx < 0 || lx >= SHIELD_W || ly < 0 || ly >= SHIELD_H) continue;
    for (const px of sh.pixels) {
      if (px[2] && Math.abs(px[0] - lx) <= 2 && Math.abs(px[1] - ly) <= 4) {
        // Destroy nearby pixels
        for (const p2 of sh.pixels) {
          if (p2[2] && Math.abs(p2[0] - lx) <= 4 && Math.abs(p2[1] - ly) <= 4) {
            p2[2] = false;
          }
        }
        return true;
      }
    }
  }
  return false;
}

function invaderRect(inv) {
  return { x: inv.x, y: inv.y, w: INV_W, h: INV_H };
}

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// --- Update ---
function update() {
  if (!state.running) return;

  // Player movement
  const p = state.player;
  if (state.keys['ArrowLeft'] || state.keys['a']) p.x = Math.max(p.w / 2 + 4, p.x - p.speed);
  if (state.keys['ArrowRight'] || state.keys['d']) p.x = Math.min(W - p.w / 2 - 4, p.x + p.speed);

  // Player shoot
  if ((state.keys[' '] || state.keys['ArrowUp']) && !state.playerBullet && state.playerFlash === 0) {
    state.playerBullet = { x: p.x, y: p.y - p.h };
    state.keys[' '] = false;
    state.keys['ArrowUp'] = false;
    shootSound();
  }

  // Player bullet
  if (state.playerBullet) {
    state.playerBullet.y -= 9;

    // Hit shield
    if (bulletHitsShield(state.playerBullet.x, state.playerBullet.y)) {
      state.playerBullet = null;
    }

    // Hit invader
    if (state.playerBullet) {
      for (const inv of state.invaders) {
        if (!inv.alive) continue;
        const r = invaderRect(inv);
        if (rectsOverlap(
          state.playerBullet.x - 2, state.playerBullet.y - 8, 4, 12,
          r.x, r.y, r.w, r.h
        )) {
          inv.alive = false;
          state.score += inv.points;
          if (state.score > state.hiScore) state.hiScore = state.score;
          spawnExplosion(inv.x + INV_W / 2, inv.y + INV_H / 2, INV_COLORS[inv.row]);
          explosionSound();
          state.playerBullet = null;

          // Speed up remaining invaders
          const alive = state.invaders.filter(i => i.alive).length;
          state.invMoveInterval = Math.max(5, 10 + alive * 4);
          break;
        }
      }
    }

    // Hit UFO
    if (state.playerBullet && state.ufo) {
      if (rectsOverlap(
        state.playerBullet.x - 2, state.playerBullet.y - 8, 4, 12,
        state.ufo.x - 22, state.ufo.y - 10, 44, 20
      )) {
        const bonus = [50, 100, 150, 200, 300][Math.floor(Math.random() * 5)];
        state.score += bonus;
        if (state.score > state.hiScore) state.hiScore = state.score;
        spawnExplosion(state.ufo.x, state.ufo.y, '#ff4444');
        explosionSound();
        state.ufo = null;
        state.playerBullet = null;
      }
    }

    if (state.playerBullet && state.playerBullet.y < 0) state.playerBullet = null;
  }

  // Invader movement (march)
  state.invMoveTimer++;
  if (state.invMoveTimer >= state.invMoveInterval) {
    state.invMoveTimer = 0;
    marchSound();

    const alive = state.invaders.filter(i => i.alive);
    if (alive.length === 0) { winGame(); return; }

    // Toggle animation frame
    for (const inv of alive) inv.frame ^= 1;

    if (state.invDropPending) {
      for (const inv of alive) inv.y += 20;
      state.invDir *= -1;
      state.invDropPending = false;
    } else {
      let hitWall = false;
      for (const inv of alive) {
        inv.x += state.invDir * (3 + (55 - alive.length) * 0.05);
        if (inv.x < 10 || inv.x + INV_W > W - 10) hitWall = true;
      }
      if (hitWall) state.invDropPending = true;
    }

    // Check if invaders reached player line
    for (const inv of alive) {
      if (inv.y + INV_H >= H - 50) { loseGame(); return; }
    }
  }

  // Invader shooting
  state.invShootTimer++;
  if (state.invShootTimer >= state.invShootInterval) {
    state.invShootTimer = 0;
    const alive = state.invaders.filter(i => i.alive);
    if (alive.length > 0 && state.invBullets.length < 3) {
      // Pick bottom-most invader in random column
      const cols = [...new Set(alive.map(i => i.col))];
      const col = cols[Math.floor(Math.random() * cols.length)];
      const colInvs = alive.filter(i => i.col === col);
      const shooter = colInvs.reduce((a, b) => a.row > b.row ? a : b);
      state.invBullets.push({
        x: shooter.x + INV_W / 2,
        y: shooter.y + INV_H,
      });
      invaderShootSound();
    }
    state.invShootInterval = Math.max(20, 80 - (55 - alive.length) * 1.5);
  }

  // Invader bullets
  for (let i = state.invBullets.length - 1; i >= 0; i--) {
    const b = state.invBullets[i];
    b.y += 5;

    if (bulletHitsShield(b.x, b.y)) {
      state.invBullets.splice(i, 1);
      continue;
    }

    // Hit player
    if (state.playerFlash === 0 && rectsOverlap(
      b.x - 2, b.y - 8, 4, 12,
      p.x - p.w / 2 - 4, p.y - p.h * 0.5, p.w + 8, p.h * 1.5
    )) {
      state.invBullets.splice(i, 1);
      state.lives--;
      state.playerFlash = 120;
      spawnExplosion(p.x, p.y, '#33ff33');
      explosionSound();
      if (state.lives <= 0) { loseGame(); return; }
      continue;
    }

    if (b.y > H) state.invBullets.splice(i, 1);
  }

  // UFO
  state.ufoTimer++;
  if (!state.ufo && state.ufoTimer >= state.ufoInterval) {
    state.ufoTimer = 0;
    state.ufoInterval = 400 + Math.floor(Math.random() * 400);
    state.ufo = { x: -30, y: 50, dir: 1 };
  }
  if (state.ufo) {
    state.ufo.x += state.ufo.dir * 2.5;
    if (Math.random() < 0.3) ufoSound();
    if (state.ufo.x > W + 30) state.ufo = null;
  }

  // Player flash cooldown
  if (state.playerFlash > 0) state.playerFlash--;

  // Explosions
  for (let i = state.explosions.length - 1; i >= 0; i--) {
    state.explosions[i].life--;
    if (state.explosions[i].life <= 0) state.explosions.splice(i, 1);
  }
}

// --- Draw ---
function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  drawHUD();
  drawShields();

  for (const inv of state.invaders) {
    if (inv.alive) drawInvader(inv, inv.frame);
  }

  if (state.ufo) drawUFO(state.ufo);
  if (state.playerBullet) drawBullet(state.playerBullet, '#fff');
  for (const b of state.invBullets) drawBullet(b, '#ff4444');

  drawPlayer();
  drawExplosions();
}

// --- Game over / Win ---
function showOverlay(title, msg) {
  state.running = false;
  overlayTitle.textContent = title;
  overlayScore.textContent = msg;
  overlay.classList.remove('hidden');
}

function loseGame() {
  showOverlay('GAME OVER', `SCORE: ${state.score}  HI: ${state.hiScore}`);
  if (typeof window.saveScore === 'function') window.saveScore(state.score, state.level);
}

function winGame() {
  showOverlay('YOU WIN!', `SCORE: ${state.score}  HI: ${state.hiScore}`);
  if (typeof window.saveScore === 'function') window.saveScore(state.score, state.level);
}

// --- Input ---
document.addEventListener('keydown', e => {
  state.keys[e.key] = true;
  if (e.key === ' ') e.preventDefault();
  if (audioCtx.state === 'suspended') audioCtx.resume();
});
document.addEventListener('keyup', e => { state.keys[e.key] = false; });

overlayBtn.addEventListener('click', () => {
  overlay.classList.add('hidden');
  initGame();
});

// --- Loop ---
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

initGame();
loop();
