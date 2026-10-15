// Local procedural Foley: no downloads, and distinct windup / release / impact envelopes.
let noise=null,lastImpact=-1;
export function playSkillSound(ctx,options,d,phase){
 if(!ctx||ctx.state!=='running'||!options.sound||!d)return;const now=ctx.currentTime;
 if(phase==='hit'&&now-lastImpact<.055)return;if(phase==='hit')lastImpact=now;
 const master=ctx.createGain();master.gain.value=(options.sfx??.3)*.08;master.connect(ctx.destination);
 const base={silver:280,gold:350,fire:125,ice:1250,lightning:720,arcane:540,nature:470,wind:850,blood:160}[d.element]||400;
 const duration=phase==='hit'?.13:d.ultimate?.55:.23;
 for(let i=0;i<2;i++){const osc=ctx.createOscillator(),g=ctx.createGain();osc.type=i?'sine':d.classId==='sword'?'triangle':'sine';const hz=(phase==='hit'?base*.6:base)*(i?2:1)*Math.pow(2,(d.index%5)/12);osc.frequency.setValueAtTime(hz,now);osc.frequency.exponentialRampToValueAtTime(Math.max(45,hz*(phase==='hit'?.35:1.45)),now+duration);g.gain.setValueAtTime(.001,now);g.gain.linearRampToValueAtTime(i?.3:.6,now+.012);g.gain.exponentialRampToValueAtTime(.001,now+duration);osc.connect(g).connect(master);osc.start();osc.stop(now+duration+.01);osc.onended=()=>{osc.disconnect();g.disconnect();};}
 if(!noise||noise.sampleRate!==ctx.sampleRate){noise=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.6),ctx.sampleRate);const a=noise.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=(Math.sin(i*78.233)*43758.5453%1)*.6;}
 const src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();src.buffer=noise;filter.type=phase==='hit'?'lowpass':'bandpass';filter.frequency.value=d.element==='ice'?4200:phase==='hit'?900:1800;filter.Q.value=.6;gain.gain.setValueAtTime(.35,now);gain.gain.exponentialRampToValueAtTime(.001,now+duration);src.connect(filter).connect(gain).connect(master);src.start();src.stop(now+duration+.02);src.onended=()=>{src.disconnect();filter.disconnect();gain.disconnect();master.disconnect();};
}
