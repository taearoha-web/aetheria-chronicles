import {playSkillSound} from './skill-audio.js';
import {loadout,setLoadout,skillPoint} from './combat.js';
import {LEVEL_CAP} from './skill-data.js';
import {skillIcon} from './skill-vfx.js';
import { CLASS, SKILLS, maps, mapById, xpNext, RARITIES, TOWN } from "./data.js";
import { fresh, validate, migrate, SAVE, OLD_SAVE, session, tick, limits, field, dist, iso, direction, target, cast, dash, potion, interact, travel, equip, worn, itemPower, upgrade, salvage, store, withdraw, stat, claimQuest, revive, safe } from "./sim.js";
import { loadArt, drawCharacter, iconSVG } from "./art.js";
import { Renderer } from "./render.js";
import { findPath } from "./path.js";
import { MusicPlayer, SCORES } from "./music.js";
const $ = (id) => document.getElementById(id), escape = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const button = (action, label, disabled = false, cls = "") => `<button data-action="${action}" ${disabled ? "disabled" : ""} class="${cls}">${label}</button>`;
const heading = (title) => `<div class="panel-heading"><h2>${title}</h2>${button("resume", "\xD7", false, "close-panel")}</div>`;
async function boot() {
  const images = await loadArt(), renderer = new Renderer($("game"), images);
  let p = fresh(), s = session(p), mode = "title", selected = "sword", panelKind = "", endingShown = false, ready = false, saveTimer = 0, hudTimer = 0, toastTimer = 0, last = performance.now(), frames = 0, heldAttack = false, waypoints = [], autoTarget = null, routeAt = 0, filtered = "all";
  let skillPage=0,reviewFrozen=false,orientationBlocked=false;
  const resetSkillInputs=[];
  const landscape=matchMedia("(orientation: landscape)");
  const portraitTouch=matchMedia("(orientation: portrait) and (pointer: coarse) and (max-width: 1024px)");
  const keys = /* @__PURE__ */ new Set(), stick = { x: 0, y: 0, id: null };
  const logs = [];
  let audio = null, music = null, backgrounded = false;
  const tone = (hz, d = 0.1, type = "triangle", volume = 1) => {
    if (!p.options.sound || !audio || audio.state !== "running") return;
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(hz, audio.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(50, hz * 0.65), audio.currentTime + d);
    g.gain.setValueAtTime(p.options.sfx * 0.08 * volume, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(1e-4, audio.currentTime + d);
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + d + 0.01);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  };
  function syncMusic() {
    music?.update(s.map.id, p.options, { menu: mode !== "play", title: mode === "title", hidden: document.hidden || backgrounded || orientationBlocked });
  }
  function initAudio() {
    try {
      backgrounded = false;
      audio ??= new (window.AudioContext || window.webkitAudioContext)();
      music ??= new MusicPlayer(audio);
      if (audio.state !== "running") audio.resume().then(syncMusic).catch(() => {
      });
      syncMusic();
    } catch {
      audio = null;
      music = null;
    }
  }
  function resetInput() {
    resetSkillInputs.forEach(clear=>clear());
    s.aim=null;
    keys.clear();
    stick.x = stick.y = 0;
    stick.id = null;
    heldAttack = false;
    waypoints = [];
    autoTarget = null;
    $("thumb").style.transform = "";
  }
  function notify(message) {
    $("toast").textContent = message;
    $("toast").classList.add("show");
    toastTimer = 3;
  }
  function persist() {
    try {
      p.x = s.x;
      p.y = s.y;
      p.ground ??= {};
      p.ground[s.map.id] = structuredClone(s.drops);
      p.cooldowns = { ...s.hero.cooldowns };
      const valid = validate(structuredClone(p)), raw = JSON.stringify(valid), old = localStorage.getItem(SAVE);
      if (old) {
        try {
          validate(JSON.parse(old));
          localStorage.setItem(SAVE + "-backup", old);
        } catch {
        }
      }
      localStorage.setItem(SAVE, raw);
      return true;
    } catch (e) {
      notify("บันทึกไม่ได้ \xB7 " + e.message);
      return false;
    }
  }
  function readSave() {
    const raw = localStorage.getItem(SAVE);
    if (!raw) return null;
    try{if(JSON.parse(raw).schema===2&&!localStorage.getItem(SAVE+"-before-v6"))localStorage.setItem(SAVE+"-before-v6",raw);}catch{}
    try {
      return validate(JSON.parse(raw));
    } catch (e) {
      localStorage.setItem(SAVE + "-rejected", raw);
      const backup = localStorage.getItem(SAVE + "-backup");
      if (backup) {
        notify("เซฟมีปัญหา \xB7 โหลดสำรอง");
        return validate(JSON.parse(backup));
      }
      throw e;
    }
  }
  function modal(html, kind = "paused") {
    if (mode === "play") persist();
    mode = kind;
    panelKind = kind;
    resetInput();
    $("panel-content").innerHTML = html;
    if (!$("panel").open) $("panel").showModal();
    if(orientationBlocked){$("rotate-screen").close();$("rotate-screen").showModal();}
  }
  function close() {
    if (p.hp <= 0) {
      deathPanel();
      return;
    }
    mode = "play";
    panelKind = "";
    $("panel").close();
    resetInput();
    initAudio();
  }
  function classPortrait(canvas, id, full = false) {
    const c = canvas.getContext("2d");
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.imageSmoothingEnabled = false;
    drawCharacter(c, images, id, "idle", 0, canvas.width / 2, full ? canvas.height - 6 : canvas.height + 16, 2, { size: full ? canvas.height * 1.13 : canvas.height * 1.6 });
  }
  function title() {
    let exists = false, old = false;
    try {
      exists = !!readSave();
      old = !!localStorage.getItem(OLD_SAVE);
    } catch (e) {
      notify(e.message);
    }
    modal(`<div class="eyebrow">A CHIBI FANTASY ADVENTURE</div><h1>EMBERFALL</h1><div class="subtitle">C H R O N I C L E S</div><p>เลือกเส้นทางของคุณ \xB7 ล่ามอนสเตอร์ ค้นหาอุปกรณ์<br>เดินทางผ่านสิบดินแดน เพื่อคืนแสงแห่งอรุณ</p><div class="class-grid">${Object.values(CLASS).map((c) => `<div class="class-card ${c.id === selected ? "selected" : ""}" data-action="select:${c.id}" role="button" tabindex="0" aria-label="เลือก${c.name}"><canvas id="class-${c.id}" width="210" height="220"></canvas><h3>${c.name}</h3><p>${c.role}</p><small>HP ${c.hp} \xB7 MP ${c.mp}</small></div>`).join("")}</div><div class="title-controls"><input id="name-input" maxlength="20" value="นักเดินทาง" aria-label="ชื่อตัวละคร">${button("new", "เริ่มการเดินทาง", false, "primary")}${exists ? button("continue", "เดินทางต่อ") : ""}</div>${old ? button("migrate", "นำเข้าความคืบหน้าตัวอย่างเดิม", false, "subtle") : ""}${button("help", "วิธีเล่น / ติดตั้งบน iPhone", false, "subtle")}<p class="fine">3 อาชีพ \xB7 1 เมือง + 10 ด่าน \xB7 เล่นออฟไลน์เมื่อดาวน์โหลดครบ</p>`, "title");
    for (const c of Object.values(CLASS)) classPortrait($("class-" + c.id), c.id, true);
  }
  function start(data) {
    p = data;
    s = session(p);
    endingShown = !!field(p, "eclipse").boss;
    mode = "play";
    $("panel").close();
    renderer.center(s);
    resetInput();
    renderActions();
    classPortrait($("portrait"), p.classId);
    persist();
    initAudio();
    notify("คุย NPC เตรียมยา แล้วออกประตูเหนือไปด่าน 1");
  }
  function renderActions(){
    const c=CLASS[p.classId];
    $('hp-potion').innerHTML=iconSVG('potion')+'<small>HP · Q</small><em></em>';
    $('mp-potion').innerHTML=iconSVG('potion')+'<small>MP · R</small><em></em>';
    $('dash').innerHTML=iconSVG('dash')+'<small>หลบ</small><i class="cd"></i>';
    $('attack').innerHTML=iconSVG(c.id==='sword'?'sword':c.id==='archer'?'arrow':'star')+'<small>'+c.basic+'</small>';
    const visible=landscape.matches?[0,1,2,3,4,5]:skillPage?[0,1,4,5]:[0,1,2,3];
    $("skill-switch").hidden=landscape.matches;
    loadout(p).forEach((id,i)=>{const sk=SKILLS[id],el=$('skill-'+i),position=visible.indexOf(i);el.hidden=position<0;el.style.gridColumn=position%(landscape.matches?3:2)+1;el.style.gridRow=Math.floor(position/(landscape.matches?3:2))+(landscape.matches?1:2);
      el.innerHTML=`<img src="${skillIcon(images,sk)}" alt=""><small>${i+1} ${sk.name}</small><i class="cd"></i>`;el.title=`${sk.name} · MP ${sk.mp} · Lv ${sk.level}`;el.setAttribute('aria-label',sk.name);
    });
    $('skill-switch').innerHTML=`<b>⇄ ${skillPage?'5–6':'3–4'}</b><small>สลับชุด</small><em></em>`;
  }
  function skill(index,aim=null){const sk=SKILLS[loadout(p)[index]];if(!sk)return;const err=cast(s,sk.id,aim);if(err)notify(err);}
  function attack() {
    if (mode !== "play" || orientationBlocked) return;
    const err = cast(s);
    if (err === "ไม่มีเป้าหมายในระยะ") notify(err);
  }
  function uiItem(i, storage2 = false) {
    const power = itemPower(i), old = worn(p, i.slot), delta = (power.attack || 0) - (old ? itemPower(old).attack || 0 : 0), active = p.equipment[i.slot] === i.id;
    return `<div class="card" data-item="${i.id}" style="border-color:${i.rarity === "epic" ? "#a67da7" : i.rarity === "rare" ? "#7a9d9b" : "#b89e75"}"><div class="item-icon">${iconSVG(i.slot === "weapon" ? CLASS[p.classId].id === "sword" ? "sword" : p.classId === "archer" ? "arrow" : "star" : i.slot === "armor" ? "shield" : "star")}</div><b>${escape(i.name)}${i.upgrade ? " +" + i.upgrade : ""}</b><small>${RARITIES[i.rarity].name} \xB7 ${active ? "กำลังสวม" : i.locked ? "ล็อกอยู่" : "อยู่ในกระเป๋า"}</small><p>${Object.entries(power).map(([k, v]) => ({ attack: "ATK", defense: "DEF", hp: "HP", mp: "MP" })[k] + " +" + v).join(" \xB7 ")}${i.slot === "weapon" ? ` \xB7 เทียบ ${delta >= 0 ? "+" : ""}${delta} ATK` : ""}</p><div class="item-actions">${storage2 ? button("withdraw:" + i.id, "นำออก") : button("equip:" + i.id, active ? "สวมอยู่" : "สวมใส่", active) + button("lock:" + i.id, i.locked ? "ปลดล็อก" : "ล็อก") + button("store:" + i.id, "เก็บคลัง", active) + button("salvage:" + i.id, "ย่อย", active || i.locked)}</div></div>`;
  }
  function inventory() {
    const l = limits(p);
    modal(`${heading("สัมภาระของนักเดินทาง")}<div class="gear-summary"><div><small>เหรียญ / วัสดุ</small><b>${p.gold} G / ${p.materials}</b></div><div><small>ATK / DEF</small><b>${l.attack} / ${l.defense}</b></div><div><small>กระเป๋า / คลัง</small><b>${p.inventory.length}/50 \xB7 ${p.stash.length}/80</b></div></div><div class="toolbar"><select id="item-filter" aria-label="กรองไอเทม"><option value="all">อุปกรณ์ทั้งหมด</option><option value="weapon">อาวุธ</option><option value="armor">เกราะ</option><option value="ring">แหวน</option></select>${button("storage", "เปิดคลัง")}${button("character", "ตัวละคร / สกิล")}</div><div class="list">${p.inventory.filter((i) => filtered === "all" || i.slot === filtered).map((i) => uiItem(i)).join("")}</div><div id="panel-note"></div>`, "inventory");
    $("item-filter").value = filtered;
    $("item-filter").onchange = (e) => {
      filtered = e.target.value;
      inventory();
    };
  }
  function storage() {
    modal(`${heading("คลังแห่งแสงอรุณ")}<p>ไอเทมที่กระเป๋าเต็มจะเข้าคลังสำรอง เพื่อรักษารางวัลไว้<br>คลัง ${p.stash.length} ชิ้น</p><div class="list">${p.stash.length ? p.stash.map((i) => uiItem(i, true)).join("") : "<p>คลังยังว่าง</p>"}</div>${button("inventory", "กลับกระเป๋า")}<div id="panel-note"></div>`, "storage");
  }
  function character(){const l=limits(p);modal(`${heading(escape(p.name)+' · '+CLASS[p.classId].name)}<p>Lv ${p.level} / ${LEVEL_CAP} · ATK ${l.attack} · DEF ${l.defense} · แต้ม ${p.statPoints}</p><div class="stat-grid">${[['strength','พลัง'],['agility','คล่องแคล่ว'],['spirit','จิต'],['vitality','กำลัง']].map(([k,v])=>`<div><small>${v}</small><b>${p.stats[k]}</b>${button('stat:'+k,'+',p.statPoints<1)}</div>`).join('')}</div><div class="loadout-summary">${loadout(p).map((id,i)=>`<div><span>${i+1}${i===5?' ✦':''}</span><img src="${skillIcon(images,SKILLS[id])}" alt=""><small>${SKILLS[id].name}</small></div>`).join('')}</div><p>20 สกิล · เลือกติดตั้ง 6 ช่อง · อัลติเมตใช้ช่อง 6<br>แตะใช้ทันที หรือกดค้างลากเพื่อเล็ง · เปลี่ยนชุดเมื่อพ้นการต่อสู้</p><div class="list skillbook">${CLASS[p.classId].skills.map(sk=>`<div class="card skill-card ${p.level<sk.level?'unlearned':''}" data-skill="${sk.id}"><img class="skill-art" src="${skillIcon(images,sk)}" alt="${sk.name}"><b>${sk.code} · ${sk.name}</b><p>Lv ${sk.level} · MP ${sk.mp} · CD ${sk.cd}s</p><small>${sk.description}${sk.power?' · รวม '+Math.round(sk.power*100)+'% ATK':''}${sk.duration?' · '+sk.duration+' วินาที':''}</small><div class="equip-skills">${Array.from({length:6},(_,i)=>button('install:'+sk.id+':'+i,loadout(p)[i]===sk.id?'✓ '+(i+1):String(i+1),p.level<sk.level||sk.ultimate&&i!==5,loadout(p)[i]===sk.id?'selected':'')).join('')}</div></div>`).join('')}</div><div id="panel-note"></div>`,'character');}
  function mapMenu() {
    modal(`${heading("เมืองและสิบด่านต่อสู้")}${!s.map.isTown ? button("town", "กลับนครแสงอรุณ", false, "primary") : ""}${s.map.isTown ? button("city", "ผังเมือง / หา NPC", false, "primary") : ""}<p>แต่ละแผนที่ต้องผ่านบอสก่อนหน้า \xB7 ระดับที่แสดงเป็นคำแนะนำ</p><div class="list">${maps.map((m) => {
      const unlocked = m.index === 0 || p.fields[maps[m.index - 1].id]?.boss, complete = p.fields[m.id]?.boss;
      return `<div class="card map-card ${m.id === s.map.id ? "current" : ""} ${complete ? "complete" : ""}" data-number="${String(m.index + 1).padStart(2, "0")}"><b>${m.name}</b><p>${m.subtitle}</p><small>แนะนำ Lv${m.level} \xB7 ${complete ? "ผ่านแล้ว" : unlocked ? "เปิดแล้ว" : "ยังไม่เปิด"}</small>${button("travel:" + m.id, m.id === s.map.id ? "แผนที่ปัจจุบัน" : unlocked ? "เดินทาง" : "ล็อก", !unlocked || m.id === s.map.id)}</div>`;
    }).join("")}</div><div id="panel-note"></div>`, "map");
  }
  function cityMenu() {
    modal(`${heading("ผังนครแสงอรุณ")}<p>ลานน้ำพุกลางเมือง \xB7 ถนนเชื่อมย่านบริการทั้งหก<br>เลือกจุดหมายเพื่อเดินไปตามเส้นทางจริง</p><canvas id="city-map" width="520" height="340" style="display:block;width:100%;height:auto;max-width:600px;margin:0 auto;background:#173638;border:1px solid #b99d6b;border-radius:8px"></canvas><div class="list">${TOWN.services.map((n) => `<div class="card"><b>${n.icon} ${n.district}</b><p>${n.name}</p>${button("walkto:" + n.id, "เดินไปจุดนี้")}</div>`).join("")}</div>${button("walkto:gate", "ไปประตูสวนมอนสเตอร์")}`, "city");
    renderer.minimap($("city-map"), s);
  }
  function guide() {
    modal(`${heading("ลูนา \xB7 คำร้องแห่งแสงอรุณ")}<p class="speech">แสงในศิลาทั้งสามคือกุญแจของดินแดน<br>ปลุกศิลา ปราบผู้เฝ้าประตู แล้วกลับมารับรางวัล</p><div class="list">${maps.filter((m) => p.fields[m.id]?.boss).map((m) => `<div class="card"><b>${m.name}</b><p>${80 + m.index * 35} เหรียญ \xB7 ${5 + m.index} วัสดุ \xB7 EXP</p>${button("claim:" + m.id, p.fields[m.id].questClaimed ? "รับแล้ว" : "รับรางวัล", p.fields[m.id].questClaimed)}</div>`).join("") || "<p>ยังไม่มีภารกิจที่ผ่านแล้ว</p>"}</div>`, "guide");
  }
  function merchant() {
    modal(`${heading("โบ \xB7 ร้านค้าของนักเดินทาง")}<p>เหรียญ ${p.gold} G \xB7 ยา HP ${p.potions.hp} \xB7 ยา MP ${p.potions.mp}</p><div class="list"><div class="card"><b>ยาฟื้น HP</b><p>ฟื้น50% MaxHP \xB7 10เหรียญ</p>${button("buy:hp", "ซื้อ 1 ขวด", p.gold < 10)}</div><div class="card"><b>ยาฟื้น MP</b><p>ฟื้น50% MaxMP \xB7 10เหรียญ</p>${button("buy:mp", "ซื้อ 1 ขวด", p.gold < 10)}</div></div><div id="panel-note"></div>`, "merchant");
  }
  function smith() {
    modal(`${heading("อัคร \xB7 โรงตีเหล็ก")}<p>ตีบวกสำเร็จแน่นอน สูงสุด+5 \xB7 ${p.gold} G \xB7 ${p.materials} วัสดุ</p><div class="list">${p.inventory.map((i) => `<div class="card"><b>${escape(i.name)} +${i.upgrade}</b><p>${i.upgrade >= 5 ? "ตีบวกสูงสุดแล้ว" : `${30 * (i.upgrade + 1) * (i.tier + 1)} เหรียญ / ${i.upgrade + 1} วัสดุ`}</p>${button("upgrade:" + i.id, "ตีบวก", i.upgrade >= 5)}</div>`).join("")}</div><div id="panel-note"></div>`, "smith");
  }
  function settings() {
    modal(`${heading("พักที่แสงอรุณ")}<div class="toolbar">${button("resume", "เล่นต่อ", false, "primary")}${button("inventory", "กระเป๋า")}${button("character", "ตัวละคร")}${button("map", "แผนที่")}</div><div class="toolbar">${button("town", "กลับเมือง")}${button("sound", "เสียง " + (p.options.sound ? "เปิด" : "ปิด"))}${button("export", "ส่งออกเซฟ")}${button("import", "นำเข้าเซฟ")}${button("help", "วิธีเล่น / iPhone")}${button("title", "หน้าหลัก")}</div><p class="fine">♫ ${SCORES[s.map.id]?.title || SCORES.town.title} \xB7 ${s.map.isTown ? "อบอุ่นและปลอดภัย" : "ผจญภัยพร้อมสู้รบ"}</p><div class="toolbar">${["full","balanced","lite"].map((q,i)=>button("quality:"+q,["ภาพเต็ม","สมดุล","ประหยัด"][i],false,p.options.quality===q?"selected":"")).join("")}${button("shake","กล้องสั่น "+(p.options.shake===false?"ปิด":"เปิด"))}</div><label class="settings-row">ดนตรี <output id="music-percent">${Math.round(p.options.music / 0.4 * 100)}%</output><input aria-label="ความดังดนตรี" id="music-volume" type="range" min="0" max=".4" step=".01" value="${p.options.music}"></label><label class="settings-row">เอฟเฟกต์ <input aria-label="ความดังเอฟเฟกต์" id="sfx-volume" type="range" min="0" max="1" step=".05" value="${p.options.sfx}"></label><p class="fine">${ready ? "ดาวน์โหลดครบ \xB7 พร้อมเล่นออฟไลน์" : "รอไฟล์ดาวน์โหลดครบก่อนปิดอินเทอร์เน็ต"}<br>WASD เดิน \xB7 J โจมตี \xB7 1–6 สกิล \xB7 Space หลบ \xB7 Q/R ยา \xB7 E สำรวจ</p>`, "settings");
    $("music-volume").oninput = (e) => {
      p.options.music = Number(e.target.value);
      $("music-percent").textContent = Math.round(p.options.music / 0.4 * 100) + "%";
      syncMusic();
    };
    $("music-volume").onchange = persist;
    $("sfx-volume").oninput = (e) => p.options.sfx = Number(e.target.value);
    $("sfx-volume").onchange = persist;
  }
  function help() {
    const before = mode;
    modal(`${heading("คู่มือนักเดินทาง")}<p class="speech">จอยซ้ายหรือ WASD เดิน \xB7 แตะพื้นเพื่อหาทางเดิน<br>แตะมอนสเตอร์เพื่อเข้าระยะและโจมตี หรือกด J<br>1–6 ใช้สกิลตามเลเวล \xB7 Space หลบ \xB7 Q/R ยา HP/MP<br>ใกล้ศิลา NPC หรือหีบ กด E / สำรวจ<br>ของบนพื้นมีชื่อและสี เดินใกล้เพื่อเก็บ แล้วเปิดกระเป๋าสวมใส่</p><p><b>เล่นแนวนอน:</b> หมุนเครื่องและปิดล็อกแนวตั้งของ iPhone<br>จอยซ้ายเดิน · ปุ่มขวาโจมตี/หลบ · สกิล 6 ช่องกดได้ทันที<br>หมุนกลับแนวตั้งแล้วเกมจะพักอัตโนมัติ</p><p><b>ติดตั้งบน iPhone:</b> เปิดลิงก์ HTTPS ใน Safari<br>แชร์ → เพิ่มไปยังหน้าจอโฮม<br>รอข้อความ “พร้อมเล่นออฟไลน์” ก่อนปิดเครือข่าย<br>ส่งออกเซฟสำรองเป็นระยะ เพราะ iOS อาจล้างข้อมูลเว็บไซต์</p>${button(before === "title" ? "title" : "resume", "เข้าใจแล้ว", false, "primary")}`, "help");
  }
  function deathPanel() {
    modal(`<div class="eyebrow">THE EMBER STILL GLOWS</div><h2>แสงของคุณยังไม่ดับ</h2><p>ฟื้นที่จุดพักของแผนที่นี้ เสียเหรียญ5%<br>รักษาเลเวล อุปกรณ์ และแสงศิลาไว้</p>${button("revive", "กลับมาออกเดินทาง", false, "primary")}`, "dead");
  }
  function showEnding() {
    endingShown = true;
    modal(`<div class="eyebrow">DAWN RETURNS TO THE WORLD</div><h2>แสงอรุณที่หวนคืน</h2><p>คุณเดินทางผ่านสิบดินแดนและปราบราชันรัตติกาลแล้ว<br>ยังกลับไปล่าอุปกรณ์ ตีบวก และสำรวจได้ทุกแมพ</p>${button("resume", "เดินทางต่อ", false, "primary")}${button("map", "สิบดินแดน")}`, "ending");
  }
  function refresh() {
    if (panelKind === "inventory") inventory();
    else if (panelKind === "storage") storage();
    else if (panelKind === "smith") smith();
    else if (panelKind === "character") character();
    else if (panelKind === "merchant") merchant();
  }
  function interactAction() {
    if (mode !== "play" || orientationBlocked) return;
    const action2 = interact(s);
    if (action2 === "field-gate" || action2 === "town-return") {
      travel(s, action2 === "field-gate" ? "dawn" : "town");
      renderer.center(s);
      resetInput();
      persist();
      notify(s.map.isTown ? "กลับสู่เมืองปลอดภัย" : "เข้าสู่เขตต่อสู้ \xB7 " + s.map.name);
    } else if (action2 === "guide") guide();
    else if (action2 === "merchant") merchant();
    else if (action2 === "smith") smith();
    else if (action2 === "healer") {
      const l = limits(p);
      p.hp = l.hp;
      p.mp = l.mp;
      notify("รักษาเต็มกำลังแล้ว");
      persist();
    } else if (action2 === "storage") storage();
    else if (action2 === "portal") mapMenu();
    else if (action2) {
      notify(s.notice || "สำรวจสำเร็จ");
      persist();
    }
  }
  async function action(command) {
    if(command.startsWith("install:")){const [,id,slot]=command.split(":");const error=setLoadout(s,Number(slot),id);if(error)notify(error);else{persist();renderActions();}character();return;}
    if(command.startsWith("quality:")){p.options.quality=command.split(":")[1];persist();settings();return;}
    if(command==="shake"){p.options.shake=p.options.shake===false;persist();settings();return;}
    const [a, id] = command.split(":");
    if (a === "select") {
      selected = id;
      document.querySelectorAll(".class-card").forEach((c) => c.classList.toggle("selected", c.dataset.action === "select:" + id));
      return;
    }
    if (a === "new") {
      const next = fresh(selected, $("name-input")?.value);
      if (localStorage.getItem(SAVE)) modal(`${heading("เริ่มการเดินทางใหม่")}<p>จะเริ่มนักเดินทาง ${CLASS[selected].name} ใหม่<br>ส่งออกเซฟเดิมไว้ก่อนได้</p>${button("confirm-new:" + selected, "เริ่มใหม่", false, "primary")}${button("export", "ส่งออกเซฟเดิม")}${button("title", "กลับ")}`, "confirm-new");
      else start(next);
      return;
    }
    if (a === "confirm-new") {
      start(fresh(id));
      return;
    }
    if (a === "continue") {
      const next = readSave();
      if (next) {
        start(next);
        if (p.hp <= 0) deathPanel();
      }
      return;
    }
    if (a === "migrate") {
      const raw = localStorage.getItem(OLD_SAVE);
      start(migrate(JSON.parse(raw)));
      notify("ย้ายเลเวล/เหรียญแล้ว \xB7 เซฟตัวอย่างเดิมยังอยู่");
      return;
    }
    if (a === "resume") {
      close();
      return;
    }
    if (a === "title") {
      if (mode !== "title") persist();
      title();
      return;
    }
    if (a === "help") {
      help();
      return;
    }
    if (a === "inventory") {
      inventory();
      return;
    }
    if (a === "character") {
      character();
      return;
    }
    if (a === "map") {
      mapMenu();
      return;
    }
    if (a === "city") {
      cityMenu();
      return;
    }
    if (a === "walkto") {
      const goal = id === "gate" ? { x: TOWN.gate.x, y: TOWN.gate.y - 1.1 } : TOWN.services.find((n) => n.id === id);
      if (!s.map.isTown || !goal) return;
      const route = findPath(s, goal.x + (id === "gate" ? 0 : 1.5), goal.y - (id === "gate" ? 0 : 1.5));
      if (!route.length) {
        notify("หาทางไปจุดนี้ไม่พบ");
        return;
      }
      close();
      waypoints = route;
      notify("กำลังเดินไป " + (goal.district || "สวนมอนสเตอร์") + " \xB7 เดินเองเพื่อยกเลิก");
      return;
    }
    if (a === "storage") {
      storage();
      return;
    }
    if (a === "settings") {
      settings();
      return;
    }
    if (a === "travel" || a === "town") {
      const error2 = travel(s, a === "town" ? "town" : id);
      if (error2) {
        notify(error2);
        return;
      }
      p = s.p;
      renderer.center(s);
      close();
      persist();
      notify(s.map.name);
      return;
    }
    if (a === "revive") {
      revive(s);
      renderer.center(s);
      close();
      persist();
      return;
    }
    if (a === "sound") {
      p.options.sound = !p.options.sound;
      initAudio();
      settings();
      persist();
      return;
    }
    if (a === "buy") {
      if (p.gold >= 10) {
        p.gold -= 10;
        p.potions[id]++;
        persist();
        merchant();
      } else notify("เหรียญไม่พอ");
      return;
    }
    if (a === "claim") {
      const err = claimQuest(s, id);
      if (err) notify(err);
      persist();
      guide();
      return;
    }
    if (a === "export") {
      if (mode === "title" || panelKind === "confirm-new") {
        const old = readSave();
        if (old) {
          download(old);
          return;
        }
      }
      persist();
      download(p);
      return;
    }
    if (a === "import") {
      $("import-file").click();
      return;
    }
    let error = null;
    if (a === "equip") error = equip(p, Number(id));
    else if (a === "upgrade") error = upgrade(p, Number(id));
    else if (a === "salvage") {
      const i = p.inventory.find((i2) => i2.id === Number(id));
      if (i && i.rarity !== "common") {
        modal(`${heading("ยืนยันย่อยอุปกรณ์")}<p>${escape(i.name)} \xB7 ${RARITIES[i.rarity].name}<br>ย่อยแล้วจะได้รับวัสดุ อุปกรณ์ชิ้นนี้จะหายไป</p>${button("confirm-salvage:" + id, "ยืนยันย่อย")}${button("inventory", "เก็บไว้")}`, "confirm-salvage");
        return;
      }
      error = salvage(p, Number(id));
    } else if (a === "confirm-salvage") {
      error = salvage(p, Number(id));
      panelKind = "inventory";
    } else if (a === "store") error = store(p, Number(id));
    else if (a === "withdraw") error = withdraw(p, Number(id));
    else if (a === "stat") error = stat(p, id);
    else if (a === "lock") {
      const i = p.inventory.find((i2) => i2.id === Number(id));
      if (i) i.locked = !i.locked;
    } else return;
    persist();
    refresh();
    if (error) {
      notify(error);
      if ($("panel-note")) $("panel-note").textContent = error;
    }
  }
  function download(data) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })), a = document.createElement("a");
    a.href = url;
    a.download = "emberfall-chronicles-save.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-action]");
    if (b && !b.disabled) Promise.resolve(action(b.dataset.action)).catch((err) => notify(err.message));
  });
  document.addEventListener("keydown", (e) => {
    if(orientationBlocked)return;
    if ((e.code === "Enter" || e.code === "Space") && e.target.matches(".class-card")) {
      e.preventDefault();
      action(e.target.dataset.action);
    }
  });
  $("import-file").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()), next = data.schema === 1 ? migrate(data) : validate(data);
      start(next);
      if (p.hp <= 0) deathPanel();
      notify("นำเข้าเซฟแล้ว");
    } catch (err) {
      notify("นำเข้าไม่สำเร็จ \xB7 " + err.message);
    }
    e.target.value = "";
  };
  $("panel").addEventListener("cancel", (e) => {
    e.preventDefault();
    if (!["title", "dead", "confirm-new"].includes(mode)) close();
  });
  $("menu").onclick = () => {
    if (mode === "play") settings();
  };
  const joy = $("joystick");
  function updateStick(e) {
    const r = joy.getBoundingClientRect(), dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2, n = Math.hypot(dx, dy), max = r.width * 0.34;
    stick.x = dx / Math.max(n, max);
    stick.y = dy / Math.max(n, max);
    const k = n > max ? max / n : 1;
    $("thumb").style.transform = `translate(${dx * k}px,${dy * k}px)`;
  }
  joy.onpointerdown = (e) => {
    if (mode !== "play" || orientationBlocked) return;
    e.preventDefault();
    stick.id = e.pointerId;
    joy.setPointerCapture(e.pointerId);
    updateStick(e);
  };
  joy.onpointermove = (e) => {
    if (e.pointerId === stick.id) {
      e.preventDefault();
      updateStick(e);
    }
  };
  for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) joy.addEventListener(name, (e) => {
    if (e.pointerId === stick.id) {
      stick.x = stick.y = 0;
      stick.id = null;
      $("thumb").style.transform = "";
    }
  });
  function bind(id, fn, hold = false) {
    const el = $(id);
    el.onpointerdown = (e) => {
      if (mode !== "play" || orientationBlocked) return;
      e.preventDefault();
      initAudio();
      if (hold) {
        heldAttack = true;
        el.setPointerCapture(e.pointerId);
      }
      fn();
    };
    if (hold) for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) el.addEventListener(t, () => heldAttack = false);
  }
  bind("attack", attack, true);
  for(let i=0;i<6;i++){
    const el=$('skill-'+i);let start=null;
    resetSkillInputs.push(()=>{start=null;});
    el.onpointerdown=e=>{if(mode!=='play'||orientationBlocked)return;e.preventDefault();initAudio();el.setPointerCapture(e.pointerId);start={x:e.clientX,y:e.clientY,t:performance.now()};const d=SKILLS[loadout(p)[i]],q=skillPoint(s,d,null,target(s,d.range));s.aim={id:d.id,...q};};
    el.onpointermove=e=>{if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y,n=Math.hypot(dx,dy);if(n<12)return;const d=SKILLS[loadout(p)[i]],v={x:(dx+dy*2)/2,y:(dy*2-dx)/2},length=Math.hypot(v.x,v.y)||1;s.aim={id:d.id,x:s.x+v.x/length*d.range*Math.min(1,n/80),y:s.y+v.y/length*d.range*Math.min(1,n/80)};};
    el.onpointerup=e=>{if(!start)return;const moved=Math.hypot(e.clientX-start.x,e.clientY-start.y),elapsed=performance.now()-start.t,aim=moved>12?s.aim:null;start=null;if(!(elapsed>350&&moved<12))skill(i,aim);s.aim=null;};
    el.onpointercancel=el.onlostpointercapture=()=>{start=null;s.aim=null;};
  }
  bind('skill-switch',()=>{skillPage=1-skillPage;renderActions();});bind('skill-book',character);
  bind("dash", () => {
    const err = dash(s);
    if (err) notify(err);
  });
  bind("hp-potion", () => {
    const err = potion(s, "hp");
    if (err) notify(err);
  });
  bind("mp-potion", () => {
    const err = potion(s, "mp");
    if (err) notify(err);
  });
  bind("interact", interactAction);
  document.addEventListener("keydown", (e) => {
    if(orientationBlocked)return;
    if (mode !== "play") {
      if (e.code === "Escape" && !["title", "dead", "confirm-new"].includes(mode)) close();
      return;
    }
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    keys.add(e.code);
    if (e.repeat) return;
    if (e.code === "Escape") settings();
    if (e.code === "KeyE") interactAction();
    if (e.code === "KeyQ") {
      const err = potion(s, "hp");
      if (err) notify(err);
    }
    if (e.code === "KeyR") {
      const err = potion(s, "mp");
      if (err) notify(err);
    }
    if (e.code === "Space") dash(s);
    if (["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6"].includes(e.code)) skill(Number(e.code.at(-1)) - 1);
    if (e.code === "KeyI") inventory();
    if (e.code === "KeyM") mapMenu();
  });
  document.addEventListener("keyup", (e) => keys.delete(e.code));
  $("game").onpointerdown = (e) => {
    if (mode !== "play" || orientationBlocked) return;
    const r = $("game").getBoundingClientRect(), x = (e.clientX - r.left) / r.width * renderer.width, y = (e.clientY - r.top) / r.height * renderer.height;
    const foe = s.enemies.filter((e2) => !e2.dead && (!e2.boss || field(p).shrines.length === 3)).find((e2) => {
      const p2 = renderer.screen(e2.x, e2.y);
      return Math.abs(x - p2.x) < 24 && y > p2.y - (e2.boss ? 90 : 50) && y < p2.y + 7;
    });
    if (foe) {
      autoTarget = foe.id;
      waypoints = [];
      routeAt = 0;
      return;
    }
    const goal = renderer.world(x, y);
    if (!s.world.block(goal.x, goal.y)) {
      autoTarget = null;
      waypoints = findPath(s, goal.x, goal.y);
      if (!waypoints.length) notify("หาทางไปจุดนี้ไม่พบ");
    }
  };
  const blur = () => {
    backgrounded = true;
    resetInput();
    if (mode === "play") {
      persist();
      settings();
    }
    syncMusic();
    audio?.suspend().catch(() => {
    });
  };
  window.addEventListener("blur", blur);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) blur();
  });
  window.addEventListener("pagehide", () => {
    if (mode !== "title") persist();
    backgrounded = true;
    music?.halt();
    audio?.suspend().catch(() => {
    });
  });
  document.addEventListener("pointerdown", () => {
    if (mode === "play" && !document.hidden && (backgrounded || audio?.state !== "running")) initAudio();
  });
  document.addEventListener("keydown", () => {
    if (mode === "play" && !document.hidden && (backgrounded || audio?.state !== "running")) initAudio();
  });
  function syncOrientation(){
    const blocked=portraitTouch.matches;
    if(blocked!==orientationBlocked){
      orientationBlocked=blocked;
      resetInput();
      if(blocked&&mode!=="title")persist();
      syncMusic();
    }
    const gate=$("rotate-screen");
    if(blocked&&!gate.open)gate.showModal();
    if(!blocked&&gate.open)gate.close();
    renderer.resize();
  }
  $("rotate-screen").addEventListener("cancel",e=>e.preventDefault());
  landscape.addEventListener("change",()=>{renderActions();syncOrientation();});
  portraitTouch.addEventListener("change",syncOrientation);
  window.addEventListener("resize",syncOrientation);
  function contextual() {
    const n = s.npcs.find((n2) => dist(n2, s) < 2.8);
    if (n) return n.name;
    if (s.map.shrines.some((n2) => dist(n2, s) < 1.35)) return "ปลุก / ตรวจศิลา";
    if (!field(p).chest && dist(s, s.map.chest) < 1.3) return "เปิดหีบ";
    if (s.map.isTown && dist(s, TOWN.gate) < 2.3) return "ออกสู่ด่าน 1";
    if (dist(s, s.map.spawn) < 1.5) return "พักฟื้น";
    if (dist(s, s.map.exit) < 1.4) return s.map.isTown ? "ประตูเดินทาง" : "กลับเมือง";
    return null;
  }
  function hud() {
    const l = limits(p), c = CLASS[p.classId], f = field(p), pct = (v, max) => 100 * Math.max(0, Math.min(1, v / max));
    $("hero-name").textContent = p.name;
    $("class-name").textContent = c.name;
    $("level").textContent = p.level;
    $("hp-fill").style.width = pct(p.hp, l.hp) + "%";
    $("hp-text").textContent = `HP ${Math.ceil(p.hp)} / ${l.hp}`;
    $("mp-fill").style.width = pct(p.mp, l.mp) + "%";
    $("mp-text").textContent = `MP ${Math.floor(p.mp)} / ${l.mp}`;
    $("xp-fill").style.width = p.level === LEVEL_CAP ? "100%" : pct(p.xp, xpNext(p.level)) + "%";
    $("xp-text").textContent = p.level === LEVEL_CAP ? "EXP MAX" : `EXP ${p.xp} / ${xpNext(p.level)}`;
    const district = s.map.isTown ? TOWN.services.find((n) => dist(s, n) < 7) : null;
    $("zone").textContent = (s.map.isTown ? "เมือง \xB7 " : "เขตต่อสู้ \xB7 ") + (district?.district || s.map.name);
    $("map-index").textContent = s.map.isTown ? "เมืองปลอดภัย" : String(s.map.index + 1).padStart(2, "0") + " / 10";
    $("quest-name").textContent = s.map.isTown ? "เตรียมตัวก่อนออกผจญภัย" : f.boss ? "แสงแห่งดินแดนกลับคืน" : s.map.subtitle;
    $("objective").textContent = s.map.isTown ? "คุย NPC \xB7 ออกประตูเหนือไปด่าน 1" : f.boss ? "รับรางวัลที่ลูนา \xB7 เดินทางต่อได้" : "ปลุกศิลา " + f.shrines.length + "/3 \xB7 ปราบมอนสเตอร์ " + f.kills;
    $("hp-potion").querySelector("em").textContent = p.potions.hp;
    $("mp-potion").querySelector("em").textContent = p.potions.mp;
    for (const [i, id] of loadout(p).entries()) {
      const sk=SKILLS[id];
      const el = $("skill-" + i), cd = s.hero.cooldowns[sk.id] || 0, locked = p.level < sk.level;
      el.classList.toggle("locked", locked);
      el.classList.toggle("no-mana",p.mp<sk.mp);
      el.querySelector(".cd").style.clipPath = `inset(${locked ? 0 : 100 - pct(cd, sk.cd)}% 0 0)`;
      el.querySelector(".cd").textContent = locked ? "Lv" + sk.level : cd > 0.1 ? cd.toFixed(1) : "";
    }
    const hidden=skillPage?[2,3]:[4,5];$("skill-switch").querySelector("em").textContent=hidden.map(i=>{const d=SKILLS[loadout(p)[i]];return p.level<d.level?"🔒":Math.ceil(s.hero.cooldowns[d.id]||0)||"✓";}).join(" / ");
    const dc = s.hero.cooldowns.dash || 0;
    $("dash").querySelector(".cd").style.clipPath = `inset(${100 - pct(dc, 1.3)}% 0 0)`;
    const target2 = contextual();
    $("interact").hidden = !target2 || mode !== "play";
    $("interact").textContent = target2 ? "E \xB7 " + target2 : "";
    const boss = s.enemies.find((e) => e.boss);
    $("boss-hud").hidden = !(mode === "play" && boss && !boss.dead && dist(boss, s) < 6);
    if (boss) {
      $("boss-name").textContent = s.map.bossName;
      $("boss-fill").style.width = pct(boss.hp, boss.maxHp) + "%";
    }
    $("status-effects").textContent = s.hero.shield > 0 ? `✦ เกราะ ${Math.ceil(s.hero.shield)} \xB7 ${Math.ceil(s.hero.shieldTime)}s` : "";
    $("loot-log").innerHTML = logs.map((l2) => `<div style="border-color:${l2.color}">${escape(l2.message)}</div>`).join("");
    renderer.minimap($("mini"), s);
  }
  function events() {
    for (const e of s.events) {
      if(e.type==='release')playSkillSound(audio,p.options,SKILLS[e.id],'release');
      if(e.type==='skillhit'){playSkillSound(audio,p.options,SKILLS[e.id],'hit');if(e.ultimate&&p.options.shake!==false)renderer.shake=3;}

      if (e.type === "travel") {
        renderer.center(s);
        resetInput();
        persist();
        notify("เข้าสู่เขตต่อสู้ \xB7 " + s.map.name);
      }
      if (e.type === "cast") {
        tone(e.classId === "mage" ? 540 : e.classId === "archer" ? 430 : 230, 0.1, e.classId === "sword" ? "sawtooth" : "triangle", 0.45);
      }
      if (e.type === "hurt") {
        renderer.shake = p.options.shake===false?0:2;
        tone(110, 0.13, "triangle", 0.7);
      }
      if (e.type === "loot") {
        logs.unshift({ message: e.message, time: 4, color: RARITIES[e.rarity]?.color || "#d5bd84" });
        if (logs.length > 3) logs.pop();
        tone(760, 0.08, "sine", 0.4);
        persist();
      }
      if (e.type === "level") {
        notify("LEVEL UP \xB7 Lv" + p.level);
        tone(880, 0.3, "sine", 0.8);
        persist();
      }
      if (e.type === "shrine") {
        notify(s.notice);
        tone(660, 0.25, "sine", 0.8);
        persist();
      }
      if (e.type === "boss") {
        notify(s.map.bossName + " ล้มแล้ว \xB7 เก็บอุปกรณ์บนพื้น");
        persist();
      }
      if (e.type === "death") {
        persist();
        setTimeout(() => {
          if (p.hp <= 0 && mode === "play") deathPanel();
        }, 1100);
      }
      if (e.type === "ending") {
        persist();
        setTimeout(() => {
          if (mode === "play" && !endingShown) showEnding();
        }, 2200);
      }
    }
    s.events = [];
  }
  let ambientStep = 0;
  function frame(now) {
    let dt = Math.min(0.04, (now - last) / 1e3);
    last = now;
    frames++;
    if(orientationBlocked){renderer.draw(s,0);requestAnimationFrame(frame);return;}
    if(reviewFrozen){renderer.draw(s,0);requestAnimationFrame(frame);return;}
    if (mode === "play") {
      let sx = stick.x + (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0), sy = stick.y + (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) - (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0), dx = (sx + sy * 2) / 2, dy = (sy * 2 - sx) / 2;
      if (Math.hypot(sx, sy) > 0.1) {
        waypoints = [];
        autoTarget = null;
      }
      if (autoTarget !== null && Math.hypot(sx, sy) < 0.1) {
        const foe = s.enemies.find((e) => e.id === autoTarget && !e.dead);
        if (!foe) autoTarget = null;
        else if (dist(foe, s) <= CLASS[p.classId].range * 0.9) {
          cast(s);
          waypoints = [];
        } else if (s.time > routeAt) {
          waypoints = findPath(s, foe.x, foe.y);
          routeAt = s.time + 0.7;
        }
      }
      if (waypoints.length && Math.hypot(sx, sy) < 0.1) {
        const n = waypoints[0], d = dist(n, s);
        if (d < 0.16) waypoints.shift();
        else {
          dx = (n.x - s.x) / d;
          dy = (n.y - s.y) / d;
        }
      }
      if (heldAttack || keys.has("KeyJ")) cast(s);
      const actualDt = s.hitstop > 0 ? (s.hitstop = Math.max(0, s.hitstop - dt), dt * 0.14) : dt;
      tick(s, actualDt, dx, dy);
      events();
      saveTimer += dt;
      if (saveTimer > 5) {
        persist();
        saveTimer = 0;
      }
      ambientStep += dt;
      if (Math.hypot(dx, dy) > 0.1 && ambientStep > 0.24) {
        tone(105, 0.035, "triangle", 0.08);
        ambientStep = 0;
      }
    } else if (mode === "dead") s.hero.anim = Math.min(2, s.hero.anim + dt);
    syncMusic();
    renderer.draw(s, dt);
    hudTimer += dt;
    if (hudTimer > 0.1) {
      hud();
      hudTimer = 0;
    }
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) $("toast").classList.remove("show");
    }
    for (const l of logs) l.time -= dt;
    for (let i = logs.length - 1; i >= 0; i--) if (logs[i].time <= 0) logs.splice(i, 1);
    requestAnimationFrame(frame);
  }
  renderActions();
  classPortrait($("portrait"), p.classId);
  renderer.center(s);
  $("loading").hidden = true;
  title();
  syncOrientation();
  requestAnimationFrame(frame);
  if ("serviceWorker" in navigator && !globalThis.EMBER_ART && location.protocol !== "file:") {
    navigator.serviceWorker.addEventListener("message", (e) => {
      if (e.data?.type === "OFFLINE_READY") {
        ready = e.data.ready;
        $("offline-state").textContent = ready ? "● พร้อมเล่นออฟไลน์" : "ไฟล์ยังไม่ครบ \xB7 เชื่อมต่อเพื่อดาวน์โหลด";
      }
    });
    navigator.serviceWorker.register("sw.js").then(() => navigator.serviceWorker.ready).then((r) => r.active?.postMessage("VERIFY_OFFLINE")).catch(() => $("offline-state").textContent = "ยังไม่พร้อมออฟไลน์ \xB7 ต้องใช้ HTTPS");
    navigator.serviceWorker.addEventListener("controllerchange", () => navigator.serviceWorker.controller?.postMessage("VERIFY_OFFLINE"));
  } else $("offline-state").textContent = "ตัวอย่างไฟล์เดียว \xB7 ติดตั้ง iPhone ต้องเปิดผ่าน HTTPS";
  if (new URLSearchParams(location.search).has("debug")) globalThis.__emberV2 = { state: () => structuredClone({ mode, orientationBlocked, p, music: music?.snapshot() || null, s: { map: s.map.id, mapInfo: { isTown: !!s.map.isTown, width: s.map.width, height: s.map.height, stage: s.map.index }, x: s.x, y: s.y, time: s.time, hero: s.hero, enemies: s.enemies, npcs: s.npcs, drops: s.drops, projectiles: s.projectiles, hazards: s.hazards, effects: s.effects, world: s.world.props }, frames, ready, waypoints }), start: (data) => start(validate(data)), action, cast: (id,aim) => cast(s, id,aim), freeze:(value)=>{reviewFrozen=!!value;},step:(dt)=>{tick(s,dt);events();hud();renderer.draw(s,0);}, renderer:()=>renderer, dash: () => dash(s), interact: interactAction, persist, resume: close, teleport: (x, y) => {
    if (!s.world.block(x, y)) {
      s.x = x;
      s.y = y;
      waypoints = [];
      autoTarget = null;
      renderer.center(s);
      return true;
    }
    return false;
  }, block: (x, y) => s.world.block(x, y), path: (x, y) => findPath(s, x, y), screenshot: () => renderer.draw(s, 0) };
}
boot().catch((e) => {
  console.error(e);
  $("loading").hidden = false;
  $("loading-text").textContent = "เปิดเกมไม่สำเร็จ \xB7 " + e.message;
});
