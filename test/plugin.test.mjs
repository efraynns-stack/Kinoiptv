import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync, mkdtempSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {validate} from "../sdk/validate.mjs";
import {checkOutput, validateManifest} from "../sdk/contract.mjs";
import {createKino} from "../sdk/kino-shim.mjs";
import * as plugin from "../plugin.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const fixture = fileURLToPath(new URL("fixtures.json", import.meta.url));
const config = JSON.parse(readFileSync(new URL("config.example.json", import.meta.url)));
const second = config.listas[0];
const manifestJson = JSON.parse(readFileSync(new URL("../kino-plugin.json", import.meta.url), "utf8"));
const manifest = validateManifest(JSON.stringify(manifestJson)).manifest;

function setup(options = {}) {
  const runtime = createKino(manifest, {appVersion: "0.9.53", replay: fixture, ...options, config: {diagnostico: false, chilenos: false, ...(options.config ?? config)}});
  globalThis.kino = runtime.kino;
  return runtime;
}

function checked(runtime, name, value, context = {}) {
  const output = checkOutput(name, value, manifest, runtime.servers, context);
  assert.deepEqual(output.drops, [], name);
  return output.value;
}

async function all(runtime, categoryId) {
  const items = [], seen = new Set();
  let cursor = null, pages = 0;
  do {
    const page = checked(runtime, "liveChannels", await plugin.liveChannels({categoryId, cursor}));
    assert.ok(page.items.length <= 100);
    items.push(...page.items);
    cursor = page.next || null;
    if (cursor) { assert.equal(seen.has(cursor), false); seen.add(cursor); }
    assert.ok(++pages <= 10);
  } while (cursor);
  return {items, pages};
}

test("Kino accepts the manifest and every required export", async () => {
  const r = await validate(root);
  assert.deepEqual(r.problems, []);
});

test("integrated Chile has a declared host, while custom lists retain URL settings", () => {
  assert.deepEqual(manifestJson.hosts, ["m3u.cl"]);
  assert.equal(manifestJson.settings.find(s => s.key === "chilenos").default, true);
  assert.equal(manifestJson.apiVersion, 4);
  assert.deepEqual(manifestJson.settings.filter(s => s.type === "url").map(s => s.key), ["url1"]);
  const list = manifestJson.settings.find(s => s.type === "list");
  assert.equal(list.key, "listas");
  assert.equal(list.max, 9);
  assert.deepEqual(list.fields.map(f => [f.key, f.type]), [["nombre", "text"], ["url", "url"]]);
  assert.equal(list.fields.find(f => f.type === "url").required, true);
});

test("a new installation loads and resolves Chile without any configured URL", async () => {
  const runtime = createKino(manifest, {appVersion: "0.9.53", replay: fixture});
  globalThis.kino = runtime.kino;
  const cats = checked(runtime, "liveCategories", await plugin.liveCategories()).categories;
  assert.deepEqual(cats.map(c => c.title), ["Chile"]);
  assert.equal(runtime.servers.length, 0);
  const channels = await all(runtime, cats[0].id);
  assert.equal(channels.items.length, 387);
  assert.deepEqual(checked(runtime, "resolve", await plugin.resolve(channels.items[0].ref), {liveChannel: true}), channels.items[0].stream);
});

test("integrated Chile preserves saved custom sources and deduplicates its existing URL", async () => {
  const runtime = setup({config: {...config, chilenos: true, listas: [{...second, nombre: "Chile personalizado"}]}});
  const cats = checked(runtime, "liveCategories", await plugin.liveCategories()).categories;
  assert.deepEqual(cats.map(c => c.title), ["PSX", "Chile personalizado"]);
  const previous = JSON.parse(readFileSync(new URL("upgrade-snapshot.json", import.meta.url)));
  assert.equal(cats[1].id, previous.sources[1].categoryId);
  assert.equal((await all(runtime, cats[1].id)).items[0].ref, previous.sources[1].firstChannelRef);
});

test("TV placeholders are not saved URLs: empty settings ask for configuration without fetching", async () => {
  const urls = manifestJson.settings.filter(s => s.type === "url");
  assert.ok(urls.every(s => s.hint.startsWith("Sin configurar") && !s.hint.includes("http") && s.default === undefined));
  let requests = 0;
  for (const empty of [{}, {nombre1: "PSX"}, {url1: "", listas: []}]) {
    setup({config: empty, replay: null, fetchImpl: async () => { requests++; throw new Error("no URL configured"); }});
    await assert.rejects(plugin.liveCategories(), {code: "auth_required"});
    await assert.rejects(plugin.liveChannels({categoryId: "missing", cursor: null}), {code: "auth_required"});
  }
  assert.equal(requests, 0);
});

test("diagnostic mode shows runtime version and missing URLs without making a request", async () => {
  let requests = 0;
  const runtime = setup({config: {diagnostico: true}, replay: null, fetchImpl: async () => { requests++; throw new Error("no URL configured"); }});
  const cats = checked(runtime, "liveCategories", await plugin.liveCategories()).categories;
  assert.equal(cats.length, 1);
  assert.equal(cats[0].id, "psxtv-diagnostico");
  assert.equal(cats[0].title, "Prueba " + manifestJson.version + " | Kino 0.9.53 | URL 1 vacía | 0 listas configuradas | auth_required");
  assert.deepEqual(checked(runtime, "liveChannels", await plugin.liveChannels({categoryId: cats[0].id, cursor: null})).items, []);
  assert.equal(requests, 0);
});

test("diagnostic mode downloads both recorded lists and exposes their parsed counts", async () => {
  const runtime = setup({config: {...config, diagnostico: true}});
  const cats = checked(runtime, "liveCategories", await plugin.liveCategories()).categories;
  assert.deepEqual(cats.slice(0, 2).map(c => c.title), ["PSX — 147 canales", "Chile — 387 canales"]);
  assert.match(cats[2].title, /URL 1 guardada \| 2 listas configuradas/);
  assert.deepEqual([(await all(runtime, cats[0].id)).items.length, (await all(runtime, cats[1].id)).items.length], [147, 387]);
});

test("diagnostic mode keeps the second source usable and shows only a safe HTTP failure code", async () => {
  const text = '#EXTM3U\n#EXTINF:-1,Canal\nhttps://cdn.m3u.cl/live.m3u8\n';
  const runtime = setup({config: {...fixtureConfig, diagnostico: true}, replay: null, fetchImpl: async url => new Response(String(url).includes("uno.m3u") ? "private response must not appear" : text, {status: String(url).includes("uno.m3u") ? 503 : 200})});
  const cats = checked(runtime, "liveCategories", await plugin.liveCategories()).categories;
  assert.deepEqual(cats.slice(0, 2).map(c => c.title), ["Uno — error HTTP 503", "Dos — 1 canales"]);
  assert.ok(cats.every(c => !c.title.includes("private response")));
  assert.equal((await all(runtime, cats[1].id)).items.length, 1);
});

test("diagnostic status remains visible if native hashing fails before any network request", async () => {
  const runtime = setup({config: {...config, diagnostico: true}});
  globalThis.kino = {...runtime.kino, crypto: {hash() { throw runtime.kino.error("crypto_error", "failure"); }}};
  const cats = checked(runtime, "liveCategories", await plugin.liveCategories()).categories;
  assert.equal(cats.length, 1);
  assert.match(cats[0].title, /URL 1 guardada \| 2 listas configuradas \| crypto_error$/);
});

test("optional storage failures do not block categories, channels or playback resolution", async () => {
  const runtime = setup();
  const fail = () => { throw new Error("storage unavailable"); };
  globalThis.kino = {...runtime.kino, storage: {keys: fail, get: fail, set: fail, remove: fail}};
  const cats = checked(runtime, "liveCategories", await plugin.liveCategories()).categories;
  const a = await all(runtime, cats[0].id), b = await all(runtime, cats[1].id);
  assert.deepEqual([a.items.length, b.items.length], [147, 387]);
  assert.deepEqual(checked(runtime, "resolve", await plugin.resolve(a.items[0].ref), {liveChannel: true}), a.items[0].stream);
});

test("both recorded real lists yield 534 channels in six pages, with no SDK drops", async () => {
  const runtime = setup();
  checked(runtime, "home", await plugin.home());
  const raw = await plugin.liveCategories();
  assert.equal(raw.some(x => x.playlist), false);
  const categories = checked(runtime, "liveCategories", raw).categories;
  assert.deepEqual(categories.map(x => x.title), ["PSX", "Chile"]);
  const a = await all(runtime, categories[0].id);
  const b = await all(runtime, categories[1].id);
  assert.deepEqual([a.items.length, b.items.length, a.pages, b.pages], [147, 387, 2, 4]);
  assert.equal(new Set([...a.items, ...b.items].map(x => x.id)).size, 534);
  assert.ok([...a.items, ...b.items].every(x => !x.logo));
  for (const item of [a.items[0], b.items[0]]) {
    const stream = await plugin.resolve(item.ref);
    assert.deepEqual(checked(runtime, "resolve", stream, {liveChannel: true}), item.stream);
  }
});

test("cached lists survive a runtime restart, stay below the storage cap, and are pruned on removal", async () => {
  const dir = mkdtempSync(join(tmpdir(), "psxtv-test-"));
  const storageFile = join(dir, "storage.json");
  try {
    let runtime = setup({storageFile});
    const cats = await plugin.liveCategories();
    const a = await all(runtime, cats[0].id);
    const b = await all(runtime, cats[1].id);
    assert.ok(readFileSync(storageFile).length < 256 * 1024);
    runtime = setup({storageFile, replay: null, fetchImpl: async () => { throw new Error("must use persistent cache"); }});
    assert.equal((await all(runtime, cats[0].id)).items[0].id, a.items[0].id);
    assert.equal((await all(runtime, cats[1].id)).items[0].id, b.items[0].id);
    const renamed = {url1: second.url, nombre1: "Chile renombrado", listas: [{url: config.url1, nombre: config.nombre1}]};
    runtime = setup({storageFile, config: renamed});
    const newCats = await plugin.liveCategories();
    assert.equal(newCats[0].id, cats[1].id);
    assert.equal((await all(runtime, newCats[0].id)).items[0].id, b.items[0].id);
    runtime = setup({storageFile, config: {listas: [second]}});
    const kept = await plugin.liveCategories();
    assert.equal(kept.length, 1);
    assert.equal(runtime.kino.storage.keys().length, 1);
    await assert.rejects(plugin.resolve(a.items[0].ref), {code: "not_found"});
    assert.equal((await all(runtime, kept[0].id)).items.length, 387);
  } finally { rmSync(dir, {recursive: true, force: true}); }
});

test("logos can be enabled without changing channel IDs", async () => {
  let runtime = setup();
  const cats = await plugin.liveCategories();
  const plain = await all(runtime, cats[1].id);
  runtime = setup({config: {...config, logos: true}});
  const withLogos = await all(runtime, cats[1].id);
  assert.deepEqual(withLogos.items.map(x => x.id), plain.items.map(x => x.id));
  assert.ok(withLogos.items.every(x => x.logo?.startsWith("https://cdn.m3u.cl/")));
});

const fixtureConfig = {nombre1: "Uno", url1: "https://m3u.cl/uno.m3u", listas: [{nombre: "Dos", url: "https://m3u.cl/dos.m3u"}]};
function fake(text, status = 200) {
  return async () => new Response(text, {status, headers: {"content-type": "audio/x-mpegurl"}});
}

test("same tvg-id across sources stays separate; repeated IDs within a source do not collide", async () => {
  const text = '#EXTM3U\n#EXTINF:-1 tvg-id="canal",Canal\nhttps://cdn.m3u.cl/uno.m3u8\n#EXTINF:-1 tvg-id="canal",Canal alternativo\nhttps://cdn.m3u.cl/dos.m3u8\n';
  const runtime = setup({config: fixtureConfig, replay: null, fetchImpl: fake(text)});
  const cats = await plugin.liveCategories();
  const a = await all(runtime, cats[0].id), b = await all(runtime, cats[1].id);
  assert.equal(new Set([...a.items, ...b.items].map(x => x.id)).size, 4);
  assert.equal(a.items[0].stream.url, b.items[0].stream.url);
});

test("a failed list produces a typed error while the other list remains usable", async () => {
  const text = '#EXTM3U\n#EXTINF:-1,Canal\nhttps://cdn.m3u.cl/live.m3u8\n';
  const runtime = setup({config: fixtureConfig, replay: null, fetchImpl: async url => new Response(String(url).includes("uno.m3u") ? "down" : text, {status: String(url).includes("uno.m3u") ? 503 : 200})});
  const cats = await plugin.liveCategories();
  await assert.rejects(plugin.liveChannels({categoryId: cats[0].id, cursor: null}), {code: "unavailable"});
  assert.equal((await all(runtime, cats[1].id)).items.length, 1);
  await assert.rejects(plugin.liveChannels({categoryId: cats[1].id, cursor: "-1"}), {code: "not_found"});
  await assert.rejects(plugin.resolve("removed-list:channel"), {code: "not_found"});
});

test("malformed entries and unsupported protocols are skipped; quoted metadata and headers survive", async () => {
  const text = '\uFEFF#EXTM3U\r\nhttps://cdn.m3u.cl/orphan.m3u8\r\n#EXTINF:-1 tvg-id="x" tvg-name="Nombre, con coma",Canal válido\r\n#EXTVLCOPT:http-user-agent=VLC/3\r\n#EXTHTTP:{"Origin":"https://m3u.cl"}\r\nhttps://cdn.m3u.cl/live.m3u8|Referer=https%3A%2F%2Fm3u.cl%2F\r\n#EXTINF:-1,No HTTP\r\nudp://239.1.1.1:1234\r\n#EXTINF:-1,DRM fuera de la prueba\r\n#KODIPROP:inputstream.adaptive.license_type=com.widevine.alpha\r\nhttps://cdn.m3u.cl/drm.mpd\r\n#EXTINF:-1,Entrada incompleta\r\n';
  const runtime = setup({config: fixtureConfig, replay: null, fetchImpl: fake(text)});
  const cats = await plugin.liveCategories();
  const {items} = await all(runtime, cats[0].id);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Canal válido");
  assert.deepEqual(items[0].stream.headers, {"User-Agent": "VLC/3", Origin: "https://m3u.cl", Referer: "https://m3u.cl/"});
});

test("HTML, an individual HLS video manifest and an oversized list fail as controlled errors", async () => {
  for (const [text, code] of [["<html>Error</html>", "unavailable"], ["#EXTM3U\n#EXT-X-TARGETDURATION:6\n#EXTINF:6,\nhttps://cdn.m3u.cl/segment.ts\n", "unavailable"], ["#EXTM3U\n" + " ".repeat(512000), "too_large"]]) {
    setup({config: fixtureConfig, replay: null, fetchImpl: fake(text)});
    const cats = await plugin.liveCategories();
    await assert.rejects(plugin.liveChannels({categoryId: cats[0].id, cursor: null}), {code});
  }
});

test("one saved primary list remains unchanged after upgrading from 0.1.3", async () => {
  const previous = JSON.parse(readFileSync(new URL("upgrade-snapshot.json", import.meta.url)));
  const runtime = setup({config: {nombre1: config.nombre1, url1: config.url1}});
  const cats = checked(runtime, "liveCategories", await plugin.liveCategories()).categories;
  assert.equal(cats.length, 1);
  assert.equal(cats[0].id, previous.sources[0].categoryId);
  const page = await plugin.liveChannels({categoryId: cats[0].id, cursor: null});
  assert.equal(page.items[0].id, previous.sources[0].firstChannelId);
  assert.equal(page.items[0].ref, previous.sources[0].firstChannelRef);
});

test("moving a source into More lists preserves its previous channel references", async () => {
  const previous = JSON.parse(readFileSync(new URL("upgrade-snapshot.json", import.meta.url)));
  const runtime = setup();
  const cats = checked(runtime, "liveCategories", await plugin.liveCategories()).categories;
  assert.equal(cats[1].id, previous.sources[1].categoryId);
  const page = await plugin.liveChannels({categoryId: cats[1].id, cursor: null});
  assert.equal(page.items[0].id, previous.sources[1].firstChannelId);
  assert.equal(page.items[0].ref, previous.sources[1].firstChannelRef);
});

test("adding URL fields grants exactly the additional HTTP host and port", async () => {
  const added = "http://190.108.83.69:8001/segunda.m3u";
  const seen = [];
  const text = '#EXTM3U\n#EXTINF:-1,Canal\nhttps://cdn.m3u.cl/live.m3u8\n';
  const runtime = setup({config: {url1: config.url1, listas: [{url: added, nombre: "Nueva"}]}, replay: null, fetchImpl: async url => {seen.push(String(url));return new Response(text,{status:200});}});
  const cats = checked(runtime, "liveCategories", await plugin.liveCategories()).categories;
  assert.equal((await all(runtime, cats[0].id)).items.length, 1);
  assert.equal((await all(runtime, cats[1].id)).items.length, 1);
  assert.deepEqual(seen, [config.url1, added]);
  await assert.rejects(runtime.kino.fetch("http://190.108.83.69:8002/otra.m3u"), {code:"host_not_allowed"});
});

test("duplicate URLs are one category and unnamed additions get a usable title", async () => {
  const runtime = setup({config: {url1: config.url1, nombre1: "PSX", listas: [{url: config.url1, nombre: "Repetida"}, {url: second.url, nombre: "   "}]}});
  const cats = checked(runtime, "liveCategories", await plugin.liveCategories()).categories;
  assert.deepEqual(cats.map(c => c.title), ["PSX", "Lista 3"]);
  assert.equal((await all(runtime, cats[1].id)).items.length, 387);
});

test("ten custom lists plus integrated Chile retain at most two bounded cached texts", async () => {
  const dir = mkdtempSync(join(tmpdir(), "psxtv-many-"));
  try {
    const urls = Array.from({length:10}, (_, i) => "https://m3u.cl/lista-" + i + ".m3u");
    const storageFile = join(dir, "storage.json");
    const text = '#EXTM3U\n#' + 'x'.repeat(78000) + '\n#EXTINF:-1,Canal\nhttps://cdn.m3u.cl/live.m3u8\n';
    const runtime = setup({storageFile, config: {chilenos: true, url1: urls[0], listas: urls.slice(1).map((url,i) => ({url,nombre:"Extra " + i}))}, replay: null, fetchImpl: fake(text)});
    const cats = checked(runtime, "liveCategories", await plugin.liveCategories()).categories;
    assert.equal(cats.length, 11);
    assert.equal(cats.at(-1).title, "Chile");
    for (const cat of cats) {
      assert.equal((await all(runtime, cat.id)).items.length, 1);
      assert.ok(runtime.kino.storage.keys().length <= 2);
      assert.ok(runtime.kino.storage.get("psxtv.m3u." + cat.id));
      assert.ok(readFileSync(storageFile).length < 256 * 1024);
    }
    assert.equal((await all(runtime, cats[0].id)).items.length, 1);
  } finally { rmSync(dir, {recursive:true,force:true}); }
});

test("diagnostic mode checks only two sources even with ten configured lists", async () => {
  const urls = Array.from({length:10}, (_, i) => "https://m3u.cl/lista-" + i + ".m3u");
  const seen = [];
  const text = '#EXTM3U\n#EXTINF:-1,Canal\nhttps://cdn.m3u.cl/live.m3u8\n';
  const runtime = setup({config: {diagnostico:true,url1:urls[0],listas:urls.slice(1).map((url,i) => ({url,nombre:"Extra " + i}))}, replay:null,fetchImpl:async url => {seen.push(String(url));return new Response(text,{status:200});}});
  const cats = checked(runtime, "liveCategories", await plugin.liveCategories()).categories;
  assert.equal(cats.length, 11);
  assert.deepEqual(seen, urls.slice(0,2));
  assert.match(cats.at(-1).title, /10 listas configuradas$/);
  assert.equal((await all(runtime, cats[9].id)).items.length, 1);
  assert.deepEqual(seen, [urls[0],urls[1],urls[9]]);
});
