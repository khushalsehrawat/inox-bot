import type { Pool, PoolConnection } from 'mysql2/promise';
export function websitePool(): Pool;
export function mysqlTransaction<T>(work: (connection: PoolConnection) => Promise<T>): Promise<T>;
