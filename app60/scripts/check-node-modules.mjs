import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const nodeModules = path.join(projectRoot, "node_modules");

function listBrokenTopLevelDirs() {
  if (!fs.existsSync(nodeModules)) return { missingNodeModules: true, broken: [] };

  const entries = fs.readdirSync(nodeModules, { withFileTypes: true });
  const broken = [];

  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const name = ent.name;
    if (name.startsWith(".")) continue;
    if (name.startsWith("@")) continue; // scopes não têm package.json no diretório do scope

    const dir = path.join(nodeModules, name);
    const pkgJson = path.join(dir, "package.json");
    if (!fs.existsSync(pkgJson)) broken.push(name);
  }

  return { missingNodeModules: false, broken };
}

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: projectRoot, stdio: "inherit", shell: false });
  return res.status ?? 1;
}

const mode = (process.env.NODE_MODULES_CHECK_MODE || "warn").toLowerCase();
// modes:
// - warn: só avisa e continua
// - fail: avisa e sai com erro
// - fix: apaga node_modules + package-lock e roda npm install

const { missingNodeModules, broken } = listBrokenTopLevelDirs();

if (!missingNodeModules && broken.length === 0) {
  process.exit(0);
}

const header = missingNodeModules
  ? "[node_modules] pasta node_modules não encontrada"
  : `[node_modules] detectei ${broken.length} pacote(s) top-level sem package.json (instalação corrompida)`;

console.error(header);
if (broken.length) {
  console.error(broken.slice(0, 40).map((x) => `- ${x}`).join("\n"));
  if (broken.length > 40) console.error(`... +${broken.length - 40} outros`);
}

if (mode === "warn") {
  console.error(
    "\n[node_modules] Aviso: isso costuma acontecer por sync (Dropbox/OneDrive) ou npm interrompido. " +
      "Se der erro no Metro, rode: rm -rf node_modules package-lock.json && npm install\n"
  );
  process.exit(0);
}

if (mode === "fix") {
  console.error("\n[node_modules] Reinstalando dependências (modo fix)...\n");
  try {
    fs.rmSync(nodeModules, { recursive: true, force: true });
  } catch {}
  try {
    fs.rmSync(path.join(projectRoot, "package-lock.json"), { force: true });
  } catch {}

  const status = run("npm", ["install"]);
  process.exit(status);
}

// default: fail
console.error(
  "\n[node_modules] Abortando para evitar Metro travar. " +
    "Para auto-corrigir, use: NODE_MODULES_CHECK_MODE=fix npm start\n"
);
process.exit(1);

