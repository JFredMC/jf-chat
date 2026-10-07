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
