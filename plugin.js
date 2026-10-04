// PSXtv 0.1.3. One module for Kino's QuickJS runtime; no imports or network at module load.
// Return individual channels, rather than { playlist }, to exercise a different M3U loading path.
const PAGE_SIZE = 100;
const MAX_CHANNELS = 1000;
const MAX_TEXT = 512000;
const CACHE_BYTES = 90000; // At most two entries: leaves space below Kino's 256 KB storage cap.
const CACHE_TTL = 15 * 60 * 1000;
const CACHE_PREFIX = "psxtv.m3u.";
const VERSION = "0.1.3";
const DIAGNOSTIC_ID = "psxtv-diagnostico";
const HEADER_NAMES = {"user-agent": "User-Agent", referer: "Referer", referrer: "Referer", origin: "Origin", cookie: "Cookie"};

function digest(value) {
  return kino.crypto.hash("sha256", value).slice(0, 24);
}

function httpUrl(value) {
  return /^https?:\/\/[^\s/?#]+(?:[/?#][^\s]*)?$/i.test(value);
}

function sources() {
  // Kino's app-side hosts=[] check requires top-level URL settings; nested list URLs are not counted.
  const rows = [1, 2].map(n => ({url: kino.config.get("url" + n), nombre: kino.config.get("nombre" + n)}));
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const url = String(row.url || "").trim();
    if (!httpUrl(url) || seen.has(url)) continue;
    seen.add(url);
    out.push({id: "lista-" + digest(url), url, title: String(row.nombre || "Lista IPTV").trim().slice(0, 80)});
  }
  // A manifest hint is only a placeholder on TV; it is never a saved URL or a network grant.
  if (!out.length) {
    throw kino.error("auth_required", "No hay una URL M3U guardada. Abre el campo URL, escribe la dirección y guarda la configuración.");
  }
  return out;
}

function cleanCache(lists) {
  const keep = new Set(lists.map(s => CACHE_PREFIX + s.id));
  try {
    for (const key of kino.storage.keys()) {
      if (key.startsWith(CACHE_PREFIX) && !keep.has(key)) kino.storage.remove(key);
    }
  } catch (_) {
    kino.log("PSXtv: no se pudo limpiar la caché; se continúa con las listas configuradas.");
  }
}

function byteLength(text) {
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 128) n++;
    else if (c < 2048) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length && text.charCodeAt(i + 1) >= 0xdc00 && text.charCodeAt(i + 1) <= 0xdfff) { n += 4; i++; }
    else n += 3;
    if (n > CACHE_BYTES) break;
  }
  return n;
}

function addHeader(headers, key, value) {
  const name = HEADER_NAMES[String(key).trim().toLowerCase()];
  if (name && typeof value === "string" && value.length <= 1024 && !/[\x00-\x1f\x7f]/.test(value)) {
    const clean = value.trim();
    if (clean) headers[name] = clean;
  }
}

function headerPairs(value, headers) {
  for (const pair of value.split("&")) {
    const at = pair.indexOf("=");
    if (at < 0) continue;
    try { addHeader(headers, decodeURIComponent(pair.slice(0, at)), decodeURIComponent(pair.slice(at + 1))); } catch (_) {}
  }
}

function metadata(line) {
  const body = line.slice(line.indexOf(":") + 1);
  let quoted = "", at = -1;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quoted) { if (ch === quoted) quoted = ""; }
    else if (ch === '"' || ch === "'") quoted = ch;
    else if (ch === ",") { at = i; break; }
  }
  const head = at < 0 ? body : body.slice(0, at);
  const attrs = {};
  const re = /([A-Za-z0-9_-]+)=(?:"([^"]*)"|'([^']*)'|([^\s]+))/g;
  let m;
  while ((m = re.exec(head)) !== null) attrs[m[1].toLowerCase()] = (m[2] === undefined ? m[3] === undefined ? m[4] : m[3] : m[2]).trim();
  return {attrs, title: (at < 0 ? attrs["tvg-name"] || "" : body.slice(at + 1)).trim().slice(0, 200)};
}

function parse(text, source) {
  if (text.length > MAX_TEXT) throw kino.error("too_large", "La lista supera el tamaño de esta prueba.");
  text = text.replace(/^\uFEFF/, "");
  if (!/^\s*#EXTM3U\b/i.test(text) || /^(?:#EXT-X-TARGETDURATION|#EXT-X-STREAM-INF):/im.test(text)) {
    throw kino.error("unavailable", "La dirección no contiene una lista IPTV M3U.");
  }
  const channels = [], ids = new Set(), tvgIds = new Set();
  let pending = null, headers = {}, drm = false, skipped = 0;
  for (const raw of text.split(/\r?\n|\r/)) {
    const line = raw.trim();
    if (!line) continue;
    const lower = line.toLowerCase();
    if (lower.startsWith("#extinf:")) {
      if (pending) skipped++;
      pending = metadata(line); headers = {}; drm = false;
    } else if (lower.startsWith("#extvlcopt:") && pending) {
      const opt = line.slice(line.indexOf(":") + 1), at = opt.indexOf("=");
      if (at > 0) addHeader(headers, opt.slice(0, at).replace(/^http-/i, ""), opt.slice(at + 1));
    } else if (lower.startsWith("#exthttp:") && pending) {
      try {
        const values = JSON.parse(line.slice(line.indexOf(":") + 1));
        if (values && typeof values === "object") for (const key of Object.keys(values)) addHeader(headers, key, values[key]);
      } catch (_) {}
    } else if (lower.startsWith("#kodiprop:") && /license_(type|key)\s*=/i.test(line)) {
      drm = true; // This minimum test does not implement DRM.
    } else if (!line.startsWith("#")) {
      const info = pending, keptHeaders = headers, protectedEntry = drm;
      pending = null; headers = {}; drm = false;
      const pipe = line.indexOf("|");
      const url = (pipe < 0 ? line : line.slice(0, pipe)).trim();
      if (!info || !info.title || !httpUrl(url) || protectedEntry) { skipped++; continue; }
      if (pipe >= 0) headerPairs(line.slice(pipe + 1), keptHeaders);
      const tvgId = info.attrs["tvg-id"] || "";
      const useTvg = tvgId && !tvgIds.has(tvgId);
      const id = source.id + "-" + digest(useTvg ? "tvg:" + tvgId : url + "\n" + info.title);
      if (tvgId) tvgIds.add(tvgId);
      if (ids.has(id)) { skipped++; continue; }
      ids.add(id);
      const stream = {url};
      if (/\.m3u8(?:[?#]|$)/i.test(url)) stream.mime = "application/vnd.apple.mpegurl";
      else if (/\.mpd(?:[?#]|$)/i.test(url)) stream.mime = "application/dash+xml";
      if (Object.keys(keptHeaders).length) stream.headers = keptHeaders;
      const channel = {id, ref: id, title: info.title, categoryId: source.id, stream};
      if (kino.config.get("logos") === true && httpUrl(info.attrs["tvg-logo"] || "")) channel.logo = info.attrs["tvg-logo"];
      const number = Number(info.attrs["tvg-chno"]);
      if (Number.isInteger(number) && number >= 1 && number <= 9999) channel.number = number;
      channels.push(channel);
      if (channels.length >= MAX_CHANNELS) break;
    }
  }
  if (pending) skipped++;
  if (!channels.length) throw kino.error("unavailable", "La lista no contiene canales HTTP o HTTPS válidos.");
  kino.log("PSXtv: " + channels.length + " canales; " + skipped + " entradas descartadas.");
  return channels;
}

async function load(source, fresh = false) {
  const key = CACHE_PREFIX + source.id;
  let cached = null;
  if (!fresh) {
    try { cached = kino.storage.get(key); }
    catch (_) { kino.log("PSXtv: no se pudo leer la caché; se descargará la lista."); }
  }
  if (cached) {
    try { return parse(cached, source); }
    catch (_) { try { kino.storage.remove(key); } catch (_) {} }
  }
  const r = await kino.fetch(source.url, {timeoutMs: 12000});
  if (r.status === 401 || r.status === 403) throw kino.error("auth_required", "El servidor rechazó el acceso a la lista.");
  if (r.status === 429) throw kino.error("rate_limited", "El servidor pide esperar antes de volver a cargar.");
  if (!r.ok) throw kino.error("unavailable", "No se pudo cargar la lista (HTTP " + r.status + ").");
  const text = r.text();
  const channels = parse(text, source);
  if (byteLength(JSON.stringify(text)) <= CACHE_BYTES) {
    try { kino.storage.set(key, text, {ttlMs: CACHE_TTL}); }
    catch (_) { kino.log("PSXtv: no se pudo guardar la caché; se conserva la respuesta actual."); }
  }
  return channels;
}

export async function home() {
  await null;
  return [];
}

function errorLabel(error) {
  const code = error && typeof error.code === "string" && /^[a-z_]{1,32}$/.test(error.code) ? error.code : "unknown";
  const http = error && typeof error.message === "string" ? /\(HTTP ([0-9]{3})\)/.exec(error.message) : null;
  return http ? "HTTP " + http[1] : code;
}

function diagnosticTitle() {
  const state = n => {
    const value = String(kino.config.get("url" + n) || "").trim();
    return !value ? "vacía" : httpUrl(value) ? "guardada" : "inválida";
  };
  const app = String(kino.appVersion || "desconocido").replace(/[\x00-\x1f\x7f]/g, "").slice(0, 32);
  return "Prueba " + VERSION + " | Kino " + app + " | URL 1 " + state(1) + " | URL 2 " + state(2);
}

export async function liveCategories() {
  await null;
  if (kino.config.get("diagnostico") === false) {
    const lists = sources();
    cleanCache(lists);
    return lists.map(s => ({id: s.id, title: s.title}));
  }
  // A static category remains visible even if config, hashing or HTTP fails. No fake channels.
  let title = "Prueba " + VERSION;
  let lists;
  try { title = diagnosticTitle(); lists = sources(); }
  catch (error) {
    kino.log("PSXtv: diagnóstico configuración " + errorLabel(error));
    return [{id: DIAGNOSTIC_ID, title: (title + " | " + errorLabel(error)).slice(0, 200)}];
  }
  cleanCache(lists);
  // At most two requests, each bounded at 12 seconds, inside the 20-second category call.
  const categories = await Promise.all(lists.map(async source => {
    await null;
    let result;
    try { result = (await load(source, true)).length + " canales"; }
    catch (error) { result = "error " + errorLabel(error); }
    return {id: source.id, title: source.title + " — " + result};
  }));
  categories.push({id: DIAGNOSTIC_ID, title});
  return categories;
}

export async function liveChannels(request) {
  await null;
  if (request.categoryId === DIAGNOSTIC_ID) return {items: []};
  const lists = sources();
  cleanCache(lists);
  const source = lists.find(s => s.id === request.categoryId);
  if (!source) throw kino.error("not_found", "Esta lista ya no está configurada.");
  const cursor = request.cursor == null ? "0" : String(request.cursor);
  if (!/^(0|[1-9][0-9]{0,5})$/.test(cursor)) throw kino.error("not_found", "La página solicitada no es válida.");
  const start = Number(cursor);
  const channels = await load(source);
  const end = start + PAGE_SIZE;
  const page = {items: channels.slice(start, end)};
  if (end < channels.length) page.next = String(end);
  return page;
}

export async function resolve(ref) {
  await null;
  const lists = sources();
  cleanCache(lists);
  const source = lists.find(s => typeof ref === "string" && ref.startsWith(s.id + "-"));
  if (!source) throw kino.error("not_found", "Esta lista ya no está configurada.");
  const channel = (await load(source)).find(c => c.id === ref);
  if (!channel) throw kino.error("not_found", "El canal ya no está en la lista.");
  return channel.stream;
}
