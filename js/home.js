/* ============================================================
   freshcart — js/home.js   (index.html)
   - Featured products, read from data/products.json
   - "Deliver to my location" button (Geolocation API)
   ============================================================ */
FC.ready(async () => {
  // 7. Location / delivery — logic lives in store.js so every page can reuse it
  FC.bindLocateButton(
    document.getElementById('locate-btn'),
    document.getElementById('locate-result')
  );

  // Featured products
  const grid = document.getElementById('featured-grid');
  try {
    const data = await FC.loadCatalog();
    const featured = data.products.filter((p) => p.featured).slice(0, 4);
    grid.innerHTML = featured
      .map((p) => `<div class="col-6 col-lg-3">${FC.productCard(p)}</div>`)
      .join('');
    FC.bindProductActions(grid);
  } catch (err) {
    FC.showLoadError(grid, err);
  }
});
