import PocketBase from 'pocketbase';

// Même origine : Caddy (prod) ou proxy Vite (dev)
export const pb = new PocketBase(typeof window === 'undefined' ? 'http://localhost' : window.location.origin);
pb.autoCancellation(false);

export const estConnecte = () => pb.authStore.isValid;
