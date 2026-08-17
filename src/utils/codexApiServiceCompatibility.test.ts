import assert from "node:assert/strict";
import test from "node:test";

import { resolveCodexApiServiceCompatibilityBaseUrls } from "./codexApiServiceCompatibility.ts";

test("normalizes a versioned service URL for each compatibility client", () => {
  assert.deepEqual(
    resolveCodexApiServiceCompatibilityBaseUrls(
      "http://localhost:54548/v1/",
    ),
    {
      openai: "http://localhost:54548/v1",
      root: "http://localhost:54548",
      gemini: "http://localhost:54548/v1beta",
    },
  );
});

test("adds the OpenAI version path when a service root is supplied", () => {
  assert.deepEqual(
    resolveCodexApiServiceCompatibilityBaseUrls("http://192.168.1.10:54548"),
    {
      openai: "http://192.168.1.10:54548/v1",
      root: "http://192.168.1.10:54548",
      gemini: "http://192.168.1.10:54548/v1beta",
    },
  );
});
