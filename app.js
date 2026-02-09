/* app.js — leaf only rendering */

const TREE_EL = document.getElementById("tree");
const RESULTS_EL = document.getElementById("results");

let structure = null;          // structure.json (tree + order)
let roles = [];                // roles.json (flat list)
let roleByTitle = new Map();   // title -> role

// ---------- boot ----------
(async function init() {
  structure = await fetchJSON("structure.json");
  roles = await fetchJSON("roles.json");

  // Index roles by title (leaf == exact match to role.title)
  roleByTitle = new Map(
    roles
      .filter(r => r && typeof r.title === "string")
      .map(r => [normalizeTitle(r.title), r])
  );

  renderTree(structure, TREE_EL);
  clearResults(); // нічого не показуємо на старті
})().catch(err => {
  console.error(err);
  RESULTS_EL.innerHTML = `<div class="error">Помилка завантаження даних</div>`;
});

// ---------- io ----------
async function fetchJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return await res.json();
}

// ---------- rendering: tree ----------
function renderTree(structureJson, mountEl) {
  mountEl.innerHTML = "";

  // Очікуємо, що structure.json уже містить правильний порядок блоків
  // і 3 рівні: level1 -> level2 -> leaf(role.title)
  // Підтримуємо 2 поширені форми:
  // A) { blocks: [{ title, children:[{title, children:[{title}]}]}] }
  // B) [{ title, children:[...]}]
  const blocks = Array.isArray(structureJson)
    ? structureJson
    : Array.isArray(structureJson.blocks)
      ? structureJson.blocks
      : [];

  const ul = document.createElement("ul");
  ul.className = "tree-root";

  for (const block of blocks) {
    ul.appendChild(renderNode(block, 1));
  }

  mountEl.appendChild(ul);
}

function renderNode(node, level) {
  const li = document.createElement("li");
  li.className = `tree-node level-${level}`;

  const header = document.createElement("button");
  header.type = "button";
  header.className = "tree-label";
  header.textContent = node.title ?? "Untitled";

  // Визначаємо leaf строго:
  // leaf = level === 3 (або node.leaf === true), і title має відповідати role.title 1:1
  const isLeaf = isLeafNode(node, level);

  if (isLeaf) {
    header.classList.add("is-leaf");
    header.addEventListener("click", () => onLeafClick(node.title));
    li.appendChild(header);
    return li;
  }

  // НЕ leaf: клік лише toggle, без renderResults
  header.classList.add("is-branch");
  header.setAttribute("aria-expanded", "false");

  const childrenWrap = document.createElement("div");
  childrenWrap.className = "tree-children";
  childrenWrap.hidden = true;

  const children = Array.isArray(node.children) ? node.children : [];
  const ul = document.createElement("ul");
  for (const child of children) ul.appendChild(renderNode(child, level + 1));
  childrenWrap.appendChild(ul);

  header.addEventListener("click", () => {
    const next = childrenWrap.hidden; // відкриваємо якщо було закрито
    childrenWrap.hidden = !next;
    header.setAttribute("aria-expanded", String(next));
    // ВАЖЛИВО: тут НІЧОГО не рендеримо в results
  });

  li.appendChild(header);
  li.appendChild(childrenWrap);
  return li;
}

function isLeafNode(node, level) {
  // “Без магії”: leaf — це тільки 3-й рівень структури (або явний прапорець)
  if (node && node.leaf === true) return true;
  return level === 3;
}

// ---------- interaction: leaf click ----------
function onLeafClick(title) {
  const key = normalizeTitle(title);
  const role = roleByTitle.get(key);

  if (!role) {
    // leaf у дереві є, але ролі в roles.json нема — показуємо “not found”
    renderResults([{ title, _missing: true }]);
    return;
  }

  // ЄДИНИЙ дозволений шлях:
  // leaf-click → renderResults([role]) → renderRole(role)
  renderResults([role]);
}

// ---------- rendering: results ----------
function clearResults() {
  RESULTS_EL.innerHTML = `<div class="hint">Обери конкретну роль (leaf) у дереві.</div>`;
}

function renderResults(items) {
  RESULTS_EL.innerHTML = "";

  // За правилами тут очікуємо масив з 1 роллю, але робимо універсально
  for (const role of items) {
    RESULTS_EL.appendChild(renderRole(role));
  }
}

function renderRole(role) {
  const card = document.createElement("article");
  card.className = "role-card";

  const h = document.createElement("h3");
  h.className = "role-title";
  h.textContent = role.title ?? "Untitled role";
  card.appendChild(h);

  if (role._missing) {
    const p = document.createElement("p");
    p.className = "role-missing";
    p.textContent =
      "Цей leaf є в structure.json, але відповідної role.title немає в roles.json (1:1 не знайдено).";
    card.appendChild(p);
    return card;
  }

  // Мінімальний рендер (під твою фактичну схему roles.json можна розширити)
  // Показуємо тільки те, що вже є в role об’єкті.
  if (role.category) card.appendChild(kv("Category", role.category));
  if (role.snapshot) card.appendChild(kv("Role snapshot", role.snapshot));
  if (Array.isArray(role.not_confuse_with) && role.not_confuse_with.length) {
    card.appendChild(listBlock("Не плутати з", role.not_confuse_with));
  }
  if (role.source) card.appendChild(kv("Source", role.source));

  // Якщо хочеш — можна показувати “raw” для дебагу (вимкнено за замовчуванням)
  // card.appendChild(detailsJSON(role));

  return card;
}

function kv(label, value) {
  const wrap = document.createElement("div");
  wrap.className = "kv";

  const dt = document.createElement("div");
  dt.className = "kv-label";
  dt.textContent = label;

  const dd = document.createElement("div");
  dd.className = "kv-value";
  dd.textContent = String(value);

  wrap.appendChild(dt);
  wrap.appendChild(dd);
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

function normalizeTitle(t) {
  return String(t).trim();
}
