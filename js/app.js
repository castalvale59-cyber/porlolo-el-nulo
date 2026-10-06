/* =========================================================
   PorLolo el nulo — logique du site
   Navigation par onglets (#hash), sauvegarde locale, rendu.
   ========================================================= */

/* ---------------- Sauvegarde ---------------- */
const KEY = "porlolo:v1";
const defaults = () => ({ niveau: 1, maitrise: {}, seances: {}, quizBest: 0, sessions: [], prog: null, jeu: {} });

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return Object.assign(defaults(), JSON.parse(raw));
  } catch (e) { /* stockage indisponible : on repart de zéro */ }
  return defaults();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignoré */ }
}
let S = load();

/* ---------------- Utilitaires ---------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= 0 ? n : 0; };
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const frDate = (d) => d.split("-").reverse().join("/");
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const niveauInfo = (n) => NIVEAUX.find((x) => x.n === n) || NIVEAUX[0];
const catInfo = (id) => CATEGORIES.find((c) => c.id === id);
const nbMaitrise = () => TECHNIQUES.filter((t) => S.maitrise[t.id]).length;
const seancesFaites = () => Object.keys(S.seances).filter((k) => S.seances[k]).length;
const progFaites = (p) => Object.keys(S.seances).filter((k) => S.seances[k] && k.startsWith(p.id + ":")).length;
const matchs = () => S.sessions.filter((s) => s.type === "Match" && (s.pour || s.contre));
const victoires = () => matchs().filter((s) => s.pour > s.contre).length;
const progConseille = () => PROGRAMMES.find((p) => p.niveaux.includes(S.niveau)) || PROGRAMMES[0];

/* Indice de nullité : 100 % = Lolo, 0 % = légende.
   70 % techniques (pondérées par difficulté), 20 % séances, 10 % quiz. */
function nuloScore() {
  const totalW = TECHNIQUES.reduce((a, t) => a + t.niveau, 0);
  const doneW = TECHNIQUES.filter((t) => S.maitrise[t.id]).reduce((a, t) => a + t.niveau, 0);
  const progres = (doneW / totalW) * 0.7 + Math.min(1, seancesFaites() / 12) * 0.2 + (S.quizBest / QUIZ.length) * 0.1;
  return Math.round(100 - progres * 100);
}
function rangNulo(score) {
  let r = RANGS_NULO[0];
  RANGS_NULO.forEach((x) => { if (score <= x.max) r = x; });
  return r;
}

/* ---------------- Vannes ---------------- */
function startTicker() {
  const el = $("#vanne");
  let i = Math.floor(Math.random() * VANNES.length);
  el.textContent = VANNES[i];
  setInterval(() => {
    el.classList.add("fade");
    setTimeout(() => {
      i = (i + 1) % VANNES.length;
      el.textContent = VANNES[i];
      el.classList.remove("fade");
    }, 300);
  }, 7000);
}

/* ---------------- Navigation ---------------- */
const VIEWS = ["accueil", "techniques", "programme", "progression", "regles", "quiz", "jouer"];
const RENDER = {
  accueil: renderAccueil,
  techniques: renderTechniques,
  programme: renderProgramme,
  progression: renderProgression,
  regles: renderRegles,
  quiz: renderQuiz,
  jouer: (params) => Jeu.show(params)
};

function route() {
  // Le hash peut porter des paramètres : #jouer?salon=BZK4
  const [name, query = ""] = location.hash.slice(1).split("?");
  const params = Object.fromEntries(new URLSearchParams(query));
  const v = VIEWS.includes(name) ? name : "accueil";
  document.querySelectorAll(".view").forEach((s) => { s.hidden = s.dataset.view !== v; });
  document.querySelectorAll("[data-nav]").forEach((a) => {
    if (a.dataset.nav === v) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  if (v !== "jouer") Jeu.hide();
  RENDER[v](params);
  window.scrollTo({ top: 0 });
}

/* ================= ACCUEIL ================= */
function renderAccueil() {
  const slider = $("#niveau");
  slider.value = S.niveau;
  const ticks = $("#rodTicks");
  ticks.innerHTML = NIVEAUX.map((n) => `<button type="button" data-lvl="${n.n}" class="${n.n === S.niveau ? "on" : ""}">${esc(n.court)}</button>`).join("");
  const info = niveauInfo(S.niveau);
  $("#niveauNom").textContent = `${info.n}. ${info.nom}`;
  $("#niveauDesc").textContent = info.desc;

  const aMonNiveau = TECHNIQUES.filter((t) => t.niveau <= S.niveau).length;
  const score = nuloScore();
  const p = progConseille();
  $("#homeStats").innerHTML = `
    <a class="stat" href="#programme"><p class="stat-label">Programme conseillé</p><p class="stat-value">${esc(p.nom)}</p><p class="stat-sub">${progFaites(p)}/12 séances faites</p></a>
    <a class="stat" href="#techniques"><p class="stat-label">Techniques à ton niveau</p><p class="stat-value">${aMonNiveau}</p><p class="stat-sub">sur ${TECHNIQUES.length} au total</p></a>
    <a class="stat" href="#progression"><p class="stat-label">Techniques maîtrisées</p><p class="stat-value">${nbMaitrise()}</p><p class="stat-sub">Coche-les dans Techniques</p></a>
    <a class="stat" href="#progression"><p class="stat-label">Nulomètre</p><p class="stat-value">${score} %</p><p class="stat-sub">${esc(rangNulo(score).nom)}</p></a>`;
}

function setNiveau(n) {
  S.niveau = Math.min(5, Math.max(1, n));
  S.prog = null; // le programme suit le nouveau niveau
  save();
  renderAccueil();
}

/* ================= TECHNIQUES ================= */
const F = { cat: "", q: "", poste: "", mine: false };

const RODS = [
  { k: "g", x: 28.75, n: 1, t: "r" }, { k: "d", x: 66.25, n: 2, t: "r" },
  { k: "A", x: 103.75, n: 3, t: "b" }, { k: "m", x: 141.25, n: 5, t: "r" },
  { k: "M", x: 178.75, n: 5, t: "b" }, { k: "a", x: 216.25, n: 3, t: "r" },
  { k: "D", x: 253.75, n: 2, t: "b" }, { k: "G", x: 291.25, n: 1, t: "b" }
];
const YS = { 1: [90], 2: [58, 122], 3: [42, 90, 138], 5: [26, 58, 90, 122, 154] };

function diagSVG(d, uid, dur = 2.6) {
  const hl = new Set(d.hl || []);
  const up = new Set(d.up || []);
  const shift = d.shift || {};
  let s = `<svg viewBox="0 0 320 180" role="img" aria-label="Schéma vu de dessus : trajet de la balle">
    <defs><marker id="arr-${uid}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#ffc21a"/></marker></defs>
    <rect class="d-frame" x="0" y="0" width="320" height="180" rx="12"/>
    <rect class="d-felt" x="10" y="10" width="300" height="160" rx="4"/>
    <line class="d-line" x1="160" y1="10" x2="160" y2="170"/>
    <circle class="d-line" cx="160" cy="90" r="20"/>
    <rect class="d-line" x="10" y="58" width="22" height="64"/>
    <rect class="d-line" x="288" y="58" width="22" height="64"/>
    <rect class="d-goal" x="3" y="65" width="7" height="50" rx="1"/>
    <rect class="d-goal" x="310" y="65" width="7" height="50" rx="1"/>`;
  RODS.forEach((r) => {
    s += `<line class="d-rod${hl.has(r.k) ? " hl" : ""}" x1="${r.x}" y1="2" x2="${r.x}" y2="178"/>`;
    const off = shift[r.k] || 0;
    YS[r.n].forEach((y0) => {
      const y = Math.min(162, Math.max(18, y0 + off));
      const cls = `d-p-${r.t}${up.has(r.k) ? " d-up" : ""}`;
      s += up.has(r.k)
        ? `<rect class="${cls}" x="${r.x - 8}" y="${y - 3}" width="16" height="6" rx="2"/>`
        : `<rect class="${cls}" x="${r.x - 4}" y="${y - 6}" width="8" height="12" rx="2"/>`;
    });
  });
  if (d.path && d.path.length > 1) {
    const pts = d.path.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" ");
    const [x0, y0] = d.path[0];
    s += `<path class="d-path" d="${pts}" marker-end="url(#arr-${uid})"/>`;
    s += `<circle class="d-ball-ghost" cx="${x0}" cy="${y0}" r="4.5"/>`;
    s += reduceMotion
      ? `<circle class="d-ball" cx="${x0}" cy="${y0}" r="4.5"/>`
      : `<circle class="d-ball" r="4.5"><animateMotion dur="${dur}s" repeatCount="indefinite" path="${pts}" keyPoints="0;1;1" keyTimes="0;0.7;1" calcMode="linear"/></circle>`;
  }
  s += `</svg>`;
  const cap = up.size ? "Barres jaunes : celles qui jouent. Joueurs pâles : barres relevées." : "Barres jaunes : celles qui jouent. La balle montre le trajet.";
  return `<div class="diag">${s}<p class="diag-cap">${cap}</p></div>`;
}

function matchPoste(t, poste) {
  if (!poste) return true;
  return t.poste === "Tous" || t.poste.toLowerCase().includes(poste.toLowerCase());
}

function techCard(t) {
  const cat = catInfo(t.cat);
  const lvl = niveauInfo(t.niveau);
  const done = !!S.maitrise[t.id];
  const tropTot = t.niveau > S.niveau + 1;
  return `<article class="tech${done ? " done" : ""}" data-id="${t.id}">
    <div class="tech-head">
      <div class="tech-meta">
        <span class="tag">${cat.emoji} ${esc(cat.nom)}</span>
        <span class="tag tag-lvl">Niv. ${t.niveau} · ${esc(lvl.court)}</span>
        <span class="tag">${esc(t.poste)}</span>
        ${done ? `<span class="tag tag-ok">Maîtrisée</span>` : tropTot ? `<span class="tag tag-warn">Trop tôt, Lolo</span>` : ""}
      </div>
      <h3>${esc(t.nom)}</h3>
    </div>
    <p class="tech-resume">${esc(t.resume)}</p>
    ${t.diag ? `<div class="tech-diag" data-zoom="${t.id}" title="Cliquer pour agrandir">
      ${diagSVG(t.diag, t.id)}
      <button type="button" class="zoom-btn" data-zoom="${t.id}" aria-label="Agrandir le schéma : ${esc(t.nom)}">⤢ Agrandir</button>
    </div>` : ""}
    <details>
      <summary>Comment faire</summary>
      <div class="tech-body">
        <h4>Étape par étape</h4>
        <ol>${t.etapes.map((e) => `<li>${esc(e)}</li>`).join("")}</ol>
        <h4>Les erreurs à la Lolo</h4>
        <ul class="lolo-errors">${t.erreurs.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
        <div class="callout"><strong>Spécial Bonzini</strong>${esc(t.bonzini)}</div>
        <div class="callout exo"><strong>Exercice</strong>${esc(t.exo)}</div>
      </div>
    </details>
    <div class="tech-foot">
      <label class="master"><input type="checkbox" data-master="${t.id}" ${done ? "checked" : ""}> Je maîtrise cette technique</label>
    </div>
  </article>`;
}

function renderTechniques() {
  $("#catChips").innerHTML =
    `<button type="button" class="chip" data-cat="" aria-pressed="${F.cat === ""}">Toutes</button>` +
    CATEGORIES.map((c) => `<button type="button" class="chip" data-cat="${c.id}" aria-pressed="${F.cat === c.id}">${c.emoji} ${esc(c.nom)}</button>`).join("");
  $("#search").value = F.q;
  $("#posteFilter").value = F.poste;
  $("#monNiveau").checked = F.mine;
  renderTechList();
}

function renderTechList() {
  const q = F.q.trim().toLowerCase();
  const list = TECHNIQUES.filter((t) =>
    (!F.cat || t.cat === F.cat) &&
    matchPoste(t, F.poste) &&
    (!F.mine || t.niveau <= S.niveau) &&
    (!q || (t.nom + " " + t.resume + " " + t.etapes.join(" ")).toLowerCase().includes(q))
  );
  const nb = list.length;
  $("#techCount").textContent = `${nb} technique${nb > 1 ? "s" : ""} · ${nbMaitrise()} maîtrisée${nbMaitrise() > 1 ? "s" : ""} sur ${TECHNIQUES.length}`;
  $("#techGrid").innerHTML = nb
    ? list.map(techCard).join("")
    : `<p class="empty">Aucune technique trouvée. Même Lolo trouverait mieux. Change tes filtres.</p>`;
}

/* Agrandir un schéma dans une fenêtre, avec réglage de la vitesse */
const Z = { id: null, dur: 2.6 };

function renderZoom() {
  const t = TECHNIQUES.find((x) => x.id === Z.id);
  $("#zoomTitle").textContent = t.nom;
  $("#zoomResume").textContent = t.resume;
  $("#zoomDiag").innerHTML = diagSVG(t.diag, t.id + "-big", Z.dur);
  document.querySelectorAll("[data-speed]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.speed) === Z.dur)));
}

function openZoom(id) {
  Z.id = id;
  renderZoom();
  const dlg = $("#zoom");
  if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
}

function closeZoom() {
  const dlg = $("#zoom");
  if (typeof dlg.close === "function") dlg.close(); else dlg.removeAttribute("open");
  $("#zoomDiag").innerHTML = "";
}

/* ================= PROGRAMME ================= */
function renderProgramme() {
  const conseille = progConseille();
  const sel = PROGRAMMES.find((p) => p.id === S.prog) || conseille;

  $("#progTabs").innerHTML = PROGRAMMES.map((p) => {
    const lv = p.niveaux.map((n) => niveauInfo(n).court).join(" / ");
    return `<button type="button" class="chip" role="tab" data-prog="${p.id}" aria-selected="${p.id === sel.id}">${esc(p.nom)} <small>(${esc(lv)})${p.id === conseille.id ? " ★" : ""}</small></button>`;
  }).join("");

  const openWeeks = new Set([...document.querySelectorAll("#progBody .week[open]")].map((d) => d.dataset.week));
  const faites = progFaites(sel);
  // Par défaut, on ouvre la première semaine pas terminée.
  let firstTodo = sel.semaines.findIndex((w, wi) => w.seances.some((_, si) => !S.seances[`${sel.id}:${wi}:${si}`]));
  if (firstTodo < 0) firstTodo = 0;
  const keepOpen = openWeeks.size && $("#progBody").dataset.prog === sel.id;

  $("#progBody").dataset.prog = sel.id;
  $("#progBody").innerHTML = `
    <p class="prog-pitch">${esc(sel.pitch)}</p>
    <div class="panel">
      <p class="progress-label"><span>Progression du programme</span><strong>${faites} / 12 séances</strong></p>
      <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="12" aria-valuenow="${faites}"><span style="width:${pct(faites, 12)}%"></span></div>
    </div>
    ${sel.semaines.map((w, wi) => {
      const nbW = w.seances.filter((_, si) => S.seances[`${sel.id}:${wi}:${si}`]).length;
      const open = keepOpen ? openWeeks.has(String(wi)) : wi === firstTodo;
      return `<details class="week" data-week="${wi}" ${open ? "open" : ""}>
        <summary>
          <span class="week-title">${esc(w.titre)}</span>
          <span class="week-badge${nbW === w.seances.length ? " full" : ""}">${nbW}/${w.seances.length}</span>
          <span class="week-obj">${esc(w.objectif)}</span>
        </summary>
        <div class="sessions">
          ${w.seances.map((se, si) => {
            const key = `${sel.id}:${wi}:${si}`;
            const done = !!S.seances[key];
            return `<div class="seance${done ? " done" : ""}">
              <strong>${esc(se.titre)}</strong>
              <ul>${se.exos.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
              <button type="button" class="btn ${done ? "btn-ghost" : "btn-primary"}" data-seance="${key}">${done ? "✓ Séance faite" : "Marquer comme faite"}</button>
            </div>`;
          }).join("")}
        </div>
      </details>`;
    }).join("")}`;
}

/* ================= PROGRESSION ================= */
const BADGES = [
  { ico: "👣", nom: "Premier pas", how: "1 technique maîtrisée", ok: () => nbMaitrise() >= 1 },
  { ico: "🚫", nom: "Désintox", how: "Maîtriser « Bannir la roulette »", ok: () => S.maitrise.roulette },
  { ico: "🧲", nom: "Main de velours", how: "Maîtriser la pince", ok: () => S.maitrise.pince },
  { ico: "🎯", nom: "Sniper", how: "Maîtriser push et pull", ok: () => S.maitrise.push && S.maitrise.pull },
  { ico: "🧱", nom: "Mur de Berlin", how: "Mur, gardien et défense à l'ombre", ok: () => S.maitrise.mur && S.maitrise.gardien && S.maitrise.ombre },
  { ico: "🐍", nom: "Charmeur de snake", how: "Maîtriser le snake", ok: () => S.maitrise.snake },
  { ico: "📅", nom: "Assidu", how: "6 séances de programme faites", ok: () => seancesFaites() >= 6 },
  { ico: "🏁", nom: "Programme bouclé", how: "Finir un programme (12 séances)", ok: () => PROGRAMMES.some((p) => progFaites(p) >= 12) },
  { ico: "📊", nom: "Statisticien", how: "Noter 5 séances ou matchs", ok: () => S.sessions.length >= 5 },
  { ico: "🏆", nom: "Vainqueur", how: "Gagner 10 matchs notés", ok: () => victoires() >= 10 },
  { ico: "🧠", nom: "Encyclopédie", how: "Sans faute au quiz", ok: () => S.quizBest >= QUIZ.length },
  { ico: "🤖", nom: "Tombeur de bots", how: "Battre le bot « Habitué du bar »", ok: () => S.jeu && S.jeu[2] && S.jeu[2].v > 0 },
  { ico: "👑", nom: "Tombeur de légende", how: "Battre le bot « Légende Bonzini »", ok: () => S.jeu && S.jeu[3] && S.jeu[3].v > 0 },
  { ico: "😎", nom: "Anti-Lolo", how: "Nulomètre à 20 % ou moins", ok: () => nuloScore() <= 20 }
];

function gaugeSVG(score) {
  const len = Math.PI * 90;
  const color = score > 66 ? "var(--red)" : score > 33 ? "var(--accent)" : "var(--good)";
  return `<div class="gauge">
    <svg viewBox="0 0 220 122" aria-hidden="true">
      <path class="g-track" d="M20 110 A90 90 0 0 1 200 110"/>
      <path class="g-fill" d="M20 110 A90 90 0 0 1 200 110" stroke="${color}" stroke-dasharray="${len}" stroke-dashoffset="${len * (1 - score / 100)}"/>
    </svg>
    <div class="gauge-num">${score} %</div>
  </div>`;
}

function renderProgression() {
  const score = nuloScore();
  const r = rangNulo(score);
  $("#nulometre").innerHTML = `
    <h3>Nulomètre</h3>
    ${gaugeSVG(score)}
    <p class="muted" style="margin:0">Indice de nullité (100 % = Lolo)</p>
    <p class="rang">${esc(r.nom)}</p>
    <p class="muted">${esc(r.txt)}</p>
    <p class="stat-sub">${nbMaitrise()}/${TECHNIQUES.length} techniques · ${seancesFaites()} séances · quiz ${S.quizBest}/${QUIZ.length}</p>`;

  $("#catBars").innerHTML = CATEGORIES.map((c) => {
    const all = TECHNIQUES.filter((t) => t.cat === c.id);
    const done = all.filter((t) => S.maitrise[t.id]).length;
    return `<div class="cat-bar">
      <p class="progress-label"><span>${c.emoji} ${esc(c.nom)}</span><strong>${done}/${all.length}</strong></p>
      <div class="progress"><span style="width:${pct(done, all.length)}%"></span></div>
    </div>`;
  }).join("");

  const form = $("#sessionForm");
  if (!form.date.value) form.date.value = today();
  toggleMatchFields();

  const avecTirs = S.sessions.filter((s) => s.tirs > 0);
  const totTirs = avecTirs.reduce((a, s) => a + s.tirs, 0);
  const totOk = avecTirs.reduce((a, s) => a + s.reussis, 0);
  const best = avecTirs.reduce((m, s) => Math.max(m, pct(s.reussis, s.tirs)), 0);
  const m = matchs();
  const v = victoires();
  $("#sessionStats").innerHTML = `
    <div class="stat"><p class="stat-label">Séances / matchs notés</p><p class="stat-value">${S.sessions.length}</p></div>
    <div class="stat"><p class="stat-label">Réussite moyenne des tirs</p><p class="stat-value">${pct(totOk, totTirs)} %</p><p class="stat-sub">${totOk} marqués sur ${totTirs} tentés</p></div>
    <div class="stat"><p class="stat-label">Meilleure séance</p><p class="stat-value">${best} %</p></div>
    <div class="stat"><p class="stat-label">Bilan des matchs</p><p class="stat-value">${v} V · ${m.length - v} D</p><p class="stat-sub">${m.length ? pct(v, m.length) + " % de victoires" : "Aucun match noté"}</p></div>`;

  renderChart(avecTirs);
  renderSessionList();

  $("#badges").innerHTML = BADGES.map((b) => {
    const on = !!b.ok();
    return `<div class="badge${on ? " on" : ""}"><span class="badge-ico" aria-hidden="true">${b.ico}</span><span class="badge-name">${esc(b.nom)}</span><span class="badge-how">${on ? "Débloqué !" : esc(b.how)}</span></div>`;
  }).join("");
}

function renderChart(data) {
  const box = $("#chart");
  const pts = [...data].sort((a, b) => (a.date + a.id).localeCompare(b.date + b.id));
  if (pts.length < 2) {
    box.innerHTML = `<p class="empty">Note au moins 2 séances avec des tirs pour voir ta courbe.</p>`;
    return;
  }
  const W = 640, H = 220, L = 38, R = 40, T = 12, B = 28;
  const iw = W - L - R, ih = H - T - B;
  const x = (i) => L + (pts.length === 1 ? iw / 2 : (i / (pts.length - 1)) * iw);
  const y = (v) => T + ih - (v / 100) * ih;
  const vals = pts.map((s) => pct(s.reussis, s.tirs));
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Courbe du taux de réussite des tirs par séance">`;
  [0, 25, 50, 75, 100].forEach((g) => {
    s += `<line class="c-grid" x1="${L}" x2="${W - R}" y1="${y(g)}" y2="${y(g)}"/><text class="c-axis" x="${L - 6}" y="${y(g) + 4}" text-anchor="end">${g}%</text>`;
  });
  const step = Math.max(1, Math.ceil(pts.length / 6));
  pts.forEach((p, i) => {
    if (i % step === 0 || i === pts.length - 1) {
      s += `<text class="c-axis" x="${x(i)}" y="${H - 8}" text-anchor="middle">${frDate(p.date).slice(0, 5)}</text>`;
    }
  });
  const line = vals.map((v, i) => `${i ? "L" : "M"}${x(i)} ${y(v)}`).join(" ");
  s += `<path class="c-area" d="${line} L${x(vals.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z"/>`;
  s += `<path class="c-line" d="${line}"/>`;
  vals.forEach((v, i) => {
    s += `<circle class="c-dot" cx="${x(i)}" cy="${y(v)}" r="4"><title>${frDate(pts[i].date)} · ${v} % (${pts[i].reussis}/${pts[i].tirs})</title></circle>`;
  });
  const last = vals.length - 1;
  s += `<text class="c-last" x="${x(last) + 8}" y="${y(vals[last]) + 4}">${vals[last]}%</text>`;
  s += `</svg>`;
  box.innerHTML = s;
}

function renderSessionList() {
  const list = [...S.sessions].sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));
  if (!list.length) {
    $("#sessionList").innerHTML = `<p class="empty">Rien pour l'instant. Va jouer, et reviens noter ton score (même si c'est la Fanny).</p>`;
    return;
  }
  $("#sessionList").innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Date</th><th>Type</th><th>Tirs</th><th>Score</th><th>Notes</th><th><span class="sr-only">Supprimer</span></th></tr></thead>
    <tbody>${list.map((s) => {
      const isMatch = s.type === "Match" && (s.pour || s.contre);
      const res = isMatch ? (s.pour > s.contre ? `<span class="res-w">${s.pour}-${s.contre} V</span>` : s.pour < s.contre ? `<span class="res-l">${s.pour}-${s.contre} D</span>` : `${s.pour}-${s.contre} N`) : "—";
      return `<tr>
        <td>${frDate(s.date)}</td><td>${esc(s.type)}</td>
        <td>${s.tirs ? `${s.reussis}/${s.tirs} (${pct(s.reussis, s.tirs)} %)` : "—"}</td>
        <td>${res}</td><td class="notes">${esc(s.notes || "")}</td>
        <td><button type="button" class="del" data-del="${s.id}" aria-label="Supprimer cette ligne">✕</button></td>
      </tr>`;
    }).join("")}</tbody></table></div>`;
}

function toggleMatchFields() {
  const isMatch = $("#sessionForm").type.value === "Match";
  document.querySelectorAll(".match-only").forEach((l) => { l.hidden = !isMatch; });
}

function onSessionSubmit(e) {
  e.preventDefault();
  const f = e.target;
  const msg = $("#formMsg");
  const entry = {
    id: String(Date.now()),
    date: f.date.value || today(),
    type: f.type.value,
    tirs: num(f.tirs.value),
    reussis: num(f.reussis.value),
    pour: f.type.value === "Match" ? num(f.pour.value) : 0,
    contre: f.type.value === "Match" ? num(f.contre.value) : 0,
    notes: f.notes.value.trim().slice(0, 80)
  };
  if (entry.reussis > entry.tirs) {
    msg.className = "form-msg err";
    msg.textContent = "Plus de tirs marqués que de tirs tentés ? Même Lolo ne triche pas autant.";
    return;
  }
  if (!entry.tirs && !entry.pour && !entry.contre && !entry.notes) {
    msg.className = "form-msg err";
    msg.textContent = "Remplis au moins les tirs, le score ou une note.";
    return;
  }
  S.sessions.push(entry);
  save();
  f.reset();
  f.date.value = today();
  msg.className = "form-msg ok";
  msg.textContent = entry.type === "Match" && entry.pour > entry.contre
    ? "Victoire enregistrée ! Lolo est jaloux."
    : entry.type === "Match" && entry.contre > 0 && entry.pour === 0
      ? "Enregistré… Une Fanny ? On ne dira rien. Presque."
      : "Séance enregistrée. Continue comme ça.";
  renderProgression();
}

function exportData() {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `porlolo-progression-${today()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data !== "object" || !Array.isArray(data.sessions || [])) throw new Error("format");
      S = Object.assign(defaults(), data);
      save();
      renderProgression();
      alert("Progression importée !");
    } catch (err) {
      alert("Ce fichier n'est pas une sauvegarde PorLolo valide.");
    }
  };
  reader.readAsText(file);
}

/* ================= RÈGLES ================= */
function renderRegles() {
  const rule = (r) => `<div class="rule"><h4>${esc(r.titre)}</h4><p>${esc(r.txt)}</p></div>`;
  $("#reglesBar").innerHTML = REGLES_BAR.map(rule).join("");
  $("#reglesOff").innerHTML = REGLES_OFFICIELLES.map(rule).join("");
  $("#lexique").innerHTML = LEXIQUE.map(([m, d]) => `<div><dt>${esc(m)}</dt><dd>${esc(d)}</dd></div>`).join("");
}

/* ================= QUIZ ================= */
const Q = { order: [], i: 0, score: 0, started: false, answered: false };

function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

function renderQuiz() {
  const box = $("#quizBox");
  if (!Q.started) {
    box.innerHTML = `
      <p class="muted">Ton meilleur score : <strong>${S.quizBest}/${QUIZ.length}</strong></p>
      <h3>Prêt à prouver que tu n'es pas Lolo ?</h3>
      <button type="button" class="btn btn-primary" data-quiz="start">Commencer le quiz</button>`;
    return;
  }
  if (Q.i >= Q.order.length) {
    const verdict = [...VERDICTS_QUIZ].reverse().find((v) => Q.score >= v.min);
    const record = Q.score > S.quizBest;
    if (record) { S.quizBest = Q.score; save(); }
    box.innerHTML = `
      <p class="muted">Résultat final</p>
      <p class="quiz-score">${Q.score}/${QUIZ.length}</p>
      <h3>${esc(verdict.txt)}</h3>
      ${record ? `<p><strong>Nouveau record !</strong></p>` : `<p class="muted">Record : ${S.quizBest}/${QUIZ.length}</p>`}
      <div class="btn-row">
        <button type="button" class="btn btn-primary" data-quiz="start">Recommencer</button>
        <a class="btn btn-ghost" href="#techniques">Réviser les techniques</a>
      </div>`;
    return;
  }
  const q = QUIZ[Q.order[Q.i]];
  box.innerHTML = `
    <div class="quiz-top"><span>Question ${Q.i + 1} / ${QUIZ.length}</span><span>Score : ${Q.score}</span></div>
    <div class="progress"><span style="width:${pct(Q.i, QUIZ.length)}%"></span></div>
    <h3>${esc(q.q)}</h3>
    <div class="answers">${q.r.map((r, k) => `<button type="button" class="answer" data-answer="${k}">${esc(r)}</button>`).join("")}</div>
    <div id="quizAfter"></div>`;
}

function answerQuiz(k) {
  if (Q.answered) return;
  Q.answered = true;
  const q = QUIZ[Q.order[Q.i]];
  const good = k === q.ok;
  if (good) Q.score++;
  document.querySelectorAll(".answer").forEach((b) => {
    const idx = Number(b.dataset.answer);
    b.disabled = true;
    if (idx === q.ok) b.classList.add("right");
    else if (idx === k) b.classList.add("wrong");
  });
  $("#quizAfter").innerHTML = `
    <div class="explain"><strong>${good ? "Bien vu !" : "Raté…"}</strong> ${esc(q.exp)}</div>
    <button type="button" class="btn btn-primary" data-quiz="next">${Q.i + 1 < QUIZ.length ? "Question suivante" : "Voir le résultat"}</button>`;
  $('[data-quiz="next"]').focus();
}

/* ================= ÉVÉNEMENTS ================= */
function bind() {
  window.addEventListener("hashchange", route);

  // Accueil : la barre de niveau
  $("#niveau").addEventListener("input", (e) => setNiveau(Number(e.target.value)));
  $("#rodTicks").addEventListener("click", (e) => {
    const b = e.target.closest("[data-lvl]");
    if (b) setNiveau(Number(b.dataset.lvl));
  });

  // Techniques : filtres et cases « maîtrisée »
  $("#catChips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cat]");
    if (!b) return;
    F.cat = b.dataset.cat;
    document.querySelectorAll("#catChips .chip").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
    renderTechList();
  });
  $("#search").addEventListener("input", (e) => { F.q = e.target.value; renderTechList(); });
  $("#posteFilter").addEventListener("change", (e) => { F.poste = e.target.value; renderTechList(); });
  $("#monNiveau").addEventListener("change", (e) => { F.mine = e.target.checked; renderTechList(); });
  $("#techGrid").addEventListener("change", (e) => {
    const id = e.target.dataset.master;
    if (!id) return;
    if (e.target.checked) S.maitrise[id] = true; else delete S.maitrise[id];
    save();
    // Mise à jour de la carte sans tout redessiner (garde les détails ouverts)
    const card = e.target.closest(".tech");
    const t = TECHNIQUES.find((x) => x.id === id);
    const tmp = document.createElement("div");
    tmp.innerHTML = techCard(t);
    const fresh = tmp.firstElementChild;
    if (card.querySelector("details").open) fresh.querySelector("details").open = true;
    card.replaceWith(fresh);
    $("#techCount").textContent = $("#techCount").textContent.replace(/· \d+ maîtrisées? sur/, `· ${nbMaitrise()} maîtrisée${nbMaitrise() > 1 ? "s" : ""} sur`);
  });

  // Schémas agrandis
  $("#techGrid").addEventListener("click", (e) => {
    const z = e.target.closest("[data-zoom]");
    if (z) openZoom(z.dataset.zoom);
  });
  $("#zoomClose").addEventListener("click", closeZoom);
  $("#zoom").addEventListener("click", (e) => {
    if (e.target.id === "zoom") { closeZoom(); return; } // clic sur le fond sombre
    const b = e.target.closest("[data-speed]");
    if (b) { Z.dur = Number(b.dataset.speed); renderZoom(); }
  });
  $("#zoom").addEventListener("close", () => { $("#zoomDiag").innerHTML = ""; });

  // Programme
  $("#progTabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-prog]");
    if (!b) return;
    S.prog = b.dataset.prog;
    save();
    renderProgramme();
  });
  $("#progBody").addEventListener("click", (e) => {
    const b = e.target.closest("[data-seance]");
    if (!b) return;
    const k = b.dataset.seance;
    if (S.seances[k]) delete S.seances[k]; else S.seances[k] = true;
    save();
    renderProgramme();
  });

  // Progression
  $("#sessionForm").addEventListener("submit", onSessionSubmit);
  $("#sessionForm").type.addEventListener("change", toggleMatchFields);
  $("#sessionList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-del]");
    if (!b) return;
    if (!confirm("Supprimer cette ligne ?")) return;
    S.sessions = S.sessions.filter((s) => s.id !== b.dataset.del);
    save();
    renderProgression();
  });
  $("#exportBtn").addEventListener("click", exportData);
  $("#importFile").addEventListener("change", (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = "";
  });
  $("#resetBtn").addEventListener("click", () => {
    if (!confirm("Tout effacer ? Niveau, techniques, séances, stats et quiz. Même Lolo hésiterait.")) return;
    S = defaults();
    save();
    renderProgression();
  });

  // Quiz
  $("#quizBox").addEventListener("click", (e) => {
    const a = e.target.closest("[data-answer]");
    if (a) { answerQuiz(Number(a.dataset.answer)); return; }
    const c = e.target.closest("[data-quiz]");
    if (!c) return;
    if (c.dataset.quiz === "start") {
      Object.assign(Q, { order: shuffle(QUIZ.map((_, i) => i)), i: 0, score: 0, started: true, answered: false });
    } else {
      Q.i++;
      Q.answered = false;
    }
    renderQuiz();
  });
}

bind();
startTicker();
route();
