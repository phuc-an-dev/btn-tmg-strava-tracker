import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import ts from 'typescript';
import * as nuqs from 'nuqs';
import * as React from 'react';
const statistics={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/statistics.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:statistics});
const parsers={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/portal-query.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:parsers,require:name=>name==='nuqs'?nuqs:name==='./statistics'?statistics:React});
test('pagination accepts bounded integers and supported page sizes only',()=>{
 assert.equal(parsers.pageParser.parse('2'),2);
 for(const value of ['-1','0','1.5','2oops','10001','NaN'])assert.equal(parsers.pageParser.parse(value),null);
 assert.equal(parsers.pageParser.defaultValue,1);
 assert.equal(parsers.membersQuery.size.parse('50'),50);
 assert.equal(parsers.membersQuery.size.parse('99'),null);
});
test('role, status and group filters reject unknown URL values',()=>{
 assert.equal(parsers.accountsQuery.role.parse('admin'),'admin');
 assert.equal(parsers.accountsQuery.role.parse('superadmin'),null);
 assert.equal(parsers.memberActivitiesQuery.group.parse('11'),null);
 assert.equal(parsers.memberActivitiesQuery.scope.parse('club'),'club');
 assert.equal(parsers.memberActivitiesQuery.scope.parse('private'),null);
 assert.equal(parsers.adminActivitiesQuery.status.defaultValue,'pending');
 assert.equal(parsers.memberActivitiesQuery.status.defaultValue,'all');
});
test('statistics deep links validate scope, mode and five-entity limit',()=>{
 assert.equal(parsers.statisticsQuery.scope.parse('groups'),'groups');assert.equal(parsers.statisticsQuery.scope.parse('admin'),null);
 assert.equal(parsers.statisticsQuery.mode.parse('cumulative'),'cumulative');
 assert.equal(parsers.statisticsQuery.period.defaultValue,'event');
 assert.equal(parsers.statisticsQuery.period.parse('week'),'week');
 assert.equal(parsers.statisticsQuery.entities.parse('1,2,3,4,5,6'),null);
 assert.deepEqual(Array.from(parsers.statisticsQuery.entities.parse('1,2')),[1,2]);
});

test('member appeal tracking accepts latest-status filters and rejects unknown values',()=>{
 assert.equal(parsers.memberActivitiesQuery.appeal.defaultValue,'');
 for(const value of ['all','pending','accepted','rejected'])assert.equal(parsers.memberActivitiesQuery.appeal.parse(value),value);
 assert.equal(parsers.memberActivitiesQuery.appeal.parse('approved'),null);
});

test('ranking scope deep links accept only the three supported personal scopes',()=>{
 assert.equal(parsers.rankingsQuery.within.defaultValue,'all');
 for(const within of ['all','group','division'])assert.equal(parsers.rankingsQuery.within.parse(within),within);
 for(const within of ['admin','all-users','1'])assert.equal(parsers.rankingsQuery.within.parse(within),null);
});
