import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import ts from 'typescript';
const exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/signup-otp.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,sessionStorage:{setItem(){},removeItem(){}}});

test('OTP keeps leading zeros and supports pasted codes',()=>{
 assert.equal(exports.normalizeSignupCode('01 23-45'),'012345');
 assert.equal(exports.validSignupCode('012345'),true);
 for(const code of ['','12345','1234567','12a456','１２３４５６'])assert.equal(exports.validSignupCode(code),false);
});
test('resend respects the entire cooldown including its final second',()=>{
 assert.equal(exports.resendWait(1000,1000),60);
 assert.equal(exports.resendWait(1000,60999),1);
 assert.equal(exports.resendWait(1000,61000),0);
 assert.equal(exports.resendWait(1000,999999),0);
});
test('resuming confirmation accepts only valid email and timestamp metadata',()=>{
 for(const raw of [null,'{','null','{}','{"email":"x","sentAt":0}','{"email":"a@example.com","sentAt":"0"}','{"email":"a@example.com","sentAt":-1}'])assert.equal(exports.readPendingSignup(raw),null);
 const result=exports.readPendingSignup('{"email":"a@example.com","sentAt":1000,"password":"not-preserved","token":"not-preserved"}');
 assert.equal(result.email,'a@example.com');
 assert.equal(result.sentAt,1000);
 assert.deepEqual(Object.keys(result),['email','sentAt']);
});
test('invalid OTP and rate limits show actionable messages without exposing provider details',()=>{
 assert.match(exports.signupOtpError({code:'otp_expired'}),/không đúng hoặc đã hết hạn/);
 assert.match(exports.signupOtpError({code:'over_email_send_rate_limit'}),/đợi/);
 assert.equal(exports.signupOtpError(new Error('provider-secret-details')),exports.signupOtpError(null));
});
