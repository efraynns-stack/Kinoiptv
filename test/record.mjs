// Explicit online check. Never run automatically as part of the offline tests.
import assert from "node:assert/strict";
import {readFileSync, writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {checkOutput, validateManifest} from "../sdk/contract.mjs";
import {createKino} from "../sdk/kino-shim.mjs";
import * as plugin from "../plugin.js";

const config = JSON.parse(readFileSync(new URL("config.example.json", import.meta.url)));
const checked = validateManifest(readFileSync(new URL("../kino-plugin.json", import.meta.url), "utf8"));
assert.equal(checked.ok, true);
const runtime = createKino(checked.manifest, {
  config, appVersion: "0.9.49", record: fileURLToPath(new URL("fixtures.json", import.meta.url)),
});
globalThis.kino = runtime.kino;
const verify = (fn, value, ctx = {}) => {
  const result = checkOutput(fn, value, checked.manifest, runtime.servers, ctx);
  assert.deepEqual(result.drops, [], fn + ": Kino must drop nothing");
  return result.value;
};
verify("home", await plugin.home());
const categories = verify("liveCategories", await plugin.liveCategories()).categories;
assert.equal(categories.length, 2);
const report = {appTarget: "0.9.49", pluginVersion: checked.manifest.version, recordedAt: new Date().toISOString(), sources: []};
for (const category of categories) {
  let cursor = null, count = 0, pages = 0;
  const ids = new Set();
  let first = null;
  do {
    runtime.resetBudget();
    const page = verify("liveChannels", await plugin.liveChannels({categoryId: category.id, cursor}));
    for (const channel of page.items) {
      assert.equal(channel.categoryId, category.id);
      assert.equal(ids.has(channel.id), false);
      ids.add(channel.id);
      first ||= channel;
    }
    count += page.items.length;
    pages++;
    cursor = page.next || null;
    assert.ok(pages <= 10);
  } while (cursor);
  assert.ok(first);
  verify("resolve", await plugin.resolve(first.ref), {liveChannel: true});
  report.sources.push({name: category.title, channels: count, pages});
}
runtime.saveTape();
writeFileSync(new URL("recorded-results.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
