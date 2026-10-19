import {readFile,mkdir,writeFile} from 'node:fs/promises';

// Rebuild manually when the sibling extension's normalizer changes.
const core=await readFile(new URL('../../btn-tmg-strava-crawler-extension/core.js',import.meta.url),'utf8');
const wrapper=await readFile(new URL('./ios-strava-activities.js',import.meta.url),'utf8');
const output=wrapper.replace('/* INSERT_EXTENSION_CORE */','{ const module = undefined;\n'+core.replace('})(globalThis);','})(coreTarget);')+'\n}');
const directory=new URL('../public/shortcuts/',import.meta.url);
await mkdir(directory,{recursive:true});
await writeFile(new URL('strava-activities.js.txt',directory),output);
