'use strict';
(() => {
 const $ = id => document.getElementById(id);
 const canvas = $('game'), ctx = canvas.getContext('2d'), viewport = $('viewport');
 const TAU = Math.PI * 2, DURATION = 300, WORLD = 4950;
 const heroes = [
  {name:'Грим',desc:'Сталь, пепел и верная дубина.',role:'⚒ ВОИН',trait:'+20% УРОН',hp:100,speed:175,damage:28,color:'#adadad',filter:'none'},
  {name:'Морвен',desc:'Голос могил. Корни мёртвого леса.',role:'✳ ДРУИД',trait:'+40% ЗДОРОВЬЕ',hp:140,speed:165,damage:23,color:'#a9a9a9',filter:'none'},
  {name:'Нокс',desc:'Тихий шаг. Лезвие из тени.',role:'↯ РАЗБОЙНИК',trait:'+25% СКОРОСТЬ',hp:80,speed:219,damage:23,color:'#a1a1a1',filter:'none'}
 ];
 let profile = {best:0,kills:0,runs:[],sound:false,shake:true};
 try { const p=JSON.parse(localStorage.getItem('dodabonk-v1')); if(p && typeof p==='object') profile={...profile,...p,runs:Array.isArray(p.runs)?p.runs.slice(0,15):[]}; } catch(e) { /* Storage may be disabled. The game still works. */ }
 const legacyHeroNames={'Додик':'Грим','Моховик':'Морвен','Искра':'Нокс'};
 profile.runs=profile.runs.map(run=>({...run,hero:Object.prototype.hasOwnProperty.call(legacyHeroNames,run.hero)?legacyHeroNames[run.hero]:run.hero}));
 const persist=()=>{try{localStorage.setItem('dodabonk-v1',JSON.stringify(profile));}catch(e){}};
 const formatTime=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
 let selectedHero=0,state='home',g=null,viewW=800,viewH=500,dpr=1,lastFrame=0,ambient=0;
 let keys=new Set(), move={x:0,y:0}, touchOrigin=null, audioCtx=null, pausedByModal=false;
 let camera={x:-220,y:0}, frameCount=0;
 const rngSeed=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
 const CHUNK=640,CHUNK_LIMIT=96;
 const REGIONS=[
  {id:0,name:'Пепельный лес',tone:'#252525',ground:['#171717','#181818','#1a1a1a','#191919','#161616'],x:0,y:0},
  {id:1,name:'Старое кладбище',tone:'#535353',ground:['#202020','#222222','#242424','#212121','#1e1e1e'],x:-3000,y:0},
  {id:2,name:'Руины собора',tone:'#747474',ground:['#303030','#323232','#353535','#2d2d2d','#2f2f2f'],x:3000,y:0},
  {id:3,name:'Безмолвная пустошь',tone:'#989898',ground:['#292929','#2c2c2c','#2e2e2e','#2a2a2a','#272727'],x:0,y:-3000},
  {id:4,name:'Мёртвая низина',tone:'#3b3b3b',ground:['#101010','#131313','#151515','#121212','#111111'],x:0,y:3000}
 ];
 // Each location keeps the large five-region world, with its own terrain and final guardian.
 const LOCATIONS=[
  {name:'Расколотые земли',boss:'Велес, Пепельный страж',seed:0,regions:REGIONS,props:null},
  {name:'Костяные катакомбы',boss:'Мортис, Костяной король',seed:17341,
   regions:REGIONS.map((r,i)=>({...r,name:['Костяной зал','Склепы забвения','Галерея саркофагов','Каменный провал','Подземная река'][i],tone:['#454545','#626262','#858585','#2a2a2a','#191919'][i],ground:[['#242424','#272727','#292929','#252525','#222222'],['#323232','#343434','#363636','#313131','#2e2e2e'],['#3a3a3a','#3d3d3d','#404040','#383838','#353535'],['#181818','#1c1c1c','#202020','#1a1a1a','#161616'],['#0e0e0e','#121212','#151515','#101010','#0c0c0c']][i]})),
   props:{tree:'pillar',rock:'bones',grass:'bones',ruin:'monument',torch:'torch',pool:'pool',grave:'grave',pillar:'pillar',bones:'bones',obelisk:'obelisk',monument:'monument'}},
  {name:'Обсидиановая цитадель',boss:'Ниграм, Владыка бездны',seed:39467,
   regions:REGIONS.map((r,i)=>({...r,name:['Врата цитадели','Двор казнённых','Тронный зал','Обсидиановый шпиль','Чёрный ров'][i],tone:['#333333','#5a5a5a','#969696','#707070','#161616'][i],ground:[['#1a1a1a','#1d1d1d','#202020','#181818','#151515'],['#272727','#2a2a2a','#2d2d2d','#252525','#222222'],['#424242','#454545','#484848','#3e3e3e','#3a3a3a'],['#303030','#343434','#383838','#2e2e2e','#292929'],['#0b0b0b','#0e0e0e','#111111','#0d0d0d','#090909']][i]})),
   props:{tree:'obelisk',rock:'pillar',grass:'grave',ruin:'ruin',torch:'torch',pool:'pool',grave:'bones',pillar:'pillar',bones:'bones',obelisk:'obelisk',monument:'ruin'}}
 ];
 const currentLocation=()=>LOCATIONS[g?.location||0];
 const currentRegions=()=>currentLocation().regions;
 const locationProp=type=>currentLocation().props?.[type]||type;
 function biomeAt(x,y){const xx=x+Math.sin(y/600)*110,yy=y+Math.sin(x/700)*110;if(Math.max(Math.abs(xx),Math.abs(yy))<1500)return currentRegions()[0];return Math.abs(xx)>Math.abs(yy)?currentRegions()[xx<0?1:2]:currentRegions()[yy<0?3:4];}
 const worldChunks=new Map();
 function getChunk(cx,cy){const key=`${g?.location||0}:${cx},${cy}`;if(worldChunks.has(key)){const value=worldChunks.get(key);worldChunks.delete(key);worldChunks.set(key,value);return value;}
  const rand=rngSeed((Math.imul(cx,73856093)^Math.imul(cy,19349663)^932451^currentLocation().seed)|0),items=[];
  for(let i=0;i<12;i++){const x=(cx+rand())*CHUNK,y=(cy+rand())*CHUNK;if(Math.abs(x)>WORLD-80||Math.abs(y)>WORLD-80||currentRegions().some(r=>Math.hypot(x-r.x,y-r.y)<220))continue;const zone=biomeAt(x,y),p=rand();let type;
   if(zone.id===0)type=p<.55?'tree':p<.75?'rock':'grass';
   else if(zone.id===1)type=p<.5?'rock':p<.72?'grave':p<.85?'tree':'grass';
   else if(zone.id===2)type=p<.2?'ruin':p<.52?'pillar':p<.7?'bones':'grass';
   else if(zone.id===3)type=p<.48?'bones':p<.62?'obelisk':p<.82?'grass':'tree';
   else type=p<.4?'pool':p<.65?'tree':p<.85?'grass':'rock';
   items.push({x,y,type:locationProp(type),size:.65+rand()*.85,tint:rand()});
  }
  worldChunks.set(key,items);while(worldChunks.size>CHUNK_LIMIT)worldChunks.delete(worldChunks.keys().next().value);return items;
 }
 const deco=[{x:280,y:-180,type:'ruin',size:1},{x:-210,y:170,type:'ruin',size:.8},{x:220,y:180,type:'torch',size:1},{x:-230,y:-150,type:'torch',size:1},{x:390,y:40,type:'tree',size:1.35,tint:.8},{x:60,y:330,type:'tree',size:1.3,tint:.3},{x:-370,y:-180,type:'tree',size:1.2,tint:.7}];
 for(const r of REGIONS.slice(1)){
  deco.push({x:r.x,y:r.y,type:['','monument','ruin','obelisk','pool'][r.id],size:r.id===2?1.8:1.5,landmark:true});
  for(let i=0;i<8;i++){const a=i/8*TAU;deco.push({x:r.x+Math.cos(a)*210,y:r.y+Math.sin(a)*210,type:i%4===0?'torch':r.id===1?'rock':r.id===2?'pillar':r.id===3?'bones':'pool',size:1,tint:i/8});}
 }
 function visibleDecor(){const corners=[worldOffset(-viewW/2-150,-viewH/2-190),worldOffset(viewW/2+150,-viewH/2-190),worldOffset(-viewW/2-150,viewH/2+190),worldOffset(viewW/2+150,viewH/2+190)];
  const minX=Math.floor((camera.x+Math.min(...corners.map(p=>p.x)))/CHUNK),maxX=Math.floor((camera.x+Math.max(...corners.map(p=>p.x)))/CHUNK),minY=Math.floor((camera.y+Math.min(...corners.map(p=>p.y)))/CHUNK),maxY=Math.floor((camera.y+Math.max(...corners.map(p=>p.y)))/CHUNK);const items=deco.map(d=>({...d,type:locationProp(d.type)}));
  for(let x=minX;x<=maxX;x++)for(let y=minY;y<=maxY;y++)items.push(...getChunk(x,y));return items;
 }


 // The renderer uses a native, low-resolution raster and a shared monochrome sprite atlas.
 const INK=['transparent','#080808','#202020','#3c3c3c','#626262','#969696','#c6c6c6','#eeeeee'];
 const SPRITES={
  knight:[
   '..........1111..........','.........155551.........','........15666551........','.......1567776551.......',
   '......156666666551......','......156111111651......','......156177771651......','......156111111651......',
   '.......1544444451.......','.......1556655551.......','......133555553331......','.....13441555144331.....',
   '....1355415551455431....','....1355415551455431....','....1344116661144431....','.....1211666661121......',
   '.....1211544451121......','......11454445411.......','......13454445431.......','.....1344544454431......',
   '.....1334544454331......','....133345444543331.....','....133334444433331.....','....122233111332221.....',
   '.....1115511155111......','.......1541.1451........','.......1541.1451........','......15541.14551.......',
   '......11111.11111.......'
  ],
  hood:[
   '..........111...........','.........13331..........','........1344331.........','.......134554331........',
   '......13455544331.......','.....1345111154331......','.....1345111154331......','.....1345177154331......',
   '.....1345111154331......','......13344444331.......','.......133444331........','......13334443331.......',
   '.....1334444444331......','....133344444443331.....','....134434444434431.....','....134431554434431.....',
   '.....1343155134431......','......13155551331.......','......13344444331.......','.....1334444444331......',
   '.....1343444443431......','....133434444434331.....','....134343444343431.....','...13343433433434331....',
   '...12223311111332221....','....111551...155111.....','......1541...1451.......','.....15541...14551......',
   '.....11111...11111......'
  ],
  mace:[
   '..111111..','.15666651.','1567777651','1566666651','1556666551','.15555551.',
   '..115511..','....551...','....541...','....541...','....541...','....541...',
   '....541...','....541...','...15551..','...11111..'
  ],
  wraith:[
   '.......1111.......','......133331......','.....13444331.....','....1345544331....',
   '...134511154331...','...134517154331...','...134511154331...','....1335544331....',
   '.....13444331.....','....1334443331....','...133444443331...','..13343444343331..',
   '.1334344444343331.','.1343444444434331.','..13344444444331..','...133444444331...',
   '...132334433231...','...121132211121...','....1..111..1.....'
  ],
  skull:[
   '.....111111.....','...1156666511...','..156777766651..','.15677777776651.',
   '.15661111661151.','.15661111661151.','.15661111661151.','..156661166651..',
   '...1566116651...','...1566666651...','...1515151551...','....15151551....',
   '....13344331....','...1334444331...','..134341143431..','..13331..13331..',
   '...151....151...','...151....151...','..1551....1551..','..1111....1111..'
  ],
  bat:[
   '1......................1','131..................131','1341................1431','13431...1....1.....13431',
   '.13431..131..131..13431.','.134431.13411341.134431.','..13443113444431134431..','...133444417744444331...',
   '....1334441111444431....','.....13334344343331.....','......111344443111......','.........133331.........',
   '..........1111..........'
  ],
  batFold:[
   '...1................1...','...131..1....1....131...','...1341.131..131.1431...',
   '...134311341134113431...','....1344134444344431....','.....13444177444431.....','.....13344111444331.....',
   '......133434434331......','.......1134444311.......','.........133331.........','..........1111..........'
  ],
  lord:[
   '....11......11......11....','....171....1771....171....','....1761..176671..1671....',
   '....176611766667116671....','.....1566666666666651.....','.....1567777777776651.....',
   '....156666666666666651....','...15666111111116666651...','...15661177117711666651...',
   '...15661111111111666651...','....156666116666666651....','.....1556611666666551.....',
   '......15151515151551......','.......155555555551.......','......13333444333331......',
   '.....1344344444344431.....','....134443444434444431....','...13444434443444444431...',
   '..1334444344434444444331..','..1344444311134444444431..','...13444311111344444331...',
   '....133314444413344331....','.....1334444444433331.....','.....1334444444443331.....',
   '....133434444444343331....','...13343434444343433331...','..133434343443434343331..',
   '..122233333113333322221..','...11155511..115551111...','.....15541....14551......',
   '....155541....145551.....','....111111....111111.....'
  ]
 };
 const spriteCache=new Map();
 function sprite(name,x,y,scale=2,flip=false,flash=false,variant=0,target=ctx){
  const key=`${name}:${flash}:${variant}`;let atlas=spriteCache.get(key);
  if(!atlas){const rows=SPRITES[name];atlas=document.createElement('canvas');atlas.width=Math.max(...rows.map(r=>r.length));atlas.height=rows.length;const ac=atlas.getContext('2d');
   rows.forEach((row,iy)=>[...row].forEach((v,ix)=>{const n=Number(v);if(!n)return;let c=INK[n];if(flash&&n>1)c='#eeeeee';else if(variant===1&&n===5)c='#747474';else if(variant===2&&n===4)c='#888888';ac.fillStyle=c;ac.fillRect(ix,iy,1,1);}));spriteCache.set(key,atlas);
  }
  target.save();target.translate(Math.round(x/2)*2,Math.round(y/2)*2);if(flip)target.scale(-1,1);target.imageSmoothingEnabled=false;target.drawImage(atlas,-Math.floor(atlas.width/2)*scale,-atlas.height*scale,atlas.width*scale,atlas.height*scale);target.restore();
 }
 function resize(){const r=viewport.getBoundingClientRect();viewW=r.width;viewH=r.height;dpr=.5;canvas.width=Math.max(1,Math.ceil(viewW*dpr));canvas.height=Math.max(1,Math.ceil(viewH*dpr));ctx.imageSmoothingEnabled=false;}
 new ResizeObserver(resize).observe(viewport);
 function project(x,y,z=0){return{x:(x-y-camera.x+camera.y)*.78+viewW/2,y:(x+y-camera.x-camera.y)*.46+viewH*.54-z};}
 function worldOffset(sx,sy){return{x:sx/1.56+sy/.92,y:sy/.92-sx/1.56};}
 function poly(points,fill,stroke){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(Math.round(p[0]/2)*2,Math.round(p[1]/2)*2):ctx.moveTo(Math.round(p[0]/2)*2,Math.round(p[1]/2)*2));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}}
 function ellipse(x,y,rx,ry,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fill();}
 function px(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x/2)*2,Math.round(y/2)*2,Math.max(2,Math.round(w/2)*2),Math.max(2,Math.round(h/2)*2));}
 function shadow(x,y,size=1){ellipse(x,y+2,22*size,8*size,'#080808aa');}
 function drawTree(d){const p=project(d.x,d.y);ctx.save();if(g){const h=project(g.player.x,g.player.y);if(Math.abs(h.x-p.x)<45*d.size&&p.y-h.y>0&&p.y-h.y<120*d.size)ctx.globalAlpha=.3;}ctx.translate(Math.round(p.x/2)*2,Math.round(p.y/2)*2);ctx.scale(d.size>.95?1.2:.85,d.size>.95?1.2:.85);shadow(0,0,1.5);
  // Bare, stepped branches, carved into the fog rather than smooth polygons.
  px(-8,-70,14,70,'#090909');px(-6,-66,4,62,'#575757');px(-2,-70,4,46,'#333333');px(-12,-6,8,8,'#111111');px(4,-4,10,6,'#101010');
  px(-10,-82,8,24,'#111111');px(-16,-96,8,20,'#111111');px(-20,-112,6,20,'#111111');px(-28,-118,10,6,'#111111');px(-20,-94,2,18,'#5c5c5c');
  px(2,-68,14,8,'#131313');px(12,-82,8,20,'#131313');px(18,-100,6,24,'#131313');px(24,-104,18,6,'#131313');px(38,-118,6,20,'#131313');px(18,-94,2,16,'#666666');
  px(-28,-52,24,8,'#111111');px(-38,-66,14,8,'#111111');px(-42,-82,6,20,'#111111');px(-50,-90,12,6,'#111111');px(-34,-60,10,2,'#4c4c4c');
  px(2,-34,24,8,'#121212');px(22,-48,8,20,'#121212');px(28,-54,16,6,'#121212');px(42,-66,6,18,'#121212');px(24,-44,2,12,'#5a5a5a');
  for(let i=0;i<8;i++)px(-6+(i%3)*4,-8-i*8,2,4,i%2?'#262626':'#4d4d4d');ctx.restore();
 }
 function drawRock(d){const p=project(d.x,d.y);ctx.save();ctx.translate(Math.round(p.x/2)*2,Math.round(p.y/2)*2);const s=d.size>.9?1:.75;ctx.scale(s,s);shadow(0,0,1.1);
  px(-18,-6,36,10,'#0b0b0b');px(-14,-40,28,36,'#090909');px(-10,-48,20,8,'#090909');px(-10,-40,22,32,'#484848');px(-8,-46,16,10,'#646464');px(-10,-38,4,26,'#727272');px(8,-38,4,30,'#292929');
  px(-2,-36,4,18,'#b0b0b0');px(-8,-30,16,4,'#999999');px(-6,-14,12,2,'#252525');px(-12,-4,24,4,'#444444');ctx.restore();
 }
 function drawGrass(d){const p=project(d.x,d.y);const c=d.tint>.5?'#555555':'#343434';px(p.x,p.y-8,2,10,c);px(p.x-4,p.y-4,2,6,c);px(p.x+4,p.y-10,2,12,c);px(p.x+8,p.y-4,2,6,c);if(d.tint>.75){px(p.x-4,p.y,14,4,'#777777');px(p.x-4,p.y-2,4,2,'#999999');}}
 function drawRuin(d){const p=project(d.x,d.y);ctx.save();ctx.translate(Math.round(p.x/2)*2,Math.round(p.y/2)*2);ctx.scale(d.size,d.size);shadow(4,6,2.2);
  px(-40,-8,28,12,'#4a4a4a');px(22,10,28,12,'#3a3a3a');px(-34,-92,16,86,'#555555');px(-34,-92,4,86,'#888888');px(-20,-92,4,84,'#292929');px(28,-72,16,82,'#4b4b4b');px(28,-72,4,82,'#747474');px(40,-72,4,82,'#242424');
  px(-38,-100,24,8,'#8d8d8d');px(24,-80,24,8,'#858585');px(-30,-108,22,8,'#717171');px(-12,-118,22,10,'#777777');px(6,-126,16,10,'#999999');px(18,-116,16,10,'#646464');px(28,-104,14,10,'#626262');px(34,-92,12,12,'#606060');
  for(let i=0;i<5;i++){px(-30,-80+i*14,10,2,'#2c2c2c');px(30,-58+i*14,10,2,'#272727');}px(-32,-34,6,14,'#2f2f2f');px(-30,-26,2,16,'#7b7b7b');px(4,7,14,6,'#5c5c5c');px(9,3,12,4,'#8c8c8c');ctx.restore();
 }
 function drawTorch(d){const p=project(d.x,d.y),phase=Math.floor(ambient*7+d.x)%3;shadow(p.x,p.y,1);px(p.x-8,p.y-8,16,10,'#646464');px(p.x-4,p.y-30,8,24,'#444444');px(p.x-12,p.y-34,24,6,'#8a8a8a');
  const glow=ctx.createRadialGradient(p.x,p.y-46,3,p.x,p.y-46,55);glow.addColorStop(0,'#ffffff20');glow.addColorStop(1,'#ffffff00');ctx.fillStyle=glow;ctx.fillRect(p.x-55,p.y-101,110,110);
  px(p.x-8,p.y-44,16,10,'#8a8a8a');px(p.x-6,p.y-50,12,14,'#c5c5c5');px(p.x-4,p.y-58-phase*2,8,20,'#eeeeee');px(p.x+4,p.y-54+phase*2,4,10,'#aaaaaa');px(p.x-2,p.y-46,4,10,'#ffffff');
 }
 function drawPortrait(){const pc=$('heroPortrait');if(!pc)return;const c=pc.getContext('2d');c.clearRect(0,0,pc.width,pc.height);c.imageSmoothingEnabled=false;sprite(selectedHero===0?'knight':'hood',48,104,3,false,false,selectedHero,c);sprite('mace',14,86,2,false,false,selectedHero,c);}
 function drawHero(h,preview=false){const p=project(h.x,h.y),moving=!preview&&h.moving,bob=moving?(Math.floor(g.time*8)%2)*2:0,hero=g?g.hero:selectedHero;shadow(p.x,p.y,1.1);ctx.save();if(!preview&&h.inv>0&&Math.floor(ambient*12)%2===0)ctx.globalAlpha=.45;
  if(!preview&&h.dashing>0){px(p.x-20,p.y-12,40,6,'#ffffff33');px(p.x-28,p.y-6,36,4,'#ffffff55');}
  sprite(hero===0?'knight':'hood',p.x,p.y+bob,2,false,false,hero);
  ctx.save();ctx.translate(Math.round((p.x-23)/2)*2,Math.round((p.y-18+bob)/2)*2);const swing=!preview&&h.swing>0?Math.floor(Math.sin(h.swing/.22*Math.PI)*4)*.4:0;ctx.rotate(-.3+swing);sprite('mace',0,0,2);ctx.restore();ctx.restore();
 }
 function drawEnemy(e){const p=project(e.x,e.y),bob=(Math.floor(ambient*5+e.seed)%2)*2;shadow(p.x,p.y,e.boss?1.8:.8);const name=e.boss?'lord':e.kind===1?(Math.floor(ambient*9+e.seed)%2?'bat':'batFold'):e.kind===2?'skull':'wraith';sprite(name,p.x,p.y+bob-(e.kind===1?16:0),e.finalBoss?3.6:e.boss?3:2,false,e.flash>0,e.boss?(g?.location||0):0);
  if(e.finalBoss){const pulse=ambient*1.5;for(let i=0;i<8;i++){const a=i/8*TAU+pulse;px(p.x+Math.cos(a)*48,p.y-55+Math.sin(a)*16,4,4,'#dedede');}if(g.location===1){sprite('skull',p.x-43,p.y-25,1.2);sprite('skull',p.x+43,p.y-25,1.2);}if(g.location===2){px(p.x-36,p.y-101,6,52,'#9a9a9a');px(p.x+30,p.y-101,6,52,'#9a9a9a');}}
  if(e.hp<e.maxHp&&!e.boss){px(p.x-16,p.y-60,32,4,'#080808');px(p.x-16,p.y-60,32*Math.max(0,e.hp/e.maxHp),2,'#bcbcbc');}
 }
 function drawExtraDecor(d){const p=project(d.x,d.y),s=d.landmark?1.5:1;ctx.save();ctx.translate(Math.round(p.x/2)*2,Math.round(p.y/2)*2);ctx.scale(s,s);
  if(d.type==='pool'){ellipse(0,0,d.landmark?95:33,d.landmark?48:16,'#080808');for(let i=0;i<8;i++){const a=i/8*TAU;px(Math.cos(a)*26,Math.sin(a)*11,10,2,'#444444');}px(-15,-4,24,2,'#676767');px(10,4,17,2,'#333333');}
  else if(d.type==='bones'){shadow(0,0,.65);px(-16,-6,32,4,'#777777');px(-20,-8,6,8,'#b0b0b0');px(12,-8,6,8,'#b0b0b0');px(-6,-10,4,12,'#b5b5b5');px(2,-12,4,14,'#9b9b9b');px(-8,-6,18,2,'#d0d0d0');}
  else if(d.type==='grave'){poly([[-28,-4],[0,-17],[29,-4],[0,12]],'#080808');px(-10,-8,20,2,'#464646');px(-8,0,16,2,'#303030');}
  else if(d.type==='monument'){shadow(0,0,2);px(-23,-10,46,14,'#444444');px(-9,-108,18,100,'#696969');px(-29,-84,58,14,'#676767');px(-9,-108,4,100,'#b5b5b5');px(-29,-84,58,4,'#aaa');px(-3,-100,4,75,'#3b3b3b');}
  else{shadow(0,0,1);const h=d.type==='obelisk'?78:48;px(-12,-h,24,h,'#353535');px(-12,-h,5,h,'#8d8d8d');px(8,-h,4,h,'#202020');px(-16,-6,32,10,'#575757');px(-16,-h-6,32,6,'#777777');if(d.type==='obelisk'){px(-3,-h+10,6,24,'#c3c3c3');px(-7,-h+18,14,4,'#c3c3c3');}else for(let i=0;i<3;i++)px(-8,-h+12+i*12,16,2,'#1e1e1e');}
  ctx.restore();
 }
 let miniMapAtlas=null;
 function drawMiniMap(){const map=$('miniMap'),target=map.getContext('2d'),size=112,pad=5,span=size-pad*2;const mx=x=>pad+(x+WORLD)/(WORLD*2)*span,my=y=>pad+(y+WORLD)/(WORLD*2)*span;
  if(!miniMapAtlas){miniMapAtlas=document.createElement('canvas');miniMapAtlas.width=size;miniMapAtlas.height=size;const mc=miniMapAtlas.getContext('2d');mc.fillStyle='#080808';mc.fillRect(0,0,size,size);for(let x=pad;x<size-pad;x+=2)for(let y=pad;y<size-pad;y+=2){const zone=biomeAt((x-pad)/span*WORLD*2-WORLD,(y-pad)/span*WORLD*2-WORLD);mc.fillStyle=zone.tone;mc.fillRect(x,y,2,2);}}
  target.imageSmoothingEnabled=false;target.clearRect(0,0,size,size);target.drawImage(miniMapAtlas,0,0);
  for(const r of currentRegions()){const x=Math.round(mx(r.x)),y=Math.round(my(r.y)),known=!g||g.visited.has(r.id);target.fillStyle='#080808';target.fillRect(x-3,y-3,7,7);target.fillStyle=known?'#eeeeee':'#999999';target.fillRect(x-2,y-2,5,5);target.fillStyle='#080808';target.fillRect(x-1,y-1,3,3);}
  const h=g?g.player:{x:0,y:0};target.strokeStyle='#c6c6c6';target.lineWidth=1;target.beginPath();for(let i=0;i<4;i++){const o=worldOffset((i===0||i===3?-1:1)*viewW/2,(i<2?-1:1)*viewH/2);const x=mx(camera.x+o.x),y=my(camera.y+o.y);if(i)target.lineTo(x,y);else target.moveTo(x,y);}target.closePath();target.stroke();target.fillStyle='#080808';target.fillRect(Math.round(mx(h.x))-3,Math.round(my(h.y))-3,7,7);target.fillStyle='#ffffff';target.fillRect(Math.round(mx(h.x))-1,Math.round(my(h.y))-1,3,3);
  if(g?.portal){const x=Math.round(mx(g.portal.x)),y=Math.round(my(g.portal.y));target.strokeStyle='#ffffff';target.lineWidth=2;target.strokeRect(x-4,y-4,8,8);target.fillStyle='#080808';target.fillRect(x-2,y-2,4,4);}
  $('exploredCount').textContent=`${g?g.visited.size:1}/5`;
 }
 function updateRegion(){if(!g)return;const region=biomeAt(g.player.x,g.player.y);if(g.region!==region.id){g.region=region.id;if(!g.visited.has(region.id)){g.visited.add(region.id);effect('text',g.player.x,g.player.y,2,{text:region.name.toUpperCase(),color:'#eeeeee',z:90});}}$('areaName').textContent=region.name.toUpperCase();}
 function findSpawnPoint(){const p=g.player,radius=Math.max(viewW*.65,viewH*.8)+60,phase=Math.random()*TAU;for(let i=0;i<32;i++){const a=phase+i/32*TAU,o=worldOffset(Math.cos(a)*radius,Math.sin(a)*radius*.75),x=p.x+o.x,y=p.y+o.y;if(Math.abs(x)<WORLD-25&&Math.abs(y)<WORLD-25)return{x,y};}return{x:0,y:0};}

 function drawGround(){ctx.fillStyle='#181818';ctx.fillRect(0,0,viewW,viewH);const size=100,cx=Math.floor(camera.x/size),cy=Math.floor(camera.y/size),range=Math.ceil(Math.max(viewW,viewH)/80)+3;
  for(let x=cx-range;x<=cx+range;x++)for(let y=cy-range;y<=cy+range;y++){const a=project(x*size,y*size);if(a.x<-160||a.x>viewW+160||a.y<-120||a.y>viewH+120)continue;const b=project((x+1)*size,y*size),c=project((x+1)*size,(y+1)*size),d=project(x*size,(y+1)*size),n=Math.abs((x*31+y*17)%5),region=biomeAt((x+.5)*size,(y+.5)*size);poly([[a.x,a.y],[b.x,b.y],[c.x,c.y],[d.x,d.y]],region.ground[n],region.id===2?'#66666644':null);
   const seed=((x*73+y*47)>>>0)%101;
   for(let j=0;j<9;j++){const t=project(x*size+(seed+j*37)%100,y*size+(seed*3+j*23)%100);px(t.x,t.y,j%3===0?4:2,2,j%3===0?'#3a3a3a':'#292929');}
   if(n===2){const t=project(x*size+40,y*size+55);px(t.x,t.y,14,2,'#0e0e0e');px(t.x+10,t.y+2,6,2,'#101010');px(t.x+14,t.y+4,8,2,'#111111');}
   if(Math.abs(x*size)>WORLD||Math.abs(y*size)>WORLD)poly([[a.x,a.y],[b.x,b.y],[c.x,c.y],[d.x,d.y]],'#050505dd');
  }
  // A broken summoning circle, laid out in individual pixels and weathered flagstones.
  for(const landmark of currentRegions()){const center=project(landmark.x,landmark.y);if(center.x < -200 || center.x > viewW+200 || center.y < -140 || center.y > viewH+140)continue;for(let i=0;i<92;i++){const a=i/92*TAU;if(i%13===0||i%17===0)continue;const x=center.x+Math.cos(a)*150,y=center.y+Math.sin(a)*88;px(x,y,8,4,i%3===0?'#626262':'#454545');if(i%5===0)px(x+2,y+6,4,2,'#292929');}
  for(let i=0;i<8;i++){const a=i/8*TAU,p=project(landmark.x+Math.cos(a)*120,landmark.y+Math.sin(a)*120);px(p.x-4,p.y-6,8,12,'#606060');px(p.x-8,p.y-2,16,4,'#737373');px(p.x-2,p.y-4,4,8,'#1a1a1a');}}
 }
 function render(){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,viewW,viewH);ctx.save();if(g&&g.shake>0&&profile.shake)ctx.translate(Math.round((Math.random()-.5)*g.shake/2)*2,Math.round((Math.random()-.5)*g.shake/2)*2);drawGround();
  if(g)for(const gem of g.gems){const p=project(gem.x,gem.y),z=(Math.floor(ambient*3+gem.x)%2)*2;if(gem.heal){px(p.x-2,p.y-12-z,4,12,'#eeeeee');px(p.x-6,p.y-8-z,12,4,'#eeeeee');px(p.x-2,p.y-8-z,4,4,'#777777');}else{poly([[p.x,p.y-12-z],[p.x+6,p.y-6-z],[p.x,p.y-z],[p.x-6,p.y-6-z]],'#a0a0a0');px(p.x-2,p.y-10-z,2,6,'#f4f4f4');}}
  const actors=visibleDecor().filter(d=>{const p=project(d.x,d.y);return p.x>-130&&p.x<viewW+130&&p.y>-40&&p.y<viewH+170;}).map(d=>({depth:d.x+d.y,draw:()=>{if(d.type==='tree')drawTree(d);else if(d.type==='rock')drawRock(d);else if(d.type==='grass')drawGrass(d);else if(d.type==='ruin')drawRuin(d);else if(d.type==='torch')drawTorch(d);else drawExtraDecor(d);}}));
  if(g){if(g.portal)actors.push({depth:g.portal.x+g.portal.y,draw:drawPortal});for(const e of g.enemies){const p=project(e.x,e.y);if(p.x>-100&&p.x<viewW+100&&p.y>-100&&p.y<viewH+150)actors.push({depth:e.x+e.y,draw:()=>drawEnemy(e)});}actors.push({depth:g.player.x+g.player.y,draw:()=>drawHero(g.player)});}else{actors.push({depth:0,draw:()=>drawHero({x:0,y:0},true)});for(const e of [{x:210,y:80,kind:0,seed:1},{x:100,y:-190,kind:1,seed:3},{x:370,y:-110,kind:2,seed:7}])actors.push({depth:e.x+e.y,draw:()=>drawEnemy({...e,hp:10,maxHp:10})});}
  actors.sort((a,b)=>a.depth-b.depth);actors.forEach(a=>a.draw());
  if(g){for(const b of g.bolts){const p=project(b.x,b.y,18);px(p.x-4,p.y-4,8,8,'#eeeeee');px(p.x-8,p.y-2,16,4,'#eeeeee77');}
   for(const fx of g.effects){const p=project(fx.x,fx.y,fx.z||0),alpha=Math.max(0,fx.life/fx.max);ctx.globalAlpha=alpha;if(fx.type==='slash'){const r=(1-alpha)*g.player.range*.8+30;for(let i=0;i<17;i++){const a=fx.angle-1.8+i/16*3.6;px(p.x+Math.cos(a)*r,p.y-16+Math.sin(a)*r*.6,6,4,i%3===0?'#999999':'#eeeeee');}}else if(fx.type==='ring'){for(let i=0;i<24;i++){const a=i/24*TAU;px(p.x+Math.cos(a)*fx.radius*(1-alpha),p.y+Math.sin(a)*fx.radius*(1-alpha)*.58,4,2,'#dddddd');}}else if(fx.type==='text'){ctx.font=`${fx.big?14:10}px Pixel,monospace`;ctx.textAlign='center';ctx.fillStyle='#080808';ctx.fillText(fx.text,Math.round(p.x/2)*2+2,Math.round(p.y/2)*2+2);ctx.fillStyle='#eeeeee';ctx.fillText(fx.text,Math.round(p.x/2)*2,Math.round(p.y/2)*2);}else px(p.x,p.y,fx.size||4,fx.size||4,fx.color);ctx.globalAlpha=1;}
  }
  const fog=ctx.createRadialGradient(viewW*.55,viewH*.5,viewW*.16,viewW*.5,viewH*.5,Math.max(viewW,viewH)*.66);fog.addColorStop(0,'#00000000');fog.addColorStop(.65,'#05050522');fog.addColorStop(1,'#000000bb');ctx.fillStyle=fog;ctx.fillRect(0,0,viewW,viewH);
  for(let i=0;i<20;i++){const x=(i*137+Math.sin(ambient*.15+i)*24)%viewW,y=(i*79-ambient*(3+i%3)+viewH*100)%viewH;ctx.globalAlpha=.16+(Math.sin(ambient+i)+1)*.1;px(x,y,2,2,'#bcbcbc');}ctx.globalAlpha=1;ctx.restore();if(frameCount%6===0)drawMiniMap();
 }

 function sound(freq=240,duration=.06,type='triangle',volume=.035){if(!profile.sound)return;try{audioCtx??=new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();const o=audioCtx.createOscillator(),v=audioCtx.createGain();o.type=type;o.frequency.setValueAtTime(freq,audioCtx.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(25,freq*.45),audioCtx.currentTime+duration);v.gain.setValueAtTime(volume,audioCtx.currentTime);v.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+duration);o.connect(v);v.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+duration);}catch(e){}}
 function effect(type,x,y,life,extra={}){g.effects.push({type,x,y,life,max:life,...extra});}
 function burst(x,y,color,count=8){for(let i=0;i<count;i++)effect('particle',x,y,.3+Math.random()*.3,{z:12,vx:(Math.random()-.5)*150,vy:(Math.random()-.5)*150,vz:30+Math.random()*90,color,size:2+Math.random()*3});}
 function updateHero(){const h=heroes[selectedHero];$('heroName').textContent=h.name;$('heroDesc').textContent=h.desc;$('heroTraits').innerHTML=`<span>${h.role}</span><span>${h.trait}</span>`;drawPortrait();document.querySelector('.hero-card .section-label span').textContent=`0${selectedHero+1} / 03`;$('heroLabel').textContent=heroes[g?g.hero:selectedHero].name.toUpperCase();if(!g){$('hpText').textContent=`${h.hp} / ${h.hp}`;render();}}
 function changeHero(delta){if(state==='playing'||state==='paused'||state==='upgrade')return;selectedHero=(selectedHero+delta+heroes.length)%heroes.length;updateHero();}
 function start(){const hero=heroes[selectedHero];worldChunks.clear();miniMapAtlas=null;keys.clear();move={x:0,y:0};g={hero:selectedHero,location:0,stageTime:0,finalBossSpawned:false,locationCleared:false,portal:null,clearedLocations:0,region:0,visited:new Set([0]),time:0,kills:0,level:1,xp:0,nextXp:5,enemies:[],gems:[],effects:[],bolts:[],spawnTimer:.8,bossStage:0,bossesKilled:0,shake:0,upgrades:{},player:{x:0,y:0,hp:hero.hp,maxHp:hero.hp,speed:hero.speed,damage:hero.damage,range:110,cooldown:.8,attack:0,inv:1,dash:0,dashing:0,dx:1,dy:0,crit:.08,magnet:100,regen:0,bolt:0,boltTimer:1,swing:0,moving:false}};state='playing';$('heroLabel').textContent=hero.name.toUpperCase();camera={x:0,y:0};document.querySelectorAll('.screen-overlay').forEach(el=>el.classList.add('hidden'));viewport.classList.add('playing');$('hud').classList.remove('hidden');$('pause').textContent='Ⅱ';$('bossHud').classList.add('hidden');$('zoneLabel').classList.add('hidden');syncLocationUI();updateBuild();updateHud();sound(390,.15);canvas.focus({preventScroll:true});}
 function setPause(shouldPause){if(shouldPause&&state==='playing'){state='paused';$('pauseScreen').classList.remove('hidden');keys.clear();move={x:0,y:0};$('pause').textContent='▶';}else if(!shouldPause&&state==='paused'){state='playing';$('pauseScreen').classList.add('hidden');$('pause').textContent='Ⅱ';canvas.focus({preventScroll:true});}updateHud();}
 function dash(){if(state!=='playing'||g.player.dash>0)return;const h=g.player;h.dashing=.18;h.dash=3;h.inv=Math.max(h.inv,.3);if(!h.moving){h.dx=Math.SQRT1_2;h.dy=-Math.SQRT1_2;}effect('ring',h.x,h.y,.4,{color:'#e8e8e8',radius:75});sound(150,.12,'sawtooth',.025);}
 function spawn(boss=false,finalBoss=false){const point=findSpawnPoint(),threat=g.stageTime/60+g.location*2;const kind=boss?2:Math.random()<.28?1:Math.random()<.27?2:0;
  const hp=finalBoss?1800+g.location*1200:boss?320+g.bossStage*170+g.location*450:(kind===2?40+threat*7:kind===1?18+threat*4:25+threat*5)*(1+g.location*.35);
  const enemy={x:point.x,y:point.y,kind,boss,finalBoss,hp,maxHp:hp,speed:boss?45+threat*4:kind===1?92+threat*6:kind===2?42+threat*4:51+threat*5,damage:boss?(finalBoss?32:26)+g.location*5:(kind===2?13:kind===1?7:9)+g.location*3,flash:0,seed:Math.random()*TAU,variant:Math.random()<.4};g.enemies.push(enemy);
  if(boss){effect('text',g.player.x,g.player.y,2.5,{text:finalBoss?currentLocation().boss.toUpperCase():'ХРАНИТЕЛЬ ПРОБУДИЛСЯ',color:'#bebebe',z:105,big:false});sound(90,.4,'sawtooth',.05);updateHud();}return enemy;
 }
 function syncLocationUI(){const index=g?.location||0,location=LOCATIONS[index];
  $('chapterName').textContent=location.name.toUpperCase();$('chapterNumber').textContent=`ЛОКАЦИЯ ${index+1} / ${LOCATIONS.length}`;
  for(let i=0;i<LOCATIONS.length;i++){const el=$('route'+i),done=(g?.clearedLocations||0)>i;el.classList.toggle('current',i===index);el.classList.toggle('completed',done);if(i===index)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');$('routeStatus'+i).textContent=done?'ПРОЙДЕНА':i===index?'ТЕКУЩАЯ':'ЗА ПОРТАЛОМ';}
  $('goalTitle').textContent=`${index+1} / ${LOCATIONS.length} · ${location.name}`;$('goalText').textContent=`На 05:00 появится ${location.boss}. Победи его и войди в портал.`;
  $('locationNotice').classList.toggle('hidden',!g);$('noticeTitle').textContent=location.name;$('noticeNumber').textContent=`ЛОКАЦИЯ ${index+1} / ${LOCATIONS.length}`;
 }
 function openPortal(enemy){if(g.locationCleared)return;g.locationCleared=true;g.clearedLocations=g.location+1;
  // Remove the remaining horde safely after the attack loop; drops stay available until entry.
  for(const other of g.enemies)other.hp=0;
  g.portal={x:Math.max(-WORLD+130,Math.min(WORLD-130,enemy.x)),y:Math.max(-WORLD+130,Math.min(WORLD-130,enemy.y)),exit:g.location===LOCATIONS.length-1};
  effect('ring',g.portal.x,g.portal.y,1.2,{radius:180});effect('text',g.player.x,g.player.y,3,{text:'ПОРТАЛ ОТКРЫТ',z:100});sound(640,.4,'sine',.06);syncLocationUI();updateHud();
 }
 function enterPortal(){if(!g||state!=='playing'||!g.portal||Math.hypot(g.player.x-g.portal.x,g.player.y-g.portal.y)>145)return false;
  if(g.portal.exit){finish(true);return true;}
  g.location++;g.stageTime=0;g.region=0;g.visited=new Set([0]);g.bossStage=0;g.finalBossSpawned=false;g.locationCleared=false;g.portal=null;
  g.enemies=[];g.gems=[];g.effects=[];g.bolts=[];g.spawnTimer=1.5;g.shake=0;
  Object.assign(g.player,{x:0,y:0,hp:g.player.maxHp,inv:2,dash:0,dashing:0,attack:.5,swing:0,moving:false});
  keys.clear();move={x:0,y:0};touchOrigin=null;knob.style.transform='';camera={x:0,y:0};worldChunks.clear();miniMapAtlas=null;
  syncLocationUI();updateHud();drawMiniMap();sound(460,.3,'sine',.05);canvas.focus({preventScroll:true});return true;
 }
 function drawPortal(){const portal=g.portal,p=project(portal.x,portal.y),phase=ambient*2;shadow(p.x,p.y,2);
  for(let i=0;i<28;i++){const a=i/28*TAU;px(p.x+Math.cos(a)*49,p.y+Math.sin(a)*25,6,3,i%3?'#777777':'#eeeeee');}
  px(p.x-27,p.y-76,54,71,'#050505');px(p.x-19,p.y-92,38,92,'#050505');
  for(let i=0;i<40;i++){const a=i/40*TAU,x=p.x+Math.cos(a)*29,y=p.y-47+Math.sin(a)*47;px(x,y,6,6,i%4===Math.floor(phase)%4?'#ffffff':'#989898');}
  for(let i=0;i<12;i++){const a=i*2.4+phase,r=9+i%4*4;px(p.x+Math.cos(a)*r,p.y-48+Math.sin(a)*r*1.5,3,5,i%2?'#eeeeee':'#686868');}
  const near=Math.hypot(g.player.x-portal.x,g.player.y-portal.y)<=145;ctx.font='8px Pixel,monospace';ctx.textAlign='center';ctx.fillStyle='#eeeeee';ctx.fillText(near?'[ E ] ВОЙТИ':'ПОРТАЛ',Math.round(p.x),Math.round(p.y-108));
 }
 function damageEnemy(e,amount,knock=true){if(e.hp<=0)return;const crit=Math.random()<g.player.crit;let damage=Math.round(amount*(crit?2:1));e.hp-=damage;e.flash=.1;effect('text',e.x,e.y,.65,{text:String(damage)+(crit?'!':''),color:crit?'#d6d6d6':'#f0f0f0',z:43,big:crit,vz:32});if(knock){const a=Math.atan2(e.y-g.player.y,e.x-g.player.x);e.x+=Math.cos(a)*(e.boss?4:17);e.y+=Math.sin(a)*(e.boss?4:17);}if(e.hp<=0){g.kills++;burst(e.x,e.y,e.kind===0?'#bcbcbc':'#acacac',e.boss?30:8);g.gems.push({x:e.x,y:e.y,value:e.boss?22:e.kind===2?3:1,heal:false});if(Math.random()<.06||e.boss)g.gems.push({x:e.x+15,y:e.y,value:e.boss?35:12,heal:true});if(e.boss){g.bossesKilled++;g.shake=8;sound(100,.3,'square',.03);if(e.finalBoss)openPortal(e);}else sound(190+Math.random()*100,.05,'triangle',.025);}}
 function update(dt){const h=g.player;if(!g.locationCleared){g.time+=dt;g.stageTime+=dt;}h.inv=Math.max(0,h.inv-dt);h.dash=Math.max(0,h.dash-dt);h.dashing=Math.max(0,h.dashing-dt);h.swing=Math.max(0,h.swing-dt);g.shake=Math.max(0,g.shake-dt*30);h.hp=Math.min(h.maxHp,h.hp+h.regen*dt);
  let sx=move.x,sy=move.y;if(keys.has('KeyW')||keys.has('ArrowUp'))sy--;if(keys.has('KeyS')||keys.has('ArrowDown'))sy++;if(keys.has('KeyA')||keys.has('ArrowLeft'))sx--;if(keys.has('KeyD')||keys.has('ArrowRight'))sx++;
  let len=Math.hypot(sx,sy);h.moving=len>.05;
  if(len>.05){sx/=Math.max(1,len);sy/=Math.max(1,len);const off=worldOffset(sx,sy);const d=Math.hypot(off.x,off.y);h.dx=off.x/d;h.dy=off.y/d;}
  if(h.moving||h.dashing>0){const speed=h.speed*(h.dashing>0?4.5:1);h.x=Math.max(-WORLD+30,Math.min(WORLD-30,h.x+h.dx*speed*dt));h.y=Math.max(-WORLD+30,Math.min(WORLD-30,h.y+h.dy*speed*dt));if(h.dashing>0&&frameCount%2===0)burst(h.x,h.y,'#e3e3e3',1);}
  camera.x+=(h.x-camera.x)*Math.min(1,dt*8);camera.y+=(h.y-camera.y)*Math.min(1,dt*8);
  updateRegion();if(!g.locationCleared){g.spawnTimer-=dt;if(g.spawnTimer<=0){g.spawnTimer=Math.max(.18,1-g.stageTime/350-g.location*.08);const count=1+Math.floor(g.stageTime/90)+g.location;for(let i=0;i<count;i++)if(g.enemies.length<160)spawn();}
   const nextBoss=Math.min(4,Math.floor(g.stageTime/60));if(nextBoss>g.bossStage){g.bossStage=nextBoss;spawn(true);}
   if(g.stageTime>=DURATION&&!g.finalBossSpawned){g.finalBossSpawned=true;spawn(true,true);}}
  h.attack-=dt;let nearest=null,nearDist=Infinity;
  for(const e of g.enemies){if(e.hp<=0)continue;const dist=Math.hypot(e.x-h.x,e.y-h.y);if(dist<nearDist){nearest=e;nearDist=dist;}const angle=Math.atan2(h.y-e.y,h.x-e.x);if(dist>15){e.x+=Math.cos(angle)*e.speed*dt;e.y+=Math.sin(angle)*e.speed*dt;}e.flash=Math.max(0,e.flash-dt);if(dist<(e.boss?47:25)&&h.inv<=0){h.hp-=e.damage;h.inv=.7;g.shake=7;effect('text',h.x,h.y,.75,{text:`−${e.damage}`,color:'#b7b7b7',z:65,vz:25});burst(h.x,h.y,'#b1b1b1',6);sound(80,.1,'sawtooth',.035);if(h.hp<=0){finish(false);return;}}}
  if(h.attack<=0&&nearest&&nearDist<h.range){h.attack=h.cooldown;h.swing=.22;const p1=project(h.x,h.y),p2=project(nearest.x,nearest.y);const angle=Math.atan2((p2.y-p1.y)/.6,p2.x-p1.x);effect('slash',h.x,h.y,.23,{angle,color:'#d5d5d5'});for(const e of g.enemies)if(Math.hypot(e.x-h.x,e.y-h.y)<h.range+(e.boss?20:0))damageEnemy(e,h.damage);sound(130,.07,'triangle',.04);g.shake=Math.max(g.shake,2);}
  if(h.bolt>0){h.boltTimer-=dt;if(h.boltTimer<=0&&nearest){h.boltTimer=Math.max(.25,1.4-h.bolt*.14);const a=Math.atan2(nearest.y-h.y,nearest.x-h.x);g.bolts.push({x:h.x,y:h.y,vx:Math.cos(a)*460,vy:Math.sin(a)*460,life:1.8,damage:14+h.bolt*9});}}
  for(const b of g.bolts){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;for(const e of g.enemies){if(e.hp>0&&Math.hypot(e.x-b.x,e.y-b.y)<(e.boss?40:23)){damageEnemy(e,b.damage);b.life=0;break;}}}g.bolts=g.bolts.filter(b=>b.life>0);
  for(const gem of g.gems){let dist=Math.hypot(gem.x-h.x,gem.y-h.y);if(dist<h.magnet){const a=Math.atan2(h.y-gem.y,h.x-gem.x);const speed=240+(h.magnet-dist)*3;gem.x+=Math.cos(a)*speed*dt;gem.y+=Math.sin(a)*speed*dt;}if(dist<24){gem.collected=true;if(gem.heal){h.hp=Math.min(h.maxHp,h.hp+gem.value);effect('text',h.x,h.y,.8,{text:`+${gem.value} HP`,color:'#e8e8e8',z:60,vz:20});}else{g.xp+=gem.value;sound(570,.04,'sine',.018);}}}
  g.gems=g.gems.filter(x=>!x.collected);g.enemies=g.enemies.filter(e=>e.hp>0);
  // Merge distant experience drops to keep long runs smooth without losing XP.
  if(g.gems.length>300){const distant=g.gems.filter(v=>!v.heal&&Math.hypot(v.x-h.x,v.y-h.y)>550);if(distant.length>1){const total=distant.reduce((s,v)=>s+v.value,0);const keep=distant[0];keep.value=total;const remove=new Set(distant.slice(1));g.gems=g.gems.filter(v=>!remove.has(v));}}
  for(const fx of g.effects){fx.life-=dt;if(fx.vx)fx.x+=fx.vx*dt;if(fx.vy)fx.y+=fx.vy*dt;if(fx.vz)fx.z=(fx.z||0)+fx.vz*dt;}g.effects=g.effects.filter(fx=>fx.life>0);
  $('locationNotice').classList.toggle('hidden',g.stageTime>4||g.locationCleared);
  if(g.xp>=g.nextXp){g.xp-=g.nextXp;g.level++;g.nextXp=Math.floor(g.nextXp*1.22+3);showUpgrades();}
  if(frameCount%4===0)updateHud();
 }
 const upgrades=[
  {id:'damage',icon:'⚒',name:'Тяжёлая рука',desc:'+25% к урону дубины. Каждый бонк ощутимее.',apply:h=>h.damage*=1.25},
  {id:'speedAttack',icon:'»',name:'Бонк за бонком',desc:'Атаки на 18% быстрее. Ритм решает.',apply:h=>h.cooldown=Math.max(.15,h.cooldown*.82)},
  {id:'range',icon:'◉',name:'Широкий размах',desc:'+22% к радиусу удара. Задень всех.',apply:h=>h.range*=1.22},
  {id:'hp',icon:'♥',name:'Крепкий орешек',desc:'+25 к максимуму здоровья и лечение на 35 HP.',apply:h=>{h.maxHp+=25;h.hp=Math.min(h.maxHp,h.hp+35);}},
  {id:'magnet',icon:'⟡',name:'Жадные карманы',desc:'+45% к радиусу сбора опыта и лечения.',apply:h=>h.magnet*=1.45},
  {id:'speed',icon:'↯',name:'Ветер в пятках',desc:'+15% к скорости передвижения.',apply:h=>h.speed*=1.15},
  {id:'crit',icon:'✦',name:'Счастливый удар',desc:'+12% шанс нанести двойной урон.',apply:h=>h.crit=Math.min(.95,h.crit+.12)},
  {id:'regen',icon:'✳',name:'Второе дыхание',desc:'Восстанавливай 1,5 HP каждую секунду.',apply:h=>h.regen+=1.5},
  {id:'bolt',icon:'☄',name:'Лесная искра',desc:'Магический снаряд сам ищет врага. Повтор усиливает.',apply:h=>h.bolt++}
 ];
 function showUpgrades(){state='upgrade';keys.clear();move={x:0,y:0};$('newLevel').textContent=String(g.level).padStart(2,'0');$('upgradeCards').replaceChildren();const perkCount=Object.keys(g.upgrades).filter(id=>id!=='damage').length;const pool=upgrades.filter(u=>(u.id!=='crit'||g.player.crit<.95)&&(u.id==='damage'||g.upgrades[u.id]||perkCount<5));const choices=pool.map(u=>({u,r:Math.random()})).sort((a,b)=>a.r-b.r).slice(0,3).map(v=>v.u);for(const u of choices){const btn=document.createElement('button');btn.className='upgrade-card';btn.innerHTML=`<span>${u.icon}</span><b>${u.name}</b><small>${u.desc}</small><i>ВЫБРАТЬ →</i>`;btn.onclick=()=>{if(state!=='upgrade')return;u.apply(g.player);g.upgrades[u.id]=(g.upgrades[u.id]||0)+1;state='playing';$('upgradeScreen').classList.add('hidden');updateBuild();updateHud();sound(720,.16);canvas.focus({preventScroll:true});};$('upgradeCards').append(btn);}$('upgradeScreen').classList.remove('hidden');sound(620,.24,'sine',.06);updateHud();}
 function updateBuild(){const count=g?Object.keys(g.upgrades).filter(id=>id!=='damage').length:0;const damageLvl=1+(g?.upgrades.damage||0);$('weaponLevel').textContent=`УРОВЕНЬ ${damageLvl}`;$('weaponStars').innerHTML='★'.repeat(Math.min(5,damageLvl))+`<i>${'★'.repeat(Math.max(0,5-damageLvl))}</i>`;$('buildCount').textContent=`${Math.min(6,count+1)} / 6`;$('buildSlots').replaceChildren();const acquired=g?Object.entries(g.upgrades).filter(([id])=>id!=='damage'):[];for(let i=0;i<5;i++){const slot=document.createElement('span');if(acquired[i]){const [id,n]=acquired[i],u=upgrades.find(v=>v.id===id);slot.className='filled';slot.textContent=u.icon;slot.title=`${u.name} · ур. ${n}`;}else slot.textContent='＋';$('buildSlots').append(slot);}}
 function updateHud(){if(!g)return;updateRegion();const h=g.player;$('hpText').textContent=`${Math.ceil(Math.max(0,h.hp))} / ${h.maxHp}`;$('hpFill').style.width=`${Math.max(0,h.hp/h.maxHp)*100}%`;$('hpFill').style.background=h.hp/h.maxHp<.3?'#a8a8a8':'#d8d8d8';$('timer').textContent=formatTime(g.stageTime);$('kills').textContent=g.kills;$('levelLabel').textContent=`УР. ${String(g.level).padStart(2,'0')}`;$('xpFill').style.width=`${Math.min(100,g.xp/g.nextXp*100)}%`;$('xpText').textContent=`${g.xp} / ${g.nextXp} XP`;$('dashIndicator').classList.toggle('cooldown',h.dash>0);$('dashIndicator').innerHTML=`<span>↯</span> ${h.dash>0?h.dash.toFixed(1)+' С':'РЫВОК'} <kbd>SPACE</kbd>`;const bosses=g.enemies.filter(e=>e.boss&&e.hp>0);$('stageHint').textContent=g.locationCleared?'ПОРТАЛ ОТКРЫТ':`ЛОКАЦИЯ ${g.location+1} / 3 · ${g.finalBossSpawned?'ФИНАЛЬНЫЙ БОСС':'БОСС В 05:00'}`;
  $('portalPanel').classList.toggle('hidden',!g.portal||state!=='playing');if(g.portal){const distance=Math.hypot(h.x-g.portal.x,h.y-g.portal.y),near=distance<=145;$('portalHelp').textContent=g.portal.exit?'Последний портал завершает поход':'Уровень и сборка сохранятся · здоровье восстановится';$('portalDestination').textContent=g.portal.exit?'ВОЗВРАЩЕНИЕ ИЗ БЕЗДНЫ':`ДАЛЕЕ: ${LOCATIONS[g.location+1].name.toUpperCase()}`;$('enterPortal').disabled=!near;$('enterPortal').textContent=near?(g.portal.exit?'E · ЗАВЕРШИТЬ ПОХОД →':'E · ВОЙТИ В ПОРТАЛ →'):`ПОДОЙДИ К ПОРТАЛУ · ${Math.ceil(distance)} М`;}$('bossName').textContent=bosses.some(e=>e.finalBoss)?currentLocation().boss.toUpperCase():'ХРАНИТЕЛЬ · '+currentLocation().name.toUpperCase();viewport.classList.toggle('boss-active',state!=='over'&&bosses.length>0);$('bossHud').classList.toggle('hidden',state==='over'||!bosses.length);if(bosses.length)$('bossFill').style.width=`${bosses.reduce((n,e)=>n+Math.max(0,e.hp),0)/bosses.reduce((n,e)=>n+e.maxHp,0)*100}%`;}
 function finish(won){if(!g||state==='over')return;state='over';keys.clear();move={x:0,y:0};viewport.classList.remove('playing');document.querySelectorAll('.screen-overlay').forEach(el=>el.classList.add('hidden'));$('endScreen').classList.remove('hidden');$('endTag').textContent=won?'ТЬМА ЗАПОМНИТ ТВОЁ ИМЯ':'ЭТО БЫЛО СЛАВНО';$('endTitle').textContent=won?'Легенда бонка.':'Ещё один бонк?';const newRecord=g.time>profile.best;$('endDescription').textContent=won?'Три локации пройдены. Владыка бездны повержен.':newRecord?'Новый личный рекорд. Дальше — больше.':'Тьма победила. Пока что.';$('endTime').textContent=formatTime(g.time);$('endKills').textContent=g.kills;$('endLevel').textContent=g.level;profile.best=Math.max(profile.best,g.time);profile.kills+=g.kills;profile.runs.unshift({time:Math.floor(g.time),kills:g.kills,level:g.level,hero:heroes[g.hero].name,locations:g.clearedLocations,won,date:new Date().toISOString()});profile.runs=profile.runs.slice(0,15);persist();$('bestTime').innerHTML=`${formatTime(profile.best)} <span>↗</span>`;$('bossHud').classList.add('hidden');$('locationNotice').classList.add('hidden');sound(won?700:100,.5,'triangle',.06);updateHud();}
 function home(){state='home';g=null;worldChunks.clear();miniMapAtlas=null;syncLocationUI();$('stageHint').textContent='ЛОКАЦИЯ 1 / 3 · БОСС В 05:00';$('portalPanel').classList.add('hidden');$('areaName').textContent=REGIONS[0].name.toUpperCase();viewport.classList.remove('boss-active');camera={x:-220,y:0};viewport.classList.remove('playing');document.querySelectorAll('.screen-overlay').forEach(el=>el.classList.add('hidden'));$('startScreen').classList.remove('hidden');$('bossHud').classList.add('hidden');$('zoneLabel').classList.remove('hidden');$('hpFill').style.width='100%';$('hpFill').style.background='#d8d8d8';$('timer').textContent='00:00';$('kills').textContent='0';$('levelLabel').textContent='УР. 01';$('xpFill').style.width='0%';$('xpText').textContent='0 / 5 XP';$('pause').textContent='Ⅱ';updateBuild();updateHero();}
 function modal(title,content){pausedByModal=state==='playing';if(pausedByModal)setPause(true);$('modalEyebrow').textContent=title;$('modalContent').innerHTML=content;$('infoDialog').showModal();}
 function closeModal(){$('infoDialog').close();if(pausedByModal&&state==='paused')setPause(false);pausedByModal=false;document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.panel==='play'));}
 function showHelp(){modal('ПОЛЕВОЕ РУКОВОДСТВО','<h2>Всё начинается с бонка.</h2><ul class="help-list"><li><b>01 / Двигайся.</b> WASD или стрелки. На телефоне — джойстик слева. Удары по ближайшим врагам автоматические.</li><li><b>02 / Уклоняйся.</b> Пробел или кнопка ↯ — рывок с короткой неуязвимостью. Перезарядка — 3 секунды.</li><li><b>03 / Становись сильнее.</b> Собирай ромбовидные кристаллы опыта. На новом уровне выбирай одно из трёх улучшений. Кресты восстанавливают здоровье.</li><li><b>04 / Продержись.</b> На каждой локации хранители приходят раз в минуту, а на 05:00 появляется финальный босс. После его гибели орда исчезнет и откроется портал. Таймер показывает время текущей локации. ESC — пауза.</li><li><b>05 / Исследуй.</b> Мир стал в девять раз больше: пять областей, руины и ориентиры. На мини-карте белая точка — герой, квадраты — центры областей. Счётчик показывает посещённые области текущей локации.</li><li><b>06 / Войди в портал.</b> Подойди к порталу и нажми E или кнопку на экране. Три локации проходятся по порядку: Расколотые земли, Костяные катакомбы, Обсидиановая цитадель. Уровень, опыт и улучшения сохраняются, здоровье полностью восстанавливается. Последний портал завершает поход.</li></ul>');}
 function showArsenal(){modal('АРСЕНАЛ','<h2>Выбери свой характер.</h2><p>Три героя доступны сразу. Выбор применяется к следующему забегу.</p><div class="arsenal-grid">'+heroes.map((h,i)=>`<div class="arsenal-item"><strong>${['⚒','✳','↯'][i]}</strong><h3>${h.name}</h3><p>${h.desc}<br>${h.hp} HP · ${h.trait}<br>${Math.round(h.damage)} урона · ${h.speed} скорости</p><button data-hero="${i}">${selectedHero===i?'ВЫБРАН':'ВЫБРАТЬ ГЕРОЯ'}</button></div>`).join('')+'</div>');$('modalContent').querySelectorAll('[data-hero]').forEach(btn=>btn.onclick=()=>{selectedHero=Number(btn.dataset.hero);updateHero();if(g&&['playing','paused','upgrade'].includes(state))$('heroDesc').textContent='Выбран для следующего забега';closeModal();});}
 function showRecords(){const rows=profile.runs.map((r,i)=>`<tr><td>${String(i+1).padStart(2,'0')}</td><td>${heroes.some(h=>h.name===r.hero)?r.hero:heroes[0].name}</td><td>${formatTime(Number(r.time)||0)}${r.won?' ✦':''}</td><td>${Number(r.kills)||0}</td><td>${Number(r.level)||1}</td></tr>`).join('');modal('ХРОНИКА','<h2>Здесь рождаются легенды.</h2>'+`<p>Лучший забег: <b>${formatTime(profile.best)}</b> · Всего повержено: <b>${Number(profile.kills)||0}</b><br>Последние 15 забегов сохраняются в этом браузере.</p>`+(rows?`<table class="records-table"><thead><tr><th>#</th><th>ГЕРОЙ</th><th>ВРЕМЯ</th><th>ПОБЕЖДЕНО</th><th>УР.</th></tr></thead><tbody>${rows}</tbody></table>`:'<p>Твоя хроника пока пуста. Самое время начать первый забег.</p>'));}
 function updateSoundButton(){$('sound').textContent=profile.sound?'♫':'♪';$('sound').style.color=profile.sound?'#e1e1e1':'';$('sound').setAttribute('aria-label',profile.sound?'Выключить звук':'Включить звук');$('sound').title=profile.sound?'Выключить звук':'Включить звук';}
 function toggleSound(){profile.sound=!profile.sound;persist();updateSoundButton();if(profile.sound)sound(600,.1);}
 function showSettings(){modal('НАСТРОЙКИ','<h2>Игра по твоим правилам.</h2><p>Настройки и рекорды сохраняются на этом устройстве.</p><div class="setting-row"><span>Звуковые эффекты</span><button id="settingSound"></button></div><div class="setting-row"><span>Тряска камеры</span><button id="settingShake"></button></div>');const sync=()=>{$('settingSound').textContent=profile.sound?'Включены':'Выключены';$('settingShake').textContent=profile.shake?'Включена':'Выключена';};sync();$('settingSound').onclick=()=>{toggleSound();sync();};$('settingShake').onclick=()=>{profile.shake=!profile.shake;persist();sync();};}
 $('start').onclick=start;$('restart').onclick=start;$('backHome').onclick=home;$('pause').onclick=()=>setPause(state==='playing');$('resume').onclick=()=>setPause(false);$('quit').onclick=()=>finish(false);$('prevHero').onclick=()=>changeHero(-1);$('nextHero').onclick=()=>changeHero(1);$('sound').onclick=toggleSound;$('help').onclick=showHelp;$('settings').onclick=showSettings;$('closeDialog').onclick=closeModal;
 $('infoDialog').addEventListener('cancel',e=>{e.preventDefault();closeModal();});$('infoDialog').addEventListener('click',e=>{if(e.target===$('infoDialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});
 document.querySelectorAll('[data-panel]').forEach(el=>el.onclick=()=>{if(el.dataset.panel==='play'){if($('infoDialog').open)closeModal();canvas.scrollIntoView({behavior:'smooth',block:'center'});return;}document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x===el));if(el.dataset.panel==='arsenal')showArsenal();else showRecords();});
 $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.arena-shell').requestFullscreen();}catch(e){modal('ПОЛНЫЙ ЭКРАН','<h2>Больше места для бонка.</h2><p>Браузер не разрешил полноэкранный режим в этом окне. Открой игру в отдельной вкладке и нажми ⛶ ещё раз.</p>');}};
 window.addEventListener('keydown',e=>{if($('infoDialog').open)return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)&&['playing','paused','upgrade'].includes(state))e.preventDefault();if(e.code==='Escape'&&!e.repeat){if(state==='playing')setPause(true);else if(state==='paused')setPause(false);}if(e.code==='Space'&&!e.repeat)dash();if(e.code==='KeyE'&&!e.repeat){e.preventDefault();enterPortal();}keys.add(e.code);});window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();move={x:0,y:0};if(state==='playing')setPause(true);});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')setPause(true);});
 const joystick=$('joystick'),knob=joystick.firstElementChild;
 joystick.addEventListener('pointerdown',e=>{e.preventDefault();joystick.setPointerCapture(e.pointerId);const r=joystick.getBoundingClientRect();touchOrigin={x:r.left+r.width/2,y:r.top+r.height/2};updateStick(e);});
 function updateStick(e){if(!touchOrigin)return;let x=e.clientX-touchOrigin.x,y=e.clientY-touchOrigin.y,len=Math.hypot(x,y);if(len>28){x=x/len*28;y=y/len*28;}move={x:x/28,y:y/28};knob.style.transform=`translate(${x}px,${y}px)`;}
 joystick.addEventListener('pointermove',updateStick);const releaseStick=()=>{touchOrigin=null;move={x:0,y:0};knob.style.transform='';};joystick.addEventListener('pointerup',releaseStick);joystick.addEventListener('pointercancel',releaseStick);joystick.addEventListener('lostpointercapture',releaseStick);$('touchDash').onclick=dash;$('enterPortal').onclick=enterPortal;
 function frame(ts){const dt=Math.min((ts-lastFrame)/1000||.016,.04);lastFrame=ts;ambient+=dt;frameCount++;if(state==='playing')update(dt);render();requestAnimationFrame(frame);}
 $('bestTime').innerHTML=`${formatTime(Number(profile.best)||0)} <span>↗</span>`;updateSoundButton();syncLocationUI();updateHero();resize();requestAnimationFrame(frame);
})();
