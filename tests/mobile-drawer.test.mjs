import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import ts from 'typescript';

const requireModule = createRequire(import.meta.url);
const exports = {};
const source = ts.transpileModule(fs.readFileSync('src/components/mobile-drawer.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;
const selectItemExports = {};
const selectItemSource = ts.transpileModule(fs.readFileSync('src/components/select-item.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(selectItemSource, { exports: selectItemExports, require: requireModule });
vm.runInNewContext(source, { exports, require: name => name === './select-item' ? selectItemExports : requireModule(name) });

test('keyboard provider stays inside drawer context, including nested drawers', () => {
  const child = React.createElement(exports.BottomDrawer, { open: true, onOpenChange() {}, title: 'Nested' }, 'Options');
  for (const open of [false, true]) {
    assert.doesNotThrow(() => renderToString(React.createElement(exports.BottomDrawer, { open, onOpenChange() {}, title: 'Parent' }, child)));
  }
});

test('desktop picker preserves the selected value and field name', () => {
  const html = renderToString(React.createElement(exports.ResponsivePicker, {
    label: 'Division', name: 'division', value: '2', options: [{value:'1',label:'One'},{value:'2',label:'Two'}],
  }));
  assert.match(html, /name="division"/);
  assert.match(html, /value="2" selected=""/);
});
