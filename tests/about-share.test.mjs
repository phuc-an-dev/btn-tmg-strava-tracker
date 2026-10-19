import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import ts from 'typescript';
const api={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/about-share.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:api,URL,require:()=>({siteUrl:'https://btn-tmg-strava-tracker.vercel.app'})});
const {shareAbout,aboutShare}=api;
test('native share receives canonical about URL without copying',async()=>{
 let shared;
 assert.equal(await shareAbout({share:async data=>{shared=data;},clipboard:{writeText:async()=>assert.fail('Unexpected copy')}}),'shared');
 assert.equal(shared.url,'https://btn-tmg-strava-tracker.vercel.app/about');
 assert.equal(shared.title,aboutShare.title);
});
test('cancelling native share does not silently copy',async()=>{
 assert.equal(await shareAbout({share:async()=>{throw {name:'AbortError'};},clipboard:{writeText:async()=>assert.fail('Unexpected copy')}}),'cancelled');
});
test('unsupported or failed native sharing copies the URL',async()=>{
 for(const share of [undefined,async()=>{throw {name:'NotAllowedError'};}]){
  let copied;
  assert.equal(await shareAbout({share,clipboard:{writeText:async text=>{copied=text;}}}),'copied');
  assert.equal(copied,aboutShare.url);
 }
});
test('clipboard denial and missing APIs offer manual copying',async()=>{
 assert.equal(await shareAbout({clipboard:{writeText:async()=>{throw new Error('denied');}}}),'manual');
 assert.equal(await shareAbout({}),'manual');
});
