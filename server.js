// Taste Table: group taste-consensus agent powered by Qloo's taste graph.
// Server-side only: the Qloo key lives in the QLOO_API_KEY env var (never in the browser or this repo).
const http = require("http");
const fs = require("fs");
const path = require("path");

const BASE = "https://hackathon.api.qloo.com";
const KEY = process.env.QLOO_API_KEY || "";
const PORT = process.env.PORT || 3000;
const cache = new Map(); // private in-memory cache; Qloo data is never written to the repo

async function qloo(pathname, params) {
  const url = new URL(BASE + pathname);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") url.searchParams.set(k, v);
  const ck = url.toString();
  if (cache.has(ck)) return cache.get(ck);
  if (!KEY) throw Object.assign(new Error("Server has no Qloo key configured"), { status: 503 });
  const r = await fetch(url, { headers: { "X-Api-Key": KEY } });
  if (!r.ok) throw Object.assign(new Error(`Qloo ${pathname} returned ${r.status}`), { status: 502 });
  const j = await r.json();
  cache.set(ck, j);
  return j;
}

const entities = (j) => j?.results?.entities || j?.results || [];

// Step 1 (tool call): resolve a free-text favorite to a Qloo entity.
async function resolve(name, type) {
  const j = await qloo("/search", { query: name, types: `urn:entity:${type}`, take: 1 });
  const e = entities(j)[0];
  return e ? { id: e.entity_id, name: e.name, type } : null;
}

// Step 2 (tool call): per-person recommendations seeded by their resolved favorites.
async function recommend(ids, goal, city) {
  const j = await qloo("/v2/insights", {
    "filter.type": `urn:entity:${goal}`,
    "signal.interests.entities": ids.join(","),
    "filter.location.query": city,
    take: 50,
  });
  return entities(j).map((e) => ({
    id: e.entity_id, name: e.name,
    affinity: e.query?.affinity ?? 0,
    blurb: e.properties?.short_description || e.properties?.description || "",
    address: e.properties?.address || "",
    image: e.properties?.image?.url || e.properties?.images?.[0]?.url || "",
  }));
}

// Step 3: maximin consensus. A pick is only as good as the least-happy person's affinity for it.
function consensus(perPerson, labels) {
  const table = new Map();
  perPerson.forEach((list, pi) => list.forEach((e) => {
    if (!table.has(e.id)) table.set(e.id, { ...e, scores: new Array(perPerson.length).fill(0) });
    table.get(e.id).scores[pi] = e.affinity;
  }));
  return [...table.values()].map((c) => {
    const min = Math.min(...c.scores), avg = c.scores.reduce((a, b) => a + b, 0) / c.scores.length;
    const lowest = labels[c.scores.indexOf(min)];
    return { id: c.id, name: c.name, blurb: c.blurb, address: c.address, image: c.image,
      min, avg, scores: c.scores, lovedBy: c.scores.filter((s) => s > 0).length,
      compromise: min === 0 ? `${lowest}'s favorites don't point here, so this is a stretch for them.` : `Least-matched: ${lowest} (${Math.round(min * 100)}% affinity).` };
  }).sort((a, b) => b.min - a.min || b.avg - a.avg).slice(0, 8);
}

async function plan(body) {
  const goal = ["place", "movie", "artist", "tv_show", "destination", "podcast", "book"].includes(body.goal) ? body.goal : "place";
  const people = (body.people || []).slice(0, 6);
  if (people.length < 2) throw Object.assign(new Error("Add at least 2 people"), { status: 400 });
  const city = body.city ? String(body.city).slice(0, 60) : "";
  const resolved = [], perPerson = [];
  for (const [i, p] of people.entries()) {
    const ents = [];
    for (const f of (p.favorites || []).slice(0, 6)) {
      const r = await resolve(String(f.name).slice(0, 80), f.type || "artist");
      if (r) ents.push(r);
    }
    const label = String(p.label || `Person ${i + 1}`).slice(0, 30);
    resolved.push({ label, entities: ents });
    perPerson.push(ents.length ? await recommend(ents.map((e) => e.id), goal, city) : []);
  }
  return {
    goal, city, resolved,
    method: "Each person's favorites are resolved to Qloo entities, Qloo returns per-person affinities, and picks are ranked maximin (least-happy person first).",
    picks: consensus(perPerson, resolved.map((r) => r.label)),
    note: "Qloo results are aggregate cultural affinities, not facts about any individual. Only entity names are sent to Qloo.",
  };
}

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
http.createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/plan") {
      let b = ""; for await (const c of req) { b += c; if (b.length > 20000) throw Object.assign(new Error("Too large"), { status: 413 }); }
      const out = JSON.stringify(await plan(JSON.parse(b || "{}")));
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(out);
    }
    if (req.url === "/healthz") { res.writeHead(200); return res.end("ok"); }
    const root = path.join(__dirname, "public");
    const f = path.join(root, req.url === "/" ? "index.html" : path.normalize(decodeURIComponent(req.url.split("?")[0])));
    if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "content-type": types[path.extname(f)] || "text/plain" }); fs.createReadStream(f).pipe(res);
  } catch (e) {
    res.writeHead(e.status || 500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: e.message }));
  }
}).listen(PORT, () => console.log("Taste Table on :" + PORT));
