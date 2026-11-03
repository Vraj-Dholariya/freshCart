/* ============================================================
   freshcart — js/cart.js   (cart.html — TAILWIND page)

   5. Shopping cart ... cart is a JSON array in Local Storage:
                        [{ id, qty, selected }]
                        add / tick (selected) / change qty / remove —
                        the same idea as the JSON to-do list (Practical 2-IV)
   7. Delivery ........ Geolocation API via FC.bindLocateButton()
   9. Drag & Drop ..... drag rows by the ⠿ handle to reorder the list

   Every class name below is a Tailwind utility class.
   ============================================================ */
FC.ready(async () => {
  const listEl = document.getElementById('cart-lines');
  const emptyEl = document.getElementById('cart-empty');
  const countEl = document.getElementById('item-count');
  const checkoutBtn = document.getElementById('checkout-btn');
  const clearBtn = document.getElementById('clear-cart');

  // Delivery / location
  FC.bindLocateButton(
    document.getElementById('locate-btn'),
    document.getElementById('delivery-line')
  );

  try {
    await FC.loadCatalog();
  } catch (err) {
    FC.showLoadError(listEl, err);
    return;
  }

  /* ---------- Rendering ---------- */

  function lineHTML(l) {
    const p = l.product;
    const off = !l.selected;
    return `
      <li draggable="true" data-id="${p.id}"
          class="group flex items-center gap-3 rounded-2xl bg-white/70 px-3 py-3 transition-colors duration-150 hover:bg-white ${off ? 'opacity-60' : ''}">
        <span class="cursor-grab select-none text-slate-300 group-hover:text-slate-400" aria-label="Drag to reorder" title="Drag to reorder">⠿</span>

        <input type="checkbox" data-select ${l.selected ? 'checked' : ''}
          class="h-5 w-5 shrink-0 cursor-pointer accent-forest" aria-label="Include ${FC.esc(p.name)} in this order">

        <a href="product.html?id=${p.id}" class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-emerald-50 text-3xl" aria-hidden="true" tabindex="-1">${FC.imageTag(p, { cls: 'h-full w-full object-cover', fallbackClass: 'text-3xl' })}</a>

        <div class="min-w-0 flex-1">
          <a href="product.html?id=${p.id}"
             class="block truncate font-body text-sm font-semibold text-forest hover:underline ${off ? 'line-through' : ''}">${FC.esc(p.name)}</a>
          <p class="font-mono text-xs text-slate-400">${FC.money(p.price)} · ${FC.esc(p.unit)}</p>
          <div class="mt-1 flex gap-3 font-body text-xs">
            <button type="button" data-save class="text-leaf-dark hover:underline">Save for later</button>
            <button type="button" data-remove class="text-red-400 hover:text-red-600 hover:underline">Remove</button>
          </div>
        </div>

        <div class="flex shrink-0 items-center rounded-full border border-slate-200 bg-white">
          <button type="button" data-dec class="h-8 w-8 rounded-l-full text-lg leading-none text-slate-500 hover:bg-slate-50" aria-label="Decrease quantity of ${FC.esc(p.name)}">−</button>
          <span class="w-7 text-center font-mono text-sm text-slate-800" aria-live="polite">${l.qty}</span>
          <button type="button" data-inc class="h-8 w-8 rounded-r-full text-lg leading-none text-slate-500 hover:bg-slate-50" aria-label="Increase quantity of ${FC.esc(p.name)}">+</button>
        </div>

        <span class="w-16 shrink-0 text-right font-mono text-sm font-medium text-forest">${FC.money(l.total)}</span>
      </li>`;
  }

  function render() {
    const t = FC.cartTotals();

    listEl.innerHTML = t.lines.map(lineHTML).join('');
    emptyEl.classList.toggle('hidden', t.lines.length > 0);
    clearBtn.classList.toggle('invisible', t.lines.length === 0);

    countEl.textContent = `${t.count} item${t.count === 1 ? '' : 's'} in order`;

    document.getElementById('sum-subtotal').textContent = FC.money(t.subtotal);
    document.getElementById('sum-fee').textContent = t.subtotal === 0 ? '₹0' : (t.fee === 0 ? 'Free' : FC.money(t.fee));
    document.getElementById('sum-total').textContent = FC.money(t.total);

    // free-delivery progress
    const pct = t.subtotal === 0 ? 0 : Math.min(100, Math.round((t.subtotal / t.freeAbove) * 100));
    document.getElementById('free-bar').style.width = pct + '%';
    document.getElementById('free-bar-wrap').setAttribute('aria-valuenow', String(pct));
    document.getElementById('free-msg').textContent =
      t.subtotal === 0 ? `Free delivery on orders over ${FC.money(t.freeAbove)}`
        : t.toFree > 0 ? `Add ${FC.money(t.toFree)} more for free delivery`
          : 'You get free delivery on this order';

    // can't check out with nothing ticked
    const canCheckout = t.count > 0;
    checkoutBtn.classList.toggle('pointer-events-none', !canCheckout);
    checkoutBtn.classList.toggle('opacity-40', !canCheckout);
    checkoutBtn.setAttribute('aria-disabled', String(!canCheckout));
  }

  window.addEventListener(FC.CHANGE_EVENT, render);
  render();

  /* ---------- Row actions (one delegated click handler) ---------- */

  const currentQty = (id) => (FC.getCart().find((l) => l.id === id) || { qty: 0 }).qty;

  listEl.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    const id = li.dataset.id;

    if (e.target.closest('[data-inc]')) FC.setQty(id, currentQty(id) + 1);
    else if (e.target.closest('[data-dec]')) FC.setQty(id, currentQty(id) - 1);
    else if (e.target.closest('[data-remove]')) FC.removeFromCart(id);
    else if (e.target.closest('[data-save]')) {
      FC.addToWishlist(id);
      FC.removeFromCart(id);
      FC.toast(`${FC.getProduct(id).name} moved to wishlist`);
    }
  });

  listEl.addEventListener('change', (e) => {
    const box = e.target.closest('[data-select]');
    if (box) FC.toggleSelected(box.closest('li').dataset.id);
  });

  clearBtn.addEventListener('click', () => {
    if (confirm('Remove everything from your cart?')) FC.clearCart();
  });

  /* ---------- Drag & Drop: reorder rows (HTML5 Drag and Drop API) ---------- */

  const OVER = ['ring-2', 'ring-emerald-400'];
  let draggedId = null;

  const clearOver = () => listEl.querySelectorAll('li').forEach((li) => li.classList.remove(...OVER));

  listEl.addEventListener('dragstart', (e) => {
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    draggedId = li.dataset.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedId);
    li.classList.add('opacity-40');
  });

  listEl.addEventListener('dragover', (e) => {
    const li = e.target.closest('li[data-id]');
    if (!li || !draggedId) return;
    e.preventDefault();                       // allow dropping here
    e.dataTransfer.dropEffect = 'move';
    clearOver();
    if (li.dataset.id !== draggedId) li.classList.add(...OVER);
  });

  listEl.addEventListener('drop', (e) => {
    const li = e.target.closest('li[data-id]');
    if (!li || !draggedId) return;
    e.preventDefault();
    clearOver();
    if (li.dataset.id !== draggedId) FC.moveCartLine(draggedId, li.dataset.id);   // saves + re-renders
    draggedId = null;
  });

  listEl.addEventListener('dragend', () => {
    draggedId = null;
    clearOver();
    listEl.querySelectorAll('li').forEach((li) => li.classList.remove('opacity-40'));
  });
});
