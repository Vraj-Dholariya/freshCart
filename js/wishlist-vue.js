/* ============================================================
   freshcart — js/wishlist-vue.js   (wishlist.html)
   VUE 3 + CUSTOM DIRECTIVES   (Practical 7)

   Part A — the Vue app  ......... a dynamic list (v-for) that you can
                                    filter, sort, add to and remove from
                                    (Practical 7-II)
   Part B — custom directives .... registered with app.directive():
        v-uppercase  transform text to UPPERCASE when clicked   (7-I)
        v-date       format an ISO date in a human-readable way (7-III)
        v-highlight  highlight a list row while the mouse is over it

   The wishlist is stored in Local Storage through FC (js/store.js),
   so the products page, the cart page and this page stay in sync.
   ============================================================ */

const { createApp, ref, reactive, computed, onMounted } = Vue;

/* ============================================================
   PART A — the Vue app
   ============================================================ */

const app = createApp({
  setup() {
    // ---- reactive state ----
    const catalog = ref([]);                       // all products (from products.json)
    const wishlist = ref(FC.getWishlist());        // [{ id, addedAt }]
    const filter = ref('');
    const sortBy = ref('recent');
    const pick = ref('');                          // product chosen in the "add" dropdown
    const loadError = ref('');
    const failed = reactive({});                   // ids whose photo failed to load → show the emoji
    const loaded = ref(false);                     // true once products.json has arrived

    onMounted(async () => {
      try {
        const data = await FC.loadCatalog();
        catalog.value = data.products;
        loaded.value = true;
      } catch (err) {
        loadError.value = 'Could not load data/products.json. Run the site with "node server.js" and open http://localhost:3000.';
      }
    });

    // Another tab changed THIS account's wishlist → refresh this one
    // (if another tab signs in as a different user, store.js reloads the page)
    window.addEventListener('storage', (e) => {
      if (e.key === FC.userKey(FC.KEYS.wishlist)) wishlist.value = FC.getWishlist();
    });

    // ---- computed values (recalculated automatically) ----
    const byId = computed(() => Object.fromEntries(catalog.value.map((p) => [p.id, p])));

    // wishlist entries joined with their full product data
    const items = computed(() =>
      wishlist.value
        .filter((w) => byId.value[w.id])
        .map((w) => ({ ...w, product: byId.value[w.id] }))
    );

    // what the list actually shows: filtered, then sorted
    const visible = computed(() => {
      const q = filter.value.toLowerCase();
      const list = items.value.filter((i) =>
        !q || (i.product.name + ' ' + FC.categoryName(i.product.category)).toLowerCase().includes(q)
      );
      const sorters = {
        recent: (a, b) => new Date(b.addedAt) - new Date(a.addedAt),
        oldest: (a, b) => new Date(a.addedAt) - new Date(b.addedAt),
        'price-asc': (a, b) => a.product.price - b.product.price,
        'price-desc': (a, b) => b.product.price - a.product.price,
        name: (a, b) => a.product.name.localeCompare(b.product.name)
      };
      return list.slice().sort(sorters[sortBy.value]);
    });

    // products that are NOT on the wishlist yet (for the "add" dropdown)
    const available = computed(() =>
      catalog.value.filter((p) => !wishlist.value.some((w) => w.id === p.id))
    );

    // ---- actions ----
    const persist = () => FC.saveWishlist(wishlist.value);

    function remove(id) {
      wishlist.value = wishlist.value.filter((w) => w.id !== id);
      persist();
    }

    function addPicked() {
      if (!pick.value) return;
      wishlist.value = [...wishlist.value, { id: pick.value, addedAt: new Date().toISOString() }];
      pick.value = '';
      persist();
    }

    function clearAll() {
      if (!confirm('Remove everything from your wishlist?')) return;
      wishlist.value = [];
      persist();
    }

    function addToCart(id) { FC.addToCart(id, 1); }

    function addAllToCart() {
      const inStock = items.value.filter((i) => i.product.stock > 0);
      inStock.forEach((i) => FC.addToCart(i.id, 1));
      if (inStock.length < items.value.length) FC.toast('Sold-out items were skipped');
    }

    return {
      wishlist, items, visible, available, filter, sortBy, pick, loadError, loaded, failed,
      remove, addPicked, clearAll, addToCart, addAllToCart,
      money: FC.money,
      categoryName: FC.categoryName
    };
  }
});

/* ============================================================
   PART B — custom directives
   A directive is a set of "hooks" Vue calls for an element:
     mounted(el, binding)  → element was added to the page
     updated(el, binding)  → the component re-rendered
   `el` is the real DOM element, `binding.value` is what you wrote
   after the =, and `binding.modifiers` holds things like .relative
   ============================================================ */

/* ---- 7-I  v-uppercase ------------------------------------------------
   Usage:  <h3 v-uppercase>Carrots</h3>
   Click the text → CARROTS. Click again → Carrots.                       */
app.directive('uppercase', {
  mounted(el) {
    el.style.cursor = 'pointer';
    el.title = 'Click to toggle UPPERCASE';

    el.addEventListener('click', () => {
      if (el.dataset.original === undefined) {
        el.dataset.original = el.textContent;          // remember the normal text
        el.textContent = el.textContent.toUpperCase(); // transform it
      } else {
        el.textContent = el.dataset.original;          // put it back
        delete el.dataset.original;
      }
    });
  },
  updated(el) {
    // If Vue rewrote the text itself, forget our saved copy
    if (el.dataset.original !== undefined && el.textContent !== el.dataset.original.toUpperCase()) {
      delete el.dataset.original;
    }
  }
});

/* ---- 7-III  v-date ---------------------------------------------------
   Usage:  <span v-date="item.addedAt"></span>            → 19 September 2026, 3:45 pm
           <span v-date.relative="item.addedAt"></span>   → 2 days ago
   The full date is always available as the tooltip (title).             */
function humanDate(iso, relative) {
  const d = new Date(iso);
  if (isNaN(d)) return 'on an unknown date';

  if (relative) {
    const minutes = Math.round((Date.now() - d.getTime()) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  }
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
  }).format(d);
}

function renderDate(el, binding) {
  el.textContent = humanDate(binding.value, binding.modifiers.relative);
  el.title = humanDate(binding.value, false);
}

app.directive('date', {
  mounted: renderDate,
  updated(el, binding) {
    if (binding.value !== binding.oldValue) renderDate(el, binding);
  }
});

/* ---- v-highlight -----------------------------------------------------
   Usage:  <li v-highlight="'#FFF6E0'">…</li>
   Adds a background colour while the pointer is over the element.
   The value after = is the colour (defaults to light yellow).            */
app.directive('highlight', {
  mounted(el, binding) {
    const color = binding.value || '#FFF6E0';
    el.addEventListener('mouseenter', () => { el.style.backgroundColor = color; });
    el.addEventListener('mouseleave', () => { el.style.backgroundColor = ''; });
  }
});

app.mount('#wishlist-app');
