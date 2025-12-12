// ==========================
// CORRIDA DE NATAL - GAME ENGINE (corrida + menu + inimigos atirando)
// game.js COMPLETO (ATUALIZADO)
// ==========================

// --------------------------
// CANVAS E CONTEXTO
// --------------------------
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// --------------------------
// MENU OVERLAY
// --------------------------
const menuOverlay = document.getElementById("menuOverlay");
const menuPlayBtn = document.getElementById("menuPlayBtn");

// --------------------------
// CARREGAMENTO DE IMAGENS (ASSETS)
// --------------------------
const sprites = {
  santa: new Image(),
  noela: new Image(),
  floco: new Image(),     // Obstáculo
  rena: new Image(),      // Inimigo
  presente: new Image(),  // Item Vida
  raio: new Image(),      // Item Velocidade
  bola: new Image()       // Projétil
};

// Seus caminhos atuais (se suas imagens estiverem na raiz, mantém assim)
sprites.santa.src = "image.png";
sprites.noela.src = "mae noel.jpg";
sprites.floco.src = "flocos.jpg";
sprites.rena.src = "rena.png";
sprites.presente.src = "presente.avif";
sprites.raio.src = "raio.avif";
sprites.bola.src = "bola.webp";

// Função auxiliar para desenhar sprite ou fallback
function drawSprite(img, x, y, w, h, fallbackColor) {
  if (img.complete && img.naturalHeight !== 0) ctx.drawImage(img, x, y, w, h);
  else {
    ctx.fillStyle = fallbackColor;
    ctx.fillRect(x, y, w, h);
  }
}

// --------------------------
// BOTÕES E STATUS
// --------------------------
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const statusBox = document.getElementById("status");
const fullscreenBtn = document.getElementById("fullscreenBtn");

const DIFF_RADIOS = document.getElementsByName("difficulty");
const MODE_RADIOS = document.getElementsByName("mode");

// HUD
const p1PosUI = document.getElementById("player1-pos");
const p1HealthUI = document.getElementById("player1-health");
const p2PosUI = document.getElementById("player2-pos");
const p2HealthUI = document.getElementById("player2-health");

const score1UI = document.getElementById("score1");
const score2UI = document.getElementById("score2");

// --------------------------
// ÁUDIO (opcional – se não existir, não quebra)
// --------------------------
const sfx = {
  hit: new Audio("sfx/hit.wav"),
  item: new Audio("sfx/item.wav"),
  boost: new Audio("sfx/boost.wav"),
  win: new Audio("sfx/win.wav")
};
for (let k in sfx) { sfx[k].volume = 0.5; sfx[k].onerror = () => {}; }

// --------------------------
// VARIÁVEIS GLOBAIS
// --------------------------
let gameRunning = false;
let paused = false;

let mode = "multiplayer";
let difficulty = "medium";

let player1, player2;
let obstacles = [];
let items = [];
let enemies = [];
let poolProjectiles = [];

let cameraX = 0;
let lastTime = 0;

let winsP1 = 0;
let winsP2 = 0;

// Corrida
const FINISH_DISTANCE = 4500; // distância até chegada (mundo)
let raceStartX = 0;

// --------------------------
// CONFIGURAÇÃO
// --------------------------
const difficultyConfig = {
  easy:   { obstacleRate: 0.012, enemyRate: 0.005, itemRate: 0.010, projDamage: 3, obstacleDamage: 2, enemyShootCd: 2.0, baseRun: 210, aiSkill: 0.6 },
  medium: { obstacleRate: 0.018, enemyRate: 0.008, itemRate: 0.007, projDamage: 5, obstacleDamage: 3, enemyShootCd: 1.5, baseRun: 240, aiSkill: 0.9 },
  hard:   { obstacleRate: 0.026, enemyRate: 0.012, itemRate: 0.005, projDamage: 8, obstacleDamage: 5, enemyShootCd: 1.1, baseRun: 270, aiSkill: 1.25 }
};

// --------------------------
// CRIAÇÃO DE OBJETOS
// --------------------------
function createPlayer(x, y, color) {
  return {
    x, y,
    width: 50, height: 70,
    // corrida automática
    runSpeed: 230,
    boostTime: 0,
    speedY: 260, // velocidade de desvio (cima/baixo)
    velocityY: 0,
    health: 100,
    color
  };
}

function createObstacle(x, y) {
  return { x, y, width: 44, height: 44, type: "snow", active: true };
}

function createItem(x, y, type) {
  return { x, y, width: 32, height: 32, type, active: true };
}

function createEnemy(x, y) {
  return { x, y, width: 52, height: 52, cooldown: 0, active: true };
}

function createProjectile(x, y) {
  return { x, y, vx: 0, vy: 0, width: 20, height: 20, active: true };
}

function getProjectile() {
  let p = poolProjectiles.find(o => !o.active);
  if (!p) { p = createProjectile(0, 0); poolProjectiles.push(p); }
  p.active = true;
  return p;
}

// --------------------------
// SPawns (sempre à frente da câmera)
// --------------------------
function spawnObstacle() {
  const y = Math.random() * (canvas.height - 70);
  const x = cameraX + canvas.width + 200 + Math.random() * 400;
  obstacles.push(createObstacle(x, y));
}

function spawnItem() {
  const y = Math.random() * (canvas.height - 70);
  const x = cameraX + canvas.width + 220 + Math.random() * 500;
  const type = Math.random() < 0.55 ? "health" : "speed";
  items.push(createItem(x, y, type));
}

function spawnEnemy() {
  const y = Math.random() * (canvas.height - 70);
  const x = cameraX + canvas.width + 260 + Math.random() * 700;
  enemies.push(createEnemy(x, y));
}

// --------------------------
// COLISÃO
// --------------------------
function collide(a, b) {
  const padding = 6;
  return (
    a.x + padding < b.x + b.width - padding &&
    a.x + a.width - padding > b.x + padding &&
    a.y + padding < b.y + b.height - padding &&
    a.y + a.height - padding > b.y + padding
  );
}

// --------------------------
// INPUT
// --------------------------
const keys = {};
document.addEventListener("keydown", e => {
  keys[e.key] = true;

  // Pause
  if (e.key === "Escape") togglePause();
});

document.addEventListener("keyup", e => keys[e.key] = false);

function handleInput() {
  // P1 (setas) -> só desvio vertical
  player1.velocityY = 0;
  if (keys["ArrowUp"]) player1.velocityY = -player1.speedY;
  if (keys["ArrowDown"]) player1.velocityY = player1.speedY;

  // boost manual (Shift)
  if (keys["Shift"]) player1.boostTime = Math.max(player1.boostTime, 0.25);

  // P2
  if (mode === "multiplayer") {
    player2.velocityY = 0;
    if (keys["w"] || keys["W"]) player2.velocityY = -player2.speedY;
    if (keys["s"] || keys["S"]) player2.velocityY = player2.speedY;
    if (keys["Shift"]) player2.boostTime = Math.max(player2.boostTime, 0.25);
  }
}

// --------------------------
// IA (solo)
// --------------------------
function updateAI(dt) {
  const cfg = difficultyConfig[difficulty];

  // corre sempre (boost aleatório)
  if (Math.random() < 0.015 * cfg.aiSkill) player2.boostTime = Math.max(player2.boostTime, 0.35);

  // tenta evitar o que vem pela frente na linha do y
  let danger = null;

  // obstáculo mais próximo à frente
  for (const o of obstacles) {
    if (!o.active) continue;
    const dx = o.x - player2.x;
    if (dx > 0 && dx < 240) { danger = o; break; }
  }
  // inimigo mais próximo
  for (const e of enemies) {
    if (!e.active) continue;
    const dx = e.x - player2.x;
    if (dx > 0 && dx < 260) { danger = e; break; }
  }

  // projéteis (vindo da direita pra esquerda)
  for (const p of poolProjectiles) {
    if (!p.active) continue;
    const dx = p.x - player2.x;
    if (dx > -40 && dx < 160 && p.vx < 0) { danger = p; break; }
  }

  // movimento
  player2.velocityY = 0;
  if (danger) {
    // sobe ou desce para sair da linha
    player2.velocityY = (Math.random() < 0.5 ? -1 : 1) * player2.speedY * 1.05 * cfg.aiSkill;
  } else if (Math.random() < 0.02) {
    // drift leve
    player2.velocityY = (Math.random() < 0.5 ? -1 : 1) * player2.speedY * 0.45;
  }
}

// --------------------------
// ATUALIZA PLAYER (corrida)
// --------------------------
function updatePlayer(p, dt) {
  // corrida automática
  const base = p.runSpeed;
  const boost = p.boostTime > 0 ? 160 : 0;

  p.x += (base + boost) * dt;

  // boost decay
  if (p.boostTime > 0) {
    p.boostTime -= dt;
    if (p.boostTime < 0) p.boostTime = 0;
  }

  // desvio
  p.y += p.velocityY * dt;

  // limites
  if (p.y < 0) p.y = 0;
  if (p.y + p.height > canvas.height) p.y = canvas.height - p.height;

  // clamp vida
  if (p.health > 120) p.health = 120;
  if (p.health < 0) p.health = 0;
}

function updateHUD() {
  // posição em "metros" desde o início
  const p1m = Math.max(0, Math.floor(player1.x - raceStartX));
  const p2m = Math.max(0, Math.floor(player2.x - raceStartX));
  p1PosUI.textContent = p1m;
  p2PosUI.textContent = p2m;
  p1HealthUI.textContent = Math.floor(player1.health);
  p2HealthUI.textContent = Math.floor(player2.health);

  // status porcentagem
  const p1pct = Math.min(100, Math.floor((p1m / FINISH_DISTANCE) * 100));
  const p2pct = Math.min(100, Math.floor((p2m / FINISH_DISTANCE) * 100));
  statusBox.textContent = paused
    ? "PAUSADO (ESC para voltar)"
    : `Chegada: P1 ${p1pct}% | P2 ${p2pct}%`;
}

// --------------------------
// INIMIGOS + PROJÉTEIS
// --------------------------
function updateEnemiesAndProjectiles(dt) {
  const cfg = difficultyConfig[difficulty];

  // inimigos ficam "no mundo" (não andam), mas atiram
  for (let e of enemies) {
    if (!e.active) continue;

    e.cooldown -= dt;
    if (e.cooldown <= 0) {
      e.cooldown = cfg.enemyShootCd;

      const p = getProjectile();
      p.x = e.x;
      p.y = e.y + 10;
      p.vx = -340; // tiro indo para esquerda
      p.vy = (Math.random() - 0.5) * 120;
    }
  }

  // projéteis
  for (let p of poolProjectiles) {
    if (!p.active) continue;

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // saiu do mundo visível
    if (p.x < cameraX - 300 || p.x > cameraX + canvas.width + 500) p.active = false;

    // colisão
    if (p.active && collide(p, player1)) {
      player1.health -= cfg.projDamage;
      p.active = false;
      try { sfx.hit.play(); } catch {}
    }
    if (p.active && collide(p, player2)) {
      player2.health -= cfg.projDamage;
      p.active = false;
      try { sfx.hit.play(); } catch {}
    }
  }
}

// --------------------------
// OBSTÁCULOS + ITENS
// --------------------------
function updateObstaclesItems(dt) {
  const cfg = difficultyConfig[difficulty];

  // colisão obstáculos
  for (let o of obstacles) {
    if (!o.active) continue;

    if (collide(o, player1)) {
      player1.health -= cfg.obstacleDamage;
      o.active = false;
      try { sfx.hit.play(); } catch {}
    }
    if (collide(o, player2)) {
      player2.health -= cfg.obstacleDamage;
      o.active = false;
      try { sfx.hit.play(); } catch {}
    }
  }

  // itens
  for (let it of items) {
    if (!it.active) continue;

    if (collide(it, player1)) {
      if (it.type === "health") player1.health += 15;
      if (it.type === "speed") player1.boostTime = Math.max(player1.boostTime, 1.2);
      it.active = false;
      try { sfx.item.play(); } catch {}
    }
    if (collide(it, player2)) {
      if (it.type === "health") player2.health += 15;
      if (it.type === "speed") player2.boostTime = Math.max(player2.boostTime, 1.2);
      it.active = false;
      try { sfx.item.play(); } catch {}
    }
  }

  // limpeza (depois que passaram muito)
  obstacles = obstacles.filter(o => o.active && o.x > cameraX - 400);
  items = items.filter(it => it.active && it.x > cameraX - 400);
  enemies = enemies.filter(e => e.active && e.x > cameraX - 600);
}

// --------------------------
// DESENHO
// --------------------------
function draw() {
  // fundo
  ctx.fillStyle = "#bde0ff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // chão
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, canvas.height - 40, canvas.width, 40);

  // linha de chegada (no mundo)
  const finishX = raceStartX + FINISH_DISTANCE;
  const fx = finishX - cameraX;
  if (fx > -40 && fx < canvas.width + 40) {
    ctx.fillStyle = "#c41e3a";
    ctx.fillRect(fx, 0, 10, canvas.height);
    ctx.fillStyle = "#ffeb3b";
    ctx.fillRect(fx + 10, 0, 10, canvas.height);
  }

  // obstáculos
  for (let o of obstacles) {
    drawSprite(sprites.floco, o.x - cameraX, o.y, o.width, o.height, "#87CEFA");
  }

  // itens
  for (let it of items) {
    if (it.type === "health") drawSprite(sprites.presente, it.x - cameraX, it.y, it.width, it.height, "#ff5c8d");
    else drawSprite(sprites.raio, it.x - cameraX, it.y, it.width, it.height, "#00d26a");
  }

  // inimigos
  for (let e of enemies) {
    drawSprite(sprites.rena, e.x - cameraX, e.y, e.width, e.height, "#8b0000");
  }

  // projéteis
  for (let p of poolProjectiles) {
    if (!p.active) continue;
    drawSprite(sprites.bola, p.x - cameraX, p.y, p.width, p.height, "#ff0000");
  }

  // jogadores
  drawSprite(sprites.santa, player1.x - cameraX, player1.y, player1.width, player1.height, player1.color);
  drawSprite(sprites.noela, player2.x - cameraX, player2.y, player2.width, player2.height, player2.color);
}

// --------------------------
// VITÓRIA / GAME OVER
// --------------------------
function checkEnd() {
  const finishX = raceStartX + FINISH_DISTANCE;

  // chegada
  if (player1.x >= finishX && player2.x >= finishX) {
    end("Empate!");
    return;
  }
  if (player1.x >= finishX) { end("Papai Noel"); winsP1++; score1UI.textContent = winsP1; return; }
  if (player2.x >= finishX) { end(mode === "solo" ? "IA" : "Mamãe Noel"); winsP2++; score2UI.textContent = winsP2; return; }

  // vida zerou
  if (player1.health <= 0) { end(mode === "solo" ? "IA" : "Mamãe Noel"); winsP2++; score2UI.textContent = winsP2; return; }
  if (player2.health <= 0) { end("Papai Noel"); winsP1++; score1UI.textContent = winsP1; return; }
}

function end(winner) {
  gameRunning = false;
  paused = false;

  if (winner === "Empate!") statusBox.textContent = "EMPATE! 😮";
  else statusBox.textContent = `${winner} venceu! 🏁`;

  try { sfx.win.play(); } catch {}

  // volta menu
  if (menuOverlay) menuOverlay.style.display = "grid";
}

// --------------------------
// GAME LOOP
// --------------------------
function update(timestamp) {
  if (!gameRunning) return;

  const dt = Math.min(0.033, (timestamp - lastTime) / 1000); // clamp
  lastTime = timestamp;

  if (paused) {
    // desenha uma vez congelado (pra não ficar “apagado”)
    draw();
    requestAnimationFrame(update);
    return;
  }

  // câmera acompanha o player1 (leader feel)
  cameraX = player1.x - canvas.width * 0.25;

  const cfg = difficultyConfig[difficulty];

  // spawns
  if (Math.random() < cfg.obstacleRate) spawnObstacle();
  if (Math.random() < cfg.itemRate) spawnItem();
  if (Math.random() < cfg.enemyRate) spawnEnemy();

  // input e AI
  handleInput();
  if (mode === "solo") updateAI(dt);

  // update players
  updatePlayer(player1, dt);
  updatePlayer(player2, dt);

  // update world entities
  updateEnemiesAndProjectiles(dt);
  updateObstaclesItems(dt);

  // draw + hud + check end
  draw();
  updateHUD();
  checkEnd();

  requestAnimationFrame(update);
}

// --------------------------
// START / RESET / FULLSCREEN / PAUSE
// --------------------------
function startGame() {
  if (gameRunning) return;

  // lê config do UI
  for (let r of DIFF_RADIOS) if (r.checked) difficulty = r.value;
  for (let r of MODE_RADIOS) if (r.checked) mode = r.value;

  // aplica dificuldade base speed
  const cfg = difficultyConfig[difficulty];

  obstacles = [];
  items = [];
  enemies = [];
  poolProjectiles.forEach(p => p.active = false);

  // players
  player1 = createPlayer(120, canvas.height / 2 - 60, "#ff0000");
  player2 = createPlayer(120, canvas.height / 2 + 20, "#00aaff");

  player1.runSpeed = cfg.baseRun;
  player2.runSpeed = cfg.baseRun * (mode === "solo" ? 0.98 : 1.0);

  raceStartX = player1.x;

  // fecha menu
  if (menuOverlay) menuOverlay.style.display = "none";

  paused = false;
  gameRunning = true;

  lastTime = performance.now();
  statusBox.textContent = "CORRIDA INICIADA! 🏁";
  requestAnimationFrame(update);
}

function resetGame() {
  gameRunning = false;
  paused = false;

  if (player1) player1.health = 100;
  if (player2) player2.health = 100;

  p1HealthUI.textContent = 100;
  p2HealthUI.textContent = 100;
  p1PosUI.textContent = 0;
  p2PosUI.textContent = 0;

  statusBox.textContent = "Jogo resetado. Abra o menu e inicie novamente.";

  if (menuOverlay) menuOverlay.style.display = "grid";
}

function togglePause() {
  if (!gameRunning) return;
  paused = !paused;
  statusBox.textContent = paused ? "PAUSADO (ESC para voltar)" : "Voltando...";
}

startBtn.addEventListener("click", startGame);
if (menuPlayBtn) menuPlayBtn.addEventListener("click", startGame);

resetBtn.addEventListener("click", resetGame);

fullscreenBtn.addEventListener("click", () => {
  if (canvas.requestFullscreen) canvas.requestFullscreen();
  else if (canvas.webkitRequestFullscreen) canvas.webkitRequestFullscreen();
});

// Ao carregar, mostra menu
if (menuOverlay) menuOverlay.style.display = "grid";
