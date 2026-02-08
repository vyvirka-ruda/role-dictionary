let ROLES = [];
let ROLE_BY_ID = new Map();
let ROLE_BY_CANON = new Map(); // key: canonical_name lowercase
let STRUCTURE = null;

const MIN_DEPTH_FOR_RESULTS = 2; // показуємо результати з рівня "домен -> піддомен"

function slug(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function setResetVisible(visible) {
  const btn = document.getElementById("reset");
  if (!btn) return;
  btn.classList.toggle("show", !!visible);
}

function renderResultsEmpty(text = "Оберіть гілку дерева") {
  const el = document.getElementById("results");
  el.innerHTML = `<div class="empty">${text}</div>`;
}

function renderRoleEmpty(text = 'Оберіть роль у “Результатах”, щоб побачити картку.') {
  const el = document.getElementById("role");
  el.innerHTML = `<div class="empty">${text}</div>`;
}

function clearActive() {
  document.querySelectorAll("#tree .node").forEach(n => n.classList.remove("active"));
}

function setAllTreeNodes(open) {
  document.querySelectorAll("#tree .node").forEach(node => {
    const row = node.querySelector(":scope > .row");
    const badge = row?.querySelector(".toggle");
    const children = node.querySelector(":scope > .children");
    if (!children || !badge) return;

    children.style.display = open ? "block" : "none";
    badge.textContent = open ? "–" : "+";
  });
}

function highlightTreePath(path) {
  clearActive();

  let container = document.getElementById("tree");
  for (const part of path) {
    const nodes = Array.from(container.children);
    const node = nodes.find(n => n.querySelector(":scope > .row .label")?.textContent === part);
    if (!node) return;

    node.classList.add("active");

    const children = node.querySelector(":scope > .children");
    const toggle = node.querySelector(":scope > .row .toggle");
    if (children && toggle) {
      children.style.display = "block";
      toggle.textContent = "–";
      container = children;
    }
  }
}

function openTreePath(path) {
  let container = document.getElementById("tree");
  for (const part of path) {
    const nodes = Array.from(container.children);
    const node = nodes.find(n => n.querySelector(":scope > .row .label")?.textContent === part);
    if (!node) return;

    const children = node.querySelector(":scope > .children");
    const toggle = node.querySelector(":scope > .row .toggle");

    if (children && toggle && children.style.display === "none") {
      children.style.display = "block";
      toggle.textContent = "–";
    }
    if (children) container = children;
  }
}

/**
 * ===== structure helpers =====
 * Ми рендеримо дерево НЕ з roles.primary_path, а з structure.json.
 * Паралельно будуємо для кожного вузла список ролей у його піддереві:
 * nodeMeta.roles = Role[]
 */
function normalizeCanon(s) {
  return String(s || "").trim().toLowerCase();
}

function indexRoles(roles) {
  ROLE_BY_ID = new Map();
  ROLE_BY_CANON = new Map();

  for (const r of roles) {
    if (r?.id) ROLE_BY_ID.set(r.id, r);
    if (r?.canonical_name) ROLE_BY_CANON.set(normalizeCanon(r.canonical_name), r);
  }
}

// структура у файлі: { engineering: {name, children: [...]}, non_engineering: {name, children:[...]} }
function flattenStructureRoots(structure) {
  const roots = [];
  if (structure?.engineering?.name) roots.push(structure.engineering);
  if (structure?.non_engineering?.name) roots.push(structure.non_engineering);
  return roots;
}

function attachRolesToStructure(node, path = []) {
  // повертає масив ролей у піддереві цього вузла
  const currentPath = [...path, node.name];
  const children = Array.isArray(node.children) ? node.children : [];

  // leaf
  if (!children.length) {
    // пробуємо знайти роль по canonical_name (назва leaf == canonical_name)
    const role = ROLE_BY_CANON.get(normalizeCanon(node.name));
    node.__meta = {
      path: currentPath,
      roles: role ? [role] : [],
      isLeaf: true
    };
    return node.__meta.roles;
  }

  // non-leaf
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

function findStructurePathByRole(role) {
  if (!STRUCTURE) return null;

  const targetCanon = normalizeCanon(role?.canonical_name);
  if (!targetCanon) return null;

  const roots = flattenStructureRoots(STRUCTURE);

  function dfs(n) {
    if (!n) return null;

    if (!n.children || !n.children.length) {
      if (normalizeCanon(n.name) === targetCanon) return n.__meta?.path || null;
      return null;
    }

    for (const ch of n.children) {
      const res = dfs(ch);
      if (res) return res;
    }
    return null;
  }

  for (const r of roots) {
    const res = dfs(r);
    if (res) return res;
  }
  return null;
}

function showResultsForNodePath(path, roles, domainName) {
  // фільтр: щоб на рівні домену не показувати "месиво"
  if ((path || []).length < MIN_DEPTH_FOR_RESULTS) {
    renderResultsEmpty("Розгорніть піддомен, щоб побачити ролі");
    renderRoleEmpty();
    return;
  }

  // якщо ролей реально немає в цій гілці
  if (!roles || !roles.length) {
    renderResultsEmpty("Немає ролей у цій гілці");
    renderRoleEmpty();
    return;
  }

  renderResults(roles, domainName);
  renderRoleEmpty();
}

function renderResults(list, domainNameOverride = null) {
  const el = document.getElementById("results");
  el.innerHTML = "";

  if (!list.length) {
    el.innerHTML = `<div class="empty">Немає ролей у цій гілці.</div>`;
    return;
  }

  for (const role of list) {
    const card = document.createElement("div");
    card.className = "result-card";

    // домен беремо з role.domain, але якщо в structure домен інший/правильний — можна форснути
    const domain = domainNameOverride || role.domain || "—";

    // секція — 2-й елемент primary_path (якщо є), але у нас master-структура вказує інакше.
    // Тому: показуємо перший “піддомен” з primary_path або з role.primary_path[1], якщо є.
    const section =
      (role.primary_path && role.primary_path[1]) ? role.primary_path[1] : "—";

    const pathText = (role.primary_path || []).join(" → ");
    const titles = (role.market_titles || []).slice(0, 8).join(" • ");

    card.innerHTML = `
      <h3>${role.canonical_name || "—"}</h3>
      <div class="badges">
        <span class="badge domain domain-${slug(domain)}">${domain}</span>
        <span class="badge section">${section}</span>
      </div>
      <div class="path">${pathText || "—"}</div>
      <div class="muted">${titles || ""}</div>
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

  const domain = role.domain || "—";
  const pathText = (role.primary_path || []).join(" → ");
  const titles = (role.market_titles || []).join(", ");
  const tags = (role.tags || []).map(t => `<span class="tag">${t}</span>`).join("");

  el.innerHTML = `
    <div class="role-card">
      <h2>${role.canonical_name || "—"}</h2>
      <div class="kv"><strong>Домен:</strong> <span class="badge domain domain-${slug(domain)}">${domain}</span></div>
      <div class="kv"><strong>Шлях:</strong> ${pathText || "—"}</div>
      <div class="kv"><strong>Опис:</strong> ${role.description || "—"}</div>
      <div class="kv"><strong>Синоніми:</strong> ${titles || "—"}</div>
      <div class="kv"><strong>Теги:</strong> <span class="tags">${tags || "—"}</span></div>
    </div>
  `;
}

function getTopDomainFromPath(path) {
  return (path && path.length) ? path[0] : null;
}

/**
 * ===== render tree from structure.json =====
 */
function renderStructureTree(container, nodes, prefix = []) {
  container.innerHTML = "";

  for (const nodeObj of nodes) {
    const key = nodeObj.name;
    const node = document.createElement("div");
    node.className = "node";

    const row = document.createElement("div");
    row.className = "row";

    const hasChildren = Array.isArray(nodeObj.children) && nodeObj.children.length > 0;
    row.innerHTML = `
      <span class="toggle">${hasChildren ? "+" : "•"}</span>
      <span class="label">${key}</span>
    `;
    node.appendChild(row);

    const childrenWrap = document.createElement("div");
    childrenWrap.className = "children";
    childrenWrap.style.display = "none";
    node.appendChild(childrenWrap);

    if (hasChildren) {
      renderStructureTree(childrenWrap, nodeObj.children, [...prefix, key]);
    }

    row.addEventListener("click", () => {
      const isOpen = childrenWrap.style.display !== "none";

      // toggle
      if (hasChildren) {
        childrenWrap.style.display = isOpen ? "none" : "block";
        row.querySelector(".toggle").textContent = isOpen ? "+" : "–";
      }

      const path = [...prefix, key];

      // Якщо вузол закрили — очищаємо результати/роль
      if (hasChildren && isOpen) {
        renderResultsEmpty("Оберіть гілку дерева");
        renderRoleEmpty();
        history.replaceState({}, "", "#");

        const search = document.getElementById("search");
        setResetVisible(!!(search && search.value.trim()));
        return;
      }

      // Якщо відкрили (або leaf) — показуємо ролі для цього вузла (по structure meta)
      const roles = nodeObj.__meta?.roles || [];
      const topDomain = getTopDomainFromPath(path);

      // Показувати результати лише починаючи з піддомену
      showResultsForNodePath(path, roles, topDomain);

      // hash path (для дебагу/шару)
      history.replaceState({}, "", `#path=${encodeURIComponent(path.join(" > "))}`);
      setResetVisible(true);
    });

    container.appendChild(node);
  }
}

function setupSearch() {
  const input = document.getElementById("search");
  const resetBtn = document.getElementById("reset");

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();

    if (!q) {
      renderResultsEmpty();
      renderRoleEmpty();
      setResetVisible(location.hash.startsWith("#role="));
      return;
    }

    const list = ROLES.filter(r => {
      const name = (r.canonical_name || "").toLowerCase();
      const domain = (r.domain || "").toLowerCase();
      const titles = (r.market_titles || []).join(" ").toLowerCase();
      const tags = (r.tags || []).join(" ").toLowerCase();
      const path = (r.primary_path || []).join(" ").toLowerCase();
      return (name + " " + domain + " " + titles + " " + tags + " " + path).includes(q);
    });

    renderResults(list, null);
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

async function init() {
  // 1) load roles
  const rolesRes = await fetch("./roles.json");
  const rolesData = await rolesRes.json();
  ROLES = rolesData.roles || [];
  if (!ROLES.length) {
    document.getElementById("tree").innerHTML = `<div class="empty">roles.json завантажився, але ролей немає.</div>`;
    renderResultsEmpty("Немає ролей");
    renderRoleEmpty();
    return;
  }
  indexRoles(ROLES);

  // 2) load structure
  const structureRes = await fetch("./structure.json");
  STRUCTURE = await structureRes.json();

  // 3) attach role lists to structure nodes
  const roots = flattenStructureRoots(STRUCTURE);
  for (const r of roots) attachRolesToStructure(r, []);

  // 4) render tree
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

  // Deep link #role=
  const hash = decodeURIComponent(location.hash || "");
  if (hash.startsWith("#role=")) {
    const id = hash.replace("#role=", "");
    const role = ROLE_BY_ID.get(id);
    if (role) {
      // знайти шлях у structure
      const structPath = findStructurePathByRole(role);

      if (structPath && structPath.length) {
        openTreePath(structPath);
        highlightTreePath(structPath);

        // показати контекст — результати на рівні піддомену (domain + section)
        const prefix = structPath.slice(0, Math.max(MIN_DEPTH_FOR_RESULTS, 2));
        // знайдемо вузол prefix у структурі, щоб взяти його roles
        // (просто відкриємо повний шлях і покажемо ролі з вузла structPath[MIN_DEPTH-1] якщо можливо)
        renderResults(ROLES.filter(r => normalizeCanon(r.canonical_name) === normalizeCanon(role.canonical_name)), structPath[0]);
      } else {
        // fallback: просто роль
        renderResults([role], role.domain || null);
      }

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
