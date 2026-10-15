import { npcAtlas } from "./npc-atlas.js";
import { environmentFrames } from "./atlas.js";
const files = {poses_sword:"assets/production/poses-sword.png",poses_archer:"assets/production/poses-archer.png",poses_mage:"assets/production/poses-mage.png",skills_sword:"assets/production/skills-sword.png",skills_archer:"assets/production/skills-archer.png",skills_mage:"assets/production/skills-mage.png", environment: "assets/production/environment.png", sword: "assets/production/sword.png", archer: "assets/production/archer.png", mage: "assets/production/mage.png", monsters: "assets/production/monsters.png", back: "assets/production/back.png", npcs: "assets/production/npcs.png" };
const PROPS = { manor: 0, shop: 1, temple: 2, inn: 3, green: 4, pink: 5, fountain: 6, arch: 7, palm: 8, snow: 9, crystal: 10, volcano: 11 };
const sizes = { manor: [148, 148], shop: [126, 126], temple: [138, 148], inn: [130, 135], green: [120, 118], pink: [119, 114], fountain: [146, 125], arch: [98, 117], palm: [103, 126], snow: [112, 127], crystal: [84, 85], volcano: [98, 102] };
const monsterCells = { slime: [0, 6], wolf: [1, 7], mushroom: [2, 8], treant: [3, 9], crab: [4, 10], skeleton: [5, 11], scarab: [12, 18], scorpion: [13, 19], golem: [14, 20], spider: [15, 21], imp: [16, 22], dragon: [17, 23], lich: [24, 24], icewolf: [25, 25], wisp: [26, 26], guardian: [27, 27], demon: [28, 28], elemental: [29, 29], ghost: [24, 24] };
async function loadArt() {
  const images = {};
  await Promise.all(Object.entries(files).map(async ([key, path]) => {
    const i = new Image();
    i.src = globalThis.EMBER_ART?.[key] || path;
    await i.decode();
    images[key] = i;
  }));
  return images;
}
function drawCharacter(ctx, images, classId, action, time, x, y, dir = 2, opts = {}) {
  let im = images[classId] || images.sword, cw = im.width / 6, ch = im.height / 5, row = action === "run" || action === "walk" ? 1 : action === "attack" ? 2 : action === "cast" ? 3 : action === "death" ? 4 : 0, sourceY = row * ch;
  const rear = images.back && [5, 6, 7].includes(dir) && action !== "death";
  let size = opts.size || 78;
  if (rear) {
    im = images.back;
    cw = im.width / 6;
    const cuts = [0, 228, 430, 640, 820, 998, 1145], base = { sword: 0, archer: 2, mage: 4 }[classId] ?? 0, useAttack = ["attack", "cast", "hit"].includes(action) || action === "idle" && classId !== "mage";
    row = base + (useAttack ? 1 : 0);
    sourceY = cuts[row];
    ch = cuts[row + 1] - cuts[row];
    size *= classId === "mage" ? 1.25 : classId === "archer" ? 1.12 : 1;
  }
  const loop = action === "idle" || action === "walk" || action === "run";
  let frame = opts.frame ?? Math.floor(time * (action === "idle" ? 5 : action === "walk" ? 8 : 12));
  frame = loop ? frame % 6 : Math.min(5, frame);
  if (rear && action === "idle") frame = 0;
  if(opts.pose!==undefined&&!rear&&images["poses_"+classId]){im=images["poses_"+classId];cw=im.width/6;ch=im.height/4;sourceY=opts.pose*ch;size=opts.size||78;}
  const flip = [3, 4, 5].includes(dir), dh = opts.pose!==undefined&&!rear?size:rear ? size * ch / cw : size;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y-(opts.lift||0)));
  if(opts.rotation)ctx.rotate(opts.rotation);
  if (flip) ctx.scale(-1, 1);
  if (action === "hit") {
    ctx.translate(-2, 1);
    ctx.rotate(-0.08);
  }
  if (action === "dodge") {
    ctx.rotate(flip ? -0.18 : 0.18);
    ctx.scale(1, 0.88);
  }
  if (opts.alpha !== void 0) ctx.globalAlpha = opts.alpha;
  ctx.drawImage(im, Math.round(frame * cw), Math.round(sourceY), Math.floor(cw), Math.floor(ch), -size * 0.5, -dh * 0.94, size, dh);
  if (opts.glow) {
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.12;
    ctx.drawImage(im, Math.round(frame * cw), Math.round(sourceY), Math.floor(cw), Math.floor(ch), -size * 0.5, -dh * 0.94, size, dh);
  }
  ctx.restore();
}
function npcFrame(n, time = n.workTime || 0) {
  return Math.floor(time / n.cycle * 6) % 6;
}
function drawNPC(ctx, images, n, x, y, time = n.workTime || 0) {
  const row = npcAtlas[n.atlasRow], im = images.npcs;
  if (!row || !im) throw Error("\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2A\u0E44\u0E1B\u0E23\u0E15\u0E4C NPC " + n.id);
  const frame = npcFrame(n, time), f = row.frames[frame], scale = (n.size || 72) / row.height;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if ([3, 4, 5].includes(n.dir)) ctx.scale(-1, 1);
  ctx.drawImage(im, f.x, f.y, f.w, f.h, Math.round((f.x - f.anchorX) * scale), Math.round((f.y - f.footY) * scale), Math.round(f.w * scale), Math.round(f.h * scale));
  ctx.restore();
  return frame;
}
function drawMonster(ctx, images, e, x, y) {
  const im = images.monsters, [a, b] = monsterCells[e.kind] || monsterCells.slime, active = e.phase === "strike" || e.state === "hit" || e.phase === "chase" && Math.floor(e.anim * 7) % 2, cell = active ? b : a, cw = im.width / 6, ch = im.height / 5, row = Math.floor(cell / 6), col = cell % 6;
  const size = e.boss ? 104 : e.kind === "slime" ? 47 : e.kind === "dragon" ? 76 : 61;
  const dead = e.dead, alpha = dead ? Math.max(0, 1 - e.anim * 0.8) : 1, flip = [3, 4, 5].includes(e.facing);
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (flip) ctx.scale(-1, 1);
  ctx.globalAlpha = alpha;
  if (dead) {
    ctx.rotate(Math.min(1, e.anim) * 0.7);
    ctx.scale(1, Math.max(0.3, 1 - e.anim * 0.5));
  } else {
    const bob = Math.sin(e.anim * (e.phase === "chase" ? 12 : 3));
    ctx.translate(0, e.phase === "chase" ? -Math.abs(bob) * 2 : bob * 0.4);
    if (e.phase === "windup") ctx.rotate(-0.04);
    if (e.phase === "strike") ctx.translate(3, -1);
  }
  ctx.drawImage(im, col * cw, row * ch, cw, ch, -size * 0.5, -size * 0.9, size, size);
  if (e.hit > 0) {
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.25;
    ctx.drawImage(im, col * cw, row * ch, cw, ch, -size * 0.5, -size * 0.9, size, size);
  }
  ctx.restore();
}
function drawProp(ctx, images, p, x, y, alpha = 1) {
  const im = images.environment, i = PROPS[p.kind] ?? 4, cw = im.width / 4, ch = im.height / 3, [w, h] = sizes[p.kind] || [110, 110], s = p.scale || 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  const f = environmentFrames[i];
  ctx.drawImage(im, f.x, f.y, f.w, f.h, Math.round(x - w * s / 2), Math.round(y - h * s), Math.round(w * s), Math.round(h * s));
  ctx.restore();
}
function iconSVG(id) {
  const paths = { sword: "M10 31L28 7l5-2-1 6-19 22M7 23l14 11M5 35l6-7", whirl: "M8 25c-10-16 22-23 26-10 3 12-22 18-24 8-2-8 15-11 17-4M27 19l5-5m-5 5l6 2", shield: "M20 4L34 10v12L20 36 6 22V10zM20 9v21M11 14l18 12", arrows: "M6 31L25 11m-2-4l8 0 0 8M12 36L31 17m-2-4l8 0 0 8M2 25L20 7m-2-4l8 0 0 8", arrow: "M5 32L32 5M22 5h10v10M4 22l9 9", leaf: "M32 5C6 3 0 22 13 29c15 9 22-11 19-24zM8 34L26 12M12 24l1-9m6 3l9-1", fire: "M20 3c4 10-2 11 4 17 1-7 6-8 6-8 13 17 0 26-10 25C3 37 0 23 12 13c-1 8 2 8 4 10 5-8 1-13 4-20z", ice: "M20 3v34M5 12l30 16M5 28l30-16M15 6l5 5 5-5M15 34l5-5 5 5M5 17l6-2-1-6M30 31l-1-6 6-2", star: "M20 2l5 12 13 6-13 5-5 13-5-13L2 20l13-6zM4 3l4 6M32 31l5 6", dash: "M5 29L28 8m-11 0h11v11M3 16h10M3 23h7", potion: "M15 4h10v8l8 14c5 15-31 15-26 0l8-14zM14 22h14M14 4h12", bag: "M10 10h20l6 25H4zM14 12V5h12v7M12 22h16" };
  return `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="${paths[id] || paths.star}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
export {
  PROPS,
  drawCharacter,
  drawMonster,
  drawNPC,
  drawProp,
  files,
  iconSVG,
  loadArt,
  npcFrame
};
