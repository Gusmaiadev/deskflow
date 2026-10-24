// O access token fica só na memória da aba (uma variável), nunca no localStorage.
// Um script malicioso injetado na página conseguiria ler o localStorage; esta variável
// some quando a aba fecha. Para sobreviver ao F5, a sessão é refeita pelo refresh token,
// que está num cookie httpOnly que nenhum JavaScript consegue ler.

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

// Avisos de "a sessão acabou", para quem estiver ouvindo (o AuthProvider).
type Listener = () => void;
const listeners = new Set<Listener>();

export function onSessionExpired(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifySessionExpired(): void {
  for (const listener of listeners) listener();
}
