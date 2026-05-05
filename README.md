# AGR Tactical Board

Outil de tactique rugby pour le club AGR. Permet aux coaches de concevoir, animer et exporter des combinaisons tactiques.

---

## Stack

- **Frontend** — React 18 · TypeScript · Vite 8 · Tailwind CSS v4 · Zustand 5 · Immer 11 · Lucide React
- **Desktop** — Tauri v2 (macOS `.dmg`, Windows `.msi` + `.exe`)
- **CI/CD** — GitHub Actions (build macOS + Windows → release automatique sur tag)

---

## Développement

```bash
npm install
npm run dev          # Lance le serveur Vite sur localhost:5173
npm run tauri:dev    # Lance l'app desktop en mode dev (hot-reload)
```

---

## Build

```bash
npm run build        # Build frontend uniquement (TypeScript check + Vite)
npm run tauri:build  # Build desktop complet (macOS .dmg ou Windows .msi/.exe)
```

Les artefacts sont générés dans `src-tauri/target/release/bundle/`.

---

## Release — publier une nouvelle version

La CI génère automatiquement une release GitHub quand un tag `v*` est poussé.

### Étapes

**1. Mettre à jour le numéro de version** dans les deux fichiers :

```json
// package.json
{ "version": "1.2.0" }
```

```json
// src-tauri/tauri.conf.json
{ "version": "1.2.0" }
```

**2. Commiter les changements**

```bash
git add package.json src-tauri/tauri.conf.json
git commit -m "chore: bump version to v1.2.0"
```

**3. Créer et pousser le tag**

```bash
git tag v1.2.0
git push origin main
git push origin v1.2.0
```

La CI déclenche alors deux jobs en parallèle (`build-windows` et `build-macos`), puis le job `release` crée automatiquement la release GitHub avec les installeurs attachés.

> **Règle** : le tag doit toujours commencer par `v` (ex. `v1.2.0`). Sans le `v`, la release n'est pas créée.

---

## Format de fichier `.agr`

Les tactiques sont sauvegardées en JSON avec l'extension `.agr` :

```json
{
  "version": "1",
  "combination": {
    "id": "...",
    "name": "Touche + lancement 10",
    "phase": "lineout",
    "category": "attack",
    "frames": [...],
    "players": [...],
    "tags": [],
    "isFavorite": false,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

Un fichier `.agr` est **réouvrable et modifiable** à tout moment — c'est la source de travail, distinct de l'export vidéo.

---

## Raccourcis clavier

| Raccourci | Action |
|---|---|
| `V` | Outil sélection |
| `A` | Outil flèche |
| `E` | Outil effacer |
| `Espace` | Lecture / Pause |
| `←` `→` | Frame précédente / suivante |
| `Ctrl+Z` | Annuler |
| `Ctrl+Y` | Rétablir |
| `Ctrl+S` | Sauvegarder (ouvre "Sous…" si jamais sauvegardé) |
| `Ctrl+Shift+S` | Sauvegarder sous… |
| `Suppr` / `Retour` | Retirer joueur(s) ou ballon sélectionné(s) |
| `Échap` | Désélectionner / Quitter présentation |
