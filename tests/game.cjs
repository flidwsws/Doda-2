// Run with Node.js: node tests/game.cjs
// Executes the production game in a DOM/canvas sandbox and simulates a complete campaign.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
class Element {
 constructor(){this.style={};this.children=[];this.firstElementChild={style:{}};this.dataset={};this.open=false;this.textContent='';this.className='';this.innerHTML='';this.classes=new Set();this.classList={add:(...v)=>v.forEach(x=>this.classes.add(x)),remove:(...v)=>v.forEach(x=>this.classes.delete(x)),toggle:(v,flag)=>flag?this.classes.add(v):this.classes.delete(v)};}
 append(c){this.children.push(c);} replaceChildren(...c){this.children=c;} addEventListener(){} focus(){} setAttribute(){} removeAttribute(){} getBoundingClientRect(){return {width:900,height:550};} scrollIntoView(){} showModal(){this.open=true;} close(){this.open=false;} querySelectorAll(){return [];} getContext(){return context;}
}
const noop=()=>{},gradient={addColorStop:noop};
const context=new Proxy({createRadialGradient:()=>gradient},{get:(o,k)=>k in o?o[k]:noop,set:(o,k,v)=>(o[k]=v,true)});
const els=new Map(),get=id=>{if(!els.has(id))els.set(id,new Element());return els.get(id);};
const storage=new Map([['dodabonk-v1',JSON.stringify({best:120,runs:[{hero:'Додик',time:120},{hero:'Моховик',time:60},{hero:'Искра',time:30}]})]]);
const sandbox={console,Math,Set,Date,JSON,window:{devicePixelRatio:1,addEventListener:noop},document:{getElementById:get,querySelector:get,querySelectorAll:()=>[],createElement:()=>new Element(),addEventListener:noop},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},ResizeObserver:class{observe(){}},requestAnimationFrame:noop};
const filename=process.argv[2]||require('node:path').resolve(__dirname,'../dist/game.js');let source=fs.readFileSync(filename,'utf8');
source=source.replace(/\}\)\(\);\s*$/,`globalThis.test={frame,SWORD,PART_LIMIT,beginSword,updateSword,bladeTouches,severEnemy,updateParts,clipCutPolygon,buildHeroMesh,projectHeroMesh,heroFacing,animateHero,WORLD,DURATION,LOCATIONS,CHUNK_LIMIT,REGIONS,currentRegions,enterPortal,biomeAt,getChunk,visibleDecor,findSpawnPoint,updateRegion,get worldChunks(){return worldChunks},setCamera:(x,y)=>camera={x,y},start,update,render,dash,setPause,finish,home,damageEnemy,spawn,showUpgrades,updateHud,upgrades,changeHero,formatTime,get state(){return state},get g(){return g},get keys(){return keys},get profile(){return profile},setHero:i=>selectedHero=i};})();`);
vm.createContext(sandbox);vm.runInContext(source,sandbox);const game=sandbox.test;
assert.equal(game.profile.runs.map(r=>r.hero).join(','),'Грим,Морвен,Нокс','Legacy hero names migrate without losing records');
// Validate the actual three-dimensional model, visibility and articulated poses.
const meshes=[0,1,2].map(hero=>game.buildHeroMesh(hero));
for(const mesh of meshes){
 const points=mesh.flatMap(f=>f.points);
 for(let axis=0;axis<3;axis++)assert(Math.max(...points.map(p=>p[axis]))-Math.min(...points.map(p=>p[axis]))>.5,'Hero has volume in all three axes');
 for(const yaw of [-Math.PI,-Math.PI/2,0,Math.PI/2,Math.PI]){
  const visible=game.projectHeroMesh(mesh,yaw);assert(visible.length>30&&visible.length<mesh.length,'Hidden back faces are culled');
  for(let i=0;i<visible.length;i++){const face=visible[i];assert(Number.isFinite(face.depth));assert(Number.isInteger(face.tone)&&face.tone>=0&&face.tone<=255);assert(face.points.every(p=>p.every(Number.isFinite)));if(i)assert(visible[i-1].depth<=face.depth,'Faces render from back to front');}
 }
}
assert.notEqual(JSON.stringify(meshes[0]),JSON.stringify(meshes[1]),'Warrior and druid have different models');assert.notEqual(JSON.stringify(meshes[1]),JSON.stringify(meshes[2]),'Rogue has a different silhouette');
assert.notEqual(JSON.stringify(game.projectHeroMesh(meshes[0],0)),JSON.stringify(game.projectHeroMesh(meshes[0],Math.PI)),'The back view differs from the front');
assert.notEqual(JSON.stringify(game.buildHeroMesh(0,{moving:true,walk:1})),JSON.stringify(game.buildHeroMesh(0,{moving:true,walk:-1})),'Walking articulates the legs');
assert.notEqual(JSON.stringify(game.buildHeroMesh(0,{attack:{elapsed:.22,windup:.16,active:.12,recovery:.20,sign:1}})),JSON.stringify(meshes[0]),'The arm and weapon move during attacks');
const animated={animTime:0,walk:0,moving:true,speed:175,swing:0,yaw:Math.PI-.01,dx:1,dy:1};game.animateHero(animated,.016);assert(Number.isFinite(animated.yaw));assert(animated.walk>0&&animated.animTime>0);assert(Math.abs(animated.yaw-(Math.PI-.01))<1,'Turning takes the shorter arc');

assert.equal(game.profile.best,120);game.profile.runs=[];game.profile.best=0;
function step(dt){if(game.state==='playing')game.update(dt);}
function choose(){const card=get('upgradeCards').children[0];assert(card);card.onclick();}
assert.equal(game.WORLD,4950,'World side length is tripled');
for(const r of game.REGIONS)assert.equal(game.biomeAt(r.x,r.y).id,r.id,'Each landmark belongs to its own region');
const deterministic=JSON.stringify(game.getChunk(2,-3));for(let i=0;i<300;i++)game.getChunk(i-150,i%19-9);assert(game.worldChunks.size<=game.CHUNK_LIMIT,'Chunk cache is bounded');assert.equal(JSON.stringify(game.getChunk(2,-3)),deterministic,'Revisited chunks regenerate identically');
game.start();
for(const r of game.REGIONS){game.g.player.x=r.x;game.g.player.y=r.y;game.updateRegion();game.setCamera(r.x,r.y);game.render();assert.equal(game.g.region,r.id);assert.equal(get('areaName').textContent,r.name.toUpperCase());}
assert.equal(game.g.visited.size,5,'All five areas can be discovered');
assert(game.worldChunks.size<=game.CHUNK_LIMIT);
for(const x of [-game.WORLD+30,0,game.WORLD-30])for(const y of [-game.WORLD+30,0,game.WORLD-30]){game.g.player.x=x;game.g.player.y=y;for(let i=0;i<80;i++){const p=game.findSpawnPoint();assert(Math.abs(p.x)<game.WORLD-25&&Math.abs(p.y)<game.WORLD-25,'Enemy spawns stay inside the expanded world');const sx=(p.x-x-p.y+y)*.78,sy=(p.x-x+p.y-y)*.46;assert(Math.abs(sx)>450||Math.abs(sy)>275,'Enemy cannot spawn on screen at edges or corners');}}
game.start();game.g.player.x=1640;game.keys.add('KeyD');step(.2);game.keys.clear();assert(game.g.player.x>1650,'Old map boundary is traversable');
game.g.player.x=game.WORLD-31;game.keys.add('KeyD');step(.2);game.keys.clear();assert(game.g.player.x<=game.WORLD-30,'New outer boundary clamps movement');
game.home();assert.equal(get('areaName').textContent,'ПЕПЕЛЬНЫЙ ЛЕС');
game.start();assert.equal(game.state,'playing');assert.equal(game.g.player.hp,100);
game.keys.add('KeyD');step(.1);assert(game.g.player.x>0&&game.g.player.y<0,'D moves right in isometric coordinates');game.keys.clear();
game.dash();assert.equal(game.g.player.dash,3);assert(game.g.player.dashing>0);const before=game.g.player.dash;game.dash();assert.equal(game.g.player.dash,before,'Dash cooldown blocks repeated dash');
game.setPause(true);assert.equal(game.state,'paused');game.setPause(false);assert.equal(game.state,'playing');
// Sword timing and directional collision use the same swept arc as the animation.
function combatEnemy(x,y,hp=100){return{x,y,hp,maxHp:hp,kind:2,seed:0,damage:0,speed:0,flash:0};}
game.start();game.g.player.crit=0;const front=combatEnemy(75,0),rear=combatEnemy(-75,0);game.g.enemies=[front,rear];
let swing=game.beginSword(front);game.updateSword(swing.windup-.001);assert.equal(front.hp,100,'Anticipation cannot deal damage');
game.updateSword(swing.active+.002);assert.equal(front.hp,72,'Blade deals damage during the contact window');assert.equal(rear.hp,100,'An enemy behind the hero is outside the arc');assert(front.stagger>0&&front.knockX>0,'Contact staggers and pushes the enemy');assert(game.g.hitStop>0&&game.g.player.recoil>0,'The first contact gives hit stop and recoil');
const stoppedTime=game.g.time,stoppedSwing=game.g.player.sword.elapsed;game.frame(1000);assert.equal(game.g.time,stoppedTime,'Hit stop freezes gameplay time');assert.equal(game.g.player.sword.elapsed,stoppedSwing,'Hit stop holds the blade at contact');game.frame(1016);game.frame(1032);game.frame(1048);assert(game.g.time>stoppedTime,'The fight resumes after hit stop');
game.updateSword(.01);assert.equal(front.hp,72,'Each enemy can be hit only once per swing');game.updateSword(1);assert.equal(front.hp,72,'Recovery cannot hit again');assert.equal(game.g.player.sword,null);
const second=game.beginSword(front);assert.notEqual(second.sign,swing.sign,'Consecutive swings alternate sides');game.updateSword(1);
game.start();game.g.player.crit=0;const dodge=combatEnemy(80,0);game.g.enemies=[dodge];game.beginSword(dodge);dodge.x=-80;game.updateSword(.5);assert.equal(dodge.hp,100,'Moving outside the committed arc avoids the sword');
game.start();game.g.player.crit=0;const lethal=combatEnemy(70,0,10);game.g.enemies=[lethal];game.beginSword(lethal);game.updateSword(.48);assert.equal(game.g.kills,1,'A long frame still sweeps the entire blade path');assert.equal(game.g.parts.length,2,'A lethal sword hit splits the original sprite into two parts');
const area=points=>Math.abs(points.reduce((sum,a,i)=>{const b=points[(i+1)%points.length];return sum+a[0]*b[1]-b[0]*a[1];},0))/2;
const parts=game.g.parts;assert(Math.abs(parts.reduce((sum,p)=>sum+area(p.polygon),0)-parts[0].atlas.width*parts[0].scale*parts[0].height)<.001,'The two cut polygons exactly cover the original silhouette');
game.damageEnemy(lethal,100,true,{blade:true,angle:0,sign:1,impulse:100});assert.equal(game.g.kills,1);assert.equal(game.g.parts.length,2,'Dead enemies cannot award or split twice');
const beforePart=parts[0].x;game.updateParts(.1);assert(parts[0].z>0&&parts[0].x!==beforePart,'Severed parts separate and fall under gravity');
for(let i=0;i<100;i++)game.severEnemy(combatEnemy(0,0),{angle:i*.1,sign:1});assert.equal(game.g.parts.length,game.PART_LIMIT,'Debris memory stays bounded during large waves');
for(let i=0;i<200;i++)game.updateParts(.02);assert.equal(game.g.parts.length,0,'All debris expires');
game.start();const magicVictim=combatEnemy(50,0,1);game.damageEnemy(magicVictim,100,false);assert.equal(game.g.parts.length,0,'Magical projectiles do not pretend to cut with a sword');
game.start();

game.g.player.inv=0;game.g.enemies=[{x:game.g.player.x,y:game.g.player.y,hp:100,maxHp:100,kind:0,damage:9,speed:0,flash:0}];step(.01);assert.equal(game.g.player.hp,91,'Contact damages player');
game.g.enemies=[];game.g.player.attack=0;game.g.enemies.push({x:game.g.player.x+30,y:game.g.player.y,hp:10,maxHp:10,kind:0,damage:9,speed:0,flash:0});step(.01);assert.equal(game.g.kills,0,'An automatic attack begins with a windup');step(.25);assert.equal(game.g.kills,1,'Automatic melee kills during the blade sweep');
game.g.enemies=[];game.g.gems=[{x:game.g.player.x,y:game.g.player.y,value:5,heal:false}];step(.01);assert.equal(game.state,'upgrade');assert.equal(game.g.level,2);assert.equal(get('upgradeCards').children.length,3);choose();assert.equal(game.state,'playing');assert.equal(Object.keys(game.g.upgrades).length,1);
const h=game.g.player;for(const upgrade of game.upgrades)upgrade.apply(h);assert(h.bolt>0&&h.regen>0&&h.magnet>100&&h.maxHp>100,'All upgrade effects apply');
game.g.stageTime=59.99;game.g.enemies=[];step(.02);assert.equal(game.g.bossStage,1);assert(game.g.enemies.some(e=>e.boss),'First boss appears at one minute');
let boss=game.g.enemies.find(e=>e.boss);game.damageEnemy(boss,100000);assert.equal(game.g.bossesKilled,1);assert(game.g.gems.some(e=>e.heal),'Boss drops healing');
// A location cannot finish just because its timer elapsed or a regular guardian died.
assert.equal(game.g.portal,null,'Regular guardians do not unlock a portal');
game.g.stageTime=299.99;game.g.enemies=[];step(.02);
assert(game.g.finalBossSpawned,'Unique final boss spawns at five minutes');
assert.equal(game.g.enemies.filter(e=>e.finalBoss).length,1);step(.02);assert.equal(game.g.enemies.filter(e=>e.finalBoss).length,1,'Final boss spawns exactly once');
assert.equal(game.g.portal,null);assert.equal(game.state,'playing');
let finalBoss=game.g.enemies.find(e=>e.finalBoss);game.damageEnemy(finalBoss,100000);
assert(game.g.portal,'Final boss death unlocks portal');assert.equal(game.g.clearedLocations,1);assert.equal(game.state,'playing','Boss death does not automatically change location');assert(game.g.enemies.every(e=>e.hp<=0),'Remaining horde disappears');
const clearedTime=game.g.time;game.g.enemies=[];game.g.gems=[];step(3);assert.equal(game.g.time,clearedTime,'Waiting at an unlocked portal cannot inflate survival records');assert.equal(game.g.enemies.length,0,'No new enemies appear after clearing a location');
const unlocked=game.g.portal;game.damageEnemy(finalBoss,100000);assert.equal(game.g.portal,unlocked,'Dead final boss cannot unlock portal twice');
game.g.player.x=unlocked.x-400;game.g.player.y=unlocked.y;assert.equal(game.enterPortal(),false,'Distant portal cannot be entered');
game.g.player.x=unlocked.x;game.g.player.y=unlocked.y;game.setPause(true);assert.equal(game.enterPortal(),false,'Paused game cannot change location');game.setPause(false);
game.g.xp=2;game.g.level=8;game.g.upgrades={damage:3,bolt:1};const snapshot={xp:game.g.xp,level:game.g.level,upgrades:JSON.stringify(game.g.upgrades),damage:game.g.player.damage,maxHp:game.g.player.maxHp,total:game.g.time,kills:game.g.kills};
game.g.player.hp=1;assert.equal(game.enterPortal(),true);assert.equal(game.g.location,1);assert.equal(game.g.stageTime,0);assert.equal(game.g.time,snapshot.total);assert.equal(game.g.kills,snapshot.kills);assert.equal(game.g.xp,snapshot.xp);assert.equal(game.g.level,snapshot.level);assert.equal(JSON.stringify(game.g.upgrades),snapshot.upgrades);assert.equal(game.g.player.damage,snapshot.damage);assert.equal(game.g.player.hp,snapshot.maxHp);assert.equal(game.g.player.x,0);assert.equal(game.g.player.y,0);assert.equal(game.g.parts.length,0,'A portal clears old debris');assert.equal(game.g.player.sword,null,'A portal clears the previous swing');assert.equal(game.g.portal,null);assert.equal(game.enterPortal(),false,'Repeated entry cannot skip a location');assert.equal(game.g.enemies.length,0);assert.equal(game.g.bossStage,0);assert.equal(game.g.visited.size,1);assert.equal(game.profile.runs.length,0,'Transition does not record a completed run');
assert.equal(game.currentRegions()[0].name,'Костяной зал');assert.equal(get('areaName').textContent,'КОСТЯНОЙ ЗАЛ');game.render();
for(let i=1;i<3;i++){assert.equal(game.g.location,i);game.g.stageTime=299.99;game.g.enemies=[];step(.02);const boss=game.g.enemies.find(e=>e.finalBoss);assert(boss);assert(boss.maxHp>=1800+i*1200);game.damageEnemy(boss,1e9);assert(game.g.portal);game.g.player.x=game.g.portal.x;game.g.player.y=game.g.portal.y;assert.equal(game.enterPortal(),true);game.render();}
assert.equal(game.state,'over');assert.equal(game.enterPortal(),false,'Final portal cannot record victory twice');assert(game.profile.runs[0].won);assert.equal(game.profile.runs[0].locations,3);game.profile.runs=[];game.profile.best=0;
// Simulate the complete timed campaign using only normal update/combat/entry paths.
game.start();game.g.player.maxHp=1e6;game.g.player.hp=1e6;game.g.player.damage=10000;game.g.player.range=1000;
let transitions=0;for(let i=0;i<72000&&game.state!=='over';i++){if(game.state==='upgrade')choose();step(1/60);if(game.g.portal){game.g.player.x=game.g.portal.x;game.g.player.y=game.g.portal.y;game.enterPortal();transitions++;}if(i%600===0)game.render();}
assert.equal(game.state,'over','All three timed locations terminate');assert.equal(game.g.clearedLocations,3);assert.equal(transitions,3);assert.equal(game.g.bossesKilled,15);assert(game.profile.runs[0].won,'Campaign victory saved');assert(game.profile.best>=900);assert(storage.has('dodabonk-v1'));
const firstRunKills=game.g.kills;game.setHero(2);game.start();assert.equal(game.g.player.hp,80);assert.equal(game.g.hero,2);game.setHero(1);game.finish(false);assert.equal(game.profile.runs[0].hero,'Нокс','Changing next-run hero preserves current-run identity');assert.equal(game.profile.runs.length,2);
game.home();assert.equal(game.state,'home');assert.equal(game.g,null);game.start();game.g.player.hp=1;game.g.player.inv=0;game.g.player.attack=10;game.g.enemies=[{x:0,y:0,hp:100,maxHp:100,kind:0,damage:10,speed:0,flash:0}];step(.01);assert.equal(game.state,'over','Death ends run');
console.log(JSON.stringify({passed:true,checks:['windup and recovery timing','directional swept-blade collisions','once-per-swing hits','dodging committed attacks','stagger, recoil and hit stop','alternating sword strikes','complementary sprite slicing','falling, bounded and expiring debris','three distinct 3D hero meshes','full-turn projection','back-face culling and depth sorting','finite lit geometry','walk and attack articulation','shortest-arc rotation','ninefold map area','five regions','bounded deterministic chunks','boundary spawn safety','old boundary traversal','legacy name migration','movement','dash cooldown','pause/resume','contact damage','automatic attack','experience and upgrade selection','all upgrades','boss spawn and rewards','five-minute final boss on each map','portal locks and proximity','no automatic transition','upgrade and XP carryover','three distinct locations','fifteen-boss campaign victory','record storage','hero identity','restart','death'],simulatedRunKills:firstRunKills,simulatedDuration:Math.floor(game.profile.best)}));
