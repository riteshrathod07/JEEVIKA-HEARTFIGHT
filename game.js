"use strict";

/* JEEVIKAA : HEART FIGHT */

const $ = id => document.getElementById(id);
const canvas = $("game");
const ctx = canvas.getContext("2d");

const messages = [
  "Jeevika, I WILL ALWAYS LOVEE YOU💗",
  "woww babyyy!!✨",
  "ky mast kr rhiii hai meri sweetu bhaiii 🌷",
  "Princessss you did it💖",
  " you deserve world babygirll🏆",
  "you are my superstar babyyyy 🌙",
  "smile time ❤️"
];

let W = 0, H = 0, last = 0, time = 0;
let state = "menu", mode = "waves";
let player = null, boss = null;
let enemies = [], bullets = [], enemyBullets = [], particles = [];
let score = 0, wave = 0, kills = 0, health = 100;
let remaining = 0, spawnTimer = 0, nextWaveTimer = 0;
let fireTimer = 0, toastTimer = 0, messageIndex = -1;
let pointer = { x: 0, y: 0, down: false };
let keys = Object.create(null);
let touchMove = { x: 0, y: 0 };
let touches = new Map();
let audio = null;

let records = { score: 0, wave: 0 };

try {
  const data = JSON.parse(localStorage.getItem("jhf-save") || "{}");
  records.score = Number(data.score) || 0;
  records.wave = Number(data.wave) || 0;
} catch (error) {}

function saveRecords() {
  records.score = Math.max(records.score, score);
  records.wave = Math.max(records.wave, wave);
  try {
    localStorage.setItem("jhf-save", JSON.stringify(records));
  } catch (error) {}
  updateRecords();
}

function updateRecords() {
  $("best").textContent = records.score;
  $("bestWave").textContent = records.wave;
}

function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (player) {
    player.x = Math.max(15, Math.min(W - 15, player.x));
    player.y = Math.max(15, Math.min(H - 15, player.y));
  }
}

window.addEventListener("resize", resize);
resize();

function showPanel(id) {
  ["menu", "pausePanel", "over", "letter"].forEach(name => {
    $(name).classList.toggle("hidden", name !== id);
  });
  $("screen").style.display = "grid";
}

function hidePanels() {
  $("screen").style.display = "none";
}

function notify(text) {
  $("toast").textContent = text;
  toastTimer = 2.4;
}

function playTone(frequency, duration, type = "sine", volume = 0.035) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audio) audio = new AudioContextClass();
    if (audio.state === "suspended") audio.resume();

    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001, audio.currentTime + duration
    );
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + duration);
  } catch (error) {}
}

function startGame(endless = false) {
  mode = endless ? "endless" : "waves";
  score = 0;
  wave = 0;
  kills = 0;
  health = 100;
  time = 0;
  boss = null;

  enemies = [];
  bullets = [];
  enemyBullets = [];
  particles = [];
  touches.clear();
  keys = Object.create(null);
  touchMove = { x: 0, y: 0 };
  pointer.down = false;
  fireTimer = 0;
  nextWaveTimer = 0;
  spawnTimer = 0;
  messageIndex = -1;

  player = {
    x: W / 2, y: H / 2, angle: 0,
    radius: 12, invincible: 1.5,
    rapid: 0, shield: 0
  };

  state = "playing";
  $("hud").classList.remove("hidden");
  hidePanels();
  beginWave();
  playTone(440, 0.18, "triangle");
}

function beginWave() {
  wave++;
  boss = null;
  remaining = wave % 5 === 0 ? 0 : Math.min(5 + wave * 2, 35);
  spawnTimer = 0.5;
  nextWaveTimer = 0;

  if (wave % 5 === 0) {
    const maxHealth = 150 + wave * 35;
    boss = {
      x: W / 2, y: -45, radius: 29,
      health: maxHealth, maxHealth, fireTimer: 1, phase: 0
    };
    notify("WARNING: BOSS INCOMING");
  } else {
    notify("WAVE " + wave + " — GET READY!");
  }

  $("wave").textContent = "WAVE " + wave;
}

function createEnemy() {
  const edge = Math.floor(Math.random() * 4);
  let x, y;

  if (edge === 0) { x = Math.random() * W; y = -20; }
  if (edge === 1) { x = W + 20; y = Math.random() * H; }
  if (edge === 2) { x = Math.random() * W; y = H + 20; }
  if (edge === 3) { x = -20; y = Math.random() * H; }

  const roll = Math.random();
  let type = "chaser";

  if (wave >= 3 && roll > 0.68) type = "shooter";
  if (wave >= 4 && roll > 0.88) type = "tank";

  enemies.push({
    x, y,
    type,
    radius: type === "tank" ? 17 : type === "shooter" ? 13 : 10,
    health: type === "tank" ? 4 : type === "shooter" ? 2 : 1,
    speed: type === "tank" ? 43 : type === "shooter" ? 58 : 78 + Math.random() * 30,
    fireTimer: 1 + Math.random(),
    phase: Math.random() * 6
  });
}

function burst(x, y, color, amount = 10) {
  for (let i = 0; i < amount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 35 + Math.random() * 160;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.3 + Math.random() * 0.5,
      color
    });
  }
}

function shoot() {
  if (!player || fireTimer > 0) return;

  fireTimer = player.rapid > 0 ? 0.095 : 0.19;
  const a = player.angle;

  bullets.push({
    x: player.x + Math.cos(a) * 16,
    y: player.y + Math.sin(a) * 16,
    vx: Math.cos(a) * 620,
    vy: Math.sin(a) * 620,
    life: 1.2
  });

  playTone(480, 0.045, "square", 0.012);
}

function enemyShoot(enemy, count = 1) {
  const base = Math.atan2(player.y - enemy.y, player.x - enemy.x);

  for (let i = 0; i < count; i++) {
    const angle = base + (i - (count - 1) / 2) * 0.24;
    enemyBullets.push({
      x: enemy.x, y: enemy.y,
      vx: Math.cos(angle) * 170,
      vy: Math.sin(angle) * 170,
      life: 4
    });
  }
}

function damagePlayer() {
  if (!player || player.invincible > 0) return;

  if (player.shield > 0) {
    player.shield = 0;
    player.invincible = 0.7;
    burst(player.x, player.y, "#42f5ff", 16);
    return;
  }

  health -= 10;
  player.invincible = 0.8;
  burst(player.x, player.y, "#ff38b8", 12);
  playTone(130, 0.12, "sawtooth", 0.025);

  if (health <= 0) endGame();
}

function checkMessages() {
  const index = Math.min(messages.length - 1, Math.floor(score / 400));

  if (index > messageIndex) {
    messageIndex = index;
    if (index > 0) notify(messages[index]);
  }
}

function update(dt) {
  if (state !== "playing" || !player) return;

  time += dt;
  fireTimer -= dt;
  player.invincible = Math.max(0, player.invincible - dt);
  player.rapid = Math.max(0, player.rapid - dt);
  player.shield = Math.max(0, player.shield - dt);

  let dx = 0, dy = 0;

  if (keys.KeyA || keys.ArrowLeft) dx--;
  if (keys.KeyD || keys.ArrowRight) dx++;
  if (keys.KeyW || keys.ArrowUp) dy--;
  if (keys.KeyS || keys.ArrowDown) dy++;

  dx += touchMove.x;
  dy += touchMove.y;

  const length = Math.hypot(dx, dy);
  if (length > 1) { dx /= length; dy /= length; }

  player.x = Math.max(12, Math.min(W - 12, player.x + dx * 235 * dt));
  player.y = Math.max(12, Math.min(H - 12, player.y + dy * 235 * dt));

  player.angle = Math.atan2(pointer.y - player.y, pointer.x - player.x);
  if (pointer.down) shoot();

  if (nextWaveTimer > 0) {
    nextWaveTimer -= dt;
    if (nextWaveTimer <= 0) beginWave();
  } else if (!boss && remaining > 0) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      createEnemy();
      remaining--;
      spawnTimer = Math.max(0.23, 0.72 - wave * 0.012);
    }
  }

  for (const enemy of enemies) {
    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);

    if (enemy.type === "shooter") {
      if (distance > 230) {
        enemy.x += Math.cos(angle) * enemy.speed * dt;
        enemy.y += Math.sin(angle) * enemy.speed * dt;
      } else if (distance < 145) {
        enemy.x -= Math.cos(angle) * enemy.speed * dt;
        enemy.y -= Math.sin(angle) * enemy.speed * dt;
      }

      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0) {
        enemyShoot(enemy);
        enemy.fireTimer = 1.6;
      }
    } else {
      enemy.x += Math.cos(angle) * enemy.speed * dt;
      enemy.y += Math.sin(angle) * enemy.speed * dt;
    }
  }

  for (const bullet of bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    if (bullet.life <= 0) continue;

    if (boss && Math.hypot(bullet.x - boss.x, bullet.y - boss.y) < boss.radius + 4) {
      bullet.life = 0;
      boss.health -= 1;
      continue;
    }

    for (const enemy of enemies) {
      if (enemy.health <= 0) continue;

      if (Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) < enemy.radius + 4) {
        bullet.life = 0;
        enemy.health--;

        if (enemy.health <= 0) {
          score += enemy.type === "tank" ? 250 : 100;
          kills++;
          burst(enemy.x, enemy.y, "#ff38b8", 12);
          playTone(220, 0.07, "triangle", 0.02);

          if (Math.random() < 0.16) {
            particles.push({
              x: enemy.x, y: enemy.y, vx: 0, vy: 0,
              life: 8, color: "#42f5ff", power: true,
              type: Math.random() < 0.5 ? "heal" : "rapid"
            });
          }

          checkMessages();
        }
        break;
      }
    }
  }

  if (boss) {
    boss.phase += dt;
    boss.x = W / 2 + Math.sin(boss.phase * 0.8) * Math.min(W * 0.28, 180);
    boss.y = Math.min(100, boss.y + 40 * dt);
    boss.fireTimer -= dt;

    if (boss.fireTimer <= 0) {
      enemyShoot(boss, 5);
      boss.fireTimer = 1.15;
    }

    if (boss.health <= 0) {
      score += 1000 + wave * 100;
      burst(boss.x, boss.y, "#ff38b8", 35);
      boss = null;
      notify("waah rey meri strong independent girl huh💗");
      checkMessages();
    }
  }

  for (const bullet of enemyBullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    if (Math.hypot(bullet.x - player.x, bullet.y - player.y) < player.radius + 5) {
      bullet.life = 0;
      damagePlayer();
      if (state !== "playing") return;
    }
  }

  for (const enemy of enemies) {
    if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < enemy.radius + player.radius) {
      enemy.health = 0;
      damagePlayer();
      if (state !== "playing") return;
    }
  }

  if (boss && Math.hypot(boss.x - player.x, boss.y - player.y) < boss.radius + player.radius) {
    damagePlayer();
    if (state !== "playing") return;
  }

  for (const p of particles) {
    p.life -= dt;

    if (p.power) {
      if (Math.hypot(p.x - player.x, p.y - player.y) < 23) {
        if (p.type === "heal") {
          health = Math.min(100, health + 25);
          notify("RITYA'S LOVE FOR JEEVIKA REPAIRED 💗");
        } else {
          player.rapid = 7;
          notify("RAPID FIRE ACTIVATED!");
        }
        p.life = 0;
      }
    } else {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.97;
      p.vy *= 0.97;
    }
  }

  bullets = bullets.filter(b => b.life > 0 && b.x > -30 && b.x < W + 30 && b.y > -30 && b.y < H + 30);
  enemyBullets = enemyBullets.filter(b => b.life > 0);
  enemies = enemies.filter(e => e.health > 0);
  particles = particles.filter(p => p.life > 0);

  if (remaining === 0 && enemies.length === 0 && !boss && nextWaveTimer <= 0) {
    nextWaveTimer = 2.5;
    notify("SECTOR CLEAR! ✨");
  }

  $("score").textContent = "SCORE " + score.toLocaleString();
  $("hp").style.width = Math.max(0, health) + "%";
  $("hpText").textContent = Math.max(0, health);
}

function endGame() {
  state = "over";
  pointer.down = false;
  touches.clear();
  touchMove = { x: 0, y: 0 };

  saveRecords();
  $("hud").classList.add("hidden");
  $("result").textContent = `Score: ${score} · Wave: ${wave} · Kills: ${kills}`;

  const index = Math.min(messages.length - 1, Math.floor(score / 400));
  $("endMessage").textContent = messages[index];

  showPanel("over");
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  const gradient = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.75);
  gradient.addColorStop(0, "#1b0b2c");
  gradient.addColorStop(1, "#080611");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "#a45cff14";
  ctx.lineWidth = 1;

  for (let x = 0; x < W; x += 45) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 45) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  function glow(color, blur = 12) {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  }

  function noGlow() { ctx.shadowBlur = 0; }

  for (const p of particles) {
    if (p.power) {
      ctx.save();
      ctx.strokeStyle = p.type === "heal" ? "#42f5ff" : "#ff38b8";
      glow(ctx.strokeStyle, 14);
      ctx.strokeRect(p.x - 7, p.y - 7, 14, 14);
      noGlow();
      ctx.restore();
    } else {
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillStyle = p.color;
      glow(p.color, 7);
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      noGlow();
      ctx.globalAlpha = 1;
    }
  }

  for (const b of bullets) {
    ctx.strokeStyle = "#ff38b8";
    ctx.lineWidth = 3;
    glow("#ff38b8");
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.025, b.y - b.vy * 0.025);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    noGlow();
  }

  for (const b of enemyBullets) {
    ctx.fillStyle = "#ff795d";
    glow("#ff795d");
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fill();
    noGlow();
  }

  for (const e of enemies) {
    const color = e.type === "tank" ? "#ff9b55" : e.type === "shooter" ? "#a45cff" : "#ff38b8";

    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.strokeStyle = color;
    ctx.fillStyle = "#170c25";
    ctx.lineWidth = 2;
    glow(color);

    ctx.beginPath();
    if (e.type === "tank") {
      ctx.rect(-e.radius, -e.radius, e.radius * 2, e.radius * 2);
    } else {
      ctx.moveTo(e.radius, 0);
      ctx.lineTo(0, -e.radius);
      ctx.lineTo(-e.radius, 0);
      ctx.lineTo(0, e.radius);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
    noGlow();
    ctx.restore();
  }

  if (boss) {
    ctx.save();
    ctx.translate(boss.x, boss.y);
    ctx.rotate(time * 0.3);
    ctx.strokeStyle = "#ff38b8";
    ctx.fillStyle = "#220b2b";
    ctx.lineWidth = 3;
    glow("#ff38b8", 22);

    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;
      const radius = i % 2 ? 25 : 36;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    noGlow();
    ctx.restore();

    ctx.fillStyle = "#ffffff30";
    ctx.fillRect(W / 2 - 75, 78, 150, 5);
    ctx.fillStyle = "#ff38b8";
    ctx.fillRect(W / 2 - 75, 78, 150 * Math.max(0, boss.health / boss.maxHealth), 5);
  }

  if (player) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);

    if (player.invincible > 0 && Math.floor(time * 18) % 2 === 0) {
      ctx.globalAlpha = 0.45;
    }

    if (player.shield > 0) {
      ctx.strokeStyle = "#42f5ff";
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      glow("#42f5ff", 15);
      ctx.stroke();
      noGlow();
    }

    ctx.fillStyle = "#15172e";
    ctx.strokeStyle = "#42f5ff";
    ctx.lineWidth = 2;
    glow("#42f5ff", 15);
    ctx.beginPath();
    ctx.moveTo(17, 0);
    ctx.lineTo(-10, -10);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-10, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    noGlow();
    ctx.restore();
  }
}

function frame(timestamp) {
  const dt = Math.min(Math.max((timestamp - last) / 1000, 0), 0.033);
  last = timestamp;

  if (state === "playing") update(dt);
  else if (state === "menu") time += dt * 0.3;

  if (toastTimer > 0) toastTimer -= dt;
  else $("toast").textContent = "";

  draw();
  requestAnimationFrame(frame);
}

/* BUTTONS */

$("start").addEventListener("click", () => startGame(false));
$("endless").addEventListener("click", () => startGame(true));

$("pause").addEventListener("click", () => {
  if (state !== "playing") return;
  state = "paused";
  pointer.down = false;
  touches.clear();
  touchMove = { x: 0, y: 0 };
  showPanel("pausePanel");
});

$("resume").addEventListener("click", () => {
  if (state !== "paused") return;
  state = "playing";
  hidePanels();
  last = performance.now();
});

function mainMenu() {
  state = "menu";
  player = null;
  boss = null;
  pointer.down = false;
  touches.clear();
  touchMove = { x: 0, y: 0 };
  keys = Object.create(null);
  $("hud").classList.add("hidden");
  updateRecords();
  showPanel("menu");
}

$("quit").addEventListener("click", mainMenu);
$("home").addEventListener("click", mainMenu);
$("retry").addEventListener("click", () => startGame(mode === "endless"));
$("love").addEventListener("click", () => showPanel("letter"));
$("back").addEventListener("click", () => showPanel("menu"));

/* KEYBOARD */

window.addEventListener("keydown", event => {
  keys[event.code] = true;

  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
    event.preventDefault();
  }

  if (event.code === "Escape" && state === "playing") {
    $("pause").click();
  }
});

window.addEventListener("keyup", event => {
  keys[event.code] = false;
});

/* MOUSE AND TOUCH */

canvas.addEventListener("pointerdown", event => {
  if (state !== "playing") return;

  if (event.pointerType === "mouse") {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.down = true;
    return;
  }

  const side = event.clientX < W * 0.48 ? "move" : "aim";
  touches.set(event.pointerId, {
    side,
    startX: event.clientX,
    startY: event.clientY
  });

  if (side === "aim") {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.down = true;
  }

  try {
    canvas.setPointerCapture(event.pointerId);
  } catch (error) {}
});

canvas.addEventListener("pointermove", event => {
  if (event.pointerType === "mouse") {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    return;
  }

  const touch = touches.get(event.pointerId);
  if (!touch) return;

  if (touch.side === "move") {
    touchMove.x = Math.max(-1, Math.min(1, (event.clientX - touch.startX) / 45));
    touchMove.y = Math.max(-1, Math.min(1, (event.clientY - touch.startY) / 45));
  } else {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.down = true;
  }
});

function releasePointer(event) {
  if (event.pointerType === "mouse") {
    pointer.down = false;
    return;
  }

  const touch = touches.get(event.pointerId);
  if (!touch) return;

  touches.delete(event.pointerId);

  if (touch.side === "move") {
    let moving = false;
    for (const t of touches.values()) {
      if (t.side === "move") moving = true;
    }
    if (!moving) touchMove = { x: 0, y: 0 };
  } else {
    let aiming = false;
    for (const t of touches.values()) {
      if (t.side === "aim") aiming = true;
    }
    pointer.down = aiming;
  }
}

canvas.addEventListener("pointerup", releasePointer);
canvas.addEventListener("pointercancel", releasePointer);

window.addEventListener("blur", () => {
  keys = Object.create(null);
  pointer.down = false;
  touches.clear();
  touchMove = { x: 0, y: 0 };

  if (state === "playing") $("pause").click();
});

updateRecords();
showPanel("menu");
requestAnimationFrame(frame);