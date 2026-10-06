/* =========================================================
   PorLolo el nulo — contenu du site
   Tout le texte vit ici : techniques, exercices, programmes,
   règles, quiz et vannes. app.js s'occupe de l'affichage.
   ========================================================= */

const NIVEAUX = [
  { n: 1, nom: "Nulo absoluto", court: "Nulo", desc: "Tu tournes les barres et tu pries. Niveau Lolo certifié." },
  { n: 2, nom: "Pilier de comptoir", court: "Comptoir", desc: "Tu marques parfois, surtout quand l'adversaire va chercher une bière." },
  { n: 3, nom: "Habitué du PMU", court: "PMU", desc: "Tu contrôles la balle et tu connais 2-3 tirs. Ça commence à faire peur." },
  { n: 4, nom: "Requin du bar", court: "Requin", desc: "Passes propres, tirs variés. Tu fais payer les tournées." },
  { n: 5, nom: "Légende Bonzini", court: "Légende", desc: "Snake, feintes, lecture de défense. Lolo t'appelle « maestro »." }
];

const CATEGORIES = [
  { id: "bases",    nom: "Les bases",        emoji: "🤏", desc: "Prise, posture, regard. Sans ça, rien ne marche." },
  { id: "controle", nom: "Contrôle de balle", emoji: "🧲", desc: "Arrêter, coincer, déplacer la balle sans la perdre." },
  { id: "passes",   nom: "Passes",           emoji: "🎯", desc: "Faire avancer la balle du milieu vers l'attaque." },
  { id: "tirs",     nom: "Tirs",             emoji: "💥", desc: "Du tir de base au snake qui fait trembler le bar." },
  { id: "defense",  nom: "Défense & gardien", emoji: "🧱", desc: "Fermer les couloirs et arrêter de prendre des valises." },
  { id: "tactique", nom: "Tactique & mental", emoji: "🧠", desc: "Lire l'adversaire, gérer le temps, rester calme." }
];

/* Schémas : coordonnées dans un terrain 320×180 (vue de dessus).
   Ton équipe (rouge) attaque vers la DROITE. Adversaire en bleu.
   Barres : g (ton gardien) · d (tes arrières) · A (avants adverses) · m (tes demis)
            M (demis adverses) · a (tes avants) · D (arrières adverses) · G (gardien adverse)
   path = trajet de la balle, hl = barres mises en valeur, shift = décalage vertical d'une barre. */

const TECHNIQUES = [
  /* ---------------- BASES ---------------- */
  {
    id: "prise", cat: "bases", nom: "La prise de poignée", niveau: 1, poste: "Tous",
    resume: "Tenir la poignée avec les doigts, poignet souple. C'est le poignet qui donne la vitesse, pas le bras.",
    etapes: [
      "Pose la poignée dans le creux des doigts, pas au fond de la paume.",
      "Le pouce se place au-dessus, les doigts enroulés sans serrer.",
      "Pour frapper : la poignée roule légèrement dans la main, tu fermes les doigts au moment de l'impact.",
      "Entre deux actions, relâche. Une main crispée est lente et imprécise."
    ],
    erreurs: [
      "Serrer comme Lolo serre son dernier ticket de PMU gagnant.",
      "Taper avec tout le bras : beaucoup de bruit, zéro précision."
    ],
    bonzini: "Les poignées en bois glissent quand tu as les mains moites : sèche-toi les mains entre les points (sans les essuyer sur le Bonzini).",
    exo: "Pose la balle devant ton avant central et fais 30 frappes en desserrant la main au maximum. Le bruit doit venir de la balle, pas de la barre."
  },
  {
    id: "roulette", cat: "bases", nom: "Bannir la roulette", niveau: 1, poste: "Tous",
    resume: "Faire tourner la barre comme un moulin est interdit, inefficace et surtout la marque officielle du nulo.",
    etapes: [
      "Une frappe = un mouvement court : le joueur part de l'arrière, frappe, s'arrête devant.",
      "Après la frappe, ramène tes joueurs à la verticale au lieu de les laisser tourner.",
      "Si la barre tourne toute seule, c'est que tu as lâché la poignée : garde le contact.",
      "Au bar comme en compétition, un but marqué en roulette ne compte pas."
    ],
    erreurs: [
      "Penser qu'une roulette est plus puissante : c'est surtout plus aléatoire.",
      "Laisser ses joueurs à l'horizontale : tu ouvres un boulevard à l'adversaire."
    ],
    bonzini: "Les barres Bonzini sont lourdes : une roulette ne fait qu'envoyer la balle au hasard. Une frappe contrôlée va beaucoup plus vite.",
    exo: "Joue une partie entière en t'interdisant de dépasser un demi-tour de barre. Chaque roulette = 5 pompes."
  },
  {
    id: "posture", cat: "bases", nom: "Posture et placement du corps", niveau: 1, poste: "Tous",
    resume: "Pieds stables, épaules relâchées, à bonne distance de la table pour garder les bras libres.",
    etapes: [
      "Pieds écartés à la largeur des épaules, un pied légèrement en avant.",
      "Hanches face à la table, à environ une demi-longueur d'avant-bras du bord.",
      "Coudes souples et légèrement fléchis, jamais tendus.",
      "Ne te penche pas au-dessus du terrain : garde la tête haute pour voir toute la table."
    ],
    erreurs: [
      "Être collé à la table : tes bras n'ont plus de place pour frapper.",
      "Sautiller à chaque tir : tu bouges la table et tu rates la balle."
    ],
    bonzini: "Les barres sont traversantes : quand tu pousses une barre, elle ressort de l'autre côté. Pense à ton voisin et à ton ventre.",
    exo: "Filme-toi 1 minute en train de jouer. Vérifie : pieds stables ? coudes souples ? tête au-dessus de la table ?"
  },
  {
    id: "regard", cat: "bases", nom: "Regarder la balle, pas tes mains", niveau: 1, poste: "Tous",
    resume: "Ton regard suit la balle en permanence. Tes mains doivent savoir où sont les poignées sans regarder.",
    etapes: [
      "Garde les yeux sur la balle, même quand tu changes de barre.",
      "Apprends la position des poignées par cœur : main gauche sur gardien/arrière, main droite sur demis/avants (en simple).",
      "Regarde aussi les joueurs adverses autour de la balle : c'est là que tu vois les couloirs ouverts.",
      "Après un tir, regarde où va la balle au lieu de lever les bras."
    ],
    erreurs: [
      "Chercher la poignée des yeux : la balle est déjà dans ton but.",
      "Célébrer avant que la balle soit rentrée (spécialité de Lolo)."
    ],
    bonzini: "La balle en liège est lente au sol comparée aux tables italiennes : tu as le temps de lire le jeu, profites-en.",
    exo: "Joue 5 minutes en changeant de barre sans jamais baisser les yeux vers tes mains."
  },
  {
    id: "neutres", cat: "bases", nom: "Les barres en position neutre", niveau: 2, poste: "Tous",
    resume: "Quand tu n'as pas la balle, tes joueurs restent verticaux. Quand TU tires, relève les barres devant toi.",
    etapes: [
      "En défense, joueurs verticaux, pieds au sol : ils bloquent les tirs.",
      "Quand ton gardien ou tes arrières tirent, relève tes demis et tes avants à l'horizontale pour laisser passer la balle.",
      "Une fois la balle passée, remets-les tout de suite à la verticale.",
      "Ne laisse jamais une barre « en l'air » derrière la balle adverse."
    ],
    erreurs: [
      "Tirer depuis la défense et toucher son propre demi : le contre-son-camp classique de Lolo.",
      "Laisser ses avants à l'horizontale pendant que l'adversaire a la balle au milieu."
    ],
    bonzini: "Sur Bonzini, les barres du milieu ont 5 joueurs serrés : si tu ne les relèves pas, ton tir long n'a quasiment aucune chance de passer.",
    exo: "10 tirs depuis l'arrière en relevant tes barres à chaque fois. Compte combien touchent tes propres joueurs (objectif : zéro).",
    diag: { hl: ["d", "m", "a"], path: [[66, 58], [140, 74], [216, 92], [310, 102]], up: ["m", "a"] }
  },

  /* ---------------- CONTRÔLE ---------------- */
  {
    id: "amorti", cat: "controle", nom: "L'amorti (arrêter la balle)", niveau: 1, poste: "Tous",
    resume: "Accompagner la balle qui arrive au lieu de la renvoyer n'importe où. Le premier pas vers le contrôle.",
    etapes: [
      "Place ton joueur sur la trajectoire de la balle.",
      "Juste avant le contact, incline légèrement le joueur vers l'arrière.",
      "Recule un peu au moment du contact pour absorber la vitesse, comme une main qui attrape un œuf.",
      "La balle doit s'arrêter devant ou sous le pied."
    ],
    erreurs: [
      "Laisser le joueur tout raide : la balle rebondit et repart chez l'adversaire.",
      "Taper la balle par réflexe dès qu'elle arrive (le fameux « réflexe Lolo »)."
    ],
    bonzini: "La balle en liège accroche bien : un amorti sur Bonzini est plus facile que sur les tables rapides. Aucune excuse.",
    exo: "Fais rouler la balle à la main vers ta barre de 5. Arrête-la 20 fois de suite sans qu'elle rebondisse.",
    diag: { hl: ["m"], path: [[178, 120], [150, 100], [146, 92]] }
  },
  {
    id: "pince", cat: "controle", nom: "La pince (coincer la balle)", niveau: 2, poste: "Tous",
    resume: "Bloquer la balle sous le pied du joueur incliné. C'est la position de départ de presque tous les tirs.",
    etapes: [
      "Arrête la balle juste devant le pied de ton joueur.",
      "Incline le joueur vers l'avant : le bout du pied vient coincer la balle contre le terrain.",
      "Pression légère : assez pour tenir la balle, pas trop pour qu'elle ne s'échappe pas.",
      "Depuis la pince, tu peux déplacer la balle latéralement en gardant le contact."
    ],
    erreurs: [
      "Écraser la balle trop fort : elle gicle sur le côté.",
      "Pincer trop loin du pied : la balle est à moitié libre et l'adversaire la vole."
    ],
    bonzini: "Pieds plats et balle en liège = pinces très stables. C'est LA base du jeu Bonzini, travaille-la à fond.",
    exo: "Pince la balle avec ton avant central, déplace-la d'un pied à l'autre et reviens. 3 séries de 20."
  },
  {
    id: "pince-bande", cat: "controle", nom: "La pince en bande", niveau: 3, poste: "Milieu / attaque",
    resume: "Coincer la balle contre la bande latérale avec le côté du pied. Parfait pour préparer une passe.",
    etapes: [
      "Amène la balle vers la bande avec le joueur extérieur de ta barre.",
      "Incline le joueur et plaque la balle entre son pied et la bande.",
      "Garde-la immobile : l'adversaire doit deviner quand et où tu vas passer.",
      "Relâche au dernier moment pour enchaîner sur une passe en bande ou une passe directe."
    ],
    erreurs: [
      "Rester collé à la bande trop longtemps et dépasser le temps de possession.",
      "Toujours repartir dans le même sens : tu deviens prévisible."
    ],
    bonzini: "Les bandes Bonzini sont droites et rigides : la balle rebondit de façon très prévisible, idéal pour la passe en bande juste après.",
    exo: "Pince en bande, compte jusqu'à 3, lâche et passe. 15 répétitions de chaque côté.",
    diag: { hl: ["m"], path: [[141, 60], [141, 34], [141, 16]] }
  },
  {
    id: "tictac", cat: "controle", nom: "Le tic-tac (transfert latéral)", niveau: 3, poste: "Milieu / attaque",
    resume: "Faire passer la balle d'un joueur à l'autre de la même barre pour déséquilibrer la défense.",
    etapes: [
      "Balle contrôlée devant un joueur.",
      "Petit coup sec du pied sur le côté pour envoyer la balle vers le joueur voisin.",
      "Le voisin l'arrête immédiatement (amorti latéral).",
      "Enchaîne 2 ou 3 transferts, puis passe ou tire quand la défense a bougé."
    ],
    erreurs: [
      "Transferts trop forts : la balle file entre tes joueurs.",
      "Faire du tic-tac pour le style sans jamais tirer. Le chrono tourne."
    ],
    bonzini: "Sur Bonzini les joueurs du milieu sont rapprochés : les transferts courts sur la barre de 5 sont très efficaces.",
    exo: "Fais aller-retour la balle entre deux joueurs de ta barre de 5. Objectif : 10 transferts sans perte.",
    diag: { hl: ["m"], path: [[148, 58], [148, 90], [148, 122], [148, 90]] }
  },
  {
    id: "controle-engagement", cat: "controle", nom: "Contrôler l'engagement", niveau: 2, poste: "Milieu",
    resume: "Ne pas laisser l'engagement à la chance : récupérer la balle au milieu proprement.",
    etapes: [
      "Avant l'engagement, place tes demis au centre, joueurs verticaux.",
      "Quand la balle arrive, fais un amorti avec le demi le plus proche.",
      "Bloque-la ensuite en pince pour reprendre ton souffle et lire la défense.",
      "Seulement ensuite : passe ou tic-tac."
    ],
    erreurs: [
      "Frapper la balle dès l'engagement : 1 chance sur 2 de la donner.",
      "Avoir les demis à l'horizontale au moment de l'engagement."
    ],
    bonzini: "La balle arrive par le trou d'engagement latéral sur la plupart des Bonzini de bar : anticipe le côté où elle va rouler.",
    exo: "Fais 20 engagements toi-même et compte combien tu en contrôles proprement.",
    diag: { hl: ["m", "M"], path: [[160, 170], [160, 120], [150, 92]] }
  },

  /* ---------------- PASSES ---------------- */
  {
    id: "passe-bande", cat: "passes", nom: "La passe en bande", niveau: 2, poste: "Milieu",
    resume: "Faire rebondir la balle sur la bande latérale pour contourner les demis adverses et servir tes avants.",
    etapes: [
      "Balle contrôlée sur un joueur extérieur de ta barre de 5.",
      "Vise un point de la bande situé à mi-chemin entre tes demis et tes avants.",
      "Frappe sèche et en diagonale vers la bande.",
      "Ton avant le plus proche de la bande attend la balle et fait un amorti."
    ],
    erreurs: [
      "Taper trop fort : la balle traverse toute ta barre d'avants.",
      "Annoncer ta passe en regardant la bande pendant 5 secondes."
    ],
    bonzini: "Les rebonds sur bande Bonzini sont nets : une fois l'angle trouvé, la passe marche presque à chaque fois.",
    exo: "20 passes en bande du côté gauche, 20 du côté droit. Note combien sont contrôlées par l'avant.",
    diag: { hl: ["m", "a"], path: [[148, 58], [180, 14], [212, 34], [212, 42]] }
  },
  {
    id: "passe-couloir", cat: "passes", nom: "La passe dans le couloir", niveau: 3, poste: "Milieu",
    resume: "Glisser la balle entre deux demis adverses, directement vers un avant.",
    etapes: [
      "Repère l'espace (le « couloir ») entre deux joueurs de la barre de 5 adverse.",
      "Amène la balle en face du couloir avec un petit déplacement latéral.",
      "Frappe sèche, droite ou légèrement brossée.",
      "Ton avant doit être placé dans l'axe du couloir avant que la balle parte."
    ],
    erreurs: [
      "Passer quand le couloir est déjà fermé : l'adversaire intercepte.",
      "Oublier de placer son avant : la passe est parfaite… et personne au bout."
    ],
    bonzini: "Les couloirs sont étroits sur la barre de 5 : vise le centre de l'espace, pas le bord des joueurs.",
    exo: "Demande à un pote de bouger sa barre de 5 lentement. Passe uniquement quand un couloir s'ouvre. 20 essais.",
    diag: { hl: ["m", "a", "M"], path: [[148, 90], [180, 74], [212, 64]], shift: { M: 0 } }
  },
  {
    id: "passe-brossee", cat: "passes", nom: "La passe brossée", niveau: 3, poste: "Milieu",
    resume: "Frapper la balle avec un mouvement latéral pour qu'elle parte en diagonale, rapide et rasante.",
    etapes: [
      "Balle immobile devant le pied.",
      "Déplace la barre latéralement en même temps que tu frappes.",
      "Le pied « brosse » le côté de la balle, qui part en diagonale.",
      "Vise le pied de ton avant, pas l'espace vide."
    ],
    erreurs: [
      "Mouvement latéral sans frappe : la balle roule mollement.",
      "Frappe sans mouvement latéral : passe droite et facile à lire."
    ],
    bonzini: "La balle en liège prend bien l'effet : la passe brossée part avec un angle plus marqué que sur une table rapide.",
    exo: "Depuis un demi central, 15 passes brossées vers la gauche, 15 vers la droite.",
    diag: { hl: ["m", "a"], path: [[148, 90], [160, 98], [212, 132]] }
  },
  {
    id: "relance", cat: "passes", nom: "La relance défense → milieu", niveau: 2, poste: "Défense",
    resume: "Faire sortir la balle de ta défense vers tes demis au lieu de dégager au hasard.",
    etapes: [
      "Contrôle la balle avec ton arrière ou ton gardien.",
      "Relève-la si besoin vers ton arrière pour avoir un meilleur angle.",
      "Repère les trous dans la barre d'avants adverse (3 joueurs = 2 grands couloirs).",
      "Passe sèche dans le trou, ton demi l'arrête."
    ],
    erreurs: [
      "Dégager le plus fort possible : la balle revient dans ta défense 2 secondes après.",
      "Passer en plein dans un avant adverse : contre immédiat."
    ],
    bonzini: "Les 3 avants adverses ne peuvent pas tout couvrir : il y a toujours un couloir, il faut juste le voir.",
    exo: "10 relances propres d'affilée : la balle doit arriver contrôlée sur ta barre de 5.",
    diag: { hl: ["d", "m", "A"], path: [[70, 122], [104, 110], [138, 106]] }
  },
  {
    id: "feinte-passe", cat: "passes", nom: "La feinte de passe", niveau: 4, poste: "Milieu",
    resume: "Faire croire à une passe d'un côté pour passer de l'autre.",
    etapes: [
      "Balle en pince au milieu de la barre de 5.",
      "Lance un début de mouvement vers la bande, puis arrête-toi net.",
      "L'adversaire suit ta feinte : le couloir opposé s'ouvre.",
      "Passe immédiatement dans le couloir ouvert."
    ],
    erreurs: [
      "Feinter 6 fois de suite : le chrono de 10 secondes ne t'attendra pas.",
      "Feinter sans regarder la réaction de l'adversaire."
    ],
    bonzini: "Une feinte bruyante (barre qui claque légèrement) marche bien au bar. En compétition, pas de bruit pour déconcentrer.",
    exo: "Alterne feinte + passe opposée et passe directe, au hasard, contre un défenseur. Note le taux de réussite."
  },

  /* ---------------- TIRS ---------------- */
  {
    id: "frappe", cat: "tirs", nom: "La frappe directe", niveau: 1, poste: "Attaque",
    resume: "Le tir de base : balle devant le pied, un coup de poignet sec, droit vers le but.",
    etapes: [
      "Balle arrêtée juste devant le pied de ton avant.",
      "Arme : incline le joueur vers l'arrière (pas plus d'un quart de tour).",
      "Coup de poignet rapide, frappe au centre de la balle.",
      "Stoppe le joueur juste après l'impact et remets-le vertical."
    ],
    erreurs: [
      "Armer jusqu'à faire un tour complet : roulette, but refusé.",
      "Viser le centre du but, pile là où le gardien attend."
    ],
    bonzini: "Bonzini = balle lente et joueurs lourds : une frappe bien sèche part très vite. Pas besoin de bourriner.",
    exo: "Balle posée devant chaque avant : 3 × 10 frappes en visant les coins du but.",
    diag: { hl: ["a"], path: [[222, 90], [310, 72]] }
  },
  {
    id: "pissette", cat: "tirs", nom: "La pissette (tir de l'ailier)", niveau: 2, poste: "Attaque",
    resume: "Tir de l'ailier de la barre de 3, le long de la bande, vers le coin du but. Ailier droit = pissette, ailier gauche = pissette inversée.",
    etapes: [
      "Vérifie la règle AVANT la partie : au bar, la pissette est souvent interdite (« pas de pissette ! »). En compétition, elle est autorisée.",
      "Amène la balle sur ton ailier droit (le joueur de ta barre de 3 le plus proche de la bande à ta droite).",
      "Profite du moment où le gardien et l'arrière adverses gardent le centre du but et laissent le coin ouvert.",
      "Frappe sèche en légère diagonale, vers le coin du but de ton côté.",
      "Version inversée : même tir avec l'ailier gauche, vers l'autre coin."
    ],
    erreurs: [
      "Marquer une pissette dans un bar où c'est interdit : but annulé et Lolo qui crie au scandale (pour une fois, il a raison).",
      "Frapper trop près de la bande : la balle tape le coin et ressort."
    ],
    bonzini: "Sur Bonzini, la balle en liège se coince bien contre le pied de l'ailier : tu peux la caler, attendre que le coin s'ouvre, puis frapper.",
    exo: "Balle posée sur ton ailier droit : 15 pissettes. Puis 15 pissettes inversées avec l'ailier gauche. Compte les buts.",
    diag: { hl: ["a", "D", "G"], path: [[222, 138], [310, 108]], shift: { D: -12, G: -6 } }
  },
  {
    id: "push", cat: "tirs", nom: "Le tir poussé (push)", niveau: 3, poste: "Attaque",
    resume: "Depuis l'avant central, pousser la balle latéralement puis frapper avant que le défenseur suive.",
    etapes: [
      "Balle en pince devant l'avant central.",
      "Pousse la barre (vers l'extérieur de ton côté) : le pied accompagne la balle sur le côté.",
      "Pendant le mouvement, tu lâches la pince et frappes d'un coup de poignet.",
      "Vise le coin du but du côté où tu as poussé."
    ],
    erreurs: [
      "Déplacer la balle sans frapper, puis frapper à l'arrêt : le défenseur a eu le temps.",
      "Toujours tirer « poussé » : le défenseur va s'y attendre."
    ],
    bonzini: "La pince stable du Bonzini rend le push très régulier une fois maîtrisé. C'est le tir le plus utilisé en bar.",
    exo: "3 × 10 push : 10 au coin long, 10 au coin court, 10 au milieu.",
    diag: { hl: ["a", "D", "G"], path: [[222, 90], [222, 112], [310, 108]] }
  },
  {
    id: "pull", cat: "tirs", nom: "Le tir tiré (pull)", niveau: 3, poste: "Attaque",
    resume: "Même principe que le push, mais en tirant la barre vers toi. Le combo push + pull rend illisible.",
    etapes: [
      "Balle en pince devant l'avant central.",
      "Tire la barre vers toi : la balle glisse avec le pied.",
      "Frappe pendant le mouvement, pas après.",
      "Vise le coin du but de ton côté."
    ],
    erreurs: [
      "Tirer la barre trop loin : la balle se retrouve devant ton avant extérieur, angle fermé.",
      "Lever les yeux vers le but au moment de tirer : tu annonces ton tir."
    ],
    bonzini: "Avec les barres traversantes, le pull ramène la barre vers toi : garde le coude souple pour ne pas te bloquer.",
    exo: "Alterne push / pull au hasard (lance une pièce). 30 tirs, note ton taux de réussite.",
    diag: { hl: ["a", "D", "G"], path: [[222, 90], [222, 66], [310, 74]] }
  },
  {
    id: "tir-bande", cat: "tirs", nom: "Le tir en bande", niveau: 3, poste: "Attaque",
    resume: "Faire rebondir le tir sur la bande pour contourner le gardien par un angle inattendu.",
    etapes: [
      "Amène la balle sur ton avant extérieur, près de la bande.",
      "Vise un point de la bande juste avant la barre de défense adverse.",
      "Frappe sèche en diagonale : la balle rebondit vers le coin opposé du but.",
      "Marche mieux quand le gardien est décalé de l'autre côté."
    ],
    erreurs: [
      "Rebond trop proche de toi : la balle revient vers le milieu.",
      "L'utiliser comme seul tir : une fois repéré, il ne passe plus."
    ],
    bonzini: "Bandes droites et rigides = angles fiables. Quelques essais suffisent pour trouver ton point de visée.",
    exo: "Choisis un point de la bande (marque-le mentalement) : 20 tirs depuis l'avant extérieur.",
    diag: { hl: ["a", "G"], path: [[222, 138], [270, 165], [310, 104]], shift: { G: -16 } }
  },
  {
    id: "tir-demi", cat: "tirs", nom: "Le tir du milieu (demi)", niveau: 3, poste: "Milieu",
    resume: "Tirer directement depuis la barre de 5. Arme surprise… si c'est autorisé à ta table.",
    etapes: [
      "Vérifie la règle AVANT la partie : au bar, le but du demi est souvent interdit ou spécial.",
      "Balle contrôlée sur un demi qui a un couloir vers le but.",
      "Relève tes avants pour ne pas bloquer ton propre tir.",
      "Frappe sèche dans le couloir, en visant un coin."
    ],
    erreurs: [
      "Marquer un demi dans un bar où « pas de demi » : but annulé, honte éternelle.",
      "Oublier de relever ses avants : contre-son-camp potentiel."
    ],
    bonzini: "La distance est longue sur Bonzini : sans couloir clair, le tir du milieu est surtout une passe à l'adversaire.",
    exo: "10 tirs depuis la barre de 5, avants relevés, en visant les coins.",
    diag: { hl: ["m"], path: [[148, 58], [230, 70], [310, 80]], up: ["a"] }
  },
  {
    id: "tir-long", cat: "tirs", nom: "Le tir long (gardien / arrière)", niveau: 2, poste: "Défense",
    resume: "Tirer depuis la défense quand l'adversaire laisse un couloir ouvert. Rare, mais dévastateur.",
    etapes: [
      "Balle contrôlée sur ton arrière ou ton gardien.",
      "Relève tes demis et tes avants (sinon tu tires dans tes propres joueurs).",
      "Cherche un alignement de trous jusqu'au but adverse.",
      "Frappe sèche, puis remets immédiatement tes barres à la verticale."
    ],
    erreurs: [
      "Tirer long à chaque balle : tu rends la possession pour rien.",
      "Oublier de redescendre ses barres après le tir."
    ],
    bonzini: "Au bar, certaines tables comptent le but du gardien double : demande avant de jouer.",
    exo: "5 tirs longs par séance, barres relevées. Le plus important : le réflexe de relever/redescendre.",
    diag: { hl: ["g", "d"], path: [[34, 90], [170, 100], [310, 96]], up: ["m", "a"] }
  },
  {
    id: "une-touche", cat: "tirs", nom: "La reprise en une touche", niveau: 4, poste: "Attaque",
    resume: "Tirer directement sur la passe, sans contrôler. Le défenseur n'a pas le temps de se placer.",
    etapes: [
      "Ton demi passe en bande ou dans le couloir.",
      "Ton avant arme AVANT que la balle arrive.",
      "Frappe la balle en mouvement, au moment où elle passe devant le pied.",
      "Vise le coin opposé au côté d'où vient la passe."
    ],
    erreurs: [
      "Armer trop tard : tu frappes dans le vide.",
      "Vouloir le faire à chaque fois : contrôler reste plus sûr."
    ],
    bonzini: "La balle Bonzini est lente : le timing de la reprise est plus facile à prendre que sur une table rapide.",
    exo: "Un pote fait des passes en bande, toi tu reprends en une touche. 20 essais, compte les cadrés.",
    diag: { hl: ["m", "a"], path: [[148, 58], [180, 14], [216, 44], [310, 100]] }
  },
  {
    id: "tictac-tir", cat: "tirs", nom: "Le tic-tac tir", niveau: 4, poste: "Attaque",
    resume: "Enchaîner un transfert entre deux avants puis tirer dans la foulée, avant que la défense se recale.",
    etapes: [
      "Balle sur un avant extérieur.",
      "Transfert vers l'avant central (tic).",
      "Le central frappe immédiatement (tac), sans pince.",
      "Varie : parfois tu fais un 2e transfert avant de tirer."
    ],
    erreurs: [
      "Arrêter la balle après le transfert : tu perds tout l'effet de surprise.",
      "Transfert trop lent : la défense suit tranquillement."
    ],
    bonzini: "Joueurs rapprochés + balle qui accroche = transferts précis. Combo redoutable au bar.",
    exo: "20 tic-tac tir. Puis 20 en ajoutant un 2e transfert au hasard.",
    diag: { hl: ["a"], path: [[222, 42], [222, 90], [310, 82]] }
  },
  {
    id: "snake", cat: "tirs", nom: "Le snake (tir enroulé)", niveau: 5, poste: "Attaque",
    resume: "Balle coincée sous l'avant central, la barre roule dans la paume ouverte : le tir le plus rapide qui existe.",
    etapes: [
      "Balle coincée sur le côté, sous le pied de l'avant central (le joueur penche vers l'avant).",
      "Main ouverte, la poignée posée à plat dans la paume, pas tenue.",
      "Déplace la barre latéralement pour viser, puis fais rouler la poignée d'un coup de paume : le joueur tourne et frappe.",
      "Le mouvement doit rester dans la limite des 360° autour de la frappe, sinon c'est une roulette."
    ],
    erreurs: [
      "Tenir la poignée à pleine main : ce n'est plus un snake, c'est une roulette ratée.",
      "Vouloir l'apprendre avant de maîtriser la pince : Lolo, chaque chose en son temps."
    ],
    bonzini: "Le snake fonctionne très bien sur Bonzini grâce aux pieds plats qui tiennent la balle. Certains bars le refusent : demande avant.",
    exo: "15 min par séance : d'abord le roulé sans balle, puis avec balle sans viser, puis en visant un coin.",
    diag: { hl: ["a", "G"], path: [[222, 96], [222, 112], [310, 110]] }
  },

  /* ---------------- DÉFENSE ---------------- */
  {
    id: "mur", cat: "defense", nom: "Le mur (gardien + arrières)", niveau: 1, poste: "Défense",
    resume: "Gardien et arrières se complètent pour couvrir tout le but, sans laisser de couloir.",
    etapes: [
      "Ton gardien couvre une moitié du but, ton arrière le plus proche couvre l'autre.",
      "Les joueurs restent verticaux, pieds au sol.",
      "Déplace les deux barres ensemble quand la balle bouge.",
      "Ne laisse jamais les deux couvrir la même zone."
    ],
    erreurs: [
      "Gardien et arrière alignés l'un derrière l'autre : la moitié du but est vide.",
      "Lever les joueurs pour « voir » : tu viens d'ouvrir le but."
    ],
    bonzini: "Sur Bonzini, le gardien est seul sur sa barre : il ne couvre jamais tout le but, le travail avec l'arrière est obligatoire.",
    exo: "Un pote tire 20 fois depuis ses avants : tu ne dois bouger que pour garder gardien + arrière complémentaires.",
    diag: { hl: ["g", "d", "A"], path: [[98, 96], [36, 102]], shift: { g: 14, d: -8 } }
  },
  {
    id: "ombre", cat: "defense", nom: "La défense à l'ombre", niveau: 3, poste: "Défense",
    resume: "Ton arrière suit la balle comme son ombre ; ton gardien couvre le reste.",
    etapes: [
      "Ton arrière le plus proche se place exactement en face de la balle.",
      "Il suit chaque déplacement latéral de l'avant adverse.",
      "Le gardien couvre le côté que l'arrière ne couvre pas.",
      "L'attaquant doit déplacer la balle très vite pour trouver un trou."
    ],
    erreurs: [
      "Suivre avec du retard : l'ombre devient une porte ouverte.",
      "Suivre les feintes de la barre au lieu de la balle elle-même."
    ],
    bonzini: "Balle lente = défense à l'ombre très efficace sur Bonzini contre les attaquants de bar.",
    exo: "Un pote déplace la balle lentement avec son avant central, tu suis avec ton arrière. Accélérez progressivement."
  },
  {
    id: "aleatoire", cat: "defense", nom: "La défense aléatoire", niveau: 4, poste: "Défense",
    resume: "Bouger tes barres de manière imprévisible pour que l'attaquant ne puisse pas lire ta défense.",
    etapes: [
      "Ne reste pas immobile : petits déplacements irréguliers des barres de défense.",
      "Change de rythme : parfois rapide, parfois une pause.",
      "Garde toujours la règle du mur : gardien et arrière complémentaires.",
      "Au moment où l'attaquant frappe, tu dois être couvert le plus possible."
    ],
    erreurs: [
      "Bouger « au hasard » mais toujours dans le même ordre : ça devient lisible.",
      "Bouger tellement que tu ouvres le but au moment du tir."
    ],
    bonzini: "Contre un bon tireur push/pull, mélange défense à l'ombre et aléatoire pour casser son timing.",
    exo: "Alterne 1 minute à l'ombre, 1 minute en aléatoire, contre un pote qui tire. Compare les buts encaissés."
  },
  {
    id: "couper-passes", cat: "defense", nom: "Couper les passes au milieu", niveau: 3, poste: "Milieu",
    resume: "Avec ta barre de 5, bloquer les passes adverses vers leurs avants.",
    etapes: [
      "Quand l'adversaire a la balle sur sa barre de 5, tes demis sont verticaux devant lui.",
      "Place-toi sur le couloir le plus probable (souvent la passe en bande).",
      "Suis la balle de façon souple, sans figer ta barre.",
      "Une passe interceptée = possession pour toi au milieu, juste devant ses avants. Contre !"
    ],
    erreurs: [
      "Laisser les demis à l'horizontale pendant qu'il prépare sa passe.",
      "Couvrir toujours la bande : il passe tranquillement au centre."
    ],
    bonzini: "Les 5 demis Bonzini couvrent beaucoup de largeur : bien placés, ils rendent les passes adverses très difficiles.",
    exo: "Un pote tente 20 passes depuis sa barre de 5. Objectif : en intercepter au moins 8.",
    diag: { hl: ["m", "M"], path: [[172, 58], [150, 42]], shift: { m: -10 } }
  },
  {
    id: "gardien", cat: "defense", nom: "Le gardien : placement et réflexes", niveau: 2, poste: "Défense",
    resume: "Le gardien se place selon la balle, pas au hasard au milieu du but.",
    etapes: [
      "Balle au centre : gardien au centre, arrières décalés de chaque côté.",
      "Balle sur un côté : le gardien se décale vers ce côté, l'arrière ferme l'angle long.",
      "Garde la main souple sur la poignée pour réagir vite.",
      "Après un arrêt, contrôle la balle au lieu de la dégager à l'aveugle."
    ],
    erreurs: [
      "Gardien qui ne bouge jamais : l'adversaire tire toujours au même coin.",
      "Dégager en roulette : but refusé et balle perdue."
    ],
    bonzini: "Le gardien Bonzini est seul sur sa barre : sa position compte double. Bouge avec la balle.",
    exo: "Un pote tire 30 fois. Tu ne joues QUE le gardien (arrières relevés). Compte les arrêts.",
    diag: { hl: ["g", "A"], path: [[98, 44], [36, 78]], shift: { g: -10 } }
  },

  /* ---------------- TACTIQUE ---------------- */
  {
    id: "varier", cat: "tactique", nom: "Varier ses tirs", niveau: 3, poste: "Attaque",
    resume: "Un tir maîtrisé c'est bien, trois tirs mélangés c'est imprenable.",
    etapes: [
      "Maîtrise au moins deux options depuis la même position (ex. push long + pull court).",
      "Ne tire jamais deux fois de suite exactement pareil.",
      "Note mentalement ce qui passe et ce qui est arrêté.",
      "Garde ton meilleur tir pour les points importants."
    ],
    erreurs: [
      "Toujours le même tir parce qu'il a marché une fois (syndrome Lolo).",
      "Changer de tir à chaque fois sans en maîtriser aucun."
    ],
    bonzini: "Au bar, les adversaires s'adaptent vite : dès qu'ils arrêtent ton tir deux fois, change.",
    exo: "Série de 30 tirs avec 3 options : impose-toi un ordre aléatoire (dé ou appli)."
  },
  {
    id: "rythme", cat: "tactique", nom: "Le rythme et la pause", niveau: 4, poste: "Attaque",
    resume: "Casser le rythme avant de tirer : pause, petite feinte, puis frappe d'un coup.",
    etapes: [
      "Balle en pince, compte mentalement un rythme irrégulier (1… 2-3).",
      "Fais une micro-pause pour figer la défense.",
      "Frappe d'un coup, sans mouvement préparatoire visible.",
      "En compétition, n'oublie pas la limite de temps de possession."
    ],
    erreurs: [
      "Tirer toujours au même moment après le contrôle.",
      "Attendre si longtemps que l'adversaire a le temps de commander une bière."
    ],
    bonzini: "Au bar personne ne chronomètre, mais les bons joueurs comptent : garde l'habitude de tirer en moins de 15 secondes.",
    exo: "20 tirs où tu changes le moment de déclenchement à chaque fois (1 s, 3 s, 5 s…)."
  },
  {
    id: "lire", cat: "tactique", nom: "Lire la défense adverse", niveau: 4, poste: "Tous",
    resume: "Observer comment l'adversaire défend pour trouver ses habitudes et ses trous.",
    etapes: [
      "Les premiers points, regarde où il place son gardien quand tu as la balle.",
      "Repère s'il suit la balle (ombre) ou s'il bouge au hasard.",
      "Teste un tir et regarde sa réaction : s'il se décale toujours du même côté, tire de l'autre.",
      "Adapte-toi : un bon joueur change en cours de match."
    ],
    erreurs: [
      "Ne regarder que sa propre balle, jamais l'adversaire.",
      "Se fier à une seule observation."
    ],
    bonzini: "Au bar, beaucoup de défenseurs ne bougent que leur gardien : vise le côté couvert seulement par l'arrière.",
    exo: "Pendant une partie, note après chaque point : où était le gardien ? où as-tu tiré ?"
  },
  {
    id: "mental", cat: "tactique", nom: "Le mental (anti-tilt)", niveau: 2, poste: "Tous",
    resume: "Ne pas s'énerver après une gamelle. Un joueur énervé fait des roulettes.",
    etapes: [
      "Après un but encaissé : lâche les poignées, respire, secoue les mains.",
      "Concentre-toi sur le point suivant, pas sur le score.",
      "Garde la même technique même quand tu perds (pas de bourrinage).",
      "Au bar : chambrer, oui ; se vexer, non."
    ],
    erreurs: [
      "Taper sur la table après un but : ça ne la rend pas plus gentille.",
      "Passer en mode roulette quand on perd 5-0 (oui Lolo, on t'a vu)."
    ],
    bonzini: "Une partie au bar se joue souvent en 10 buts : il y a toujours le temps de revenir. Pas de panique.",
    exo: "Pendant une partie, à chaque but encaissé : 3 secondes de pause mains lâchées avant l'engagement."
  },
  {
    id: "double", cat: "tactique", nom: "Jouer en double : la communication", niveau: 2, poste: "Tous",
    resume: "Bien répartir les rôles et se parler entre deux points.",
    etapes: [
      "Le défenseur gère gardien + arrières, l'attaquant gère demis + avants.",
      "Entre deux points : « il tire toujours à gauche », « relève tes demis quand je tire ».",
      "Le défenseur relance vers les demis, l'attaquant ne descend jamais défendre à sa place.",
      "Encourage ton partenaire, même s'il s'appelle Lolo."
    ],
    erreurs: [
      "Toucher les barres de son partenaire : interdit en officiel, et énervant au bar.",
      "Engueuler son coéquipier : il jouera encore plus mal."
    ],
    bonzini: "Avec les barres traversantes Bonzini, attention à ne pas pousser une barre dans le ventre de ton coéquipier.",
    exo: "Une partie en double où vous devez vous dire au moins une info utile entre chaque point."
  },
  {
    id: "temps-mort", cat: "tactique", nom: "Utiliser les temps morts", niveau: 4, poste: "Tous",
    resume: "En compétition, un temps mort sert à casser la série de l'adversaire et à changer de plan.",
    etapes: [
      "Demande un temps mort quand l'adversaire enchaîne 2-3 buts.",
      "Pendant ce temps : respire, sèche tes mains, décide d'un changement (défense, tir).",
      "En double, profites-en pour partager ce que vous avez remarqué.",
      "Au bar, l'équivalent : « attends, je refais mes lacets »."
    ],
    erreurs: [
      "Gaspiller son temps mort au premier but encaissé.",
      "Prendre un temps mort sans rien changer ensuite."
    ],
    bonzini: "En tournoi Bonzini (règles ITSF), le nombre et la durée des temps morts sont limités : vérifie le règlement du tournoi.",
    exo: "Simulation : pendant une partie, arrête-toi à 0-3 et choisis UN changement. Rejoue et observe."
  }
];

/* ---------------- PROGRAMMES D'ENTRAÎNEMENT ---------------- */
const PROGRAMMES = [
  {
    id: "sauvetage", nom: "Opération Sauvetage", niveaux: [1, 2],
    pitch: "Pour Lolo et ses semblables. 4 semaines pour arrêter la roulette, contrôler la balle et marquer exprès.",
    semaines: [
      { titre: "Semaine 1 — Désintox de la roulette", objectif: "Prise souple, posture, zéro roulette.", seances: [
        { titre: "Séance 1", exos: ["5 min — Échauffement : poignets, épaules, mains souples", "15 min — Prise de poignée : 3 × 30 frappes main relâchée", "10 min — Partie sans roulette (5 pompes par roulette)"] },
        { titre: "Séance 2", exos: ["10 min — Posture : filme-toi et corrige", "15 min — Amorti sur la barre de 5 : 20 arrêts propres", "10 min — Frappe directe : 3 × 10 dans les coins"] },
        { titre: "Séance 3", exos: ["10 min — Regarder la balle : 5 min sans baisser les yeux", "15 min — Amortis sur toutes les barres", "15 min — Partie libre en appliquant tout ça"] }
      ]},
      { titre: "Semaine 2 — La balle t'obéit", objectif: "Amorti et pince sans réfléchir.", seances: [
        { titre: "Séance 1", exos: ["10 min — Amortis : 30 balles lancées à la main", "15 min — Pince devant l'avant central : 3 × 20", "10 min — Frappe directe depuis la pince"] },
        { titre: "Séance 2", exos: ["10 min — Pince + déplacement latéral d'un pied à l'autre", "10 min — Contrôle de l'engagement : 20 engagements", "15 min — Mur gardien + arrière contre les tirs d'un pote"] },
        { titre: "Séance 3", exos: ["10 min — Révision pince", "10 min — Barres neutres : 10 tirs longs barres relevées", "15 min — Partie en 10 buts : compte tes contrôles réussis"] }
      ]},
      { titre: "Semaine 3 — Premiers vrais buts", objectif: "Passe en bande + frappe, défense en mur.", seances: [
        { titre: "Séance 1", exos: ["10 min — Pince + frappe : 30 tirs", "15 min — Passe en bande : 20 de chaque côté", "10 min — Relance défense → milieu : 10 relances propres"] },
        { titre: "Séance 2", exos: ["10 min — Gardien seul contre 30 tirs", "15 min — Enchaînement passe en bande → contrôle → frappe", "10 min — Mental : pause de 3 s après chaque but encaissé"] },
        { titre: "Séance 3", exos: ["15 min — Le mur : gardien + arrière complémentaires", "10 min — Frappe directe dans les coins", "15 min — Partie : objectif zéro contre-son-camp"] }
      ]},
      { titre: "Semaine 4 — Revanche sur les potes", objectif: "Tout assembler en match.", seances: [
        { titre: "Séance 1", exos: ["10 min — Échauffement complet (amorti, pince, frappe)", "15 min — Passe en bande + frappe : 20 enchaînements", "15 min — Partie en double, communication obligatoire"] },
        { titre: "Séance 2", exos: ["10 min — Tirs longs défensifs, barres relevées", "10 min — Gardien + arrière contre push / pull d'un pote", "15 min — Partie : note tes stats dans l'onglet Progression"] },
        { titre: "Séance 3", exos: ["5 min — Échauffement", "30 min — Mini-tournoi avec les potes", "5 min — Bilan : quelles techniques cocher comme maîtrisées ?"] }
      ]}
    ]
  },
  {
    id: "pmu", nom: "Du PMU au club", niveaux: [3],
    pitch: "Tu contrôles la balle ? Maintenant on construit un vrai jeu : passes, push / pull, défense à l'ombre.",
    semaines: [
      { titre: "Semaine 1 — Le milieu de terrain", objectif: "Passes en bande, couloir, brossée.", seances: [
        { titre: "Séance 1", exos: ["10 min — Pince en bande : 15 de chaque côté", "15 min — Passe en bande : 40 passes, compte les contrôlées", "10 min — Tic-tac sur la barre de 5 : 10 transferts sans perte"] },
        { titre: "Séance 2", exos: ["15 min — Passe dans le couloir contre une barre de 5 qui bouge", "10 min — Passe brossée : 15 de chaque côté", "10 min — Couper les passes : 20 passes adverses"] },
        { titre: "Séance 3", exos: ["10 min — Mélange des 3 passes au hasard", "10 min — Relance défense → milieu", "15 min — Partie : au moins 50 % de passes contrôlées"] }
      ]},
      { titre: "Semaine 2 — Push & pull", objectif: "Deux tirs depuis la même position.", seances: [
        { titre: "Séance 1", exos: ["10 min — Pince devant l'avant central", "20 min — Push : 3 × 10 (long, court, milieu)", "10 min — Frappe directe d'échauffement"] },
        { titre: "Séance 2", exos: ["20 min — Pull : 3 × 10 (long, court, milieu)", "10 min — Push / pull au hasard (pile ou face)", "10 min — Défense à l'ombre contre un pote"] },
        { titre: "Séance 3", exos: ["15 min — 30 tirs push / pull, note ton taux", "10 min — Tir en bande : 20 tirs", "15 min — Partie : un seul type de tir interdit au choix du pote"] }
      ]},
      { titre: "Semaine 3 — Défendre comme un pro", objectif: "Ombre, mur et gardien.", seances: [
        { titre: "Séance 1", exos: ["15 min — Défense à l'ombre, vitesse croissante", "10 min — Gardien seul contre 30 tirs", "10 min — Relance après arrêt : contrôle puis passe"] },
        { titre: "Séance 2", exos: ["10 min — Le mur : gardien + arrière", "15 min — Couper les passes : objectif 8 sur 20", "10 min — Tir long défensif, barres relevées"] },
        { titre: "Séance 3", exos: ["15 min — Défense contre push / pull : observe les habitudes", "10 min — Tic-tac tir pour l'attaque", "15 min — Partie : compte les buts encaissés"] }
      ]},
      { titre: "Semaine 4 — Le match complet", objectif: "Enchaîner milieu → attaque → défense.", seances: [
        { titre: "Séance 1", exos: ["10 min — Échauffement passes", "15 min — Passe + push / pull : 20 enchaînements", "15 min — Partie en 2 manches de 5"] },
        { titre: "Séance 2", exos: ["10 min — Varier ses tirs : 30 tirs, 3 options aléatoires", "10 min — Défense à l'ombre", "15 min — Partie : note tes stats"] },
        { titre: "Séance 3", exos: ["5 min — Échauffement", "30 min — Tournoi entre potes, règles officielles", "5 min — Bilan et coche tes techniques"] }
      ]}
    ]
  },
  {
    id: "compet", nom: "Mode Compétition", niveaux: [4, 5],
    pitch: "Pour les requins. Snake, une touche, défense aléatoire, lecture de jeu et gestion du temps.",
    semaines: [
      { titre: "Semaine 1 — Les tirs avancés", objectif: "Une touche, tic-tac tir, snake (début).", seances: [
        { titre: "Séance 1", exos: ["10 min — Push / pull d'échauffement : 20 tirs", "15 min — Snake : roulé sans balle puis avec balle", "15 min — Tic-tac tir : 20 + 20 avec double transfert"] },
        { titre: "Séance 2", exos: ["15 min — Reprise en une touche sur passe en bande", "15 min — Snake : 3 × 10 en visant un coin", "10 min — Tir en bande"] },
        { titre: "Séance 3", exos: ["15 min — 3 options de tir dans un ordre aléatoire", "10 min — Snake sous pression (pote en défense)", "15 min — Partie : objectif 60 % de tirs cadrés"] }
      ]},
      { titre: "Semaine 2 — Le jeu de milieu pro", objectif: "Feinte de passe et rythme.", seances: [
        { titre: "Séance 1", exos: ["15 min — Feinte de passe : alterné avec passe directe", "15 min — Passes sous la limite de 10 secondes", "10 min — Couper les passes"] },
        { titre: "Séance 2", exos: ["15 min — Passe brossée + reprise une touche", "15 min — Le rythme : 20 tirs à déclenchement variable", "10 min — Tic-tac sur la barre de 5"] },
        { titre: "Séance 3", exos: ["10 min — Feintes", "10 min — Couloir contre défenseur rapide", "20 min — Partie avec chrono de possession"] }
      ]},
      { titre: "Semaine 3 — La défense illisible", objectif: "Aléatoire + ombre, lecture de l'attaquant.", seances: [
        { titre: "Séance 1", exos: ["15 min — Défense aléatoire contre push / pull", "15 min — Alternance ombre / aléatoire chaque minute", "10 min — Relances rapides en contre"] },
        { titre: "Séance 2", exos: ["15 min — Lire l'attaquant : note ses habitudes sur 20 tirs", "10 min — Gardien seul contre snake", "15 min — Partie : moins de 5 buts encaissés par manche"] },
        { titre: "Séance 3", exos: ["10 min — Défense mixte", "15 min — Tirs longs défensifs en contre", "15 min — Partie en 3 manches de 5"] }
      ]},
      { titre: "Semaine 4 — Prêt pour le tournoi", objectif: "Gestion du match, temps morts, mental.", seances: [
        { titre: "Séance 1", exos: ["10 min — Échauffement tirs + passes", "20 min — Match avec règles ITSF complètes", "10 min — Analyse : ce qui passe, ce qui est arrêté"] },
        { titre: "Séance 2", exos: ["15 min — Situations : mené 0-3, à toi de jouer", "15 min — Temps mort : un changement de plan, puis rejouer", "10 min — Mental : routine avant chaque tir"] },
        { titre: "Séance 3", exos: ["5 min — Échauffement", "35 min — Tournoi : filme un match et analyse-le", "5 min — Bilan final et mise à jour de la progression"] }
      ]}
    ]
  }
];

/* ---------------- RÈGLES ---------------- */
const REGLES_BAR = [
  { titre: "La gamelle", txt: "Balle qui rentre dans le but puis ressort. Au bar, elle compte en général, et selon les tables elle retire en plus un point à celui qui la prend. À fixer avant la partie." },
  { titre: "La pissette", txt: "Tir de l'ailier de la barre de 3 (l'avant collé à la bande) directement dans le coin du but. Ailier droit = pissette, ailier gauche = pissette inversée. Autorisée en compétition, mais souvent interdite au bar : « pas de pissette ! ». C'est LA règle qui crée le plus de disputes, annonce-la avant le premier engagement." },
  { titre: "Le demi", txt: "But marqué directement depuis la barre du milieu. Selon les bars, il est interdit ou compte normalement. Là aussi : on se met d'accord avant." },
  { titre: "La roulette", txt: "Faire tourner la barre à 360° pour frapper. Interdit partout : le but ne compte pas. Au bar, ça peut aussi te coûter une tournée." },
  { titre: "La partie", txt: "Au bar, on joue souvent en 10 buts (parfois 11 ou en manches de 5). Le perdant du point engage." },
  { titre: "L'engagement", txt: "Sur la plupart des Bonzini de bar, la balle est lancée par le trou d'engagement sur le côté. Lancer la balle avec un effet bizarre pour piéger l'adversaire, ça se fait… mais ça se discute." },
  { titre: "La Fanny", txt: "Perdre sans marquer un seul but. La tradition : embrasser la Fanny (le tableau ou la statuette du bar) ou passer sous la table. Lolo connaît bien le dessous des tables." },
  { titre: "Le but du gardien", txt: "Dans certains bars, un but marqué par le gardien compte double. Dans d'autres, il ne compte pas. Demande toujours." },
  { titre: "Mains hors du terrain", txt: "On ne touche pas la balle à la main quand elle est en jeu, on ne souffle pas dessus et on ne secoue pas la table. Même quand on perd." }
];

const REGLES_OFFICIELLES = [
  { titre: "Format du match", txt: "Manches en 5 buts, match en 2 ou 3 manches gagnantes selon le tournoi. Les équipes changent de côté entre les manches." },
  { titre: "Engagement", txt: "Tirage au sort pour le premier engagement, puis c'est l'équipe qui vient d'encaisser un but qui engage, depuis sa barre du milieu." },
  { titre: "Tous les buts comptent", txt: "Pas de « demi » interdit en officiel : un but marqué depuis n'importe quelle barre compte, gardien compris. Une balle qui rentre puis ressort compte aussi." },
  { titre: "Temps de possession", txt: "Limite de temps quand la balle est contrôlée : 10 secondes sur la barre du milieu, 15 secondes dans les autres zones (règles ITSF). Au-delà, la balle est rendue à l'adversaire." },
  { titre: "Roulette interdite", txt: "Faire tourner un joueur de plus de 360° avant ou après la frappe est interdit. Le but est annulé et la balle rendue à l'adversaire." },
  { titre: "Pas de secousses", txt: "Secouer, soulever ou cogner la table est interdit (« jarring »). Sanction possible en cas de récidive." },
  { titre: "Mains hors du terrain", txt: "Interdit de mettre la main dans l'aire de jeu tant que la balle est en jeu, sauf autorisation de l'adversaire ou de l'arbitre." },
  { titre: "Temps morts", txt: "Nombre de temps morts limité par manche (2 de 30 secondes en ITSF). En double, les joueurs peuvent changer de poste pendant un temps mort ou entre les manches." },
  { titre: "Passes au milieu", txt: "Des restrictions existent sur les passes depuis la barre du milieu (balle arrêtée, touches de bande). Les détails changent selon les versions du règlement." },
  { titre: "Fair-play", txt: "Interdit de distraire l'adversaire (cris, bruits de barre inutiles quand il a la balle). Chambrer, c'est pour le bar." }
];

const LEXIQUE = [
  ["Amorti", "Arrêter une balle qui arrive en accompagnant le joueur vers l'arrière."],
  ["Pince", "Balle coincée sous le pied d'un joueur incliné. Base de la plupart des tirs."],
  ["Push / Pull", "Tir en poussant / en tirant la barre latéralement juste avant de frapper."],
  ["Snake", "Tir où la barre roule dans la paume ouverte. Le plus rapide."],
  ["Tic-tac", "Transfert de la balle entre deux joueurs d'une même barre."],
  ["Couloir", "Espace libre entre deux joueurs adverses par lequel la balle peut passer."],
  ["Bande", "Bord latéral de la table, utilisé pour les passes et tirs en rebond."],
  ["Gamelle", "Balle qui rentre dans le but puis ressort."],
  ["Demi", "But marqué depuis la barre du milieu. Règle variable au bar."],
  ["Pissette", "Tir de l'ailier de la barre de 3 dans le coin du but. Ailier gauche = pissette inversée. Souvent interdite au bar."],
  ["Roulette", "Rotation complète de la barre pour frapper. Interdite."],
  ["Fanny", "Perdre sans marquer. Synonyme de « soirée de Lolo »."],
  ["ITSF / FFFT", "Fédération internationale / Fédération française de football de table, qui publient les règles officielles."]
];

/* ---------------- QUIZ ---------------- */
const QUIZ = [
  { q: "Avec quelle partie de la main tient-on la poignée ?", r: ["Le fond de la paume, bien serré", "Les doigts, poignet souple", "Le bout des ongles"], ok: 1, exp: "Doigts + poignet souple = vitesse et précision. La main crispée, c'est pour Lolo." },
  { q: "Un but marqué en roulette…", r: ["Compte double", "Compte normalement", "Ne compte pas"], ok: 2, exp: "Roulette interdite au bar comme en compétition : but refusé." },
  { q: "Qu'est-ce qu'une « pince » ?", r: ["Balle coincée sous le pied d'un joueur incliné", "Un tir en bande", "Une faute du gardien"], ok: 0, exp: "La pince est la position de départ de presque tous les tirs." },
  { q: "Combien de joueurs sur la barre du milieu d'un Bonzini ?", r: ["3", "4", "5"], ok: 2, exp: "1 gardien, 2 arrières, 5 demis, 3 avants." },
  { q: "En règles officielles, qui engage après un but ?", r: ["L'équipe qui a marqué", "L'équipe qui a encaissé", "On tire au sort à chaque fois"], ok: 1, exp: "L'équipe qui vient d'encaisser engage depuis sa barre du milieu." },
  { q: "Une « gamelle », c'est…", r: ["Une balle qui rentre puis ressort du but", "Un tir raté", "Une balle sortie de la table"], ok: 0, exp: "Au bar, elle peut même retirer un point. Vérifie les règles locales." },
  { q: "Tu tires depuis ton arrière. Que fais-tu avec tes demis et avants ?", r: ["Je les laisse verticaux", "Je les relève à l'horizontale", "Je les fais tourner pour aider"], ok: 1, exp: "Relève-les pour ne pas bloquer ton propre tir, puis redescends-les." },
  { q: "Le push et le pull sont des tirs qui partent de…", r: ["L'avant central avec la balle en pince", "Le gardien", "La barre du milieu uniquement"], ok: 0, exp: "Balle en pince devant l'avant central, déplacement latéral puis frappe." },
  { q: "En officiel, temps max avec la balle sur la barre du milieu ?", r: ["5 secondes", "10 secondes", "30 secondes"], ok: 1, exp: "10 secondes au milieu, 15 secondes dans les autres zones (ITSF)." },
  { q: "En défense « à l'ombre »…", r: ["Tu éteins la lumière du bar", "Ton arrière suit la balle, le gardien couvre le reste", "Tes joueurs restent à l'horizontale"], ok: 1, exp: "L'arrière se place pile en face de la balle et la suit." },
  { q: "Une passe en bande sert à…", r: ["Contourner les demis adverses", "Marquer contre son camp", "Gagner du temps"], ok: 0, exp: "La bande permet de contourner la barre de 5 adverse vers tes avants." },
  { q: "Faire la « Fanny », c'est…", r: ["Gagner 10-0", "Perdre sans marquer un seul but", "Marquer avec le gardien"], ok: 1, exp: "Et ensuite, passer sous la table. Tradition oblige." },
  { q: "Ton adversaire arrête ton push deux fois de suite. Tu…", r: ["Tires encore plus fort en push", "Changes de tir (pull, bande…)", "Fais une roulette"], ok: 1, exp: "Varier ses tirs est la clé : il s'est calé sur ton push." },
  { q: "La « pissette », c'est…", r: ["Un tir de l'ailier de la barre de 3 dans le coin", "Un but marqué par le gardien", "Une balle qui sort de la table"], ok: 0, exp: "Ailier droit = pissette, ailier gauche = pissette inversée. Souvent interdite au bar : demande avant !" },
  { q: "Pour un snake, la poignée est…", r: ["Tenue à pleine main", "Posée à plat dans la paume ouverte", "Tenue avec deux doigts"], ok: 1, exp: "Paume ouverte, la barre roule : c'est ce qui donne la vitesse." },
  { q: "Après un but encaissé, le meilleur réflexe :", r: ["Taper sur la table", "Lâcher les poignées et respirer 3 secondes", "Accuser son coéquipier"], ok: 1, exp: "Anti-tilt : un joueur énervé fait des roulettes." }
];

const VERDICTS_QUIZ = [
  { min: 0,  txt: "Lolo, c'est toi ? Retour à l'onglet Techniques, direct." },
  { min: 5,  txt: "Niveau comptoir. Tu connais les règles… de la belote." },
  { min: 9,  txt: "Pas mal ! Tu peux expliquer la gamelle à Lolo (bon courage)." },
  { min: 12, txt: "Requin confirmé. Les règles n'ont plus de secret pour toi." },
  { min: 16, txt: "Sans faute. L'ITSF va t'appeler pour arbitrer." }
];

/* ---------------- VANNES ---------------- */
const VANNES = [
  "Lolo a déjà marqué trois fois contre son camp. Dans la même minute.",
  "Lolo pense que la « pince » c'est pour ouvrir les bières.",
  "Le Bonzini du bar a demandé une ordonnance restrictive contre Lolo.",
  "Lolo appelle la roulette « sa signature ».",
  "Quand Lolo engage, l'adversaire commande déjà la tournée de la victoire.",
  "Lolo connaît le dessous de toutes les tables de babyfoot du quartier.",
  "Lolo a un jour arrêté un tir. Il regardait son téléphone, la balle a tapé dans son gardien.",
  "Lolo croit que le snake est un cocktail.",
  "La Fanny du bar a reconnu Lolo dans la rue.",
  "Lolo a réclamé la VAR pour une gamelle. On jouait en 10 buts, il perdait 0-9.",
  "Le gardien de Lolo est classé espèce protégée : il ne bouge jamais.",
  "Lolo fait du tic-tac. Surtout avec sa montre en attendant que la partie finisse."
];

const RANGS_NULO = [
  { max: 100, nom: "Nulo absoluto", txt: "Le Bonzini pleure quand tu arrives." },
  { max: 80,  nom: "Nulo chronique", txt: "Tu sais où est le but. C'est un début." },
  { max: 60,  nom: "Ex-nulo en rééducation", txt: "Lolo commence à te regarder avec méfiance." },
  { max: 40,  nom: "Menace de bar", txt: "Les habitués baissent la voix quand tu prends les poignées." },
  { max: 20,  nom: "Anti-Lolo", txt: "Tu es officiellement tout l'inverse de Lolo. Félicitations." }
];
