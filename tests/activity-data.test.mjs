import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../src/lib/activity-data.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const exports={};vm.runInNewContext(code,{exports});
test('event boundaries are inclusive and Run never eligible',()=>{
 for(const day of ['2026-10-04','2026-11-15'])assert.equal(exports.inEvent({start_local:day+'T23:59:59',sport_type:'Walk'}),true);
 assert.equal(exports.inEvent({start_local:'2026-11-16T00:00:00',sport_type:'Walk'}),false);
 assert.equal(exports.inEvent({start_local:'2026-10-04T12:00:00',sport_type:'Run'}),false);
});
test('unreviewed estimates use agreed bonus and never invent missing steps',()=>{
 assert.equal(exports.proposedPoints(6000,10),12000);
 assert.equal(exports.proposedPoints(6000,1),6000);
 assert.equal(exports.proposedPoints(null,10),null);
 assert.equal(exports.proposedPoints(6000,null),null);
});
test('import validates club, source shape and retains excluded records',()=>{
 const row={activity_id:'1',athlete_id:'2',start_local:'2026-10-10T12:00:00'};
 assert.equal(exports.parseActivityImport({club_id:'2368312',activities:[row],excluded:[{...row,activity_id:'3'}]}).activities.length,2);
 assert.throws(()=>exports.parseActivityImport({club_id:'123',activities:[row]}));
 assert.throws(()=>exports.parseActivityImport({club_id:'2368312',entries:[]}));
 assert.throws(()=>exports.parseActivityImport({club_id:'2368312',activities:[{activity_id:'1'}]}));
});
