import assert from "node:assert/strict";
import test from "node:test";

import {
  moveCodexProviderApiKey,
  type CodexProviderApiKeyOwner,
} from "./codexModelProviderApiKeyMove.ts";

function provider(
  id: string,
  apiKeys: CodexProviderApiKeyOwner["apiKeys"],
): CodexProviderApiKeyOwner {
  return { id, apiKeys, updatedAt: 1 };
}

test("moves a reused API key to the newly selected provider", () => {
  const savedKey = {
    id: "key-1",
    name: "Personal relay key",
    apiKey: "sk-shared",
    createdAt: 10,
    updatedAt: 20,
  };
  const providers = [provider("old", [savedKey]), provider("new", [])];

  const result = moveCodexProviderApiKey(
    providers,
    "old",
    "new",
    " sk-shared ",
    30,
  );

  assert.equal(result, "moved");
  assert.deepEqual(providers[0].apiKeys, []);
  assert.deepEqual(providers[1].apiKeys, [
    {
      ...savedKey,
      apiKey: "sk-shared",
      updatedAt: 30,
    },
  ]);
});

test("deduplicates matching labels without losing the saved name", () => {
  const providers = [
    provider("old", [
      {
        id: "key-old",
        name: "Saved label",
        apiKey: "sk-shared",
        createdAt: 10,
        updatedAt: 20,
      },
    ]),
    provider("new", [
      {
        id: "key-new",
        name: "",
        apiKey: "sk-shared",
        createdAt: 15,
        updatedAt: 25,
      },
    ]),
  ];

  const result = moveCodexProviderApiKey(
    providers,
    "old",
    "new",
    "sk-shared",
    30,
  );

  assert.equal(result, "deduplicated");
  assert.deepEqual(providers[0].apiKeys, []);
  assert.equal(providers[1].apiKeys[0].name, "Saved label");
});

test("does not guess when the same key has conflicting saved names", () => {
  const providers = [
    provider("old", [
      {
        id: "key-old",
        name: "Old saved label",
        apiKey: "sk-shared",
        createdAt: 10,
        updatedAt: 20,
      },
    ]),
    provider("new", [
      {
        id: "key-new",
        name: "New saved label",
        apiKey: "sk-shared",
        createdAt: 15,
        updatedAt: 25,
      },
    ]),
  ];

  const before = structuredClone(providers);
  const result = moveCodexProviderApiKey(
    providers,
    "old",
    "new",
    "sk-shared",
    30,
  );

  assert.equal(result, "name_conflict");
  assert.deepEqual(providers, before);
});
