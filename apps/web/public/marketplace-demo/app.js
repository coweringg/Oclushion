async function load() {
  const res = await fetch("../../../../docker/data/marketplace/v1/catalog.json");
  const catalog = await res.json();
  const skills = catalog.skills;
  const categories = [...new Set(skills.map(s => s.category))].sort();

  document.getElementById("skill-count").textContent = skills.length;
  document.getElementById("total-count").textContent = skills.length;

  const catSelect = document.getElementById("category-filter");
  for (const cat of categories) {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
    catSelect.appendChild(opt);
  }

  function render() {
    const query = document.getElementById("search").value.toLowerCase();
    const cat = document.getElementById("category-filter").value;
    const tier = document.getElementById("tier-filter").value;

    const filtered = skills.filter(s => {
      if (query && !s.name.toLowerCase().includes(query) && !s.description.toLowerCase().includes(query)) return false;
      if (cat && s.category !== cat) return false;
      if (tier && s.tier !== tier) return false;
      return true;
    });

    const grid = document.getElementById("grid");
    if (filtered.length === 0) {
      grid.innerHTML = '<div class="empty">No skills match your filters</div>';
      return;
    }

    grid.innerHTML = filtered.map(s => `
      <div class="card" title="${s.description}">
        <div class="header">
          <h3>${s.name}</h3>
          <span class="badge badge-${s.tier}">${s.tier}</span>
        </div>
        <div class="category">${s.category}</div>
        <p>${s.description}</p>
        <div class="footer">
          <span class="meta">v${s.version} &middot; ${s.sizeKb}KB</span>
          <span class="hash" title="SHA-256: ${s.sha256}">${s.sha256.slice(0, 12)}...</span>
        </div>
      </div>
    `).join("");
  }

  document.getElementById("search").addEventListener("input", render);
  document.getElementById("category-filter").addEventListener("change", render);
  document.getElementById("tier-filter").addEventListener("change", render);
  render();
}

load();
