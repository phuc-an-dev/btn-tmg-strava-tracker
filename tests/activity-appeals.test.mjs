import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const api={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/activity-appeals.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:api,Date});
test('appeal values reject fractional, empty, negative and out-of-range inputs',()=>{
 assert.equal(api.validAppealValues('0','1','4:2'),true);
 assert.equal(api.validAppealValues('1000000','100','10:5'),true);
 for(const [steps,people,pair] of [['','1','4:2'],['-1','1','4:2'],['1.5','1','4:2'],['1000001','1','4:2'],['10','0','4:2'],['10','101','4:2'],['10','1','null:null']])assert.equal(api.validAppealValues(steps,people,pair),false);
});
test('group selection preserves historical activity attribution when a group moves divisions',()=>{
 const options=api.appealGroupOptions([{id:4,name:'Nhóm 4',division_id:3}],{group_id:4,division_id:2});
 assert.deepEqual(Array.from(options,o=>o.value),['4:2','4:3']);
 assert.match(options[0].label,/đã ghi nhận/);
 assert.equal(api.appealGroupOptions([{id:4,name:'Nhóm 4',division_id:2}],{group_id:4,division_id:2}).length,1);
});
test('appeal input feedback identifies the people limit separately from the step limit',()=>{
 assert.equal(api.appealInputError('1000000','steps'),'');
 assert.match(api.appealInputError('1000000','people'),/1 đến 100/);
 assert.equal(api.appealInputError('100','people'),'');
 for(const value of ['','0','1.5','101'])assert.notEqual(api.appealInputError(value,'people'),'');
 assert.match(api.appealInputError('1000001','steps'),/1\.000\.000/);
});
