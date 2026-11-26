import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getAllCitiesOfCountry,
  getCountries,
  getDataVersion,
} from "@countrystatecity/countries";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const ALPHABET_KEYS = Array.from({ length: 26 }, (_, idx) =>
  String.fromCharCode(97 + idx),
);
export const SHARD_KEYS = [...ALPHABET_KEYS, "other"];

const SPECIAL_LATIN_FOLD = {
  Ł: "L",
  ł: "l",
  Ø: "O",
  ø: "o",
  Đ: "D",
  đ: "d",
  ß: "ss",
  Æ: "AE",
  æ: "ae",
  Œ: "OE",
  œ: "oe",
};

// Keep diacritic folding identical to js/admin/city-picker.js so build shards match client queries.
export function stripDiacritics(value) {
  return String(value || "")
    .replace(/[ŁłØøĐđßÆæŒœ]/g, (ch) => SPECIAL_LATIN_FOLD[ch] || ch)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function getCityShardKey(rawText) {
  const clean = stripDiacritics(String(rawText || "").trim()).toLowerCase();
  if (!clean) return "other";
  const first = clean[0];
  return first >= "a" && first <= "z" ? first : "other";
}

function formatCityCountryLabel(cityName, countryName) {
  const cleanCity = String(cityName || "")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  const cleanCountry = String(countryName || "")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleanCity || !cleanCountry) return "";
  return `${cleanCity}, ${cleanCountry}`;
}

// Supplement upstream state lookup if state folder names contain hyphens that split("-") misses.
async function collectFallbackCountryCities(pkgDataRoot, countryDirName) {
  const countryPath = path.join(pkgDataRoot, countryDirName);
  if (!existsSync(countryPath)) return [];

  const collected = [];
  const topCitiesPath = path.join(countryPath, "cities.json");
  if (existsSync(topCitiesPath)) {
    const raw = JSON.parse(await readFile(topCitiesPath, "utf8"));
    if (Array.isArray(raw)) collected.push(...raw);
  }

  const entries = await readdir(countryPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const stateCitiesPath = path.join(countryPath, entry.name, "cities.json");
    if (!existsSync(stateCitiesPath)) continue;
    const raw = JSON.parse(await readFile(stateCitiesPath, "utf8"));
    if (Array.isArray(raw)) collected.push(...raw);
  }
  return collected;
}

export async function buildCities(
  targetDirs = [path.join(rootDir, "data", "cities")],
) {
  const countries = await getCountries();
  const shardSets = new Map(SHARD_KEYS.map((key) => [key, new Set()]));
  let rawCityCount = 0;

  const pkgDataRoot = path.join(
    rootDir,
    "node_modules",
    "@countrystatecity",
    "countries",
    "dist",
    "data",
  );
  const countryDirByIso2 = new Map();
  if (existsSync(pkgDataRoot)) {
    const dirs = await readdir(pkgDataRoot, { withFileTypes: true });
    for (const entry of dirs) {
      if (!entry.isDirectory()) continue;
      const parts = entry.name.split("-");
      const iso2 = parts[parts.length - 1];
      if (iso2) countryDirByIso2.set(iso2, entry.name);
    }
  }

  function addCityEntry(rawCityName, rawCountryName) {
    const label = formatCityCountryLabel(rawCityName, rawCountryName);
    if (!label) return;
    shardSets.get(getCityShardKey(label)).add(label);

    const subdistrictMatch = String(rawCityName || "").match(
      /^([^(]+?)\s*\((?:Kreis|Arrondissement|Ward|District|Bezirk)\b/i,
    );
    if (subdistrictMatch) {
      const baseLabel = formatCityCountryLabel(
        subdistrictMatch[1],
        rawCountryName,
      );
      if (baseLabel) {
        shardSets.get(getCityShardKey(baseLabel)).add(baseLabel);
      }
    }
  }

  const batchSize = 25;
  for (let i = 0; i < countries.length; i += batchSize) {
    const slice = countries.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      slice.map(async (country) => {
        const apiCities = await getAllCitiesOfCountry(country.iso2);
        const dirName = countryDirByIso2.get(country.iso2);
        const diskCities = dirName
          ? await collectFallbackCountryCities(pkgDataRoot, dirName)
          : [];
        const cities =
          diskCities.length > apiCities.length ? diskCities : apiCities;
        return { country, cities };
      }),
    );

    for (const { country, cities } of batchResults) {
      if (country?.capital) {
        addCityEntry(country.capital, country.name);
      }
      rawCityCount += cities.length;
      for (const city of cities) {
        addCityEntry(city?.name, country?.name);
      }
    }
  }

  const collator = new Intl.Collator("en", {
    sensitivity: "base",
    numeric: true,
  });
  const serializedShards = new Map();
  let uniqueTotal = 0;

  for (const key of SHARD_KEYS) {
    const sorted = Array.from(shardSets.get(key)).sort(
      (a, b) => collator.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0),
    );
    uniqueTotal += sorted.length;
    serializedShards.set(key, JSON.stringify(sorted));
  }

  for (const outDir of targetDirs) {
    await mkdir(outDir, { recursive: true });
    await Promise.all(
      SHARD_KEYS.map((key) =>
        writeFile(
          path.join(outDir, `${key}.json`),
          serializedShards.get(key),
          "utf8",
        ),
      ),
    );
  }

  const versionInfo = await getDataVersion().catch(() => null);
  return {
    shards: SHARD_KEYS.length,
    countries: countries.length,
    rawCityCount,
    uniqueTotal,
    sourceRelease: versionInfo?.sourceRelease || "unknown",
  };
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const outDirs = [path.join(rootDir, "data", "cities")];
  const distRoot = path.join(rootDir, "dist");
  if (existsSync(distRoot)) {
    outDirs.push(path.join(distRoot, "data", "cities"));
  }

  buildCities(outDirs)
    .then((summary) => {
      console.log(
        `Built ${summary.shards} city shards (${summary.uniqueTotal} unique entries from ${summary.rawCityCount} cities across ${summary.countries} countries).`,
      );
    })
    .catch((error) => {
      console.error("City shard build failed:", error);
      process.exit(1);
    });
}
