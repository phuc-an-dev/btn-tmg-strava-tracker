import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import ts from 'typescript';
const api={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/contributions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:api});
test('each contribution uses the same aggregate denominator independently',()=>{
 assert.equal(api.contributionPercent(4000,100000),4);
 assert.equal(api.contributionPercent(18000,100000),18);
 assert.equal(api.contributionPercent(36000,100000),36);
 assert.equal(api.contributionPercent(null,100000),null);
 assert.equal(api.contributionPercent(0,100000),0);
 assert.equal(api.contributionPercent(0,0),null);
});
test('waffles preserve fractional contributions instead of rounding to whole cells',()=>{
 const percent=api.contributionPercent(35,10000);
 assert.equal(api.contributionLabel(percent),'0,35%');
 assert.ok(Math.abs(api.waffleCellFill(percent,0)-.35)<1e-12);
 assert.equal(api.waffleCellFill(percent,1),0);
 assert.equal(api.waffleCellFill(18.75,17),1);
 assert.equal(api.waffleCellFill(18.75,18),.75);
 assert.equal(api.waffleCellFill(18.75,19),0);
 assert.equal(api.contributionLabel(api.contributionPercent(1,1000000)),'<0,01%');
});
test('empty and unassigned data are not shown as misleading 0 percent shares',()=>{
 assert.equal(api.contributionLabel(null),'—');
 assert.equal(api.waffleCellFill(null,0),0);
 assert.equal(api.contributionPercent(100,0),null);
 assert.equal(api.contributionPercent(1,NaN),null);
 assert.equal(api.contributionPercent(NaN,100),null);
 assert.equal(api.waffleCellFill(100,99),1);
});

test('selection defaults to own entity, otherwise top one, while manual choices win',()=>{
 const choices=[{id:5,steps:900},{id:2,steps:200}];
 assert.equal(api.selectContributionChoice(choices,null,null).id,5);
 assert.equal(api.selectContributionChoice(choices,null,2).id,2);
 assert.equal(api.selectContributionChoice(choices,5,2).id,5);
 assert.equal(api.selectContributionChoice(choices,999,2).id,2);
 assert.equal(api.selectContributionChoice([],null,null),undefined);
});

test('comparison keeps up to five unique entities in selection order with defaults and legacy links',()=>{
 const choices=Array.from({length:7},(_,i)=>({id:i+1}));
 assert.deepEqual(Array.from(api.selectContributionChoices(choices,[3,1,3,2,4,5,6],null,7),c=>c.id),[3,1,2,4,5]);
 assert.deepEqual(Array.from(api.selectContributionChoices(choices,[],null,7),c=>c.id),[7]);
 assert.deepEqual(Array.from(api.selectContributionChoices(choices,[],null,null),c=>c.id),[1]);
 assert.deepEqual(Array.from(api.selectContributionChoices(choices,[],4,7),c=>c.id),[4]);
 assert.deepEqual(Array.from(api.selectContributionChoices(choices,[99],null,7),c=>c.id),[7]);
 assert.equal(api.selectContributionChoices([],[],null,null).length,0);
});
test('selection rejects a sixth entry and permits removal at the limit',()=>{
 assert.deepEqual(Array.from(api.toggleContributionSelection([1,2,3,4,5],6)),[1,2,3,4,5]);
 assert.deepEqual(Array.from(api.toggleContributionSelection([1,2,3,4,5],3)),[1,2,4,5]);
 assert.deepEqual(Array.from(api.toggleContributionSelection([1],2)),[1,2]);
});

test('one waffle stacks shares without overlaps and preserves fractional cells',()=>{
 const segments=api.waffleCellSegments([.35,.4,15],0);
 assert.equal(segments.length,3);
 assert.equal(segments[0].offset,0);
 assert.equal(segments[0].width,.35);
 assert.ok(Math.abs(segments[1].offset-.35)<1e-12);
 assert.ok(Math.abs(segments[1].width-.4)<1e-12);
 assert.equal(segments[2].offset,.75);
 assert.equal(segments[2].width,.25);
 assert.equal(api.waffleCellSegments([15,10,8],33).length,0);
 assert.equal(api.waffleCellSegments([15,10,8],32)[0].colorIndex,2);
});
test('full coverage leaves no gray and empty totals have no colored cells',()=>{
 for(let i=0;i<100;i++)assert.ok(Math.abs(api.waffleCellSegments([15.49,29.32,18.37,7.72,29.1],i).reduce((sum,s)=>sum+s.width,0)-1)<1e-12);
 assert.equal(api.waffleCellSegments([null,0,NaN],0).length,0);
 assert.equal(api.waffleCellSegments([100,20],99).length,1);
});

test('waffle fills biggest first, left to right then top to bottom; hiding preserves values and color indices',()=>{
 const shares=[{id:1,steps:10,index:0},{id:2,steps:30,index:1},{id:3,steps:20,index:2}];
 assert.deepEqual(Array.from(api.orderedContributionShares(shares),s=>s.id),[2,3,1]);
 const visible=api.orderedContributionShares(shares,[2]);
 assert.deepEqual(Array.from(visible,s=>s.id),[3,1]);
 assert.equal(visible[0].index,2);
 assert.equal(api.contributionPercent(visible[0].steps,100),20);
 assert.deepEqual({...api.waffleCellPosition(0)},{x:0,y:0});
 assert.deepEqual({...api.waffleCellPosition(9)},{x:90,y:0});
 assert.deepEqual({...api.waffleCellPosition(19)},{x:190,y:0});
 assert.deepEqual({...api.waffleCellPosition(20)},{x:0,y:10});
 assert.deepEqual({...api.waffleCellPosition(99)},{x:190,y:40});
 assert.deepEqual(shares.map(s=>s.id),[1,2,3]);
});
