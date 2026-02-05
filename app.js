let ROLES = [];
let TREE = {};

// Мапа домен → CSS-клас
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
    childrenWrap.style.display = "none";
    node.appendChild(childrenWrap);

    row.addEventListener("click", () => {
      const open = childrenWrap.style.display !== "none";
      childrenWrap.style.display = open ? "none" : "block";
      row.querySelector(".badge").textContent = open ? "+" : "–";

      const pathPrefix = [...prefix, key];
      showResultsByPathPrefix(pathPrefix);
      history.replaceState({}, "", `#path=${encodeURIComponent(pathPrefix.join(" > "))}`);
    });

    renderTree(childrenWrap, treeObj[key].__children || {}, [...prefix, key]);
    container.appendChild(node);
  }
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
  if (list.length) renderRole(list[0]);
}

function renderResults(list) {
  const res = document.getElementById("results");
  res.innerHTML = "";

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

async function init() {
  const data = await fetch("./roles.json").then(r => r.json());
  ROLES = data.roles || [];

  // Будуємо дерево з primary_path
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

  const indexed = indexRoles(ROLES);
  const search = document.getElementById("search");

  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    if (!q) return renderResults(ROLES);
    const out = indexed.filter(x => x.hay.includes(q)).map(x => x.role);
    renderResults(out);
    if (out.length) renderRole(out[0]);
  });

  renderResults(ROLES);
  if (ROLES.length) renderRole(ROLES[0]);

  // Deep link: #role=<id>
  const hash = decodeURIComponent(location.hash || "");
  if (hash.startsWith("#role=")) {
    const id = hash.replace("#role=", "");
    const r = ROLES.find(x => x.id === id);
    if (r) renderRole(r);
  }
}

init().catch(err => {
  document.getElementById("role").textContent =
    "Помилка завантаження roles.json: " + err;
});
