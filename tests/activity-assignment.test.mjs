import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const exports={};
const source=ts.transpileModule(readFileSync('src/components/activity-assignment.tsx','utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX},
}).outputText;
vm.runInNewContext(source,{exports,require:createRequire(import.meta.url)});
const row={status:'pending',division_id:null,group_id:null,source:{division:null}};
const member={active:true,division_id:3,group_id:1};
const render=(row,member,review=true)=>renderToStaticMarkup(React.createElement(exports.ActivityAssignment,{row,member,review}));

test('missing title division shows assigned destination for review',()=>{
 const html=render(row,member);
 assert.match(html,/LĐ từ tiêu đề<\/dt><dd>Chưa xác định/);
 assert.match(html,/Tính điểm khi duyệt<\/dt><dd><strong>LĐ 3 · Nhóm 1/);
 assert.match(html,/sẽ được ghi nhận theo phân công thành viên/);
});
test('wrong title division stays visible beside the assigned destination',()=>{
 const html=render({...row,division_id:2,source:{division:2}},member);
 assert.match(html,/LĐ từ tiêu đề<\/dt><dd>LĐ 2/);
 assert.match(html,/Tính điểm khi duyệt<\/dt><dd><strong>LĐ 3 · Nhóm 1/);
});
test('unassigned and inactive members have no approval destination',()=>{
 for(const m of [undefined,{...member,group_id:null},{...member,active:false}]){
  const html=render(row,m);
  assert.match(html,/Chưa có phân công hợp lệ/);
  assert.match(html,/Cần phân nhóm/);
  assert.doesNotMatch(html,/<strong>LĐ 3 · Nhóm 1/);
 }
});
test('approved detail preserves credited assignment after roster changes',()=>{
 const approved={...row,status:'approved',division_id:3,group_id:1};
 const html=render(approved,{...member,division_id:2,group_id:4},false);
 assert.match(html,/LĐ từ tiêu đề<\/dt><dd>Chưa xác định/);
 assert.match(html,/Phân công thành viên<\/dt><dd>LĐ 2 · Nhóm 4/);
 assert.match(html,/Nhóm\/LĐ đã ghi nhận<\/dt><dd><strong>LĐ 3 · Nhóm 1/);
 assert.match(render(approved,{...member,division_id:2,group_id:4}),/Tính điểm khi duyệt<\/dt><dd><strong>LĐ 2 · Nhóm 4/);
});
