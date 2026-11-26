import mysql from 'mysql2/promise';
import { readFileSync } from 'node:fs';
let pool;
export function websitePool() {
  if (pool) return pool;
  for (const key of ['WEB_MYSQL_HOST', 'WEB_MYSQL_DATABASE', 'WEB_MYSQL_USER', 'WEB_MYSQL_PASSWORD']) if (!process.env[key]) throw new Error(`Missing ${key}`);
  pool = mysql.createPool({ host: process.env.WEB_MYSQL_HOST, port: Number(process.env.WEB_MYSQL_PORT || 3306), database: process.env.WEB_MYSQL_DATABASE, user: process.env.WEB_MYSQL_USER, password: process.env.WEB_MYSQL_PASSWORD, connectionLimit: 5, waitForConnections: true, queueLimit: 100, connectTimeout: 10000, charset: 'utf8mb4', multipleStatements: false, ssl: process.env.WEB_MYSQL_SSL_CA ? { ca: readFileSync(process.env.WEB_MYSQL_SSL_CA), rejectUnauthorized: true } : undefined });
  return pool;
}
export async function mysqlTransaction(work) {
  const connection = await websitePool().getConnection();
  try { await connection.beginTransaction(); const result = await work(connection); await connection.commit(); return result; }
  catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}
