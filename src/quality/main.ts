import './review.css';
import {createCombatReview} from './CombatReview';

const base=import.meta.env.BASE_URL;
const root=document.querySelector<HTMLElement>('#review')!;
root.innerHTML=`
 <div id="review-world" aria-label="ฉากทดลองการต่อสู้ 3D"></div>
 <div class="review-shade"></div>
 <header class="review-header"><a class="review-brand" href="${base}">AETHERIA<span>CHRONICLES</span></a><div class="review-edition">ฉากทดลองภาพและจังหวะ<span>COMBAT STUDY · 01</span><button id="review-sound" disabled aria-pressed="false">เสียง: ปิด</button></div></header>
 <section class="review-caption"><span class="review-kicker">SANCTUARY APPROACH</span><h1>ก่อนแสงแรก</h1><p id="review-phase">กำลังเตรียมตัวละคร…</p></section>
 <div id="review-loading" role="status"><span class="loading-orbit"></span><b>กำลังเตรียมฉากต่อสู้</b><small>Kael · Lyra</small></div>
 <div class="review-hud">
  <div class="review-team" aria-label="คู่ตัวละครเริ่มต้น">
   <article class="review-hero"><img src="${base}assets/knight-portrait.png" alt="Kael"/><div><small>DAWNBLADE KNIGHT</small><strong>Kael</strong><span class="review-hp"><i></i></span><p>ดาบประชิด · คมดาบรุ่งอรุณ</p></div></article>
   <article class="review-hero priestess"><img src="${base}assets/healer-portrait.png" alt="Lyra"/><div><small>CRYSTAL PRIESTESS</small><strong>Lyra</strong><span class="review-hp"><i></i></span><p>คทา · คำภาวนาเยียวยา</p></div></article>
  </div>
  <div class="review-controls"><div class="review-transport"><button id="review-play" disabled>พัก</button><button id="review-restart" disabled>เล่นใหม่</button><button id="review-speed" disabled aria-label="เปลี่ยนความเร็ว">1×</button></div><div class="review-timeline"><i id="review-progress"></i></div><span class="review-time" id="review-time">00:00</span></div>
 </div><p class="review-note">ฉากสั้นสำหรับดูภาพและท่าต่อสู้ที่กำลังปรับปรุง</p>`;
const phase=document.querySelector<HTMLElement>('#review-phase')!;
const play=document.querySelector<HTMLButtonElement>('#review-play')!;
const restart=document.querySelector<HTMLButtonElement>('#review-restart')!;
const speed=document.querySelector<HTMLButtonElement>('#review-speed')!;
const sound=document.querySelector<HTMLButtonElement>('#review-sound')!;
let isPlaying=true,rate=1,soundEnabled=false;
let review:Awaited<ReturnType<typeof createCombatReview>>|undefined;
createCombatReview(document.querySelector<HTMLElement>('#review-world')!,state=>{
 isPlaying=state.playing;
 phase.textContent=state.phase;
 play.textContent=state.playing?'พัก':'เล่นต่อ';
 document.querySelector<HTMLElement>('#review-progress')!.style.width=`${Math.min(100,state.time/18*100)}%`;
 document.querySelector<HTMLElement>('#review-time')!.textContent=`00:${Math.floor(state.time).toString().padStart(2,'0')}`;
 if(state.ready){document.querySelector<HTMLElement>('#review-loading')!.hidden=true;play.disabled=restart.disabled=speed.disabled=sound.disabled=false;}
},{backgroundUrl:`${base}assets/quality/ruins-background.png`}).then(instance=>{review=instance;}).catch(error=>{
 document.querySelector<HTMLElement>('#review-loading')!.innerHTML='<b>โหลดฉากไม่สำเร็จ</b><small>ลองรีเฟรชหน้านี้อีกครั้ง</small>';
 console.error(error);
});
play.addEventListener('click',()=>isPlaying?review?.pause():review?.play());
restart.addEventListener('click',()=>review?.restart());
speed.addEventListener('click',()=>{rate=rate===1?.5:1;speed.textContent=rate===1?'1×':'½×';review?.setSpeed(rate);});
sound.addEventListener('click',()=>{soundEnabled=!soundEnabled;review?.setSound(soundEnabled);sound.textContent=`เสียง: ${soundEnabled?'เปิด':'ปิด'}`;sound.setAttribute('aria-pressed',String(soundEnabled));});
document.addEventListener('visibilitychange',()=>{if(document.hidden)review?.pause();});
window.addEventListener('pagehide',event=>{if(!event.persisted)review?.dispose();});
