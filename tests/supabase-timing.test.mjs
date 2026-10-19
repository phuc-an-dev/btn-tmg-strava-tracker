import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {test} from 'node:test';
function fixture({fetchError=false,timingError=false}={}){
 const api={},names=[];let request;
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/supabase.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{
  exports:api,URL,Request,process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://test.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'public-key'}},
  require:()=>({createClient:(_url,_key,options)=>{request=options.global.fetch;return {};}}),
  performance:{now:()=>100,getEntriesByName:()=>[],measure:name=>{if(timingError)throw new Error('Not supported');names.push(name);}},
  fetch:async()=>{if(fetchError)throw new Error('Offline');return {status:200};},
 });api.getSupabase();return {fetch:(...args)=>request(...args),names};
}
test('RPC timing contains only the function name, without URL parameters or body',async()=>{
 const f=fixture();await f.fetch('https://test.supabase.co/rest/v1/rpc/get_member_activities?q=private-value',{body:'sensitive body'});
 assert.deepEqual(f.names,['supabase:rpc:get_member_activities']);
 await f.fetch('https://test.supabase.co/auth/v1/token');assert.equal(f.names.length,1);
});
test('unsupported User Timing never turns a successful RPC into an error',async()=>{
 const f=fixture({timingError:true});assert.equal((await f.fetch('https://test.supabase.co/rest/v1/rpc/get_rankings')).status,200);
});
test('network errors keep their original error even when timing is unavailable',async()=>{
 const f=fixture({fetchError:true,timingError:true});await assert.rejects(f.fetch('https://test.supabase.co/rest/v1/rpc/get_rankings'),/Offline/);
});
