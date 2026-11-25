import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuildBuild } from "esbuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const vendorOutFile = path.join(rootDir, "js", "vendor", "supabase-js.js");

// Bundle pinned @supabase/supabase-js into a self-hosted ES module to remove third-party script CDNs.
export async function buildVendor() {
  await mkdir(path.dirname(vendorOutFile), { recursive: true });
  await esbuildBuild({
    stdin: {
      contents: 'export * from "@supabase/supabase-js";',
      resolveDir: rootDir,
      loader: "js",
    },
    bundle: true,
    format: "esm",
    platform: "browser",
    minify: true,
    charset: "utf8",
    outfile: vendorOutFile,
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildVendor().catch((error) => {
    console.error("Vendor bundle failed:", error);
    process.exit(1);
  });
}
