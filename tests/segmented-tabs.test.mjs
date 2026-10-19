import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {test} from 'node:test';
import React from 'react';
import {renderToString} from 'react-dom/server';
import ts from 'typescript';
const requireModule=createRequire(import.meta.url);
const source=ts.transpileModule(fs.readFileSync('src/components/segmented-tabs.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};vm.runInNewContext(source,{exports,require:requireModule});
const items=[{value:'one',label:'One',panelId:'panel-one'},{value:'two',label:'Two',disabled:true},{value:'three',label:'Three',panelId:'panel-three'}];
test('multi-option tabs expose one selected tab, panel link and disabled state',()=>{
 const html=renderToString(React.createElement(exports.SegmentedTabs,{items,value:'three',onValueChange(){},ariaLabel:'Scope'}));
 assert.equal((html.match(/aria-selected="true"/g)||[]).length,1);
 assert.match(html,/aria-controls="panel-three"/);assert.match(html,/disabled=""/);assert.match(html,/--tab-count:3/);
 assert.equal((html.match(/tabindex="0"/g)||[]).length,1);
});
test('multiple component instances do not share generated tab IDs',()=>{
 const props={items,value:'one',onValueChange(){},ariaLabel:'Scope'};
 const html=renderToString(React.createElement(React.Fragment,null,React.createElement(exports.SegmentedTabs,props),React.createElement(exports.SegmentedTabs,props)));
 const ids=[...html.matchAll(/ id="([^"]+)"/g)].map(match=>match[1]);
 assert.equal(ids.length,6);assert.equal(new Set(ids).size,6);
});
test('keyboard skips disabled tabs and touch swipe changes selection once',()=>{
 const interactive={};
 vm.runInNewContext(source,{exports:interactive,require:name=>name==='react'?{useId:()=> 'test',useRef:value=>({current:value})}:requireModule(name)});
 const changes=[];
 const tree=interactive.SegmentedTabs({items,value:'one',onValueChange:value=>changes.push(value),ariaLabel:'Scope'});
 const buttons=tree.props.children[1];
 buttons[0].props.onKeyDown({key:'ArrowRight',preventDefault(){}});assert.deepEqual(changes,['three']);
 buttons[0].props.onKeyDown({key:'Home',preventDefault(){}});assert.deepEqual(changes,['three']);
 tree.props.onPointerDown({pointerType:'touch',clientX:100,clientY:10});
 tree.props.onPointerUp({clientX:20,clientY:12});
 buttons[2].props.onClick();assert.deepEqual(changes,['three','three']);
});
