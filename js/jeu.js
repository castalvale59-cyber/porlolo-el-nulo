/* =========================================================
   PorLolo el nulo — onglet Jouer : babyfoot contre un bot
   Vue de dessus, disposition Bonzini (1-2-5-3).
   Toi = rouge (tu attaques vers la droite), bot = bleu.
   Toutes tes barres suivent la souris / le doigt, clic = tir.
   ========================================================= */

const Babyfoot = (() => {
  /* ---------------- Constantes de la table ---------------- */
  const W = 960, H = 540;
  const F = { x0: 30, x1: 930, y0: 30, y1: 510 };   // aire de jeu
  const CY = 270;
  const GOAL = { y0: 195, y1: 345 };
  const R = 9;                                      // rayon de la balle
  const PHW = 8, PHH = 12;                          // demi-largeur / demi-hauteur d'un joueur
  const KICK_REACH = 26, KICK_TIME = 0.12, KICK_COOLDOWN = 0.28, LIFT_TIME = 0.35;
  const HUMAN_SPEED = 1600, HUMAN_POWER = 950, MAX_SPEED = 1200;

  // Ordre des barres de gauche à droite : g, d, A, m, M, a, D, G
  const LAYOUT = [["r", 1], ["r", 2], ["b", 3], ["r", 5], ["b", 5], ["r", 3], ["b", 2], ["b", 1]];
  const SPACING = { 1: [0], 2: [-120, 120], 3: [-160, 0, 160], 5: [-192, -96, 0, 96, 192] };
  const TRAVEL = { 1: 100, 2: 108, 3: 68, 5: 36 };

  const LEVELS = {
    1: { nom: "Lolo", desc: "Lent, distrait, tire au hasard. Parfait pour commencer.",
         speed: 330, delay: 0.28, err: 38, kickProb: 0.025, power: 600, predict: false, jitter: 30 },
    2: { nom: "Habitué du bar", desc: "Suit bien la balle, anticipe les tirs, frappe correctement.",
         speed: 440, delay: 0.22, err: 28, kickProb: 0.045, power: 700, predict: true, jitter: 0 },
    3: { nom: "Légende Bonzini", desc: "Réflexes de pro, vise le coin opposé à ton gardien. Bon courage.",
         speed: 520, delay: 0.16, err: 18, kickProb: 0.11, power: 800, predict: true, jitter: 0 }
  };

  const TXT = {
    butPour: ["BUUUT ! Même Lolo n'en revient pas.", "Quelle frappe ! Le bot demande un remboursement.",
      "But ! Et sans roulette, s'il vous plaît.", "Le gardien bleu cherche encore la balle.", "Propre. Très propre."],
    butContre: ["Aïe. Lolo approuve cette défense.", "But encaissé. Pense au mur : gardien + arrière sur la balle.",
      "Le bot te chambre en binaire.", "Relève la tête, Lolo vit ça tous les soirs.", "Astuce : place tes joueurs AVANT que le bot tire."],
    victoire: ["VICTOIRE ! Le bot rentre chez lui à pied.", "Gagné ! Tu peux officiellement chambrer Lolo."],
    defaite: ["Défaite… Lolo t'offre un mouchoir.", "Perdu. Retour à l'onglet Techniques ?"],
    fannyPour: "FANNY ! Le bot passe sous la table.",
    fannyContre: "FANNY… Passe sous la table. Lolo t'y attend."
  };

  /* ---------------- État ---------------- */
  let canvas, ctx, dpr = 1;
  let rods = [];
  const ball = { x: W / 2, y: CY, vx: 0, vy: 0 };
  let trail = [];
  let history = [];
  let state = "menu";          // menu | countdown | play | goal | over | paused
  let prevState = null;
  let stateT = 0;              // temps passé dans l'état courant
  let clock = 0;
  let score = { r: 0, b: 0 };
  let level = 2;
  let target = 5;
  let aimY = CY;
  let keys = { up: false, down: false };
  let deadT = 0;
  let botErr = 0, botErrT = 0;
  let serveTo = 0;             // -1 : balle vers le rouge, +1 : vers le bleu
  let banner = null;           // { big, small }
  let running = false, rafId = 0, last = 0;
  let audio = null;
  let mounted = false;

  /* ---------------- Utilitaires ---------------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const rodX = (i) => F.x0 + ((F.x1 - F.x0) * (i + 0.5)) / 8;
  const playerYs = (rod) => SPACING[rod.n].map((s) => CY + s + rod.off);

  function getSave() {
    if (typeof S === "undefined") return {};
    if (!S.jeu) S.jeu = {};
    return S.jeu;
  }
  function persist() { if (typeof save === "function") save(); }

  /* ---------------- Son (petits bips) ---------------- */
  function soundOn() { return !(typeof S !== "undefined" && S.son === false); }
  function beep(freq, dur, type = "square", vol = 0.05) {
    if (!soundOn()) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
      o.connect(g).connect(audio.destination);
      o.start(); o.stop(audio.currentTime + dur);
    } catch (e) { /* pas de son, pas grave */ }
  }
  const sndKick = () => beep(180 + Math.random() * 60, 0.06, "triangle", 0.08);
  const sndWall = () => beep(320, 0.03, "sine", 0.03);
  const sndGoal = (pour) => { beep(pour ? 660 : 220, 0.18); setTimeout(() => beep(pour ? 880 : 165, 0.25), 160); };

  /* ---------------- Mise en place ---------------- */
  function makeRods() {
    rods = LAYOUT.map(([team, n], i) => ({
      i, team, n, x: rodX(i), dir: team === "r" ? 1 : -1,
      off: 0, vy: 0, kickT: 99, cd: 0, liftT: 0, hit: false, aim: null, power: HUMAN_POWER
    }));
  }

  function resetBall(toward) {
    ball.x = W / 2;
    ball.y = CY + (Math.random() * 80 - 40);
    ball.vx = toward * (70 + Math.random() * 40);
    ball.vy = Math.random() * 60 - 30;
    trail = [];
    deadT = 0;
  }

  function setState(s) { state = s; stateT = 0; }

  function newGame() {
    score = { r: 0, b: 0 };
    makeRods();
    serveTo = Math.random() < 0.5 ? -1 : 1;
    resetBall(0);
    ball.vx = 0; ball.vy = 0;
    banner = null;
    setState("countdown");
    updateScore();
    comment(`C'est parti contre « ${LEVELS[level].nom} ». Premier à ${target} buts.`);
  }

  /* ---------------- Déplacement des barres ---------------- */
  // Choisit le joueur de la barre qui peut le mieux se placer sur la hauteur y.
  function targetOffset(rod, y) {
    const tr = TRAVEL[rod.n];
    let best = null;
    for (const s of SPACING[rod.n]) {
      const need = clamp(y - CY - s, -tr, tr);
      const miss = Math.abs(y - (CY + s + need));
      const cost = miss * 4 + Math.abs(need - rod.off) * 0.15;
      if (!best || cost < best.cost) best = { cost, need };
    }
    return best.need;
  }

  function moveRod(rod, targetOff, maxSpeed, dt) {
    const d = targetOff - rod.off;
    const step = maxSpeed * dt;
    const mv = Math.abs(d) <= step ? d : Math.sign(d) * step;
    rod.off += mv;
    rod.vy = rod.vy * 0.5 + (dt > 0 ? mv / dt : 0) * 0.5;
  }

  function kick(rod, power, aim) {
    if (rod.cd > 0 || rod.liftT > 0) return;
    rod.kickT = 0;
    rod.cd = KICK_COOLDOWN;
    rod.hit = false;
    rod.power = power;
    rod.aim = aim;
  }

  function humanKick() {
    if (state !== "play" && state !== "countdown") return;
    rods.forEach((r) => { if (r.team === "r") kick(r, HUMAN_POWER, null); });
  }

  // Quand une barre tire, les barres de la même équipe devant elle se relèvent.
  function liftFront(rod) {
    rods.forEach((r) => {
      if (r.team === rod.team && rod.dir * (r.x - rod.x) > 0) r.liftT = LIFT_TIME;
    });
  }

  /* ---------------- Bot ---------------- */
  function delayedBall(delay) {
    const t = clock - delay;
    for (let i = history.length - 1; i >= 0; i--) if (history[i].t <= t) return history[i];
    return history[0] || ball;
  }

  function predictY(b, x) {
    if (Math.abs(b.vx) < 30) return b.y;
    const t = (x - b.x) / b.vx;
    if (t < 0 || t > 1.5) return b.y;
    const lo = F.y0 + R, hi = F.y1 - R, span = hi - lo;
    let m = (b.y + b.vy * t - lo) % (2 * span);
    if (m < 0) m += 2 * span;
    return lo + (m <= span ? m : 2 * span - m);
  }

  function botThink(dt) {
    const L = LEVELS[level];
    const seen = delayedBall(L.delay);
    botErrT -= dt;
    if (botErrT <= 0) { botErr = (Math.random() * 2 - 1) * L.err; botErrT = 0.5; }

    rods.forEach((rod) => {
      if (rod.team !== "b") return;
      let ty = L.predict ? predictY(seen, rod.x) : seen.y;
      // Balle lente juste derrière la barre : on s'écarte pour la laisser passer devant.
      const behind = rod.dir * (seen.x - rod.x) < 0 && Math.abs(seen.x - rod.x) < 70 && Math.hypot(seen.vx, seen.vy) < 120;
      if (behind) ty = seen.y + (rod.n === 1 ? 45 : Math.abs(SPACING[rod.n][1] - SPACING[rod.n][0]) / 2);
      ty += botErr + (L.jitter ? Math.sin(clock * 7 + rod.i) * L.jitter : 0);
      moveRod(rod, targetOffset(rod, ty), L.speed, dt);

      if (state !== "play" || rod.cd > 0) return;
      const front = rod.x - ball.x;                 // le bleu frappe vers la gauche
      if (front < -4 || front > KICK_REACH + R - 2) return;
      const ys = playerYs(rod);
      const near = ys.reduce((a, y) => (Math.abs(y - ball.y) < Math.abs(a - ball.y) ? y : a), ys[0]);
      if (Math.abs(ball.y - near) > PHH + R - 2) return;
      if (Math.random() > L.kickProb) return;

      const dist = Math.max(60, ball.x - F.x0);
      const time = dist / L.power;
      let aim;
      if (level === 3 && Math.random() < 0.3) {
        const gy = CY + rods[0].off;                // gardien rouge
        const ty2 = gy > CY ? GOAL.y0 + 20 : GOAL.y1 - 20;
        aim = (ty2 + (Math.random() * 2 - 1) * 30 - ball.y) / time;
      } else if (level >= 2) {
        // Niveau 2 : vise plutôt le milieu du but ; niveau 3 : n'importe où dans le but.
        const spread = level === 3 ? (GOAL.y1 - GOAL.y0) / 2 : 40;
        const ty2 = CY + (Math.random() * 2 - 1) * spread;
        aim = (ty2 - ball.y) / time;
      } else {
        aim = (Math.random() - 0.5) * 0.9 * L.power;
      }
      kick(rod, L.power, aim);
    });
  }

  /* ---------------- Physique ---------------- */
  function collide(rod, py) {
    if (rod.liftT > 0) return;
    const kicking = rod.kickT < KICK_TIME;
    let x0 = rod.x - PHW, x1 = rod.x + PHW;
    if (kicking) { if (rod.dir > 0) x1 = rod.x + KICK_REACH; else x0 = rod.x - KICK_REACH; }
    const y0 = py - PHH, y1 = py + PHH;
    const cx = clamp(ball.x, x0, x1), cy = clamp(ball.y, y0, y1);
    const dx = ball.x - cx, dy = ball.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 > R * R) return;

    let nx, ny;
    if (d2 < 1e-6) {
      // Centre de la balle dans le joueur : on la sort par le côté le plus proche.
      const l = ball.x - x0, r = x1 - ball.x, t = ball.y - y0, b = y1 - ball.y;
      const m = Math.min(l, r, t, b);
      nx = m === l ? -1 : m === r ? 1 : 0;
      ny = m === t ? -1 : m === b ? 1 : 0;
      if (nx) ball.x = (nx < 0 ? x0 : x1) + nx * R;
      if (ny) ball.y = (ny < 0 ? y0 : y1) + ny * R;
    } else {
      const d = Math.sqrt(d2);
      nx = dx / d; ny = dy / d;
      ball.x += nx * (R - d);
      ball.y += ny * (R - d);
    }

    if (kicking && !rod.hit && rod.dir * (ball.x - rod.x) > -2) {
      const p = rod.power;
      ball.vx = rod.dir * p;
      const vy = rod.aim != null ? rod.aim : rod.vy * 0.45 + (ball.y - py) * 9;
      ball.vy = clamp(vy, -0.65 * p, 0.65 * p);
      rod.hit = true;
      liftFront(rod);
      sndKick();
    } else {
      const rvn = ball.vx * nx + (ball.vy - rod.vy) * ny;
      if (rvn < 0) {
        ball.vx -= 1.55 * rvn * nx;
        ball.vy -= 1.55 * rvn * ny;
        if (rvn < -200) sndKick();
      }
    }
  }

  function goal(team) {
    score[team]++;
    updateScore();
    const pour = team === "r";
    sndGoal(pour);
    banner = { big: pour ? "BUT !" : "BUT ADVERSE", small: `${score.r} - ${score.b}`, color: pour ? "#ffc21a" : "#ff6b6b" };
    comment(pick(pour ? TXT.butPour : TXT.butContre));
    serveTo = pour ? 1 : -1;            // l'équipe qui encaisse récupère la balle
    ball.vx = ball.vy = 0;
    ball.x = W / 2; ball.y = CY;
    setState("goal");
  }

  function physics(dt) {
    // Petit « dévers » : une balle presque arrêtée glisse vers la zone de frappe la plus proche
    // (devant une barre), quitte à passer sous une barre entre deux joueurs.
    const sp = Math.hypot(ball.vx, ball.vy);
    if (sp < 45) {
      let best = null;
      rods.forEach((r) => {
        const zx = r.x + r.dir * 20;
        if (!best || Math.abs(zx - ball.x) < Math.abs(best.zx - ball.x)) best = { zx, r };
      });
      ball.vx += Math.sign(best.zx - ball.x) * 120 * dt;
      // Collée dans le dos d'un joueur : elle glisse sur le côté pour passer entre deux joueurs.
      const r = best.r;
      if (r.dir * (ball.x - r.x) < 0 && Math.abs(ball.x - r.x) < PHW + R + 6) {
        const py = playerYs(r).reduce((p, y) => (Math.abs(y - ball.y) < Math.abs(p - ball.y) ? y : p));
        if (Math.abs(ball.y - py) < PHH + R + 4) ball.vy += (ball.y >= py ? 1 : -1) * 160 * dt;
      }
    }
    const fr = Math.exp(-0.38 * dt);
    ball.vx *= fr; ball.vy *= fr;
    if (sp > MAX_SPEED) { ball.vx *= MAX_SPEED / sp; ball.vy *= MAX_SPEED / sp; }

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Bandes haut / bas
    if (ball.y < F.y0 + R) { ball.y = F.y0 + R; ball.vy = Math.abs(ball.vy) * 0.8; sndWall(); }
    if (ball.y > F.y1 - R) { ball.y = F.y1 - R; ball.vy = -Math.abs(ball.vy) * 0.8; sndWall(); }

    // Bandes de fond et buts
    const inMouth = ball.y > GOAL.y0 + 2 && ball.y < GOAL.y1 - 2;
    if (ball.x < F.x0 + R) {
      if (inMouth) { if (ball.x < F.x0 - R) return goal("b"); }
      else { ball.x = F.x0 + R; ball.vx = Math.abs(ball.vx) * 0.8; sndWall(); }
    }
    if (ball.x > F.x1 - R) {
      if (inMouth) { if (ball.x > F.x1 + R) return goal("r"); }
      else { ball.x = F.x1 - R; ball.vx = -Math.abs(ball.vx) * 0.8; sndWall(); }
    }
    // Poteaux : la balle dans le but ne peut pas en ressortir par le côté
    if (ball.x < F.x0 || ball.x > F.x1) ball.y = clamp(ball.y, GOAL.y0 + R, GOAL.y1 - R);

    rods.forEach((rod) => playerYs(rod).forEach((py) => collide(rod, py)));

    // Un joueur ne peut pas pousser la balle dans la bande.
    if (ball.x > F.x0 && ball.x < F.x1) ball.y = clamp(ball.y, F.y0 + R, F.y1 - R);
    if (!(ball.y > GOAL.y0 + 2 && ball.y < GOAL.y1 - 2)) ball.x = clamp(ball.x, F.x0 + R, F.x1 - R);
  }

  /* ---------------- Boucle ---------------- */
  function update(dt) {
    clock += dt;
    stateT += dt;

    if (state === "paused" || state === "menu" || state === "over") return;

    // Joueur humain
    if (keys.up) aimY -= 700 * dt;
    if (keys.down) aimY += 700 * dt;
    aimY = clamp(aimY, F.y0, F.y1);
    rods.forEach((rod) => {
      rod.kickT += dt;
      rod.cd = Math.max(0, rod.cd - dt);
      rod.liftT = Math.max(0, rod.liftT - dt);
      if (rod.team === "r") moveRod(rod, targetOffset(rod, aimY), HUMAN_SPEED, dt);
    });
    botThink(dt);

    if (state === "countdown") {
      if (stateT >= 2.1) { resetBall(serveTo); setState("play"); beep(520, 0.12, "sine", 0.06); }
      return;
    }
    if (state === "goal") {
      if (stateT >= 1.5) {
        banner = null;
        if (score.r >= target || score.b >= target) return endGame();
        setState("countdown");
      }
      return;
    }

    // state === "play"
    const steps = 4;
    for (let s = 0; s < steps && state === "play"; s++) physics(dt / steps);
    if (state !== "play") return;

    history.push({ t: clock, x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy });
    while (history.length && history[0].t < clock - 1) history.shift();

    if (Math.hypot(ball.vx, ball.vy) > 420) { trail.push({ x: ball.x, y: ball.y }); if (trail.length > 8) trail.shift(); }
    else if (trail.length) trail.shift();

    // Balle morte : on réengage au milieu
    if (Math.hypot(ball.vx, ball.vy) < 14) deadT += dt; else deadT = 0;
    if (deadT > 2) {
      comment("Balle morte ! On réengage au milieu.");
      serveTo = ball.x < W / 2 ? 1 : -1;
      setState("countdown");
      ball.vx = ball.vy = 0; ball.x = W / 2; ball.y = CY;
      deadT = 0;
    }
  }

  function endGame() {
    const win = score.r > score.b;
    const fanny = (win ? score.b : score.r) === 0;
    const rec = getSave();
    rec[level] = rec[level] || { v: 0, d: 0 };
    if (win) rec[level].v++; else rec[level].d++;
    persist();
    banner = {
      big: win ? "VICTOIRE !" : "DÉFAITE",
      small: fanny ? (win ? TXT.fannyPour : TXT.fannyContre) : `${score.r} - ${score.b}`,
      color: win ? "#ffc21a" : "#ff6b6b"
    };
    comment(fanny ? (win ? TXT.fannyPour : TXT.fannyContre) : pick(win ? TXT.victoire : TXT.defaite));
    setState("over");
    $id("gameStart").textContent = "Rejouer";
    renderRecord();
    if (win) { beep(660, 0.15); setTimeout(() => beep(880, 0.15), 150); setTimeout(() => beep(1320, 0.3), 300); }
  }

  function frame(ts) {
    if (!running) return;
    const dt = Math.min(1 / 30, (ts - (last || ts)) / 1000);
    last = ts;
    update(dt);
    draw();
    rafId = requestAnimationFrame(frame);
  }

  /* ---------------- Dessin ---------------- */
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Cadre en bois
    ctx.fillStyle = "#b98a4e"; rr(0, 0, W, H, 24); ctx.fill();
    ctx.strokeStyle = "#8a6233"; ctx.lineWidth = 4; rr(14, 14, W - 28, H - 28, 14); ctx.stroke();

    // Buts
    ctx.fillStyle = "#0f2a19";
    ctx.fillRect(F.x0 - 20, GOAL.y0, 20, GOAL.y1 - GOAL.y0);
    ctx.fillRect(F.x1, GOAL.y0, 20, GOAL.y1 - GOAL.y0);

    // Tapis
    ctx.fillStyle = "#1f6b3f";
    ctx.fillRect(F.x0, F.y0, F.x1 - F.x0, F.y1 - F.y0);
    ctx.strokeStyle = "rgba(255,255,255,.3)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W / 2, F.y0); ctx.lineTo(W / 2, F.y1); ctx.stroke();
    ctx.beginPath(); ctx.arc(W / 2, CY, 60, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeRect(F.x0, GOAL.y0 - 35, 70, GOAL.y1 - GOAL.y0 + 70);
    ctx.strokeRect(F.x1 - 70, GOAL.y0 - 35, 70, GOAL.y1 - GOAL.y0 + 70);

    // Barres + poignées
    rods.forEach((rod) => {
      ctx.strokeStyle = "rgba(205,210,215,.8)"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(rod.x, 4); ctx.lineTo(rod.x, H - 4); ctx.stroke();
      ctx.fillStyle = rod.team === "r" ? "#7a1620" : "#173e8a";
      if (rod.team === "r") { rr(rod.x - 7, H - 22 + rod.off * 0.05, 14, 18, 5); }
      else { rr(rod.x - 7, 4 + rod.off * 0.05, 14, 18, 5); }
      ctx.fill();
    });

    // Joueurs
    rods.forEach((rod) => {
      const lifted = rod.liftT > 0;
      const body = rod.team === "r" ? "#e63946" : "#4c86f0";
      const dark = rod.team === "r" ? "#7a1620" : "#173e8a";
      const k = rod.kickT < KICK_TIME ? Math.sin((rod.kickT / KICK_TIME) * Math.PI) : 0;
      ctx.globalAlpha = lifted ? 0.35 : 1;
      playerYs(rod).forEach((py) => {
        if (k > 0.05) {
          const ext = KICK_REACH * k;
          ctx.fillStyle = dark;
          ctx.fillRect(rod.dir > 0 ? rod.x : rod.x - ext, py - 6, ext, 12);
        }
        ctx.fillStyle = body; ctx.strokeStyle = dark; ctx.lineWidth = 2;
        if (lifted) rr(rod.x - PHH, py - PHW, PHH * 2, PHW * 2, 4);
        else rr(rod.x - PHW, py - PHH, PHW * 2, PHH * 2, 4);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#f2c9a0";
        ctx.beginPath(); ctx.arc(rod.x, py, 5, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
    });

    // Repère de visée du joueur (petit triangle sur la bande gauche)
    if (state === "play" || state === "countdown") {
      ctx.fillStyle = "rgba(255,194,26,.9)";
      ctx.beginPath(); ctx.moveTo(4, aimY - 8); ctx.lineTo(16, aimY); ctx.lineTo(4, aimY + 8); ctx.fill();
    }

    // Balle
    if (state === "play") {
      trail.forEach((p, i) => {
        ctx.fillStyle = `rgba(255,246,224,${(i + 1) / (trail.length * 4)})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, R * 0.9, 0, Math.PI * 2); ctx.fill();
      });
      ctx.fillStyle = "rgba(0,0,0,.25)";
      ctx.beginPath(); ctx.arc(ball.x + 3, ball.y + 4, R, 0, Math.PI * 2); ctx.fill();
      const g = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 1, ball.x, ball.y, R);
      g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#e2cfa4");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(ball.x, ball.y, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#8a6233"; ctx.lineWidth = 1; ctx.stroke();
    }

    // Messages
    if (state === "menu") overlay("PRÊT ?", "Clique sur « Jouer » pour lancer la partie", "#ffc21a");
    else if (state === "paused") overlay("PAUSE", "Clique sur « Reprendre »", "#ffffff");
    else if (state === "countdown") {
      const n = Math.max(1, 3 - Math.floor(stateT / 0.7));
      overlay(String(n), "Place tes barres !", "#ffffff", true);
    } else if (banner) overlay(banner.big, banner.small, banner.color);
  }

  function overlay(big, small, color, light) {
    ctx.fillStyle = light ? "rgba(0,0,0,.25)" : "rgba(0,0,0,.55)";
    ctx.fillRect(F.x0, CY - 80, F.x1 - F.x0, 160);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.font = `64px Bungee, Impact, sans-serif`;
    ctx.fillText(big, W / 2, CY - 18);
    ctx.fillStyle = "#ffffff";
    ctx.font = `600 22px Rubik, system-ui, sans-serif`;
    ctx.fillText(small, W / 2, CY + 42);
  }

  /* ---------------- Interface ---------------- */
  const $id = (id) => document.getElementById(id);

  function comment(t) { const el = $id("commentary"); if (el) el.textContent = t; }

  function updateScore() {
    $id("scoreRed").textContent = score.r;
    $id("scoreBlue").textContent = score.b;
    $id("botName").textContent = LEVELS[level].nom;
  }

  function renderLevels() {
    $id("botLevels").innerHTML = Object.entries(LEVELS).map(([n, L]) =>
      `<button type="button" class="chip" data-bot="${n}" aria-pressed="${Number(n) === level}">${"★".repeat(n)} ${L.nom}</button>`
    ).join("");
    $id("botDesc").textContent = LEVELS[level].desc;
  }

  function renderRecord() {
    const rec = getSave();
    $id("botRecord").innerHTML = Object.entries(LEVELS).map(([n, L]) => {
      const r = rec[n] || { v: 0, d: 0 };
      const tot = r.v + r.d;
      return `<div class="stat"><p class="stat-label">${"★".repeat(n)} contre ${L.nom}</p>
        <p class="stat-value">${r.v} V · ${r.d} D</p>
        <p class="stat-sub">${tot ? Math.round((r.v / tot) * 100) + " % de victoires" : "Pas encore joué"}</p></div>`;
    }).join("");
  }

  function updateButtons() {
    $id("gamePause").textContent = state === "paused" ? "Reprendre" : "Pause";
    $id("gamePause").disabled = state === "menu" || state === "over";
    $id("gameSound").textContent = soundOn() ? "🔊 Son" : "🔇 Son";
  }

  function pause() {
    if (["play", "countdown", "goal"].includes(state)) { prevState = state; setState("paused"); }
    updateButtons();
  }
  function resume() {
    if (state === "paused") { state = prevState || "countdown"; stateT = 0; if (state === "goal") stateT = 1.4; }
    updateButtons();
  }

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
  }

  function pointerY(e) {
    const r = canvas.getBoundingClientRect();
    return ((e.clientY - r.top) / r.height) * H;
  }

  function bindEvents() {
    let touchStart = null;
    canvas.addEventListener("pointermove", (e) => {
      aimY = pointerY(e);
      if (touchStart && Math.abs(e.clientY - touchStart.y) > 12) touchStart.moved = true;
    });
    canvas.addEventListener("pointerdown", (e) => {
      aimY = pointerY(e);
      if (e.pointerType === "mouse") { if (e.button === 0) humanKick(); }
      else touchStart = { y: e.clientY, t: performance.now(), moved: false };
    });
    canvas.addEventListener("pointerup", (e) => {
      if (e.pointerType !== "mouse" && touchStart && !touchStart.moved && performance.now() - touchStart.t < 300) humanKick();
      touchStart = null;
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    window.addEventListener("keydown", (e) => {
      if (!running) return;
      const k = e.key.toLowerCase();
      if (k === "arrowup" || k === "z" || k === "w") { keys.up = true; e.preventDefault(); }
      else if (k === "arrowdown" || k === "s") { keys.down = true; e.preventDefault(); }
      else if (k === " " || k === "enter") {
        if (e.target.closest && e.target.closest("button, select, input")) return;
        e.preventDefault();
        if (state === "menu" || state === "over") start(); else humanKick();
      } else if (k === "p" || k === "escape") { state === "paused" ? resume() : pause(); }
    });
    window.addEventListener("keyup", (e) => {
      const k = e.key.toLowerCase();
      if (k === "arrowup" || k === "z" || k === "w") keys.up = false;
      if (k === "arrowdown" || k === "s") keys.down = false;
    });

    $id("gameShoot").addEventListener("pointerdown", (e) => { e.preventDefault(); humanKick(); });
    $id("gameStart").addEventListener("click", start);
    $id("gamePause").addEventListener("click", () => (state === "paused" ? resume() : pause()));
    $id("gameSound").addEventListener("click", () => {
      if (typeof S !== "undefined") { S.son = !soundOn(); persist(); }
      updateButtons();
    });
    $id("gameFull").addEventListener("click", () => {
      const wrap = $id("gameWrap");
      if (document.fullscreenElement) document.exitFullscreen();
      else if (wrap.requestFullscreen) wrap.requestFullscreen().catch(() => {});
    });
    $id("botLevels").addEventListener("click", (e) => {
      const b = e.target.closest("[data-bot]");
      if (!b) return;
      level = Number(b.dataset.bot);
      if (typeof S !== "undefined") { S.botLvl = level; persist(); }
      renderLevels();
      updateScore();
      if (state !== "menu" && state !== "over") comment(`Niveau « ${LEVELS[level].nom} » activé. Clique sur « Jouer » pour recommencer avec ce niveau.`);
    });
    $id("gameTarget").addEventListener("change", (e) => {
      target = Number(e.target.value);
      if (typeof S !== "undefined") { S.botTarget = target; persist(); }
    });
    document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
  }

  function start() {
    newGame();
    $id("gameStart").textContent = "Recommencer";
    updateButtons();
    canvas.focus({ preventScroll: true });
  }

  function mount() {
    canvas = $id("game");
    ctx = canvas.getContext("2d");
    if (typeof S !== "undefined") {
      if (LEVELS[S.botLvl]) level = S.botLvl;
      if ([5, 10].includes(S.botTarget)) target = S.botTarget;
    }
    $id("gameTarget").value = String(target);
    makeRods();
    resize();
    window.addEventListener("resize", resize);
    bindEvents();
    mounted = true;
  }

  /* ---------------- API publique ---------------- */
  return {
    show() {
      if (!mounted) mount();
      renderLevels();
      renderRecord();
      updateScore();
      updateButtons();
      if (!running) { running = true; last = 0; rafId = requestAnimationFrame(frame); }
    },
    hide() {
      if (!mounted) return;
      pause();
      running = false;
      cancelAnimationFrame(rafId);
      keys.up = keys.down = false;
    },
    levels: LEVELS
  };
})();
