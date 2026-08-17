import assert from "node:assert/strict";
import test from "node:test";

import {
  extractCodexQuotaErrorStatusCode,
  isVerboseCodexQuotaErrorMessage,
  summarizeCodexQuotaErrorMessage,
} from "./codexQuotaError.ts";

const htmlDump =
  'API 返回错误 403 Forbidden [body_len:6632] [request-id:] [body:<html><head><meta name="viewport" content="width=device-width"></head><body>blocked</body></html>]';

test("extracts status code from structured API error prefix", () => {
  assert.equal(extractCodexQuotaErrorStatusCode(htmlDump), "403");
});

test("detects verbose HTML dumps", () => {
  assert.equal(isVerboseCodexQuotaErrorMessage(htmlDump), true);
  assert.equal(isVerboseCodexQuotaErrorMessage("token expired"), false);
});

test("summarizes long HTML dumps without keeping markup", () => {
  const summary = summarizeCodexQuotaErrorMessage(htmlDump);
  assert.ok(summary.length < htmlDump.length);
  assert.equal(summary.toLowerCase().includes("<html"), false);
  assert.ok(summary.includes("403"));
});
