# PorLolo el nulo

Le centre de formation pour arrêter d'être nul au babyfoot (spécial Bonzini) :
techniques avec schémas animés, programme d'entraînement de 4 semaines,
suivi de progression, règles de bar et officielles, quiz.

Site 100 % statique (HTML / CSS / JS), aucune installation : ouvrir `index.html`.

## Multijoueur

Salons à code (façon Kahoot) et tournois, via Supabase Realtime (broadcast + presence, sans base de données).
Renseigner l'URL du projet et la clé **anon / publishable** dans `js/config.js`.
Ne jamais y mettre la clé `service_role` / `secret`.

Test en local sans Supabase : ouvrir le site avec `?local=1` dans deux onglets (réseau simulé entre onglets).
