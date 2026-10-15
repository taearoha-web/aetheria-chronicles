import {beginSkill,updateSkills,skillPoint,availableTargets,loadout} from './combat.js';
import {LEVEL_CAP,defaultLoadout} from './skill-data.js';
import { townBoundaryBlocked, atTownGate, fencePanels } from "./town.js";
import { CLASS, SKILLS, maps, mapById, xpNext, equipmentName, RARITIES, TOWN } from "./data.js";
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const iso = (x, y) => ({ x: (x - y) * 20, y: (x + y) * 10 });
const rand = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const direction = (x, y) => (Math.round(Math.atan2(y, x) / (Math.PI / 4)) + 8) % 8;
const SAVE = "emberfall-adventure-v2";
const OLD_SAVE = "emberfall-save-v1";
const state = (a, next) => {
  if (a.state !== next) {
    a.state = next;
    a.anim = 0;
  }
};
function fresh(classId = "sword", name = "นักเดินทาง") {
  if (!CLASS[classId]) throw Error("ไม่พบอาชีพ");
  const p = { schema: 3,
    loadout: CLASS[classId].skills.slice(0,6).map(s=>s.id), townLayout: TOWN.layout, name: String(name).slice(0, 20) || "นักเดินทาง", classId, level: 1, xp: 0, gold: 80, materials: 0, potions: { hp: 8, mp: 5 }, stats: { strength: 5, agility: 5, spirit: 5, vitality: 5 }, statPoints: 0, map: "town", x: TOWN.spawn.x, y: TOWN.spawn.y, hp: 1, mp: 1, inventory: [], stash: [], equipment: { weapon: null, armor: null, ring: null }, fields: {}, nextItem: 1, ground: {}, cooldowns: {}, options: { sound: true, music: 0.15, sfx: 0.3 }, deaths: 0 };
  const weapon = item(p, "weapon", 0, "common");
  p.inventory.push(weapon);
  p.equipment.weapon = weapon.id;
  const l = limits(p);
  p.hp = l.hp;
  p.mp = l.mp;
  return p;
}
function item(p, slot, tier, rarity = "common") {
  return { id: p.nextItem++, slot, classId: slot === "weapon" ? p.classId : "all", tier: clamp(tier, 0, 9), rarity, upgrade: 0, name: equipmentName(slot, p.classId, clamp(tier, 0, 9)), locked: false };
}
function itemPower(i) {
  const m = RARITIES[i.rarity]?.mult || 1;
  return i.slot === "weapon" ? { attack: Math.round((7 + i.tier * 24 + i.upgrade * 3) * m) } : i.slot === "armor" ? { defense: Math.round((3 + i.tier * 8 + i.upgrade * 1.2) * m), hp: Math.round((8 + i.tier * 26) * m) } : { attack: Math.round((2 + i.tier * 6 + i.upgrade) * m), mp: Math.round((10 + i.tier * 4) * m) };
}
function worn(p, slot) {
  return p.inventory.find((i) => i.id === p.equipment[slot]);
}
function limits(p) {
  const c = CLASS[p.classId], gear = Object.values(p.equipment).map((id) => p.inventory.find((i) => i.id === id)).filter(Boolean).map(itemPower);
  return { hp: Math.round(c.hp + (p.level - 1) * 12 + (p.stats.vitality - 5) * 7 + gear.reduce((n, i) => n + (i.hp || 0), 0)), mp: Math.round(c.mp + (p.level - 1) * 6 + (p.stats.spirit - 5) * 5 + gear.reduce((n, i) => n + (i.mp || 0), 0)), attack: Math.round(c.attack + p.level * 2 + (p.stats[c.id === "mage" ? "spirit" : c.id === "archer" ? "agility" : "strength"] - 5) * 1.5 + gear.reduce((n, i) => n + (i.attack || 0), 0)), defense: c.defense + gear.reduce((n, i) => n + (i.defense || 0), 0) };
}
function equip(p, id) {
  const i = p.inventory.find((i2) => i2.id === id);
  if (!i) return "ไม่พบอุปกรณ์";
  if (i.classId !== "all" && i.classId !== p.classId) return "คนละอาชีพ";
  p.equipment[i.slot] = i.id;
  const l = limits(p);
  p.hp = Math.min(p.hp, l.hp);
  p.mp = Math.min(p.mp, l.mp);
  return null;
}
function stat(p, key) {
  if (!Object.hasOwn(p.stats, key) || p.statPoints < 1) return "ไม่มีแต้ม";
  p.stats[key]++;
  p.statPoints--;
  return null;
}
function upgrade(p, id) {
  const i = p.inventory.find((i2) => i2.id === id);
  if (!i) return "ไม่พบไอเทม";
  if (i.upgrade >= 5) return "สูงสุด +5";
  const price = 30 * (i.upgrade + 1) * (1 + i.tier), mat = i.upgrade + 1;
  if (p.gold < price || p.materials < mat) return `ต้องมี ${price} เหรียญ / ${mat} วัสดุ`;
  p.gold -= price;
  p.materials -= mat;
  i.upgrade++;
  return null;
}
function salvage(p, id) {
  const i = p.inventory.find((i2) => i2.id === id);
  if (!i || i.locked || Object.values(p.equipment).includes(id)) return "ไอเทมล็อกหรือกำลังสวม";
  p.inventory = p.inventory.filter((i2) => i2.id !== id);
  p.materials += 1 + i.tier;
  return null;
}
function store(p, id) {
  const i = p.inventory.find((i2) => i2.id === id);
  if (!i || Object.values(p.equipment).includes(id) || p.stash.length >= 80) return "กำลังสวมหรือคลังเต็ม";
  p.inventory = p.inventory.filter((i2) => i2.id !== id);
  p.stash.push(i);
  return null;
}
function withdraw(p, id) {
  const i = p.stash.find((i2) => i2.id === id);
  if (!i || p.inventory.length >= 50) return "กระเป๋าเต็ม";
  p.stash = p.stash.filter((i2) => i2.id !== id);
  p.inventory.push(i);
  return null;
}
function addItem(p, i) {
  (p.inventory.length < 50 ? p.inventory : p.stash).push(i);
}
function validate(p) {
  if(p?.schema===2){p.schema=3;p.loadout=defaultLoadout(p);}
  if (!p || ![2,3].includes(p.schema) || !CLASS[p.classId] || !mapById[p.map] || typeof p.name !== "string") throw Error("รูปแบบเซฟไม่ถูกต้อง");
  if (p.townLayout !== TOWN.layout) {
    if (p.map === "dawn" || p.map === "town") {
      p.map = "town";
      p.x = TOWN.spawn.x;
      p.y = TOWN.spawn.y;
    }
    if (p.ground?.dawn) {
      const drops = p.ground.dawn;
      for (const [i, d] of drops.entries()) {
        d.x = TOWN.spawn.x + (i % 3 - 1) * 0.3;
        d.y = TOWN.spawn.y + 0.4 + Math.floor(i / 3) * 0.03;
      }
      p.ground.town = [...p.ground.town || [], ...drops];
      delete p.ground.dawn;
    }
    p.townLayout = TOWN.layout;
  }
  if (!["level", "xp", "gold", "materials", "statPoints", "nextItem", "deaths"].every((k) => Number.isInteger(p[k]) && p[k] >= 0) || p.level < 1 || p.level > LEVEL_CAP || p.nextItem < 1 || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 1 || p.y < 1 || p.x > mapById[p.map].width - 1 || p.y > mapById[p.map].height - 1) throw Error("เลเวลหรือตำแหน่งไม่ถูกต้อง");
  if (!p.stats || !["strength", "agility", "spirit", "vitality"].every((k) => Number.isInteger(p.stats[k]) && p.stats[k] >= 5) || Object.values(p.stats).reduce((a, b) => a + b, 0) + p.statPoints > 20 + (p.level - 1) * 3) throw Error("แต้มสเตตัสไม่ถูกต้อง");
  if (!p.potions || !["hp", "mp"].every((k) => Number.isInteger(p.potions[k]) && p.potions[k] >= 0) || !Array.isArray(p.inventory) || p.inventory.length > 50 || !Array.isArray(p.stash) || p.stash.length > 600) throw Error("ไอเทมไม่ถูกต้อง");
  const ids = /* @__PURE__ */ new Set();
  for (const i of [...p.inventory, ...p.stash]) {
    if (!i || !Number.isInteger(i.id) || i.id < 1 || ids.has(i.id) || !["weapon", "armor", "ring"].includes(i.slot) || !["all", p.classId].includes(i.classId) || !Number.isInteger(i.tier) || i.tier < 0 || i.tier > 9 || !RARITIES[i.rarity] || !Number.isInteger(i.upgrade) || i.upgrade < 0 || i.upgrade > 5) throw Error("ข้อมูลอุปกรณ์ไม่ถูกต้อง");
    ids.add(i.id);
    i.name = equipmentName(i.slot, p.classId, i.tier);
    i.locked = !!i.locked;
  }
  if (!p.equipment || !["weapon", "armor", "ring"].every((slot) => p.equipment[slot] === null || p.inventory.some((i) => i.id === p.equipment[slot] && i.slot === slot)) || p.equipment.weapon === null) throw Error("ช่องอุปกรณ์ไม่ถูกต้อง");
  p.nextItem = Math.max(p.nextItem, 1, ...ids) + 1;
  if (!p.fields || typeof p.fields !== "object") throw Error("ข้อมูลแมพไม่ถูกต้อง");
  for (const [id, f] of Object.entries(p.fields)) {
    if (!mapById[id] || !f || !Array.isArray(f.shrines) || f.shrines.some((i) => !Number.isInteger(i) || i < 0 || i > 2) || new Set(f.shrines).size !== f.shrines.length || typeof f.boss !== "boolean" || typeof f.chest !== "boolean" || typeof f.questClaimed !== "boolean" || !Number.isInteger(f.kills) || f.kills < 0) throw Error("ข้อมูลภารกิจไม่ถูกต้อง");
  }
  for (let i = 1; i <= mapById[p.map].index; i++) if (!p.fields[maps[i - 1].id]?.boss) throw Error("ยังไม่ผ่านแมพก่อนหน้า");
  const l = limits(p);
  if (!Number.isFinite(p.hp) || p.hp < 0 || p.hp > l.hp || !Number.isFinite(p.mp) || p.mp < 0 || p.mp > l.mp) throw Error("HP/MPไม่ถูกต้อง");
  p.ground ??= {};
  for (const [mapId, drops] of Object.entries(p.ground)) {
    if (!mapById[mapId] || !Array.isArray(drops) || drops.length > 250 || drops.some((d) => !d || !["gold", "material", "equipment", "hp"].includes(d.kind) || !Number.isInteger(d.id) || !Number.isFinite(d.x) || !Number.isFinite(d.y) || !Number.isFinite(d.age) || !Number.isFinite(d.count) || d.count < 1 || d.kind === "equipment" && (!d.item || !["weapon", "armor", "ring"].includes(d.item.slot) || !RARITIES[d.item.rarity] || d.item.classId !== "all" && d.item.classId !== p.classId || !Number.isInteger(d.item.tier) || d.item.tier < 0 || d.item.tier > 9 || ids.has(d.item.id)))) throw Error("ของบนพื้นไม่ถูกต้อง");
    for (const d of drops) if (d.item) {
      p.nextItem = Math.max(p.nextItem, d.item.id + 1);
      d.item.name = equipmentName(d.item.slot, p.classId, d.item.tier);
    }
  }
  p.cooldowns ??= {};
  p.loadout??=defaultLoadout(p);
  if(!Array.isArray(p.loadout)||p.loadout.length!==6||new Set(p.loadout).size!==6||p.loadout.some((id,i)=>!SKILLS[id]||SKILLS[id].classId!==p.classId||SKILLS[id].ultimate&&i!==5))throw Error("ชุดสกิลไม่ถูกต้อง");
  p.options = { sound: !!p.options?.sound, music: clamp(Number(p.options?.music) || 0, 0, 1), sfx: clamp(Number(p.options?.sfx) || 0.3, 0, 1),quality:["full","balanced","lite"].includes(p.options?.quality)?p.options.quality:"full",shake:p.options?.shake!==false };
  return p;
}
function migrate(old) {
  if (!old || old.schema !== 1 || !Number.isFinite(old.level)) throw Error("เซฟเดิมไม่ถูกต้อง");
  const p = fresh();
  p.level = clamp(Math.floor(old.level), 1, 20);
  p.statPoints = (p.level - 1) * 3;
  p.gold = Math.max(0, Math.floor(old.gold || 0));
  p.potions.hp = clamp(Math.floor(old.potions || 5), 0, 999);
  const l = limits(p);
  p.hp = l.hp;
  p.mp = l.mp;
  p.name = "นักเดินทาง";
  return p;
}
function field(p, id = p.map) {
  return p.fields[id] ??= { shrines: [], boss: false, chest: false, questClaimed: false, kills: 0 };
}
function segmentDistance(x, y, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, t = clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(x - a.x - t * dx, y - a.y - t * dy);
}
function onPath(m, x, y) {
  if (segmentDistance(x, y, m.exit, m.spawn) < 1.2) return true;
  if (m.isTown) {
    if (dist({ x, y }, TOWN.plaza) < 8.5 || TOWN.services.some((n) => dist({ x, y }, n) < 4.5)) return true;
    for (const road of TOWN.streets) for (let i = 1; i < road.length; i++) if (segmentDistance(x, y, road[i - 1], road[i]) < 1.8) return true;
  }
  const nodes = [m.spawn, ...m.shrines, m.arena];
  for (let i = 1; i < nodes.length; i++) if (segmentDistance(x, y, nodes[i - 1], nodes[i]) < 1.1) return true;
  return segmentDistance(x, y, m.spawn, m.chest) < 0.8;
}
function water(m, x, y) {
  if (m.biome === "coast") return y > 25 - Math.sin(x * 0.35) * 2;
  if (m.biome === "forest") return Math.abs(x - 13 - Math.sin(y * 0.25) * 2) < 0.9 && y < 19;
  if (m.biome === "desert") return Math.hypot(x - 14, y - 10) < 2.8;
  if (m.biome === "marsh") return Math.sin(x * 0.55) + Math.cos(y * 0.5) > 1;
  if (m.biome === "snow") return Math.abs(x - 16 - Math.sin(y * 0.3) * 2) < 1;
  if (m.biome === "lava") return Math.abs(x - 14 - Math.sin(y * 0.3) * 2) < 1.3 || y < 5 && x < 21;
  if (m.biome === "sky") {
    const nodes = [m.spawn, ...m.shrines, m.arena];
    return !nodes.some((n) => Math.hypot(n.x - x, n.y - y) < 3.8) && !onPath(m, x, y);
  }
  return false;
}
function makeWorld(m) {
  const props = [], add = (kind, x, y, radius = 0, scale = 1) => props.push({ id: props.length, kind, x, y, radius, scale });
  if (m.isTown) {
    add("fountain", TOWN.plaza.x, TOWN.plaza.y, 2.2, 1.05);
    for (const n of TOWN.services) {
      add(n.building, n.x - 3, n.y - 3, n.building === "arch" ? 0.6 : 2.1, n.building === "arch" ? 1.05 : 1);
      add("sign", n.x + 2, n.y + 2, 0.15, 0.9);
      props.at(-1).label = n.district;
      props.at(-1).icon = n.icon;
      props.at(-1).color = n.color;
      add("lamp", n.x - 2, n.y + 2, 0.15, 1);
      add("bench", n.x + 3, n.y - 2, 0.35, 1);
    }
    for (const [x, y] of [[27, 42], [40, 27], [47, 41], [34, 49]]) add("pink", x, y, 0.4, 0.65);
    for (const [x, y] of [[29, 43], [40, 29], [45, 42], [35, 47]]) add("bench", x, y, 0.35, 1);
    for (const [x, y] of [[30, 42], [40, 30], [44, 43], [34, 46]]) add("lamp", x, y, 0.15, 1);
    for (const panel of fencePanels()) props.push({ ...panel, id: props.length });
    add("town-gate", TOWN.gate.x, TOWN.gate.y, 0, 1);
  }
  if (m.biome === "crypt" || m.biome === "castle") for (let i = 0; i < 6; i++) add("arch", 7 + i * 4, 10 + i % 2 * 6, 0.5, 0.7);
  if (m.biome === "sky") for (const [x, y] of [[8, 9], [20, 19], [28, 11]]) add("temple", x, y, 1.1, 0.7);
  if (!m.isTown) add("arch", m.arena.x, m.arena.y + 2, 0.5, 1);
  for (let i = 0; i < (m.isTown ? 170 : 85); i++) {
    const x = 2 + rand(i * 3 + m.index * 67) * (m.width - 4), y = 2 + rand(i * 3 + 10 + m.index * 91) * (m.height - 5);
    if (onPath(m, x, y) || water(m, x, y) || dist({ x, y }, m.spawn) < 4 || dist({ x, y }, m.arena) < 3 || m.shrines.some((n) => dist(n, { x, y }) < 2.6) || m.spawns.some((n) => dist(n, { x, y }) < 2) || props.some((p) => dist(p, { x, y }) < 2.7) || m.isTown && (dist({ x, y }, TOWN.plaza) < 12 || TOWN.services.some((n) => dist({ x, y }, n) < 7))) continue;
    add(i % 5 === 0 ? m.decor : m.tree, x, y, 0.4, 0.6 + rand(i + 52) * 0.3);
  }
  return { props, block: (x, y) => x < 1 || x > m.width - 1 || y < 2 || y > m.height - 1 || m.isTown && townBoundaryBlocked(x, y) || water(m, x, y) && !onPath(m, x, y) && m.biome !== "snow" || props.some((p) => p.radius && Math.hypot(x - p.x, y - p.y) < p.radius + 0.18) };
}
function session(p) {
  const s = { p, map: mapById[p.map], world: null, x: p.x, y: p.y, dir: 2, time: 0, hero: { state: "idle", anim: 0, inv: 0, attack: 0, dash: 0, dashX: 0, dashY: 0, strike: null, cooldowns: {}, shield: 0, shieldTime: 0 }, enemies: [], npcs: [], projectiles: [], effects: [], particles: [], texts: [], drops: [], hazards: [], events: [], nextId: 1, notice: "", ended: false, hitstop: 0 };
  setup(s);
  if (p.cooldowns) {
    for (const [id, v] of Object.entries(p.cooldowns)) if ((id === "dash" || SKILLS[id]?.classId === p.classId) && Number.isFinite(v)) s.hero.cooldowns[id] = clamp(v, 0, id==="dash"?1.3:SKILLS[id].cd);
  }
  return s;
}
function setup(s) {
  const m = s.map, c = s.p;
  s.world = makeWorld(m);
  s.enemies = [];
  s.npcs = [];
  s.projectiles = [];
  s.effects = [];
  s.hazards = [];
  s.drops = [];
  s.hero.strike = null;
  s.hero.attack = 0;
  s.hero.dash = 0;
  s.hero.shield = 0;
  s.hero.cooldowns ??= {};
  s.hero.buffs={};s.skillJobs=[];s.skillImpacts=[];
  if (m.isTown) s.npcs = TOWN.services.map((n, i) => ({ ...n, home: { x: n.x, y: n.y }, state: "work", anim: i * 0.3, workTime: i * 0.31, greeting: 0, dir: 2, timer: 2 + i }));
  if (!m.isTown) {
    m.spawns.forEach((n, k) => {
      for (let i = 0; i < 2; i++) {
        const kind = m.mobs[(k + i) % 2];
        s.enemies.push(enemy(s, kind, n.x + (i ? -0.9 : 0.2), n.y + (i ? 0.4 : 0), false, k * 2 + i));
      }
    });
    s.enemies.push(enemy(s, m.boss, m.arena.x, m.arena.y, true, 99));
    if (field(c).boss) {
      const boss = s.enemies.at(-1);
      boss.hp = 0;
      boss.dead = true;
      boss.anim = 3;
      boss.state = "death";
    }
  }
  s.drops = structuredClone(c.ground?.[m.id] || []);
  s.nextId = Math.max(s.nextId, 1, ...s.drops.map((d) => d.id + 1));
  if (s.world.block(s.x, s.y)) {
    s.x = m.spawn.x;
    s.y = m.spawn.y;
  }
  c.x = s.x;
  c.y = s.y;
}
function enemy(s, kind, x, y, boss, id) {
  const clear = (x2, y2) => !s.world.block(x2, y2) && !s.world.block(x2 + 0.18, y2) && !s.world.block(x2 - 0.18, y2) && !s.world.block(x2, y2 + 0.18) && !s.world.block(x2, y2 - 0.18);
  if (!clear(x, y)) {
    let found = false;
    for (let r = 0.25; r < 4 && !found; r += 0.25) for (let j = 0; j < 20; j++) {
      const a = j / 20 * Math.PI * 2, nx = x + Math.cos(a) * r, ny = y + Math.sin(a) * r;
      if (clear(nx, ny)) {
        x = nx;
        y = ny;
        found = true;
        break;
      }
    }
    if (!found) {
      x = s.map.spawn.x;
      y = s.map.spawn.y;
    }
  }
  const i = s.map.index;
  const hp = boss ? 200 + i * 140 + i*i*48 : 40 + i * 38 + i*i*8 + (kind === "wolf" ? 10 : kind === "golem" ? 30 : 0);
  return { id: s.nextId++, kind, x, y, home: { x, y }, hp, maxHp: hp, boss, dead: false, state: "idle", anim: id * 0.1, phase: "wander", timer: 1 + id * 0.13, aim: { x, y }, facing: 0, hit: 0, respawn: 0, pattern: 0, phaseTier: 0, slow: 0, root: 0, spawnId: id };
}
function canTravel(p, id) {
  const m = mapById[id];
  if (!m) return "ไม่พบแผนที่";
  return m.index > 0 && !p.fields[maps[m.index - 1].id]?.boss ? "ผ่านบอสแมพก่อนหน้าก่อน" : null;
}
function travel(s, id) {
  const error = canTravel(s.p, id);
  if (error) return error;
  s.p.ground ??= {};
  s.p.ground[s.map.id] = structuredClone(s.drops);
  s.p.cooldowns = {...s.hero.cooldowns};
  const m = mapById[id];
  s.map = m;
  s.p.map = id;
  s.x = m.spawn.x;
  s.y = m.spawn.y;
  s.p.x = s.x;
  s.p.y = s.y;
  setup(s);
  const l = limits(s.p);
  s.p.hp = l.hp;
  s.p.mp = l.mp;
  s.notice = "เข้าสู่ " + m.name;
  return null;
}
function move(s, a, dx, dy) {
  if (!s.world.block(a.x + dx, a.y)) a.x += dx;
  if (!s.world.block(a.x, a.y + dy)) a.y += dy;
}
function effect(s, kind, x = s.x, y = s.y, extra = {}) {
  s.effects.push({ id: s.nextId++, kind, x, y, age: 0, ...extra });
  if (s.effects.length > 100) s.effects.shift();
}
function text(s, value, x = s.x, y = s.y, color = "#ffe6a5") {
  s.texts.push({ id: s.nextId++, value: String(value), x, y, age: 0, color });
  if (s.texts.length > 50) s.texts.shift();
}
function event(s, type, extra = {}) {
  s.events.push({ type, ...extra });
  if (s.events.length > 30) s.events.shift();
}
function target(s, range) {
  return s.enemies.filter((e) => !e.dead && (!e.boss || field(s.p).shrines.length === 3) && dist(e, s) <= range).sort((a, b) => dist(a, s) - dist(b, s))[0];
}
function safe(s) {
  return !!s.map.isTown;
}
function cast(s, id = "basic", aim = null) {
  const p = s.p, h = s.hero, c = CLASS[p.classId], d = id === "basic" ? null : SKILLS[id];
  if (p.hp <= 0 || h.strike || h.attack > 0 || h.dash > 0) return "กำลังเคลื่อนไหว";
  if (d && d.classId !== p.classId) return "คนละอาชีพ";
  if (id !== "basic" && !d) return "ไม่พบสกิล";
  if (d && p.level < d.level) return `ต้องการ Lv${d.level}`;
  if (d && h.cooldowns[id] > 0) return "รอคูลดาวน์";
  if (d && p.mp < d.mp) return "มานาไม่พอ";
  const range = d?.range || c.range, t = target(s, range);
  if (!t && !d) {
    s.notice = "ไม่มีเป้าหมายในระยะ";
    return s.notice;
  }
  if (aim || t) {
    const q = iso((aim||t).x - s.x, (aim||t).y - s.y);
    s.dir = direction(q.x, q.y);
  }
  if (d) {
    p.mp -= d.mp;
    h.cooldowns[id] = d.cd;
  }
  const duration = d?.cast || c.rate;
  h.attack = duration;
  h.strike = { id, skill: d, time: 0, duration, release: d?.release || (p.classId === "archer" ? 0.42 : p.classId === "mage" ? 0.4 : 0.3), done: false, target: t?.id,
    point: d?skillPoint(s,d,aim,t):null, dir: s.dir };
  h.state = d ? "cast" : "attack";
  h.anim = 0;
  event(s, "cast", { classId: p.classId, id });
  return null;
}
function dash(s, x = 0, y = 0) {
  const h = s.hero;
  if (s.p.hp <= 0 || h.dash > 0 || (h.cooldowns.dash || 0) > 0) return "รอหลบ";
  if (!x && !y) {
    const a = s.dir * Math.PI / 4;
    x = (Math.cos(a) + 2 * Math.sin(a)) / 2;
    y = (2 * Math.sin(a) - Math.cos(a)) / 2;
  }
  const n = Math.hypot(x, y) || 1;
  h.dashX = x / n;
  h.dashY = y / n;
  h.dash = 0.24;
  h.inv = 0.36;
  h.cooldowns.dash = 1.3;
  h.strike = null;
  h.attack = 0.24;
  h.state = "dodge";
  h.anim = 0;
  effect(s, "dash", s.x, s.y, { color: "#c9e6da" });
  event(s, "dash");
  return null;
}
function potion(s, type = "hp") {
  const p = s.p, l = limits(p);
  if (!["hp", "mp"].includes(type) || p.hp <= 0) return "ใช้ไม่ได้";
  if (p.potions[type] < 1) return "ยาหมด";
  if (p[type] >= l[type]) return "เต็มแล้ว";
  p.potions[type]--;
  const value = Math.round(l[type] * 0.5);
  p[type] = Math.min(l[type], p[type] + value);
  text(s, "+" + value, s.x, s.y, type === "hp" ? "#adf2b6" : "#a2e7fa");
  effect(s, "heal", s.x, s.y, { color: type === "hp" ? "#a7f2b5" : "#a8ddff" });
  return null;
}
function gainXP(s, n) {
  const p = s.p;
  p.xp += Math.round(n);
  while (p.level < LEVEL_CAP && p.xp >= xpNext(p.level)) {
    p.xp -= xpNext(p.level);
    p.level++;
    p.statPoints += 3;
    const l = limits(p);
    p.hp = l.hp;
    p.mp = l.mp;
    effect(s, "level");
    text(s, "LEVEL UP!", s.x, s.y, "#fff3c4");
    event(s, "level", { level: p.level });
  }
  if (p.level === LEVEL_CAP) p.xp = 0;
}
function hurtHero(s, amount, source) {
  const h = s.hero, p = s.p;
  if (p.hp <= 0 || h.inv > 0) return false;
  h.combat=6;
  if(h.buffs?.counter){delete h.buffs.counter;if(source&&!source.dead)damage(s,source,limits(p).attack*SKILLS.riposte.power,"gold");effect(s,"skill",s.x,s.y,{skillId:"riposte",life:1});return false;}
  if(h.buffs?.fortress)amount*=.5;
  if(h.buffs?.mirage)amount*=.6;
  amount = Math.max(1, Math.round(amount - limits(p).defense * 0.65));
  if (h.shield > 0) {
    const blocked = Math.min(h.shield, amount);
    h.shield -= blocked;
    amount -= blocked;
    effect(s, "shield");
  }
  p.hp = Math.max(0, p.hp - amount);
  h.inv = 0.65;
  state(h, p.hp > 0 ? "hit" : "death");
  h.anim = 0;
  h.strike = null;
  h.attack = 0.2;
  effect(s, "hurt");
  text(s, "−" + amount, s.x, s.y, "#ffb1a0");
  event(s, "hurt", { amount });
  if (p.hp === 0) {
    s.skillJobs=[];s.skillImpacts=[];h.buffs={};h.manaChannel=null;
    p.deaths++;
    h.shield = 0;
    event(s, "death");
  }
  return true;
}
function facingVector(dir) {
  const a = dir * Math.PI / 4, x = (Math.cos(a) + 2 * Math.sin(a)) / 2, y = (2 * Math.sin(a) - Math.cos(a)) / 2, n = Math.hypot(x, y);
  return { x: x / n, y: y / n };
}
function damage(s, e, n, element = "silver") {
  if (e.dead || e.boss && field(s.p).shrines.length < 3) return;
  const crit = rand(s.nextId + s.p.stats.agility) > 0.88;
  n = Math.round(n * (crit ? 1.4 : 1));
  e.hp = Math.max(0, e.hp - n);
  e.hit = 0.18;
  if (!e.boss) {
    e.phase = "stagger";
    e.timer = 0.22;
    state(e, "hit");
  }
  effect(s, "impact", e.x, e.y, { element, crit });
  text(s, (crit ? "✦ " : "") + n, e.x, e.y, crit ? "#fff0ac" : "#fff3cf");
  s.hitstop = 0.025;
  if (e.hp <= 0) die(s, e);
}
function die(s, e) {
  e.dead = true;
  e.phase = "dead";
  e.respawn = 35;
  e.state = "death";
  e.anim = 0;
  const p = s.p, i = s.map.index, f = field(p);
  f.kills++;
  gainXP(s, xpNext(s.map.level+4)*(e.boss?1.8:.16));
  drop(s, e);
  event(s, "kill", { kind: e.kind, boss: e.boss });
  if (e.boss && !f.boss) {
    f.boss = true;
    gainXP(s, xpNext(p.level) * 0.65);
    p.gold += 35 + i * 15;
    event(s, "boss", { map: s.map.id });
    if (i === 9) {
      s.ended = true;
      event(s, "ending");
    }
  }
}
function drop(s, e) {
  const p = s.p, i = s.map.index;
  const put = (kind, count, dx = 0, itemData = null) => s.drops.push({ id: s.nextId++, kind, count, x: e.x + dx, y: e.y + 0.18, age: 0, item: itemData });
  put("gold", e.boss ? 50 + i * 15 : 8 + i * 4, -0.3);
  put("material", e.boss ? 4 + i : 1, 0.2);
  if (e.boss || rand(s.nextId + i) > 0.78) {
    const slot = e.boss ? "weapon" : rand(s.nextId + 29) > 0.5 ? "armor" : "ring", rarity = e.boss ? i >= 5 ? "epic" : "rare" : rand(s.nextId + 11) > 0.8 ? "rare" : "common";
    put("equipment", 1, 0.45, item(p, slot, i, rarity));
    if (e.boss) put("equipment", 1, -0.55, item(p, i % 2 ? "ring" : "armor", i, "rare"));
  }
  if (!e.boss && rand(s.nextId + 77) > 0.7) put("hp", 1, 0.6);
}
function pickup(s) {
  const p = s.p;
  for (const d of [...s.drops]) {
    if (d.age < 0.6 || dist(d, s) > 0.9) continue;
    if (d.kind === "equipment") {
      addItem(p, d.item);
      event(s, "loot", { message: d.item.name, rarity: d.item.rarity });
    } else if (d.kind === "gold") {
      p.gold += d.count;
      event(s, "loot", { message: "ทอง +" + d.count });
    } else if (d.kind === "material") {
      p.materials += d.count;
      event(s, "loot", { message: "วัสดุ +" + d.count });
    } else {
      p.potions.hp += d.count;
      event(s, "loot", { message: "ยา HP +" + d.count });
    }
    effect(s, "pickup", d.x, d.y, { element: d.item?.rarity === "epic" ? "arcane" : "gold" });
    s.drops = s.drops.filter((x) => x.id !== d.id);
    p.ground??={};p.ground[s.map.id]=structuredClone(s.drops);
  }
}
function launch(s, targetId, amount, element = "silver", extra = {}) {
  const e = s.enemies.find((e2) => e2.id === targetId);
  if (!e) return;
  s.projectiles.push({ id: s.nextId++, x: s.x, y: s.y, fromX: s.x, fromY: s.y, target: targetId, amount, element, speed: 12, age: 0, ...extra });
}
function release(s,a){
 if(a.skill){beginSkill(s,a,{limits,effect,event,damage,move});return;}
 const p=s.p,base=limits(p).attack*(s.hero.buffs?.power?1.25:1)*(s.hero.buffs?.spirit?1.3:1)*(s.hero.buffs?.elements?1.3:1),element=p.classId==='mage'?'arcane':p.classId==='archer'?'nature':'silver',vec=facingVector(a.dir);
 if(p.classId==='sword'){effect(s,'slash',s.x,s.y,{dir:a.dir,element});for(const t of availableTargets(s))if(dist(t,s)<2&&dot(s,t,vec)>.1)damage(s,t,base,element);}else launch(s,a.target,base,element);
}

function dot(s, t, v) {
  const n = dist(s, t) || 1;
  return ((t.x - s.x) * v.x + (t.y - s.y) * v.y) / n;
}
function interact(s) {
  const p = s.p, m = s.map, f = field(p);
  for (let i = 0; i < m.shrines.length; i++) if (dist(s, m.shrines[i]) < 1.35) {
    if (!f.shrines.includes(i)) {
      f.shrines.push(i);
      effect(s, "shrine", m.shrines[i].x, m.shrines[i].y, { element: "holy" });
      gainXP(s, 20 + m.index * 15);
      s.notice = f.shrines.length === 3 ? "ผนึกบอสเปิดแล้ว" : "ปลุกศิลา " + f.shrines.length + "/3";
      event(s, "shrine", { index: i });
    }
    return "shrine";
  }
  if (dist(s, m.chest) < 1.3 && !f.chest) {
    f.chest = true;
    p.gold += 30 + m.index * 15;
    p.materials += 2;
    const a = item(p, "ring", m.index, "rare");
    addItem(p, a);
    event(s, "loot", { message: a.name, rarity: a.rarity });
    return "chest";
  }
  if (m.isTown && dist(s, TOWN.gate) < 2.3) return "field-gate";
  if (dist(s, m.spawn) < 1.5) {
    const l = limits(p);
    p.hp = l.hp;
    p.mp = l.mp;
    effect(s, "heal");
    s.notice = "พักฟื้นและบันทึกแล้ว";
    return "rest";
  }
  if (dist(s, m.exit) < 1.4) return m.isTown ? "portal" : "town-return";
  const npc = s.npcs.find((n) => dist(n, s) < 2.8);
  if (npc) {
    npc.greeting = 1.2;
    return npc.id;
  }
  ;
  return null;
}
function claimQuest(s, id) {
  const f = s.p.fields[id], m = mapById[id];
  if (!f?.boss || f.questClaimed) return "ยังไม่มีรางวัล";
  f.questClaimed = true;
  s.p.gold += 80 + m.index * 35;
  s.p.materials += 5 + m.index;
  gainXP(s, xpNext(m.level+4)*2);
  return null;
}
function revive(s) {
  s.p.ground??={};s.p.ground[s.map.id]=structuredClone(s.drops);
  s.p.gold = Math.max(0, s.p.gold - Math.ceil(s.p.gold * 0.05));
  const l = limits(s.p);
  s.p.hp = l.hp;
  s.p.mp = l.mp;
  s.x = s.map.spawn.x;
  s.y = s.map.spawn.y;
  setup(s);
  s.hero.inv = 2;
  s.hero.state = "idle";
  s.hero.anim = 0;
  s.notice = "กลับมาพร้อมออกเดินทาง";
}
function tick(s, dt, dx = 0, dy = 0) {
  dt = clamp(dt, 0, 0.05);
  s.time += dt;
  const p = s.p, h = s.hero, m = s.map, l = limits(p);
  h.anim += dt;
  for (const fx of s.effects) fx.age += dt;
  s.effects = s.effects.filter((e) => e.age < (e.life||1.1));
  for (const t of s.texts) t.age += dt;
  s.texts = s.texts.filter((t) => t.age < 1);
  for (const d of s.drops) d.age += dt;
  if (p.hp <= 0) {
    for (const e of s.enemies) e.anim += dt;
    return;
  }
  h.attack = Math.max(0, h.attack - dt);
  h.inv = Math.max(0, h.inv - dt);
  h.shieldTime = Math.max(0, h.shieldTime - dt);
  if (h.shieldTime <= 0) h.shield = 0;
  for (const id in h.cooldowns) h.cooldowns[id] = Math.max(0, h.cooldowns[id] - dt);
  p.mp = Math.min(l.mp, p.mp + dt * (2.7 + p.level * 0.08));
  const n = Math.max(1, Math.hypot(dx, dy));
  dx /= n;
  dy /= n;
  if (h.dash > 0) {
    h.dash = Math.max(0, h.dash - dt);
    move(s, s, h.dashX * dt * 11, h.dashY * dt * 11);
  } else if (!h.strike && Math.hypot(dx, dy) > 0.05) {
    move(s, s, dx * dt * (h.buffs?.fortress?2.3:3.7), dy * dt * (h.buffs?.fortress?2.3:3.7));
    const q = iso(dx, dy);
    s.dir = direction(q.x, q.y);
    state(h, "run");
  } else if (!h.strike && (h.state !== "hit" || h.anim > 0.25)) state(h, "idle");
  if (h.strike) {
    const a = h.strike;
    a.time += dt;
    if (!a.done && a.time >= a.release) {
      a.done = true;
      release(s, a);
    }
    if (a.time >= a.duration) {
      h.strike = null;
      state(h, "idle");
    }
  }
  for (const q of [...s.projectiles]) {
    if (q.delay > 0) {
      q.delay -= dt;
      continue;
    }
    q.age += dt;
    const e = s.enemies.find((e2) => e2.id === q.target && !e2.dead);
    if (!e || q.age > 2) {
      s.projectiles = s.projectiles.filter((x) => x !== q);
      continue;
    }
    const d = dist(q, e);
    if (d < dt * q.speed + 0.25) {
      if (q.radius) {
        effect(s, "blast", e.x, e.y, { element: q.element, radius: q.radius });
        for (const other of s.enemies) if (!other.dead && dist(e, other) < q.radius) damage(s, other, q.amount, q.element);
      } else damage(s, e, q.amount, q.element);
      s.projectiles = s.projectiles.filter((x) => x !== q);
    } else {
      q.x += (e.x - q.x) / d * dt * q.speed;
      q.y += (e.y - q.y) / d * dt * q.speed;
    }
  }
  updateSkills(s,dt,{limits,effect,event,damage,move});
  for (const e of s.enemies) {
    e.anim += dt*(e.timeSlow>0?.55:1);
    e.timeSlow=Math.max(0,(e.timeSlow||0)-dt);
    e.hit = Math.max(0, e.hit - dt);
    e.timer -= dt*(e.timeSlow>0?.55:1);
    e.slow = Math.max(0, e.slow - dt);
    e.root = Math.max(0, e.root - dt);
    if (e.dead) {
      e.respawn -= dt;
      if (!e.boss && e.respawn <= 0 && dist(e, s) > 7) {
        e.hp = e.maxHp;
        e.dead = false;
        e.x = e.home.x;
        e.y = e.home.y;
        e.phase = "wander";
        e.state = "idle";
        e.anim = 0;
      }
      continue;
    }
    if (e.boss && field(p).shrines.length < 3) continue;
    if (safe(s)) continue;
    const d = dist(e, s), caster = ["lich", "imp", "ghost", "wisp", "elemental"].includes(e.kind), reach = caster ? 5 : e.boss ? 1.8 : 1.2;
    if (e.phase === "windup") {
      if (e.timer <= 0) {
        e.phase = "strike";
        e.state = "attack";
        e.anim = 0;
        e.struck = false;
        e.timer = 0.65;
      }
      continue;
    }
    if (e.phase === "strike") {
      if (!e.struck && e.anim >= 0.24) {
        e.struck = true;
        const phase = e.boss && e.hp < e.maxHp * 0.5 ? 1 : 0;
        let hit = dist(s, e.aim) < (e.boss ? 1.5 : caster ? 1.1 : 0.95) && d < (caster ? 7 : e.boss ? 2.5 : 1.9);
        if (hit) hurtHero(s, 8 + m.index * 12 + (e.boss ? 9 : 0), e);
        effect(s, caster ? "enemy-orb" : e.boss ? "enemy-wave" : "enemy-slash", e.aim.x, e.aim.y, { fromX: e.x, fromY: e.y, element: "fire", radius: e.boss ? 1.5 : 1 });
        if (e.boss && e.pattern % 3 === 0) {
          for (const side of [-1, 1]) s.hazards.push({ id: s.nextId++, friendly: false, kind: "warning", x: e.aim.x + side * (2 + phase), y: e.aim.y, radius: 1.2, time: 1.2, tick: 0.85, damage: 16 + m.index * 14, element: m.biome === "snow" ? "ice" : "fire" });
        }
        if (["wolf", "icewolf", "spider", "dragon"].includes(e.kind)) {
          const nd = dist(e, e.aim) || 1;
          move(s, e, (e.aim.x - e.x) / nd * 0.5, (e.aim.y - e.y) / nd * 0.5);
        }
      }
      if (e.timer <= 0) {
        e.phase = "recover";
        e.timer = e.boss ? 0.7 : 0.6;
      }
      continue;
    }
    if (["recover", "stagger"].includes(e.phase)) {
      if (e.timer <= 0) e.phase = "wander";
      continue;
    }
    if (e.root > 0) {
      state(e, "idle");
      continue;
    }
    if (d < reach) {
      e.phase = "windup";
      e.pattern++;
      e.timer = e.boss ? 0.9 : caster ? 0.7 : 0.6;
      e.aim = { x: s.x, y: s.y };
      const q = iso(s.x - e.x, s.y - e.y);
      e.facing = direction(q.x, q.y);
      state(e, "cast");
    } else if (d < (e.boss ? 7 : 5.7) && dist(e, e.home) < 8) {
      e.phase = "chase";
      const q = iso(s.x - e.x, s.y - e.y);
      e.facing = direction(q.x, q.y);
      const speed = (e.kind.includes("wolf") ? 2.5 : 1.6) * (e.slow > 0 ? 0.45 : 1);
      move(s, e, (s.x - e.x) / d * dt * speed, (s.y - e.y) / d * dt * speed);
      state(e, "run");
    } else {
      e.phase = "wander";
      if (e.timer <= 0) {
        e.wander = { x: e.home.x + (rand(e.id + Math.floor(s.time)) * 2 - 1), y: e.home.y + (rand(e.id + Math.floor(s.time) + 5) * 2 - 1) };
        e.timer = 3 + rand(e.id + s.time) * 3;
      }
      if (e.wander && dist(e, e.wander) > 0.12) {
        const dd = dist(e, e.wander), vx = (e.wander.x - e.x) / dd, vy = (e.wander.y - e.y) / dd;
        move(s, e, vx * dt * 0.4, vy * dt * 0.4);
        const q = iso(vx, vy);
        e.facing = direction(q.x, q.y);
        state(e, "walk");
      } else state(e, "idle");
    }
  }
  for (const z of s.hazards) {
    z.time -= dt;
    z.tick -= dt;
    if (z.tick <= 0) {
      z.tick = 1;
      if (z.friendly) {
        for (const e of s.enemies) if (!e.dead && dist(z, e) < z.radius) {
          damage(s, e, z.damage, z.element);
          e.slow = 1.5;
        }
      } else if (dist(s, z) < z.radius) hurtHero(s, z.damage);
    }
  }
  s.hazards = s.hazards.filter((z) => z.time > 0);
  for (const n2 of s.npcs) {
    n2.anim += dt;
    n2.workTime += dt;
    n2.greeting = Math.max(0, n2.greeting - dt);
    n2.state = n2.greeting > 0 ? "greet" : "work";
    if (dist(n2, s) < 4.5) {
      const q = iso(s.x - n2.x, s.y - n2.y);
      n2.dir = direction(q.x, q.y);
    }
  }
  pickup(s);
  p.x = s.x;
  p.y = s.y;
  if (m.isTown && atTownGate(s.x, s.y)) {
    travel(s, "dawn");
    event(s, "travel", { map: "dawn" });
  }
}
export {
  OLD_SAVE,
  SAVE,
  addItem,
  canTravel,
  cast,
  claimQuest,
  clamp,
  dash,
  direction,
  dist,
  effect,
  equip,
  event,
  field,
  fresh,
  gainXP,
  hurtHero,
  interact,
  iso,
  item,
  itemPower,
  limits,
  makeWorld,
  migrate,
  move,
  onPath,
  pickup,
  potion,
  rand,
  revive,
  safe,
  salvage,
  session,
  setup,
  stat,
  store,
  target,
  text,
  tick,
  travel,
  upgrade,
  validate,
  water,
  withdraw,
  worn
};
