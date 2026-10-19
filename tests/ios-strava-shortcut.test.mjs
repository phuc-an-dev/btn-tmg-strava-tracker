import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const script=fs.readFileSync('public/shortcuts/strava-activities.js.txt','utf8');
const makeEntry=(overrides={})=>({post:{id:11,post:'LD2_6_5148',date:'2026-10-18T10:00:00Z',shared_content_activity_stats:[{key:'stat_two_subtitle',value:'Steps'},{key:'stat_two',value:'5,148'}],shared_content_v2:[{__typename:'Activity',id:123,athlete:{id:456,firstName:'Test'},name:'LD2_6_5148',startLocal:'2026-10-18T12:00:00',activityKind:{sportType:'Walk'},scalars:{distance:2000,elapsedTime:1800}}],...overrides}});
function run({entries=[makeEntry()],href='https://www.strava.com/clubs/2368312/discussion',athlete='/athletes/456',status=200,type='application/json',data}={}) {
 const calls=[];
 const result=new Promise((resolve,reject)=>{
  const context={URL,URLSearchParams,AbortController,TextEncoder,setTimeout,clearTimeout,
   location:{href,origin:new URL(href).origin},document:{querySelectorAll:()=>athlete?[{getAttribute:()=>athlete}]:[]},
   fetch:async(url,options)=>{calls.push({url:String(url),options});return {ok:status>=200&&status<300,status,headers:{get:()=>type},json:async()=>data??{entries}};},completion:resolve};
  vm.runInNewContext(script,context).catch(reject);
 });
 return result.then(value=>({value,calls}));
}
test('Safari page prepares the existing payload without holding a sync secret or uploading',async()=>{
 const {value,calls}=await run();
 const payload=JSON.parse(value.body),row=payload.activities[0];
 assert.equal(payload.club_id,'2368312');assert.equal(value.activity_count,1);
 assert.equal(row.activity_id,'123');assert.equal(row.athlete_id,'456');
 assert.equal(row.steps,5148);assert.equal(row.people_count,6);assert.equal(row.status,'pending');
 assert.equal(calls.length,1);assert.match(calls[0].url,/^https:\/\/www.strava.com\/clubs\/2368312\/post_feed\?/);
 assert.equal(calls[0].options.credentials,'same-origin');
 assert.equal(calls[0].options.headers.Authorization,undefined);
 assert.doesNotMatch(script,/STRAVA_SYNC_SECRET|syncSecret|\/posts\/complete|document\.cookie/);
});
test('missing Steps remain null and duplicate attachments use one activity with all provenance',async()=>{
 const first=makeEntry({shared_content_activity_stats:[{key:'stat_two_subtitle',value:'Distance'},{key:'stat_two',value:'5.1 km'}]});
 const second=makeEntry();second.post.id=12;
 const {value}=await run({entries:[first,second]});
 const rows=JSON.parse(value.body).activities;
 assert.equal(rows.length,1);assert.equal(rows[0].steps,5148);assert.equal(rows[0].source_posts.length,2);
 const missing=await run({entries:[first]});
 assert.equal(JSON.parse(missing.value.body).activities[0].steps,null);
});
test('wrong origin, unknown account, auth failures and malformed feeds never produce an upload body',async()=>{
 for(const options of [{href:'https://example.com/clubs/2368312/discussion'},{href:'https://www.strava.com/clubs/999/discussion'},{athlete:null},{status:401},{status:429},{type:'text/html'},{data:{entries:null}}]) {
  const {value,calls}=await run(options);assert.equal(value.body,'');assert.ok(value.error);
  assert.ok(calls.every(call=>new URL(call.url).origin==='https://www.strava.com'));
 }
});
test('incomplete activity identities are excluded and empty or oversized batches stop before upload',async()=>{
 const invalid=makeEntry();delete invalid.post.shared_content_v2[0].athlete;
 // Use a separate activity ID so its unknown identity does not deduplicate the valid one.
 invalid.post.shared_content_v2[0].id=789;
 const filtered=await run({entries:[invalid,makeEntry()]});
 assert.equal(filtered.value.activity_count,1);assert.equal(filtered.value.skipped_count,1);
 const empty=await run({entries:[]});assert.equal(empty.value.body,'');
 const many=Array.from({length:51},(_,i)=>{const entry=makeEntry();entry.post.shared_content_v2[0].id=i+100;return entry;});
 assert.equal((await run({entries:many})).value.body,'');
 const huge=makeEntry({post:'x'.repeat(410000)});assert.equal((await run({entries:[huge]})).value.body,'');
});
