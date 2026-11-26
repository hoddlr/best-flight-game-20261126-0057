// Sky Courier — a little prop-plane delivery game, handed in as a make.fun
// program/v1 entry. The game is plain static files under game/ (index.html
// plus its ES modules, no library, no network request) and the screenshots
// in screenshots/ are real renders of it in a browser. This program copies
// both folders from beside this file to the output directory and writes
// dossier.json there with the vendored make.fun library, so the sealed
// scorer can check the entry and the judge can read it.
//
// Run it outside the grader with MAKEFUN_OUTPUT_DIR standing in for
// /output:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the game locally with `node serve.ts`, then open http://localhost:8080.
// The program is deterministic: the same repository always writes the same
// bytes, so the grader's two runs match byte for byte.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
