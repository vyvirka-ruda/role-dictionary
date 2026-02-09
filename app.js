/* app.js — strict leaf-only results (structure.name + children) */

const TREE_EL = document.getElementById("tree");
const RESULTS_EL = document.getElementById("results");

let structure = null;          // structure.json
let roles = [];                // roles.json (flat)
let roleByTitle = new Map();   // normalized title -> role

(async function init() {
  structure = await fetchJSON("structure.json");
  roles = await fetchJSON("roles.json");

  roleByTitle = new Map(
    roles
      .filter(r => r && typeof r.title === "string")
      .map(r => [normalize(r.title), r])
  );

  renderTree(structure, TREE_EL);
  clearResults();
})().catch(err => {
  console.error(err);
  RESULTS_EL.innerHTML = `<div class="error">Помилка завантаження structure.json / roles.json</div>`;
});

// ---------- IO ----------
async function fetchJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return await res.json();
}

// ---------- TREE RENDER ----------
function renderTree(structureJson, mountEl) {
  mountEl.innerHTML = "";

  // structureJson has shape: { engineering:{name,children:[]}, non_engineering:{name,children:[]} }
  const roots = [];
  if (structureJson?.engineering) roots.push(structureJson.engineering);
  if (structureJson?.non_engineering) roots.push(structureJson.non_engineering);

  const ul = document.createElement("ul");
  ul.className = "tree-root";

  for (const root of roots) {
    ul.appendChild(renderNode(root));
  }

  mountEl.appendChild(ul);
}

function renderNode(node) {
  const li = document.createElement("li");
  li.className = "tree-node";

  const labelBtn = document.createElement("button");
  labelBtn.type = "button";
  labelBtn.className = "tree-label";
  labelBtn.textContent = node?.name ?? "Untitled";

  const children = Array.isArray(node?.children) ? node.children : [];
  const isLeaf = children.length === 0; // STRICT: no children => leaf

  if (isLeaf) {
    labelBtn.classList.add("is-leaf");
    labelBtn.addEventListener("click", () => onLeafClick(node.name));
    li.appendChild(labelBtn);
    return li;
  }

  // Branch: toggle only, NEVER render results
  labelBtn.classList.add("is-branch");
  labelBtn.setAttribute("aria-expanded", "false");

  const childrenWrap = document.createElement("div");
  childrenWrap.className = "tree-children";
  childrenWrap.hidden = true;

  const ul = document.createElement("ul");
  for (const child of children) ul.appendChild(renderNode(child));
  childrenWrap.appendChild(ul);

  labelBtn.addEventListener("click", () => {
    const willOpen = childrenWrap.hidden;
    childrenWrap.hidden = !willOpen;
    labelBtn.setAttribute("aria-expanded", String(willOpen));
    // IMPORTANT: no results rendering here
  });

  li.appendChild(labelBtn);
  li.appendChild(childrenWrap);
  return li;
}

// ---------- LEAF CLICK (ONLY place that triggers results) ----------
function onLeafClick(leafName) {
  const role = roleByTitle.get(normalize(leafName));

  // leaf-click → renderResults([role]) → renderRole(role)
  if (!role) {
    renderResults([{ title: leafName, _missing: true }]);
    return;
  }

  renderResults([role]);
}

// ---------- RESULTS ----------
function clearResults() {
  RESULTS_EL.innerHTML = `<div class="hint">Клікни по конкретній ролі (leaf) у дереві.</div>`;
}

function renderResults(items) {
  RESULTS_EL.innerHTML = "";
  for (const role of items) {
    RESULTS_EL.appendChild(renderRole(role));
  }
}

function renderRole(role) {
  const card = document.createElement("article");
  card.className = "role-card";

  const h = document.createElement("h3");
  h.className = "role-title";
  h.textContent = role?.title ?? "Untitled role";
  card.appendChild(h);

  if (role._missing) {
    const p = document.createElement("p");
    p.className = "role-missing";
    p.textContent =
      "Leaf є в structure.json, але в roles.json немає ролі з точно таким role.title (1:1).";
    card.appendChild(p);
    return card;
  }

  // Мінімально, без припущень. Якщо поля існують — показуємо.
  if (role.category) card.appendChild(kv("Category", role.category));
  if (role.snapshot) card.appendChild(kv("Role snapshot", role.snapshot));
  if (role.level) card.appendChild(kv("Level", role.level));
  if (role.tags?.length) card.appendChild(listBlock("Tags", role.tags));
  if (role.not_confuse_with?.length) card.appendChild(listBlock("Не плутати з", role.not_confuse_with));
  if (role.source) card.appendChild(kv("Source", role.source));

  return card;
}

// ---------- small helpers ----------
function kv(label, value) {
  const wrap = document.createElement("div");
  wrap.className = "kv";

  const k = document.createElement("div");
  k.className = "kv-label";
  k.textContent = label;

  const v = document.createElement("div");
  v.className = "kv-value";
  v.textContent = String(value);

  wrap.appendChild(k);
  wrap.appendChild(v);
  return wrap;
}

function listBlock(label, items) {
  const wrap = document.createElement("div");
  wrap.className = "list-block";

  const t = document.createElement("div");
  t.className = "list-title";
  t.textContent = label;

  const ul = document.createElement("ul");
  for (const it of items) {
    const li = document.createElement("li");
    li.textContent = String(it);
    ul.appendChild(li);
  }

  wrap.appendChild(t);
  wrap.appendChild(ul);
  return wrap;
}

function normalize(s) {
  return String(s ?? "").trim();
}
