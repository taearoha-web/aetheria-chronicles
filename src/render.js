import {drawSkillGround,drawSkillEffect,drawSkillActor} from './skill-vfx.js';
import { CLASS, ELEMENTS, RARITIES, monsterNames, TOWN } from "./data.js";
import { iso, rand, onPath, water, field, dist, limits, worn } from "./sim.js";
import { drawCharacter, drawMonster, drawProp, drawNPC, npcFrame } from "./art.js";
class Renderer {
  constructor(canvas, images) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.images = images;
    this.cam = { x: 0, y: 0 };
    this.map = null;
    this.terrain = null;
    this.ambient = 0;
    this.width = 640;
    this.height = 360;
    this.shake = 0;
    this.resize();
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.ratio = rect.width > rect.height && rect.height <= 430 ? (rect.height <= 350 ? 1.25 : 1.5) : rect.width > 1600 ? 2.5 : rect.width < 500 ? 1.65 : 2;
    this.width = Math.ceil(rect.width / this.ratio);
    this.height = Math.ceil(rect.height / this.ratio);
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx.imageSmoothingEnabled = false;
  }
  screen(x, y) {
    const p = iso(x, y);
    return { x: Math.round(p.x - this.cam.x + this.width / 2), y: Math.round(p.y - this.cam.y + this.height * 0.56) };
  }
  world(x, y) {
    const xx = x - this.width / 2 + this.cam.x, yy = y - this.height * 0.56 + this.cam.y;
    return { x: (xx / 20 + yy / 10) / 2, y: (yy / 10 - xx / 20) / 2 };
  }
  center(s) {
    const p = iso(s.x, s.y);
    this.cam = { ...p };
  }
  tile(c, x, y, color, w = 20, h = 10) {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(x, y - h);
    c.lineTo(x + w, y);
    c.lineTo(x, y + h);
    c.lineTo(x - w, y);
    c.closePath();
    c.fill();
  }
  buildTerrain(m) {
    const c = document.createElement("canvas");
    c.width = (m.width + m.height + 4) * 20 + 120;
    c.height = (m.width + m.height + 4) * 10 + 160;
    const t = c.getContext("2d");
    t.imageSmoothingEnabled = false;
    const offset = { x: (m.height + 1) * 20 + 60, y: 60 }, watery = [];
    const wetColor = (x, y) => m.biome === "lava" ? "#d66a42" : m.biome === "sky" ? "#b6d6e4" : m.biome === "snow" ? "#abd3dc" : m.biome === "marsh" ? "#568f7d" : m.biome === "forest" ? "#589d93" : y - (25 - Math.sin(x * 0.35) * 2) < 0.8 ? "#9ac8bf" : "#56a9af";
    for (let y = 0; y < m.height + 2; y++) for (let x = 0; x < m.width + 2; x++) {
      const p = iso(x, y), xx = Math.round(p.x + offset.x), yy = Math.round(p.y + offset.y), seed = x * 73 + y * 191 + m.index * 1911, wet = water(m, x, y), road = onPath(m, x, y), town = m.isTown && road && y >= 17;
      let color = wet ? wetColor(x, y) : m.floor[1];
      if (road) color = wet ? "#b4a17c" : m.path;
      if (town) color = "#babba9";
      this.tile(t, xx, yy, color);
      if (town || road && !wet) {
        t.save();
        t.beginPath();
        t.moveTo(xx, yy - 10);
        t.lineTo(xx + 20, yy);
        t.lineTo(xx, yy + 10);
        t.lineTo(xx - 20, yy);
        t.closePath();
        t.clip();
        for (let j = -1; j < 3; j++) for (let i = -1; i < 3; i++) {
          const rx = xx + i * 14 + j % 2 * 6 - 12, ry = yy + j * 6 - 8, r = rand(seed + i * 7 + j * 13);
          t.fillStyle = r > 0.65 ? "#d0cdb7" : r > 0.3 ? "#b4b5a3" : "#a7ad9e";
          t.fillRect(rx, ry, 12, 5);
          t.fillStyle = "#929b90";
          t.fillRect(rx, ry + 5, 13, 1);
          t.fillStyle = "#ded8bd";
          t.fillRect(rx + 1, ry, 9, 1);
          if (r > 0.8) {
            t.fillStyle = "#8f9a82";
            t.fillRect(rx + 7, ry + 4, 3, 1);
          }
        }
        t.restore();
      } else if (!wet) {
        for (let i = 0; i < 12; i++) {
          const px = Math.round(xx + (rand(seed + i) * 2 - 1) * 15), py = Math.round(yy + (rand(seed + i + 50) * 2 - 1) * 5);
          t.fillStyle = m.biome === "snow" ? "#f5f4e3" : m.biome === "desert" || m.biome === "coast" ? "#f2dca764" : m.biome === "crypt" || m.biome === "castle" ? "#9593a066" : m.biome === "lava" ? "#be876b66" : i % 3 === 0 ? "#bdc78488" : "#82a36288";
          t.fillRect(px, py, 1 + i % 2, 1);
          if (i === 1 && rand(seed) > 0.7) {
            t.fillStyle = m.biome === "town" ? "#e8b8c7" : "#d8c998";
            t.fillRect(px, py - 2, 2, 2);
          }
        }
        if (["town", "forest", "marsh"].includes(m.biome) && rand(seed) > 0.4) {
          t.fillStyle = "#56774888";
          t.fillRect(xx - 2, yy - 2, 5, 2);
          t.fillStyle = "#a5b97688";
          t.fillRect(xx - 1, yy - 4, 2, 3);
          t.fillRect(xx + 2, yy - 3, 2, 2);
        }
      }
      if (!road && !town) {
        const edge = [[-0.49, -0.49], [0.49, -0.49], [-0.49, 0.49], [0.49, 0.49]].some(([dx, dy]) => water(m, x + dx, y + dy) !== wet);
        if (edge || wet) {
          for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
            const sx = x + (i + 0.5) / 4 - 0.5, sy = y + (j + 0.5) / 4 - 0.5, sub = iso(sx, sy), sw = water(m, sx, sy);
            this.tile(t, sub.x + offset.x, sub.y + offset.y, sw ? wetColor(sx, sy) : m.floor[1], 5.1, 2.6);
            if (sw && m.biome === "coast" && sy - (25 - Math.sin(sx * 0.35) * 2) < 0.28) {
              t.fillStyle = "#f6e9c5";
              t.fillRect(Math.round(sub.x + offset.x - 2), Math.round(sub.y + offset.y), 4, 1);
            }
            if (sw && rand(seed + i + j * 8) > 0.72) {
              t.strokeStyle = m.biome === "lava" ? "#f6b77888" : "#d9efe16b";
              t.lineWidth = 1;
              t.beginPath();
              t.moveTo(sub.x + offset.x - 3, sub.y + offset.y);
              t.lineTo(sub.x + offset.x, sub.y + offset.y + 1);
              t.lineTo(sub.x + offset.x + 3, sub.y + offset.y);
              t.stroke();
            }
          }
        }
      }
      if (wet && !road) watery.push({ x, y });
    }
    this.terrain = { canvas: c, offset, watery };
    this.map = m.id;
  }
  shadow(p, r = 10, a = 0.22) {
    const c = this.ctx;
    c.fillStyle = `rgba(26,44,50,${a})`;
    c.beginPath();
    c.ellipse(p.x, p.y + 1, r, r * 0.4, 0, 0, Math.PI * 2);
    c.fill();
  }
  label(text, x, y, color = "#f1e1b9", background = true, font = 8) {
    const c = this.ctx;
    c.font = `${font}px system-ui`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    if (background) {
      const w = c.measureText(text).width;
      c.fillStyle = "#16252bd8";
      c.fillRect(Math.round(x - w / 2 - 4), Math.round(y - 6), Math.ceil(w + 8), 13);
    }
    c.fillStyle = "#14252c";
    c.fillText(text, x + 1, y + 1);
    c.fillStyle = color;
    c.fillText(text, x, y);
  }
  glow(x, y, r, color, alpha = 0.25) {
    const c = this.ctx;
    c.save();
    c.globalAlpha = alpha;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, color + "00");
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
    c.restore();
  }
  draw(s, dt = 0) {
    const c = this.ctx, W = this.width, H = this.height;
    this.ambient += dt;
    if (this.map !== s.map.id) this.buildTerrain(s.map);
    const t = this.ambient, p = iso(s.x, s.y), blend = 1 - Math.exp(-dt * 9);
    this.cam.x += (p.x - this.cam.x) * blend;
    this.cam.y += (p.y - this.cam.y) * blend;
    this.shake = Math.max(0, this.shake - dt * 10);
    c.save();
    if (this.shake) c.translate(Math.round(Math.sin(t * 61) * this.shake), Math.round(Math.cos(t * 49) * this.shake));
    c.fillStyle = s.map.biome === "sky" ? "#accfdc" : s.map.floor[0];
    c.fillRect(0, 0, W, H);
    c.drawImage(this.terrain.canvas, Math.round(W / 2 - this.cam.x - this.terrain.offset.x), Math.round(H * 0.56 - this.cam.y - this.terrain.offset.y));
    for (const q of this.terrain.watery) {
      const v = this.screen(q.x, q.y);
      if (v.x < 0 || v.x > W || v.y < 0 || v.y > H) continue;
      c.fillStyle = s.map.biome === "lava" ? "#ffd795a0" : s.map.biome === "sky" ? "#e9f1e388" : "#cde9db99";
      const w = (Math.floor(t * 4 + q.x) + q.y) % 12;
      c.fillRect(v.x - 10 + w, v.y + Math.floor(Math.sin(t * 2 + q.y)), 5, 1);
      if (water(s.map, q.x, q.y) && onPath(s.map, q.x, q.y)) {
        c.strokeStyle = "#7d705b";
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(v.x - 12, v.y - 4);
        c.lineTo(v.x + 12, v.y + 4);
        c.stroke();
      }
    }
    const f = field(s.p);
    for (const [i, q] of s.map.shrines.entries()) {
      const v = this.screen(q.x, q.y);
      this.shadow(v, 13);
      const active = f.shrines.includes(i);
      c.save();
      c.globalAlpha = active ? 1 : 0.7;
      drawProp(c, this.images, { kind: "crystal", scale: 0.55 }, v.x, v.y);
      c.restore();
      this.glow(v.x, v.y - 22, 20, active ? "#9de8d2" : "#f0bf8a", 0.17);
      if (dist(q, s) < 3) this.label(active ? "\u2726 \u0E41\u0E2A\u0E07\u0E01\u0E25\u0E31\u0E1A\u0E04\u0E37\u0E19" : "\u25C7 \u0E1B\u0E25\u0E38\u0E01\u0E28\u0E34\u0E25\u0E32", v.x, v.y - 53, active ? "#bef4d7" : "#f5d39f");
    }
    const rest = this.screen(s.map.spawn.x, s.map.spawn.y);
    this.rune(rest.x, rest.y, 16, "#c4ecd9", t);
    if (dist(s, s.map.spawn) < 2) this.label("\u0E1E\u0E31\u0E01\u0E1F\u0E37\u0E49\u0E19", rest.x, rest.y - 12, "#e8edcb");
    const portal = this.screen(s.map.exit.x, s.map.exit.y);
    this.rune(portal.x, portal.y, 14, "#ccb9f7", -t);
    c.save();
    c.strokeStyle = "#ceb5ef";
    c.globalAlpha = 0.55;
    c.beginPath();
    c.ellipse(portal.x, portal.y - 23, 12, 24, 0, 0, Math.PI * 2);
    c.stroke();
    c.restore();
    this.label(s.map.isTown ? "\u0E28\u0E34\u0E25\u0E32\u0E17\u0E32\u0E07\u0E40\u0E14\u0E34\u0E19\u0E17\u0E32\u0E07" : "\u0E01\u0E25\u0E31\u0E1A\u0E19\u0E04\u0E23\u0E41\u0E2A\u0E07\u0E2D\u0E23\u0E38\u0E13", portal.x, portal.y - 54, "#dfcdf7");
    const chest = this.screen(s.map.chest.x, s.map.chest.y);
    if (!f.chest) {
      c.fillStyle = "#604834";
      c.fillRect(chest.x - 7, chest.y - 10, 14, 10);
      c.fillStyle = "#c6a263";
      c.fillRect(chest.x - 7, chest.y - 10, 14, 3);
      c.fillRect(chest.x - 1, chest.y - 7, 2, 5);
      if (dist(s, s.map.chest) < 3) this.label("\u0E2B\u0E35\u0E1A\u0E2A\u0E21\u0E1A\u0E31\u0E15\u0E34", chest.x, chest.y - 20, "#f0d198");
    }
    drawSkillGround(this,s);
    const entities = s.world.props.map((q) => ({ depth: iso(q.x, q.y).y, draw: () => {
      const v = this.screen(q.x, q.y);
      if (v.x < -160 || v.x > W + 160 || v.y < -10 || v.y > H + 180) return;
      this.shadow(v, 18, 0.14);
      const hp = this.screen(s.x, s.y), occludes = v.y > hp.y + 7 && Math.abs(v.x - hp.x) < (q.kind === "green" || q.kind === "pink" ? 42 : 50) * (q.scale || 1) && hp.y > v.y - 120 * (q.scale || 1);
      if (q.kind === "fence") {
        this.woodFence(this.screen(q.from.x, q.from.y), this.screen(q.to.x, q.to.y));
      } else if (q.kind === "town-gate") {
        this.townGate(s, t);
      } else if (q.kind === "sign") {
        c.fillStyle = "#66543d";
        c.fillRect(v.x - 1, v.y - 20, 2, 20);
        c.fillStyle = "#937956";
        c.fillRect(v.x - 13, v.y - 26, 26, 10);
        c.fillStyle = "#d4bb85";
        c.fillRect(v.x - 12, v.y - 25, 24, 1);
        c.font = "8px system-ui";
        c.textAlign = "center";
        c.fillText(q.icon || "\u25C7", v.x, v.y - 18);
        this.label(q.label, v.x, v.y + 10, q.color || "#ead9b2", true, 8);
      } else if (q.kind === "hedge") {
        c.fillStyle = "#425e41";
        c.fillRect(v.x - 18, v.y - 13, 36, 13);
        c.fillStyle = "#73925b";
        c.fillRect(v.x - 17, v.y - 15, 34, 7);
        for (let j = 0; j < 6; j++) {
          c.fillStyle = j % 2 ? "#95a76c" : "#526e46";
          c.fillRect(v.x - 15 + j * 5, v.y - 14 + j % 3, 4, 3);
        }
      } else if (q.kind === "bench") {
        c.fillStyle = "#554e3f";
        c.fillRect(v.x - 14, v.y - 4, 2, 7);
        c.fillRect(v.x + 10, v.y - 1, 2, 7);
        c.fillStyle = "#9f7851";
        c.fillRect(v.x - 16, v.y - 10, 30, 3);
        c.fillRect(v.x - 15, v.y - 6, 29, 3);
        c.fillStyle = "#c1a47a";
        c.fillRect(v.x - 15, v.y - 10, 28, 1);
      } else if (q.kind === "lamp") {
        c.strokeStyle = "#8d7957";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(v.x, v.y);
        c.lineTo(v.x, v.y - 44);
        c.stroke();
        c.fillStyle = "#d9bb7c";
        c.fillRect(v.x - 4, v.y - 47, 8, 2);
        c.fillStyle = "#efcf88";
        c.fillRect(v.x - 3, v.y - 44, 6, 8);
        this.glow(v.x, v.y - 40, 18, "#ffe1a0", 0.25 + 0.04 * Math.sin(t * 4));
      } else drawProp(c, this.images, q, v.x, v.y, occludes ? 0.28 : 1);
      if (q.kind === "fountain") {
        this.glow(v.x, v.y - 28, 38, "#9de0d6", 0.12);
        for (let j = 0; j < 5; j++) {
          c.fillStyle = "#d5f5e9";
          c.fillRect(v.x - 7 + j * 4, v.y - 40 + (t * 13 + j * 7) % 28, 1, 2);
        }
      }
    } }));
    for (const n of s.npcs) entities.push({ depth: iso(n.x, n.y).y, draw: () => {
      const v = this.screen(n.x, n.y);
      this.shadow(v, 10);
      const phase = drawNPC(c, this.images, n, v.x, v.y);
      if (n.artId === "healer" && phase >= 2 && phase <= 4) this.glow(v.x, v.y - 35, 20, "#f3d18a", 0.16);
      if (n.artId === "blacksmith" && phase === 4) {
        for (let j = 0; j < 4; j++) {
          c.fillStyle = j % 2 ? "#ffe8a1" : "#eeb471";
          c.fillRect(v.x + 8 + j * 3, v.y - 23 - j * 4, 1, 2);
        }
      }
      if (n.greeting > 0) this.label("\u2026", v.x + 24, v.y - 64, "#fff0c2", true, 8);
      if (dist(n, s) < 3) this.label(n.name, v.x, v.y - 70, n.id === "portal" ? "#d7c5ef" : "#f0d59d");
      if (dist(n, s) > 1.5) {
        c.fillStyle = "#edcd83";
        c.font = "11px Georgia";
        c.textAlign = "center";
        c.fillText(n.id === "guide" ? "!" : n.id === "merchant" ? "\u25C8" : n.id === "smith" ? "\u2692" : n.id === "portal" ? "\u2727" : "\u2726", v.x, v.y - 73);
      }
    } });
    for (const e of s.enemies) {
      if (e.dead && e.anim > 1.3) continue;
      entities.push({ depth: iso(e.x, e.y).y, draw: () => {
        const v = this.screen(e.x, e.y);
        if (v.x < -90 || v.x > W + 90 || v.y < -10 || v.y > H + 100) return;
        this.shadow(v, e.boss ? 23 : 12);
        drawMonster(c, this.images, e, v.x, v.y);
        if (!e.dead && (e.hp < e.maxHp || dist(e, s) < 3 || e.boss)) {
          const bw = e.boss ? 50 : 25;
          c.fillStyle = "#24313c";
          c.fillRect(v.x - bw / 2, v.y - (e.boss ? 99 : 58), bw, 3);
          c.fillStyle = e.boss ? "#d68e85" : "#b7d28c";
          c.fillRect(v.x - bw / 2, v.y - (e.boss ? 99 : 58), bw * e.hp / e.maxHp, 2);
          if (e.boss || dist(e, s) < 2.3) this.label(e.boss ? s.map.bossName : monsterNames[e.kind], v.x, v.y - (e.boss ? 110 : 67), e.boss ? "#f0cfa0" : "#e5e8d5", false, 7);
        }
      } });
    }
    entities.push({ depth: p.y, draw: () => {
      const v = this.screen(s.x, s.y);
      this.shadow(v, 11);
      const h = s.hero, action = s.p.hp <= 0 ? "death" : h.state, frame = h.strike ? Math.min(5, Math.floor(h.strike.time / h.strike.duration * 6)) : void 0;
      drawSkillActor(this,s,pose=>{drawCharacter(c, this.images, s.p.classId, action, h.anim, v.x, v.y, s.dir, { frame, size: 78,...pose, alpha: h.inv > 0 && Math.floor(t * 16) % 2 ? 0.55 : 1, glow: h.shield > 0 });});
      const weapon = worn(s.p, "weapon");
      if (weapon && weapon.rarity !== "common") this.glow(v.x + (s.dir > 2 && s.dir < 6 ? -13 : 13), v.y - 24, 10, RARITIES[weapon.rarity].color, 0.22);
      if (h.shield > 0) {
        c.strokeStyle = "#ffe7a199";
        c.beginPath();
        c.ellipse(v.x, v.y - 28, 24, 34, 0, 0, Math.PI * 2);
        c.stroke();
      }
      if (s.p.level > 1) this.label(`${s.p.name}  Lv.${s.p.level}`, v.x, v.y - 78, "#f0dfad", false, 7);
    } });
    for (const d of s.drops) entities.push({ depth: iso(d.x, d.y).y + 1, draw: () => this.drawLoot(s, d, t) });
    entities.sort((a, b) => a.depth - b.depth);
    entities.forEach((q) => q.draw());
    for (const z of s.hazards) {
      const v = this.screen(z.x, z.y), col = ELEMENTS[z.element] || "#e9b795";
      this.rune(v.x, v.y, z.radius * 20, col, t);
      c.save();
      c.globalAlpha = 0.12;
      c.fillStyle = col;
      c.beginPath();
      c.ellipse(v.x, v.y, z.radius * 20, z.radius * 10, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
    for (const e of s.enemies) if (e.phase === "windup" && !e.dead) {
      const v = this.screen(e.aim.x, e.aim.y);
      this.rune(v.x, v.y, e.boss ? 29 : 19, "#f0ae8d", 0);
      const progress = 1 - Math.max(0, e.timer) / (e.boss ? 0.9 : 0.7);
      c.save();
      c.globalAlpha = 0.18;
      c.fillStyle = "#f09c7c";
      c.beginPath();
      c.ellipse(v.x, v.y, Math.max(2, (e.boss ? 28 : 18) * progress), Math.max(1, (e.boss ? 14 : 9) * progress), 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
    for (const q of s.projectiles) {
      if (q.delay > 0) continue;
      const v = this.screen(q.x, q.y), from = this.screen(q.fromX, q.fromY), color = ELEMENTS[q.element] || "#dff8de", a = Math.atan2(v.y - from.y, v.x - from.x);
      c.save();
      c.translate(v.x, v.y - 25);
      c.rotate(a);
      if (s.p.classId === "archer") {
        c.strokeStyle = "#efdeaa";
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(-12, 0);
        c.lineTo(3, 0);
        c.stroke();
        c.fillStyle = color;
        c.beginPath();
        c.moveTo(5, 0);
        c.lineTo(-1, -2);
        c.lineTo(-1, 2);
        c.fill();
      } else {
        this.glow(0, 0, 10, color, 0.4);
        c.fillStyle = color;
        c.beginPath();
        c.arc(0, 0, 3, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
    }
    for (const fx of s.effects) {if(fx.kind==="skill"||fx.kind==="skill-hit")drawSkillEffect(this,s,fx);else this.fx(s,fx);}
    for (const ft of s.texts) {
      const v = this.screen(ft.x, ft.y);
      c.save();
      c.globalAlpha = Math.min(1, (1 - ft.age) * 3);
      this.label(ft.value, v.x, v.y - 42 - ft.age * 21, ft.color, false, 10);
      c.restore();
    }
    const ambience = s.map.biome;
    for (let i = 0; i < 15; i++) {
      const x = (rand(i + 4) * W + t * (i % 2 ? 1 : -1) * 3 + W) % W, y = (rand(i + 77) * H + Math.sin(t * 0.6 + i) * 8 + (ambience === "snow" ? t * 7 : 0)) % H;
      c.fillStyle = ambience === "lava" ? "#f5bf7990" : ambience === "snow" ? "#fff6e7b0" : ambience === "town" ? "#f4c8d299" : "#d1debc80";
      c.fillRect(Math.round(x), Math.round(y), ambience === "snow" ? 2 : 1, ambience === "town" ? 2 : 1);
    }
    const vignette = c.createRadialGradient(W / 2, H * 0.5, H * 0.15, W / 2, H * 0.5, Math.max(W, H) * 0.65);
    vignette.addColorStop(0, "#182b3600");
    vignette.addColorStop(0.8, "#182b3600");
    vignette.addColorStop(1, "#12233677");
    c.fillStyle = vignette;
    c.fillRect(0, 0, W, H);
    c.restore();
  }
  woodFence(a, b, height = 24) {
    const c = this.ctx;
    c.save();
    for (const z of [8, 18]) {
      c.strokeStyle = "#59422e";
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(a.x, a.y - z);
      c.lineTo(b.x, b.y - z);
      c.stroke();
      c.strokeStyle = "#ae8452";
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(a.x, a.y - z - 1);
      c.lineTo(b.x, b.y - z - 1);
      c.stroke();
      c.strokeStyle = "#d7b47b";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(a.x, a.y - z - 2);
      c.lineTo(b.x, b.y - z - 2);
      c.stroke();
    }
    for (const p of [a, b]) {
      c.fillStyle = "#5b432e";
      c.fillRect(Math.round(p.x - 3), Math.round(p.y - height), 6, height + 2);
      c.fillStyle = "#b18a59";
      c.fillRect(Math.round(p.x - 2), Math.round(p.y - height + 2), 3, height - 1);
      c.fillStyle = "#d5b47e";
      c.fillRect(Math.round(p.x - 3), Math.round(p.y - height), 6, 2);
      c.fillStyle = "#4f4234";
      c.fillRect(Math.round(p.x), Math.round(p.y - 17), 1, 1);
      c.fillRect(Math.round(p.x), Math.round(p.y - 8), 1, 1);
    }
    c.restore();
  }
  townGate(s, time) {
    const c = this.ctx, g = TOWN.gate, f = TOWN.fence, open = Math.max(0, Math.min(1, 1 - dist(s, g) / 7)), angle = open * Math.PI / 2;
    const left = { x: g.x - f.gap, y: g.y }, right = { x: g.x + f.gap, y: g.y }, a = this.screen(left.x, left.y), b = this.screen(right.x, right.y);
    this.woodFence(a, this.screen(left.x + f.gap * Math.cos(angle), left.y + f.gap * Math.sin(angle)), 30);
    this.woodFence(this.screen(right.x - f.gap * Math.cos(angle), right.y + f.gap * Math.sin(angle)), b, 30);
    for (const p of [a, b]) {
      c.fillStyle = "#55442f";
      c.fillRect(p.x - 5, p.y - 80, 10, 82);
      c.fillStyle = "#b48d58";
      c.fillRect(p.x - 3, p.y - 77, 5, 78);
      c.fillStyle = "#e2bc7a";
      c.fillRect(p.x - 6, p.y - 82, 12, 5);
      this.glow(p.x, p.y - 57, 15, "#efc982", 0.2);
      c.fillStyle = "#e6bf70";
      c.fillRect(p.x - 8, p.y - 63, 4, 8);
    }
    c.strokeStyle = "#5a452f";
    c.lineWidth = 9;
    c.beginPath();
    c.moveTo(a.x - 7, a.y - 78);
    c.lineTo(b.x + 7, b.y - 78);
    c.stroke();
    c.strokeStyle = "#c49c65";
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(a.x - 7, a.y - 81);
    c.lineTo(b.x + 7, b.y - 81);
    c.stroke();
    const v = this.screen(g.x, g.y);
    this.label("\u0E1B\u0E23\u0E30\u0E15\u0E39\u0E40\u0E2B\u0E19\u0E37\u0E2D \xB7 \u0E14\u0E48\u0E32\u0E19 1", v.x, v.y - 93, "#f3dda9", true, 9);
    if (dist(s, g) < 7) this.label("\u0E40\u0E14\u0E34\u0E19\u0E1C\u0E48\u0E32\u0E19\u0E1B\u0E23\u0E30\u0E15\u0E39\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E2D\u0E2D\u0E01\u0E2A\u0E39\u0E48\u0E40\u0E02\u0E15\u0E15\u0E48\u0E2D\u0E2A\u0E39\u0E49", v.x, v.y + 27, "#f0c394", true, 8);
  }
  rune(x, y, r, color, t) {
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    c.scale(1, 0.5);
    c.strokeStyle = color;
    c.globalAlpha = 0.7;
    c.lineWidth = 1;
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.stroke();
    c.globalAlpha = 0.4;
    c.beginPath();
    c.arc(0, 0, r * 0.78, 0, Math.PI * 2);
    c.stroke();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + t * 0.15;
      c.fillStyle = color;
      c.fillRect(Math.cos(a) * r - 1, Math.sin(a) * r - 1, 2, 2);
    }
    c.restore();
  }
  drawLoot(s, d, t) {
    const c = this.ctx, p = this.screen(d.x, d.y), lift = Math.sin(t * 3 + d.id) * 2, color = d.item ? RARITIES[d.item.rarity].color : d.kind === "gold" ? "#e6c477" : "#c3dfb3";
    this.shadow(p, 6);
    c.save();
    c.globalAlpha = 0.22;
    c.fillStyle = color;
    c.fillRect(p.x - 1, p.y - 28, 2, 27);
    c.restore();
    c.strokeStyle = color;
    c.lineWidth = 2;
    if (d.kind === "equipment") {
      if (d.item.slot === "weapon") {
        c.beginPath();
        if (d.item.classId === "archer") c.arc(p.x, p.y - 8 + lift, 7, -1.2, 1.2);
        else {
          c.moveTo(p.x - 3, p.y - 2 + lift);
          c.lineTo(p.x + 5, p.y - 17 + lift);
        }
        c.stroke();
        if (d.item.classId === "mage") {
          c.fillStyle = color;
          c.fillRect(p.x + 3, p.y - 18 + lift, 4, 4);
        } else if (d.item.classId === "sword") {
          c.beginPath();
          c.moveTo(p.x - 6, p.y - 8 + lift);
          c.lineTo(p.x + 2, p.y - 5 + lift);
          c.stroke();
        }
      } else if (d.item.slot === "armor") {
        c.fillStyle = color;
        c.fillRect(p.x - 4, p.y - 12 + lift, 8, 10);
        c.fillRect(p.x - 7, p.y - 12 + lift, 14, 3);
      } else {
        c.beginPath();
        c.arc(p.x, p.y - 7 + lift, 4, 0, Math.PI * 2);
        c.stroke();
      }
    } else {
      c.fillStyle = color;
      c.fillRect(p.x - 3, p.y - 6 + lift, 6, 4);
      c.fillStyle = "#fff0c2";
      c.fillRect(p.x - 2, p.y - 7 + lift, 3, 1);
    }
    if (dist(d, s) < 4) {
      const name = d.item ? `${d.item.rarity === "epic" ? "\u2726 " : ""}${d.item.name}` : d.kind === "gold" ? `\u0E17\u0E2D\u0E07 \xD7${d.count}` : d.kind === "material" ? `\u0E27\u0E31\u0E2A\u0E14\u0E38 \xD7${d.count}` : "\u0E22\u0E32 HP";
      this.label(name, p.x, p.y - 33 - lift, color, true, 7);
    }
  }
  fx(s, e) {
    const c = this.ctx, p = this.screen(e.x, e.y), t = e.age / 1.1, color = ELEMENTS[e.element] || e.color || "#d9edc1";
    c.save();
    c.globalAlpha = Math.max(0, 1 - t);
    c.translate(p.x, p.y);
    const a = (e.dir || 0) * Math.PI / 4;
    if (["slash", "whirl", "enemy-slash"].includes(e.kind)) {
      c.translate(0, -23);
      c.scale(1, 0.65);
      c.strokeStyle = color;
      c.lineWidth = 2;
      for (let i = 0; i < (e.kind === "whirl" ? 3 : 1); i++) {
        c.beginPath();
        c.arc(0, 0, 22 + t * 20 + i * 4, a - 1.3 + t, a + 1 + t + i * 2);
        c.stroke();
      }
    } else if (e.kind === "beam") {
      c.rotate(a);
      c.strokeStyle = color;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(0, -22);
      c.lineTo((e.radius || 7) * 20, -22);
      c.stroke();
    } else if (e.kind === "chain") {
      const from = this.screen(e.fromX, e.fromY);
      c.strokeStyle = color;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(from.x - p.x, from.y - p.y - 24);
      for (let i = 1; i <= 7; i++) c.lineTo((from.x - p.x) * (1 - i / 7) + Math.sin(i * 3 + t * 5) * 4, (from.y - p.y) * (1 - i / 7) - 24);
      c.stroke();
    } else if (["impact", "hurt", "pickup"].includes(e.kind)) {
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4, r = t * 20;
        c.fillStyle = color;
        c.fillRect(Math.cos(angle) * r, -22 + Math.sin(angle) * r - t * 6, 2, 2);
      }
    } else if (e.kind === "dash") {
      c.strokeStyle = "#c9e8d9";
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.arc(-i * 4, -24, 15 + t * 8, -1, 1);
        c.stroke();
      }
    } else {
      const r = (e.radius || 1.5) * 20 * (0.25 + Math.min(1, t * 3));
      c.scale(1, 0.55);
      c.strokeStyle = color;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(0, 0, r, 0, Math.PI * 2);
      c.stroke();
      for (let i = 0; i < 9; i++) {
        const ang = i / 9 * Math.PI * 2;
        c.fillStyle = color;
        if (e.kind === "frost") {
          c.beginPath();
          c.moveTo(Math.cos(ang) * r, -18 + Math.sin(ang) * r);
          c.lineTo(Math.cos(ang) * r + 3, Math.sin(ang) * r);
          c.lineTo(Math.cos(ang) * r - 3, Math.sin(ang) * r);
          c.closePath();
          c.fill();
        } else c.fillRect(Math.cos(ang) * r, Math.sin(ang) * r - 10, 2, 4);
      }
      if (["level", "shrine", "heal", "aegis"].includes(e.kind)) {
        this.glow(0, -30, 40, color, 0.3);
        c.strokeStyle = color;
        c.beginPath();
        c.moveTo(0, -70);
        c.lineTo(0, 0);
        c.stroke();
      }
    }
    c.restore();
  }
  minimap(canvas, s) {
    const c = canvas.getContext("2d"), w = canvas.width, h = canvas.height;
    c.clearRect(0, 0, w, h);
    c.fillStyle = "#173638";
    c.fillRect(0, 0, w, h);
    const xy = (q) => ({ x: q.x / s.map.width * w, y: q.y / s.map.height * h });
    c.fillStyle = "#b6b39888";
    for (let y = 0; y < s.map.height; y++) for (let x = 0; x < s.map.width; x++) if (onPath(s.map, x, y)) {
      const p2 = xy({ x, y });
      c.fillRect(p2.x, p2.y, Math.ceil(w / s.map.width), Math.ceil(h / s.map.height));
    }
    for (const [i, q] of s.map.shrines.entries()) {
      const p2 = xy(q);
      c.fillStyle = field(s.p).shrines.includes(i) ? "#a3e5bf" : "#e4bd7b";
      c.fillRect(p2.x - 1, p2.y - 1, 3, 3);
    }
    if (s.map.isTown) {
      const f = TOWN.fence;
      c.strokeStyle = "#b99b6c";
      c.lineWidth = w > 200 ? 2 : 1;
      const a = xy({ x: f.left, y: f.top }), b = xy({ x: f.right, y: f.bottom });
      c.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
      const g = xy(TOWN.gate);
      c.fillStyle = "#173638";
      c.fillRect(g.x - f.gap / s.map.width * w, g.y - 3, f.gap * 2 / s.map.width * w, 6);
      const p2 = xy(TOWN.plaza);
      c.strokeStyle = "#86c8c3";
      c.beginPath();
      c.arc(p2.x, p2.y, w > 200 ? 13 : 3, 0, Math.PI * 2);
      c.stroke();
      for (const n of TOWN.services) {
        const q = xy(n);
        c.fillStyle = n.color;
        c.fillRect(q.x - 2, q.y - 2, 5, 5);
        if (w > 200) {
          c.font = "14px system-ui";
          c.textAlign = "center";
          c.fillText(n.district, q.x, q.y + 19);
        }
      }
    }
    if (!s.map.isTown) {
      const bp = xy(s.map.arena);
      c.fillStyle = field(s.p).boss ? "#879c8c" : "#e39491";
      c.fillRect(bp.x - 2, bp.y - 2, 4, 4);
    } else {
      const g = xy(TOWN.gate);
      c.fillStyle = "#efc185";
      c.fillRect(g.x - 3, g.y - 2, 6, 4);
    }
    const p = xy(s);
    c.fillStyle = "#fff3cc";
    c.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
}
export {
  Renderer
};
