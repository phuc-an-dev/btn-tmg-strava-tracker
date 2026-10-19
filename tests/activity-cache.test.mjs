import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {test} from 'node:test';
function fixture(){
 const api={};let now=1000;
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/activity-cache.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:api,Date:{now:()=>now}});
 return {api,advance:ms=>now+=ms};
}
test('activity caches expire and are isolated by query and real account',()=>{
 const {api:c,advance}=fixture();c.setActivityCacheOwner('A');const epoch=c.activityCacheEpoch(),data={rows:[1]};
 c.setCachedMemberActivities('A','mine|1',data,epoch);
 c.setCachedAdminActivities('A','pending|1',data,epoch);
 assert.equal(c.getCachedMemberActivities('A','mine|1'),data);
 assert.equal(c.getCachedMemberActivities('A','mine|2'),undefined);
 assert.equal(c.getCachedMemberActivities('B','mine|1'),undefined);
 advance(30000);
 assert.equal(c.getCachedMemberActivities('A','mine|1'),undefined);
 assert.equal(c.getCachedAdminActivities('A','pending|1'),undefined);
});
test('logout, account switch and returning to the same account reject late responses',()=>{
 const {api:c}=fixture();c.setActivityCacheOwner('A');const old=c.activityCacheEpoch();
 c.setCachedMemberActivities('A','mine',{},old);c.setActivityCacheOwner(null);c.setActivityCacheOwner('B');
 c.setCachedMemberActivities('A','mine',{old:true},old);
 assert.equal(c.getCachedMemberActivities('B','mine'),undefined);
 c.setActivityCacheOwner('A');c.setCachedMemberActivities('A','mine',{old:true},old);
 assert.equal(c.getCachedMemberActivities('A','mine'),undefined);
});
test('review invalidation clears every activity query and rejects in-flight writes',()=>{
 const {api:c}=fixture();c.setActivityCacheOwner('A');const old=c.activityCacheEpoch();
 c.setCachedAdminActivities('A','pending',{},old);c.setCachedMemberActivities('A','mine',{},old);
 c.setCachedStatistics('A','groups|week|1',{},old);
 c.invalidateActivityData();c.setCachedAdminActivities('A','pending',{},old);
 assert.equal(c.getCachedAdminActivities('A','pending'),undefined);
 assert.equal(c.getCachedMemberActivities('A','mine'),undefined);
 assert.equal(c.getCachedStatistics('A','groups|week|1'),undefined);
 c.setCachedStatistics('A','groups|week|1',{stale:true},old);
 assert.equal(c.getCachedStatistics('A','groups|week|1'),undefined);
 c.setCachedAdminActivities('A','pending',{fresh:true},c.activityCacheEpoch());
 assert.equal(c.getCachedAdminActivities('A','pending').fresh,true);
});
