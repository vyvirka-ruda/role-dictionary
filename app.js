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
      node[segment] = node[segment] ||
