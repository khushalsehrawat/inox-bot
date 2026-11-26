// A missing driver must not hide the connected catalogue behind an empty local DB.
export function catalogueDriver(env = process.env) {
  const configured = env.WEB_DATABASE_DRIVER?.trim();
  if (configured && !['mysql', 'sqlite'].includes(configured)) {
    throw new Error('WEB_DATABASE_DRIVER must be mysql or sqlite.');
  }
  const driver = configured || (env.NODE_ENV === 'production' ||
    ['WEB_MYSQL_HOST', 'WEB_MYSQL_DATABASE', 'WEB_MYSQL_USER', 'WEB_MYSQL_PASSWORD'].some(key => env[key])
    ? 'mysql' : 'sqlite');
  if (env.NODE_ENV === 'production' && driver !== 'mysql') {
    throw new Error('Production requires WEB_DATABASE_DRIVER=mysql.');
  }
  return driver;
}
