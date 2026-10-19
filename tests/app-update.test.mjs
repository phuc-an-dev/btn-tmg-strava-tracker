import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import ts from 'typescript';

const api={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/app-version.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:api,process:{env:{}}});
test('only deployment identifiers are accepted, not unexpected version payloads',()=>{
 assert.equal(api.isAppVersion('1a2b3c4d5e6f'),true);
 for(const value of [null,{},12,'','development','<html>bad gateway</html>','https://other.test','1a2b3c4d5e6fg'])assert.equal(api.isAppVersion(value),false);
});
test('a cached old bundle cannot cause repeated automatic reloads for the same update',()=>{
 const attempt={from:'aaaaaaaaaaaa',to:'bbbbbbbbbbbb',at:100_000};
 assert.equal(api.mayRetryUpdate(null,attempt.from,attempt.to,100_000),true);
 assert.equal(api.mayRetryUpdate(attempt,attempt.from,attempt.to,100_001),false);
 assert.equal(api.mayRetryUpdate(attempt,attempt.from,attempt.to,160_000),false);
 assert.equal(api.mayRetryUpdate(attempt,attempt.from,attempt.to,160_001),false);
 assert.equal(api.mayRetryUpdate(attempt,attempt.from,attempt.to,160_001,true),true);
 assert.equal(api.mayRetryUpdate(attempt,attempt.from,attempt.to,100_001,true),false);
 assert.equal(api.mayRetryUpdate(attempt,attempt.from,'cccccccccccc',100_001),true);
 assert.equal(api.mayRetryUpdate(attempt,'bbbbbbbbbbbb','cccccccccccc',100_001),true);
});
