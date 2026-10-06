/* =========================================================
   PorLolo el nulo — multijoueur façon Kahoot
   - Un hôte crée un salon (code à 4 caractères), les autres le rejoignent.
   - 2 joueurs = un match ; 3 à 16 = tournoi à élimination directe.
   - 2 tables max en même temps (limite de messages du plan gratuit).
   - L'hôte organise (tableau, tables, résultats). Dans chaque match,
     le joueur A fait tourner la physique et envoie l'état au joueur B.
   Transport : Supabase Realtime (broadcast + presence), ou un faux
   réseau local pour les tests (?local=1).
   ========================================================= */

/* ---------------- Transports ---------------- */
const Reseau = (() => {
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = res; s.onerror = () => rej(new Error("script"));
      document.head.appendChild(s);
    });
  }

  async function supabase(cfg) {
    if (!window.supabase) await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js");
    const client = window.supabase.createClient(cfg.url, cfg.key, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 30 } }
    });
    return {
      async channel(name, { key, events, onBroadcast, onPresence }) {
        const ch = client.channel(name, { config: { broadcast: { self: false }, presence: { key } } });
        events.forEach((ev) => ch.on("broadcast", { event: ev }, (msg) => onBroadcast(ev, msg.payload)));
        ch.on("presence", { event: "sync" }, () => {
          const st = ch.presenceState();
          onPresence(Object.entries(st).map(([id, metas]) => ({ ...(metas[0] || {}), id })));
        });
        await new Promise((res, rej) => {
          const to = setTimeout(() => rej(new Error("délai dépassé")), 12000);
          ch.subscribe((status) => {
            if (status === "SUBSCRIBED") { clearTimeout(to); res(); }
            else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") { clearTimeout(to); rej(new Error(status)); }
          });
        });
        return {
          send: (event, payload) => ch.send({ type: "broadcast", event, payload }),
          track: (meta) => ch.track(meta),
          leave: () => client.removeChannel(ch)
        };
      }
    };
  }

  // Faux réseau entre onglets du même navigateur (tests en local).
  function local() {
    return {
      async channel(name, { key, onBroadcast, onPresence }) {
        const bc = new BroadcastChannel("porlolo-" + name);
        const peers = new Map();
        let meta = null;
        const emit = () => onPresence([
          ...(meta ? [{ ...meta, id: key }] : []),
          ...[...peers].map(([id, p]) => ({ ...p.meta, id }))
        ]);
        bc.onmessage = (e) => {
          const m = e.data;
          if (m.k === "b") onBroadcast(m.ev, m.p);
          else if (m.k === "p") {
            const had = peers.has(m.id);
            peers.set(m.id, { meta: m.meta, seen: Date.now() });
            if (!had || m.chg) emit();
            if (m.ask && meta) bc.postMessage({ k: "p", id: key, meta });
          } else if (m.k === "l") { peers.delete(m.id); emit(); }
        };
        const hb = setInterval(() => {
          if (meta) bc.postMessage({ k: "p", id: key, meta });
          let changed = false;
          for (const [id, p] of peers) if (Date.now() - p.seen > 4000) { peers.delete(id); changed = true; }
          if (changed) emit();
        }, 1000);
        return {
          send: (ev, p) => bc.postMessage({ k: "b", ev, p }),
          track: (m) => { meta = m; bc.postMessage({ k: "p", id: key, meta, chg: true, ask: true }); emit(); },
          leave: () => { bc.postMessage({ k: "l", id: key }); clearInterval(hb); bc.close(); }
        };
      }
    };
  }

  return { supabase, local };
})();

/* ---------------- Cœur : salon, tournoi, matchs ---------------- */
const LOBBY_EVENTS = ["etat", "score", "resultat"];
const MATCH_EVENTS = ["p", "k", "h", "g", "st"];
const MAX_TABLES = 2;
const MAX_JOUEURS = 16;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

// Tableau à élimination directe, avec des exemptés au 1er tour si besoin.
function buildBracket(players) {
  const p = shuffle(players);
  const n = p.length;
  let size = 2;
  while (size < n) size *= 2;
  const byes = size - n;
  const mk = (r, k, a, b) => ({ id: `r${r}m${k}`, r, k, a, b, sa: 0, sb: 0, st: "attente", table: null, w: null, f: false, bye: false });
  const half = size / 2;
  // Exemptions réparties sur le tableau pour éviter que deux exemptés se croisent tout de suite.
  const byeSlots = new Set(Array.from({ length: byes }, (_, i) => Math.floor((i * half) / byes)));
  const first = [];
  let idx = 0;
  for (let k = 0; k < half; k++) {
    if (byeSlots.has(k)) first.push(mk(0, k, p[idx++], null));
    else { first.push(mk(0, k, p[idx], p[idx + 1])); idx += 2; }
  }
  const rounds = [first];
  for (let r = 1, cnt = half / 2; cnt >= 1; r++, cnt /= 2) {
    rounds.push(Array.from({ length: cnt }, (_, k) => mk(r, k, null, null)));
  }
  return rounds;
}

function roundName(r, total) {
  const fromEnd = total - 1 - r;
  return ["Finale", "Demi-finales", "Quarts de finale", "8es de finale"][fromEnd] || `Tour ${r + 1}`;
}

function genCode() {
  let c = "";
  for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return c;
}

function cleanName(s) {
  return String(s || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 16) || "Anonyme";
}

/* createSalon : une instance = un appareil connecté.
   opts = { transport, me: {id, nom}, onChange, now } */
function createSalon(opts) {
  const T = opts.transport;
  const now = opts.now || (() => Date.now());
  const me = { id: opts.me.id, nom: cleanName(opts.me.nom) };
  const onChange = opts.onChange || (() => {});

  const S = {
    me, code: null, isHost: false,
    status: "idle",            // idle | connecting | in | error | closed
    error: "",
    presence: [],
    etat: null,                // dernier état publié par l'hôte
    match: null,               // match en cours sur cet appareil
    lastMatchId: null,
    hostSeenAt: 0,
    lobby: null,
    H: null                    // données d'organisation (hôte seulement)
  };

  const changed = () => onChange(S);
  const online = (id) => S.presence.some((p) => p.id === id);

  /* ----- Envoi sur le salon (l'hôte se « livre » aussi ses propres messages) ----- */
  function sendLobby(event, payload) {
    const msg = { ...payload, from: me.id };
    if (S.lobby) S.lobby.send(event, msg);
    if (S.isHost) onLobbyMessage(event, msg);
  }

  /* ----- Connexion ----- */
  async function openLobby(code, host) {
    S.code = code;
    S.lobby = await T.channel(`porlolo-salon-${code}`, {
      key: me.id,
      events: LOBBY_EVENTS,
      onBroadcast: onLobbyMessage,
      onPresence: onPresence
    });
    await S.lobby.track({ nom: me.nom, host, t: now() });
  }

  async function create() {
    S.status = "connecting"; S.error = ""; changed();
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        const code = genCode();
        S.isHost = false;
        await openLobby(code, false);
        await wait(1200);
        if (S.presence.some((p) => p.host && p.id !== me.id)) { S.lobby.leave(); S.lobby = null; continue; }
        S.isHost = true;
        await S.lobby.track({ nom: me.nom, host: true, t: now() });
        S.H = { phase: "attente", hoteJoue: true, cible: 3, rounds: null, champion: null, live: {}, offSince: {}, v: 0 };
        S.status = "in";
        publish();
        return;
      }
      throw new Error("Impossible de trouver un code libre");
    } catch (e) {
      S.status = "error"; S.error = "Connexion impossible au serveur de jeu. Réessaie dans un instant."; changed();
    }
  }

  async function join(code) {
    code = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length !== 4) { S.status = "error"; S.error = "Le code fait 4 caractères (ex : BZK4)."; changed(); return; }
    S.status = "connecting"; S.error = ""; S.isHost = false; changed();
    try {
      await openLobby(code, false);
      const t0 = now();
      while (now() - t0 < 6000 && !S.presence.some((p) => p.host)) await wait(200);
      if (!S.presence.some((p) => p.host)) {
        await leave(true);
        S.status = "error"; S.error = `Aucun salon « ${code} » en ce moment. Vérifie le code avec l'hôte.`; changed();
        return;
      }
      S.hostSeenAt = now();
      S.status = "in"; changed();
    } catch (e) {
      S.status = "error"; S.error = "Connexion impossible au serveur de jeu. Réessaie dans un instant."; changed();
    }
  }

  async function leave(silent) {
    if (S.match) S.match.close();
    S.match = null;
    if (S.lobby) { try { S.lobby.leave(); } catch (e) { /* ignoré */ } }
    S.lobby = null; S.code = null; S.isHost = false; S.H = null; S.etat = null; S.presence = [];
    S.status = "idle";
    if (!silent) changed();
  }

  /* ----- Présence ----- */
  function onPresence(list) {
    S.presence = list
      .map((p) => ({ id: String(p.id), nom: cleanName(p.nom), host: !!p.host, t: Number(p.t) || 0 }))
      .sort((a, b) => a.t - b.t);
    if (S.presence.some((p) => p.host)) S.hostSeenAt = now();
    if (S.isHost) {
      const H = S.H;
      if (H) {
        S.presence.forEach((p) => { delete H.offSince[p.id]; });
        participants().forEach((p) => { if (!online(p.id) && !H.offSince[p.id]) H.offSince[p.id] = now(); });
        if (H.phase === "tournoi") schedule();
        publish();
      }
    }
    changed();
  }

  /* ----- Hôte : organisation ----- */
  function participants() {
    const H = S.H;
    if (!H) return [];
    if (H.phase === "attente") {
      return S.presence.filter((p) => H.hoteJoue || p.id !== me.id).slice(0, MAX_JOUEURS).map((p) => ({ id: p.id, nom: p.nom }));
    }
    const ids = new Map();
    (H.rounds || []).flat().forEach((m) => { [m.a, m.b].forEach((x) => { if (x) ids.set(x.id, x); }); });
    return [...ids.values()];
  }

  function publish() {
    const H = S.H;
    if (!H) return;
    H.v++;
    const etat = {
      v: H.v, code: S.code, hostId: me.id, phase: H.phase, hoteJoue: H.hoteJoue, cible: H.cible,
      joueurs: participants(), rounds: H.rounds, champion: H.champion, live: H.live
    };
    S.etat = etat;
    if (S.lobby) S.lobby.send("etat", etat);
    afterEtat();
    changed();
  }

  function setOption(key, value) {
    if (!S.isHost || S.H.phase !== "attente") return;
    if (key === "hoteJoue") S.H.hoteJoue = !!value;
    if (key === "cible" && [3, 5].includes(Number(value))) S.H.cible = Number(value);
    publish();
  }

  function launch() {
    const H = S.H;
    if (!S.isHost || H.phase === "tournoi") return;
    const players = H.phase === "attente" ? participants() : S.presence.filter((p) => H.hoteJoue || p.id !== me.id).map((p) => ({ id: p.id, nom: p.nom }));
    if (players.length < 2) return;
    H.rounds = buildBracket(players.slice(0, MAX_JOUEURS));
    H.phase = "tournoi"; H.champion = null; H.live = {};
    schedule();
    publish();
  }

  function backToLobby() {
    if (!S.isHost) return;
    Object.assign(S.H, { phase: "attente", rounds: null, champion: null, live: {} });
    publish();
  }

  function finishMatch(m, winnerId, sa, sb, forfait) {
    m.st = "fini";
    m.w = winnerId === m.a.id ? m.a : m.b;
    m.sa = sa | 0; m.sb = sb | 0; m.f = !!forfait;
    m.table = null;
    delete S.H.live[m.id];
  }

  // Avance le tableau : exemptés, vainqueurs vers le tour suivant, tables libres, champion.
  function schedule() {
    const H = S.H;
    const rounds = H.rounds;
    if (!rounds) return;
    let again = true;
    while (again) {
      again = false;
      rounds.forEach((round, r) => round.forEach((m) => {
        if (r > 0 && m.st === "attente") {
          const pa = rounds[r - 1][m.k * 2], pb = rounds[r - 1][m.k * 2 + 1];
          if (!m.a && pa.w) m.a = pa.w;
          if (!m.b && pb.w) m.b = pb.w;
        }
        if (m.st === "attente" && r === 0 && m.a && !m.b) {
          m.st = "fini"; m.w = m.a; m.bye = true; again = true;
        }
        // Forfait : joueur hors ligne depuis plus de 25 s
        if (m.st !== "fini" && m.a && m.b) {
          const offA = H.offSince[m.a.id] && now() - H.offSince[m.a.id] > 25000;
          const offB = H.offSince[m.b.id] && now() - H.offSince[m.b.id] > 25000;
          if (offA || offB) {
            const w = offA && !offB ? m.b : !offA && offB ? m.a : (Math.random() < 0.5 ? m.a : m.b);
            finishMatch(m, w.id, m.sa, m.sb, true);
            again = true;
          }
        }
      }));
    }
    const final = rounds[rounds.length - 1][0];
    if (final.st === "fini") {
      H.phase = "fini";
      H.champion = final.w;
      return;
    }
    const busy = new Set(rounds.flat().filter((m) => m.st === "en_cours").map((m) => m.table));
    rounds.flat().forEach((m) => {
      if (m.st !== "attente" || !m.a || !m.b) return;
      if (!online(m.a.id) || !online(m.b.id)) return;
      if (busy.size >= MAX_TABLES) return;
      let t = 1;
      while (busy.has(t)) t++;
      m.st = "en_cours"; m.table = t; m.sa = 0; m.sb = 0;
      busy.add(t);
    });
  }

  /* ----- Messages du salon ----- */
  function onLobbyMessage(event, p) {
    if (!p || typeof p !== "object") return;
    if (event === "etat") {
      if (S.isHost) return;
      if (S.etat && p.v <= S.etat.v && p.hostId === S.etat.hostId) return;
      S.etat = p;
      S.hostSeenAt = now();
      afterEtat();
      changed();
      return;
    }
    if (!S.isHost || !S.H || !S.H.rounds) return;
    const m = S.H.rounds.flat().find((x) => x.id === p.m);
    if (!m || m.st !== "en_cours") return;
    const fromPlayer = p.from === m.a.id || p.from === m.b.id;
    if (!fromPlayer) return;
    if (event === "score") {
      S.H.live[m.id] = [p.sa | 0, p.sb | 0];
      m.sa = p.sa | 0; m.sb = p.sb | 0;
      changed();
    } else if (event === "resultat") {
      const w = p.w === m.a.id || p.w === m.b.id ? p.w : null;
      if (!w) return;
      finishMatch(m, w, p.sa, p.sb, p.f);
      schedule();
      publish();
    }
  }

  /* ----- Côté joueur : suivre son match ----- */
  function myCurrentMatch() {
    const e = S.etat;
    if (!e || !e.rounds) return null;
    return e.rounds.flat().find((m) => m.st === "en_cours" && ((m.a && m.a.id === me.id) || (m.b && m.b.id === me.id))) || null;
  }

  function afterEtat() {
    const m = myCurrentMatch();
    if (m && (!S.match || S.match.matchId !== m.id)) {
      if (S.match) S.match.close();
      S.match = createMatchSession(m);
      S.lastMatchId = m.id;
    }
    // Match terminé (ou annulé) côté hôte : on ferme la session après l'écran de fin.
    if (S.match && !m && !S.match.closing) {
      const sess = S.match;
      const rounds = S.etat && S.etat.rounds;
      const ref = rounds ? rounds.flat().find((x) => x.id === sess.matchId) : null;
      if (!ref || ref.st === "fini") {
        sess.closing = true;
        setTimeout(() => { if (S.match === sess) { sess.close(); S.match = null; changed(); } }, ref ? 3500 : 0);
      }
    }
  }

  /* Match en réseau, autorité partagée :
     - chaque joueur décide de ce qui se passe dans SA moitié (balle, buts) ;
       la balle est « passée » à l'autre quand elle franchit le milieu ;
     - le joueur A mène le déroulé (engagement, compte à rebours, fin) ;
     - chacun envoie la position de ses 4 barres, ~8 fois par seconde. */
  function createMatchSession(m) {
    const iAmA = m.a.id === me.id;
    const team = iAmA ? "r" : "b";
    const oppTeam = iAmA ? "b" : "r";
    const opp = iAmA ? m.b : m.a;
    const LAT = 0.05;                                   // latence estimée (s) pour projeter la balle
    const g = Moteur.create({ target: (S.etat && S.etat.cible) || 3, flow: iAmA, goals: false });
    g.ctrl[oppTeam] = "remote";
    const mid = Moteur.W / 2;
    const inMyHalf = () => (team === "r" ? g.ball.x < mid : g.ball.x >= mid);

    const sess = {
      matchId: m.id, table: m.table, me: team, game: g, opp, iAmA,
      ended: false, closed: false, closing: false, chan: null,
      oppSeen: now(), oppEverSeen: false, oppPresent: false,
      pT: 0, lastSent: null, lastMoving: false, lastFlow: null, resultSent: false,
      remote: null,                                     // barres adverses reçues { o, v, t }
      names: () => [me.nom, opp.nom],
      overlay() {
        if (g.state === "menu") return { big: "TABLE " + (sess.table || ""), small: `En attente de ${opp.nom}…`, color: "#ffc21a" };
        return Moteur.overlayFor(g, team);
      },
      tick(dt, aim) {
        if (sess.closed) return;
        g.aim[team] = aim;
        if (sess.remote) {
          // On prolonge le mouvement des barres adverses pendant le trajet du message.
          const age = Math.min(0.25, (now() - sess.remote.t) / 1000 + LAT);
          Moteur.driveRods(g, oppTeam, sess.remote.o.map((o, i) => o + (sess.remote.v[i] || 0) * age), dt);
        }
        g.goals = g.state === "play" && g.owner === team;
        Moteur.update(g, dt);
        if (!sess.chan) { checkForfeit(); return; }

        // Passage de la balle à l'autre joueur quand elle franchit le milieu.
        if (g.state === "play" && g.owner === team) {
          const crossed = team === "r" ? g.ball.x > mid + 8 : g.ball.x < mid - 8;
          if (crossed) { g.owner = oppTeam; send("h", { b: Moteur.ballState(g) }); }
        }
        // A : on diffuse chaque changement d'état de la partie.
        if (iAmA && g.state !== sess.lastFlow) {
          if (g.state === "play" && sess.lastFlow !== "play") {
            g.owner = g.ball.vx < 0 ? "r" : "b";      // la balle d'engagement part vers celui qui a encaissé
          }
          sess.lastFlow = g.state;
          send("st", Moteur.flowState(g));
        }
        // Nos barres (et la balle si elle est chez nous), ~8 fois par seconde.
        // (8 fois/s quand la balle est chez nous, ~6 fois/s sinon : limite de messages du plan gratuit)
        sess.pT += dt;
        const own = g.state === "play" && g.owner === team;
        if (sess.pT >= (own ? 0.125 : 0.16)) {
          sess.pT = 0;
          const o = Moteur.teamOffsets(g, team);
          const v = Moteur.teamSpeeds(g, team);
          const moving = v.some((x) => Math.abs(x) > 20);
          const moved = !sess.lastSent || o.some((x, i) => Math.abs(x - sess.lastSent[i]) > 3);
          if (own || moved || sess.lastMoving) {
            sess.lastSent = o; sess.lastMoving = moving;
            send("p", { o, v: moving ? v : [0, 0, 0, 0], b: own ? Moteur.ballState(g) : null });
          }
        }
        checkForfeit();
      },
      kick() {
        if (g.state !== "play" && g.state !== "countdown") return;
        // On ne prévient l'adversaire que si le tir peut toucher la balle (économie de messages).
        const useful = Moteur.kickCouldHit(g, team);
        if (Moteur.kickTeam(g, team) && useful) send("k", {});
      },
      onEvent(e) {
        if (e.type === "goal" && !iAmA && g.owner === team && !e.remote) send("g", { team: e.team });
        if (e.type === "goal" && iAmA) sendLobby("score", { m: m.id, sa: g.score.r, sb: g.score.b });
        if (e.type === "over") {
          sess.ended = true;
          if (iAmA && !sess.resultSent) {
            sess.resultSent = true;
            const wId = g.winner === "r" ? m.a.id : m.b.id;
            send("st", Moteur.flowState(g));
            sendLobby("resultat", { m: m.id, w: wId, sa: g.score.r, sb: g.score.b, f: !!e.forfait });
          }
          changed();
        }
      },
      onHidden() { /* pas de pause en multijoueur */ },
      close() {
        sess.closed = true;
        if (sess.chan) { try { sess.chan.leave(); } catch (e) { /* ignoré */ } }
        sess.chan = null;
      }
    };

    function send(ev, payload) { if (sess.chan) sess.chan.send(ev, payload); }

    function checkForfeit() {
      if (sess.ended) return;
      if (sess.oppPresent) sess.oppSeen = now();
      const limit = sess.oppEverSeen ? 12000 : 30000;
      if (now() - sess.oppSeen < limit) return;
      // L'adversaire a disparu : victoire par forfait.
      if (iAmA) { Moteur.forceWin(g, team); return; }
      sess.ended = true;
      g.winner = team; g.state = "over"; g.stateT = 0;
      g.events.push({ type: "over", winner: team, forfait: true });
      if (!sess.resultSent) {
        sess.resultSent = true;
        sendLobby("resultat", { m: m.id, w: me.id, sa: g.score.r, sb: g.score.b, f: true });
      }
    }

    function onMatchMessage(ev, p) {
      if (sess.closed || !p) return;
      sess.oppSeen = now(); sess.oppEverSeen = true;
      if (ev === "p") {
        if (Array.isArray(p.o) && p.o.length === 4) {
          const o = p.o.map(Number);
          const v = Array.isArray(p.v) ? p.v.map((x) => Math.max(-2500, Math.min(2500, Number(x) || 0))) : [0, 0, 0, 0];
          if (o.every(Number.isFinite)) sess.remote = { o, v, t: now() };
        }
        // La balle est chez l'adversaire : on suit sa version.
        if (p.b && g.state === "play" && g.owner !== team) Moteur.setBall(g, p.b, LAT, true);
      } else if (ev === "k") {
        Moteur.kickTeam(g, oppTeam);
      } else if (ev === "h") {
        if (g.state === "play") { g.owner = team; Moteur.setBall(g, p.b, LAT, true); }
      } else if (ev === "g" && iAmA) {
        // But décidé par B (la balle était dans sa moitié).
        if (g.state === "play" && (p.team === "r" || p.team === "b")) Moteur.goalFor(g, p.team);
      } else if (ev === "st" && !iAmA) {
        Moteur.applyFlow(g, p);
      }
    }

    T.channel(`porlolo-match-${S.code}-${m.id}`, {
      key: me.id,
      events: MATCH_EVENTS,
      onBroadcast: onMatchMessage,
      onPresence(list) {
        if (sess.closed) return;
        sess.oppPresent = list.some((p) => String(p.id) === opp.id);
        if (sess.oppPresent) {
          sess.oppSeen = now(); sess.oppEverSeen = true;
          if (iAmA && g.state === "menu") Moteur.start(g);
        }
      }
    }).then((chan) => {
      if (sess.closed) { chan.leave(); return; }
      sess.chan = chan;
      chan.track({ nom: me.nom, t: now() });
    }).catch(() => { /* on réessaiera au prochain état */ });

    return sess;
  }

  /* ----- Minuterie (forfaits, hôte disparu) ----- */
  function tick() {
    if (S.status !== "in") return;
    if (S.isHost && S.H && S.H.phase === "tournoi") {
      const before = JSON.stringify(S.H.rounds);
      schedule();
      if (JSON.stringify(S.H.rounds) !== before || S.H.phase !== "tournoi") publish();
    }
    if (S.presence.some((p) => p.host)) S.hostSeenAt = now();
    if (!S.isHost && now() - S.hostSeenAt > 10000) {
      leave(true);
      S.status = "closed";
      S.error = "L'hôte a quitté le salon. La partie est terminée.";
      changed();
    }
  }

  function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

  return Object.assign(S, { create, join, leave, launch, setOption, backToLobby, tick, participants });
}

/* =========================================================
   Interface du multijoueur (onglet Jouer → Multijoueur)
   ========================================================= */
const Multi = (() => {
  const $id = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let salon = null;
  let transport = null;
  let active = false;
  let lastHtml = "";
  let prefillCode = "";
  let timer = null;

  const cfg = () => window.PORLOLO_CONFIG || {};
  const isLocal = () => /[?&]local=1/.test(location.search);
  const configured = () => isLocal() || (cfg().supabaseUrl && cfg().supabaseKey);

  function myId() {
    try {
      let id = sessionStorage.getItem("porlolo:id");
      if (!id) { id = Math.random().toString(36).slice(2, 10); sessionStorage.setItem("porlolo:id", id); }
      return id;
    } catch (e) { return Math.random().toString(36).slice(2, 10); }
  }
  function myName() { return (typeof S !== "undefined" && S.pseudo) || ""; }
  function saveName(n) { if (typeof S !== "undefined") { S.pseudo = n; if (typeof save === "function") save(); } }

  async function getTransport() {
    if (transport) return transport;
    transport = isLocal() ? Reseau.local() : await Reseau.supabase({ url: cfg().supabaseUrl, key: cfg().supabaseKey });
    return transport;
  }

  async function ensureSalon(nom) {
    const t = await getTransport();
    if (salon && salon.status !== "idle" && salon.status !== "error" && salon.status !== "closed") return salon;
    salon = createSalon({ transport: t, me: { id: myId(), nom }, onChange: render });
    if (!timer) timer = setInterval(() => salon && salon.tick(), 1000);
    return salon;
  }

  function joinUrl(code) { return `${location.origin}${location.pathname}#jouer?salon=${code}`; }

  /* ----- Rendu ----- */
  function render() {
    if (!active) return;
    let html;
    if (!configured()) html = viewNotConfigured();
    else if (!salon || salon.status === "idle") html = viewHome();
    else if (salon.status === "connecting") html = `<div class="panel"><p class="loading">Connexion au salon…</p></div>`;
    else if (salon.status === "error" || salon.status === "closed") html = viewError();
    else html = viewSalon();

    if (html !== lastHtml) {
      const focused = document.activeElement && document.activeElement.id;
      $id("multiBody").innerHTML = html;
      lastHtml = html;
      if (focused && $id(focused)) $id(focused).focus();
      if (salon && salon.isHost && salon.code) drawQr(salon.code);
    }

    // Table de jeu : visible seulement pendant un match
    const sess = salon && salon.match;
    if (sess && Jeu.session !== sess) {
      Jeu.setSession(sess);
      Jeu.comment(`Table ${sess.table || ""} : toi contre ${sess.opp.nom}. Premier à ${sess.game.target} buts. Reste sur cet onglet !`);
      $id("gameWrap").scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (!sess && Jeu.session && Jeu.session.matchId) Jeu.setSession(null);
  }

  function viewNotConfigured() {
    return `<div class="panel"><h3>Multijoueur bientôt disponible</h3>
      <p class="muted">Le serveur de jeu n'est pas encore branché. Reviens un peu plus tard !</p></div>`;
  }

  function viewHome() {
    const nom = esc(myName());
    return `<div class="multi-home">
      <div class="panel">
        <h3>Ton pseudo</h3>
        <input type="text" id="mPseudo" class="m-input" maxlength="16" placeholder="ex : Lolo le retour" value="${nom}" autocomplete="nickname">
        <p class="muted small">Pas de compte : juste un pseudo pour que les autres te reconnaissent.</p>
      </div>
      <div class="multi-cards">
        <div class="panel">
          <h3>🎉 Créer un salon</h3>
          <p class="muted">Tu obtiens un code à donner à tes potes. Ton écran affiche les joueurs et le tableau du tournoi.</p>
          <button type="button" class="btn btn-primary" data-m="create">Créer un salon</button>
        </div>
        <div class="panel">
          <h3>🔑 Rejoindre un salon</h3>
          <p class="muted">Entre le code affiché sur l'écran de l'hôte.</p>
          <div class="join-line">
            <input type="text" id="mCode" class="m-input code-input" maxlength="4" placeholder="CODE" value="${esc(prefillCode)}" autocapitalize="characters" autocomplete="off">
            <button type="button" class="btn btn-primary" data-m="join">Rejoindre</button>
          </div>
        </div>
      </div>
      <p class="form-msg err" id="mMsg"></p>
    </div>`;
  }

  function viewError() {
    return `<div class="panel"><h3>Oups</h3><p>${esc(salon.error)}</p>
      <button type="button" class="btn btn-primary" data-m="home">Retour</button></div>`;
  }

  function playerChips(list, hostId) {
    if (!list.length) return `<p class="muted">Personne pour l'instant…</p>`;
    return `<ul class="players">${list.map((p) =>
      `<li class="player${p.id === salon.me.id ? " me" : ""}">${esc(p.nom)}${p.id === hostId ? " <small>(hôte)</small>" : ""}${p.id === salon.me.id ? " <small>(toi)</small>" : ""}</li>`
    ).join("")}</ul>`;
  }

  function viewSalon() {
    const e = salon.etat;
    if (!e) return `<div class="panel"><p class="loading">Salon ${esc(salon.code)} : on attend les infos de l'hôte…</p></div>`;
    const header = `<div class="salon-head">
      <span>Salon <strong>${esc(e.code)}</strong></span>
      <button type="button" class="btn btn-ghost small-btn" data-m="leave">Quitter</button></div>`;

    if (e.phase === "attente") {
      if (salon.isHost) {
        const n = e.joueurs.length;
        const label = n < 2 ? "Il faut au moins 2 joueurs" : n === 2 ? "Lancer le match" : `Lancer le tournoi (${n} joueurs)`;
        return `${header}<div class="salon-host">
          <div class="panel code-panel">
            <p class="muted">Code du salon</p>
            <p class="salon-code">${esc(e.code)}</p>
            <div id="qr" class="qr" aria-label="QR code pour rejoindre"></div>
            <p class="small">Sur <strong>porlolo-el-nulo.vercel.app</strong> → Jouer → Multijoueur, ou scanne le QR code.</p>
            <button type="button" class="btn btn-ghost small-btn" data-m="copy">📋 Copier le lien</button>
          </div>
          <div class="panel">
            <h3>Joueurs (${n}${n >= MAX_JOUEURS ? ", complet" : ""})</h3>
            ${playerChips(salon.presence.filter((p) => e.hoteJoue || p.id !== salon.me.id), e.hostId)}
            <div class="host-opts">
              <label class="toggle"><input type="checkbox" id="mHostPlays" ${e.hoteJoue ? "checked" : ""}> Je joue aussi</label>
              <label>Matchs en
                <select id="mTarget"><option value="3" ${e.cible === 3 ? "selected" : ""}>3 buts</option><option value="5" ${e.cible === 5 ? "selected" : ""}>5 buts</option></select>
              </label>
            </div>
            <button type="button" class="btn btn-primary" data-m="launch" ${n < 2 ? "disabled" : ""}>${label}</button>
            <p class="muted small">2 joueurs = un match. De 3 à 16 = tournoi à élimination directe (tirage au sort). ${MAX_TABLES} tables en même temps, les autres matchs attendent leur tour.</p>
          </div>
        </div>`;
      }
      return `${header}<div class="panel">
        <h3>Tu es dans le salon ✓</h3>
        <p>On attend que l'hôte lance la partie. Prépare tes poignets.</p>
        ${playerChips(salon.presence.filter((p) => e.hoteJoue || p.id !== e.hostId), e.hostId)}
      </div>`;
    }

    // Tournoi en cours ou terminé
    return `${header}${statusCard(e)}${bracketView(e)}${salon.isHost && e.phase === "fini"
      ? `<div class="btn-row"><button type="button" class="btn btn-primary" data-m="again">Nouveau tournoi avec les mêmes joueurs</button></div>` : ""}`;
  }

  function statusCard(e) {
    const meId = salon.me.id;
    const all = e.rounds.flat();
    if (e.phase === "fini") {
      const champ = e.champion;
      const isMe = champ && champ.id === meId;
      return `<div class="panel champion"><p class="champ-cup">🏆</p>
        <h3>${isMe ? "Tu es le champion du bar !" : `${esc(champ ? champ.nom : "?")} est champion du bar !`}</h3>
        <p class="muted">${isMe ? "Lolo s'incline. Profite, ça ne durera pas." : "Les autres : direction l'onglet Techniques."}</p></div>`;
    }
    const playing = e.joueurs.some((p) => p.id === meId);
    if (!playing) {
      const live = all.filter((m) => m.st === "en_cours");
      return `<div class="panel"><h3>${salon.isHost ? "Écran de l'hôte" : "Tu regardes le tournoi"}</h3>
        <p class="muted">${live.length ? live.map((m) => `Table ${m.table} : ${esc(m.a.nom)} ${liveScore(e, m)} ${esc(m.b.nom)}`).join(" · ") : "Les matchs vont commencer…"}</p></div>`;
    }
    const mine = all.filter((m) => (m.a && m.a.id === meId) || (m.b && m.b.id === meId));
    const lost = mine.some((m) => m.st === "fini" && m.w && m.w.id !== meId);
    if (lost) return `<div class="panel"><h3>Éliminé…</h3><p class="muted">Lolo te console. Tu peux suivre la suite du tournoi ci-dessous.</p></div>`;
    const cur = mine.find((m) => m.st === "en_cours");
    if (cur) {
      const opp = cur.a.id === meId ? cur.b : cur.a;
      return `<div class="panel live"><h3>À toi de jouer ! Table ${cur.table}</h3><p>Contre <strong>${esc(opp.nom)}</strong>. La table est juste en dessous.</p></div>`;
    }
    const next = mine.find((m) => m.st === "attente");
    if (next) {
      const opp = next.a && next.a.id === meId ? next.b : next.a;
      return `<div class="panel"><h3>Qualifié ✓</h3><p class="muted">${opp ? `Prochain match contre <strong>${esc(opp.nom)}</strong> dès qu'une table se libère.` : "Ton prochain adversaire n'est pas encore connu."}</p></div>`;
    }
    return "";
  }

  function liveScore(e, m) {
    const l = e.live && e.live[m.id];
    return l ? `${l[0]} - ${l[1]}` : "vs";
  }

  function bracketView(e) {
    const meId = salon.me.id;
    const total = e.rounds.length;
    const name = (p, m, side) => {
      if (p) return `${esc(p.nom)}${p.id === meId ? " (toi)" : ""}`;
      if (m.bye && side === "b") return "<em>exempté</em>";
      return "<em>à déterminer</em>";
    };
    const live = (m) => (salon.isHost && salon.H && salon.H.live[m.id]) || (e.live && e.live[m.id]) || null;
    return `<div class="panel"><h3>Tableau</h3><div class="bracket">${e.rounds.map((round, r) => `
      <div class="b-round"><p class="b-title">${roundName(r, total)}</p>
        ${round.map((m) => {
          const l = live(m);
          const sa = m.st === "fini" ? m.sa : l ? l[0] : "";
          const sb = m.st === "fini" ? m.sb : l ? l[1] : "";
          const st = m.st === "en_cours" ? `Table ${m.table} · en cours` : m.st === "fini" ? (m.bye ? "Qualifié d'office" : m.f ? "Forfait" : "Terminé") : "À venir";
          const mine = (m.a && m.a.id === meId) || (m.b && m.b.id === meId);
          return `<div class="bm st-${m.st}${mine ? " mine" : ""}">
            <div class="bm-p${m.w && m.a && m.w.id === m.a.id ? " win" : ""}"><span>${name(m.a, m, "a")}</span><b>${m.bye ? "" : sa}</b></div>
            <div class="bm-p${m.w && m.b && m.w.id === m.b.id ? " win" : ""}"><span>${name(m.b, m, "b")}</span><b>${m.bye ? "" : sb}</b></div>
            <div class="bm-st">${st}</div></div>`;
        }).join("")}
      </div>`).join("")}</div></div>`;
  }

  function drawQr(code) {
    const box = $id("qr");
    if (!box || box.dataset.code === code) return;
    const make = () => {
      try {
        const qr = window.qrcode(0, "M");
        qr.addData(joinUrl(code));
        qr.make();
        box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
        box.dataset.code = code;
      } catch (e) { box.hidden = true; }
    };
    if (window.qrcode) return make();
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
    s.onload = make;
    s.onerror = () => { box.hidden = true; };
    document.head.appendChild(s);
  }

  /* ----- Actions ----- */
  function pseudoOrAsk() {
    const input = $id("mPseudo");
    const nom = cleanName(input ? input.value : myName());
    if (!input || !input.value.trim()) {
      const msg = $id("mMsg");
      if (msg) msg.textContent = "Choisis d'abord un pseudo (même « Lolo », on ne juge pas).";
      if (input) input.focus();
      return null;
    }
    saveName(nom);
    return nom;
  }

  async function onClick(e) {
    const b = e.target.closest("[data-m]");
    if (!b) return;
    const a = b.dataset.m;
    try {
      if (a === "create") {
        const nom = pseudoOrAsk(); if (!nom) return;
        await ensureSalon(nom); await salon.create();
      } else if (a === "join") {
        const nom = pseudoOrAsk(); if (!nom) return;
        const code = ($id("mCode").value || "").trim();
        prefillCode = code.toUpperCase();
        await ensureSalon(nom); await salon.join(code);
      } else if (a === "leave") {
        if (salon.isHost && !confirm("Fermer le salon ? La partie s'arrêtera pour tout le monde.")) return;
        if (!salon.isHost && salon.match && !salon.match.ended && !confirm("Quitter pendant ton match ? Tu perdras par forfait.")) return;
        await salon.leave();
      } else if (a === "home") {
        await salon.leave();
      } else if (a === "launch") salon.launch();
      else if (a === "again") salon.backToLobby();
      else if (a === "copy") {
        const url = joinUrl(salon.code);
        try { await navigator.clipboard.writeText(url); b.textContent = "✓ Lien copié"; }
        catch (err) { prompt("Copie ce lien :", url); }
      }
    } catch (err) {
      const msg = $id("mMsg");
      if (msg) msg.textContent = "Connexion impossible au serveur de jeu. Vérifie ta connexion et réessaie.";
    }
    render();
  }

  function onChangeInput(e) {
    if (!salon || !salon.isHost) return;
    if (e.target.id === "mHostPlays") salon.setOption("hoteJoue", e.target.checked);
    if (e.target.id === "mTarget") salon.setOption("cible", e.target.value);
  }

  let bound = false;
  function bind() {
    if (bound) return;
    bound = true;
    $id("multiBody").addEventListener("click", onClick);
    $id("multiBody").addEventListener("change", onChangeInput);
    $id("multiBody").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.id === "mCode") { e.preventDefault(); $id("multiBody").querySelector('[data-m="join"]').click(); }
    });
    $id("multiBody").addEventListener("input", (e) => {
      if (e.target.id === "mCode") { e.target.value = e.target.value.toUpperCase(); prefillCode = e.target.value; }
    });
    window.addEventListener("beforeunload", () => { if (salon && salon.lobby) salon.leave(true); });
  }

  return {
    activate() {
      active = true;
      bind();
      lastHtml = "";
      if (!(salon && salon.match)) Jeu.setSession(null);
      render();
    },
    deactivate() { active = false; },
    prefill(code) {
      prefillCode = String(code).toUpperCase().slice(0, 4);
      lastHtml = "";
      render();
    },
    inSalon() { return !!(salon && salon.status === "in"); },
    leaveSalon() { if (salon) salon.leave(true); }
  };
})();

if (typeof module !== "undefined") module.exports = { createSalon, buildBracket, roundName };
