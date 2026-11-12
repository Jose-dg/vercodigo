/** Limits for platform bulk card activation, shared by the API and the page. */
export const BULK_ACTIVATION_MAX_CARDS = 500;
/** Cards per request: each one is a synchronous Diem call, so 10 fits any Vercel plan. */
export const BULK_ACTIVATION_CHUNK_SIZE = 10;
