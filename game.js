(() => {
  const canvas = document.getElementById('world');
  const ctx = canvas.getContext('2d');
  const mapCanvas = document.getElementById('map');
  const mctx = mapCanvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const TAU = Math.PI * 2;
  let W = 0, H = 0, dpr = 1, last = performance.now(), started = false, paused = false;
  const player = {x: 0, y: 34, z: -42, yaw: 0, speed: 36, pitch: 0};
  const keys = new Set(), touch = new Set();
  let elapsed = 0, flapTime = 0, toastTimer = 0, soundOn = true, audioCtx = null;
  const islandList = [];
  for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) {
    const seed = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    const rand = seed - Math.floor(seed);
    const seed2 = Math.sin(i * 269.5 + j * 183.3) * 24634.6345;
    const rand2 = seed2 - Math.floor(seed2);
    islandList.push({x:i*175 + (j%2)*45 + (rand-.5)*34, z:j*190 + 65 + (rand2-.5)*38, r:68+rand*25, peak:13+rand2*14, seed:rand*9});
  }
  const sparks = [
    {x:0,z:30},{x:-26,z:82},{x:30,z:112},{x:125,z:106},{x:175,z:152},
    {x:-148,z:117},{x:-190,z:179},{x:15,z:294}
  ].map((s,i)=>({...s, got:false, phase:i*1.72, y:0}));
  const clouds = [];
  for(let i=0;i<42;i++){
    const a=i*2.399, r=90+(i%7)*51;
    clouds.push({x:Math.cos(a)*r+(i%4)*30,z:Math.sin(a)*r+100,y:37+(i%5)*8,size:9+(i%4)*4,seed:i});
  }
  function heightAt(x,z){
    let h=0;
    for(const a of islandList){const dx=x-a.x,dz=z-a.z,d=Math.hypot(dx,dz)/a.r;if(d<1.12){const edge=Math.max(0,1-d);const base=7*Math.pow(edge,.58);const peak=a.peak*Math.exp(-((dx*dx)/(a.r*a.r*.16)+(dz*dz)/(a.r*a.r*.13)));const ridge=(Math.sin(dx*.10+a.seed)*Math.cos(dz*.08-a.seed)*1.5+Math.sin((dx+dz)*.17)*.7)*edge;h=Math.max(h,base+peak+ridge);}}
    return h;
  }
  function resize(){
    const rect=canvas.getBoundingClientRect(); W=rect.width; H=rect.height; dpr=Math.min(devicePixelRatio||1,1.8);
    canvas.width=Math.round(W*dpr); canvas.height=Math.round(H*dpr); ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  addEventListener('resize',resize,{passive:true}); resize();
  function camera(){
    const yaw=player.yaw, pitch=.2+player.pitch*.17;
    const fx=Math.sin(yaw), fz=Math.cos(yaw);
    const pos={x:player.x-fx*13,y:player.y+6,z:player.z-fz*13};
    const right={x:Math.cos(yaw),y:0,z:-Math.sin(yaw)};
    const up={x:-Math.sin(yaw)*Math.sin(pitch),y:Math.cos(pitch),z:-Math.cos(yaw)*Math.sin(pitch)};
    const forward={x:fx*Math.cos(pitch),y:-Math.sin(pitch),z:fz*Math.cos(pitch)};
    const focal=Math.min(W,H)*.92;
    return {pos,right,up,forward,focal,cx:W*.5,cy:H*.48};
  }
  function project(x,y,z,c){
    const dx=x-c.pos.x,dy=y-c.pos.y,dz=z-c.pos.z;
    const vx=dx*c.right.x+dy*c.right.y+dz*c.right.z;
    const vy=dx*c.up.x+dy*c.up.y+dz*c.up.z;
    const vz=dx*c.forward.x+dy*c.forward.y+dz*c.forward.z;
    if(vz<2) return null;
    return {x:c.cx+vx*c.focal/vz,y:c.cy-vy*c.focal/vz,z:vz,scale:c.focal/vz};
  }
  function sky(){
    const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#83b7d1');g.addColorStop(.38,'#b3d3d4');g.addColorStop(.66,'#f1d4ae');g.addColorStop(1,'#4e8e9b');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    const sun=ctx.createRadialGradient(W*.72,H*.24,1,W*.72,H*.24,Math.min(W,H)*.38);sun.addColorStop(0,'rgba(255,244,198,.56)');sun.addColorStop(.16,'rgba(255,229,178,.18)');sun.addColorStop(1,'rgba(255,238,200,0)');ctx.fillStyle=sun;ctx.fillRect(0,0,W,H);
    // Long, pale cloud bands at the horizon
    for(let i=0;i<5;i++){const y=H*(.31+i*.047), shift=((elapsed*4+i*143)%W);ctx.fillStyle=`rgba(255,249,230,${.09-i*.008})`;ctx.beginPath();ctx.ellipse(shift,y,90+i*25,5+i,0,0,TAU);ctx.ellipse((shift+W*.53)%W,y+10,110,4,0,0,TAU);ctx.fill();}
  }
  function drawClouds(c){
    for(const cl of clouds){const p=project(cl.x,cl.y+Math.sin(elapsed*.16+cl.seed)*1.4,cl.z,c);if(!p||p.z<65||p.x<-120||p.x>W+120||p.y<-100||p.y>H+100)continue;const r=Math.max(2,Math.min(34,cl.size*p.scale*.24));ctx.fillStyle='rgba(255,250,231,.22)';ctx.beginPath();ctx.ellipse(p.x,p.y,r*1.55,r*.33,0,0,TAU);ctx.fill();ctx.fillStyle='rgba(255,255,255,.32)';ctx.beginPath();ctx.ellipse(p.x-r*.18,p.y-r*.11,r*.8,r*.26,0,0,TAU);ctx.ellipse(p.x+r*.46,p.y-r*.05,r*.62,r*.2,0,0,TAU);ctx.fill();}
  }
  function drawTerrain(c){
    const step=15, x0=Math.floor((player.x-225)/step)*step, z0=Math.floor((player.z-245)/step)*step;
    const cols=31, rows=34, pts=[];
    for(let j=0;j<=rows;j++){pts[j]=[];for(let i=0;i<=cols;i++){const x=x0+i*step,z=z0+j*step;pts[j][i]=project(x,Math.max(-1,heightAt(x,z)),z,c);}}
    const tris=[];
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
      const x=x0+i*step+step*.5,z=z0+j*step+step*.5;
      const a=pts[j][i],b=pts[j][i+1],d=pts[j+1][i],e=pts[j+1][i+1];
      if(a&&b&&d)tris.push({p:[a,b,d],x,z,h:(heightAt(x,z)+heightAt(x+step,z)+heightAt(x,z+step))/3});
      if(b&&e&&d)tris.push({p:[b,e,d],x,z,h:(heightAt(x+step,z)+heightAt(x+step,z+step)+heightAt(x,z+step))/3});
    }
    tris.sort((a,b)=>(b.p[0].z+b.p[1].z+b.p[2].z)-(a.p[0].z+a.p[1].z+a.p[2].z));
    for(const t of tris){const p=t.p;ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);ctx.lineTo(p[1].x,p[1].y);ctx.lineTo(p[2].x,p[2].y);ctx.closePath();
      if(t.h<.2){const n=(Math.sin(t.x*.081+t.z*.038+elapsed*.45)+1)*.5;ctx.fillStyle=`rgb(${Math.round(51+n*9)},${Math.round(132+n*18)},${Math.round(151+n*13)})`;}
      else {const band=Math.min(1,t.h/28),noise=(Math.sin(t.x*.17+t.z*.11)+Math.cos(t.x*.09-t.z*.12))*.5;const r=Math.round(91+band*67+noise*8),g=Math.round(129+band*24+noise*8),b=Math.round(91+band*8+noise*6);ctx.fillStyle=`rgb(${r},${g},${b})`;}
      ctx.fill();
    }
    // Pale, sunward rims give the high islands a readable silhouette.
    for(const isl of islandList){if(Math.hypot(isl.x-player.x,isl.z-player.z)>265)continue;const p=project(isl.x,Math.max(.5,heightAt(isl.x,isl.z)),isl.z,c);if(!p)continue;const r=isl.r*p.scale;if(r<2||p.x<-r*2||p.x>W+r*2)continue;ctx.strokeStyle='rgba(237,218,170,.22)';ctx.lineWidth=Math.max(.5,r*.035);ctx.beginPath();ctx.ellipse(p.x,p.y,r*.78,r*.4,0,0,TAU);ctx.stroke();}
  }
  function drawSparks(c){
    for(const s of sparks){if(s.got)continue;const p=project(s.x,s.y+Math.sin(elapsed*2+s.phase)*.7,s.z,c);if(!p||p.x<-60||p.x>W+60||p.y<-60||p.y>H+60)continue;const r=Math.max(2,Math.min(18,9*p.scale));const glow=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r*3.4);glow.addColorStop(0,'rgba(255,224,142,.75)');glow.addColorStop(1,'rgba(255,195,94,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(p.x,p.y,r*3.4,0,TAU);ctx.fill();ctx.strokeStyle='rgba(255,227,162,.84)';ctx.lineWidth=Math.max(1,r*.14);ctx.beginPath();ctx.ellipse(p.x,p.y,r*.7,r*1.18,elapsed*.3,0,TAU);ctx.stroke();ctx.fillStyle='#fff5bd';ctx.shadowColor='#ffd36d';ctx.shadowBlur=14;ctx.beginPath();ctx.arc(p.x,p.y,r*.3,0,TAU);ctx.fill();ctx.shadowBlur=0;}
  }
  function dragon(){
    const x=W*.5,y=H*.75+Math.min(H*.03,18),s=Math.min(W,H)*.00115;
    const wing=Math.sin(elapsed*7+flapTime*3)*.65 + (flapTime>0?.25:0);
    ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.rotate(player.yaw*.09);
    // Soft shadow / air streaks
    ctx.fillStyle='rgba(17,35,39,.2)';ctx.beginPath();ctx.ellipse(0,45,75,13,0,0,TAU);ctx.fill();
    for(let i=0;i<3;i++){ctx.strokeStyle=`rgba(255,255,255,${.2-i*.04})`;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-145-i*15,18+i*9);ctx.quadraticCurveTo(-100,9+i*10,-68,22+i*12);ctx.moveTo(145+i*15,18+i*9);ctx.quadraticCurveTo(100,9+i*10,68,22+i*12);ctx.stroke();}
    // Tail and rear fins
    ctx.fillStyle='#182a32';ctx.beginPath();ctx.moveTo(13,16);ctx.quadraticCurveTo(43,42,87,49);ctx.quadraticCurveTo(108,53,124,39);ctx.quadraticCurveTo(102,66,79,59);ctx.quadraticCurveTo(41,52,5,28);ctx.closePath();ctx.fill();
    ctx.fillStyle='#30474b';ctx.beginPath();ctx.moveTo(102,48);ctx.lineTo(130,33);ctx.lineTo(126,55);ctx.lineTo(143,66);ctx.lineTo(109,62);ctx.closePath();ctx.fill();
    // Wings flex at shoulders
    for(const side of [-1,1]){ctx.save();ctx.scale(side,1);ctx.rotate(wing);const grad=ctx.createLinearGradient(0,0,0,-103);grad.addColorStop(0,'#30474b');grad.addColorStop(1,'#526760');ctx.fillStyle=grad;ctx.beginPath();ctx.moveTo(14,-2);ctx.quadraticCurveTo(41,-53,91,-105);ctx.quadraticCurveTo(85,-73,117,-79);ctx.quadraticCurveTo(103,-53,133,-55);ctx.quadraticCurveTo(106,-30,129,-26);ctx.quadraticCurveTo(86,-13,42,16);ctx.closePath();ctx.fill();ctx.strokeStyle='rgba(15,35,40,.5)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(18,1);ctx.lineTo(91,-105);ctx.moveTo(31,8);ctx.lineTo(117,-79);ctx.moveTo(38,12);ctx.lineTo(133,-55);ctx.stroke();ctx.restore();}
    // Body, belly, legs
    const body=ctx.createLinearGradient(-18,0,25,25);body.addColorStop(0,'#506460');body.addColorStop(.52,'#30484a');body.addColorStop(1,'#1c3038');ctx.fillStyle=body;ctx.beginPath();ctx.ellipse(0,8,31,20,-.08,0,TAU);ctx.fill();ctx.fillStyle='#a8946c';ctx.beginPath();ctx.ellipse(8,21,17,7,.05,0,TAU);ctx.fill();
    ctx.fillStyle='#273a40';for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(side*13,18);ctx.lineTo(side*19,34);ctx.lineTo(side*31,36);ctx.lineTo(side*26,40);ctx.lineTo(side*14,38);ctx.lineTo(side*9,24);ctx.fill();}
    // Neck, head, ears
    ctx.fillStyle='#3d5654';ctx.beginPath();ctx.moveTo(17,-4);ctx.quadraticCurveTo(27,-22,35,-36);ctx.lineTo(50,-34);ctx.quadraticCurveTo(40,-13,32,1);ctx.fill();
    ctx.fillStyle='#415b57';ctx.beginPath();ctx.ellipse(45,-38,22,14,-.12,0,TAU);ctx.fill();ctx.beginPath();ctx.moveTo(30,-43);ctx.lineTo(25,-59);ctx.lineTo(43,-48);ctx.fill();ctx.beginPath();ctx.moveTo(46,-47);ctx.lineTo(57,-61);ctx.lineTo(58,-42);ctx.fill();
    ctx.fillStyle='#27383e';ctx.beginPath();ctx.moveTo(53,-39);ctx.quadraticCurveTo(69,-37,74,-29);ctx.lineTo(57,-27);ctx.quadraticCurveTo(49,-30,45,-34);ctx.fill();
    ctx.fillStyle='#f7c96d';ctx.shadowColor='#ffd786';ctx.shadowBlur=7;ctx.beginPath();ctx.ellipse(50,-41,3,2,0,0,TAU);ctx.fill();ctx.shadowBlur=0;
    // Small saddle marking
    ctx.strokeStyle='rgba(236,199,132,.72)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(-4,1,12,Math.PI,TAU);ctx.stroke();ctx.restore();
  }
  function drawMap(){
    const w=mapCanvas.width,h=mapCanvas.height,cx=w/2,cy=h/2,scale=.18;
    mctx.clearRect(0,0,w,h);mctx.save();mctx.beginPath();mctx.arc(cx,cy,w*.49,0,TAU);mctx.clip();
    const bg=mctx.createRadialGradient(cx,cy,3,cx,cy,w*.7);bg.addColorStop(0,'rgba(39,93,105,.72)');bg.addColorStop(1,'rgba(17,48,63,.95)');mctx.fillStyle=bg;mctx.fillRect(0,0,w,h);
    mctx.strokeStyle='rgba(220,242,235,.11)';mctx.lineWidth=1;for(let r=25;r<w*.5;r+=25){mctx.beginPath();mctx.arc(cx,cy,r,0,TAU);mctx.stroke();}mctx.beginPath();mctx.moveTo(cx,0);mctx.lineTo(cx,h);mctx.moveTo(0,cy);mctx.lineTo(w,cy);mctx.stroke();
    for(const a of islandList){const dx=(a.x-player.x)*scale,dy=-(a.z-player.z)*scale;if(Math.abs(dx)>w*.55||Math.abs(dy)>h*.55)continue;const r=a.r*scale*.72;mctx.fillStyle='rgba(179,194,151,.48)';mctx.beginPath();mctx.ellipse(cx+dx,cy+dy,r*1.15,r*.65,0,0,TAU);mctx.fill();mctx.strokeStyle='rgba(225,219,168,.38)';mctx.stroke();}
    for(const s of sparks){if(s.got)continue;const dx=(s.x-player.x)*scale,dy=-(s.z-player.z)*scale;if(Math.abs(dx)>w*.5||Math.abs(dy)>h*.5)continue;mctx.fillStyle='#ffcf73';mctx.shadowColor='#ffc768';mctx.shadowBlur=6;mctx.beginPath();mctx.arc(cx+dx,cy+dy,2.4,0,TAU);mctx.fill();mctx.shadowBlur=0;}
    mctx.translate(cx,cy);mctx.rotate(-player.yaw);mctx.fillStyle='#b8f1ff';mctx.shadowColor='#b8f1ff';mctx.shadowBlur=9;mctx.beginPath();mctx.moveTo(0,-8);mctx.lineTo(5,6);mctx.lineTo(0,3);mctx.lineTo(-5,6);mctx.closePath();mctx.fill();mctx.restore();
  }
  function updateHud(){
    const count=sparks.reduce((n,s)=>n+(s.got?1:0),0);$('sparkCount').innerHTML=`${count} <em>/ 8</em>`;$('progressFill').style.width=`${Math.min(100,count/8*100)}%`;
    $('speed').innerHTML=`${Math.round(player.speed)} <em>kn</em>`;$('speedFill').style.height=`${Math.min(100,player.speed/62*100)}%`;
    const deg=(player.yaw*180/Math.PI+360)%360,dirs=['N','NE','E','SE','S','SW','W','NW'];$('heading').textContent=dirs[Math.round(deg/45)%8];$('headingDeg').textContent=`${String(Math.round(deg)).padStart(3,'0')}°`;
    $('missionFoot').textContent=count>=8?'The whole sky is yours — keep wandering':count===0?'A trail is waiting beyond the cliffs':`${8-count} more ${8-count===1?'spark':'sparks'} are somewhere out here`;
    if(count>=8)$('completeBanner').classList.remove('hidden');drawMap();
  }
  function playChime(){if(!soundOn)return;try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();const t=audioCtx.currentTime;[660,880,1100].forEach((f,i)=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.value=f;o.connect(g);g.connect(audioCtx.destination);g.gain.setValueAtTime(.0001,t+i*.085);g.gain.exponentialRampToValueAtTime(.07,t+i*.085+.025);g.gain.exponentialRampToValueAtTime(.0001,t+i*.085+.22);o.start(t+i*.085);o.stop(t+i*.085+.23);});}catch(_){}}
  function collect(s){s.got=true;toastTimer=2.2;$('toast').classList.add('show');playChime();updateHud();}
  function loop(now){
    const dt=Math.min(.04,(now-last)/1000);last=now;elapsed+=dt;
    const active=started&&!paused;
    const left=keys.has('a')||keys.has('arrowleft')||touch.has('left'),right=keys.has('d')||keys.has('arrowright')||touch.has('right');
    const up=keys.has('w')||keys.has('arrowup')||touch.has('up'),down=keys.has('s')||keys.has('arrowdown')||touch.has('down');
    const dive=keys.has('shift'),flap=keys.has(' ')||touch.has('flap');
    if(active){player.yaw+=(right-left)*1.02*dt;player.pitch+=(down-up)*dt*1.7;player.pitch=Math.max(-1,Math.min(1,player.pitch));flapTime=flap?Math.min(1.2,flapTime+dt):Math.max(0,flapTime-dt*1.8);
      const target=34+(flap?19:0)+(dive?18:0);player.speed+=(target-player.speed)*Math.min(1,dt*1.7);
      const v=player.speed*.29;player.x+=Math.sin(player.yaw)*v*dt;player.z+=Math.cos(player.yaw)*v*dt;
      player.y+=(up?9:0)-(down||dive?9:0);if(flap&&player.y<heightAt(player.x,player.z)+28)player.y+=5*dt;
      player.y=Math.max(5,Math.min(90,player.y));const ground=heightAt(player.x,player.z);if(player.y<ground+5)player.y=ground+5;
      for(const s of sparks){if(s.got)continue;const dx=s.x-player.x,dy=s.y-player.y,dz=s.z-player.z;if(dx*dx+dy*dy+dz*dz<100)collect(s);}
    } else {player.speed+=(34-player.speed)*Math.min(1,dt*.35);flapTime=Math.max(0,flapTime-dt);}
    if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('toast').classList.remove('show');}
    sky();const c=camera();drawClouds(c);drawTerrain(c);drawSparks(c);dragon();
    if(Math.floor(elapsed*3)!==Math.floor((elapsed-dt)*3))updateHud();
    requestAnimationFrame(loop);
  }
  sparks.forEach(s=>s.y=Math.max(12,heightAt(s.x,s.z)+11));
  function start(){started=true;paused=false;$('startOverlay').classList.add('dismissed');}
  $('startBtn').addEventListener('click',start);
  $('helpBtn').addEventListener('click',()=>{$('guideOverlay').classList.remove('hidden');paused=true;});
  $('closeGuide').addEventListener('click',()=>{$('guideOverlay').classList.add('hidden');paused=false;});$('resumeBtn').addEventListener('click',()=>{$('guideOverlay').classList.add('hidden');paused=false;});
  $('soundBtn').addEventListener('click',()=>{soundOn=!soundOn;$('soundBtn').textContent=soundOn?'♫':'♪';$('soundBtn').style.opacity=soundOn?'1':'.55';});
  addEventListener('keydown',e=>{const k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();if(k==='enter'&&!started)start();if(k==='escape'&&started){paused=!paused;$('guideOverlay').classList.toggle('hidden',!paused);}keys.add(k);});
  addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  document.querySelectorAll('[data-control]').forEach(btn=>{const control=btn.dataset.control;const down=e=>{e.preventDefault();touch.add(control);btn.classList.add('pressed');};const up=e=>{e.preventDefault();touch.delete(control);btn.classList.remove('pressed');};btn.addEventListener('pointerdown',down);btn.addEventListener('pointerup',up);btn.addEventListener('pointercancel',up);btn.addEventListener('pointerleave',up);});
  updateHud();requestAnimationFrame(loop);
})();
