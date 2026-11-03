/* ============================================================
   freshcart — js/store.js
   Loaded on EVERY page, before that page's own script.

   What lives here (shared by all pages):
     1. Local Storage helpers ........... cart, wishlist, orders   (Practical 4-II)
     2. Product catalog (JSON) loader .... fetch('data/products.json')  (Practical 2)
     3. Cart + wishlist functions
     4. Geolocation + delivery check ..... "Deliver to my location"  (Practical 4-I)
     5. Shared header, footer, toast, product card
   Everything is exposed on one global object:  window.FC
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 1. Local Storage ---------- */

  // cart, wishlist, delivery and orders are stored PER ACCOUNT: the real Local Storage
  // key is  "<key>:<email>"  (or "<key>:guest" when nobody is signed in) — see userKey().
  // Only `user` (who is signed in right now) is shared, and signin.js also keeps
  // the list of registered accounts under 'freshcart-users'.
  const KEYS = {
    cart: 'freshcart-cart-v2',       // [{ id, qty, selected }]           per account
    wishlist: 'freshcart-wishlist',  // [{ id, addedAt }]                 per account
    delivery: 'freshcart-delivery',  // { place, lat, lng, hub, km, ... } per account
    user: 'freshcart-user-v2',       // who is signed in right now, written by signin.js (shared)
    orders: 'freshcart-orders'       // [{ id, items, totals, ... }]      per account
  };
  const MAX_QTY = 20;
  const CHANGE_EVENT = 'freshcart-store-change';

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Local Storage is not available:', e);
    }
    // Tell the rest of the page something changed (badges, hearts, cart list...)
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  /* ---------- Per-account keys ---------- */

  // Who is signed in? The email is the account's unique id ("guest" when signed out).
  function currentUserId() {
    const u = read(KEYS.user, null);
    return u && u.email ? String(u.email).trim().toLowerCase() : 'guest';
  }

  // "freshcart-wishlist" -> "freshcart-wishlist:vraj@mail.com"
  const userKey = (base) => base + ':' + currentUserId();

  // Clean-up of the OLD version: back then every visitor shared these exact keys and
  // any email/password was accepted, so that data belongs to no real account.
  // Removing it stops it from ever showing up under a different account.
  // (Per-account keys have ":<email>" added, so they are never touched here.)
  ['freshcart-cart-v2', 'freshcart-wishlist', 'freshcart-delivery', 'freshcart-orders', 'freshcart-user']
    .forEach((k) => { try { localStorage.removeItem(k); } catch (e) { /* storage blocked */ } });

  /* ---------- Small utilities ---------- */

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  const money = (n) => '₹' + new Intl.NumberFormat('en-IN').format(n);

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function debounce(fn, ms = 200) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  /* ---------- 2. Product catalog (data/products.json) ---------- */

  let catalog = null;
  let catalogPromise = null;
  const productsById = {};

  // Fallback for when the page is opened by double-clicking (file://):
  // browsers block fetch() there, but a <script> tag is allowed.
  // data/products.js is generated from products.json by  node node/build-data.js
  function loadFromScript() {
    return new Promise((resolve, reject) => {
      if (window.FRESHCART_DATA) { resolve(window.FRESHCART_DATA); return; }
      const tag = document.createElement('script');
      tag.src = 'data/products.js';
      tag.onload = () => (window.FRESHCART_DATA
        ? resolve(window.FRESHCART_DATA)
        : reject(new Error('data/products.js is empty')));
      tag.onerror = () => reject(new Error('Could not load data/products.js'));
      document.head.appendChild(tag);
    });
  }

  function loadCatalog() {
    if (!catalogPromise) {
      // 1st choice: the MySQL catalog from server.js (api/catalog).
      // If that is not available (no MySQL, or opened as a plain file) use data/products.json as before.
      catalogPromise = fetch('api/catalog')
        .then((res) => {
          if (!res.ok) throw new Error('no MySQL catalog');
          return res.json();
        })
        .catch(() => fetch('data/products.json'))
        .then((res) => {
          if (res.products) return res;                 // already the parsed MySQL catalog
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .catch((err) => {
          console.warn('fetch(data/products.json) failed (' + err.message + '). Using data/products.js instead.');
          return loadFromScript().catch(() => { throw err; });
        })
        .then(async (data) => {
          catalog = data;
          data.products.forEach((p) => { productsById[p.id] = p; });
          // Give products their photos. Waits at most 3 s so the page never hangs.
          await Promise.race([attachPhotos(data.products), new Promise((r) => setTimeout(r, 3000))]);
          return data;
        });
    }
    return catalogPromise;
  }


  /* ---------- 2b. Product photos ----------
     Each product in products.json can have:
       "image": "images/peaches.jpg"   ← YOUR OWN photo (file in the images/ folder, or any web link). Wins over everything.
       "wiki":  ["Peach"]              ← Wikipedia article(s) whose main photo is used automatically.
     The automatic photos are looked up ONCE (one request for all products) and
     remembered in Local Storage, so later pages load them instantly.        */

  const PHOTO_CACHE_KEY = 'freshcart-photos-v1';
  const PHOTO_CACHE_DAYS = 30;
  const WIKI_API = 'https://en.wikipedia.org/w/api.php';

  const wikiTitles = (p) => [].concat(p.wiki || []);

  // Asks Wikipedia for the main photo of many articles in one go → { title: url | null }
  async function fetchWikiPhotos(titles) {
    const found = {};
    for (let i = 0; i < titles.length; i += 40) {          // the API accepts up to 50 titles per request
      const chunk = titles.slice(i, i + 40);
      const url = WIKI_API + '?action=query&format=json&origin=*&redirects=1&prop=pageimages&piprop=thumbnail&pithumbsize=600'
        + '&titles=' + encodeURIComponent(chunk.join('|'));
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const q = (await res.json()).query || {};

      const normalized = {};
      (q.normalized || []).forEach((n) => { normalized[n.from] = n.to; });
      const redirected = {};
      (q.redirects || []).forEach((r) => { redirected[r.from] = r.to; });
      const photoOf = {};
      Object.values(q.pages || {}).forEach((pg) => { photoOf[pg.title] = pg.thumbnail ? pg.thumbnail.source : null; });

      chunk.forEach((t) => {
        const step1 = normalized[t] || t;
        found[t] = photoOf[redirected[step1] || step1] || null;
      });
    }
    return found;
  }

  async function attachPhotos(products) {
    let cache = read(PHOTO_CACHE_KEY, null);
    if (!cache || !cache.items || Date.now() - cache.savedAt > PHOTO_CACHE_DAYS * 864e5) {
      cache = { savedAt: Date.now(), items: {} };
    }

    const apply = () => products.forEach((p) => {
      if (p.image) return;                                  // your own photo wins
      const hit = wikiTitles(p).map((t) => cache.items[t]).find(Boolean);
      if (hit) p.image = hit;
    });

    apply();                                                // photos we already know
    const missing = [...new Set(products.filter((p) => !p.image).flatMap(wikiTitles))]
      .filter((t) => !(t in cache.items));
    if (!missing.length) return;

    try {
      Object.assign(cache.items, await fetchWikiPhotos(missing));
      try { localStorage.setItem(PHOTO_CACHE_KEY, JSON.stringify(cache)); } catch (e) { /* storage full or blocked */ }
      apply();
    } catch (err) {
      console.warn('Could not fetch product photos (emoji shown instead):', err.message);
    }
  }

  const getProduct = (id) => productsById[id] || null;

  function categoryName(id) {
    const c = catalog && catalog.categories.find((x) => x.id === id);
    return c ? c.name : id;
  }

  function showLoadError(el, err) {
    el.innerHTML = `
      <div class="alert alert-warning" role="alert">
        <strong>Couldn't load the product data.</strong>
        Check that the <code>data</code> folder is next to the HTML files, then open the site through a web server:
        run <code>node server.js</code> and visit <code>http://localhost:3000</code>
        (or use the VS Code “Live Server” extension).
        <div class="small mt-1 text-secondary">${esc(err && err.message ? err.message : err)}</div>
      </div>`;
  }

  /* ---------- 3a. Cart ---------- */

  const getCart = () => read(userKey(KEYS.cart), []);
  const saveCart = (cart) => write(userKey(KEYS.cart), cart);
  const cartCount = () => getCart().reduce((sum, l) => sum + l.qty, 0);

  function addToCart(id, qty = 1) {
    const p = getProduct(id);
    const max = Math.min(MAX_QTY, p && p.stock > 0 ? p.stock : MAX_QTY);
    if (p && p.stock === 0) { toast(`${p.name} is sold out right now`); return; }

    const cart = getCart();
    const line = cart.find((l) => l.id === id);
    if (line) {
      line.qty = Math.min(line.qty + qty, max);
      line.selected = true;
    } else {
      cart.push({ id, qty: Math.min(qty, max), selected: true });
    }
    saveCart(cart);
    toast(p ? `${p.name} added to cart` : 'Added to cart');
  }

  function setQty(id, qty) {
    const p = getProduct(id);
    const max = Math.min(MAX_QTY, p && p.stock > 0 ? p.stock : MAX_QTY);
    if (qty <= 0) return removeFromCart(id);
    const cart = getCart();
    const line = cart.find((l) => l.id === id);
    if (!line) return;
    line.qty = Math.min(qty, max);
    saveCart(cart);
  }

  function toggleSelected(id) {
    const cart = getCart();
    const line = cart.find((l) => l.id === id);
    if (!line) return;
    line.selected = line.selected === false;   // flips true <-> false
    saveCart(cart);
  }

  function removeFromCart(id) {
    saveCart(getCart().filter((l) => l.id !== id));
  }

  function removeSelectedFromCart() {
    saveCart(getCart().filter((l) => l.selected === false));
  }

  function clearCart() { saveCart([]); }

  // Drag & drop reorder: put the dragged line where the target line is
  function moveCartLine(fromId, toId) {
    const cart = getCart();
    const from = cart.findIndex((l) => l.id === fromId);
    const to = cart.findIndex((l) => l.id === toId);
    if (from < 0 || to < 0 || from === to) return;
    const [moved] = cart.splice(from, 1);
    cart.splice(to, 0, moved);
    saveCart(cart);
  }

  // Needs the catalog to be loaded (prices come from products.json)
  function cartTotals() {
    const cfg = (catalog && catalog.store) || { freeDeliveryAbove: 499, deliveryFee: 30 };
    const lines = getCart()
      .filter((l) => productsById[l.id])
      .map((l) => {
        const product = productsById[l.id];
        return { product, qty: l.qty, selected: l.selected !== false, total: product.price * l.qty };
      });
    const picked = lines.filter((l) => l.selected);
    const subtotal = picked.reduce((s, l) => s + l.total, 0);
    const fee = subtotal === 0 || subtotal >= cfg.freeDeliveryAbove ? 0 : cfg.deliveryFee;
    return {
      lines,
      picked,
      count: picked.reduce((s, l) => s + l.qty, 0),
      subtotal,
      fee,
      total: subtotal + fee,
      freeAbove: cfg.freeDeliveryAbove,
      toFree: Math.max(0, cfg.freeDeliveryAbove - subtotal)
    };
  }

  /* ---------- 3b. Wishlist ---------- */

  const getWishlist = () => read(userKey(KEYS.wishlist), []);
  const saveWishlist = (list) => write(userKey(KEYS.wishlist), list);
  const isWished = (id) => getWishlist().some((w) => w.id === id);

  function addToWishlist(id) {
    const list = getWishlist();
    if (list.some((w) => w.id === id)) return false;
    list.push({ id, addedAt: new Date().toISOString() });
    saveWishlist(list);
    return true;
  }

  function toggleWishlist(id) {
    const p = getProduct(id);
    const name = p ? p.name : 'Item';
    if (isWished(id)) {
      saveWishlist(getWishlist().filter((w) => w.id !== id));
      toast(`${name} removed from wishlist`);
      return false;
    }
    addToWishlist(id);
    toast(`${name} saved to wishlist`);
    return true;
  }

  /* ---------- 3c. Orders (written by checkout) ---------- */

  const getOrders = () => read(userKey(KEYS.orders), []);
  function saveOrder(order) {
    const orders = getOrders();
    orders.unshift(order);
    write(userKey(KEYS.orders), orders);
  }

  const getUser = () => read(KEYS.user, null);

  /* ---------- 4. Geolocation + delivery check ---------- */

  // Our delivery hubs — edit these to match your own city.
  const HUBS = [
    { name: 'Surat', lat: 21.1702, lng: 72.8311 },
    { name: 'Ahmedabad', lat: 23.0225, lng: 72.5714 },
    { name: 'Vadodara', lat: 22.3072, lng: 73.1812 },
    { name: 'Rajkot', lat: 22.3039, lng: 70.8022 }
  ];
  const SERVICE_RADIUS_KM = 100;   // ≈ the “60 miles” promise on the home page

  // Haversine formula: distance between two lat/lng points in km
  function distanceKm(lat1, lng1, lat2, lng2) {
    const rad = (d) => (d * Math.PI) / 180;
    const dLat = rad(lat2 - lat1);
    const dLng = rad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function nearestHub(lat, lng) {
    return HUBS
      .map((h) => ({ name: h.name, km: distanceKm(lat, lng, h.lat, h.lng) }))
      .sort((a, b) => a.km - b.km)[0];
  }

  function geoMessage(err) {
    if (err && err.code === 1) return 'Location permission was denied. Allow it in your browser settings and try again.';
    if (err && err.code === 2) return 'Your position is unavailable right now. Check your connection and try again.';
    if (err && err.code === 3) return 'Finding your location took too long. Try again.';
    return 'Could not read your location.';
  }

  const getDelivery = () => read(userKey(KEYS.delivery), null);

  function locate() {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error('This browser does not support Geolocation.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        let place = `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
        try {
          const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
          const data = await res.json();
          const nice = [data.city || data.locality, data.principalSubdivision].filter(Boolean).join(', ');
          if (nice) place = nice;
        } catch (e) { /* offline or blocked: keep the raw coordinates */ }

        const hub = nearestHub(lat, lng);
        const delivery = {
          place, lat, lng,
          hub: hub.name,
          km: Math.round(hub.km),
          available: hub.km <= SERVICE_RADIUS_KM
        };
        write(userKey(KEYS.delivery), delivery);
        resolve(delivery);
      }, (err) => reject(new Error(geoMessage(err))), { timeout: 10000, maximumAge: 300000 });
    });
  }

  function deliveryText(d) {
    return d.available
      ? `📍 ${d.place} — we deliver here (${d.hub} hub, ${d.km} km away)`
      : `📍 ${d.place} — outside our delivery area for now (nearest hub: ${d.hub}, ${d.km} km)`;
  }

  // Wires a "use my location" button to a text element
  function bindLocateButton(btn, out, onDone) {
    if (!btn || !out) return;
    const label = btn.textContent;
    const show = (d) => { out.textContent = deliveryText(d); out.classList.add('visible'); };

    const saved = getDelivery();
    if (saved) show(saved);

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Locating…';
      try {
        const d = await locate();
        show(d);
        if (onDone) onDone(d);
      } catch (e) {
        out.textContent = e.message;
        out.classList.add('visible');
      } finally {
        btn.disabled = false;
        btn.textContent = label;
      }
    });
  }

  /* ---------- 5. Shared UI: toast, header, footer, product card ---------- */

  let toastTimer;
  function toast(message) {
    let box = document.getElementById('fc-toast');
    if (!box) {
      box = document.createElement('div');
      box.id = 'fc-toast';
      box.className = 'fc-toast';
      box.setAttribute('role', 'status');
      document.body.appendChild(box);
    }
    box.textContent = message;
    box.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove('show'), 2000);
  }

  function renderHeader() {
    const host = $('#site-header');
    if (!host) return;
    const page = location.pathname.split('/').pop() || 'index.html';
    const on = (...pages) => (pages.includes(page) ? ' active' : '');

    host.innerHTML = `
      <nav class="navbar navbar-expand-md">
        <div class="container-fluid px-0">
          <a href="index.html" class="logo">fresh<span>cart</span></a>

          <button class="navbar-toggler border-0 shadow-none" type="button" data-bs-toggle="collapse"
                  data-bs-target="#navMenu" aria-controls="navMenu" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"></span>
          </button>

          <div class="collapse navbar-collapse flex-grow-0" id="navMenu">
            <div class="nav-links flex-column flex-md-row mt-3 mt-md-0">
              <a href="index.html" class="nav-link${on('index.html')}">Home</a>
              <a href="products.html" class="nav-link${on('products.html', 'product.html')}">Products</a>
              <a href="wishlist.html" class="nav-link${on('wishlist.html')}">Wishlist <span class="nav-badge" data-wish-count hidden>0</span></a>
              <a href="cart.html" class="nav-link${on('cart.html', 'checkout.html')}">Cart <span class="nav-badge" data-cart-count hidden>0</span></a>
              <a href="index.html#footer" class="nav-link">About</a>
              <div id="nav-user-container" class="d-inline-block"></div>
            </div>
          </div>
        </div>
      </nav>`;
  }

  function renderFooter() {
    const host = $('#site-footer');
    if (!host) return;
    host.innerHTML = `
      <footer class="footer" id="footer">
        freshcart · fresh from growers within 60 miles · Gujarat, India
      </footer>`;
  }

  function renderUserChip() {
    const box = $('#nav-user-container');
    if (!box) return;
    const user = getUser();
    const onSignIn = location.pathname.endsWith('signin.html');
    box.innerHTML = user
      ? `<a href="signin.html" class="nav-link nav-user${onSignIn ? ' active' : ''}">👤 ${esc((user.name || 'Account').split(' ')[0])}</a>`
      : `<a href="signin.html" class="nav-link${onSignIn ? ' active' : ''}">Sign in</a>`;
  }

  function updateBadges() {
    const cart = cartCount();
    const wish = getWishlist().length;
    $$('[data-cart-count]').forEach((el) => {
      el.textContent = cart;
      if (el.classList.contains('nav-badge')) el.hidden = cart === 0;
    });
    $$('[data-wish-count]').forEach((el) => {
      el.textContent = wish;
      if (el.classList.contains('nav-badge')) el.hidden = wish === 0;
    });
  }

  // Keeps every heart button in step with the wishlist
  function syncWishButtons() {
    $$('.wish-btn[data-wish]').forEach((btn) => {
      const on = isWished(btn.dataset.wish);
      btn.classList.toggle('is-on', on);
      btn.textContent = on ? '♥' : '♡';
      btn.setAttribute('aria-pressed', String(on));
    });
  }

  // <img> for a product photo. If the photo can't load (offline, bad URL),
  // imageFallback() swaps it for the product's emoji so the card never looks broken.
  function imageTag(p, opts = {}) {
    const fb = opts.fallbackClass || 'product-emoji';
    if (!p.image) return `<span class="${fb}" aria-hidden="true">${p.emoji}</span>`;
    return `<img class="${opts.cls || ''}" src="${esc(p.image)}" alt="${esc(opts.alt || '')}" loading="lazy" referrerpolicy="no-referrer" data-emoji="${p.emoji}" data-fb="${fb}" onerror="FC.imageFallback(this)">`;
  }

  function imageFallback(img) {
    const span = document.createElement('span');
    span.className = img.dataset.fb || 'product-emoji';
    span.textContent = img.dataset.emoji || '🛒';
    span.setAttribute('aria-hidden', 'true');
    img.replaceWith(span);
  }

  function stars(rating) { return `★ ${rating.toFixed(1)}`; }

  // Bootstrap card markup for one product (used on Home, Products, Product details)
  function productCard(p, opts = {}) {
    const wished = isWished(p.id);
    const soldOut = p.stock === 0;
    return `
      <article class="card product-card" data-id="${p.id}"${opts.draggable && !soldOut ? ' draggable="true"' : ''}>
        <a href="product.html?id=${p.id}" class="product-thumb thumb-${p.category}" aria-label="View ${esc(p.name)}">
          ${imageTag(p, { cls: 'product-img' })}
          ${p.organic ? '<span class="badge-organic">Organic</span>' : ''}
        </a>
        <button type="button" class="wish-btn${wished ? ' is-on' : ''}" data-wish="${p.id}"
                aria-label="Save ${esc(p.name)} to wishlist" aria-pressed="${wished}">${wished ? '♥' : '♡'}</button>
        <div class="card-body product-body">
          <p class="product-cat">${esc(categoryName(p.category))}</p>
          <h3 class="product-name"><a href="product.html?id=${p.id}">${esc(p.name)}</a></h3>
          <p class="product-meta">${esc(p.unit)} · ${stars(p.rating)}</p>
          <div class="product-foot">
            <span class="product-price">${money(p.price)}</span>
            ${soldOut
              ? '<button type="button" class="btn btn-sm btn-fc" disabled>Sold out</button>'
              : `<button type="button" class="btn btn-sm btn-fc" data-add="${p.id}">Add</button>`}
          </div>
        </div>
      </article>`;
  }

  // One click handler for all "Add" and heart buttons inside a container
  function bindProductActions(root) {
    root.addEventListener('click', (e) => {
      const add = e.target.closest('[data-add]');
      if (add) { addToCart(add.dataset.add); return; }
      const heart = e.target.closest('[data-wish]');
      if (heart) toggleWishlist(heart.dataset.wish);
    });
  }

  /* ---------- Start-up ---------- */

  // Which account was this page showing when it loaded?
  let shownFor = currentUserId();

  ready(() => {
    renderHeader();
    renderFooter();
    renderUserChip();
    updateBadges();

    const refresh = () => { updateBadges(); syncWishButtons(); };
    window.addEventListener(CHANGE_EVENT, refresh);

    // Another tab changed something.
    window.addEventListener('storage', (e) => {
      if (e.key === PHOTO_CACHE_KEY) return;                 // photo cache isn't user data
      renderUserChip();
      if (currentUserId() !== shownFor) { location.reload(); return; }   // someone else signed in/out over there
      window.dispatchEvent(new Event(CHANGE_EVENT));         // same account: just re-read its data
    });

    // Signed in / out on THIS page (event comes from signin.js):
    // switch the badges and hearts to the new account's cart + wishlist.
    window.addEventListener('freshcart-auth-change', () => {
      shownFor = currentUserId();
      renderUserChip();
      window.dispatchEvent(new Event(CHANGE_EVENT));
    });
  });

  // Pressing Back can bring up a saved copy of a page from a different account.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted && currentUserId() !== shownFor) location.reload();
  });

  /* ---------- Public API ---------- */

  window.FC = {
    KEYS, CHANGE_EVENT, MAX_QTY, userKey, currentUserId,
    $, $$, esc, money, ready, debounce,
    loadCatalog, getProduct, categoryName, showLoadError,
    getCart, cartCount, addToCart, setQty, toggleSelected, removeFromCart, removeSelectedFromCart, clearCart, moveCartLine, cartTotals,
    getWishlist, saveWishlist, isWished, addToWishlist, toggleWishlist,
    getOrders, saveOrder, getUser,
    locate, getDelivery, deliveryText, bindLocateButton,
    toast, productCard, bindProductActions, syncWishButtons, stars, imageTag, imageFallback
  };
})();
