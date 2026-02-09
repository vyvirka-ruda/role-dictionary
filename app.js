/* =========================
   GLOBAL STATE
========================= */

let ROLES = [];
let ROLE_BY_ID = new Map();
let STRUCTURE = null;

const SHOW_RESULTS_ONLY_ON_LEAF = true; // ключова правка проти "месива"

/* =========================
   UTILS
========================= */

function slug(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function norm(s) {
  return String(s || "").trim().toLowerCase();
}

/* =========================
   UI HELPERS
========================= */

function setResetVisible(visible) {
  const btn = document.getElementById("reset");
  if (!btn) return;
  btn.classList.toggle("show", !!visible);
}

function renderResultsEmpty(text = "Оберіть гілку дерева") {
  document.getElementById("results").innerHTML = `<div class="empty">${text}</div>`;
}

function renderRoleEmpty(text = 'Оберіть роль у “Результатах”, щоб побачити картку.') {
  document.getElementById("role").innerHTML = `<div class="empty">${text}</div>`;
}

function clearActive() {
  document.querySelectorAll("#tree .node").forEach(n => n.classList.remove("active"));
}

function setAllTreeNodes(open) {
  document.querySelectorAll("#tree .node").forEach(node => {
    const row = node.querySelector(":scope > .row");
    const toggle = row?.querySelector(".toggle");
    const children = node.querySelector(":scope > .children");
    if (!children || !toggle) return;

    children.style.display = open ? "block" : "none";
    toggle.textContent = open ? "–" : "+";
  });
}

/* =========================
   ROLE INDEX + NORMALIZE
========================= */

function normalizeRoles(raw) {
  // roles.json у нас: [{...}, {...}]
  // Уніфікуємо поля під UI
  return (raw || []).map(r => ({
    ...r,
    title: r.title || "—",
    category_path: Array.isArray(r.category_path) ? r.category_path : [],
    domain: r.domain || "—",
    // для відображення:
    ui_snapshot: r.summary?.role_snapshot || "—",
    ui_synonyms: Array.isArray(r.content?.job_title_synonyms) ? r.content.job_title_synonyms : [],
  }));
}

function indexRoles(roles) {
  ROLE_BY_ID = new Map();
  roles.forEach(r => {
    if (r?.id) ROLE_BY_ID.set(r.id, r);
  });
}

/* =========================
   STRUCTURE HELPERS
========================= */

// structure.json: { engineering:{name,children}, non_engineering:{name,children} }
function flattenStructureRoots(structure) {
  const roots = [];
  if (structure?.engineering) roots.push(structure.engineering);
  if (structure?.non_engineering) roots.push(structure.non_engineering);
  return roots;
}

// leaf node → знайти роль по title; fallback → по synonyms
function findRolesForLeafName(leafName) {
  const target = norm(leafName);

  // 1) точний match по title
  let matches = ROLES.filter(r => norm(r.title) === target);
  if (matches.length) return matches;

  // 2) fallback: якщо leaf назвали як синонім (job_title_synonyms)
  matches = ROLES.filter(r =>
    (r.ui_synonyms || []).some(s => norm(s) === target)
  );
  return matches;
}

function attachRolesToStructure(node, path = []) {
  const currentPath = [...path, node.name];
  const children = Array.isArray(node.children) ? node.children : [];

  if (!children.length) {
    const roles = findRolesForLeafName(node.name);

    node.__meta = {
      path: currentPath,
      roles,
      isLeaf: true
    };
    return roles;
  }

  let roles = [];
  for (const ch of children) {
    roles = roles.concat(attachRolesToStructure(ch, currentPath));
  }

  node.__meta = {
    path: currentPath,
    roles,
    isLeaf: false
  };
  return roles;
}

/* =========================
   RESULTS
========================= */

function renderResults(list) {
  const el = document.getElementById("results");
  el.innerHTML = "";

  if (!list || !list.length) {
    el.innerHTML = `<div class="empty">Немає ролей у цій гілці.</div>`;
    return;
  }

  for (const role of list) {
    const card = document.createElement("div");
    card.className = "result-card";

    const pathText = (role.category_path || []).join(" → ");
    const synonyms = (role.ui_synonyms || []).slice(0, 8).join(" • ");

    card.innerHTML = `
      <h3>${role.title}</h3>
      <div class="badges">
        <span class="badge domain domain-${slug(role.domain)}">${role.domain}</span>
      </div>
      <div class="path">${pathText || "—"}</div>
      <div class="muted">${synonyms || ""}</div>
    `;

    card.addEventListener("click", () => {
      renderRole(role);
      history.replaceState({}, "", `#role=${encodeURIComponent(role.id)}`);
      setResetVisible(true);
    });

    el.appendChild(card);
  }
}

function renderRole(role) {
  const el = document.getElementById("role");

  const tags = (role.tags || [])
    .map(t => `<span class="tag">${t}</span>`)
    .join("");

  el.innerHTML = `
    <div class="role-card">
      <h2>${role.title}</h2>

      <div class="kv">
        <strong>Домен:</strong>
        <span class="badge domain domain-${slug(role.domain)}">${role.domain}</span>
      </div>

      <div class="kv">
        <strong>Шлях:</strong>
        ${(role.category_path || []).join(" → ") || "—"}
      </div>

      <div class="kv">
        <strong>Опис:</strong>
        ${role.ui_snapshot || "—"}
      </div>

      <div class="kv">
        <strong>Синоніми:</strong>
        ${(role.ui_synonyms || []).join(", ") || "—"}
      </div>

      <div class="kv">
        <strong>Теги:</strong>
        <span class="tags">${tags || "—"}</span>
      </div>
    </div>
  `;
}

/* =========================
   TREE RENDER
========================= */

function renderStructureTree(container, nodes, prefix = []) {
  container.innerHTML = "";

  for (const nodeObj of nodes) {
    const node = document.createElement("div");
    node.className = "node";

    const row = document.createElement("div");
    row.className = "row";

    const hasChildren = Array.isArray(nodeObj.children) && nodeObj.children.length > 0;
    row.innerHTML = `
      <span class="toggle">${hasChildren ? "+" : "•"}</span>
      <span class="label">${nodeObj.name}</span>
    `;

    node.appendChild(row);

    const childrenWrap = document.createElement("div");
    childrenWrap.className = "children";
    childrenWrap.style.display = "none";
    node.appendChild(childrenWrap);

    if (hasChildren) {
      renderStructureTree(childrenWrap, nodeObj.children, [...prefix, nodeObj.name]);
    }

    row.addEventListener("click", () => {
      const isOpen = childrenWrap.style.display !== "none";

      // toggle UI
      if (hasChildren) {
        childrenWrap.style.display = isOpen ? "none" : "block";
        row.querySelector(".toggle").textContent = isOpen ? "+" : "–";
      }

      // active highlight
      clearActive();
      node.classList.add("active");

      // якщо закрили вузол — чистимо
      if (hasChildren && isOpen) {
        renderResultsEmpty("Оберіть гілку дерева");
        renderRoleEmpty();
        history.replaceState({}, "", "#");
        setResetVisible(false);
        return;
      }

      const roles = nodeObj.__meta?.roles || [];
      const isLeaf = !!nodeObj.__meta?.isLeaf;

      // КЛЮЧ: НЕ показуємо результати на non-leaf (щоб не було “месива”)
      if (SHOW_RESULTS_ONLY_ON_LEAF && !isLeaf) {
        renderResultsEmpty("Розгорніть гілку до конкретної ролі");
        renderRoleEmpty();
        setResetVisible(true);
        return;
      }

      // leaf або режим дозволяє показ на вузлах
      if (!roles.length) {
        renderResultsEmpty("Немає ролей у цій гілці");
        renderRoleEmpty();
        setResetVisible(true);
        return;
      }

      renderResults(roles);
      renderRoleEmpty();
      setResetVisible(true);
    });

    container.appendChild(node);
  }
}

/* =========================
   SEARCH
========================= */

function setupSearch() {
  const input = document.getElementById("search");
  const resetBtn = document.getElementById("reset");

  input.addEventListener("input", () => {
    const q = norm(input.value);
    if (!q) {
      renderResultsEmpty();
      renderRoleEmpty();
      setResetVisible(location.hash.startsWith("#role="));
      return;
    }

    const list = ROLES.filter(r => {
      const hay = [
        r.title,
        r.domain,
        ...(r.tags || []),
        ...(r.ui_synonyms || []),
        ...(r.category_path || []),
        r.ui_snapshot
      ].join(" ").toLowerCase();

      return hay.includes(q);
    });

    renderResults(list);
    renderRoleEmpty();
    setResetVisible(true);
  });

  resetBtn?.addEventListener("click", () => {
    input.value = "";
    renderResultsEmpty();
    renderRoleEmpty();
    setAllTreeNodes(false);
    clearActive();
    history.replaceState({}, "", "#");
    setResetVisible(false);
  });
}

/* =========================
   INIT
========================= */

async function init() {
  // 1) roles.json: очікуємо МАСИВ
  const rolesRaw = await fetch("./roles.json").then(r => r.json());
  ROLES = normalizeRoles(Array.isArray(rolesRaw) ? rolesRaw : (rolesRaw.roles || []));

  if (!ROLES.length) {
    document.getElementById("tree").innerHTML =
      `<div class="empty">roles.json завантажився, але ролей немає.</div>`;
    renderResultsEmpty("Немає ролей");
    renderRoleEmpty();
    return;
  }

  indexRoles(ROLES);

  // 2) structure
  STRUCTURE = await fetch("./structure.json").then(r => r.json());
  const roots = flattenStructureRoots(STRUCTURE);

  // 3) attach roles to structure
  for (const r of roots) attachRolesToStructure(r, []);

  // 4) render
  renderStructureTree(document.getElementById("tree"), roots);

  document.getElementById("expandAll")?.addEventListener("click", () => {
    setAllTreeNodes(true);
    setResetVisible(true);
  });

  document.getElementById("collapseAll")?.addEventListener("click", () => {
    setAllTreeNodes(false);
    setResetVisible(true);
  });

  renderResultsEmpty();
  renderRoleEmpty();
  setupSearch();
  setResetVisible(false);

  // deep link #role=
  const hash = decodeURIComponent(location.hash || "");
  if (hash.startsWith("#role=")) {
    const id = hash.replace("#role=", "");
    const role = ROLE_BY_ID.get(id);
    if (role) {
      renderResults([role]);
      renderRole(role);
      setResetVisible(true);
    }
  }
}

init().catch(err => {
  const msg = "Помилка завантаження JSON: " + err;
  document.getElementById("tree").innerHTML = `<div class="empty">${msg}</div>`;
  document.getElementById("results").innerHTML = `<div class="empty">${msg}</div>`;
  document.getElementById("role").innerHTML = `<div class="empty">${msg}</div>`;
});
