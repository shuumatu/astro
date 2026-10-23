(function () {
  var theme = null
  try {
    var saved = window.localStorage.getItem('astro-theme')
    if (saved === 'dark' || saved === 'light') theme = saved
  } catch (_) {
    // Theme selection must not prevent startup when storage is blocked.
  }
  if (!theme) {
    try {
      theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light' : 'dark'
    } catch (_) {
      theme = 'dark'
    }
  }
  document.documentElement.dataset.theme = theme
  var meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'light' ? '#f5f6fa' : '#090e1b')
})()
