import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import React from 'react';
import {ImageResponse} from 'next/og.js';

// Run manually with Node from the repository root. Fonts are loaded only while
// generating committed PNG assets; page requests do not depend on this fetch.
const fontRoot='https://raw.githubusercontent.com/google/fonts/main/ofl';
async function font(path){
 const response=await fetch(`${fontRoot}/${path}`);
 if(!response.ok)throw new Error(`Font download failed: ${path} (${response.status})`);
 return response.arrayBuffer();
}
const [body,semibold,brand]=await Promise.all([
 font('bevietnampro/BeVietnamPro-Regular.ttf'),
 font('bevietnampro/BeVietnamPro-SemiBold.ttf'),
 font('lalezar/Lalezar-Regular.ttf'),
]);
const logo=`data:image/png;base64,${(await readFile('public/revive/logo.png')).toString('base64')}`;
const h=React.createElement;
const cards=[
 {key:'about',heading:'GIỚI THIỆU HỘI THAO',detail:'Vực tâm linh · Vực tinh thần · Vực thể chất',cta:'Khám phá REVIVE',accent:'#ff6815'},
 {key:'register',heading:'THEO DÕI ĐI BỘ STRAVA',detail:'Tạo tài khoản · Chọn nhóm nhỏ · Chọn hồ sơ Strava',cta:'Tạo tài khoản',accent:'#a3c52f'},
 {key:'login',heading:'ĐĂNG NHẬP REVIVE',detail:'Theo dõi đi bộ Strava · Số bước · Xếp hạng',cta:'Đăng nhập ngay',accent:'#ff6815'},
 {key:'activities',heading:'HOẠT ĐỘNG ĐI BỘ STRAVA',detail:'Theo dõi số bước · Trạng thái duyệt · Điểm ghi nhận',cta:'Xem hoạt động đi bộ',accent:'#ff6815'},
 {key:'rankings',heading:'XẾP HẠNG ĐI BỘ',detail:'Cá nhân · Nhóm nhỏ · Liên đoàn · Top kudo',cta:'Xem xếp hạng',accent:'#a3c52f'},
 {key:'members',heading:'THÀNH VIÊN ĐI BỘ',detail:'Nhóm nhỏ · Liên đoàn · Hoạt động đi bộ Strava',cta:'Xem thành viên',accent:'#a3c52f'},
 {key:'portal',heading:'THEO DÕI ĐI BỘ STRAVA',detail:'Hội thao REVIVE 2026 · BTN Trương Minh Giảng',cta:'Đăng nhập để xem',accent:'#ff6815'},
];
const output='public/revive/og';await mkdir(output,{recursive:true});
for(const card of cards){
 const image=h('div',{style:{width:'100%',height:'100%',display:'flex',position:'relative',background:'#f8f7f4',color:'#272e36',fontFamily:'Be Vietnam Pro',padding:54}},
  h('div',{style:{position:'absolute',top:0,left:0,right:0,height:12,display:'flex'}},
   ...['#a3c52f','#1d4fb8','#ff6815'].map(color=>h('div',{key:color,style:{flex:1,background:color}}))),
  h('div',{style:{position:'absolute',width:350,height:540,right:0,top:12,background:card.accent,opacity:.1,borderTopLeftRadius:180,borderBottomLeftRadius:180}}),
  h('div',{style:{display:'flex',flexDirection:'column',width:790,position:'relative'}},
   h('div',{style:{fontSize:19,fontWeight:600,letterSpacing:2,color:'#1d4fb8'}},'BAN THANH NIÊN TRƯƠNG MINH GIẢNG'),
   h('div',{style:{fontFamily:'Lalezar',fontSize:132,lineHeight:1,marginTop:24,color:'#1d4fb8'}},'REVIVE'),
   h('div',{style:{fontSize:23,fontWeight:600,letterSpacing:6,marginTop:-10,color:'#616974'}},'HỘI THAO 2026'),
   h('div',{style:{fontSize:38,fontWeight:600,lineHeight:1.25,marginTop:30}},card.heading),
   h('div',{style:{fontSize:21,lineHeight:1.5,marginTop:14,color:'#616974'}},card.detail),
   h('div',{style:{display:'flex',alignItems:'center',alignSelf:'flex-start',gap:16,padding:'15px 26px',marginTop:30,borderRadius:36,background:'#1d4fb8',color:'white',fontSize:24,fontWeight:600}},card.cta,
    h('svg',{width:26,height:26,viewBox:'0 0 24 24',fill:'none',stroke:'white',strokeWidth:2},h('path',{d:'M4 12h16M13 5l7 7-7 7'}))),
   h('div',{style:{fontSize:18,color:'#616974',marginTop:22}},'04/10 — 15/11/2026')),
  h('div',{style:{position:'absolute',right:48,top:160,width:260,height:300,display:'flex',alignItems:'center',justifyContent:'center',padding:18,borderRadius:32,background:'white',border:'1px solid #e0e4eb'}},h('img',{src:logo,width:220,height:252,alt:''})),
 );
 const response=new ImageResponse(image,{width:1200,height:630,fonts:[{name:'Be Vietnam Pro',data:body,weight:400,style:'normal'},{name:'Be Vietnam Pro',data:semibold,weight:600,style:'normal'},{name:'Lalezar',data:brand,weight:400,style:'normal'}]});
 const buffer=Buffer.from(await response.arrayBuffer());
 await writeFile(join(output,`${card.key}-v2.png`),buffer);
 console.log(`${card.key}-v2.png: ${buffer.length} bytes`);
}
