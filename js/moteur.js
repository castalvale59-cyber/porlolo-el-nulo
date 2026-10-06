/* =========================================================
   PorLolo el nulo — moteur de babyfoot (partagé solo / multi)
   Physique, bot, instantanés réseau et dessin de la table.
   Aucune dépendance au DOM : testable sans navigateur.
   Équipe « r » attaque vers la droite, équipe « b » vers la gauche.
   ========================================================= */

const Moteur = (() => {
  const W = 960, H = 540;
  const F = { x0: 30, x1: 930, y0: 30, y1: 510 };
  const CY = 270;
  const GOAL = { y0: 195, y1: 345 };
  const R = 9;
  const PHW = 8, PHH = 12;
  const KICK_REACH = 26, KICK_TIME = 0.12, KICK_COOLDOWN = 0.28, LIFT_TIME = 0.35;
  const HUMAN_SPEED = 1600, HUMAN_POWER = 950, MAX_SPEED = 1200;

  // Ordre des barres de gauche à droite : g, d, A, m, M, a, D, G (disposition Bonzini 1-2-5-3)
  const LAYOUT = [["r", 1], ["r", 2], ["b", 3], ["r", 5], ["b", 5], ["r", 3], ["b", 2], ["b", 1]];
  const SPACING = { 1: [0], 2: [-120, 120], 3: [-160, 0, 160], 5: [-192, -96, 0, 96, 192] };
  const TRAVEL = { 1: 100, 2: 108, 3: 68, 5: 36 };

  // Niveaux du bot (réglés par simulation contre un joueur aux réflexes humains)
  const LEVELS = {
    1: { nom: "Lolo", desc: "Lent, distrait, tire au hasard. Parfait pour commencer.",
         speed: 330, delay: 0.28, err: 38, kickProb: 0.025, power: 600, predict: false, jitter: 30 },
    2: { nom: "Habitué du bar", desc: "Suit bien la balle, anticipe les tirs, frappe correctement.",
         speed: 440, delay: 0.22, err: 28, kickProb: 0.045, power: 700, predict: true, jitter: 0 },
    3: { nom: "Légende Bonzini", desc: "Réflexes de pro, vise le coin opposé à ton gardien. Bon courage.",
         speed: 520, delay: 0.16, err: 18, kickProb: 0.11, power: 800, predict: true, jitter: 0 }
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rodX = (i) => F.x0 + ((F.x1 - F.x0) * (i + 0.5)) / 8;
  const playerYs = (rod) => SPACING[rod.n].map((s) => CY + s + rod.off);
  const other = (team) => (team === "r" ? "b" : "r");

  /* ---------------- Création d'une partie ---------------- */
  // flow  = true : ce moteur fait avancer la partie (engagement, buts → compte à rebours, fin).
  // goals = true : ce moteur décide des buts (en multi : seulement quand la balle est dans sa moitié).
  function create(opts = {}) {
    return {
      target: opts.target || 5,
      flow: opts.flow !== false,
      goals: opts.goals !== false,
      owner: null,
      rods: LAYOUT.map(([team, n], i) => ({
        i, team, n, x: rodX(i), dir: team === "r" ? 1 : -1,
        off: 0, vy: 0, kickT: 99, cd: 0, liftT: 0, hit: false, aim: null, power: HUMAN_POWER
      })),
      ball: { x: W / 2, y: CY, vx: 0, vy: 0 },
      score: { r: 0, b: 0 },
      state: "menu",               // menu | countdown | play | goal | over | paused
      prevState: null,
      stateT: 0, clock: 0,
      serveTo: 0, deadT: 0,
      trail: [], history: [],
      aim: { r: CY, b: CY },        // hauteur visée par chaque équipe (souris, doigt, réseau)
      ctrl: { r: "aim", b: "aim" }, // « aim » = barres pilotées par aim[], « bot » = pilotées par le bot
      speed: { r: HUMAN_SPEED, b: HUMAN_SPEED },
      lastGoal: null, winner: null,
      events: []                    // file d'événements lue par l'interface (sons, textes, réseau)
    };
  }

  function setState(g, s) { g.state = s; g.stateT = 0; }

  function start(g) {
    g.score = { r: 0, b: 0 };
    g.rods.forEach((r) => { r.off = 0; r.kickT = 99; r.cd = 0; r.liftT = 0; });
    g.ball.x = W / 2; g.ball.y = CY; g.ball.vx = g.ball.vy = 0;
    g.serveTo = Math.random() < 0.5 ? -1 : 1;
    g.lastGoal = null; g.winner = null; g.trail = []; g.history = [];
    setState(g, "countdown");
  }

  function pause(g) {
    if (["play", "countdown", "goal"].includes(g.state)) { g.prevState = g.state; setState(g, "paused"); }
  }
  function resume(g) {
    if (g.state !== "paused") return;
    const back = g.prevState || "countdown";
    setState(g, back);
    if (back === "goal") g.stateT = 1.4;
  }

  function resetBall(g, toward) {
    g.ball.x = W / 2;
    g.ball.y = CY + (Math.random() * 80 - 40);
    g.ball.vx = toward * (70 + Math.random() * 40);
    g.ball.vy = Math.random() * 60 - 30;
    g.trail = [];
    g.deadT = 0;
  }

  /* ---------------- Barres ---------------- */
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

  function kickRod(g, rod, power, aim) {
    if (rod.cd > 0 || rod.liftT > 0) return false;
    rod.kickT = 0;
    rod.cd = KICK_COOLDOWN;
    rod.hit = false;
    rod.power = power;
    rod.aim = aim;
    return true;
  }

  function kickTeam(g, team, power = HUMAN_POWER) {
    if (g.state !== "play" && g.state !== "countdown") return false;
    let any = false;
    g.rods.forEach((r) => { if (r.team === team && kickRod(g, r, power, null)) any = true; });
    return any;   // false si toutes les barres rechargent encore
  }

  // Un tir de cette équipe peut-il toucher la balle en ce moment ? (balle à portée devant un joueur)
  function kickCouldHit(g, team, margin = 14) {
    const b = g.ball;
    return g.rods.some((r) => {
      if (r.team !== team || r.liftT > 0) return false;
      const front = r.dir * (b.x - r.x);
      if (front < -PHW - R - margin || front > KICK_REACH + R + margin) return false;
      return playerYs(r).some((py) => Math.abs(py - b.y) < PHH + R + margin);
    });
  }

  // Quand une barre tire, les barres de la même équipe devant elle se relèvent.
  function liftFront(g, rod) {
    g.rods.forEach((r) => {
      if (r.team === rod.team && rod.dir * (r.x - rod.x) > 0) r.liftT = LIFT_TIME;
    });
  }

  /* ---------------- Bot (joue l'équipe « b ») ---------------- */
  function createBot(level) { return { level, err: 0, errT: 0 }; }

  function delayedBall(g, delay) {
    const t = g.clock - delay;
    for (let i = g.history.length - 1; i >= 0; i--) if (g.history[i].t <= t) return g.history[i];
    return g.history[0] || g.ball;
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

  function botThink(g, bot, dt) {
    if (["menu", "paused", "over"].includes(g.state)) return;
    const L = LEVELS[bot.level];
    const level = bot.level;
    const ball = g.ball;
    const seen = delayedBall(g, L.delay);
    bot.errT -= dt;
    if (bot.errT <= 0) { bot.err = (Math.random() * 2 - 1) * L.err; bot.errT = 0.5; }

    g.rods.forEach((rod) => {
      if (rod.team !== "b") return;
      let ty = L.predict ? predictY(seen, rod.x) : seen.y;
      // Balle lente juste derrière la barre : on s'écarte pour la laisser passer devant.
      const behind = rod.dir * (seen.x - rod.x) < 0 && Math.abs(seen.x - rod.x) < 70 && Math.hypot(seen.vx, seen.vy) < 120;
      if (behind) ty = seen.y + (rod.n === 1 ? 45 : Math.abs(SPACING[rod.n][1] - SPACING[rod.n][0]) / 2);
      ty += bot.err + (L.jitter ? Math.sin(g.clock * 7 + rod.i) * L.jitter : 0);
      moveRod(rod, targetOffset(rod, ty), L.speed, dt);

      if (g.state !== "play" || rod.cd > 0) return;
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
        const gy = CY + g.rods[0].off;              // gardien rouge
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
      kickRod(g, rod, L.power, aim);
    });
  }

  /* ---------------- Physique ---------------- */
  function collide(g, rod, py) {
    if (rod.liftT > 0) return;
    const ball = g.ball;
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
      liftFront(g, rod);
      g.events.push({ type: "kick", team: rod.team });
    } else {
      const rvn = ball.vx * nx + (ball.vy - rod.vy) * ny;
      if (rvn < 0) {
        ball.vx -= 1.55 * rvn * nx;
        ball.vy -= 1.55 * rvn * ny;
        if (rvn < -200) g.events.push({ type: "bump" });
      }
    }
  }

  function goal(g, team) {
    g.score[team]++;
    g.lastGoal = team;
    g.serveTo = team === "r" ? 1 : -1;           // l'équipe qui encaisse récupère la balle
    g.ball.vx = g.ball.vy = 0;
    g.ball.x = W / 2; g.ball.y = CY;
    g.events.push({ type: "goal", team });
    setState(g, "goal");
  }

  function physics(g, dt) {
    const ball = g.ball;
    // Petit « dévers » : une balle presque arrêtée glisse vers la zone de frappe la plus proche
    // (devant une barre), quitte à passer sous une barre entre deux joueurs.
    const sp = Math.hypot(ball.vx, ball.vy);
    if (sp < 45) {
      let best = null;
      g.rods.forEach((r) => {
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
    if (ball.y < F.y0 + R) { ball.y = F.y0 + R; ball.vy = Math.abs(ball.vy) * 0.8; g.events.push({ type: "wall" }); }
    if (ball.y > F.y1 - R) { ball.y = F.y1 - R; ball.vy = -Math.abs(ball.vy) * 0.8; g.events.push({ type: "wall" }); }

    // Bandes de fond et buts
    const inMouth = ball.y > GOAL.y0 + 2 && ball.y < GOAL.y1 - 2;
    if (ball.x < F.x0 + R) {
      if (inMouth) {
        if (ball.x < F.x0 - R) {
          if (g.goals) return goal(g, "b");
          ball.x = F.x0 - R; ball.vx = ball.vy = 0;  // pas à nous de décider : on attend l'autre joueur
        }
      } else { ball.x = F.x0 + R; ball.vx = Math.abs(ball.vx) * 0.8; g.events.push({ type: "wall" }); }
    }
    if (ball.x > F.x1 - R) {
      if (inMouth) {
        if (ball.x > F.x1 + R) {
          if (g.goals) return goal(g, "r");
          ball.x = F.x1 + R; ball.vx = ball.vy = 0;
        }
      } else { ball.x = F.x1 - R; ball.vx = -Math.abs(ball.vx) * 0.8; g.events.push({ type: "wall" }); }
    }
    // Poteaux : la balle dans le but ne peut pas en ressortir par le côté
    if (ball.x < F.x0 || ball.x > F.x1) ball.y = clamp(ball.y, GOAL.y0 + R, GOAL.y1 - R);

    g.rods.forEach((rod) => playerYs(rod).forEach((py) => collide(g, rod, py)));

    // Un joueur ne peut pas pousser la balle dans la bande.
    if (ball.x > F.x0 && ball.x < F.x1) ball.y = clamp(ball.y, F.y0 + R, F.y1 - R);
    if (!(ball.y > GOAL.y0 + 2 && ball.y < GOAL.y1 - 2)) ball.x = clamp(ball.x, F.x0 + R, F.x1 - R);
  }

  /* ---------------- Boucle ---------------- */
  function update(g, dt) {
    g.clock += dt;
    g.stateT += dt;
    if (["menu", "paused", "over"].includes(g.state)) return;

    g.rods.forEach((rod) => {
      rod.kickT += dt;
      rod.cd = Math.max(0, rod.cd - dt);
      rod.liftT = Math.max(0, rod.liftT - dt);
      if (g.ctrl[rod.team] === "aim") moveRod(rod, targetOffset(rod, clamp(g.aim[rod.team], F.y0, F.y1)), g.speed[rod.team], dt);
    });

    if (g.state === "countdown") {
      if (g.flow && g.stateT >= 2.1) { resetBall(g, g.serveTo); setState(g, "play"); g.events.push({ type: "serve" }); }
      return;
    }
    if (g.state === "goal") {
      if (g.flow && g.stateT >= 1.5) {
        if (g.score.r >= g.target || g.score.b >= g.target) {
          g.winner = g.score.r > g.score.b ? "r" : "b";
          setState(g, "over");
          g.events.push({ type: "over", winner: g.winner });
        } else setState(g, "countdown");
      }
      return;
    }

    // state === "play"
    const steps = 4;
    for (let s = 0; s < steps && g.state === "play"; s++) physics(g, dt / steps);
    if (g.state !== "play") return;
    const ball = g.ball;

    g.history.push({ t: g.clock, x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy });
    while (g.history.length && g.history[0].t < g.clock - 1) g.history.shift();

    if (Math.hypot(ball.vx, ball.vy) > 420) { g.trail.push({ x: ball.x, y: ball.y }); if (g.trail.length > 8) g.trail.shift(); }
    else if (g.trail.length) g.trail.shift();

    // Balle morte : on réengage au milieu
    if (!g.flow) return;
    if (Math.hypot(ball.vx, ball.vy) < 14) g.deadT += dt; else g.deadT = 0;
    if (g.deadT > 2) {
      g.serveTo = ball.x < W / 2 ? 1 : -1;
      ball.vx = ball.vy = 0; ball.x = W / 2; ball.y = CY;
      g.deadT = 0;
      g.events.push({ type: "dead" });
      setState(g, "countdown");
    }
  }

  // Barres d'une équipe pilotées à distance : on les amène vers les positions reçues.
  function driveRods(g, team, targets, dt) {
    let i = 0;
    g.rods.forEach((rod) => {
      if (rod.team !== team) return;
      const t = Number(targets[i++]);
      if (Number.isFinite(t)) moveRod(rod, clamp(t, -TRAVEL[rod.n], TRAVEL[rod.n]), HUMAN_SPEED, dt);
    });
  }
  const teamOffsets = (g, team) => g.rods.filter((r) => r.team === team).map((r) => Math.round(r.off));
  const teamSpeeds = (g, team) => g.rods.filter((r) => r.team === team).map((r) => Math.round(clamp(r.vy, -2500, 2500)));

  // Termine la partie (forfait, abandon…)
  function forceWin(g, team) {
    g.winner = team;
    setState(g, "over");
    g.events.push({ type: "over", winner: team, forfait: true });
  }

  /* ---------------- Réseau ---------------- */
  const ballState = (g) => [g.ball.x, g.ball.y, g.ball.vx, g.ball.vy].map((v) => Math.round(v));

  // Recale la balle sur un état reçu, projeté de « latency » secondes dans le futur.
  function setBall(g, b, latency = 0, smooth = false) {
    if (!Array.isArray(b) || b.length !== 4) return;
    const [x, y, vx, vy] = b.map(Number);
    if (![x, y, vx, vy].every(Number.isFinite)) return;
    const px = x + vx * latency, py = y + vy * latency;
    const d = Math.hypot(px - g.ball.x, py - g.ball.y);
    if (!smooth || d > 45) { g.ball.x = px; g.ball.y = py; }
    else { g.ball.x += (px - g.ball.x) * 0.5; g.ball.y += (py - g.ball.y) * 0.5; }
    g.ball.vx = vx; g.ball.vy = vy;
  }

  // État de la partie envoyé par le joueur qui mène le jeu.
  function flowState(g) {
    return { s: g.state, sc: [g.score.r, g.score.b], lg: g.lastGoal, w: g.winner, tg: g.target, ow: g.owner,
             b: g.state === "play" ? ballState(g) : null };
  }
  function applyFlow(g, p) {
    if (!p || !Array.isArray(p.sc)) return;
    g.score.r = p.sc[0] | 0; g.score.b = p.sc[1] | 0;
    g.lastGoal = p.lg || g.lastGoal; g.winner = p.w || null;
    if (p.tg) g.target = p.tg | 0;
    if (p.s !== g.state) {
      if (p.s === "goal") g.events.push({ type: "goal", team: p.lg, remote: true });
      if (p.s === "over") g.events.push({ type: "over", winner: p.w });
      if (p.s === "play") g.events.push({ type: "serve" });
      setState(g, p.s);
    }
    if (p.s === "play") { if (p.b) setBall(g, p.b, 0.04, false); }
    else { g.ball.vx = g.ball.vy = 0; g.ball.x = W / 2; g.ball.y = CY; g.trail = []; }
    if (p.ow === "r" || p.ow === "b") g.owner = p.ow;
  }

  /* ---------------- Dessin ---------------- */
  const COLORS = {
    me: { body: "#e63946", dark: "#7a1620" },
    them: { body: "#4c86f0", dark: "#173e8a" }
  };

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // view = { me: "r"|"b", aimY, overlay: {big, small, color, light} | null, dpr }
  // Le joueur se voit toujours en rouge, attaquant vers la droite (table retournée si besoin).
  function draw(ctx, g, view) {
    const dpr = view.dpr || 1;
    const me = view.me || "r";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (me === "b") { ctx.translate(W, 0); ctx.scale(-1, 1); }

    // Cadre en bois
    ctx.fillStyle = "#b98a4e"; rr(ctx, 0, 0, W, H, 24); ctx.fill();
    ctx.strokeStyle = "#8a6233"; ctx.lineWidth = 4; rr(ctx, 14, 14, W - 28, H - 28, 14); ctx.stroke();

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
    g.rods.forEach((rod) => {
      const mine = rod.team === me;
      ctx.strokeStyle = "rgba(205,210,215,.8)"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(rod.x, 4); ctx.lineTo(rod.x, H - 4); ctx.stroke();
      ctx.fillStyle = mine ? COLORS.me.dark : COLORS.them.dark;
      rr(ctx, rod.x - 7, mine ? H - 22 : 4, 14, 18, 5);
      ctx.fill();
    });

    // Joueurs
    g.rods.forEach((rod) => {
      const c = rod.team === me ? COLORS.me : COLORS.them;
      const lifted = rod.liftT > 0;
      const k = rod.kickT < KICK_TIME ? Math.sin((rod.kickT / KICK_TIME) * Math.PI) : 0;
      ctx.globalAlpha = lifted ? 0.35 : 1;
      playerYs(rod).forEach((py) => {
        if (k > 0.05) {
          const ext = KICK_REACH * k;
          ctx.fillStyle = c.dark;
          ctx.fillRect(rod.dir > 0 ? rod.x : rod.x - ext, py - 6, ext, 12);
        }
        ctx.fillStyle = c.body; ctx.strokeStyle = c.dark; ctx.lineWidth = 2;
        if (lifted) rr(ctx, rod.x - PHH, py - PHW, PHH * 2, PHW * 2, 4);
        else rr(ctx, rod.x - PHW, py - PHH, PHW * 2, PHH * 2, 4);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#f2c9a0";
        ctx.beginPath(); ctx.arc(rod.x, py, 5, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
    });

    // Balle
    const ball = g.ball;
    if (g.state === "play") {
      g.trail.forEach((p, i) => {
        ctx.fillStyle = `rgba(255,246,224,${(i + 1) / (g.trail.length * 4)})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, R * 0.9, 0, Math.PI * 2); ctx.fill();
      });
      ctx.fillStyle = "rgba(0,0,0,.25)";
      ctx.beginPath(); ctx.arc(ball.x + 3, ball.y + 4, R, 0, Math.PI * 2); ctx.fill();
      const grad = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 1, ball.x, ball.y, R);
      grad.addColorStop(0, "#ffffff"); grad.addColorStop(1, "#e2cfa4");
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(ball.x, ball.y, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#8a6233"; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.restore();

    // Repère de visée (toujours à gauche, côté du joueur)
    if ((g.state === "play" || g.state === "countdown") && view.aimY != null) {
      ctx.fillStyle = "rgba(255,194,26,.9)";
      ctx.beginPath(); ctx.moveTo(4, view.aimY - 8); ctx.lineTo(16, view.aimY); ctx.lineTo(4, view.aimY + 8); ctx.fill();
    }

    if (view.overlay) {
      const o = view.overlay;
      ctx.fillStyle = o.light ? "rgba(0,0,0,.25)" : "rgba(0,0,0,.55)";
      ctx.fillRect(F.x0, CY - 80, F.x1 - F.x0, 160);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = o.color || "#ffffff";
      ctx.font = `64px Bungee, Impact, sans-serif`;
      ctx.fillText(o.big, W / 2, CY - 18);
      ctx.fillStyle = "#ffffff";
      ctx.font = `600 22px Rubik, system-ui, sans-serif`;
      ctx.fillText(o.small || "", W / 2, CY + 42);
    }
  }

  // Message standard à afficher par-dessus la table, du point de vue de « me ».
  function overlayFor(g, me, texts = {}) {
    const mine = g.score[me], theirs = g.score[other(me)];
    switch (g.state) {
      case "menu": return { big: texts.menuBig || "PRÊT ?", small: texts.menuSmall || "", color: "#ffc21a" };
      case "paused": return { big: "PAUSE", small: texts.pausedSmall || "", color: "#ffffff" };
      case "countdown": return { big: String(Math.max(1, 3 - Math.floor(g.stateT / 0.7))), small: "Place tes barres !", color: "#ffffff", light: true };
      case "goal": {
        const pour = g.lastGoal === me;
        return { big: pour ? "BUT !" : "BUT ADVERSE", small: `${mine} - ${theirs}`, color: pour ? "#ffc21a" : "#ff6b6b" };
      }
      case "over": {
        const win = g.winner === me;
        const fanny = (win ? theirs : mine) === 0;
        return {
          big: win ? "VICTOIRE !" : "DÉFAITE",
          small: fanny ? (win ? "FANNY ! L'adversaire passe sous la table." : "FANNY… Passe sous la table.") : `${mine} - ${theirs}`,
          color: win ? "#ffc21a" : "#ff6b6b"
        };
      }
      default: return null;
    }
  }

  return {
    W, H, CY, F, LEVELS, HUMAN_POWER,
    create, start, pause, resume, update, kickTeam, kickCouldHit, forceWin, driveRods, teamOffsets, teamSpeeds,
    createBot, botThink, ballState, setBall, flowState, applyFlow, goalFor: goal, draw, overlayFor, other
  };
})();

if (typeof module !== "undefined") module.exports = Moteur;
