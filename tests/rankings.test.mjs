import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/rankings.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
test('dense ranks preserve ties, do not mutate input, and use the supplied score',()=>{
 const rows=[{steps:20,points:40},{steps:30,points:30},{steps:30,points:60},{steps:10,points:10}];
 const result=exports.ranked(rows,r=>r.steps);assert.deepEqual(Array.from(result,r=>r.rank),[1,1,2,3]);assert.equal(rows[0].steps,20);
 assert.equal(exports.ranked(rows,r=>r.points)[0].points,60);
});
test('badges use lifetime approved steps and distinct participating days',()=>{
 const badge=exports.earnedBadges({activities:1,lifetime_steps:100000,lifetime_days:7});
 assert.deepEqual(Array.from(badge),['100K bước','Bền bỉ · 7 ngày','Khởi động']);
 assert.deepEqual(Array.from(exports.earnedBadges({activities:0,lifetime_steps:0,lifetime_days:0})),[]);
 assert.equal(exports.participation({members:0,participants:0}),0);assert.equal(exports.participation({members:3,participants:1}),33);
});
test('highest step milestone is shown first without lower duplicate milestones',()=>{
 for(const [steps,label] of [[50000,'50K bước'],[199999,'100K bước'],[200000,'200K bước']]){
  assert.deepEqual(Array.from(exports.earnedBadges({activities:1,lifetime_steps:steps,lifetime_days:7})),[label,'Bền bỉ · 7 ngày','Khởi động']);
 }
});
test('post display titles hide URLs and keep a usable label for link-only posts',()=>{
 assert.equal(exports.postDisplayTitle('LĐ 1 - 1 - 8286\nhttps://strava.app.link/07Aleyp2a7b'),'LĐ 1 - 1 - 8286');
 assert.equal(exports.postDisplayTitle('https://strava.app.link/abc'),'Bài chia sẻ hoạt động');
 assert.equal(exports.postDisplayTitle('Đi bộ buổi khuya!!'),'Đi bộ buổi khuya!!');
});

const person=(id,steps,group,division,extra={})=>({athlete_id:id,name:`Member ${id}`,steps,group_id:group,division_id:division,gender:'male',is_me:false,...extra});
test('personal scopes filter current group or division before ranking and gender selection',()=>{
 const rows=[person(1,100,1,1),person(2,70,2,1),person(3,60,1,1,{is_me:true}),person(4,200,3,2),person(5,90,1,1,{gender:'female'})];
 const before=JSON.stringify(rows),member={group_id:1,division_id:1};
 const group=exports.individualRankings(rows,'group',member,'');
 assert.deepEqual(Array.from(group,r=>[r.athlete_id,r.rank]),[[1,1],[5,2],[3,3]]);
 const division=exports.individualRankings(rows,'division',member,'');
 assert.deepEqual(Array.from(division,r=>r.athlete_id),[1,5,2,3]);
 assert.deepEqual(Array.from(exports.individualRankings(rows,'group',member,'male'),r=>r.rank),[1,2]);
 assert.equal(exports.ownRankingPosition(exports.individualRankings(rows,'group',member,'female')),null);
 assert.equal(exports.individualRankings(rows,'all',member,'')[0].athlete_id,4);
 assert.equal(JSON.stringify(rows),before);
});
test('unlinked or unassigned members cannot activate personal scopes through a URL',()=>{
 for(const within of ['group','division']){
  assert.equal(exports.availableRankingWithin(within,undefined),'all');
  assert.equal(exports.availableRankingWithin(within,{group_id:null,division_id:null}),'all');
 }
 assert.equal(exports.availableRankingWithin('division',{group_id:null,division_id:2}),'division');
 assert.equal(exports.availableRankingWithin('group',{group_id:null,division_id:2}),'all');
 const rows=[person(1,10,null,null),person(2,20,1,1)];
 assert.equal(exports.individualRankings(rows,'group',undefined,'').length,2);
});
test('own position skips tied peers for the gap and uses row index for pagination',()=>{
 const rows=Array.from({length:12},(_,i)=>person(i+1,i===0?200:100,1,1,{is_me:i===11}));
 const position=exports.ownRankingPosition(exports.individualRankings(rows,'all',undefined,''));
 assert.equal(position.own.rank,2);assert.equal(position.page,2);
 assert.equal(position.above.rank,1);assert.equal(position.gap,100);
 const leader=exports.ownRankingPosition(exports.individualRankings([person(1,100,1,1,{is_me:true}),person(2,100,1,1)],'all',undefined,''));
 assert.equal(leader.gap,0);assert.equal(leader.above,undefined);
 assert.equal(exports.ownRankingPosition([]),null);
});
test('personal Kudo scope keeps its own metric and does not assign a personal rank to zero Kudo',()=>{
 const rows=[person(1,100,1,1,{kudos:2}),person(2,10,1,1,{kudos:5,is_me:true}),person(3,1000,2,2,{kudos:20})];
 const scoped=exports.individualRankings(rows,'group',{group_id:1,division_id:1},'',true);
 assert.deepEqual(Array.from(scoped,r=>r.athlete_id),[2,1]);
 assert.equal(exports.ownRankingPosition(scoped,true).own.rank,1);
 assert.equal(exports.ownRankingPosition(exports.individualRankings([person(1,10,1,1,{kudos:0,is_me:true})],'all',undefined,'',true),true),null);
});
