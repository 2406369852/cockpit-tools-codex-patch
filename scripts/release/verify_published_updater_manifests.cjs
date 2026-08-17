#!/usr/bin/env node

const path = require("path");
const { TARGET_SPECS } = require("./build_target_latest_json.cjs");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      args[key] = "true";
      continue;
    }
    args[key] = value;
    i += 1;
  }
  return args;
}

function requiredArg(args, key) {
  const value = args[key];
  if (!value) {
    throw new Error(`Missing required argument --${key}`);
  }
  return value;
}

function parsePositiveInteger(raw, fallback, label) {
  if (raw == null || raw === "") return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid ${label}: ${raw}`);
  }
  return value;
}

function parseBoolean(raw) {
  return raw === true || raw === "true" || raw === "1";
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      redirect: "follow",
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, timeoutMs) {
  const response = await fetchWithTimeout(
    url,
    {
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache",
      },
    },
    timeoutMs,
  );
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(
      `Manifest request failed: ${url} returned HTTP ${response.status}`,
    );
  }
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`Manifest is not valid JSON: ${url}: ${error.message}`);
  }
}

function validateVersion(manifest, version, label) {
  if (!manifest || typeof manifest !== "object") {
    throw new Error(`${label} is not an object`);
  }
  if (manifest.version !== version) {
    throw new Error(
      `${label} version mismatch: expected ${version}, got ${manifest.version}`,
    );
  }
  if (manifest.pub_date && Number.isNaN(Date.parse(manifest.pub_date))) {
    throw new Error(
      `${label} contains an invalid pub_date: ${manifest.pub_date}`,
    );
  }
}

function validatePlatformEntry(entry, target, releaseBaseUrl, label) {
  if (!entry || typeof entry !== "object") {
    throw new Error(`${label} is missing updater data for ${target}`);
  }
  if (typeof entry.signature !== "string" || entry.signature.trim() === "") {
    throw new Error(`${label} has an empty signature for ${target}`);
  }
  if (typeof entry.url !== "string" || entry.url.trim() === "") {
    throw new Error(`${label} has an empty asset URL for ${target}`);
  }

  let assetUrl;
  try {
    assetUrl = new URL(entry.url);
  } catch (error) {
    throw new Error(
      `${label} has an invalid asset URL for ${target}: ${error.message}`,
    );
  }

  const assetName = decodeURIComponent(path.posix.basename(assetUrl.pathname));
  const targetPattern = TARGET_SPECS[target];
  if (!targetPattern) {
    throw new Error(`Unsupported updater target: ${target}`);
  }
  if (!targetPattern.test(assetName)) {
    throw new Error(`${label} asset does not match ${target}: ${assetName}`);
  }

  const expectedUrl = new URL(
    `${trimTrailingSlash(releaseBaseUrl)}/${encodeURIComponent(assetName)}`,
  );
  if (assetUrl.href !== expectedUrl.href) {
    throw new Error(
      `${label} asset URL is outside the expected release: expected ${expectedUrl.href}, got ${assetUrl.href}`,
    );
  }

  return assetUrl.href;
}

async function verifyAssetReachable(assetUrl, timeoutMs) {
  const response = await fetchWithTimeout(
    assetUrl,
    {
      method: "GET",
      headers: {
        Accept: "application/octet-stream",
        Range: "bytes=0-0",
        "Cache-Control": "no-cache",
      },
    },
    timeoutMs,
  );
  const ok = response.ok || response.status === 206;
  await response.body?.cancel();
  if (!ok) {
    throw new Error(
      `Updater asset is not reachable: ${assetUrl} returned HTTP ${response.status}`,
    );
  }
}

async function verifyTargetManifest(options, target) {
  const manifestUrl = `${trimTrailingSlash(options.latestBaseUrl)}/latest-${target}.json`;
  const manifest = await fetchJson(manifestUrl, options.timeoutMs);
  const label = `Target manifest ${target}`;
  validateVersion(manifest, options.version, label);
  const assetUrl = validatePlatformEntry(
    manifest,
    target,
    options.releaseBaseUrl,
    label,
  );
  await verifyAssetReachable(assetUrl, options.timeoutMs);
}

async function verifyLegacyManifest(options) {
  const manifestUrl = `${trimTrailingSlash(options.latestBaseUrl)}/latest.json`;
  const manifest = await fetchJson(manifestUrl, options.timeoutMs);
  const label = "Legacy latest.json";
  validateVersion(manifest, options.version, label);
  if (!manifest.platforms || typeof manifest.platforms !== "object") {
    throw new Error(`${label} does not contain a platforms object`);
  }

  for (const target of options.targets) {
    const assetUrl = validatePlatformEntry(
      manifest.platforms[target],
      target,
      options.releaseBaseUrl,
      label,
    );
    await verifyAssetReachable(assetUrl, options.timeoutMs);
  }
}

async function verifyPublishedUpdaterManifests(options) {
  if (!Array.isArray(options.targets) || options.targets.length === 0) {
    throw new Error("At least one target is required");
  }
  for (const target of options.targets) {
    await verifyTargetManifest(options, target);
  }
  if (options.verifyLegacy) {
    await verifyLegacyManifest(options);
  }
}

async function verifyWithRetry(options) {
  let lastError;
  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      await verifyPublishedUpdaterManifests(options);
      return;
    } catch (error) {
      lastError = error;
      if (attempt >= options.attempts) break;
      console.warn(
        `[verify_published_updater_manifests] attempt ${attempt}/${options.attempts} failed: ${error.message}`,
      );
      await sleep(options.delayMs);
    }
  }
  throw lastError;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const version = requiredArg(args, "version");
  const repo = requiredArg(args, "repo");
  const targets = requiredArg(args, "targets")
    .split(",")
    .map((target) => target.trim())
    .filter(Boolean);
  const options = {
    version,
    repo,
    targets,
    verifyLegacy: parseBoolean(args.legacy),
    latestBaseUrl:
      args["latest-base-url"] ||
      `https://github.com/${repo}/releases/latest/download`,
    releaseBaseUrl:
      args["release-base-url"] ||
      `https://github.com/${repo}/releases/download/v${version}`,
    attempts: parsePositiveInteger(args.attempts, 12, "--attempts"),
    delayMs: parsePositiveInteger(args["delay-ms"], 5000, "--delay-ms"),
    timeoutMs: parsePositiveInteger(args["timeout-ms"], 30000, "--timeout-ms"),
  };

  await verifyWithRetry(options);
  console.log(
    `Verified published updater manifests for ${targets.join(", ")}${options.verifyLegacy ? " and legacy latest.json" : ""}`,
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[verify_published_updater_manifests] ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  validatePlatformEntry,
  verifyPublishedUpdaterManifests,
  verifyWithRetry,
};
