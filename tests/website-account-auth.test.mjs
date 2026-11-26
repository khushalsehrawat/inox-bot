import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/lib/website-account-auth.ts',import.meta.url),'utf8').replace('"./web-mysql.mjs"',JSON.stringify(new URL('../src/lib/web-mysql.mjs',import.meta.url).href));
const compiled = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const auth = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const signup={firstName:' Website ',email:'CUSTOMER@example.test',countryCode:'+91',mobile:'9876543210',companyName:' Example Ltd ',password:'Example123!',consentAccepted:true};
test('website signup validates required fields, normalizes email and saves optional company',()=>{
  const value=auth.accountInput(signup,true);
  assert.equal(value.email,'customer@example.test');assert.equal(value.firstName,'Website');assert.equal(value.companyName,'Example Ltd');assert.equal(value.lastName,'');
  for(const override of [{firstName:' '},{email:'bad'},{mobile:'123'},{password:'abcdefgh'},{consentAccepted:false},{companyName:'x'.repeat(201)}]) assert.throws(()=>auth.accountInput({...signup,...override},true),auth.AccountError);
  assert.throws(()=>auth.accountInput(null,true),auth.AccountError);
});
test('website password hashes are salted and reject incorrect credentials',async()=>{
  const a=await auth.hashPassword(signup.password),b=await auth.hashPassword(signup.password);
  assert.notEqual(a,b);assert.equal(await auth.checkPassword(signup.password,a),true);assert.equal(await auth.checkPassword('Incorrect123!',a),false);assert.equal(await auth.checkPassword(signup.password,'invalid'),false);
});
test('legacy app tokens cannot become website sessions',async()=>{
  assert.equal(await auth.sessionAccount('legacy.jwt.token'),null);assert.equal(await auth.sessionAccount(),null);
});
