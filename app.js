/* =========================
   GLOBAL STATE
========================= */

let ROLES = [];
let ROLE_BY_ID = new Map();
let STRUCTURE = null;

const MIN_DEPTH_FOR_RESULTS = 2; // домен → піддомен

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

function normalize(s) {
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
  document.getElementById("results").innerHTML =
    `<div class="empty">${text}</div>`;
}

function renderRoleEmpty(
  text = 'Оберіть роль у “Результатах”, щоб побачити картку.'
) {
  document.getElementById("role").innerHTML =
    `<div class="empty">${text}</div>`;
}

function clearActive() {
  document
    .querySelectorAll("#tree .node")
    .forEach(n => n.classList.remove("active"));
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
   ROLE INDEX
========================= */

function indexRoles(roles) {
  ROLE_BY_ID = new Map();
  roles.forEach(r => {
    if (r.id) ROLE_BY_ID.set(r.id, r);
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

function attachRolesToStructure(node, path = []) {
  const currentPath = [...path, node.name];
  const children = Array.isArray(node.children) ? node.children : [];

  if (!children.length) {
    const roles = ROLES.filter(r =>
      normalize(r.title) === normalize(node.name)
    );

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
   RESULTS RENDER
========================= */

function showResultsForNodePath(path, roles) {
  if (path.length < MIN_DEPTH_FOR_RESULTS) {
    renderResultsEmpty("Розгорніть піддомен, щоб побачити ролі");
    renderRoleEmpty();
    return;
  }

  if (!roles.length) {
    renderResultsEmpty("Немає ролей у цій гілці");
    renderRoleEmpty();
    return;
  }

  renderResults(roles);
  renderRoleEmpty();
}

function renderResults(list) {
  const el = document.getElementById("results");
  el.innerHTML = "";

  list.forEach(role => {
    const card = document.createElement("div");
    card.className = "result-card";

    const pathText = (role.category_path || []).join(" → ");
    const synonyms =
      role.content?.job_title_synonyms?.slice(0, 6).join(" • ") || "";

    card.innerHTML = `
      <h3>${role.title}</h3>
      <div class="badges">
        <span class="badge domain domain-${slug(role.domain)}">
          ${role.domain || "—"}
        </span>
      </div>
      <div class="path">${pathText}</div>
      <div class="muted">${synonyms}</div>
    `;

    card.onclick = () => {
      renderRole(role);
      history.replaceState({}, "", `#role=${role.id}`);
      setResetVisible(true);
    };

    el.appendChild(card);
  });
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
        <span class="badge domain domain-${slug(role.domain)}">
          ${role.domain || "—"}
        </span>
      </div>

      <div class="kv">
        <strong>Шлях:</strong>
        ${(role.category_path || []).join(" → ")}
      </div>

      <div class="kv">
        <strong>Опис:</strong>
        ${role.summary?.role_snapshot || "—"}
      </div>

      <div class="kv">
        <strong>Синоніми:</strong>
        ${(role.content?.job_title_synonyms || []).join(", ") || "—"}
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

  nodes.forEach(nodeObj => {
    const node = document.createElement("div");
    node.className = "node";

    const row = document.createElement("div");
    row.className = "row";

    const hasChildren = nodeObj.children?.length;
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

    row.onclick = () => {
      const isOpen = childrenWrap.style.display !== "none";

      if (hasChildren) {
        childrenWrap.style.display = isOpen ? "none" : "block";
        row.querySelector(".toggle").textContent = isOpen ? "+" : "–";
      }

      const path = [...prefix, nodeObj.name];
      const roles = nodeObj.__meta?.roles || [];

      if (hasChildren && isOpen) {
        renderResultsEmpty();
        renderRoleEmpty();
        return;
      }

      showResultsForNodePath(path, roles);
      setResetVisible(true);
    };

    container.appendChild(node);
  });
}

/* =========================
   SEARCH
========================= */

function setupSearch() {
  const input = document.getElementById("search");
  const reset = document.getElementById("reset");

  input.oninput = () => {
    const q = normalize(input.value);
    if (!q) {
      renderResultsEmpty();
      renderRoleEmpty();
      return;
    }

    const list = ROLES.filter(r => {
      const text = [
        r.title,
        r.domain,
        ...(r.tags || []),
        ...(r.content?.job_title_synonyms || []),
        ...(r.category_path || [])
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(q);
    });

    renderResults(list);
    renderRoleEmpty();
    setResetVisible(true);
  };

  reset.onclick = () => {
    input.value = "";
    renderResultsEmpty();
    renderRoleEmpty();
    setAllTreeNodes(false);
    clearActive();
    history.replaceState({}, "", "#");
    setResetVisible(false);
  };
}

/* =========================
   INIT
========================= */

async function init() {
  // roles
  ROLES = await fetch("./roles.json").then(r => r.json());
  indexRoles(ROLES);

  // structure
  STRUCTURE = await fetch("./structure.json").then(r => r.json());
  const roots = flattenStructureRoots(STRUCTURE);
  roots.forEach(r => attachRolesToStructure(r));

  // render
  renderStructureTree(document.getElementById("tree"), roots);
  renderResultsEmpty();
  renderRoleEmpty();
  setupSearch();
  setResetVisible(false);
}

init().catch(err => {
  const msg = "Помилка завантаження: " + err;
  document.getElementById("tree").innerHTML = `<div class="empty">${msg}</div>`;
});
