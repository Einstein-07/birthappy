import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));

export const projectRoot = path.resolve(scriptsDirectory, "..", "..");
export const DEFAULT_DATABASE_URL = "file:./data/birthhappy.db";

function loadEnvFile(filename) {
  const file = path.join(projectRoot, filename);
  if (!fs.existsSync(file)) return;
  const contents = fs.readFileSync(file, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

export function loadProjectEnv() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");
}

export function getDatabaseUrl() {
  loadProjectEnv();
  return process.env.TURSO_DATABASE_URL?.trim() || DEFAULT_DATABASE_URL;
}

export function isRemoteDatabase(url = getDatabaseUrl()) {
  return !url.startsWith("file:");
}

export function describeDatabase(url = getDatabaseUrl()) {
  if (url.startsWith("file:")) return url;
  try {
    return new URL(url).host;
  } catch {
    return "远程数据库";
  }
}

export async function openDatabase() {
  loadProjectEnv();
  const url =
    process.env.TURSO_DATABASE_URL?.trim() || DEFAULT_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim() || undefined;

  if (url.startsWith("file:")) {
    const rawPath = url.slice("file:".length).split("?")[0];
    if (rawPath && rawPath !== ":memory:") {
      fs.mkdirSync(path.dirname(path.resolve(projectRoot, rawPath)), {
        recursive: true
      });
    }
  }

  return {
    client: createClient({ url, authToken, intMode: "number" }),
    url,
    isRemote: !url.startsWith("file:"),
    source: describeDatabase(url)
  };
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / 1024 ** index;
  return `${value.toFixed(index === 0 || value >= 100 ? 0 : 1)} ${units[index]}`;
}
