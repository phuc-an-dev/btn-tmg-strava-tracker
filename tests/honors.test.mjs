import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const api={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/honors.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:api});
test('reveal starts at third and ends at first; sparse results never invent winners',()=>{
 for(const [count,expected] of [[0,[]],[1,[1]],[2,[2,1]],[3,[3,2,1]],[5,[3,2,1]]])assert.deepEqual(Array.from(api.honorRevealOrder(count)),expected);
});
test('individual affiliation supports missing division and group; division has no member identity',()=>{
 assert.equal(api.honorDetail({division_id:2,group_id:4},'individuals'),'LĐ 2 · Nhóm 4');
 assert.equal(api.honorDetail({division_id:null,group_id:null},'individuals'),'Chưa phân LĐ');
 assert.equal(api.honorDetail({},'divisions'),'');
});
test('name is shown alone first, then the integer score rises and finishes exactly',()=>{
 for(const score of [1,106542,139280,485844]){
  assert.equal(api.honorScoreAt(0,score),null);
  assert.equal(api.honorScoreAt(599,score),null);
  assert.equal(api.honorScoreAt(600,score),0);
  const values=Array.from({length:101},(_,i)=>api.honorScoreAt(600+i*16,score));
  assert.ok(values.every((n,i)=>Number.isInteger(n)&&n>=0&&n<=score&&(i===0||n>=values[i-1])));
  assert.ok(values.slice(0,-1).every(n=>n<score));
  assert.equal(api.honorScoreAt(2200,score),score);
  assert.equal(api.honorScoreAt(5000,score),score);
  assert.equal(api.honorScoreAt(0,score,true),score);
 }
});
