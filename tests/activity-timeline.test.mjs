import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import ts from 'typescript';
const api={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/activity-timeline.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:api});
test('groups current-page activities by local day and sorts newest first without mutating input',()=>{
 const rows=[{id:1,date:'2026-10-12T23:00:00'},{id:2,date:'2026-10-13T12:00:00'},{id:3,date:'2026-10-13T21:08:00'},{id:4,date:null}];
 const groups=api.groupActivityDays(rows,r=>r.date);
 assert.deepEqual(Array.from(groups,g=>g.date),['2026-10-13','2026-10-12','']);
 assert.deepEqual(Array.from(groups[0].rows,r=>r.id),[3,2]);
 assert.deepEqual(rows.map(r=>r.id),[1,2,3,4]);
 assert.equal(api.groupActivityDays([],r=>r.date).length,0);
});
test('post grouping uses Vietnam day at midnight boundaries and handles missing timestamps',()=>{
 assert.equal(api.postVietnamTimestamp('2026-10-12T17:01:00Z').slice(0,10),'2026-10-13');
 assert.equal(api.postVietnamTimestamp('2026-10-12T16:59:00Z').slice(0,10),'2026-10-12');
 assert.equal(api.postVietnamTimestamp(null),'');
 assert.equal(api.postVietnamTimestamp('invalid'),'');
});

test('nested groups require the same division, group and people count; singles and unknown counts stay separate',()=>{
 const rows=[
  {id:1,division_id:2,group_id:7,people_count:8},
  {id:2,division_id:2,group_id:7,people_count:1},
  {id:3,division_id:2,group_id:7,people_count:8},
  {id:4,division_id:2,group_id:7,people_count:3},
  {id:5,division_id:2,group_id:8,people_count:8},
  {id:6,division_id:3,group_id:7,people_count:8},
  {id:7,division_id:2,group_id:7,people_count:null},
  {id:8,division_id:2,group_id:7,people_count:0},
 ];
 const groups=api.groupCompanionActivities(rows);
 assert.deepEqual(Array.from(groups[0].rows,r=>r.id),[1,3]);
 assert.match(groups[0].label,/LĐ 2 · Nhóm 7 · 8 người/);
 assert.equal(groups.length,6);
 assert.deepEqual(Array.from(groups[4].rows,r=>r.id),[2]);
 assert.deepEqual(Array.from(groups[5].rows,r=>r.id),[7,8]);
 assert.equal(rows.length,8);
});
test('companions are grouped inside each day, not merged across dates',()=>{
 const rows=['2026-10-13T21:00:00','2026-10-12T21:00:00'].map(date=>({date,division_id:2,group_id:7,people_count:8}));
 const days=api.groupActivityDays(rows,r=>r.date);
 assert.equal(days.length,2);
 for(const day of days)assert.equal(api.groupCompanionActivities(day.rows)[0].rows.length,1);
 assert.equal(api.groupCompanionActivities([]).length,0);
});
