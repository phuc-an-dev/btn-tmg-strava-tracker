import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as crypto from 'node:crypto';
import ts from 'typescript';
import {test} from 'node:test';
function fixture(error=null){
 const api={},calls=[],secret='test-only-sync-secret-with-32-characters';
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/api/extension/posts/complete/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
  exports:api,Buffer,Response,process:{env:{STRAVA_SYNC_SECRET:secret,NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'public-key'}},
  require:name=>name==='node:crypto'?crypto:{createClient:()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:{complete:true,hidden:1},error};}})},
 });
 const request=(body,authorization='Bearer '+secret,type='application/json')=>new Request('https://example.invalid/api/extension/posts/complete',{method:'POST',headers:{authorization,'content-type':type},body:typeof body==='string'?body:JSON.stringify(body)});
 return {...api,calls,request};
}
const scan={club_id:'2368312',complete:true,pages:1,post_ids:['123'],started_at:'2026-10-18T01:00:00Z',completed_at:'2026-10-18T01:01:00Z'};
test('finalization requires credentials, JSON and an explicitly complete club snapshot',async()=>{
 const f=fixture();
 assert.equal((await f.POST(f.request(scan,'Bearer wrong'))).status,401);
 assert.equal((await f.POST(f.request(scan,undefined,'text/plain'))).status,415);
 for(const body of ['{', {...scan,complete:false},{...scan,club_id:'other'},{...scan,post_ids:null}])assert.equal((await f.POST(f.request(body))).status,400);
 assert.equal(f.calls.length,0);
});
test('complete and empty scans use the scoped RPC; rate limits remain retryable',async()=>{
 const f=fixture();
 assert.equal((await f.POST(f.request({...scan,post_ids:[]}))).status,200);
 assert.equal(f.calls[0].name,'complete_extension_post_scan');
 assert.deepEqual(Array.from(f.calls[0].args.payload.post_ids),[]);
 assert.equal((await fixture({code:'PT429'}).POST(f.request(scan))).status,429);
});
test('oversized snapshots never reach the database',async()=>{
 const f=fixture();assert.equal((await f.POST(f.request(' '.repeat(1000001)))).status,413);assert.equal(f.calls.length,0);
});
