// Sky Courier — SORTIE 01: the hand-in program (Node 22, stdlib only).
// It copies the playable game (game/) and its screenshots (screenshots/)
// from beside this file into the output directory and writes the dossier
// there with the vendored make.fun library, so the scorer can rebuild the
// same dossier byte for byte. Outside the grader, MAKEFUN_OUTPUT_DIR
// stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The scorer's own caps (this bouty's gate.json): only text_max_bytes
// shapes the dossier's bytes; the rest refuse an entry the scorer would
// refuse — more than 4 screenshots, one over 256 KiB, more than 993
// game entries or 48 MiB of game files, or a game path over 1000 bytes.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
} as const;

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Copy one tree from the repo into the output, replacing any stale copy
// so a second run writes exactly the same bytes as the first.
function copyTree(name: string): void {
  const from = join(repoRoot, name);
  const to = join(outDir, name);
  if (!existsSync(from)) throw new Error(`hand-in: ${name}/ is missing from the repository`);
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
}

function handIn(): void {
  mkdirSync(outDir, { recursive: true });
  copyTree('game');
  copyTree('screenshots');
  const dossier = buildDossier(outDir, DOSSIER_CAPS);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
}

handIn();

// A one-line receipt on stdout: which dossier the run wrote, and how big,
// so a human watching the hand-in can see it landed without opening it.
import { statSync } from 'node:fs';

const dossierPath = join(outDir, 'dossier.json');
const dossierBytes = statSync(dossierPath).size;
console.log(`sky-courier sortie-01: dossier.json (${dossierBytes} bytes) written to ${outDir}`);
