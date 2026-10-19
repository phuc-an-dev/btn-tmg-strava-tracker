import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/signup-selection.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,URL});
test('manual Strava profiles accept canonical athlete links and reject activity/foreign links',()=>{
 assert.equal(exports.stravaProfileId(' https://www.strava.com/athletes/123456?utm_source=share '),123456);
 assert.equal(exports.stravaProfileId('https://strava.com/athletes/123456/'),123456);
 for(const value of ['https://www.strava.com/activities/123456','https://strava.com.evil.test/athletes/123','javascript:alert(1)','http://strava.com/athletes/123','https://user@strava.com/athletes/123','https://strava.com/athletes/0','https://strava.com/athletes/1234567890123456'])assert.equal(exports.stravaProfileId(value),null);
 assert.equal(exports.stravaProfileUrl(123456),'https://www.strava.com/athletes/123456');
});
