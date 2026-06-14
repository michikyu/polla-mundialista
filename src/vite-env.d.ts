/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE?: string;
  // 'true' habilita el mini-juego. Vive en .env.local (no se sube a GitHub),
  // así el juego es solo para tu sitio y no para quien descargue el repo.
  readonly VITE_ENABLE_GAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
