import {
  cp,
  copyFile,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { minify as minifyHtml } from "html-minifier-terser";
import { transform as esbuildTransform } from "esbuild";
import { buildVendor } from "./vendor.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");

const STATIC_DIRS = ["images", "files", ".well-known"];
const STATIC_FILES = ["manifest.json", "robots.txt", "sitemap.xml"];
const HTML_FILES = ["index.html", "admin.html"];

const EXCLUDED_PDF_SCAN_DIRS = new Set([
  ".git",
  ".vercel",
  ".vscode",
  "css",
  "db",
  "dist",
  "js",
  "node_modules",
  "rules",
  "scripts",
  "supabase",
  ...STATIC_DIRS,
]);

const HTML_MINIFY_OPTIONS = {
  collapseWhitespace: true,
  removeComments: true,
  removeRedundantAttributes: true,
  removeEmptyAttributes: true,
  minifyCSS: true,
  minifyJS: true,
};

async function exists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function listFilesRecursive(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

async function copyStaticRootAssets() {
  for (const dirName of STATIC_DIRS) {
    const src = path.join(rootDir, dirName);
    if (await exists(src)) {
      await cp(src, path.join(distDir, dirName), { recursive: true });
    }
  }

  for (const fileName of STATIC_FILES) {
    const src = path.join(rootDir, fileName);
    if (await exists(src)) {
      await copyFile(src, path.join(distDir, fileName));
    }
  }
}

async function copyResumePdfs(currentDir = rootDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (currentDir === rootDir && EXCLUDED_PDF_SCAN_DIRS.has(entry.name)) {
        continue;
      }
      await copyResumePdfs(path.join(currentDir, entry.name));
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
      const src = path.join(currentDir, entry.name);
      const rel = path.relative(rootDir, src);
      const dest = path.join(distDir, rel);
      await mkdir(path.dirname(dest), { recursive: true });
      await copyFile(src, dest);
    }
  }
}

async function minifyHtmlFiles() {
  for (const fileName of HTML_FILES) {
    const src = path.join(rootDir, fileName);
    if (!(await exists(src))) continue;

    const raw = await readFile(src, "utf8");
    const minified = await minifyHtml(raw, HTML_MINIFY_OPTIONS);
    await writeFile(path.join(distDir, fileName), minified, "utf8");
  }
}

async function minifyAssetDirectory(folderName, ext, loader) {
  const srcRoot = path.join(rootDir, folderName);
  if (!(await exists(srcRoot))) return;

  const files = await listFilesRecursive(srcRoot);
  for (const srcPath of files) {
    if (!srcPath.toLowerCase().endsWith(ext)) continue;

    const rel = path.relative(rootDir, srcPath);
    const destPath = path.join(distDir, rel);
    await mkdir(path.dirname(destPath), { recursive: true });

    // Transform single files instead of bundling so relative ES module imports stay intact.
    const raw = await readFile(srcPath, "utf8");
    const result = await esbuildTransform(raw, {
      loader,
      minify: true,
      charset: "utf8",
    });
    await writeFile(destPath, result.code, "utf8");
  }
}

async function build() {
  await buildVendor();
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  await Promise.all([
    copyStaticRootAssets(),
    copyResumePdfs(),
    minifyHtmlFiles(),
    minifyAssetDirectory("css", ".css", "css"),
    minifyAssetDirectory("js", ".js", "js"),
  ]);

  console.log("Built minified output in dist/");
}

build().catch((error) => {
  console.error("Build failed:", error);
  process.exit(1);
});
