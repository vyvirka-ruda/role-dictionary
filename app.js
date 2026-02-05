let ROLES = [];
let TREE = {};

const MIN_DEPTH_FOR_RESULTS = 3;

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

function renderResultsEmpty() {
  const el = document.getElementById("results");
  el.innerHTML = `<div class="empty">Оберіть гілку дерева</div>`;
}

function renderRoleEmpty() {
  const el = document.getElementById("role");
  el.innerHTML = `<div class="empty">Оберіть роль у “Результатах”, щоб побачити картку.</div>`;
}

function buildTreeFromRoles(roles) {
  const tree = {};
  for (const r of roles) {
    const path = r.primary_path || [r.domain, r.canonical_name];
    let cur = tree;
    for (const part of path) {
      cur[part] = cur[part] || { __children: {} };
      cur = cur[part].__children;
    }
  }
  return tree;
}

function showResultsByPathPrefix(pathPrefix) {
  const list = ROLES.filter(r => {
    const p = r.primary_path || [];
    if (p.length < pathPrefix.length) return false;
    for (let i = 0; i < pathPrefix.length; i++) {
      if (p[i] !== pathPrefix[i]) return false;
    }
    return true;
  });

  renderResults(list);
  renderRoleEmpty();
}

function renderResults(list) {
  const el = document.getElementById("results");
  el.innerHTML = "";

  if (!list.length) {
    el.innerHTML = `<div class="empty">Немає ролей у цій гілці.</div>`;
    return;
  }

  for (const role of list) {
    const card = document.createElement("div");
    card.className = "result-card";

    const domain = role.domain || "—";
    const section = (role.primary_path && role.primary_path[1]) ? role.primary_path[1] : "—";
    const pathText = (role.primary_path || []).join(" → ");
    const titles = (role.market_titles || []).slice(0, 6).join(" • ");

    card.innerHTML = `
      <h3>${role.canonical_name || "—"}</h3>
      <div class="badges">
        <span class="badge domain domain-${slug(domain)}">${domain}</span>
        <span class="badge section">${section}</span>
      </div>
      <div class="path">${pathText}</div>
      <div class="muted">${titles}</div>
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
      <div><b>Домен:</b> <span class="badge domain domain-${slug(domain)}">${domain}</span></div>
      <div><b>Шлях:</b> ${pathText || "—"}</div>
      <div><b>Опис:</b> ${role.description || "—"}</div>
      <div><b>Синоніми:</b> ${titles || "—"}</div>
      <div class="tags">${tags || "—"}</div>
    </div>
  `;
}

function setAllTreeNodes(open) {
  document.querySelectorAll("#tree .node").forEach(node => {
    const row = node.querySelector(":scope > .row");
    const badge = row?.querySelector(".badge");
    const children = node.querySelector(":scope > .children");
    if (!children || !badge) return;

    children.style.display = open ? "block" : "none";
    badge.textContent = open ? "–" : "+";
  });
}

function clearActive() {
  document.querySelectorAll("#tree .node").forEach(n => n.classList.remove("active"));
}

function highlightTreePath(path) {
  clearActive();

  let container = document.getElementById("tree");
  for (const part of path) {
    const nodes = Array.from(container.children);
    const node = nodes.find(n => n.querySelector(".row span:last-child")?.textContent === part);
    if (!node) return;

    node.classList.add("active");

    const children = node.querySelector(":scope > .children");
    if (children) {
      children.style.display = "block";
      const badge = node.querySelector(".badge");
      if (badge) badge.textContent = "–";
      container = children;
    }
  }
}

function openTreePath(path) {
  let container = document.getElementById("tree");
  for (const part of path) {
    const nodes = Array.from(container.children);
    const node = nodes.find(n => n.querySelector(".row span:last-child")?.textContent === part);
    if (!node) return;

    const children = node.querySelector(":scope > .children");
    const badge = node.querySelector(".badge");

    if (children && badge && children.style.display === "none") {
      children.style.display = "block";
      badge.textContent = "–";
    }
    if (children) container = children;
  }
}

function renderTree(container, treeObj, prefix = []) {
  container.innerHTML = "";

  for (const key of Object.keys(treeObj)) {
    const node = document.createElement("div");
    node.className = "node";

    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `<span class="badge">+</span><span>${key}</span>`;
    node.appendChild(row);

    const childrenWrap = document.createElement("div");
    childrenWrap.className = "children";
    childrenWrap.style.display = "none";
    node.appendChild(childrenWrap);

    row.addEventListener("click", () => {
      const isOpen = childrenWrap.style.display !== "none";

      // toggle
      childrenWrap.style.display = isOpen ? "none" : "block";
      row.querySelector(".badge").textContent = isOpen ? "+" : "–";

      const path = [...prefix, key];

      if (!isOpen) {
        // opened
        if (path.length >= MIN_DEPTH_FOR_RESULTS) {
          showResultsByPathPrefix(path);
          history.replaceState({}, "", `#path=${encodeURIComponent(path.join(" > "))}`);
          setResetVisible(true);
        } else {
          // opened too shallow: keep results empty
          renderResultsEmpty();
          renderRoleEmpty();

          const search = document.getElementById("search");
          setResetVisible(!!(search && search.value.trim()));
        }
      } else {
        // closed
        renderResultsEmpty();
        renderRoleEmpty();
        history.replaceState({}, "", "#");

        const search = document.getElementById("search");
        setResetVisible(!!(search && search.value.trim()));
      }
    });

    renderTree(childrenWrap, treeObj[key].__children || {}, [...prefix, key]);
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

async function init() {
  const res = await fetch("./roles.json");
  const data = await res.json();

  ROLES = data.roles || [];
  if (!ROLES.length) {
    document.getElementById("tree").innerHTML = `<div class="empty">roles.json завантажився, але ролей немає.</div>`;
    return;
  }

  TREE = buildTreeFromRoles(ROLES);
  renderTree(document.getElementById("tree"), TREE);

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
    const role = ROLES.find(r => r.id === id);
    if (role) {
      // open full path in tree
      openTreePath(role.primary_path || []);
      highlightTreePath(role.primary_path || []);

      // show results by MIN_DEPTH prefix (context)
      const prefix = (role.primary_path || []).slice(0, MIN_DEPTH_FOR_RESULTS);
      if (prefix.length >= MIN_DEPTH_FOR_RESULTS) {
        showResultsByPathPrefix(prefix);
      } else {
        renderResultsEmpty();
      }

      // open role card
      renderRole(role);
      setResetVisible(true);
    }
  }
}

init().catch(err => {
  const msg = "Помилка завантаження roles.json: " + err;
  document.getElementById("tree").innerHTML = msg;
  document.getElementById("results").innerHTML = msg;
  document.getElementById("role").innerHTML = msg;
});
