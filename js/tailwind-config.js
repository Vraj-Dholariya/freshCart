/* ============================================================
   freshcart — js/tailwind-config.js
   TAILWIND half of the project. Pages that use Tailwind
   (cart.html, wishlist.html, signin.html) load the Tailwind CDN
   script first, then this file, which registers the brand colors
   and fonts so utilities like  bg-forest  text-leaf  font-display
   work everywhere.

   preflight is switched OFF so Tailwind doesn't reset the Bootstrap
   navbar that is shared by every page.
   ============================================================ */
tailwind.config = {
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        forest: '#14311F',
        leaf: '#6BAA75',
        'leaf-dark': '#3F7A4B',
        citrus: '#F2A93B',
        paper: '#F7F3E8',
        tomato: '#D64545'
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        body: ['Work Sans', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace']
      }
    }
  }
};
