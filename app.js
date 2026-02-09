/* app.js — stable loader + tree + full role card (GitHub Pages friendly) */

const $ = (sel) => document.querySelector(sel);

function safeText(x) {
  if (x === null || x === undefined) return "";
  if (typeof x === "string") return x;
  try { return JSON.stringify(x, null, 2); } catch { return String(x); }
}

// Works on GitHub Pages subpaths (e.g. /role-dictionary/)
function urlFor(file) {
  // new URL(file, location.href) resolves correctly relative to current page
  return new URL(file, window.location.href).toString();
}

async function fetchJson(file) {
  const url = urlFor(file);
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}. Body: ${text.slice(0, 120)}`);
  }

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`JSON parse error in ${file}: ${e.message}. First 120 chars: ${text.slice(0, 120)}`);
  }
}

function toTitleLabel(key) {
  // pretty labels from snake_case keys
  return String(key)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function renderValue(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    if (value.length === 0) return "";
    // array of strings or objects
    const items = value.map((it) => {
      if (typeof it === "string") return `<li>${escapeHtml(it)}</li>`;
      if (typeof it === "object") {
        // common pattern: { role, description }
        const role = it.role ? `<b>${escapeHtml(it.role)}</b>` : "";
        const desc = it.description ? ` — ${escapeHtml(it.description)}` : "";
        const rest = Object.keys(it).filter(k => k !== "role" && k !== "description")
          .map(k => `<div><b>${escapeHtml(toTitleLabel(k))}:</b> ${escapeHtml(safeText(it[k]))}</div>`)
          .join("");
        return `<li>${role}${desc}${rest ? `<div class="kv">${rest}</div>` : ""}</li>`;
      }
      return `<li>${escapeHtml(String(it))}</li>`;
    }).join("");
    return `<ul>${items}</ul>`;
  }

  if (typeof value === "object") {
    const rows = Object.entries(value)
      .map(([k, v]) => `<div class="kv-row"><div class="kv-k">${escapeHtml(toTitleLabel(k))}</div><div class="kv-v">${escapeHtml(safeText(v))}</div></div>`)
      .join("");
    return `<div class="kv">${rows}</div>`;
  }

  return `<p>${escapeHtml(String(value))}</p>`;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildRoleIndex(rolesArr) {
  const byTitle = new Map();
  for (const r of rolesArr) {
    if (!r || !r.title) continue;
    if (byTitle.has(r.title)) {
      // duplicates should not happen; keep the first and warn
      console.warn("Duplicate role title in roles.json:", r.title);
      continue;
    }
    byTitle.set(r.title, r);
  }
  return byTitle;
}

function normalizeRolesPayload(payload) {
  // supports both: [ ... ] and { roles: [ ... ] }
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.roles)) return payload.roles;
  return null;
}

function setStatus(msg, err = null) {
  const el = $("#results");
  if (!el) return;
  el.innerHTML = `<div class="status">
    <b>${escapeHtml(msg)}</b>
    ${err ? `<pre class="error">${escapeHtml(String(err.message || err))}</pre>` : ""}
  </div>`;
}

function renderRoleCard(role) {
  const el = $("#results");
  if (!el) return;

  const title = role.title || "(no title)";
  const category = Array.isArray(role.category_path) ? role.category_path.join(" → ") : "";

  // Render ALL fields (summary, content, tags, meta, etc.)
  const sections = [];

  // Header
  sections.push(`<h2 class="role-title">${escapeHtml(title)}</h2>`);
  if (category) sections.push(`<div class="role-path">${escapeHtml(category)}</div>`);

  // Summary block
  if (role.summary && typeof role.summary === "object") {
    const summaryParts = [];
    if (role.summary.role_snapshot) {
      summaryParts.push(`<div class="block"><h3>Role snapshot</h3>${renderValue(role.summary.role_snapshot)}</div>`);
    }
    if (role.summary.not_to_confuse) {
      summaryParts.push(`<div class="block"><h3>Не плутати з іншими ролями</h3>${renderValue(role.summary.not_to_confuse)}</div>`);
    }

    // any other summary keys
    const otherSummary = Object.entries(role.summary)
      .filter(([k]) => k !== "role_snapshot" && k !== "not_to_confuse")
      .map(([k, v]) => `<div class="block"><h3>${escapeHtml(toTitleLabel(k))}</h3>${renderValue(v)}</div>`)
      .join("");

    if (summaryParts.length || otherSummary) {
      sections.push(`<div class="card-section">${summaryParts.join("")}${otherSummary}</div>`);
    }
  }

  // Content block — render every key (including recruiter_notes)
  if (role.content && typeof role.content === "object") {
    const contentHtml = Object.entries(role.content)
      .map(([k, v]) => {
        const label =
          k === "recruiter_notes" ? "Нотатки для рекрутера" :
          k === "job_title_synonyms" ? "Синоніми назв вакансій" :
          toTitleLabel(k);
        return `<div class="block"><h3>${escapeHtml(label)}</h3>${renderValue(v)}</div>`;
      })
      .join("");
    sections.push(`<div class="card-section">${contentHtml}</div>`);
  }

  // Tags
  if (Array.isArray(role.tags) && role.tags.length) {
    sections.push(`<div class="block"><h3>Tags</h3><div class="tags">${role.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div></div>`);
  }

  // Meta (and any other top-level fields not yet rendered)
  const skipTop = new Set(["id", "title", "slug", "domain", "category_path", "summary", "content", "tags"]);
  const extraTop = Object.entries(role)
    .filter(([k]) => !skipTop.has(k))
    .map(([k, v]) => `<div class="block"><h3>${escapeHtml(toTitleLabel(k))}</h3>${renderValue(v)}</div>`)
    .join("");
  if (extraTop) sections.push(`<div class="card-section">${extraTop}</div>`);

  el.innerHTML = sections.join("");
}

function createTreeNode(node, roleIndex, state) {
  const li = document.createElement("li");

  if (node.type === "group") {
    const btn = document.createElement("button");
    btn.className = "tree-group";
    btn.type = "button";
    btn.textContent = node.title;

    const childrenWrap = document.createElement("ul");
    childrenWrap.className = "tree-children";

    const isOpen = state.openKeys.has(node.key);
    childrenWrap.style.display = isOpen ? "block" : "none";

    btn.addEventListener("click", () => {
      const nowOpen = !state.openKeys.has(node.key);
      if (nowOpen) state.openKeys.add(node.key);
      else state.openKeys.delete(node.key);
      childrenWrap.style.display = nowOpen ? "block" : "none";
    });

    li.appendChild(btn);

    if (Array.isArray(node.children)) {
      for (const ch of node.children) {
        childrenWrap.appendChild(createTreeNode(ch, roleIndex, state));
      }
    }
    li.appendChild(childrenWrap);
    return li;
  }

  if (node.type === "role") {
    const btn = document.createElement("button");
    btn.className = "tree-role";
    btn.type = "button";
    btn.textContent = node.title;

    btn.addEventListener("click", () => {
      const role = roleIndex.get(node.title);
      if (!role) {
        setStatus(`Немає картки для ролі: ${node.title}`);
        return;
      }
      state.selectedTitle = node.title;

      // highlight selected (simple)
      document.querySelectorAll(".tree-role.is-selected").forEach(el => el.classList.remove("is-selected"));
      btn.classList.add("is-selected");

      renderRoleCard(role);
    });

    li.appendChild(btn);
    return li;
  }

  // fallback
  li.textContent = node.title || "(unknown node)";
  return li;
}

function renderTree(structure, roleIndex) {
  const treeEl = $("#tree");
  if (!treeEl) return;

  treeEl.innerHTML = "";
  const state = {
    openKeys: new Set([
      "engineering_rd",                 // open main engineering
      "embedded_firmware_engineering",  // open embedded
      "hardware_engineering_electronics"
    ]),
    selectedTitle: null
  };

  const ul = document.createElement("ul");
  ul.className = "tree-root";
  ul.appendChild(createTreeNode(structure, roleIndex, state));
  treeEl.appendChild(ul);
}

function setupSearch(rolesArr, roleIndex) {
  const input = $("#search");
  const reset = $("#reset");
  if (!input) return;

  const listEl = $("#results");
  const renderSearchResults = (q) => {
    const query = q.trim().toLowerCase();
    if (!query) {
      setStatus("Оберіть роль у дереві ліворуч.");
      return;
    }

    const hits = rolesArr.filter((r) => {
      const hay = [
        r.title,
        ...(Array.isArray(r.tags) ? r.tags : []),
        ...(r.content?.job_title_synonyms || [])
      ].map(x => (x || "").toString().toLowerCase()).join(" | ");
      return hay.includes(query);
    }).slice(0, 50);

    if (!hits.length) {
      listEl.innerHTML = `<div class="status"><b>Нічого не знайдено</b><p>Запит: ${escapeHtml(q)}</p></div>`;
      return;
    }

    const html = hits.map(r => {
      const cat = Array.isArray(r.category_path) ? r.category_path.join(" → ") : "";
      return `<button class="search-hit" type="button" data-title="${escapeHtml(r.title)}">
        <div class="hit-title">${escapeHtml(r.title)}</div>
        <div class="hit-cat">${escapeHtml(cat)}</div>
      </button>`;
    }).join("");

    listEl.innerHTML = `<div class="search-results">${html}</div>`;

    listEl.querySelectorAll(".search-hit").forEach(btn => {
      btn.addEventListener("click", () => {
        const t = btn.getAttribute("data-title");
        const role = roleIndex.get(t);
        if (role) renderRoleCard(role);
      });
    });
  };

  input.addEventListener("input", () => renderSearchResults(input.value));
  if (reset) {
    reset.addEventListener("click", () => {
      input.value = "";
      setStatus("Оберіть роль у дереві ліворуч.");
    });
  }
}

async function main() {
  try {
    setStatus("Завантажую structure.json і roles.json…");
    const structure = await fetchJson("structure.json");
    const rolesPayload = await fetchJson("roles.json");
    const rolesArr = normalizeRolesPayload(rolesPayload);

    if (!rolesArr) {
      throw new Error("roles.json має бути масивом або { roles: [...] }");
    }

    const roleIndex = buildRoleIndex(rolesArr);

    renderTree(structure, roleIndex);
    setupSearch(rolesArr, roleIndex);

    setStatus("Оберіть роль у дереві ліворуч.");
  } catch (e) {
    console.error(e);
    setStatus("Помилка завантаження structure.json / roles.json", e);
  }
}

document.addEventListener("DOMContentLoaded", main);
