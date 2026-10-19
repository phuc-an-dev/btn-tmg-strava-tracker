import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import ts from 'typescript';
const review={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/registration-review.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:review});
const account={id:'new-user',role:'user',full_name:'Test Member',birth_year:2000,gender:'female',email_verified_at:'2026-10-15T00:00:00Z',requested_group_id:2,requested_strava_athlete_id:100};
const member={strava_athlete_id:100,active:true,auth_user_id:null};
test('legacy linked accounts and admins stay approved; new unlinked users need review',()=>{
 assert.equal(review.registrationApproved(account),false);
 assert.equal(review.registrationApproved(account,member),true);
 assert.equal(review.registrationApproved({...account,role:'admin'}),true);
 assert.equal(review.registrationApproved({...account,approved_at:'2026-10-15'}),true);
});
test('eligibility explains unavailable Strava, stale claims, missing details and unverified email',()=>{
 assert.equal(review.registrationIssue(account,[member]),null);
 assert.match(review.registrationIssue({...account,email_verified_at:null},[member]),/xác thực email/);
 assert.match(review.registrationIssue({...account,requested_group_id:null},[member]),/chưa đủ thông tin/);
 assert.match(review.registrationIssue(account,[]),/Không tìm thấy/);
 assert.match(review.registrationIssue(account,[{...member,active:false}]),/không còn tham gia/);
 assert.match(review.registrationIssue(account,[{...member,auth_user_id:'other'}]),/tài khoản khác/);
});
