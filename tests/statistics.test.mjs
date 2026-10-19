import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRequire} from 'node:module';
const api={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/statistics.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:api});
test('selection URLs allow at most five unique positive numeric IDs',()=>{
 assert.deepEqual(Array.from(api.statisticsIds('1,2,3,4,5')),[1,2,3,4,5]);
 assert.deepEqual(Array.from(api.statisticsIds('')),[]);
 for(const s of ['1,2,3,4,5,6','1,1','0','-1','NaN','1.2','1,','1000000000000000'])assert.equal(api.statisticsIds(s),null);
});
test('daily and cumulative series preserve zero days, future gaps and independent totals',()=>{
 const data={today:'2026-10-15',days:['2026-10-12','2026-10-13','2026-10-14','2026-10-15'],series:[{values:[10,20,0,null]},{values:[5,0,10,null]}]};
 const before=JSON.stringify(data);
 const daily=api.chartRows(data,'daily'),cumulative=api.chartRows(data,'cumulative');
 assert.deepEqual(Array.from(daily,r=>r.s0),[10,20,0,null]);
 assert.deepEqual(Array.from(cumulative,r=>r.s0),[10,30,30,null]);
 assert.deepEqual(Array.from(cumulative,r=>r.s1),[5,5,15,null]);
 assert.equal(JSON.stringify(data),before);
});
test('both chart modes exclude current and future dates even if those dates contain steps',()=>{
 const data={today:'2026-10-16',days:['2026-10-14','2026-10-15','2026-10-16','2026-10-17'],series:[{values:[100,0,9000,10000]}]};
 assert.deepEqual(Array.from(api.chartRows(data,'daily'),r=>r.s0),[100,0,null,null]);
 assert.deepEqual(Array.from(api.chartRows(data,'cumulative'),r=>r.s0),[100,100,null,null]);
 assert.equal(api.lastStatisticsDay(data),1);
});
test('detail order follows selected date and mode while retaining original color indices',()=>{
 const data={today:'2026-10-16',days:['2026-10-13','2026-10-14','2026-10-15'],series:[{id:1,total:110,values:[100,0,10]},{id:2,total:105,values:[0,100,5]},{id:3,total:25,values:[5,0,20]}]};
 const before=JSON.stringify(data),daily=api.chartRows(data,'daily'),cumulative=api.chartRows(data,'cumulative');
 const ids=row=>Array.from(api.orderedStatisticsSeries(data,row),s=>s.series.id);
 assert.deepEqual(ids(daily[0]),[1,3,2]);
 assert.deepEqual(ids(daily[1]),[2,1,3]);
 assert.deepEqual(ids(daily[2]),[3,1,2]);
 assert.deepEqual(ids(cumulative[2]),[1,2,3]);
 assert.deepEqual(Array.from(api.orderedStatisticsSeries(data,daily[2]),s=>s.index),[2,0,1]);
 assert.deepEqual(ids({s0:null,s1:0,s2:5}),[3,2,1]);
 assert.equal(JSON.stringify(data),before);
});
test('day selection has no valid date at the start of a week or before the event',()=>{
 assert.equal(api.lastStatisticsDay({today:'2026-10-19',days:['2026-10-19','2026-10-20'],series:[{values:[0,null]}]}),-1);
 assert.equal(api.lastStatisticsDay({today:'2026-10-04',days:['2026-09-30','2026-10-01','2026-10-02','2026-10-03'],series:[{values:[null,null,null,null]}]}),-1);
});
test('four step ticks always cover the data and four date ticks include both ends',()=>{
 for(const max of [0,1,4,2866,100000,1013132,100000000]){
  const ticks=Array.from(api.stepTicks(max));
  assert.equal(ticks.length,4);assert.equal(ticks[0],0);assert.ok(ticks[3]>=max);
  assert.equal(new Set(ticks).size,4);assert.ok(ticks.every(Number.isInteger));
 }
 for(const length of [4,7,13,43]){
  const ticks=Array.from(api.dateTicks(length));assert.equal(ticks.length,4);assert.equal(ticks[0],0);assert.equal(ticks[3],length-1);
 }
});
test('short weeks have one tick per available day and empty weeks have none',()=>{
 assert.deepEqual(Array.from(api.dateTicks(0)),[]);
 assert.deepEqual(Array.from(api.dateTicks(1)),[0]);
 assert.deepEqual(Array.from(api.dateTicks(2)),[0,1]);
 assert.deepEqual(Array.from(api.dateTicks(3)),[0,1,2]);
 assert.equal(api.lastStatisticsDay({today:'2026-10-18',days:[],series:[{values:[]}]}),-1);
});
const requireModule=createRequire(import.meta.url);
function component(file,mocks={}){
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>mocks[n]??requireModule(n)});
 return exports;
}
const nav=component('src/components/portal-navigation.tsx',{'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)}});
test('bottom navigation has four identical destinations for every role; Members and Audit stay out',()=>{
 for(const role of ['admin','user','leader',undefined]){
  const html=renderToStaticMarkup(React.createElement(nav.PortalNavigation,{section:'statistics',role}));
  assert.deepEqual([...html.matchAll(/href="([^"]+)"/g)].map(match=>match[1]),['/activities','/rankings','/statistics','/contributions']);assert.match(html,/href="\/statistics" aria-current="page"/);assert.doesNotMatch(html,/href="\/members"|href="\/audit"|href="\/division"/);
 }
});
const skeleton=component('src/components/statistics-skeleton.tsx');
test('statistics skeleton keeps the chart height and shared card/control layout',()=>{
 const html=renderToStaticMarkup(React.createElement(skeleton.StatisticsSkeleton));
 assert.match(html,/aria-label="Đang tải thống kê"/);assert.match(html,/statistics-card/);assert.match(html,/statistics-chart-skeleton/);assert.match(html,/statistics-skeleton-tabs/);
});
