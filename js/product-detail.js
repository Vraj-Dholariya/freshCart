/* ============================================================
   freshcart — js/product-detail.js   (product.html?id=p01)
   4. Product details — one product from data/products.json,
      including its nested "nutrition" JSON object.
   ============================================================ */
FC.ready(async () => {
  const host = document.getElementById('product-detail');
  const id = new URLSearchParams(location.search).get('id');

  try {
    await FC.loadCatalog();
  } catch (err) {
    FC.showLoadError(host, err);
    return;
  }

  const p = FC.getProduct(id);
  if (!p) {
    host.innerHTML = `
      <div class="empty-state">
        <span class="big" aria-hidden="true">🔎</span>
        <p class="mb-2"><strong>We couldn't find that product.</strong></p>
        <a href="products.html" class="btn btn-fc">Browse all products</a>
      </div>`;
    return;
  }

  document.title = `${p.name} — freshcart`;

  const cat = FC.categoryName(p.category);
  const soldOut = p.stock === 0;
  const stockNote = soldOut
    ? '<p class="stock-note stock-out">Sold out for now</p>'
    : p.stock <= 10
      ? `<p class="stock-note stock-low">Only ${p.stock} left</p>`
      : '<p class="stock-note stock-ok">In stock</p>';

  const nutrition = p.nutrition || null;      // products added later (admin) may have no nutrition data
  const nutritionRows = !nutrition ? '' : [
    ['Calories', nutrition.calories, 'kcal'],
    ['Protein', nutrition.protein, 'g'],
    ['Carbohydrates', nutrition.carbs, 'g'],
    ['Fat', nutrition.fat, 'g'],
    ['Fibre', nutrition.fiber, 'g']
  ].map(([label, value, unit]) => `<tr><th scope="row">${label}</th><td>${value} ${unit}</td></tr>`).join('');

  host.innerHTML = `
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb">
        <li class="breadcrumb-item"><a href="index.html">Home</a></li>
        <li class="breadcrumb-item"><a href="products.html">Products</a></li>
        <li class="breadcrumb-item"><a href="products.html?category=${p.category}">${FC.esc(cat)}</a></li>
        <li class="breadcrumb-item active" aria-current="page">${FC.esc(p.name)}</li>
      </ol>
    </nav>

    <div class="row g-4 g-lg-5 align-items-start">
      <div class="col-md-5">
        <div class="detail-tile thumb-${p.category}">
          ${FC.imageTag(p, { cls: 'detail-img', alt: p.name, fallbackClass: 'detail-emoji' })}
          ${p.organic ? '<span class="badge-organic">Organic</span>' : ''}
        </div>
        <p class="small text-secondary mt-2 mb-0">${p.image && p.image.includes('wikimedia.org') ? 'Photo: Wikipedia / Wikimedia Commons (' + FC.esc((p.wiki || [])[0] || p.name) + ' article)' : 'Photo is for illustration.'}</p>
      </div>

      <div class="col-md-7">
        <p class="product-cat">${FC.esc(cat)}</p>
        <h1 class="detail-title">${FC.esc(p.name)}</h1>
        <p class="product-meta mb-0">${FC.stars(p.rating)} · grown by ${FC.esc(p.farm)}</p>

        <p class="detail-price">${FC.money(p.price)} <small>/ ${FC.esc(p.unit)}</small></p>
        ${stockNote}

        <p class="detail-desc">${FC.esc(p.description)}</p>

        <div class="d-flex flex-wrap gap-2 mb-4">
          ${p.tags.map((t) => `<span class="badge rounded-pill text-bg-light border">${FC.esc(t)}</span>`).join('')}
        </div>

        <div class="d-flex flex-wrap align-items-center gap-3">
          <div class="input-group qty-group" ${soldOut ? 'hidden' : ''}>
            <button class="btn btn-outline-forest" type="button" id="qty-dec" aria-label="Decrease quantity">−</button>
            <input id="qty" class="form-control" type="text" inputmode="numeric" value="1" aria-label="Quantity">
            <button class="btn btn-outline-forest" type="button" id="qty-inc" aria-label="Increase quantity">+</button>
          </div>
          <button id="add-btn" class="btn btn-fc btn-lg" type="button" ${soldOut ? 'disabled' : ''}>${soldOut ? 'Sold out' : 'Add to cart'}</button>
          <button id="wish-btn" class="btn btn-outline-forest btn-lg" type="button"></button>
        </div>

        ${nutrition ? `<hr class="my-4">

        <h2 class="h6 mb-1">Nutrition</h2>
        <p class="small text-secondary mb-2">Approximate values per ${FC.esc(nutrition.per)}</p>
        <table class="table table-sm nutrition-table"><tbody>${nutritionRows}</tbody></table>` : ''}
      </div>
    </div>

    <section class="mt-5 pt-3">
      <h2 class="section-head">More from ${FC.esc(cat)}</h2>
      <div id="related-grid" class="row g-3 g-md-4 mt-1"></div>
    </section>`;

  /* ---------- Quantity stepper + buttons ---------- */

  const qtyInput = document.getElementById('qty');
  const maxQty = Math.min(FC.MAX_QTY, p.stock || FC.MAX_QTY);
  const readQty = () => Math.min(maxQty, Math.max(1, parseInt(qtyInput.value, 10) || 1));

  document.getElementById('qty-dec').addEventListener('click', () => { qtyInput.value = Math.max(1, readQty() - 1); });
  document.getElementById('qty-inc').addEventListener('click', () => { qtyInput.value = Math.min(maxQty, readQty() + 1); });
  qtyInput.addEventListener('change', () => { qtyInput.value = readQty(); });

  document.getElementById('add-btn').addEventListener('click', () => FC.addToCart(p.id, readQty()));

  const wishBtn = document.getElementById('wish-btn');
  const paintWish = () => {
    const on = FC.isWished(p.id);
    wishBtn.textContent = on ? '♥ Saved' : '♡ Save';
    wishBtn.setAttribute('aria-pressed', String(on));
  };
  wishBtn.addEventListener('click', () => FC.toggleWishlist(p.id));
  window.addEventListener(FC.CHANGE_EVENT, paintWish);
  paintWish();

  /* ---------- Related products ---------- */

  const relatedGrid = document.getElementById('related-grid');
  const related = (await FC.loadCatalog()).products
    .filter((x) => x.category === p.category && x.id !== p.id)
    .slice(0, 4);
  relatedGrid.innerHTML = related
    .map((x) => `<div class="col-6 col-lg-3">${FC.productCard(x)}</div>`)
    .join('');
  FC.bindProductActions(relatedGrid);
});
