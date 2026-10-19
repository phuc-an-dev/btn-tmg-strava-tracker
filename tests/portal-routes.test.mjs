import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import ts from 'typescript';
const exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/portal-routes.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,URL});
test('each portal section maps to a distinct route and the expected section',()=>{
 const routes=Object.entries(exports.portalRoutes);
 assert.equal(new Set(routes.map(([,route])=>route.href)).size,12);
 for(const [section,route] of routes)assert.equal(exports.sectionForPath(route.href),section);
});
test('member and leader access are bounded; admin routes cannot be reached by members',()=>{
 for(const section of ['audit','accounts','groups','appeals','settings']){
  assert.equal(exports.canAccessSection('admin',section),true);
  assert.equal(exports.canAccessSection('leader',section),false);
  assert.equal(exports.canAccessSection('user',section),false);
 }
 for(const role of ['user','leader','admin'])for(const section of ['members','activities','rankings','statistics','contributions','honors'])assert.equal(exports.canAccessSection(role,section),true);
 assert.equal(exports.canAccessSection('leader','my-division'),true);
 assert.equal(exports.canAccessSection('user','my-division'),false);
});
test('login redirects retain deep-link queries but reject external destinations',()=>{
 assert.equal(exports.safePortalRedirect('/activities?status=approved&page=2'),'/activities?status=approved&page=2');
 assert.equal(exports.safePortalRedirect('/settings'),'/settings');
 assert.equal(exports.safePortalRedirect('/contributions?scope=groups'),'/contributions?scope=groups');
 assert.equal(exports.safePortalRedirect('/members'),'/members');
 for(const target of [null,'','https://evil.test','//evil.test','javascript:alert(1)','/unknown'])assert.equal(exports.safePortalRedirect(target),'/rankings');
});

test('public reading is available without a role while every management route stays private',()=>{
 for(const role of [null,undefined]){
  for(const section of ['members','activities','rankings','statistics','contributions','honors'])assert.equal(exports.canAccessSection(role,section),true);
  for(const section of ['groups','accounts','appeals','audit','settings','my-division'])assert.equal(exports.canAccessSection(role,section),false);
 }
});
test('appeal login round trip keeps a bounded activity identifier and rejects invalid targets',()=>{
 const target='/activities?scope=club&status=approved&q=123456789&activity=123456789';
 assert.equal(exports.safePortalRedirect(target),target);
 assert.equal(exports.activityAppealTarget('123456789'),123456789);
 for(const value of [null,'','0','-1','1e3','1.5','1&redirect=https://evil.test','1000000000000000'])assert.equal(exports.activityAppealTarget(value),null);
});
