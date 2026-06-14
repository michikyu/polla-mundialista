// Título de la app. Neutro por defecto para que el repo sea un template reutilizable.
// Personalízalo con la variable de entorno VITE_APP_TITLE (en Vercel o en .env.local).
export const APP_TITLE = import.meta.env.VITE_APP_TITLE?.trim() || 'Polla Mundialística';
