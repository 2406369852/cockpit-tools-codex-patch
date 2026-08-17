const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");

const {
  verifyPublishedUpdaterManifests,
} = require("./verify_published_updater_manifests.cjs");

const TARGET = "windows-x86_64-nsis";
const VERSION = "1.2.3";
const ASSET_NAME = "Cockpit.Tools_1.2.3_x64-setup.exe";

async function withReleaseServer(handler, run) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

function manifestOptions(baseUrl, overrides = {}) {
  return {
    version: VERSION,
    repo: "2406369852/cockpit-tools-codex-patch",
    targets: [TARGET],
    verifyLegacy: true,
    latestBaseUrl: `${baseUrl}/latest/download`,
    releaseBaseUrl: `${baseUrl}/releases/download/v${VERSION}`,
    attempts: 1,
    delayMs: 1,
    timeoutMs: 2000,
    ...overrides,
  };
}

function releaseHandler(baseUrl, overrides = {}) {
  const entry = {
    url: `${baseUrl}/releases/download/v${VERSION}/${ASSET_NAME}`,
    signature: "test-signature",
    ...overrides.entry,
  };
  const targetManifest = {
    version: VERSION,
    notes: "Release notes",
    pub_date: "2026-07-11T00:00:00Z",
    ...entry,
    ...overrides.targetManifest,
  };
  const legacyManifest = {
    version: VERSION,
    notes: "Release notes",
    pub_date: "2026-07-11T00:00:00Z",
    platforms: { [TARGET]: entry },
    ...overrides.legacyManifest,
  };

  return (request, response) => {
    if (request.url === `/latest/download/latest-${TARGET}.json`) {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify(targetManifest));
      return;
    }
    if (request.url === "/latest/download/latest.json") {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify(legacyManifest));
      return;
    }
    if (request.url === `/releases/download/v${VERSION}/${ASSET_NAME}`) {
      response.statusCode = request.headers.range ? 206 : 200;
      response.end("x");
      return;
    }
    response.statusCode = 404;
    response.end("not found");
  };
}

test("verifies target and legacy manifests against reachable release assets", async () => {
  let handler;
  await withReleaseServer(
    (request, response) => handler(request, response),
    async (baseUrl) => {
      handler = releaseHandler(baseUrl);
      await verifyPublishedUpdaterManifests(manifestOptions(baseUrl));
    },
  );
});

test("rejects a target manifest with an empty signature", async () => {
  let handler;
  await withReleaseServer(
    (request, response) => handler(request, response),
    async (baseUrl) => {
      handler = releaseHandler(baseUrl, { entry: { signature: "" } });
      await assert.rejects(
        verifyPublishedUpdaterManifests(
          manifestOptions(baseUrl, { verifyLegacy: false }),
        ),
        /empty signature/,
      );
    },
  );
});

test("rejects a manifest that points to another release version", async () => {
  let handler;
  await withReleaseServer(
    (request, response) => handler(request, response),
    async (baseUrl) => {
      handler = releaseHandler(baseUrl, {
        entry: {
          url: `${baseUrl}/releases/download/v9.9.9/${ASSET_NAME}`,
        },
      });
      await assert.rejects(
        verifyPublishedUpdaterManifests(
          manifestOptions(baseUrl, { verifyLegacy: false }),
        ),
        /outside the expected release/,
      );
    },
  );
});

test("rejects a manifest whose release asset is unavailable", async () => {
  let handler;
  await withReleaseServer(
    (request, response) => handler(request, response),
    async (baseUrl) => {
      const baseHandler = releaseHandler(baseUrl);
      handler = (request, response) => {
        if (request.url === `/releases/download/v${VERSION}/${ASSET_NAME}`) {
          response.statusCode = 404;
          response.end("not found");
          return;
        }
        baseHandler(request, response);
      };
      await assert.rejects(
        verifyPublishedUpdaterManifests(
          manifestOptions(baseUrl, { verifyLegacy: false }),
        ),
        /not reachable/,
      );
    },
  );
});
