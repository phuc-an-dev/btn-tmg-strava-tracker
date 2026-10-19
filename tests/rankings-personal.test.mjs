import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRequire} from 'node:module';

const requireModule=createRequire(import.meta.url);
function component(file,mocks={}) {
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>mocks[name]??requireModule(name)});
 return exports;
}
const rankings=component('src/lib/rankings.ts');
const tabs=component('src/components/segmented-tabs.tsx');
const person=(id,steps,group,division,isMe=false)=>({athlete_id:id,name:`Member ${id}`,steps,group_id:group,division_id:division,is_me:isMe,activities:1,gender:'male',lifetime_steps:steps,lifetime_days:1});
const data={individuals:[person(1,100,1,1),person(2,70,2,1),person(3,60,1,1,true),person(4,200,3,2)],groups:[],divisions:[],summary:{steps:430,participants:4,roster:4,activities:4,with_gender:4}};
function render({within='all',q='',ownMember={group_id:1,division_id:1},gender='',anonymous=false}={}) {
 const params={tab:'individuals',metric:'performance',period:'event',page:1,gender,q,within};
 const {RankingsPanel}=component('src/components/rankings-panel.tsx',{
  nuqs:{useQueryStates:()=>[params,()=>{}],debounce:()=>{}},
  '@/lib/portal-query':{useDebouncedSearch:value=>value},
  '@/lib/activity-cache':{getCachedRankings:()=>anonymous?{...data,individuals:data.individuals.map(row=>({...row,is_me:false}))}:data},
  '@/lib/supabase':{},
  '@/lib/rankings':rankings,
  './portal-context':{usePortal:()=>({ownMember,session:anonymous?null:{user:{id:'fixture'}}})},
  './segmented-tabs':tabs,
  './mobile-drawer':{BottomDrawer:()=>null,ResponsivePicker:()=>null},
  './post-media':{PostMediaBackground:()=>null,PostMediaButton:()=>null},
  './pagination':{Pagination:()=>null},
 });
 return renderToStaticMarkup(React.createElement(RankingsPanel));
}
test('own group and division show their local rank and nearby gap',()=>{
 const group=render({within:'group'});
 assert.match(group,/Bạn đứng #2 \/ 2 người có hạng/);
 assert.match(group,/Còn 40 bước để bằng hạng #1/);
 assert.match(group,/Nhóm 1 · /);
 assert.match(group,/Đến vị trí của tôi/);
 assert.match(group,/ranking-card is-me/);
 assert.doesNotMatch(group,/Member 2|Member 4/);
 const division=render({within:'division'});
 assert.match(division,/Bạn đứng #3 \/ 3 người có hạng/);
 assert.match(division,/Còn 10 bước để bằng hạng #2/);
 assert.match(division,/Member 2/);
 assert.doesNotMatch(division,/Member 4/);
});
test('search narrows rows without changing the personal rank and jump action',()=>{
 const html=render({within:'group',q:'Member 1'});
 assert.match(html,/Bạn đứng #2 \/ 2 người có hạng/);
 assert.match(html,/Đến vị trí của tôi/);
 assert.doesNotMatch(html,/ranking-card is-me/);
});
test('missing membership hides personal scope tabs and safely falls back to event-wide ranks',()=>{
 const unlinked=render({ownMember:null,within:'division'});
 assert.doesNotMatch(unlinked,/Phạm vi xếp hạng cá nhân|Nhóm của tôi|Liên đoàn của tôi/);
 assert.match(unlinked,/Member 4/);
});
test('a gender filter excluding the current member shows no invented personal rank',()=>{
 const html=render({within:'group',gender:'female'});
 assert.match(html,/Bạn chưa có hạng trong bộ lọc này/);
 assert.doesNotMatch(html,/Đến vị trí của tôi|Còn \d+ bước/);
});

test('anonymous visitors see rankings and filters without a personal account prompt',()=>{
 const html=render({anonymous:true,ownMember:null});
 assert.match(html,/Member 1|Member 4/);
 assert.match(html,/Bộ lọc|Tìm trong bảng xếp hạng/);
 assert.doesNotMatch(html,/Liên kết thành viên|Bạn đứng|ranking-card is-me|Nhóm của tôi|Liên đoàn của tôi/);
});
