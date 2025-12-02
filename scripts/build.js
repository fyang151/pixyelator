import { minify } from "terser";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = resolve(__dirname, "..");
const distDir = join(projectRoot, "dist");

const terserOptions = {
  compress: {
    passes: 2,
  },
  mangle: {
    toplevel: false,
  },
  format: {
    comments: false,
  },
};

async function ensureDistDir() {
  try {
    await fs.mkdir(distDir);
  } catch (err) {
    if (err.code !== "EEXIST") {
      throw err;
    }
  }
}

async function build() {
  await ensureDistDir();

  const indexPath = join(projectRoot, "index.js");
  const indexCode = await fs.readFile(indexPath, "utf8");
  const indexMinified = await minify(indexCode, terserOptions);

  const indexMinifiedCode = indexMinified.code.replace(
    /new URL\("rgbaWorker\.js"/g,
    'new URL("rgbaWorker.min.js"'
  );

  await fs.writeFile(join(distDir, "index.min.js"), indexMinifiedCode);

  const workerPath = join(projectRoot, "rgbaWorker.js");
  const workerCode = await fs.readFile(workerPath, "utf8");
  const workerMinified = await minify(workerCode, terserOptions);

  await fs.writeFile(
    join(distDir, "rgbaWorker.min.js"),
    workerMinified.code
  );

  const typesPath = join(projectRoot, "index.d.ts");
  await fs.copyFile(typesPath, join(distDir, "index.d.ts"));
}

build().catch(console.error);
