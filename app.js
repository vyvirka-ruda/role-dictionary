let ROLES = [];
let TREE = {};

const MIN_DEPTH_FOR_RESULTS = 3;

// ---------- INIT ----------
async function init() {
  const res = await fetch("roles.json");
  const data = await res.json();
  ROLES = data.roles || [];

  if (!ROLES.length) {
    document.getElementById("tree").innerHTML =
      `<div class="empty">roles.json завантажився, але ролей немає</div>`;
    return;
  }

  TREE = buildTreeFromRoles(ROLES);
  renderTree(document.getElementById("tree"), TREE);

  handleHash();
  setupSearch();
  updateResetVisibility();
}

init().catch(err => {
  document.getElementById("tree").innerHTML =
    "Помилка завантаження roles.json: " + err;
  document.getElementById("results").innerHTML =
    "Помилка завантаження roles.json: " + err;
  document.getElementById("role").innerHTML =
    "Помилка завантаження roles.json: " + err;
});

// ---------- TREE ----------
function buildTreeFromRoles(roles) {
  const tree = {};
  roles.forEach(role => {
    let node = tree;
    role.primary_path.forEach((segment, i) => {
      node[segment] = node[segment] || { __children: {} };
      if (i === role.primary_path.length - 1) {
        node[segment].__roles = node[segment].__roles || [];
        node[segment].__roles.push(role);
      }
      node = node[segment].__children;
    });
  });
  return tree;
}

function renderTree(container, treeObj, prefix = []) {
  container.innerHTML = "";

  Object.keys(treeObj).forEach(key => {
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
      childrenWrap.style.display = isOpen ? "none" : "block";
      row.querySelector(".badge").textContent = isOpen ? "+" : "–";

      const path = [...prefix, key];

      if (!isOpen) {
        if (path.length >= MIN_DEPTH_FOR_RESULTS) {
          showResultsByPath(path);
          history.replaceState({}, "", `#path=${encodeURIComponent(path.join(" > "))}`);
        } else {
          clearResultsAndRole();
          history.replaceState({}, "", "#");
        }
      } else {
        clearResultsAndRole();
        history.replaceState({}, "", "#");
      }

      updateResetVisibility();
    });

    renderTree(childrenWrap, treeObj[key].__children || {}, [...prefix, key]);
    container.appendChild(node);
  });
}

// ---------- RESULTS ----------
function showResultsByPath(path) {
  const results = ROLES.filter(r =>
    r.primary_path.slice(0, path.length).join(" > ") === path.join(" > ")
  );

  renderResults(results);
}

function renderResults(roles) {
  const el = document.getElementById("results");
  el.innerHTML = "";

  if (!roles.length) {
    el.innerHTML = `<div class="empty">Немає ролей</div>`;
    return;
  }

  roles.forEach(role => {
    const card = document.createElement("div");
    card.className = "result-card";
   card.innerHTML = `
  <h3>${role.canonical_name}</h3>
  <div class="badges">
    <span class="badge domain domain-${slug(role.domain)}">${role.domain}</span>
    <span class="badge section">${role.primary_path?.[1] || "—"}</span>
  </div>
  <div class="path">${role.primary_path.join(" → ")}</div>
  <div class="muted">${role.market_titles.join(" • ")}</div>
`;

    card.addEventListener("click", () => {
      renderRole(role);
      history.replaceState({}, "", `#role=${role.id}`);
      updateResetVisibility();
    });

    el.appendChild(card);
  });
}

// ---------- ROLE ----------
function renderRole(role) {
  const el = document.getElementById("role");
  el.innerHTML = `
    <div class="role-card">
      <h2>${role.canonical_name}</h2>
      <div><b>Домен:</b> ${role.domain}</div>
      <div><b>Шлях:</b> ${role.primary_path.join(" → ")}</div>
      <div><b>Опис:</b> ${role.description || "—"}</div>
      <div><b>Синоніми:</b> ${role.market_titles.join(", ")}</div>
      <div class="tags">
        ${role.tags.map(t => `<span class="tag">${t}</span>`).join("")}
      </div>
    </div>
  `;
}

// ---------- EMPTY STATES ----------
function clearResultsAndRole() {
  document.getElementById("results").innerHTML =
    `<div class="empty">Оберіть гілку дерева</div>`;
  document.getElementById("role").innerHTML =
    `<div class="empty">Оберіть роль у “Результатах”</div>`;
}

// ---------- SEARCH ----------
function setupSearch() {
  const input = document.getElementById("search");
  input.addEventListener("input", e => {
    const q = e.target.value.toLowerCase().trim();

    if (!q) {
      clearResultsAndRole();
      updateResetVisibility();
      return;
    }

    const results = ROLES.filter(r =>
      r.canonical_name.toLowerCase().includes(q) ||
      r.market_titles.some(t => t.toLowerCase().includes(q)) ||
      r.tags.some(t => t.toLowerCase().includes(q))
    );

    renderResults(results);
    updateResetVisibility();
  });
}

// ---------- HASH ----------
function handleHash() {
  const hash = decodeURIComponent(location.hash);

  if (hash.startsWith("#role=")) {
    const id = hash.replace("#role=", "");
    const role = ROLES.find(r => r.id === id);
    if (role) {
      openTreePath(role.primary_path);
      showResultsByPath(role.primary_path.slice(0, MIN_DEPTH_FOR_RESULTS));
      renderRole(role);
    }
  }
}

function openTreePath(path) {
  let current = document.getElementById("tree");
  path.forEach(seg => {
    const row = [...current.querySelectorAll(".row")]
      .find(r => r.textContent.includes(seg));
    if (row) {
      const badge = row.querySelector(".badge");
      if (badge.textContent === "+") row.click();
      current = row.nextElementSibling;
    }
  });
}

// ---------- RESET ----------
function updateResetVisibility() {
  const btn = document.getElementById("reset");
  const hasSearch = document.getElementById("search").value.trim();
  const hasRole = location.hash.startsWith("#role=");
  btn.style.display = hasSearch || hasRole ? "inline-block" : "none";
}

document.getElementById("reset").addEventListener("click", () => {
  document.getElementById("search").value = "";
  clearResultsAndRole();
  history.replaceState({}, "", "#");
  updateResetVisibility();
});
