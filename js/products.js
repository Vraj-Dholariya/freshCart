/* ============================================================
   freshcart — js/products.js   (products.html)

   2. Products ...... rendered from data/products.json
   3. Search ........ live search + category / organic filters + sorting
   9. Drag & Drop ... HTML5 Drag and Drop API (Practical 4-III):
                      drag a product card onto the Cart or Wishlist zone
   ============================================================ */
FC.ready(async () => {
  const grid = document.getElementById('product-grid');
  const chipsBox = document.getElementById('category-chips');
  const searchInput = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear');
  const sortSelect = document.getElementById('sort-select');
  const organicSwitch = document.getElementById('organic-switch');
  const countEl = document.getElementById('result-count');

  let data;
  try {
    data = await FC.loadCatalog();
  } catch (err) {
    FC.showLoadError(grid, err);
    return;
  }

  /* ---------- State (read from the URL so links like ?category=fruit&q=peach work) ---------- */

  const params = new URLSearchParams(location.search);
  const validCats = data.categories.map((c) => c.id);
  const state = {
    q: params.get('q') || '',
    category: validCats.includes(params.get('category')) ? params.get('category') : 'all',
    sort: 'featured',
    organic: false
  };

  /* ---------- Filter chips ---------- */

  function renderChips() {
    const all = [{ id: 'all', name: 'All' }, ...data.categories];
    chipsBox.innerHTML = all
      .map((c) => `<button type="button" class="chip${c.id === state.category ? ' active' : ''}" data-cat="${c.id}" aria-pressed="${c.id === state.category}">${FC.esc(c.name)}</button>`)
      .join('');
  }

  chipsBox.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-cat]');
    if (!chip) return;
    state.category = chip.dataset.cat;
    renderChips();
    render();
  });

  /* ---------- Search + filter + sort ---------- */

  function getResults() {
    const words = state.q.trim().toLowerCase().split(/\s+/).filter(Boolean);

    let list = data.products.filter((p) => {
      if (state.category !== 'all' && p.category !== state.category) return false;
      if (state.organic && !p.organic) return false;
      if (!words.length) return true;
      // every typed word must appear somewhere in the product's searchable text
      const haystack = [p.name, FC.categoryName(p.category), p.description, p.farm, ...p.tags]
        .join(' ')
        .toLowerCase();
      return words.every((w) => haystack.includes(w));
    });

    const sorters = {
      'price-asc': (a, b) => a.price - b.price,
      'price-desc': (a, b) => b.price - a.price,
      rating: (a, b) => b.rating - a.rating,
      name: (a, b) => a.name.localeCompare(b.name),
      featured: (a, b) => Number(b.featured) - Number(a.featured)
    };
    list = list.slice().sort(sorters[state.sort]);
    return list;
  }

  function render() {
    const list = getResults();

    clearBtn.hidden = !state.q;

    countEl.textContent = list.length === 1 ? '1 product' : `${list.length} products`;
    if (state.q) countEl.textContent += ` matching “${state.q.trim()}”`;

    if (!list.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <span class="big" aria-hidden="true">🧺</span>
          <p class="mb-2"><strong>Nothing matches that search.</strong></p>
          <p class="mb-0">Try a shorter word, or clear the filters.</p>
        </div>`;
    } else {
      grid.innerHTML = list
        .map((p) => `<div class="col-6 col-md-4 col-xl-3">${FC.productCard(p, { draggable: true })}</div>`)
        .join('');
    }

    // keep the address bar shareable
    const next = new URLSearchParams();
    if (state.q.trim()) next.set('q', state.q.trim());
    if (state.category !== 'all') next.set('category', state.category);
    const qs = next.toString();
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
  }

  searchInput.value = state.q;
  searchInput.addEventListener('input', FC.debounce(() => {
    state.q = searchInput.value;
    render();
  }, 150));

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    state.q = '';
    render();
    searchInput.focus();
  });

  sortSelect.addEventListener('change', () => { state.sort = sortSelect.value; render(); });
  organicSwitch.addEventListener('change', () => { state.organic = organicSwitch.checked; render(); });

  FC.bindProductActions(grid);
  renderChips();
  render();

  /* ---------- 9. Drag & Drop ---------- */

  // A) the thing being dragged: any product card
  grid.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.product-card');
    if (!card) return;
    e.dataTransfer.setData('text/plain', card.dataset.id);   // what we carry: the product id
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setDragImage(card, 40, 40);
    card.classList.add('dragging');
    document.body.classList.add('is-dragging');              // slides the drop zones into view
  });

  grid.addEventListener('dragend', (e) => {
    const card = e.target.closest('.product-card');
    if (card) card.classList.remove('dragging');
    document.body.classList.remove('is-dragging');
    document.querySelectorAll('.drop-zone').forEach((z) => z.classList.remove('over'));
  });

  // B) the places it can be dropped: the two zones
  document.querySelectorAll('.drop-zone').forEach((zone) => {
    zone.addEventListener('dragenter', (e) => { e.preventDefault(); zone.classList.add('over'); });

    // preventDefault() on dragover is what tells the browser "dropping here is allowed"
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    zone.addEventListener('dragleave', (e) => {
      if (!zone.contains(e.relatedTarget)) zone.classList.remove('over');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('over');
      document.body.classList.remove('is-dragging');

      const id = e.dataTransfer.getData('text/plain');
      const product = FC.getProduct(id);
      if (!product) return;

      if (zone.dataset.action === 'cart') {
        FC.addToCart(id);
      } else if (FC.addToWishlist(id)) {
        FC.toast(`${product.name} saved to wishlist`);
      } else {
        FC.toast(`${product.name} is already in your wishlist`);
      }
    });
  });
});
