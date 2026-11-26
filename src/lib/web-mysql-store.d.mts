import type { openTaxonomy } from './web-taxonomy-store.mjs';
type Store = ReturnType<typeof openTaxonomy>;
export type AsyncStore = { [K in keyof Store]: (...args: Parameters<Store[K]>) => Promise<ReturnType<Store[K]>> };
export function mysqlStore(connection?: import("mysql2/promise").PoolConnection): AsyncStore;
