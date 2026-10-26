// Aplica o tema salvo antes do React carregar, para a tela não piscar em claro
// no modo escuro. Fica num arquivo (e não inline no index.html) para passar
// numa Content-Security-Policy com script-src 'self'.
// A chave e as classes são as mesmas do ThemeProvider (src/main.tsx).
try {
  var theme = localStorage.getItem('deskflow-theme') || 'system';
  if (theme === 'system') {
    theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.classList.add(theme);
  document.documentElement.style.colorScheme = theme;
} catch {
  // Sem acesso ao localStorage (modo restrito do navegador): o React aplica o tema ao carregar.
}
