/* =========================
   ROLE DICTIONARY — app.js (robust matching)
   - roles.json: ARRAY of role objects
   - structure.json: { engineering:{name,children}, non_engineering:{name,children} }
   - Shows results on subdomain+ level (prevents “mash” on root)
   - FULL role card rendering
========================= */

let ROLES = [];
let ROLE_BY_ID = new Map();
let STRUCTURE = null;

const MIN_DEPTH_FOR_RESULTS = 2; // домен -> піддомен

// Indexes for robust matching
let ROLE_BY_TITLE = new Map();    // key: normalized title -> Role[]
let ROLE_BY_ALIAS = new Map();    // key: normalized alias -> Role[]

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

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// Robust normalization (fixes NBSP, zero-width, multiple spaces, dash variants)
function norm(s) {
  return String(s || "")
    .replace(/\u00A0/g, " ")         // NBSP -> space
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // zero-width
    .replace(/[–—]/g, "-")           // long dashes -> hyphen
    .replace(/\s+/g, " ")            // collapse whitespace
    .trim()
    .toLowerCase();
}

function uniq(arr) {
  return Array.from(new Set(arr || []));
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
  document.getElementById("results").innerHTML = `<div class="empty">${esc(text)}</div>`;
}

function renderRoleEmpty(text = 'Оберіть роль у “Результатах”, щоб побачити картку.') {
  document.getElementById("role").innerHTML = `<div class="empty">${esc(text)}</div>`;
}

function clearActive() {
  document.querySelectorAll("#tree .node").forEach(n => n.classList.remove("active"));
}

function setAllTreeNodes(open) {
  document.querySelectorAll("#tree .node").forEach(node => {
    const row = node.querySelector(":scope > .row");
    const toggleEl = row?.querySelector(".toggle");
    const children = node.querySelector(":scope > .children");
    if (!children || !toggleEl) return;

    children.style.display = open ? "block" : "none";
    toggleEl.textContent = open ? "–" : "+";
  });
}

/* =========================
   ROLES NORMALIZATION + INDEX
========================= */

function normalizeRoles(raw) {
  const arr = Array.isArray(raw) ? raw : (raw?.roles || []);
  return (arr || []).map(r => ({
    ...r,
    title: r.title || "—",
    domain: r.domain || "—",
    category_path: Array.isArray(r.category_path) ? r.category_path : [],
    tags: Array.isArray(r.tags) ? r.tags : [],
    summary: r.summary || {},
    content: r.content || {},
    meta: r.meta || {}
  }));
}

function indexRoles(roles) {
  ROLE_BY_ID = new Map();
  ROLE_BY_TITLE = new Map();
  ROLE_BY_ALIAS = new Map();

  const pushMap = (m, key, role) => {
    if (!key) return;
    const k = norm(key);
    if (!k) return;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(role);
  };

  for (const r of roles) {
    if (r?.id) ROLE_BY_ID.set(r.id, r);

    // title
    pushMap(ROLE_BY_TITLE, r.title, r);

    // aliases/synonyms
    const syn = r.content?.job_title_synonyms || [];
    for (const s of syn) pushMap(ROLE_BY_ALIAS, s, r);

    // (optional) also index by title as alias
    pushMap(ROLE_BY_ALIAS, r.title, r);
  }
}

/* =========================
   STRUCTURE HELPERS
========================= */

function flattenStructureRoots(structure) {
  const roots = [];
  if (structure?.engineering) roots.push(structure.engineering);
  if (structure?.non_engineering) roots.push(structure.non_engineering);
  return roots;
}

function findRolesForLeafName(leafName) {
  const key = norm(leafName);

  // 1) exact by title
  const byTitle = ROLE_BY_TITLE.get(key);
  if (byTitle && byTitle.length) return byTitle;

  // 2) by alias/synonym
  const byAlias = ROLE_BY_ALIAS.get(key);
  if (byAlias && byAlias.length) return byAlias;

  // 3) slug-based fallback (rare)
  const leafSlug = slug(key);
  if (leafSlug) {
    const hit = ROLES.filter(r => slug(norm(r.title)) === leafSlug);
    if (hit.length) return hit;
  }

  return [];
}

function attachRolesToStructure(node, path = []) {
  const currentPath = [...path, node.name];
  const children = Array.isArray(node.children) ? node.children : [];

  if (!children.length) {
    const roles = findRolesForLeafName(node.name);
    node.__meta = { path: currentPath, roles, isLeaf: true };
    return roles;
  }

  let roles = [];
  for (const ch of children) {
    roles = roles.concat(attachRolesToStructure(ch, currentPath));
  }

  node.__meta = { path: currentPath, roles, isLeaf: false };
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
    const synonyms = (role.content?.job_title_synonyms || []).slice(0, 8).join(" • ");

    card.innerHTML = `
      <h3>${esc(role.title)}</h3>
      <div class="badges">
        <span class="badge domain domain-${slug(role.domain)}">${esc(role.domain)}</span>
      </div>
      <div class="path">${esc(pathText || "—")}</div>
      <div class="muted">${esc(synonyms || "")}</div>
    `;

    card.addEventListener("click", () => {
      renderRole(role);
      history.replaceState({}, "", `#role=${encodeURIComponent(role.id)}`);
      setResetVisible(true);
    });

    el.appendChild(card);
  }
}

/* =========================
   FULL ROLE CARD
========================= */

function renderList(arr) {
  if (!arr || !arr.length) return `<div class="muted">—</div>`;
  return `<ul>${arr.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`;
}

function renderNotToConfuse(arr) {
  if (!arr || !arr.length) return `<div class="muted">—</div>`;
  return `
    <ul>
      ${arr.map(x => `<li><strong>${esc(x.role)}</strong> — ${esc(x.description)}</li>`).join("")}
    </ul>
  `;
}

function renderRole(role) {
  const el = document.getElementById("role");

  const domain = role.domain || "—";
  const pathText = (role.category_path || []).join(" → ");

  const snapshot = role.summary?.role_snapshot || "—";
  const notToConfuse = role.summary?.not_to_confuse || [];

  const core = role.content?.core_role_in_product || [];
  const resp = role.content?.typical_responsibilities || [];
  const stack = role.content?.typical_stack_and_tools || [];
  const context = role.content?.product_context || [];
  const synonyms = role.content?.job_title_synonyms || [];
  const notes = role.content?.recruiter_notes || [];

  const tagsHtml = uniq(role.tags || [])
    .map(t => `<span class="tag">${esc(t)}</span>`)
    .join("");

  const meta = role.meta || {};
  const metaLine = [
    meta.status ? `status: ${meta.status}` : "",
    (meta.version !== undefined && meta.version !== null) ? `v${meta.version}` : "",
    meta.updated_at ? `updated: ${meta.updated_at}` : ""
  ].filter(Boolean).join(" • ") || "—";

  el.innerHTML = `
    <div class="role-card">
      <div class="muted">Картка ролі</div>
      <h2>${esc(role.title || "—")}</h2>

      <div class="kv">
        <strong>Домен:</strong>
        <span class="badge domain domain-${slug(domain)}">${esc(domain)}</span>
      </div>

      <div class="kv">
        <strong>Шлях:</strong> ${esc(pathText || "—")}
      </div>

      <hr/>

      <h3>Role snapshot</h3>
      <div>${esc(snapshot)}</div>

      <h3>Не плутати з іншими ролями</h3>
      ${renderNotToConfuse(notToConfuse)}

      <h3>Роль у продукті</h3>
      ${renderList(core)}

      <h3>Типові задачі</h3>
      ${renderList(resp)}

      <h3>Стек / інструменти</h3>
      ${renderList(stack)}

      <h3>Контекст продукту</h3>
      ${renderList(context)}

      <h3>Нотатки рекрутера</h3>
      ${renderList(notes)}

      <h3>Синоніми</h3>
      <div>${synonyms.length ? esc(synonyms.join(", ")) : "—"}</div>

      <h3>Теги</h3>
      <div class="tags">${tagsHtml || "—"}</div>

      <h3>Meta</h3>
      <div class="muted">${esc(metaLine)}</div>
    </div>
  `;
}

/* =========================
   TREE
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
      <span class="label">${esc(nodeObj.name)}</span>
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

      if (hasChildren) {
        childrenWrap.style.display = isOpen ? "none" : "block";
        row.querySelector(".toggle").textContent = isOpen ? "+" : "–";
      }

      clearActive();
      node.classList.add("active");

      // if closed
      if (hasChildren && isOpen) {
        renderResultsEmpty("Оберіть гілку дерева");
        renderRoleEmpty();
        history.replaceState({}, "", "#");
        setResetVisible(false);
        return;
      }

      const roles = nodeObj.__meta?.roles || [];
      const path = [...prefix, nodeObj.name];

      // prevent mash on root
      if (path.length < MIN_DEPTH_FOR_RESULTS) {
        renderResultsEmpty("Розгорніть піддомен, щоб побачити ролі");
        renderRoleEmpty();
        setResetVisible(true);
        return;
      }

      if (!roles.length) {
        renderResultsEmpty("Немає ролей у цій гілці");
        renderRoleEmpty();
        setResetVisible(true);
        return;
      }

      renderResults(roles);
      renderRoleEmpty();
      setResetVisible(true);

      history.replaceState({}, "", `#path=${encodeURIComponent(path.join(" > "))}`);
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
        ...(r.content?.job_title_synonyms || []),
        ...(r.category_path || []),
        r.summary?.role_snapshot || "",
        ...(r.content?.core_role_in_product || []),
        ...(r.content?.typical_responsibilities || []),
        ...(r.content?.typical_stack_and_tools || []),
        ...(r.content?.product_context || []),
        ...(r.content?.recruiter_notes || []),
        ...(r.summary?.not_to_confuse || []).map(x => `${x.role} ${x.description}`)
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
  const rolesRaw = await fetch("./roles.json").then(r => r.json());
  ROLES = normalizeRoles(rolesRaw);

  if (!ROLES.length) {
    document.getElementById("tree").innerHTML =
      `<div class="empty">roles.json завантажився, але ролей немає.</div>`;
    renderResultsEmpty("Немає ролей");
    renderRoleEmpty();
    return;
  }

  indexRoles(ROLES);

  STRUCTURE = await fetch("./structure.json").then(r => r.json());
  const roots = flattenStructureRoots(STRUCTURE);

  for (const r of roots) attachRolesToStructure(r, []);

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
  document.getElementById("tree").innerHTML = `<div class="empty">${esc(msg)}</div>`;
  document.getElementById("results").innerHTML = `<div class="empty">${esc(msg)}</div>`;
  document.getElementById("role").innerHTML = `<div class="empty">${esc(msg)}</div>`;
});
