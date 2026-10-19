import {statisticsColors} from './statistics';

// Five intensities of REVIVE blue, shared by the waffle, legend and table.
const blue=statisticsColors[0];
export const contributionColors=[0,.18,.36,.54,.72].map(tint=>`#${[1,3,5].map(start=>{
 const channel=parseInt(blue.slice(start,start+2),16);
 return Math.round(channel+(255-channel)*tint).toString(16).padStart(2,'0');
}).join('')}`);
