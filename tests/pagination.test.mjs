import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import ts from 'typescript';

const requireModule = createRequire(import.meta.url);

// Transpile dependencies
const selectItemExports = {};
const selectItemSource = ts.transpileModule(fs.readFileSync('src/components/select-item.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(selectItemSource, { exports: selectItemExports, require: requireModule });

const mobileDrawerExports = {};
const mobileDrawerSource = ts.transpileModule(fs.readFileSync('src/components/mobile-drawer.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(mobileDrawerSource, {
  exports: mobileDrawerExports,
  require: name => (name === './select-item' ? selectItemExports : requireModule(name)),
});

const paginationExports = {};
const paginationSource = ts.transpileModule(fs.readFileSync('src/components/pagination.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(paginationSource, {
  exports: paginationExports,
  require: name => {
    if (name === './mobile-drawer') return mobileDrawerExports;
    return requireModule(name);
  },
});

test('pagination disables prev button on first page and renders indicator', () => {
  const html = renderToString(React.createElement(paginationExports.Pagination, {
    currentPage: 1,
    totalPages: 5,
    onPageChange() {},
    ariaLabel: 'Test pagination',
  }));

  assert.match(html, /aria-label="Trang trước" disabled=""/);
  assert.match(html, /Trang.*1.*\/.*5/);
  assert.doesNotMatch(html, /aria-label="Trang sau" disabled=""/);
  assert.match(html, /pagination-btn pagination-prev/);
  assert.match(html, /pagination-btn pagination-next/);
});

test('pagination disables next button on last page', () => {
  const html = renderToString(React.createElement(paginationExports.Pagination, {
    currentPage: 5,
    totalPages: 5,
    onPageChange() {},
  }));

  assert.doesNotMatch(html, /aria-label="Trang trước" disabled=""/);
  assert.match(html, /aria-label="Trang sau" disabled=""/);
  assert.match(html, /Trang.*5.*\/.*5/);
});

test('pagination renders responsive picker when onPageSizeChange is provided', () => {
  const html = renderToString(React.createElement(paginationExports.Pagination, {
    currentPage: 2,
    totalPages: 7,
    pageSize: 10,
    onPageSizeChange() {},
    pageSizeOptions: [10, 20, 50],
    onPageChange() {},
  }));

  assert.match(html, /value="10"/);
  assert.match(html, /10.*\/.*trang/);
  assert.match(html, /20.*\/.*trang/);
  assert.match(html, /50.*\/.*trang/);
});

test('pagination renders static size badge when onPageSizeChange is omitted', () => {
  const html = renderToString(React.createElement(paginationExports.Pagination, {
    currentPage: 1,
    totalPages: 3,
    pageSize: 20,
    onPageChange() {},
  }));

  assert.match(html, /class="pagination-static-size"/);
  assert.match(html, /20.*\/.*trang/);
});
