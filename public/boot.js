// GitHub Pages has no rewrites: every unknown path gets the root app's
// 404.html, deep links into the demo (/jf-chat/demo/chat, a reload there)
// included. The published 404.html names the nested app in a meta tag; for
// those paths we hand over to the nested app's root carrying the path, and
// there it is restored before Angular reads the URL.
(function () {
  try {
    var base = new URL(document.baseURI).pathname;
    var wanted = new URLSearchParams(location.search).get('__r');
    if (wanted !== null) {
      // Same origin only, and only paths inside this app.
      history.replaceState(history.state, '', wanted.indexOf(base) === 0 ? wanted : base);
      return;
    }
    var nested = document.querySelector('meta[name="velo-nested-app"]');
    var prefix = nested && nested.getAttribute('content');
    if (prefix && location.pathname.indexOf(prefix) === 0 && location.pathname !== prefix) {
      document.documentElement.style.visibility = 'hidden';
      location.replace(prefix + '?__r=' + encodeURIComponent(location.pathname + location.search + location.hash));
    }
  } catch (e) {}
})();

// Runs before the first paint (an external file, so the CSP needs no
// 'unsafe-inline'): dark theme by default and the discreet identity
// ("Notas") when the user chose it, so not even the tab title flashes.
(function () {
  try {
    var saved = localStorage.getItem('velo.theme');
    var dark = saved ? saved === 'dark' : true;
    if (dark) document.documentElement.classList.add('dark');
    if (localStorage.getItem('velo.disguise') === '1') {
      document.title = 'Notas';
      var icon = document.querySelector('link[rel="icon"]');
      if (icon) icon.setAttribute('href', 'icons/notas.ico');
      var apple = document.querySelector('link[rel="apple-touch-icon"]');
      if (apple) apple.setAttribute('href', 'icons/notas-180.png');
      var manifest = document.querySelector('link[rel="manifest"]');
      if (manifest) manifest.setAttribute('href', 'manifest-discreto.webmanifest');
      var meta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
      if (meta) meta.setAttribute('content', 'Notas');
    }
  } catch (e) {}
})();
