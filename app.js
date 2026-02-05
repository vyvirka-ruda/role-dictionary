let ROLES = [];
let TREE = {};

// Domain -> CSS class
const DOMAIN_CLASS = {
  "Software Engineering": "software",
  "Embedded Engineering": "embedded",
  "Autonomy / Robotics / AI": "autonomy",
  "Hardware & Electronics": "hardware",
  "Mechanical / Physical Design": "mechanical",
  "Systems & Integration": "systems",
  "Engineering QA": "qa",
  "People & Talent": "people",
  "Manufacturing / Production Engineering": "manufacturing"
};

function setResetVisible(visible) {
  const btn = document.getElementById("reset");
  if (!btn) return;
  btn.classList.toggle("show", !!visible);
}

function renderResultsEmpty() {
  const res = document.getElementById("results");
  res.innerHTML = `<div class="empty">Оберіть гілку в дереві, щоб побачити ролі.</div>`;
}

function renderRoleEmpty() {
  const box = document.getElementById("role");
  box.innerHTML = `<div class="empty">Оберіть роль у “Результатах”, щоб побачити картку.</div>`;
}

function renderTree(container, treeObj, prefix = []) {
  const MIN_DEPTH_FOR_RESULTS = 3; // 1 = домен, 2 = піддомен, 3 = ще глибше (Backend/Frontend/etc)

  container.innerHTML = "";
  for (const key of Object.keys(treeObj)) {
    const node = document.createElement("div");
    node.className = "node";

    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `<span class="badge">+</span><span>${key}</span>`;
    node.appendChild(row);

    const childrenWrap = document.createElement("div");
    childrenWrap.style.display = "none";
    node.appendChild(childrenWrap);

    row.addEventListener("click", () => {
      const isOpen = childrenWrap.style.display !== "none";

      // toggle UI
      childrenWrap.style.display = isOpen ? "none" : "block";
      row.querySelector(".badge").textContent = isOpen ? "+" : "–";

      const pathPrefix = [...prefix, key];

      if (!isOpen) {
        // ВІДКРИЛИ гілку
        if (pathPrefix.length >= MIN_DEPTH_FOR_RESULTS) {
          // показуємо результати тільки з достатньої глибини
          showResultsByPathPrefix(pathPrefix);
          history.replaceState({}, "", `#path=${encodeURIComponent(pathPrefix.join(" > "))}`);
          setResetVisible(true);
        } else {
          // занадто високий рівень -> тримаємо Results/Role порожніми
          renderResultsEmpty();
          renderRoleEmpty();
          history.replaceState({}, "", "#");
          // reset показуємо тільки якщо є пошук
          const search = document.getElementById("search");
          setResetVisible(!!(search && search.value.trim()));
        }
      } else {
        // ЗАКРИЛИ гілку -> сховати результати і картку
        renderResultsEmpty();
        renderRoleEmpty();
        history.replaceState({}, "", "#");

        const search = document.getElementById("search");
        const hasSearch = !!(search && search.value.trim());
        setResetVisible(hasSearch);
      }
    });

    renderTree(childrenWrap, treeObj[key].__children || {}, [...prefix, key]);
    container.appendChild(node);
  }
}

  // toggle UI
  childrenWrap.style.display = isOpen ? "none" : "block";
  row.querySelector(".badge").textContent = isOpen ? "+" : "–";

  const pathPrefix = [...prefix, key];

  if (!isOpen) {
    // ВІДКРИЛИ гілку -> показати результати по цій гілці
    showResultsByPathPrefix(pathPrefix);
    history.replaceState({}, "", `#path=${encodeURIComponent(pathPrefix.join(" > "))}`);
    setResetVisible(true);
  } else {
    // ЗАКРИЛИ гілку -> сховати результати і картку
    renderResultsEmpty();
    renderRoleEmpty();
    history.replaceState({}, "", "#");

    // Якщо немає пошуку — ховаємо reset
    const search = document.getElementById("search");
    const hasSearch = !!(search && search.value.trim());
    setResetVisible(hasSearch);
  }
});

    renderTree(childrenWrap, treeObj[key].__children || {}, [...prefix, key]);
    container.appendChild(node);
  }
}

function renderResults(list) {
  const res = document.getElementById("results");
  res.innerHTML = "";

  if (!list.length) {
    res.innerHTML = `<div class="empty">Нічого не знайдено.</div>`;
    return;
  }

  for (const r of list) {
    const div = document.createElement("div");
    div.className = "item";

    div.innerHTML = `
      <div>
        <strong>${r.canonical_name}</strong>
        <span class="badge domain ${DOMAIN_CLASS[r.domain] || ""}">
          ${r.domain}
        </span>
      </div>
      <div class="small">${(r.primary_path || []).join(" → ")}</div>
      <div class="small">${(r.market_titles || []).slice(0, 4).join(" • ")}</div>
    `;

    div.addEventListener("click", () => {
      renderRole(r);
      highlightTreePath(r.primary_path || []);
      setResetVisible(true);
      history.replaceState({}, "", `#role=${encodeURIComponent(r.id)}`);
    });

    res.appendChild(div);
  }
}

function renderRole(r) {
  const box = document.getElementById("role");
  box.innerHTML = `
    <div class="kv"><strong>Роль:</strong> ${r.canonical_name}</div>
    <div class="kv"><strong>Домен:</strong> ${r.domain || "—"}</div>
    <div class="kv"><strong>Шлях:</strong> ${(r.primary_path || []).join(" → ") || "—"}</div>
    <div class="kv"><strong>Опис:</strong> ${r.description || "—"}</div>
    <div class="kv"><strong>Синоніми:</strong> ${(r.market_titles || []).join(", ") || "—"}</div>
    <div class="kv"><strong>Теги:</strong>
      <div class="tags">
        ${(r.tags || []).map(t => `<span class="badge">${t}</span>`).join("") || "—"}
      </div>
    </div>
  `;
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

function indexRoles(roles) {
  return roles.map(r => {
    const hay = [
      r.canonical_name,
      r.domain,
      ...(r.market_titles || []),
      ...(r.tags || []),
      ...(r.primary_path || [])
    ].join(" ").toLowerCase();
    return { role: r, hay };
  });
}

function setAllTreeNodes(open) {
  document.querySelectorAll("#tree .node").forEach(node => {
    const row = node.querySelector(":scope > .row");
    const badge = row?.querySelector(".badge");
    const children = node.querySelector(":scope > div:nth-child(2)");
    if (!children || !badge) return;

    children.style.display = open ? "block" : "none";
    badge.textContent = open ? "–" : "+";
  });
}

function highlightTreePath(path) {
  document.querySelectorAll("#tree .node").forEach(n => n.classList.remove("active"));

  let container = document.getElementById("tree");

  path.forEach(part => {
    const nodes = Array.from(container.children);
    const node = nodes.find(n => n.querySelector(".row span:last-child")?.textContent === part);
    if (!node) return;

    node.classList.add("active");

    const children = node.querySelector(":scope > div:nth-child(2)");
    if (children) {
      children.style.display = "block";
      const badge = node.querySelector(".badge");
      if (badge) badge.textContent = "–";
      container = children;
    }
  });
}

function showResultsForRoleContext(role) {
  const p = role.primary_path || [];

  // Prefer a "section context": first 2 levels of the tree
  // Example: ["Engineering / R&D", "Software Engineering", ...]
  if (p.length >= 2) {
    const prefix = [p[0], p[1]];
    const list = ROLES.filter(r => {
      const rp = r.primary_path || [];
      if (rp.length < 2) return false;
      return rp[0] === prefix[0] && rp[1] === prefix[1];
    });

    // Fallback if something went odd
    if (list.length) {
      renderResults(list);
      return;
    }
  }

  // Fallback: same domain
  const domainList = ROLES.filter(r => r.domain === role.domain);
  renderResults(domainList);
}

async function init() {
  const data = await fetch("./roles.json").then(r => r.json());
  ROLES = data.roles || [];

  // Build tree from primary_path
  TREE = {};
  for (const r of ROLES) {
    const path = r.primary_path || [r.domain, r.canonical_name];
    let cur = TREE;
    for (const part of path) {
      cur[part] = cur[part] || { __children: {} };
      cur = cur[part].__children;
    }
  }

  renderTree(document.getElementById("tree"), TREE);

  document.getElementById("expandAll")?.addEventListener("click", () => {
    setAllTreeNodes(true);
    setResetVisible(true);
  });

  document.getElementById("collapseAll")?.addEventListener("click", () => {
    setAllTreeNodes(false);
    setResetVisible(true);
  });

  const indexed = indexRoles(ROLES);
  const search = document.getElementById("search");

  // стартові порожні стани
  renderResultsEmpty();
  renderRoleEmpty();
  setResetVisible(false);

  // Reset button
  document.getElementById("reset")?.addEventListener("click", () => {
    // clear search
    search.value = "";

    // empty states
    renderResultsEmpty();
    renderRoleEmpty();

    // collapse tree
    setAllTreeNodes(false);

    // clear selection highlight
    document.querySelectorAll("#tree .node").forEach(n => n.classList.remove("active"));

    // clear hash
    history.replaceState({}, "", "#");

    // hide reset
    setResetVisible(false);
  });

  // Search input
  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();

    if (!q) {
      renderResultsEmpty();
      renderRoleEmpty();
      setResetVisible(false);
      return;
    }

    setResetVisible(true);

    const out = indexed.filter(x => x.hay.includes(q)).map(x => x.role);
    renderResults(out);
    renderRoleEmpty();
  });

  // Deep link: #role=<id>
  const hash = decodeURIComponent(location.hash || "");
  if (hash.startsWith("#role=")) {
    const id = hash.replace("#role=", "");
    const role = ROLES.find(x => x.id === id);
    if (role) {
      showResultsForRoleContext(role);
      renderRole(role);
      highlightTreePath(role.primary_path || []);
      setResetVisible(true);
    }
  }
}

init().catch(err => {
  document.getElementById("role").textContent =
    "Помилка завантаження roles.json: " + err;
});
