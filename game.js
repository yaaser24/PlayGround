(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = 960, H = 640;
  const $ = id => document.getElementById(id);
  const startScreen = $('startScreen'), pauseScreen = $('pauseScreen'), endScreen = $('endScreen');
  const scoreNode = $('score'), waveNode = $('wave'), livesNode = $('lives'), bestNode = $('best');
  const threatBars = [...document.querySelectorAll('.threat-bars i')];
  let state = 'intro', score = 0, wave = 1, lives = 3, best = 0;
  let lastTime = 0, frame = 0, soundOn = true, audio = null;
  let player, shots = [], enemyShots = [], particles = [], towers = [], stars = [], input = {left:false,right:false,fire:false}, pointerDown = false;
  try { best = Number(localStorage.getItem('invasionShiftBest') || 0); } catch (_) {}
  bestNode.textContent = pad(best);

  function pad(n){ return String(Math.max(0, Math.floor(n))).padStart(6,'0'); }
  function updateHud(){
    scoreNode.textContent = pad(score); waveNode.textContent = String(wave).padStart(2,'0');
    livesNode.textContent = Array.from({length:3},(_,i)=>i<lives?'◆':'◇').join(' ');
    livesNode.setAttribute('aria-label', `${lives} lives remaining`); bestNode.textContent = pad(best);
    const level = Math.min(7, 1 + Math.floor((wave-1)/1.4));
    threatBars.forEach((bar,i)=>bar.classList.toggle('active', i<level));
    $('threatText').textContent = wave<2?'LOW ORBIT':wave<4?'HOSTILE SKIES':wave<7?'FULL LOCK':'PLANETARY PANIC';
  }
  function sound(freq=420,duration=.08,type='square',volume=.035){
    if(!soundOn)return;
    try{
      audio ||= new (window.AudioContext||window.webkitAudioContext)();
      if(audio.state==='suspended') audio.resume();
      const osc=audio.createOscillator(), gain=audio.createGain();
      osc.type=type; osc.frequency.setValueAtTime(freq,audio.currentTime);
      gain.gain.setValueAtTime(volume,audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);
      osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(audio.currentTime+duration);
    }catch(_){/* Audio is optional. */}
  }
  function resetGame(){
    score=0; wave=1; lives=3; shots=[]; enemyShots=[]; particles=[];
    player={x:W/2,y:100,r:19,speed:370,cooldown:0,invuln:0};
    spawnWave(); updateHud(); state='playing'; startScreen.classList.add('hidden');pauseScreen.classList.add('hidden');endScreen.classList.add('hidden');
  }
  function spawnWave(){
    towers=[]; const count=Math.min(4+Math.floor(wave*.8),9);
    const gap=760/(count-1 || 1);
    for(let i=0;i<count;i++) towers.push({x:100+i*gap,y:490+(i%2)*37,hp:1+(wave>2&&i%3===0?1:0),max:1+(wave>2&&i%3===0?1:0),phase:Math.random()*8,cooldown:.5+Math.random()*1.6});
    shots=[];enemyShots=[];
  }
  function beginWave(){
    wave++; spawnWave(); updateHud(); state='playing';
    particles.push({x:W/2,y:270,text:`WAVE ${String(wave).padStart(2,'0')}`,life:1.6,max:1.6,color:'#d5fb63'});
  }
  function finishGame(won){
    state='over'; input.fire=false; input.left=input.right=false;
    $('endKicker').textContent=won?'TRANSMISSION RECEIVED':'SIGNAL LOST';
    $('endTitle').innerHTML=won?'EARTH<br/>SURRENDERS<span>!</span>':'EARTH<br/>WINS<span>?</span>';
    $('endCopy').textContent=won?'You made contact. The welcome committee was… surprisingly loud.':`You scored ${pad(score)} points. The cosmos is rooting for a rematch.`;
    $('restartButton').innerHTML=(won?'EXPLORE AGAIN':'RUN IT BACK')+' <span>↗</span>';
    endScreen.classList.remove('hidden');
  }
  function addScore(n){score+=n;if(score>best){best=score;try{localStorage.setItem('invasionShiftBest',String(best));}catch(_){}}updateHud();}
  function burst(x,y,color,count=9){
    for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=35+Math.random()*150;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.3+Math.random()*.55,max:.85,size:1.5+Math.random()*3,color});}
  }
  function fire(){
    if(player.cooldown>0)return;
    shots.push({x:player.x,y:player.y+20,vy:520}); player.cooldown=.18;
    sound(540,.07,'square',.018);
  }
  function fireEnemy(t){
    const dx=player.x-t.x,dy=player.y-t.y,len=Math.hypot(dx,dy)||1,speed=170+wave*11;
    enemyShots.push({x:t.x,y:t.y-18,vx:dx/len*speed*.35,vy:-Math.abs(dy/len*speed)-45});
    sound(145,.11,'sawtooth',.012);
  }
  function hitPlayer(){
    if(player.invuln>0)return;
    lives--;player.invuln=1.5;burst(player.x,player.y,'#ff7959',20);sound(90,.3,'sawtooth',.05);updateHud();
    if(lives<=0)finishGame(false);
  }
  function update(dt){
    frame+=dt;
    if(state!=='playing')return;
    player.invuln=Math.max(0,player.invuln-dt);player.cooldown=Math.max(0,player.cooldown-dt);
    if(input.left)player.x-=player.speed*dt;
    if(input.right)player.x+=player.speed*dt;
    player.x=Math.max(30,Math.min(W-30,player.x));
    if(input.fire)fire();
    for(const t of towers){t.phase+=dt;t.cooldown-=dt;if(t.cooldown<=0){fireEnemy(t);t.cooldown=Math.max(.56,1.8-wave*.09)+Math.random()*.9;}}
    for(const s of shots)s.y+=s.vy*dt;
    shots=shots.filter(s=>s.y<H+20);
    for(const s of enemyShots){s.x+=s.vx*dt;s.y+=s.vy*dt;}
    enemyShots=enemyShots.filter(s=>s.y>-25&&s.x>-30&&s.x<W+30);
    for(let i=shots.length-1;i>=0;i--){const s=shots[i];let hit=false;
      for(let j=towers.length-1;j>=0;j--){const t=towers[j];if(Math.abs(s.x-t.x)<25&&Math.abs(s.y-t.y)<25){t.hp--;hit=true;burst(s.x,s.y,'#70e8c1',5);if(t.hp<=0){burst(t.x,t.y,'#ffb35c',16);towers.splice(j,1);addScore(120+wave*15);sound(250,.14,'triangle',.04);}else sound(300,.06,'triangle',.02);break;}}
      if(hit)shots.splice(i,1);
    }
    for(let i=enemyShots.length-1;i>=0;i--){const s=enemyShots[i];if(Math.hypot(s.x-player.x,s.y-player.y)<23){enemyShots.splice(i,1);hitPlayer();}}
    if(towers.length===0){state='waveclear';particles.push({x:W/2,y:285,text:'GRID OFFLINE',life:1.3,max:1.3,color:'#70e8c1'});sound(660,.2,'triangle',.04);setTimeout(()=>{if(state==='waveclear'){if(wave>=5)finishGame(true);else beginWave();}},1250);}
    for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;if(p.vx!==undefined){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=75*dt;}if(p.life<=0)particles.splice(i,1);}
  }
  function roundRect(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
  function drawBackground(){
    const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#08151e');g.addColorStop(.68,'#101d20');g.addColorStop(1,'#17221d');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    // distant aurora haze
    const haze=ctx.createRadialGradient(510,330,25,510,330,440);haze.addColorStop(0,'#17373a55');haze.addColorStop(1,'#17373a00');ctx.fillStyle=haze;ctx.fillRect(0,0,W,H);
    for(let i=0;i<80;i++){const x=(i*173+31)%W,y=(i*89+17)%435;const twinkle=.35+.65*Math.sin(frame*1.5+i*4)**2;ctx.fillStyle=`rgba(190,230,202,${.18*twinkle})`;ctx.fillRect(x,y,((i%3)+1)*.7,.8);}
    // horizon and city silhouettes
    ctx.fillStyle='#111c1b';ctx.beginPath();ctx.moveTo(0,480);
    let x=0;while(x<=W){const width=24+(Math.sin(x*.071)*.5+.5)*39,height=38+(Math.sin(x*.027+2)*.5+.5)*105;ctx.lineTo(x,480-height);ctx.lineTo(x+width*.72,480-height);ctx.lineTo(x+width*.72,480);x+=width;}
    ctx.lineTo(W,540);ctx.lineTo(0,540);ctx.closePath();ctx.fill();
    ctx.fillStyle='#24302a';ctx.fillRect(0,541,W,99);
    ctx.fillStyle='#d5fb6333';ctx.fillRect(0,540,W,1);
    for(let b=0;b<24;b++){const bx=b*43+6,bh=22+(b*17%70);ctx.fillStyle=b%3?'#1b2b27':'#27382d';ctx.fillRect(bx,540-bh,29,bh);for(let wy=550-bh;wy<530;wy+=12)for(let wx=bx+5;wx<bx+26;wx+=10){ctx.fillStyle=((b*3+wy+wx)%5===0)?'#d5fb6370':'#88d2a226';ctx.fillRect(wx,wy,3,4);}}
    ctx.strokeStyle='#34443a';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,594);ctx.lineTo(W,594);ctx.stroke();
    ctx.fillStyle='#718375';ctx.font='10px monospace';ctx.fillText('NEW YORK // DEFENSE GRID',18,615);ctx.textAlign='right';ctx.fillText('POP. 8,804,190',W-18,615);ctx.textAlign='left';
  }
  function drawPlayer(){
    if(!player)return; if(player.invuln>0&&Math.floor(frame*12)%2===0)return;
    ctx.save();ctx.translate(player.x,player.y);ctx.shadowColor='#d5fb63';ctx.shadowBlur=20;
    // tractor glow
    const beam=ctx.createLinearGradient(0,10,0,72);beam.addColorStop(0,'#d5fb6340');beam.addColorStop(1,'#d5fb6300');ctx.fillStyle=beam;ctx.beginPath();ctx.moveTo(-12,12);ctx.lineTo(12,12);ctx.lineTo(29,70);ctx.lineTo(-29,70);ctx.fill();
    ctx.fillStyle='#c9f768';ctx.beginPath();ctx.moveTo(-28,3);ctx.quadraticCurveTo(-22,-7,0,-12);ctx.quadraticCurveTo(22,-7,28,3);ctx.lineTo(39,9);ctx.quadraticCurveTo(0,24,-39,9);ctx.closePath();ctx.fill();
    ctx.fillStyle='#304d34';ctx.beginPath();ctx.ellipse(0,-5,13,9,0,Math.PI,0);ctx.fill();ctx.fillStyle='#ddff9b';ctx.fillRect(-21,7,5,2);ctx.fillRect(16,7,5,2);
    ctx.restore();
  }
  function drawTower(t){
    ctx.save();ctx.translate(t.x,t.y);ctx.fillStyle='#263a37';ctx.strokeStyle='#85aa81';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(-22,18);ctx.lineTo(-19,-8);ctx.lineTo(-11,-17);ctx.lineTo(11,-17);ctx.lineTo(19,-8);ctx.lineTo(22,18);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='#ff7959';ctx.shadowColor='#ff7959';ctx.shadowBlur=14;ctx.beginPath();ctx.arc(0,-8,5+Math.sin(t.phase*5)*1.5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle='#7d4035';roundRect(-21,23,42,4,2);ctx.fill();ctx.fillStyle='#ff7959';roundRect(-20,24,40*t.hp/t.max,2,1);ctx.fill();
    for(let k=0;k<3;k++){ctx.fillStyle='#a5cf8b';ctx.fillRect(-13+k*12,7,4,4);}
    ctx.restore();
  }
  function draw(){
    ctx.clearRect(0,0,W,H);drawBackground();
    // subtle targeting grid
    ctx.strokeStyle='#8cc6a00b';ctx.lineWidth=1;for(let x=40;x<W;x+=80){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,460);ctx.stroke();}
    ctx.fillStyle='#9dd8ff';for(const s of shots){ctx.shadowColor='#d5fb63';ctx.shadowBlur=12;roundRect(s.x-2,s.y-10,4,16,2);ctx.fillStyle='#e7ffad';ctx.fill();ctx.shadowBlur=0;}
    for(const s of enemyShots){ctx.fillStyle='#ff7959';ctx.shadowColor='#ff7959';ctx.shadowBlur=12;ctx.beginPath();ctx.arc(s.x,s.y,4,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffd2a8';ctx.beginPath();ctx.arc(s.x,s.y,1.5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
    for(const t of towers)drawTower(t);drawPlayer();
    for(const p of particles){if(p.text){ctx.globalAlpha=Math.min(1,p.life*2);ctx.fillStyle=p.color;ctx.textAlign='center';ctx.font='bold 22px monospace';ctx.fillText(p.text,p.x,p.y);ctx.textAlign='left';ctx.globalAlpha=1;}else{ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size);ctx.globalAlpha=1;}}
    if(state==='waveclear'){ctx.fillStyle='#70e8c1';ctx.font='10px monospace';ctx.textAlign='center';ctx.fillText('INCOMING TRANSMISSION…',W/2,320);ctx.textAlign='left';}
  }
  function loop(now){const dt=Math.min(.04,(now-lastTime)/1000||0);lastTime=now;update(dt);draw();requestAnimationFrame(loop);}
  function setKey(code,down){if(code==='ArrowLeft'||code==='KeyA')input.left=down;if(code==='ArrowRight'||code==='KeyD')input.right=down;if(code==='Space')input.fire=down;if(code==='KeyP'&&down){if(state==='playing'){state='paused';pauseScreen.classList.remove('hidden');}else if(state==='paused'){state='playing';pauseScreen.classList.add('hidden');}}}
  window.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();if(e.code==='Enter'&&(state==='intro'||state==='over'))resetGame();setKey(e.code,true);});
  window.addEventListener('keyup',e=>setKey(e.code,false));window.addEventListener('blur',()=>{input.left=input.right=input.fire=false;});
  $('startButton').addEventListener('click',resetGame);$('restartButton').addEventListener('click',resetGame);
  $('resumeButton').addEventListener('click',()=>{if(state==='paused'){state='playing';pauseScreen.classList.add('hidden');}});
  $('soundToggle').addEventListener('click',()=>{soundOn=!soundOn;$('soundToggle').innerHTML=`♫ <span>SOUND ${soundOn?'ON':'OFF'}</span>`;if(soundOn)sound(500,.08,'sine',.02);});
  function bindHold(id,key){const el=$(id);el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);input[key]=true;});for(const ev of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(ev,()=>input[key]=false);}
  bindHold('leftButton','left');bindHold('rightButton','right');bindHold('fireButton','fire');
  canvas.addEventListener('pointerdown',e=>{if(state!=='playing')return;pointerDown=true;canvas.setPointerCapture(e.pointerId);movePointer(e);});
  canvas.addEventListener('pointermove',e=>{if(pointerDown)movePointer(e);});
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,()=>pointerDown=false);
  function movePointer(e){const rect=canvas.getBoundingClientRect();player.x=Math.max(30,Math.min(W-30,(e.clientX-rect.left)/rect.width*W));}
  window.addEventListener('contextmenu',e=>e.preventDefault());
  updateHud();requestAnimationFrame(loop);
})();
