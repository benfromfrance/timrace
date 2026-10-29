# Timcar

Jeu 2D web, 1 ou 2 joueurs en local, jouable aux manettes Xbox : **solo**, **duel** ou **coopération**.

Déroulé : rejoindre (Ⓐ) → lancer (☰ seul, Ⓐ ou ☰ à deux) → choisir son personnage → choisir le mode et l'arène → jouer.

## Stack

| Outil | Rôle |
|---|---|
| [Phaser 4](https://phaser.io) | Moteur 2D (WebGL/Canvas, physique Arcade, particules, scènes) |
| TypeScript 7 | Typage strict |
| Vite 8 | Serveur de dev (HMR) et build |
| Gamepad API (navigateur) | Manettes Xbox, lues directement via `navigator.getGamepads()` |

## Démarrer

```bash
git clone https://github.com/benfromfrance/timrace.git
cd timrace
npm install
npm run dev        # http://localhost:5173 (aussi accessible sur le réseau local)
npm run build      # build de prod dans dist/
```

## Manettes Xbox

1. Branchez les manettes en USB ou appairez-les en Bluetooth (Xbox Series / One S et ultérieures).
2. Ouvrez le jeu, puis **appuyez sur un bouton** : par sécurité, le navigateur ne montre les manettes qu'après une première action.
3. Chaque joueur appuie sur **Ⓐ** pour rejoindre la partie, puis sur **Ⓐ** ou **☰** pour la lancer.

Navigateurs conseillés : Chrome ou Edge, qui gèrent aussi les vibrations. Firefox et Safari marchent, avec des vibrations limitées.

| Action | Manette | Clavier J1 | Clavier J2 |
|---|---|---|---|
| Bouger | Stick gauche / croix | ZQSD (WASD) | Flèches |
| Dash / valider | Ⓐ | Espace | Entrée |
| Pouvoir du personnage | Ⓨ ou LB | G | . (: en AZERTY) |
| Tirer (maintenir avec une arme bonus ; coup d'épée si on a l'épée) | Ⓧ, RB ou RT | F | Shift droit |
| Retour (menus) · ranger / ressortir l'épée (en jeu) | Ⓑ | E | Échap |
| Menus | Stick / croix | ZQSD | Flèches |
| Start | ☰ | R | Retour arrière |

## Son

Sons et musiques (menus, combat, boss) sont **synthétisés en direct** (Web Audio API), sans fichier audio. Le navigateur n'autorise le son qu'après un **clic ou une touche du clavier** (les manettes ne comptent pas). **M** coupe / remet le son.

## Armes bonus (caisses)

| Caisse | Arme | Effet |
|---|---|---|
| 🔫 | Mitraille | Tir continu en maintenant le bouton |
| 💥 | Fusil à pompe | 6 plombs en éventail, courte portée |
| 🎯 | Tête chercheuse | Missile qui suit le monstre ou l'adversaire le plus proche |
| 🪃 | Boomerang | Traverse les ennemis puis revient vers son lanceur |
| 🧨 | Mines | Posées derrière soi, explosent au passage d'un ennemi |

## Action replay

À la fin de chaque partie, les **3 dernières secondes** sont rejouées avant le podium : rembobinage VHS, ralenti cinéma (bandes noires, ● REPLAY, traînées de mouvement), **bullet time** avec zoom sur le moment décisif (victoire, mort du boss ou dernier coup reçu), puis image figée avec tampon « K.O. ! », « BOSS VAINCU ! » ou « GAME OVER ». **☰** (ou Ⓐ après 1 s) pour passer.

## Statistiques

Depuis l'accueil, **Ⓧ** ouvre l'écran des statistiques (enregistrées dans le navigateur) : parties jouées, victoires, temps de jeu, étoiles et monstres, réussite par mode, boss rencontrés / vaincus avec record de vitesse, parties et victoires par personnage et par arène. Les parties abandonnées ne sont pas comptées.

## Défis

Accessibles depuis l'accueil avec **Ⓨ**. Progression enregistrée dans le navigateur (localStorage).

| Défi | Condition | Récompense |
|---|---|---|
| Première victoire | Gagner un duel | **Pyro** |
| Chasseur de monstres | Tuer 50 monstres (cumulé) | **Ombre** |
| Régicide | Vaincre un boss final | **Arène Volcan** |
| Intouchable | Vaincre le boss sans perdre de cœur pendant le combat | trophée |
| Réaction en chaîne | Tuer 3 monstres avec une seule explosion | trophée |
| Pie voleuse | Ramasser 5 étoiles tombées en une partie | trophée |
| Collectionneur | Ramasser 5 caisses d'armes en une partie | trophée |
| Héros solitaire | Accomplir la mission en solo | trophée |

## Personnages

| | Personnage | Trait | Pouvoir (Ⓨ) |
|---|---|---|---|
| ⚡ | Zip | Très rapide | **Éclair** : téléportation dans la direction visée |
| ❄️ | Glacia | Contrôle de zone | **Onde de givre** : gèle les monstres proches, ralentit l'adversaire |
| 🛡️ | Bastion | Lourd et lent | **Rempart** : bouclier 3 s (invincible, bloque les tirs, repousse les monstres) |
| 🧲 | Magna | Chasseuse d'étoiles | **Aimant** : attire toutes les étoiles pendant 3 s |
| 🔥 | Pyro | Puissance de feu | **Nova** : 12 boules de feu tout autour |
| 👻 | Ombre | Insaisissable | **Fondu** : invisible 3 s, ignoré par les monstres, traversé par les tirs |

## Monstres

De nouveaux types se débloquent au fil de la partie. Tuer un monstre donne une épée pendant 5 s.

| Monstre | Pouvoir | Débloqué à |
|---|---|---|
| Gloubi (violet) | Poursuit sans relâche | début |
| Fusée (orange) | **Charge** : se gonfle puis fonce en ligne droite | début |
| Cracheur (vert) | **Crachat gluant** : garde ses distances, sa glu ralentit | 20 s |
| Bombe (noire) | **Kaboum** : s'allume puis explose, blessant joueurs *et* monstres | 20 s |
| Spectre (blanc) | **Apparition** : traverse les murs, disparaît puis réapparaît près de sa cible | 40 s |
| Mitose (rose) | **Division** : résistant, se coupe en deux Mini-Mitoses en mourant | 40 s |

**Boss final (coopération et solo)** : une fois l'objectif d'étoiles atteint, l'arène se vide (+2 ❤) et un boss **tiré au hasard** arrive. Chacun a 3 phases selon ses PV (enragé et rouge sous 33 %) ; le vaincre fait gagner la partie.

| Boss | Phase 1 | Phase 2 (< 66 %) | Phase 3 (< 33 %) |
|---|---|---|---|
| 👑 Roi Gloubi | Anneaux de projectiles | + invoque des Fusées | Charges furieuses |
| ❄️ Reine Givre | Blizzard en spirale (garde ses distances) | + plaques de givre qui ralentissent | Se téléporte, triple spirale |
| 🌋 Golem de Lave | Lance des rochers | + séisme autour de lui (zone annoncée en rouge) | Pluie de météores sur les joueurs |
| 👻 Spectre Ancien | Tirs en croix tournants | + invoque des Spectres | Apparitions éclair suivies d'un anneau |

## Modes

- **Duel** : le premier à 10 étoiles gagne. Monstres, lave et coups d'épée font perdre une étoile.
- **Solo** : les règles de la coopération pour un joueur : 15 étoiles, moins de monstres, boss à 60 % de ses PV.
- **Coopération** : ramassez 20 étoiles ensemble puis battez le boss final, avant de perdre vos 5 cœurs partagés. Des cœurs apparaissent de temps en temps (quand il manque de la vie) pour en récupérer un. Pas de tir ami ; les monstres sont de plus en plus nombreux.

## Arènes

- **Classique** : dégagée.
- **Forteresse** : piliers et croix centrale qui bloquent tirs et monstres.
- **Patinoire** : sol glacé et plots rebondissants.
- **Volcan** : bassins de lave.

Personnages, arènes et armes sont des données (`src/characters.ts`, `src/arenas.ts`, `src/weapons.ts`) : en ajouter se fait surtout dans ces fichiers.

## Architecture

```
src/
  main.ts              config Phaser
  config.ts            constantes (taille, couleurs, score)
  weapons.ts           armes (missile, mitraille…) et armes bonus
  characters.ts        personnages et pouvoirs
  challenges.ts        défis, récompenses et sauvegarde de la progression
  stats.ts             statistiques des parties (localStorage)
  replay.ts            enregistrement des dernières secondes pour le replay
  audio/Sound.ts       effets sonores et musiques synthétisés
  ui/toast.ts          bandeau « Défi réussi »
  monsters.ts          types de monstres (PV, vitesse, déblocage) et boss
  arenas.ts            arènes (murs, plots, lave, adhérence)
  match.ts             réglages choisis dans les menus (persos, mode, arène)
  input/
    Controls.ts        interface commune ControlState / ControlSource
    GamepadSource.ts   manette (mapping standard Xbox, zone morte, vibrations)
    KeyboardSource.ts  clavier de secours
    InputManager.ts    détection des manettes et attribution joueur ↔ manette
  scenes/
    BootScene.ts       génération ou chargement des assets
    LobbyScene.ts      « Appuyez sur Ⓐ pour rejoindre »
    ChallengesScene.ts liste des défis
    StatsScene.ts      écran des statistiques
    CharacterSelectScene.ts  choix du personnage
    MatchSetupScene.ts choix du mode et de l'arène
    GameScene.ts       le jeu (duel / coop, pouvoirs, armes, monstres, arène)
    ReplayScene.ts     action replay de fin de partie
    PodiumScene.ts     écran de fin (podium ou bilan d'équipe)
  objects/
    Player.ts
    Monster.ts         comportement de chaque type de monstre et du boss
```

Le gameplay ne lit que `player.controls.state` (`moveX`, `moveY`, `actionPressed`…). Il ne sait donc pas si le joueur utilise une manette ou le clavier. Pour ajouter un bouton, étendez `ControlState` puis remplissez-le dans les deux sources.

Les assets (sprites, sons) vont dans `public/` et se chargent dans `BootScene.preload()`.

## Licence

[MIT](LICENSE) © Benoit Defrance
