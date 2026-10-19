import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import ts from 'typescript';

const requireModule = createRequire(import.meta.url);

function loadComponent(filePath, mockRequire = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(filePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    require: name => mockRequire[name] || requireModule(name),
  });
  return exports;
}

const activityRibbon = loadComponent('src/components/activity-status-ribbon.tsx');
const activitySkeleton = loadComponent('src/components/activity-list-skeleton.tsx', {'./activity-status-ribbon': activityRibbon});
const auditSkeleton = loadComponent('src/components/audit-list-skeleton.tsx');
const divisionSkeleton = loadComponent('src/components/division-skeleton.tsx');
const groupsSkeleton = loadComponent('src/components/groups-skeleton.tsx');
const accountsSkeleton = loadComponent('src/components/accounts-skeleton.tsx');
const onboardingSkeleton = loadComponent('src/components/onboarding-skeleton.tsx', {
  './revive-header': { ReviveHeader: ({ children }) => React.createElement('header', null, children) },
});

test('ActivityListSkeleton renders activity review cards and metrics shimmer', () => {
  const html = renderToString(React.createElement(activitySkeleton.ActivityListSkeleton, { count: 3 }));
  assert.match(html, /activity-review-card activity-skeleton-card/);
  assert.match(html, /activity-skeleton-metric-val/);
  assert.match(html, /activity-status-tabs/);
  assert.match(html, /aria-label="Đang tải hoạt động"/);
});

test('ActivityListSkeleton in embed mode only renders cards', () => {
  const html = renderToString(React.createElement(activitySkeleton.ActivityListSkeleton, { embed: true, count: 2 }));
  assert.match(html, /activity-review-card activity-skeleton-card/);
  assert.doesNotMatch(html, /activity-status-tabs/);
});

test('AuditListSkeleton renders audit cards with parties flow', () => {
  const html = renderToString(React.createElement(auditSkeleton.AuditListSkeleton, { count: 3 }));
  assert.match(html, /audit-card audit-skeleton-card/);
  assert.match(html, /audit-parties-flow/);
  assert.match(html, /audit-skeleton-badge/);
  assert.match(html, /aria-label="Đang tải lịch sử Audit"/);
});

test('DivisionSkeleton renders unassigned card and group chips', () => {
  const html = renderToString(React.createElement(divisionSkeleton.DivisionSkeleton));
  assert.match(html, /division-unassigned-card/);
  assert.match(html, /division-grid/);
  assert.match(html, /group-members-chips/);
  assert.match(html, /member-tag member-skeleton-block/);
});

test('GroupsSkeleton renders division cards and small group rows', () => {
  const html = renderToString(React.createElement(groupsSkeleton.GroupsSkeleton));
  assert.match(html, /division-grid/);
  assert.match(html, /division-group/);
  assert.match(html, /aria-label="Đang tải nhóm nhỏ"/);
});

test('AccountsSkeleton renders registration cards with identity and actions', () => {
  const html = renderToString(React.createElement(accountsSkeleton.AccountsSkeleton, { count: 2 }));
  assert.match(html, /permission-card registration-card permission-skeleton-card/);
  assert.match(html, /permission-identity/);
  assert.match(html, /registration-strava/);
  assert.match(html, /aria-label="Đang tải hồ sơ đăng ký"/);
});

test('OnboardingSkeleton renders 3-step stepper and message box', () => {
  const html = renderToString(React.createElement(onboardingSkeleton.OnboardingSkeleton));
  assert.match(html, /onboarding-skeleton-card/);
  assert.match(html, /stepper-container/);
  assert.match(html, /step-circle member-skeleton-block/);
  assert.match(html, /onboarding-message-box/);
});
