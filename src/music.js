// Original Emberfall score. Scale degrees, harmony and orchestration are local;
// the same Web Audio synthesis is used by the game and offline review renders.
const MAJOR=[0,2,4,5,7,9,11],MINOR=[0,2,3,5,7,8,10],DORIAN=[0,2,3,5,7,9,10],HARMONIC=[0,2,3,5,7,8,11];
const phrase=(...bars)=>bars.map(b=>b.split(' ').map(n=>n==='.'?null:n==='-'?-99:Number(n)));
const HOME=phrase('4 . 5 4 2 . 1 .','0 . 2 . 4 . . -','5 . 4 2 1 . 2 .','4 . . . 2 . . -','3 . 4 5 7 . 5 .','4 . 2 . 1 . . -','2 . 4 3 1 . 2 .','0 . . . . . - -');
const DAWN=phrase('0 . 0 2 4 . 4 5','7 . 5 4 2 . . -','5 . 5 7 9 . 7 5','4 . . 2 4 . . -','3 . 4 5 7 . 5 4','2 . 4 5 4 . 2 -','1 . 2 4 5 . 4 2','0 . . . 4 . 2 -');
const GROVE=phrase('4 5 7 . 5 4 2 .','0 . 2 4 2 . . -','5 7 9 . 7 5 4 .','2 . 4 5 4 . . -','3 . 5 7 5 4 3 .','2 4 5 . 4 2 1 .','1 . 2 4 2 . 1 -','0 . . - 2 4 2 -');
const COAST=phrase('4 . 5 7 . 5 4 .','2 . 4 5 . 4 2 -','5 . 7 9 . 7 5 .','4 . 5 7 . . 4 -','3 . 4 5 . 7 5 .','2 . 4 5 . 4 2 .','1 2 4 . 5 4 2 .','0 . . - 2 . 4 -');
const CRYPT=phrase('0 . 4 . 7 . 6 .','5 . . 4 2 . . -','3 . 5 . 8 . 7 .','6 . . 5 4 . . -','5 4 3 . 2 . 4 .','1 . . 2 4 . 2 .','6 . 5 4 2 . 1 .','0 . . . . . 4 -');
const DUNES=phrase('0 1 2 . 4 . 5 4','2 1 0 . 1 . . -','4 5 6 . 7 . 6 5','4 2 1 . 2 . . -','3 4 5 . 6 . 5 3','2 1 2 4 5 . 4 .','6 5 4 . 2 1 2 .','0 . . - 1 2 4 -');
const FROST=phrase('7 . 4 5 7 . 9 .','7 . 5 4 2 . . -','5 . 2 4 5 . 7 .','5 . 4 2 0 . . -','3 . 5 7 8 . 7 .','4 . 5 7 5 . 4 .','2 . 4 5 7 5 4 2','0 . . . 4 . . -');
const MARSH=phrase('0 . 2 4 . 2 0 .','2 3 4 . 5 . 4 -','5 . 7 5 . 4 2 .','4 5 4 . 2 . . -','3 . 5 7 . 5 3 .','4 5 4 . 2 1 2 .','6 . 5 4 . 2 1 .','0 . . - 0 2 4 -');
const EMBER=phrase('0 0 4 . 0 0 5 .','7 . 5 4 2 4 5 -','5 5 7 . 5 5 9 .','7 . 5 4 2 . 4 -','3 3 5 . 7 5 3 .','2 2 4 . 5 4 2 .','6 5 4 2 1 2 4 2','0 . 0 . 4 . . -');
const SKY=phrase('4 . 7 . 9 . 7 5','4 . 5 7 5 . . -','5 . 7 . 9 . 11 9','7 . 5 4 2 . . -','3 . 5 . 7 9 7 5','4 . 7 5 4 . 2 .','1 . 4 5 7 . 5 4','0 . . . 4 . 7 -');
const ECLIPSE=phrase('0 0 2 4 7 . 6 5','4 2 1 2 4 . . -','5 5 7 9 11 . 9 7','6 5 4 2 4 . 7 -','3 3 5 7 8 . 7 5','4 2 4 5 7 . 5 4','6 5 4 2 1 2 4 6','7 . 6 4 0 . . -');
function score(id,title,bpm,root,scale,chords,melody,lead,pluck,drums){return Object.freeze({id,title,bpm,root,scale,chords,melody,lead,pluck,drums,bars:32,stepsPerBar:8,seconds:32*4*60/bpm});}
export const SCORES=Object.freeze({
 town:score('town','แสงไฟที่บ้าน',78,60,MAJOR,[0,4,5,3,0,5,3,4],HOME,'flute','harp','soft'),
 dawn:score('dawn','ก้าวแรกสู่อรุณ',112,62,[0,2,4,5,7,9,10],[0,3,4,0,5,3,4,0],DAWN,'horn','harp','march'),
 grove:score('grove','คำสัตย์แห่งพงไพร',116,64,DORIAN,[0,3,6,0,5,3,4,0],GROVE,'flute','marimba','forest'),
 coast:score('coast','ลมแห่งนักเดินเรือ',118,67,MAJOR,[0,4,5,3,0,5,3,4],COAST,'flute','harp','island'),
 crypt:score('crypt','ฝ่าผนึกจันทรา',110,60,MINOR,[0,5,3,4,0,6,3,4],CRYPT,'bell','harp','march'),
 dunes:score('dunes','ธงเหนือทะเลทราย',122,62,HARMONIC,[0,4,5,4,0,3,5,4],DUNES,'reed','marimba','island'),
 frost:score('frost','ประกายหิมะแห่งความกล้า',114,57,DORIAN,[0,3,6,0,5,3,4,0],FROST,'bell','harp','forest'),
 marsh:score('marsh','ฝ่าบึงแสงมรกต',118,55,MINOR,[0,6,3,4,5,3,4,0],MARSH,'reed','marimba','forest'),
 ember:score('ember','หัวใจแห่งเปลวเพลิง',132,64,MINOR,[0,5,3,6,0,3,5,4],EMBER,'horn','strings','heavy'),
 sky:score('sky','ปีกแห่งรุ่งอรุณ',124,65,MAJOR,[0,4,5,3,0,3,5,4],SKY,'horn','bell','march'),
 eclipse:score('eclipse','คำสาบานก่อนรุ่งสาง',138,62,HARMONIC,[0,5,3,4,0,6,5,4],ECLIPSE,'horn','strings','heavy')
});
export const noteHz=midi=>440*2**((midi-69)/12);
const pitch=(s,degree,octave=0)=>s.root+s.scale[((degree%7)+7)%7]+12*(Math.floor(degree/7)+octave);

// Pure score events: an eighth-note clock, 32-bar A/A'/B/A form. Silence and
// sustained notes are explicit; the loop resolves back into its first harmony.
export function notesForStep(s,step){
 const bar=Math.floor(step/8)%32,beat=step%8,chord=s.chords[Math.floor(bar/2)%8],town=s.id==='town',events=[];
 const add=(instrument,note,duration,gain,pan=0)=>events.push({instrument,note,duration,gain,pan});
 if(beat===0){for(const [i,d]of [chord,chord+2,chord+4].entries())add('strings',pitch(s,d,-1),7.8,town?.055:.045,(i-1)*.3);}
 if(beat===0||beat===4||!town&&beat===6)add('bass',pitch(s,chord+(beat===4?4:0),-2),town?3.4:1.6,town?.25:.29,0);
 const arp=town?[0,2,4,2]:[0,4,2,4,0,2,4,6],arpStep=town?beat%2===0:true;
 if(arpStep)add(s.pluck,pitch(s,chord+arp[town?beat/2:beat]),town?1.8:.8,town?.17:.105,beat%4<2?-.28:.28);
 const melody=s.melody[bar%8],degree=melody[beat],section=Math.floor(bar/8);
 if(degree!==null&&degree!==-99){let length=1;while(beat+length<8&&melody[beat+length]===null)length++;const lift=section===2&&bar%2===0?2:section===1&&degree<3?7:0;add(s.lead,pitch(s,degree+lift),Math.max(.6,length*.9),town?.29:.23,.06);}
 if(beat===0&&bar%4===0)add('bell',pitch(s,4,1),3,town?.065:.05,-.24);
 if(town){if(beat===3||beat===7)add('shaker',0,.3,.045,.35);}
 else{
  if(beat===0||beat===4||s.drums==='heavy'&&beat===6)add('kick',0,.65,s.drums==='heavy'?.45:.32);
  if(beat===2||beat===6)add('snare',0,.5,s.drums==='heavy'?.2:.14,-.08);
  if(beat%2===1||s.drums==='heavy')add('shaker',0,.2,.08,beat%2?.3:-.3);
  if(s.drums==='forest'&&[1,4,7].includes(beat)||s.drums==='island'&&[1,3,6].includes(beat))add('tom',pitch(s,chord,-2),.65,.22,-.2);
  if(bar%4===3&&beat>=6)add('tom',pitch(s,chord,-2),.5,.25,beat===6?-.3:.3);
 }
 return events;
}

const PATCHES={
 flute:{waves:[['sine',1,1],['triangle',2,.12]],attack:.045,release:.1,cutoff:3200},
 reed:{waves:[['triangle',1,.75],['sine',2,.18]],attack:.022,release:.08,cutoff:2200},
 horn:{waves:[['sawtooth',1,.38],['triangle',1,.6]],attack:.045,release:.12,cutoff:1800},
 harp:{waves:[['triangle',1,.8],['sine',2,.18]],attack:.006,release:.14,cutoff:2800,pluck:true},
 marimba:{waves:[['sine',1,1],['sine',3,.25]],attack:.004,release:.08,cutoff:3400,pluck:true},
 bell:{waves:[['sine',1,.8],['sine',2.01,.24]],attack:.005,release:.22,cutoff:5000,pluck:true},
 strings:{waves:[['sawtooth',1,.25],['triangle',1,.7]],attack:.22,release:.3,cutoff:1100},
 bass:{waves:[['sine',1,.8],['triangle',1,.35]],attack:.008,release:.09,cutoff:500}
};
export function noiseBuffer(ctx){const b=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.4),ctx.sampleRate),d=b.getChannelData(0);let seed=3917;for(let i=0;i<d.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;d[i]=seed/2147483648-1;}return b;}
export function reverbBuffer(ctx){const b=ctx.createBuffer(2,Math.ceil(ctx.sampleRate*1.15),ctx.sampleRate);let seed=237;for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<d.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;d[i]=(seed/2147483648-1)*Math.exp(-i/ctx.sampleRate*6)*.24;}}return b;}

// Notes own their nodes and disconnect at onended. A channel can stop scheduled
// voices immediately when iOS interrupts audio, avoiding catch-up note bursts.
export function playNote(ctx,destination,noise,event,time,stepSeconds){
 const {instrument,note,gain,pan=0}=event,duration=Math.max(.035,event.duration*stepSeconds),percussion=['kick','tom','snare','shaker'].includes(instrument),patch=PATCHES[instrument],sources=[],nodes=[];
 const envelope=ctx.createGain(),filter=ctx.createBiquadFilter(),stereo=ctx.createStereoPanner();nodes.push(envelope,filter,stereo);stereo.pan.value=pan;filter.type=instrument==='shaker'?'highpass':instrument==='snare'?'bandpass':'lowpass';filter.frequency.value=instrument==='shaker'?6500:instrument==='snare'?1800:percussion?1100:patch.cutoff;filter.Q.value=.5;envelope.connect(filter).connect(stereo).connect(destination);
 const attack=percussion?.003:Math.min(patch.attack,duration*.35),release=percussion?.06:patch.release,end=time+duration+release;
 envelope.gain.setValueAtTime(0,time);envelope.gain.linearRampToValueAtTime(gain,time+attack);
 if(percussion||patch.pluck)envelope.gain.exponentialRampToValueAtTime(.0001,time+duration);
 else{envelope.gain.linearRampToValueAtTime(gain*.72,time+Math.min(duration*.7,attack+.18));envelope.gain.setValueAtTime(gain*.68,time+duration);}
 envelope.gain.linearRampToValueAtTime(0,end);
 const source=(wave,hz,level=1)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type=wave;o.frequency.setValueAtTime(hz,time);g.gain.value=level;o.connect(g).connect(envelope);sources.push(o);nodes.push(g);return o;};
 if(instrument==='snare'||instrument==='shaker'){const n=ctx.createBufferSource();n.buffer=noise;n.connect(envelope);sources.push(n);if(instrument==='snare'){const o=source('triangle',165,.25);o.frequency.exponentialRampToValueAtTime(90,time+duration);}}
 else if(instrument==='kick'||instrument==='tom'){const o=source('sine',instrument==='kick'?145:Math.max(100,noteHz(note)*2));o.frequency.exponentialRampToValueAtTime(instrument==='kick'?47:Math.max(55,noteHz(note)),time+duration);}
 else for(const [wave,mult,level]of patch.waves)source(wave,noteHz(note)*mult,level);
 let pending=sources.length,finished=false;const cleanup=()=>{if(finished)return;finished=true;for(const n of [...sources,...nodes])n.disconnect();};
 for(const o of sources){o.onended=()=>{if(--pending===0)cleanup();};o.start(time);o.stop(end+.01);}
 return {stop(){if(finished)return;for(const o of sources){try{o.stop();}catch{/* already ended */}}cleanup();},end};
}
const ramp=(param,value,time,seconds)=>{if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(time);else{const previous=param.value;param.cancelScheduledValues(time);param.setValueAtTime(previous,time);}param.linearRampToValueAtTime(value,time+seconds);};

export class MusicPlayer{
 constructor(ctx){
  this.ctx=ctx;this.noise=noiseBuffer(ctx);this.input=ctx.createGain();this.master=ctx.createGain();this.master.gain.value=0;this.compressor=ctx.createDynamicsCompressor();this.compressor.threshold.value=-10;this.compressor.knee.value=12;this.compressor.ratio.value=4;this.compressor.attack.value=.01;this.compressor.release.value=.2;
  const convolver=ctx.createConvolver(),wet=ctx.createGain();convolver.buffer=reverbBuffer(ctx);wet.gain.value=.17;this.input.connect(this.compressor);this.input.connect(convolver).connect(wet).connect(this.compressor);this.compressor.connect(this.master).connect(ctx.destination);this.graph=[this.input,this.master,this.compressor,convolver,wet];this.current=null;this.retiring=new Set();this.timer=null;this.scheduled=0;this.transitions=0;this.volume=-1;this.desired=null;
  this.stateChange=()=>{if(ctx.state!=='running')this.halt();else if(this.desired)this.update(...this.desired);};ctx.addEventListener('statechange',this.stateChange);
 }
 update(mapId,options,{menu=false,title=false,hidden=false}={}){
  this.desired=[mapId,{...options},{menu,title,hidden}];const score=SCORES[mapId]||SCORES.town,level=options.sound&&!title&&!hidden?Math.min(.4,Math.max(0,Number(options.music)||0))*2*(menu?.45:1):0;
  if(this.ctx.state!=='running'||hidden){this.halt();return;}
  if(level!==this.volume){ramp(this.master.gain,level,this.ctx.currentTime,.15);this.volume=level;}
  if(level===0){if(this.current){this.retire(this.current,.22);this.current=null;}this.stopClock();return;}
  if(!this.current||this.current.score.id!==score.id){if(this.current)this.retire(this.current,.9);const bus=this.ctx.createGain();bus.gain.setValueAtTime(0,this.ctx.currentTime);bus.gain.linearRampToValueAtTime(1,this.ctx.currentTime+.9);bus.connect(this.input);this.current={score,bus,step:0,next:this.ctx.currentTime+.04,voices:new Set()};this.transitions++;}
  if(!this.timer){this.pump();this.timer=setInterval(()=>this.pump(),50);}
 }
 pump(){const channel=this.current;if(!channel||this.ctx.state!=='running')return;const now=this.ctx.currentTime,stepSeconds=30/channel.score.bpm;if(channel.next<now-.15)channel.next=now+.025;for(const v of channel.voices)if(v.end<now)channel.voices.delete(v);let scheduledSteps=0;while(channel.next<now+.18&&scheduledSteps++<16){for(const event of notesForStep(channel.score,channel.step)){channel.voices.add(playNote(this.ctx,channel.bus,this.noise,event,channel.next,stepSeconds));this.scheduled++;}channel.step=(channel.step+1)%(channel.score.bars*8);channel.next+=stepSeconds;}}
 retire(channel,seconds){ramp(channel.bus.gain,0,this.ctx.currentTime,seconds);this.retiring.add(channel);channel.cleanup=setTimeout(()=>{for(const voice of channel.voices)voice.stop();channel.voices.clear();channel.bus.disconnect();this.retiring.delete(channel);},seconds*1000+50);}
 stopClock(){if(this.timer){clearInterval(this.timer);this.timer=null;}}
 halt(){this.stopClock();if(this.current){for(const voice of this.current.voices)voice.stop();this.current.bus.disconnect();this.current=null;}for(const channel of this.retiring){clearTimeout(channel.cleanup);for(const voice of channel.voices)voice.stop();channel.bus.disconnect();}this.retiring.clear();this.master.gain.cancelScheduledValues(this.ctx.currentTime);this.master.gain.setValueAtTime(0,this.ctx.currentTime);this.volume=-1;}
 snapshot(){return{track:this.current?.score.id||null,title:this.current?.score.title||null,bpm:this.current?.score.bpm||0,context:this.ctx.state,volume:this.volume,voices:this.current?.voices.size||0,retiring:this.retiring.size,clock:!!this.timer,scheduled:this.scheduled,transitions:this.transitions};}
 dispose(){this.halt();this.ctx.removeEventListener('statechange',this.stateChange);for(const node of this.graph)node.disconnect();}
}
