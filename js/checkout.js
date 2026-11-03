/* ============================================================
   freshcart — js/checkout.js   (checkout.html — BOOTSTRAP page)

   10. Checkout ... Bootstrap form validation, order summary from the
                    cart, order saved to Local Storage as JSON.
   7.  Delivery ... "Use my current location" fills the city field.
   ============================================================ */
FC.ready(async () => {
  const layout = document.getElementById('checkout-layout');
  const emptyBox = document.getElementById('empty-checkout');
  const success = document.getElementById('order-success');
  const form = document.getElementById('checkout-form');
  const linesEl = document.getElementById('summary-lines');
  const cityInput = document.getElementById('city');

  try {
    await FC.loadCatalog();
  } catch (err) {
    FC.showLoadError(emptyBox, err);
    emptyBox.hidden = false;
    return;
  }

  let totals = FC.cartTotals();
  if (totals.count === 0) {
    emptyBox.hidden = false;
    return;
  }
  layout.hidden = false;

  /* ---------- Order summary ---------- */

  function renderSummary() {
    totals = FC.cartTotals();
    linesEl.innerHTML = totals.picked
      .map((l) => `
        <div class="summary-line">
          <span class="d-flex align-items-center gap-2">
            ${FC.imageTag(l.product, { cls: 'summary-thumb', fallbackClass: 'summary-emoji' })}
            <span>${FC.esc(l.product.name)} <span class="text-secondary">× ${l.qty}</span></span>
          </span>
          <span class="amt">${FC.money(l.total)}</span>
        </div>`)
      .join('');
    document.getElementById('sum-subtotal').textContent = FC.money(totals.subtotal);
    document.getElementById('sum-fee').textContent = totals.fee === 0 ? 'Free' : FC.money(totals.fee);
    document.getElementById('sum-total').textContent = FC.money(totals.total);
  }
  renderSummary();

  /* ---------- Pre-fill from what we already know ---------- */

  const user = FC.getUser();
  if (user) {
    document.getElementById('full-name').value = user.name || '';
    document.getElementById('email').value = user.email || '';
  }

  const saved = FC.getDelivery();
  if (saved) cityInput.value = saved.place;

  FC.bindLocateButton(
    document.getElementById('locate-btn'),
    document.getElementById('delivery-line'),
    (d) => { cityInput.value = d.place; }
  );

  /* ---------- Place the order ---------- */

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    form.classList.add('was-validated');           // shows Bootstrap's red/green states
    if (!form.checkValidity()) {
      const firstBad = form.querySelector(':invalid');
      if (firstBad) firstBad.focus();
      return;
    }

    renderSummary();
    if (totals.count === 0) { location.reload(); return; }

    const field = (name) => form.elements[name].value.trim();
    const order = {
      id: 'FC-' + Date.now().toString(36).toUpperCase(),
      placedAt: new Date().toISOString(),
      customer: {
        name: field('name'),
        mobile: field('mobile'),
        email: field('email'),
        address: field('address'),
        city: field('city'),
        pincode: field('pincode')
      },
      slot: form.elements.slot.value,
      payment: form.elements.payment.value,
      items: totals.picked.map((l) => ({ id: l.product.id, name: l.product.name, qty: l.qty, price: l.product.price })),
      subtotal: totals.subtotal,
      deliveryFee: totals.fee,
      total: totals.total
    };

    FC.saveOrder(order);            // JSON object → Local Storage
    FC.removeSelectedFromCart();    // ordered items leave the cart; unticked ones stay

    layout.hidden = true;
    success.hidden = false;
    document.getElementById('success-name').textContent = order.customer.name.split(' ')[0];
    document.getElementById('success-id').textContent = order.id;
    document.getElementById('success-detail').textContent =
      `${FC.money(order.total)} · ${order.payment} · ${order.slot}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});
