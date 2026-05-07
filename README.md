# AR Chess

Web-based augmented-reality chess. Point your phone camera at a printed marker, the 3D board appears anchored on top, tap pieces to move, play against a ~1200 ELO AI.

## Features

- **Real AR** — image-tracking via [MindAR](https://github.com/hiukim/mind-ar-js), no app install.
- **Touch controls** — tap a piece, legal squares glow green, illegal taps flash red and fade.
- **Color choice** — pick White or Black, board auto-flips.
- **1200 ELO opponent** — depth-2 minimax with positional eval, a blunder rate, and noisy move selection to simulate club-rapid strength.
- **Single file** — `index.html` is the whole app. Drop it on GitHub Pages.

## How to play

1. Open the deployed page on a phone (HTTPS required for camera access).
2. Choose White or Black.
3. Allow camera access.
4. Open the AR marker on a second screen, or print it. Marker link is on the splash screen.
5. Point camera at the marker. The board materialises.
6. Tap a piece → green dots show legal moves. Tap a green square to move. Tap an empty square or wrong piece → red flash, selection cleared.

## Deploy on GitHub Pages

```bash
git init
git add index.html README.md
git commit -m "AR chess"
git branch -M main
git remote add origin https://github.com/YOURNAME/ar-chess.git
git push -u origin main
```

Then in the repo: **Settings → Pages → Source: `main` / root → Save**. Your app will be live at `https://YOURNAME.github.io/ar-chess/`.

> ⚠️ HTTPS is required for `getUserMedia` (camera). GitHub Pages provides this for free. Don't try to test from `file://` — it won't work.

## Tech

- [Three.js](https://threejs.org/) — 3D rendering
- [MindAR](https://github.com/hiukim/mind-ar-js) — image-tracking AR
- [chess.js](https://github.com/jhlywa/chess.js) — move validation, game state
- Vanilla JS, no build step. ES modules + import map.

## Notes / caveats

- Pieces are built from primitives (cylinders, cones, spheres) so the file stays self-contained. Swap in glTF models if you want fancier pieces.
- The AI is intentionally weakened. Real 1200 ELO is rough — it makes blunders ~18% of the time and picks from a top-3 pool occasionally. Tune `chooseAIMove()` to taste.
- The marker image used is MindAR's example "card" target. To use your own, generate a `.mind` file with [their compiler](https://hiukim.github.io/mind-ar-js-doc/tools/compile) and replace `MIND_TARGET_URL` + `MARKER_PREVIEW_URL` in `index.html`.
- Auto-promotes to queen. Add a picker UI if you want under-promotion.
