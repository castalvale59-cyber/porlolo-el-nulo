/* =========================================================
   PorLolo el nulo — onglet Jouer
   « Jeu » gère la table à l'écran (canvas, souris / doigt / clavier,
   sons, tableau de score) et fait tourner une « session » :
   - Solo : contre le bot (ce fichier)
   - Multi : contre d'autres joueurs (multi.js)
   ========================================================= */

const Jeu = (() => {
  const { W, H, CY, F } = Moteur;
  let canvas, ctx, dpr = 1;
  let running = false, rafId = 0, last = 0, mounted = false;
  let aimY = CY;
  const keys = { up: false, down: false };
  let session = null;
  let mode = "solo";
  let audio = null;

  const $id = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------------- Son ---------------- */
  const soundOn = () => !(typeof S !== "undefined" && S.son === false);
  function beep(freq, dur, type = "square", vol = 0.05) {
    if (!soundOn()) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), gn = audio.createGain();
      o.type = type; o.frequency.value = freq;
      gn.gain.setValueAtTime(vol, audio.currentTime);
      gn.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
      o.connect(gn).connect(audio.destination);
      o.start(); o.stop(audio.currentTime + dur);
    } catch (e) { /* pas de son, pas grave */ }
  }
  const SND = {
    kick: () => beep(180 + Math.random() * 60, 0.06, "triangle", 0.08),
    bump: () => beep(140, 0.04, "triangle", 0.05),
    wall: () => beep(320, 0.03, "sine", 0.03),
    serve: () => beep(520, 0.12, "sine", 0.06),
    goal: (pour) => { beep(pour ? 660 : 220, 0.18); setTimeout(() => beep(pour ? 880 : 165, 0.25), 160); },
    win: () => { beep(660, 0.15); setTimeout(() => beep(880, 0.15), 150); setTimeout(() => beep(1320, 0.3), 300); }
  };

  /* ---------------- Boucle ---------------- */
  function frame(ts) {
    if (!running) return;
    const dt = Math.min(1 / 30, (ts - (last || ts)) / 1000);
    last = ts;
    if (keys.up) aimY -= 700 * dt;
    if (keys.down) aimY += 700 * dt;
    aimY = clamp(aimY, F.y0, F.y1);

    if (session && session.game) {
      session.tick(dt, aimY);
      const g = session.game;
      const evs = g.events.splice(0);
      evs.forEach((e) => {
        if (SND[e.type] && e.type !== "goal") SND[e.type]();
        if (e.type === "goal") SND.goal(e.team === session.me);
        if (e.type === "over" && e.winner === session.me) SND.win();
        if (session.onEvent) session.onEvent(e);
      });
      updateScore();
      Moteur.draw(ctx, g, { me: session.me, aimY, dpr, overlay: session.overlay() });
    }
    rafId = requestAnimationFrame(frame);
  }

  function updateScore() {
    if (!session || !session.game) return;
    const g = session.game, me = session.me;
    const [nMe, nThem] = session.names();
    $id("scoreRed").textContent = g.score[me];
    $id("scoreBlue").textContent = g.score[Moteur.other(me)];
    $id("meName").textContent = nMe;
    $id("botName").textContent = nThem;
  }

  function comment(t) { const el = $id("commentary"); if (el) el.textContent = t; }

  function setSession(s) {
    session = s;
    $id("gameWrap").hidden = !s;
    if (s) { updateScore(); resize(); }
  }

  function kick() {
    if (!session) return;
    if (session.kick) session.kick();
  }

  /* ---------------- Entrées ---------------- */
  function resize() {
    if (!canvas) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
  }

  function pointerY(e) {
    const r = canvas.getBoundingClientRect();
    return ((e.clientY - r.top) / r.height) * H;
  }

  function bindInputs() {
    let touchStart = null;
    canvas.addEventListener("pointermove", (e) => {
      aimY = pointerY(e);
      if (touchStart && Math.abs(e.clientY - touchStart.y) > 12) touchStart.moved = true;
    });
    canvas.addEventListener("pointerdown", (e) => {
      aimY = pointerY(e);
      if (e.pointerType === "mouse") { if (e.button === 0) kick(); }
      else touchStart = { y: e.clientY, t: performance.now(), moved: false };
    });
    canvas.addEventListener("pointerup", (e) => {
      if (e.pointerType !== "mouse" && touchStart && !touchStart.moved && performance.now() - touchStart.t < 300) kick();
      touchStart = null;
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    window.addEventListener("keydown", (e) => {
      if (!running || !session) return;
      if (e.target.closest && e.target.closest("input, select, textarea")) return;
      const k = e.key.toLowerCase();
      if (k === "arrowup" || k === "z" || k === "w") { keys.up = true; e.preventDefault(); }
      else if (k === "arrowdown" || k === "s") { keys.down = true; e.preventDefault(); }
      else if (k === " ") {
        if (e.target.closest && e.target.closest("button")) return;
        e.preventDefault();
        if (session.onSpace && session.onSpace()) return;
        kick();
      } else if ((k === "p" || k === "escape") && session.togglePause) session.togglePause();
    });
    window.addEventListener("keyup", (e) => {
      const k = e.key.toLowerCase();
      if (k === "arrowup" || k === "z" || k === "w") keys.up = false;
      if (k === "arrowdown" || k === "s") keys.down = false;
    });

    $id("gameShoot").addEventListener("pointerdown", (e) => { e.preventDefault(); kick(); });
    $id("gameSound").addEventListener("click", () => {
      if (typeof S !== "undefined") { S.son = !soundOn(); if (typeof save === "function") save(); }
      $id("gameSound").textContent = soundOn() ? "🔊 Son" : "🔇 Son";
    });
    $id("gameFull").addEventListener("click", () => {
      const wrap = $id("gameWrap");
      if (document.fullscreenElement) document.exitFullscreen();
      else if (wrap.requestFullscreen) wrap.requestFullscreen().catch(() => {});
    });
    $id("modeSwitch").addEventListener("click", (e) => {
      const b = e.target.closest("[data-mode]");
      if (!b || b.dataset.mode === mode) return;
      if (b.dataset.mode === "solo" && typeof Multi !== "undefined" && Multi.inSalon()) {
        if (!confirm("Passer en solo te fait quitter le salon multijoueur. Continuer ?")) return;
        Multi.leaveSalon();
      }
      setMode(b.dataset.mode);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && session && session.onHidden) session.onHidden();
    });
    window.addEventListener("resize", resize);
  }

  function setMode(m) {
    mode = m;
    document.querySelectorAll("#modeSwitch [data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === m)));
    document.querySelectorAll("[data-only]").forEach((el) => { el.hidden = el.dataset.only !== m; });
    if (m === "solo") { if (typeof Multi !== "undefined") Multi.deactivate(); Solo.activate(); }
    else { Solo.deactivate(); Multi.activate(); }
  }

  function mount() {
    canvas = $id("game");
    ctx = canvas.getContext("2d");
    resize();
    bindInputs();
    $id("gameSound").textContent = soundOn() ? "🔊 Son" : "🔇 Son";
    Solo.mount();
    mounted = true;
  }

  return {
    show(params = {}) {
      if (!mounted) mount();
      const wanted = params.salon ? "multi" : mode;
      setMode(wanted);
      if (params.salon && typeof Multi !== "undefined") Multi.prefill(params.salon);
      if (!running) { running = true; last = 0; rafId = requestAnimationFrame(frame); }
    },
    hide() {
      if (!mounted) return;
      if (session && session.onHidden) session.onHidden();
      running = false;
      cancelAnimationFrame(rafId);
      keys.up = keys.down = false;
    },
    setSession, comment, beep, kick, $id,
    get session() { return session; }
  };
})();

/* =========================================================
   Solo : contre le bot
   ========================================================= */
const Solo = (() => {
  const LEVELS = Moteur.LEVELS;
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
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const $id = (id) => document.getElementById(id);

  let level = 2, target = 5;
  let game = null, bot = null;

  function getSave() {
    if (typeof S === "undefined") return {};
    if (!S.jeu) S.jeu = {};
    return S.jeu;
  }
  const persist = () => { if (typeof save === "function") save(); };

  function newGame() {
    game = Moteur.create({ target });
    game.ctrl.b = "bot";
    bot = Moteur.createBot(level);
    session.game = game;
  }

  const session = {
    me: "r",
    game: null,
    tick(dt, aim) {
      game.aim.r = aim;
      Moteur.botThink(game, bot, dt);
      Moteur.update(game, dt);
    },
    kick() { Moteur.kickTeam(game, "r"); },
    names() { return ["Toi", LEVELS[level].nom]; },
    overlay() {
      return Moteur.overlayFor(game, "r", {
        menuSmall: "Clique sur « Jouer » pour lancer la partie",
        pausedSmall: "Clique sur « Reprendre »"
      });
    },
    onSpace() {
      if (game.state === "menu" || game.state === "over") { start(); return true; }
      return false;
    },
    togglePause() { game.state === "paused" ? Moteur.resume(game) : Moteur.pause(game); updateButtons(); },
    onHidden() { Moteur.pause(game); updateButtons(); },
    onEvent(e) {
      if (e.type === "goal") Jeu.comment(pick(e.team === "r" ? TXT.butPour : TXT.butContre));
      if (e.type === "dead") Jeu.comment("Balle morte ! On réengage au milieu.");
      if (e.type === "over") endGame();
    }
  };

  function endGame() {
    const win = game.winner === "r";
    const fanny = (win ? game.score.b : game.score.r) === 0;
    const rec = getSave();
    rec[level] = rec[level] || { v: 0, d: 0 };
    if (win) rec[level].v++; else rec[level].d++;
    persist();
    Jeu.comment(fanny ? (win ? TXT.fannyPour : TXT.fannyContre) : pick(win ? TXT.victoire : TXT.defaite));
    $id("gameStart").textContent = "Rejouer";
    renderRecord();
    updateButtons();
  }

  function start() {
    newGame();
    Moteur.start(game);
    $id("gameStart").textContent = "Recommencer";
    Jeu.comment(`C'est parti contre « ${LEVELS[level].nom} ». Premier à ${target} buts.`);
    updateButtons();
    $id("game").focus({ preventScroll: true });
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
    if (!game) return;
    $id("gamePause").textContent = game.state === "paused" ? "Reprendre" : "Pause";
    $id("gamePause").disabled = game.state === "menu" || game.state === "over";
  }

  function mount() {
    if (typeof S !== "undefined") {
      if (LEVELS[S.botLvl]) level = S.botLvl;
      if ([5, 10].includes(S.botTarget)) target = S.botTarget;
    }
    $id("gameTarget").value = String(target);
    newGame();

    $id("gameStart").addEventListener("click", start);
    $id("gamePause").addEventListener("click", () => session.togglePause());
    $id("botLevels").addEventListener("click", (e) => {
      const b = e.target.closest("[data-bot]");
      if (!b) return;
      level = Number(b.dataset.bot);
      if (typeof S !== "undefined") { S.botLvl = level; persist(); }
      renderLevels();
      if (game.state === "menu" || game.state === "over") newGame();
      else Jeu.comment(`Niveau « ${LEVELS[level].nom} » choisi. Clique sur « Recommencer » pour jouer contre lui.`);
    });
    $id("gameTarget").addEventListener("change", (e) => {
      target = Number(e.target.value);
      if (typeof S !== "undefined") { S.botTarget = target; persist(); }
      if (game.state === "menu" || game.state === "over") game.target = target;
    });
  }

  return {
    mount,
    activate() {
      renderLevels();
      renderRecord();
      Jeu.setSession(session);
      updateButtons();
      if (game.state === "menu") Jeu.comment("Choisis un niveau et clique sur « Jouer ».");
    },
    deactivate() { if (game) Moteur.pause(game); }
  };
})();
