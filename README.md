# freshcart — Online Grocery Store

Application title for Practicals 2–10 (Practical 1-V): **freshcart — Online Grocery Store**

## How to run

The site loads `data/products.json` with `fetch()`. Browsers block `fetch()` on `file://` pages
(when you double-click an HTML file), so the site then falls back to `data/products.js`, a script copy
of the same data, and still works. Geolocation, however, needs `localhost` or HTTPS, so for the full
project run the small Node server:

```
node server.js
```

Then open **http://localhost:3000**. (VS Code "Live Server" also works.)

Node practicals (run from this folder):

```
node node/script.js        # Hello world
node node/app.js           # create + display + save a JSON object
node node/read-json.js     # read data/products.json
node node/json-arrays.js   # multi-dimensional arrays
node node/build-data.js    # re-create data/products.js after you edit products.json
node node/set-image.js Peaches "my-photo.jpg"   # use your own photo for a product
```

## Folder map

```
freshcart/
├── index.html          1  Home                      (Bootstrap)
├── products.html       2  Products + 3 Search + 9 Drag & Drop   (Bootstrap)
├── product.html        4  Product details           (Bootstrap)
├── cart.html           5  Shopping cart             (Tailwind)
├── wishlist.html       6  Wishlist                  (Tailwind + Vue 3)
├── checkout.html       10 Checkout                  (Bootstrap)
├── signin.html            Sign in / create account  (Tailwind)
├── server.js              Tiny Node web server
├── data/products.json     All products, categories, nested nutrition (JSON)
├── data/products.js       Generated copy of products.json (fallback for file://)
├── css/style.css          Brand + Bootstrap-side styles + media queries
├── js/
│   ├── store.js           SHARED: Local Storage, cart, wishlist, Geolocation, header/footer, product card
│   ├── tailwind-config.js Tailwind colors + fonts (Tailwind side)
│   ├── home.js  products.js  product-detail.js  cart.js  checkout.js  signin.js
│   └── wishlist-vue.js    Vue 3 app + custom directives
├── node/                  script.js, app.js, read-json.js, json-arrays.js, build-data.js, set-image.js
├── images/                Your own product photos go here (see HOW-TO-CHANGE-IMAGES.md)
├── practicals/student-registration.html   Bootstrap OFFLINE + registration form
└── vendor/bootstrap/      Local copy of Bootstrap 5.3.3 (for the offline practical)
```

## Feature checklist (your 10 features)

| # | Feature | Where |
|---|---------|-------|
| 1 | Home | `index.html`, `js/home.js` |
| 2 | Products | `products.html`, `js/products.js`, `data/products.json` |
| 3 | Search | search box on Home and Products (live search, category chips, organic switch, sorting) |
| 4 | Product details | `product.html`, `js/product-detail.js` (`?id=p01`) |
| 5 | Shopping cart | `cart.html`, `js/cart.js` |
| 6 | Wishlist | `wishlist.html`, `js/wishlist-vue.js` |
| 7 | Location / delivery | Geolocation API in `js/store.js` → `locate()`. Buttons on Home, Cart, Checkout. Works out the nearest delivery hub and whether we deliver |
| 8 | Local Storage | `js/store.js` → cart, wishlist, delivery location, orders (each stored per account), signed-in user; `js/signin.js` → registered accounts |
| 9 | Drag & Drop | Products page: drag a card onto the Cart / Wishlist zone. Cart page: drag rows to reorder |
| 10 | Checkout | `checkout.html`, `js/checkout.js` (validated form, order saved as JSON) |

## Bootstrap vs Tailwind split

- **Bootstrap pages:** Home, Products, Product details, Checkout (+ the shared navbar)
- **Tailwind pages:** Cart, Wishlist, Sign in (config in `js/tailwind-config.js`)

## Practical → file map (for viva)

| Practical | Task | Where to show it |
|-----------|------|------------------|
| 1-I | JS embedded in HTML | `index.html` — inline `<script>` at the bottom (greeting) |
| 1-II | Install Node.js | `node -v` in the terminal |
| 1-III | "Hello world" on the server | `node/script.js` |
| 1-IV | app.js creates + stores a JSON object | `node/app.js` (creates `node/store-info.json`) |
| 1-V | Application title | freshcart — Online Grocery Store |
| 2-I | JSON object shown in the terminal | `node/app.js` |
| 2-II | Read an external JSON file | `node/read-json.js` reads `data/products.json` |
| 2-III | Multi-dimensional JSON arrays | `node/json-arrays.js` |
| 2-IV | JS + JSON to-do list (add / mark done / remove) | Cart: JSON array in Local Storage; add, tick/untick items, change qty, remove |
| 3-I | Viewport meta tag | `<meta name="viewport">` in every page's `<head>` |
| 3-II | width / max-width + responsive images | `css/style.css` `.store-photo img`; `<picture>` in `index.html` |
| 3-III | Text size in `vw` | `css/style.css` `.hero h1` (`clamp(2.5rem, 6vw, 4.5rem)`) |
| 3-IV | Media queries | bottom of `css/style.css` (900px / 600px / 380px) |
| 4-I | Geolocation API | `js/store.js` → `locate()`; Home hero button |
| 4-II | Local Storage | `js/store.js` (`read` / `write`); see DevTools → Application → Local Storage |
| 4-III | Drag and Drop API | `js/products.js` (cards → zones), `js/cart.js` (reorder) |
| 5-I | Bootstrap via CDN | `<link>` to jsDelivr in every page |
| 5-II | Bootstrap offline | `practicals/student-registration.html` uses `vendor/bootstrap/` |
| 5-III | Bootstrap registration form | `practicals/student-registration.html` (roll no., first name, mobile, email, address) |
| 6 | Tailwind CSS | `cart.html`, `wishlist.html`, `signin.html` |
| 7-I | Custom directive: uppercase on click | `v-uppercase` in `js/wishlist-vue.js` (click a product name) |
| 7-II | Dynamic list with a custom directive | Wishlist list (`v-for`, add / remove / filter / sort) with `v-highlight` |
| 7-III | Directive that formats dates | `v-date` / `v-date.relative` in `js/wishlist-vue.js` |

## Product photos

Each product in `data/products.json` has `"image"` (your own photo, empty by default) and `"wiki"` (the Wikipedia
article whose main photo is used automatically). The site looks the photos up once, in a single request, and remembers
them in Local Storage. Needs an internet connection the first time; if a photo can't load, the emoji is shown instead.

To use your own photo for a product, see **HOW-TO-CHANGE-IMAGES.md** (one command: `node node/set-image.js Peaches "photo.jpg"`).

## Notes

- Drag and Drop with a mouse works on desktop. HTML5 drag events don't fire from touch on phones, so every card also has normal Add and heart buttons.
- The navbar and footer are injected by `js/store.js` so they are identical on every page. Edit them in one place.
- Accounts: **Create Account** saves the user in Local Storage (`freshcart-users`, password stored only as a SHA-256 hash) and **Sign In** checks email + password.
  Every account has its **own** cart, wishlist, delivery place and orders (Local Storage keys end in `:<email>`); signed-out visitors use a separate `guest` set.
  It is still a browser-only demo, so accounts exist only in the browser where they were created.
  Data saved by the older version (one cart / wishlist shared by everybody) is removed automatically the first time a page loads.
- Nutrition values are approximate per 100 g.

## MySQL + RBAC practicals (I, II, 9)

See **DATABASE-SETUP.md** — `node/mysql-1.js`, `node/mysql-2.js`, `node/rbac.js`, `node/rbac-test.js`.
