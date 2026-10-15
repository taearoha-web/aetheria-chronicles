// Three original classes and ten distinct connected fields. All data is used by the live simulation.
export const CLASS={
 sword:{id:'sword',name:'นักดาบ',title:'อัศวินแห่งอรุณ',color:'#b5d7e4',hp:150,mp:70,attack:19,defense:3,range:1.8,rate:.68,role:'ประชิด • ฟันกวาด • เกราะป้องกัน',basic:'ฟันดาบ',skills:[
 {id:'cleave',name:'คมดาบจันทรา',level:1,mp:12,cd:3,cast:.72,release:.37,power:1.8,range:2.5,shape:'cone',element:'silver',icon:'sword'},
 {id:'nova',name:'พายุดาบ',level:4,mp:22,cd:6,cast:.9,release:.4,power:2.6,range:3,shape:'circle',element:'gold',icon:'whirl'},
 {id:'aegis',name:'โล่แห่งรุ่งอรุณ',level:8,mp:18,cd:12,cast:.7,release:.3,power:0,range:0,shape:'shield',element:'holy',icon:'shield'}]},
 archer:{id:'archer',name:'นักธนู',title:'ผู้พิทักษ์พงไพร',color:'#abdfb0',hp:115,mp:90,attack:18,defense:1,range:6.5,rate:.7,role:'ระยะไกล • ลูกศรทะลวง • วางกับดัก',basic:'ยิงธนู',skills:[
 {id:'volley',name:'ศรสามประกาย',level:1,mp:12,cd:3.5,cast:.76,release:.46,power:1.7,range:7,shape:'triple',element:'nature',icon:'arrows'},
 {id:'pierce',name:'ศรทะลวงพายุ',level:4,mp:20,cd:6,cast:.9,release:.55,power:2.5,range:8,shape:'line',element:'wind',icon:'arrow'},
 {id:'snare',name:'เถาวัลย์พิทักษ์',level:8,mp:22,cd:10,cast:.8,release:.42,power:1.1,range:5,shape:'trap',element:'nature',icon:'leaf'}]},
 mage:{id:'mage',name:'นักเวท',title:'ผู้เรียกแสงดารา',color:'#d5bce9',hp:100,mp:130,attack:21,defense:0,range:6,rate:.8,role:'ระยะไกล • เวทหมู่ • พื้นที่น้ำแข็ง',basic:'ประกายเวท',skills:[
 {id:'fireball',name:'ลูกไฟสุริยัน',level:1,mp:14,cd:3,cast:.85,release:.47,power:2.0,range:7,shape:'blast',element:'fire',icon:'fire'},
 {id:'frost',name:'บุปผาเหมันต์',level:4,mp:25,cd:7,cast:1,release:.54,power:1.9,range:6,shape:'frost',element:'ice',icon:'ice'},
 {id:'storm',name:'อัสนีดารา',level:8,mp:30,cd:10,cast:1.1,release:.58,power:3,range:7,shape:'chain',element:'arcane',icon:'star'}]}
};
const MAPS=[
 ['dawn','นครแสงอรุณ','เมือง • ร้านค้าและโรงตีเหล็ก','town',1,['#8caa69','#a0b578','#b2c58c'],'#c4c2ac','green','pink','slime','mushroom','skeleton','ผู้เฝ้าสวนศิลา',[[18,8],[37,9],[56,8]],[[16,12],[28,10],[44,10],[57,12]], [62,7]],
 ['grove','พงไพรกระซิบ','ป่าลึก • ปลุกแท่นรากไม้','forest',3,['#436b44','#4e794a','#5c824f'],'#a9976b','green','green','wolf','mushroom','treant','ราชันรากไม้',[[7,11],[18,13],[24,8]],[[9,19],[15,17],[22,15],[24,9]],[26,5]],
 ['coast','ชายฝั่งมุกคราม','ชายหาด • เสบียงของชาวเรือ','coast',5,['#d6bd83','#e1ca97','#e9d6a8'],'#c4a977','palm','palm','crab','wolf','crab','ปูเกราะมรกต',[[8,12],[20,16],[24,8]],[[8,18],[16,18],[22,12],[26,8]],[26,4]],
 ['crypt','สุสานจันทรา','สุสาน • ชำระผนึกวิญญาณ','crypt',7,['#666978','#747482','#82828e'],'#999a9e','arch','snow','skeleton','ghost','lich','เจ้าวิญญาณจันทรา',[[9,10],[19,14],[25,7]],[[9,19],[15,15],[24,12],[24,7]],[27,4]],
 ['dunes','นครทรายลืมเลือน','ทะเลทราย • ค้นหาเสาแห่งอรุณ','desert',9,['#cba46e','#d7b47c','#e0c18c'],'#b38f64','palm','crystal','scarab','scorpion','golem','โกเลมราชาทราย',[[8,9],[18,17],[25,10]],[[8,18],[17,17],[23,13],[26,8]],[27,4]],
 ['frost','หุบเขาเหมันต์','หิมะ • ปลุกคริสตัลอุ่น','snow',11,['#c8dde1','#d6e4e2','#e5ece2'],'#9ebbc6','snow','crystal','icewolf','elemental','golem','ผู้พิทักษ์น้ำแข็ง',[[8,13],[19,11],[25,8]],[[10,18],[16,15],[24,12],[25,8]],[27,4]],
 ['marsh','บึงหิ่งห้อย','หนองน้ำ • ฟื้นไฟแห่งบึง','marsh',13,['#496855','#57745a','#688261'],'#829275','green','crystal','slime','spider','spider','แม่ม่ายบึงมรกต',[[9,12],[18,16],[25,9]],[[8,18],[17,16],[24,11],[25,7]],[27,4]],
 ['ember','ภูผาเพลิง','ภูเขาไฟ • ทำลายแก่นเพลิง','lava',15,['#604b4c','#705958','#80645d'],'#a48770','volcano','volcano','imp','elemental','dragon','มังกรเถ้าถ่าน',[[8,10],[19,14],[25,8]],[[9,19],[17,16],[23,11],[25,7]],[27,4]],
 ['sky','วิหารเหนือเมฆ','เกาะลอยฟ้า • จุดแสงดาวทั้งสาม','sky',17,['#bac7c6','#cbd3c9','#dbe1d2'],'#e3dbc5','temple','crystal','wisp','guardian','guardian','เทวทูตหลงแสง',[[8,12],[19,16],[25,9]],[[8,18],[17,17],[23,13],[25,7]],[27,4]],
 ['eclipse','ปราสาทอุปราคา','ด่านสุดท้าย • คืนแสงให้โลก','castle',20,['#4c4c64','#5b586f','#6c647b'],'#9c8e9e','manor','arch','skeleton','imp','demon','ราชันรัตติกาล',[[8,10],[19,14],[25,8]],[[8,18],[17,16],[23,11],[25,7]],[27,4]]
];
export const TOWN={
 width:72,height:68,layout:3,plaza:{x:36,y:38},spawn:{x:40,y:42},gate:{x:37,y:16},chest:{x:60,y:51},
 services:[
 {id:'guide',district:'สมาคมนักเดินทาง',name:'ลูนา · ภารกิจ',classId:'archer',building:'manor',x:32,y:28,icon:'!',color:'#e3bd78'},
 {id:'merchant',district:'ตลาดแสงอรุณ',name:'โบ · ร้านยา',classId:'archer',building:'shop',x:21,y:43,icon:'◈',color:'#b5d396'},
 {id:'smith',district:'ย่านโรงตีเหล็ก',name:'อัคร · ตีเหล็ก',classId:'sword',building:'inn',x:17,y:24,icon:'⚒',color:'#e3aa78'},
 {id:'healer',district:'วิหารรักษา',name:'เอเรน · รักษา',classId:'mage',building:'temple',x:47,y:23,icon:'✦',color:'#b0d9d4'},
 {id:'storage',district:'คลังนักเดินทาง',name:'เซริน · คลัง',classId:'archer',building:'inn',x:58,y:40,icon:'▣',color:'#d6c5a0'},
 {id:'portal',district:'ประตูสิบดินแดน',name:'ผู้รักษาประตู',classId:'mage',building:'arch',x:50,y:55,icon:'✧',color:'#c9b6e5'}
 ],
 streets:[[{x:21,y:43},{x:36,y:38},{x:58,y:40}],[{x:17,y:24},{x:32,y:28},{x:36,y:38},{x:50,y:55}],[{x:47,y:23},{x:36,y:25},{x:32,y:28}],[{x:21,y:43},{x:33,y:55},{x:50,y:55},{x:58,y:40},{x:47,y:23}],[{x:36,y:38},{x:37,y:16},{x:37,y:9}]]
};
export const maps=MAPS.map((d,i)=>({id:d[0],index:i,name:d[1],subtitle:d[2],biome:d[3],level:d[4],floor:d[5],path:d[6],tree:d[7],decor:d[8],mobs:[d[9],d[10]],boss:d[11],bossName:d[12],shrines:d[13].map(([x,y])=>({x,y})),spawns:d[14].map(([x,y])=>({x,y})),arena:{x:d[15][0],y:d[15][1]},spawn:i===0?{...TOWN.spawn}:{x:5,y:24},exit:i===0?{x:52,y:57}:{x:3,y:25},chest:i===0?{...TOWN.chest}:{x:27,y:22},width:i===0?TOWN.width:32,height:i===0?TOWN.height:30}));
export const mapById=Object.fromEntries(maps.map(m=>[m.id,m]));
export const monsterNames={slime:'สไลม์อำพัน',mushroom:'เห็ดจอมซน',wolf:'หมาป่าพงไพร',treant:'ผู้เฝ้ารากไม้',crab:'ปูมุก',skeleton:'อัศวินกระดูก',ghost:'วิญญาณจันทรา',lich:'จอมเวทอาฆาต',scarab:'ด้วงเกราะทราย',scorpion:'แมงป่องอำพัน',golem:'โกเลมโบราณ',icewolf:'หมาป่าเหมันต์',elemental:'ภูตธาตุ',spider:'แมงมุมมรกต',imp:'อิมป์เถ้าถ่าน',dragon:'มังกรเพลิง',wisp:'ภูตดาว',guardian:'องครักษ์ปีกเงิน',demon:'ราชันอุปราคา'};
export const ELEMENTS={silver:'#d9f3ff',gold:'#ffe8a0',holy:'#fff0b3',nature:'#a7f5a8',wind:'#9ae8dc',fire:'#ffb36a',ice:'#a0eeff',arcane:'#d1b7ff'};
export const SKILLS=Object.fromEntries(Object.values(CLASS).flatMap(c=>c.skills.map(s=>[s.id,{...s,classId:c.id}])));
export const xpNext=l=>70+30*l+5*l*l;
export const equipmentName=(slot,cls,tier)=>`${({weapon:{sword:'ดาบ',archer:'ธนู',mage:'ไม้เท้า'}[cls],armor:'เกราะ',ring:'แหวน'})[slot]}${['แห่งอรุณ','พงไพร','มุกคราม','จันทรา','ราชาทราย','เหมันต์','มรกต','เพลิง','ดารา','อุปราคา'][tier]}`;
export const RARITIES={common:{name:'ธรรมดา',color:'#e1e1c9',mult:1},rare:{name:'หายาก',color:'#9edaf2',mult:1.3},epic:{name:'มหากาพย์',color:'#dab0ff',mult:1.65}};
