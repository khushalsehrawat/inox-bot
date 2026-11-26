// Explicit live smoke check: creates one random website-only account, then removes it.
import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import nextEnv from '@next/env';
import { websitePool } from '../src/lib/web-mysql.mjs';
nextEnv.loadEnvConfig(process.cwd());
const source=fs.readFileSync('src/lib/website-account-auth.ts','utf8').replace('"./web-mysql.mjs"',JSON.stringify(new URL('../src/lib/web-mysql.mjs',import.meta.url).href));
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const auth=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const email=`web-auth-check-${randomUUID()}@example.test`;
const input=auth.accountInput({firstName:'Website smoke check',lastName:'',email,countryCode:'+91',mobile:'9876543210',companyName:'Website test company',password:`Test9!${randomUUID()}`,consentAccepted:true},true);
const pool=websitePool();
try {
  await auth.limitAccount('register',email);
  await auth.registerAccount(input);
  await assert.rejects(()=>auth.registerAccount(input),e=>e.status===409);
  await assert.rejects(()=>auth.loginAccount({...input,password:'Wrong123!'}),e=>e.status===401);
  const {token,user}=await auth.loginAccount(input);
  assert.equal(user.profile.companyName,input.companyName);
  assert.equal((await auth.sessionAccount(token)).email,email);
  const [rows]=await pool.execute('SELECT password_hash FROM web_users WHERE email=?',[email]);
  assert.notEqual(rows[0].password_hash,input.password);
  await auth.logoutAccount(token);assert.equal(await auth.sessionAccount(token),null);
  const expired=await auth.loginAccount(input);
  await pool.execute('UPDATE web_user_sessions SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE token_hash=?',[auth.digest(expired.token)]);
  assert.equal(await auth.sessionAccount(expired.token),null);
  for(let i=0;i<10;i++) await auth.limitAccount('login',email);
  await assert.rejects(()=>auth.limitAccount('login',email),e=>e.status===429);
  console.log('PASS: website signup, company storage, duplicate protection, password verification, login, session expiry, logout and throttling. No app tables accessed.');
} finally {
  // Delete only this randomly named test identity and its own related records.
  const [users]=await pool.execute('SELECT id FROM web_users WHERE email=?',[email]);
  for(const user of users) await pool.execute('DELETE FROM web_customers WHERE id=?',[user.id]);
  await pool.execute('DELETE FROM web_users WHERE email=?',[email]);
  await pool.execute('DELETE FROM web_auth_limits WHERE bucket IN (?,?)',[auth.digest(`register:${email}`),auth.digest(`login:${email}`)]);
  await pool.end();
}
