export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (
  import.meta.env.DEV ? 'http://localhost:5000' : window.location.origin
);

