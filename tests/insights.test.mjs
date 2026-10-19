import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {test} from 'node:test';
const api={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/insights.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:api,URL});

test('insights strip search values and auth fragments without changing route or metric fields',()=>{
 const event={type:'pageview',url:'https://revive.example/activities?search=private-name&email=private%40example.com#access_token=secret',metric:'LCP',value:1200};
 const result=api.redactInsightUrl(event);
 assert.equal(result.url,'https://revive.example/activities');
 assert.equal(result.type,event.type);assert.equal(result.metric,event.metric);assert.equal(result.value,event.value);
 assert.ok(event.url.includes('private-name'));
});

test('insights preserve a clean public URL',()=>{
 assert.equal(api.redactInsightUrl({type:'pageview',url:'https://revive.example/about'}).url,'https://revive.example/about');
});
