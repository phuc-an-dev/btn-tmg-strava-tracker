import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { test } from 'node:test';

function fixture() {
  const pending = [];
  const db = { from(table) {
    const query = {
      table, select() { return this; }, eq(_, value) { this.user = value; return this; },
      single() { this.singleRow = true; return this; }, order() { return this; },
      then(resolve, reject) { return new Promise(done => pending.push({ query: this, done })).then(resolve, reject); },
    };
    return query;
  }};
  const cache = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/lib/activity-cache.ts", "utf8"), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText, {exports:cache,Date});
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync('src/lib/portal-data.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { exports, require: path => path === "./activity-cache" ? cache : ({ getSupabase: () => db }), Promise, Date });
  const tick = () => new Promise(resolve => setImmediate(resolve));
  function finish(error = null) {
    for (const { query, done } of pending.splice(0)) {
      const data = query.table === 'profiles' ? (query.singleRow ? { id: query.user, role: 'admin' } : [{ id: 'account' }]) : [];
      done({ data, error });
    }
  }
  return { api: exports, cache, pending, tick, finish };
}

test('parallel roster calls share one request; accounts load separately', async () => {
  const f = fixture();
  const first = f.api.loadPortal('A');
  const duplicate = f.api.loadPortal('A');
  assert.equal(first, duplicate);
  await f.tick();
  assert.equal(f.pending.length, 3);
  assert.equal(f.pending.filter(x => x.query.table === 'profiles' && !x.query.singleRow).length, 0);
  f.finish(); await first;
  const accounts = f.api.loadAccounts('A');
  assert.equal(accounts, f.api.loadAccounts('A'));
  await f.tick(); assert.equal(f.pending.length, 1);
  f.finish(); await accounts;
  await f.api.loadAccounts('A'); assert.equal(f.pending.length, 0);
});

test('sign-out or account switch cannot restore a late cached response', async () => {
  const f = fixture();
  const old = f.api.loadPortal('A'); await f.tick();
  f.api.setPortalOwner(null); f.finish(); await old;
  assert.equal(f.api.cachedPortal('A'), undefined);
  const next = f.api.loadPortal('B'); await f.tick(); f.finish(); await next;
  assert.equal(f.api.cachedPortal('B').profile.id, 'B');
  assert.equal(f.api.cachedPortal('A'), undefined);
});

test('failed revalidation preserves cached data and retries', async () => {
  const f = fixture();
  const initial = f.api.loadPortal('A'); await f.tick(); f.finish(); await initial;
  const cached = f.api.cachedPortal('A');
  const failed = f.api.loadPortal('A'); await f.tick(); f.finish({ message: 'Offline' });
  await assert.rejects(failed, /Offline/);
  assert.equal(f.api.cachedPortal('A'), cached);
  const retry = f.api.loadPortal('A'); await f.tick(); assert.equal(f.pending.length, 3);
  f.finish(); await retry;
});

test('post-save refresh waits for the old request, then fetches again', async () => {
  const f = fixture();
  const old = f.api.loadPortal('A'); await f.tick();
  const fresh = f.api.loadPortal('A', true);
  f.finish(); await old; await f.tick();
  assert.equal(f.pending.length, 3);
  f.finish(); await fresh;
});

test('portal owner changes also clear activity and ranking caches',()=>{
 const {api,cache:c}=fixture();api.setPortalOwner('A');const epoch=c.activityCacheEpoch();
 c.setCachedMemberActivities('A','mine',{},epoch);c.setCachedRankings('A','event',{},epoch);
 api.setPortalOwner(null);api.setPortalOwner('B');
 assert.equal(c.getCachedMemberActivities('B','mine'),undefined);
 assert.equal(c.getCachedRankings('B','event'),undefined);
 api.setPortalOwner('A');c.setCachedMemberActivities('A','mine',{},epoch);
 assert.equal(c.getCachedMemberActivities('A','mine'),undefined);
});
