const STORAGE_KEY = "dnf-xingyuanshi-workshop-v1";

const state = {
  bag: [],
  targetId: null,
  matId: null,
  lastResult: null,
  history: [],
  stats: { fuses: 0, seals: 0, treasures: 0, origins: 0, skill2: 0, skill3: 0, cost: 0 },
  washLock: -1,
  fusing: false,
  hammering: false,
  bagFilter: "all",
  pickerSlot: null,
  pickerFilter: "all",
};

function $(sel, root = document) {
  return root.querySelector(sel);
}

function $$(sel, root = document) {
  return [...root.querySelectorAll(sel)];
}

function sfx(name, ...args) {
  const api = window.Sfx;
  if (api && typeof api[name] === "function") api[name](...args);
}

function toast(msg, kind) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 2200);
  if (kind === "deny") sfx("deny");
}

function save() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      bag: state.bag.map(serializeStone),
      stats: state.stats,
      history: state.history.slice(0, 20),
    })
  );
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!raw) return;
    state.bag = (raw.bag || []).map(restoreStone);
    state.stats = { fuses: 0, seals: 0, treasures: 0, origins: 0, skill2: 0, skill3: 0, cost: 0, ...raw.stats };
    state.history = raw.history || [];
  } catch {
    /* ignore broken save */
  }
}

function findStone(id) {
  return state.bag.find((s) => s.id === id);
}

function removeStone(id) {
  state.bag = state.bag.filter((s) => s.id !== id);
  if (state.targetId === id) state.targetId = null;
  if (state.matId === id) state.matId = null;
}

function addStone(stone, silent = false) {
  state.bag.unshift(stone);
  if (!silent) {
    if (stone.seal) state.stats.seals++;
    if (stone.treasure) state.stats.treasures++;
    if (isQuadOrigin(stone)) state.stats.origins++;
    const epicSkills = epicSkillCount(stone);
    if (epicSkills === 2) state.stats.skill2++;
    if (epicSkills === 3) state.stats.skill3++;
  }
}

function addCost(n) {
  if (!n) return;
  state.stats.cost = (state.stats.cost || 0) + n;
}

function fmtCost(n) {
  return `${Number(n || 0).toLocaleString("zh-CN")}`;
}

function costYuan(n) {
  return `${fmtCost(n)}块钱`;
}

function stoneHTML(stone, opts = {}) {
  const g = GRADE_META[stone.grade];
  const cls = [
    "stone",
    `grade-${stone.grade}`,
    stone.seal ? "seal" : "",
    opts.selectedTarget ? "selected-target" : "",
    opts.selectedMat ? "selected-mat" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const affixLis = stone.affixes
    .map(
      (a, i) => `
      <li class="${a.crown ? "crown" : ""} ${opts.lockable && state.washLock === i ? "wash-lock locked" : "wash-lock"}"
          data-lock="${i}">
        <span class="r-${a.rarity}">${formatAffix(a)}</span>
        <span class="rarity r-${a.rarity}">${RARITY_META[a.rarity].name}</span>
      </li>`
    )
    .join("");

  const tags = [
    stone.treasure ? `<span class="tag treasure">珍品</span>` : "",
    stone.seal ? `<span class="tag seal">玉玺</span>` : "",
    stone.hammered ? `<span class="tag hammer">${stone.finalHammered ? "已终炼" : "已锤炼"}</span>` : "",
    isQuadOrigin(stone) ? `<span class="tag origin-god">四起源</span>` : "",
    `<span class="tag">洗练 ${stone.washLeft}/${WASH_LIMIT}</span>`,
  ].join("");

  const actions = opts.actions
    ? `<div class="stone-actions">
        <button class="btn ${opts.selectedTarget ? "on-target" : ""}" data-act="target" data-id="${stone.id}">${opts.selectedTarget ? "已是目标" : "设为目标"}</button>
        <button class="btn ${opts.selectedMat ? "on-mat" : ""}" data-act="mat" data-id="${stone.id}">${opts.selectedMat ? "已是材料" : "设为材料"}</button>
        <button class="btn danger" data-act="drop" data-id="${stone.id}">分解</button>
      </div>`
    : opts.canDrop
      ? `<div class="stone-actions">
        <button class="btn danger" data-act="drop" data-id="${stone.id}">分解</button>
      </div>`
    : "";

  const ribbon = opts.selectedTarget
    ? `<div class="stone-ribbon target">目标</div>`
    : opts.selectedMat
      ? `<div class="stone-ribbon mat">材料</div>`
      : "";

  return `
    <article class="${cls}" data-id="${stone.id}" ${opts.actions ? 'draggable="true"' : ""}>
      ${ribbon}
      <div class="stone-top">
        <div class="stone-name">${stoneTitle(stone)}</div>
        <div class="star-idx">星序 ${String(stone.starIndex).padStart(2, "0")} · ${STAR_NAMES[stone.starIndex - 1]}</div>
      </div>
      <div class="exo">抗魔 +${stone.exorcism} · ${g.name} · ${g.slots} 词条</div>
      <ul class="affixes">${affixLis}</ul>
      <div class="tags">${tags}</div>
      ${actions}
    </article>`;
}

function renderStats() {
  $("#stat-fuses").textContent = state.stats.fuses;
  $("#stat-seals").textContent = state.stats.seals;
  if ($("#stat-origins")) $("#stat-origins").textContent = state.stats.origins || 0;
  $("#stat-bag").textContent = state.bag.length;
  if ($("#stat-skill2")) $("#stat-skill2").textContent = state.stats.skill2 || 0;
  if ($("#stat-skill3")) $("#stat-skill3").textContent = state.stats.skill3 || 0;
  if ($("#stat-cost")) $("#stat-cost").textContent = costYuan(state.stats.cost);
}

function matchStoneFilter(stone, filter) {
  if (filter === "treasure") return stone.treasure;
  if (filter === "seal") return stone.seal;
  if (String(filter).startsWith("crown")) {
    return crownCount(stone) === Number(String(filter).slice(5));
  }
  return true;
}

function bagVisible() {
  return state.bag.filter((s) => matchStoneFilter(s, state.bagFilter));
}

function renderBag() {
  const t = findStone(state.targetId);
  const m = findStone(state.matId);
  const bits = [`${state.bag.length} 颗`];
  if (t) bits.push("已选目标");
  if (m) bits.push("已选材料");
  $$(".bag-summary").forEach((el) => {
    el.textContent = bits.join(" · ");
  });
  $$(".bag-filters [data-bag-filter]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.bagFilter === state.bagFilter);
  });
  let html;
  if (!state.bag.length) {
    html = `<div class="empty">背包空空如也 · 先打造一颗胚子</div>`;
  } else {
    const list = bagVisible();
    html = list.length
      ? list
          .map((s) =>
            stoneHTML(s, {
              actions: true,
              selectedTarget: s.id === state.targetId,
              selectedMat: s.id === state.matId,
            })
          )
          .join("")
      : `<div class="empty">当前筛选下没有星源石</div>`;
  }
  $$(".inventory").forEach((box) => {
    box.innerHTML = html;
  });
}

function renderSockets() {
  const t = findStone(state.targetId);
  const m = findStone(state.matId);
  $("#socket-target").innerHTML = t
    ? stoneHTML(t, { canDrop: true, selectedTarget: true })
    : `<div class="empty socket-empty"><span>从背包指定目标石<br>结果继承其品级与星序</span><button type="button" class="btn gold socket-pick">选择</button></div>`;
  $("#socket-mat").innerHTML = m
    ? stoneHTML(m, { canDrop: true, selectedMat: true })
    : `<div class="empty socket-empty"><span>从背包指定材料石<br>词条并入抽取池</span><button type="button" class="btn gold socket-pick">选择</button></div>`;

  if (t && m) renderLiveOdds(t, m);
  else $("#live-odds").innerHTML = `<div class="hint">放入双石后，这里会显示本次合成的技攻分布。</div>`;
}

function renderHistory() {
  const box = $("#history");
  if (!state.history.length) {
    box.innerHTML = `<div class="empty">尚无合成记录</div>`;
    return;
  }
  box.innerHTML = state.history
    .map((h) => {
      const cls = h.seal ? "seal" : "";
      return `<div class="odds-card ${cls}">
        <div class="stone-top">
          <span class="stone-name grade-${h.grade}" style="font-family:ZCOOL XiaoWei,serif">${h.title}</span>
          <span class="star-idx">${h.when}</span>
        </div>
        <div class="hint" style="margin:0">${h.detail}</div>
      </div>`;
    })
    .join("");
}

function renderLiveOdds(t, m) {
  const odds = skillOdds(t.grade, skillCount(t), m.grade, skillCount(m));
  const rows = odds.dist
    .filter((d) => d.p > 1e-10)
    .map((d) => {
      const pct = (d.p * 100).toFixed(1);
      return `<div class="bar-row">
        <span>${d.k} 技攻</span>
        <div class="bar"><i style="width:${(d.p * 100).toFixed(1)}%"></i></div>
        <span>${pct}%</span>
      </div>`;
    })
    .join("");
  const sealNote =
    t.grade === "epic"
      ? `<div class="hint">抽中 4 技攻 <b style="color:var(--gold-bright)">${(odds.dist[4]?.p * 100 || 0).toFixed(1)}%</b>。玉玺还要求这 4 条都是史诗及以上品质。</div>`
      : "";
  $("#live-odds").innerHTML = `
    <div class="odds-card">
      <div class="hint" style="margin-bottom:8px">
        官方单槽：目标词条 ${fmtPct(odds.weights.display.target)} · 材料词条 ${fmtPct(odds.weights.display.material)}
        <br>首槽技攻 ${(odds.pSlot * 100).toFixed(2)}% · 不放回抽 ${odds.draws} 条
      </div>
      ${rows}
      ${sealNote}
    </div>`;
}

function setTarget(id) {
  if (state.matId === id) state.matId = null;
  state.targetId = id;
  sfx("selectTarget");
  refresh();
}

function setMat(id) {
  if (state.targetId === id) state.targetId = null;
  state.matId = id;
  sfx("selectMat");
  refresh();
}

function toggleTarget(id) {
  if (state.targetId === id) {
    state.targetId = null;
    sfx("unslot");
    refresh();
    return;
  }
  setTarget(id);
}

function toggleMat(id) {
  if (state.matId === id) {
    state.matId = null;
    sfx("unslot");
    refresh();
    return;
  }
  setMat(id);
}

function pickerVisible() {
  return state.bag.filter((s) => matchStoneFilter(s, state.pickerFilter));
}

function openStonePicker(slot) {
  state.pickerSlot = slot;
  state.pickerFilter = "all";
  const box = $("#stone-picker");
  if (!box) return;
  box.hidden = false;
  box.classList.add("show");
  document.body.classList.add("picker-open");
  renderStonePicker();
  sfx("tab");
}

function closeStonePicker() {
  state.pickerSlot = null;
  const box = $("#stone-picker");
  if (!box) return;
  box.classList.remove("show");
  box.hidden = true;
  document.body.classList.remove("picker-open");
}

function renderStonePicker() {
  const title = $("#stone-picker-title");
  const list = $("#stone-picker-list");
  if (!title || !list || !state.pickerSlot) return;
  title.textContent = state.pickerSlot === "target" ? "选择目标石" : "选择材料石";
  $$("#stone-picker-filters [data-picker-filter]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.pickerFilter === state.pickerFilter);
  });
  if (!state.bag.length) {
    list.innerHTML = `<div class="empty">背包是空的 · 先到「打造」页做一颗胚子</div>`;
    return;
  }
  const stones = pickerVisible();
  if (!stones.length) {
    list.innerHTML = `<div class="empty">当前筛选下没有星源石</div>`;
    return;
  }
  list.innerHTML = stones
    .map((s) =>
      stoneHTML(s, {
        selectedTarget: s.id === state.targetId,
        selectedMat: s.id === state.matId,
      })
    )
    .join("");
}

let pickerDrag = { y: 0, moved: false };

function switchTab(tab) {
  const panel = $(`#panel-${tab}`);
  if (!panel) return;
  $$(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  $$(".panel").forEach((p) => p.classList.toggle("active", p.id === `panel-${tab}`));
  if (window.matchMedia("(max-width: 720px)").matches) {
    $(".tabs")?.scrollIntoView({ block: "start" });
  }
}

function refresh() {
  renderBag();
  renderSockets();
  renderHistory();
  renderStats();
  renderWash();
  renderHammer();
  save();
}

function defaultSlotRarity(grade) {
  if (grade === "epic") return "epic";
  if (grade === "artifact") return "artifact";
  return "rare";
}

function affixTypeOptions(selected) {
  return AFFIX_CONFIG.map(
    (t) => `<option value="${t.id}" ${t.id === selected ? "selected" : ""}>${t.name}</option>`
  ).join("");
}

function rarityOptions(selected) {
  const allowed = EMBRYO_RARITIES.includes(selected) ? selected : "epic";
  return EMBRYO_RARITIES.map(
    (key) =>
      `<option value="${key}" ${key === allowed ? "selected" : ""}>${RARITY_META[key].name}</option>`
  ).join("");
}

function renderCustomSlots() {
  const box = $("#custom-slots");
  if (!box) return;
  const grade = $("#custom-grade").value;
  const slots = GRADE_META[grade].slots;
  const rarity = defaultSlotRarity(grade);
  const prev = $$(".custom-slot", box).map((row) => ({
    typeId: $("[data-type]", row)?.value || "",
    rarity: $("[data-rarity]", row)?.value || rarity,
  }));
  const used = prev.filter((p) => p.typeId).map((p) => p.typeId);
  box.innerHTML = Array.from({ length: slots }, (_, i) => {
    let keep = prev[i];
    if (!keep || !keep.typeId) {
      keep = i === 0 ? { typeId: "skillAtk", rarity } : randomPlainSpec(used);
      used.push(keep.typeId);
    }
    return `<div class="custom-slot">
      <span class="slot-idx">槽 ${i + 1}</span>
      <select data-type>${affixTypeOptions(keep.typeId)}</select>
      <select data-rarity>${rarityOptions(keep.rarity)}</select>
    </div>`;
  }).join("");
}

function doBatchEpicSkill(count, skillN) {
  const stones = spawnEpicSkillStones(count, skillN);
  stones.forEach((s) => addStone(s));
  addCost(count * (COST.generate[skillN] || 0));
  state.targetId = stones[0].id;
  sfx("batch");
  const fee = COST.generate[skillN];
  toast(
    fee
      ? `已放入 ${count} 颗 ${skillN} 史诗技攻，花费 ${costYuan(count * fee)}`
      : `已放入 ${count} 颗 ${skillN} 史诗技攻随机石，可去合成或锤炼`
  );
  refresh();
}

function doCustom() {
  const grade = $("#custom-grade").value;
  const star = Number($("#custom-star").value);
  const specs = $$(".custom-slot").map((row) => ({
    typeId: $("[data-type]", row).value,
    rarity: $("[data-rarity]", row).value,
  }));
  const stone = makeStoneFromSpecs(grade, star, specs);
  addStone(stone);
  const fee = COST.generate[epicSkillCount(stone)] || 0;
  addCost(fee);
  if (isHammerCandidate(stone)) state.targetId = stone.id;
  sfx("craft");
  toast(
    fee
      ? `已放入背包，花费 ${costYuan(fee)}`
      : isHammerCandidate(stone)
        ? "已放入背包，可去锤炼页锻打"
        : "已放入背包，可去合成或洗练"
  );
  refresh();
}

function randomReelAffix() {
  const type = pick(AFFIX_CONFIG);
  const rarity = pick(EMBRYO_RARITIES);
  return { typeId: type.id, rarity, crown: shouldHaveCrown(type) };
}

function reelItemHTML(affix) {
  return `<div class="fuse-reel-item${affix.crown ? " crown" : ""}">
    <span class="r-${affix.rarity}">${formatAffix(affix)}</span>
    <span class="rarity r-${affix.rarity}">${RARITY_META[affix.rarity].name}</span>
  </div>`;
}

function fillReelStrip(reel) {
  const items = Array.from({ length: 12 }, randomReelAffix);
  $(".fuse-reel-strip", reel).innerHTML = items.map(reelItemHTML).join("");
}

function lockReel(reel, affix) {
  if (reel.classList.contains("locked")) return;
  reel.classList.remove("rolling");
  $(".fuse-reel-strip", reel).innerHTML = reelItemHTML(affix);
  reel.classList.add("locked");
  if (affix.typeId === "skillAtk") reel.classList.add("hit-skill");
  if (affix.crown) reel.classList.add("hit-crown");
  sfx("reelLock", affix);
}

function playFuseReveal(stone) {
  const overlay = $("#fuse-reveal");
  const g = GRADE_META[stone.grade];
  overlay.innerHTML = `
    <div class="fuse-reveal-card grade-${stone.grade}${stone.seal ? " is-seal" : ""}">
      <div class="fuse-reveal-eyebrow">星核共鸣</div>
      <div class="fuse-reveal-title" id="fuse-reveal-title">星源凝结中</div>
      <div class="fuse-reveal-meta">${g.name} · 星序 ${String(stone.starIndex).padStart(2, "0")} · ${STAR_NAMES[stone.starIndex - 1]}</div>
      <ul class="fuse-reels">
        ${stone.affixes
          .map(
            (_, i) => `<li class="fuse-reel rolling" data-reel="${i}">
              <div class="fuse-reel-mask"><div class="fuse-reel-strip"></div></div>
            </li>`
          )
          .join("")}
      </ul>
      <div class="fuse-reveal-tags" id="fuse-reveal-tags"></div>
      <div class="fuse-reveal-actions">
        <button class="btn" type="button" id="btn-skip-reveal">跳过动画</button>
      </div>
    </div>`;
  overlay.classList.add("show");
  sfx("fuseStart");

  const reels = $$(".fuse-reel", overlay);
  reels.forEach(fillReelStrip);

  return new Promise((resolve) => {
    let settled = false;
    const timers = [];
    const finish = (delay) => {
      if (settled) return;
      settled = true;
      timers.forEach(clearTimeout);
      setTimeout(() => {
        overlay.classList.remove("show");
        overlay.innerHTML = "";
        resolve();
      }, delay);
    };

    const showTags = () => {
      sfx("fuseDone", stone);
      const title = $("#fuse-reveal-title");
      if (title) {
        title.textContent = "凝结完成";
        title.classList.add("done");
      }
      const tags = $("#fuse-reveal-tags");
      if (!tags) return;
      tags.innerHTML = [
        stone.treasure ? `<span class="tag treasure">珍品</span>` : "",
        stone.seal ? `<span class="tag seal">玉玺</span>` : "",
      ].join("");
      requestAnimationFrame(() => tags.classList.add("show"));
    };

    stone.affixes.forEach((affix, i) => {
      timers.push(setTimeout(() => lockReel(reels[i], affix), 720 + i * 640));
    });

    timers.push(
      setTimeout(() => {
        showTags();
        finish(stone.seal ? 1100 : 800);
      }, 720 + (stone.affixes.length - 1) * 640 + 560)
    );

    const skip = () => {
      if (settled) return;
      sfx("skip");
      stone.affixes.forEach((affix, i) => lockReel(reels[i], affix));
      showTags();
      finish(360);
    };
    $("#btn-skip-reveal")?.addEventListener("click", skip);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) skip();
    });
  });
}

async function doFuse() {
  if (state.fusing) return;
  const t = findStone(state.targetId);
  const m = findStone(state.matId);
  if (!t || !m) return toast("请先指定目标石与材料石", "deny");
  const useRing = $("#use-ring").checked;
  const before = `${stoneTitle(t)} + ${stoneTitle(m)}`;
  const { result, error } = synthesize(t, m, useRing);
  if (error) return toast(error, "deny");

  removeStone(t.id);
  removeStone(m.id);
  addStone(result);
  if (useRing) addCost(COST.ring);
  state.targetId = result.id;
  state.matId = null;
  state.lastResult = result;
  state.stats.fuses++;
  state.history.unshift({
    title: stoneTitle(result),
    grade: result.grade,
    seal: result.seal,
    detail: `${before}${useRing ? " · 固能环" : ""} → ${stoneTitle(result)} · 抗魔 +${result.exorcism}`,
    when: new Date().toLocaleTimeString(),
  });

  state.fusing = true;
  const btn = $("#btn-fuse");
  btn.disabled = true;
  btn.textContent = "凝结中…";

  await playFuseReveal(result);

  state.fusing = false;
  btn.disabled = false;
  btn.textContent = "开始合成";

  if (result.seal) flashSeal();
  else toast(`合成完成：${stoneTitle(result)}`);
  refresh();
}

function flashSeal() {
  sfx("seal");
  const el = $("#seal-flash");
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1200);
}

function fillHammerStrip(reel, typeId) {
  const pool = ["artifact", "epic", "transcendent", "origin"];
  const items = Array.from({ length: 12 }, () => {
    const rarity = pick(pool);
    return { typeId, rarity, crown: shouldHaveCrown(getAffixType(typeId)) };
  });
  $(".fuse-reel-strip", reel).innerHTML = items.map(reelItemHTML).join("");
}

function lockHammerReel(reel, before, after) {
  if (reel.classList.contains("locked")) return;
  const steps = RARITY_META[after.rarity].rank - RARITY_META[before.rarity].rank;
  let extra = "";
  if (steps >= 2) extra = " · 连升";
  else if (steps === 1) extra = " · 升";
  reel.classList.remove("rolling");
  $(".fuse-reel-strip", reel).innerHTML = `
    <div class="fuse-reel-item${after.crown ? " crown" : ""}">
      <span class="r-${after.rarity}">${formatAffix(after)}</span>
      <span class="rarity r-${after.rarity}">${RARITY_META[after.rarity].name}${extra}</span>
    </div>`;
  reel.classList.add("locked");
  if (steps >= 1) reel.classList.add("hit-up");
  if (steps >= 2) reel.classList.add("hit-double");
  if (after.rarity === "origin") reel.classList.add("hit-origin");
  if (steps <= 0) reel.classList.add("miss");
  sfx("hammerLock", steps, after.rarity);
}

function playOriginGodFlash() {
  sfx("originGod");
  const el = $("#origin-flash");
  const box = $("#origin-sparks");
  box.innerHTML = Array.from({ length: 32 }, () => {
    const left = (Math.random() * 100).toFixed(1);
    const delay = (Math.random() * 0.9).toFixed(2);
    const dur = (1 + Math.random() * 1.3).toFixed(2);
    const size = (3 + Math.random() * 7).toFixed(1);
    return `<i class="origin-spark" style="left:${left}%;width:${size}px;height:${size}px;animation-delay:${delay}s;animation-duration:${dur}s"></i>`;
  }).join("");
  el.classList.add("show");
  document.body.classList.add("origin-shake");
  return new Promise((resolve) => {
    setTimeout(() => {
      el.classList.remove("show");
      document.body.classList.remove("origin-shake");
      box.innerHTML = "";
      resolve();
    }, 3200);
  });
}

function playHammerReveal(stone, beforeAffixes) {
  const overlay = $("#fuse-reveal");
  const g = GRADE_META[stone.grade];
  const quad = isQuadOrigin(stone);
  overlay.innerHTML = `
    <div class="fuse-reveal-card grade-${stone.grade}" id="hammer-reveal-card">
      <div class="fuse-reveal-eyebrow">${stone.finalHammered ? "星核终炼" : "星核锻打"}</div>
      <div class="fuse-reveal-title" id="fuse-reveal-title">${stone.finalHammered ? "终炼进行中" : "锤炼进行中"}</div>
      <div class="fuse-reveal-meta">${g.name} · 星序 ${String(stone.starIndex).padStart(2, "0")} · ${STAR_NAMES[stone.starIndex - 1]}</div>
      <ul class="fuse-reels">
        ${stone.affixes
          .map(
            (a, i) => `<li class="fuse-reel rolling" data-reel="${i}">
              <div class="fuse-reel-mask"><div class="fuse-reel-strip"></div></div>
            </li>`
          )
          .join("")}
      </ul>
      <div class="fuse-reveal-tags" id="fuse-reveal-tags"></div>
      <div class="fuse-reveal-actions">
        <button class="btn" type="button" id="btn-skip-reveal">跳过动画</button>
      </div>
    </div>`;
  overlay.classList.add("show");
  sfx("hammerStart");

  const reels = $$(".fuse-reel", overlay);
  reels.forEach((reel, i) => fillHammerStrip(reel, stone.affixes[i].typeId));

  return new Promise((resolve) => {
    let settled = false;
    const timers = [];
    const finish = async (delay, playGod) => {
      if (settled) return;
      settled = true;
      timers.forEach(clearTimeout);
      sfx("reelStop");
      if (playGod) await playOriginGodFlash();
      setTimeout(() => {
        overlay.classList.remove("show");
        overlay.innerHTML = "";
        resolve();
      }, delay);
    };

    const showTags = () => {
      if (!quad) sfx("fuseDone", stone);
      const title = $("#fuse-reveal-title");
      const card = $("#hammer-reveal-card");
      if (title) {
        title.textContent = quad ? "神铸天成" : stone.finalHammered ? "终炼完成" : "锤炼完成";
        title.classList.add("done");
      }
      if (quad && card) card.classList.add("is-origin-god");
      const tags = $("#fuse-reveal-tags");
      if (!tags) return;
      tags.innerHTML = [
        `<span class="tag hammer">${stone.finalHammered ? "已终炼" : "已锤炼"}</span>`,
        quad ? `<span class="tag origin-god">四起源</span>` : "",
      ].join("");
      requestAnimationFrame(() => tags.classList.add("show"));
    };

    const lockAll = () => {
      stone.affixes.forEach((affix, i) => lockHammerReel(reels[i], beforeAffixes[i], affix));
    };

    stone.affixes.forEach((affix, i) => {
      timers.push(setTimeout(() => lockHammerReel(reels[i], beforeAffixes[i], affix), 720 + i * 640));
    });

    timers.push(
      setTimeout(() => {
        showTags();
        finish(quad ? 400 : 800, quad);
      }, 720 + (stone.affixes.length - 1) * 640 + 560)
    );

    const skip = () => {
      if (settled) return;
      sfx("skip");
      lockAll();
      showTags();
      finish(quad ? 200 : 360, quad);
    };
    $("#btn-skip-reveal")?.addEventListener("click", skip);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) skip();
    });
  });
}

function doWash() {
  const t = findStone(state.targetId);
  if (!t) return toast("请先在背包将一颗石设为目标", "deny");
  const useLock = $("#use-lock").checked;
  const { result, error } = washStone(t, useLock ? state.washLock : -1);
  if (error) return toast(error, "deny");
  sfx("wash");
  const idx = state.bag.findIndex((s) => s.id === t.id);
  state.bag[idx] = result;
  toast(`洗练完成，剩余 ${result.washLeft} 次`);
  refresh();
}

function hammerRank(stone) {
  if (stone.finalHammered) return 2;
  if (stone.hammered) return 1;
  return 0;
}

function hammerCandidates() {
  return state.bag
    .filter(isHammerCandidate)
    .sort((a, b) => hammerRank(a) - hammerRank(b));
}

function usingFinalBlade() {
  return !!$("#use-final-blade")?.checked;
}

function pickHammerStone() {
  const finalBlade = usingFinalBlade();
  const list = hammerCandidates().filter((s) =>
    finalBlade ? s.hammered && !s.finalHammered : !s.hammered
  );
  return list.find((s) => s.id === state.targetId) || (list.length === 1 ? list[0] : null);
}

async function doHammer() {
  if (state.hammering || state.fusing) return;
  const finalBlade = usingFinalBlade();
  const t = pickHammerStone();
  if (!t) {
    return toast(
      finalBlade ? "请点选一颗已锤炼、尚未终炼的珍品" : "请先在锤炼页点选一颗带史诗皇冠的珍品",
      "deny"
    );
  }
  const beforeAffixes = t.affixes.map(cloneAffix);
  const useBlade = !!$("#use-blade")?.checked;
  const { result, error, upgraded, doubled, hits } = hammerStone(t, useBlade, finalBlade);
  if (error) return toast(error, "deny");
  if (finalBlade) addCost(COST.finalBlade);
  else if (useBlade) addCost(COST.blade);
  const idx = state.bag.findIndex((s) => s.id === t.id);
  state.bag[idx] = result;
  if (!isQuadOrigin(t) && isQuadOrigin(result)) state.stats.origins++;

  state.hammering = true;
  const btn = $("#btn-hammer");
  btn.disabled = true;
  btn.textContent = "锻打中…";

  await playHammerReveal(result, beforeAffixes);

  state.hammering = false;
  btn.disabled = false;
  btn.textContent = "锤炼";

  if (isQuadOrigin(result)) toast("神铸天成：四起源");
  else {
    const bits = [`命中 ${hits} 次`, `${upgraded} 条`];
    if (doubled) bits.push(`${doubled} 条连升`);
    toast(`${finalBlade ? "终炼" : "锤炼"}完成：${bits.join(" · ")}`);
  }
  refresh();
}

function renderWash() {
  const t = findStone(state.targetId);
  const box = $("#wash-stone");
  const btn = $("#btn-wash");
  if (!box) return;
  const blocked = !!(t && (t.hammered || t.finalHammered));
  if (btn) btn.disabled = blocked;
  if (!t) {
    box.innerHTML = `<div class="empty">将背包中的星源石设为目标后洗练</div>`;
    return;
  }
  if (blocked) {
    box.innerHTML = `${stoneHTML(t, { canDrop: true })}<div class="empty">已锤炼，不能再洗练</div>`;
    return;
  }
  box.innerHTML = stoneHTML(t, { lockable: true, canDrop: true });
}

function renderHammer() {
  const box = $("#hammer-stone");
  if (!box) return;
  const list = hammerCandidates();
  if (!list.length) {
    box.innerHTML = `<div class="empty">背包里还没有带史诗皇冠的珍品<br>史诗词条带皇冠即可出现在这里</div>`;
    return;
  }
  box.innerHTML = list
    .map((s) =>
      stoneHTML(s, {
        canDrop: true,
        selectedTarget:
          s.id === state.targetId ||
          (usingFinalBlade()
            ? list.filter((x) => x.hammered && !x.finalHammered).length === 1 && s.hammered && !s.finalHammered
            : list.filter((x) => !x.hammered).length === 1 && !s.hammered),
      })
    )
    .join("");
}

function fillSkillSelects() {
  const sync = () => {
    const g = $("#calc-tg").value;
    const slots = GRADE_META[g].slots;
    const sel = $("#calc-ts");
    sel.innerHTML = Array.from({ length: slots + 1 }, (_, i) => `<option value="${i}">${i} 技攻</option>`).join("");
    const g2 = $("#calc-mg").value;
    const slots2 = GRADE_META[g2].slots;
    const sel2 = $("#calc-ms");
    sel2.innerHTML = Array.from({ length: slots2 + 1 }, (_, i) => `<option value="${i}">${i} 技攻</option>`).join("");
  };
  $("#calc-tg").addEventListener("change", sync);
  $("#calc-mg").addEventListener("change", sync);
  sync();
}

function renderCalc(odds, extra = "") {
  const rows = odds.dist
    .filter((d) => d.p > 1e-10)
    .map((d) => {
      const pct = (d.p * 100).toFixed(2);
      return `<div class="bar-row">
        <span>${d.k} 技攻</span>
        <div class="bar"><i style="width:${Math.min(100, d.p * 100)}%"></i></div>
        <span>${pct}%</span>
      </div>`;
    })
    .join("");
  $("#calc-out").innerHTML = `
    <div class="odds-card">
      <div class="hint">首槽技攻 ${(odds.pSlot * 100).toFixed(2)}% · 不放回抽 ${odds.draws} 条 · 目标词条 ${fmtPct(odds.weights.display.target)} / 材料词条 ${fmtPct(odds.weights.display.material)}</div>
      ${rows}
      ${extra}
    </div>`;
}

function runCalc(silent) {
  if (!silent) sfx("calc");
  const tg = $("#calc-tg").value;
  const ts = Number($("#calc-ts").value);
  const mg = $("#calc-mg").value;
  const ms = Number($("#calc-ms").value);
  renderCalc(skillOdds(tg, ts, mg, ms));
}

function runBatch() {
  sfx("sim");
  const tg = $("#calc-tg").value;
  const ts = Number($("#calc-ts").value);
  const mg = $("#calc-mg").value;
  const ms = Number($("#calc-ms").value);
  const n = Number($("#calc-n").value);
  const useRing = $("#calc-ring").checked;
  const { counts, seals, times } = simulateBatch(tg, ts, mg, ms, n, useRing);
  const odds = skillOdds(tg, ts, mg, ms);
  const extra = `<div class="hint" style="margin-top:8px">
    模拟 ${times} 次 · 玉玺 ${seals} 次（${((seals / times) * 100).toFixed(2)}%）
    <br>实证分布：${counts.map((c, i) => `${i}技${c}`).join(" / ")}
  </div>`;
  renderCalc(odds, extra);
}

function applyPreset(name) {
  const map = {
    r1: ["rare", 1, "rare", 1],
    a2: ["artifact", 2, "rare", 2],
    e3: ["epic", 2, "artifact", 3],
    seal: ["epic", 3, "artifact", 3],
  };
  const [tg, ts, mg, ms] = map[name];
  $("#calc-tg").value = tg;
  $("#calc-mg").value = mg;
  fillSkillSelectsNow();
  $("#calc-ts").value = String(ts);
  $("#calc-ms").value = String(ms);
  runCalc(true);
}

function fillSkillSelectsNow() {
  const g = $("#calc-tg").value;
  const slots = GRADE_META[g].slots;
  $("#calc-ts").innerHTML = Array.from({ length: slots + 1 }, (_, i) => `<option value="${i}">${i} 技攻</option>`).join("");
  const g2 = $("#calc-mg").value;
  const slots2 = GRADE_META[g2].slots;
  $("#calc-ms").innerHTML = Array.from({ length: slots2 + 1 }, (_, i) => `<option value="${i}">${i} 技攻</option>`).join("");
}

function loadStarterBag() {
  /* 不再预置随机鉴定石，背包从自定义胚子开始 */
}

function syncSfxButton() {
  const btn = $("#btn-sfx");
  if (!btn || !window.Sfx) return;
  btn.textContent = Sfx.label();
  btn.classList.toggle("is-off", Sfx.level() === "off");
  btn.classList.toggle("is-on", Sfx.level() === "on");
}

function bind() {
  $("#btn-sfx")?.addEventListener("click", (e) => {
    e.stopPropagation();
    Sfx.unlock();
    Sfx.cycle();
    syncSfxButton();
  });
  const unlockAudio = () => {
    if (!window.Sfx) return;
    Sfx.unlock();
  };
  document.addEventListener("pointerdown", unlockAudio);
  document.addEventListener("keydown", (e) => {
    unlockAudio();
    if (e.key === "Escape" && state.pickerSlot) closeStonePicker();
  });
  document.addEventListener("click", (e) => {
    if (e.target.closest("#btn-sfx")) return;
    if (e.target.closest("button, .btn, .tabs button")) sfx("click");
  });
  document.addEventListener("pointerenter", (e) => {
    if (e.target.closest && e.target.closest("button, .btn")) sfx("hover");
  }, true);
  document.addEventListener("change", (e) => {
    if (e.target.matches("select")) sfx("change");
    if (e.target.matches("input[type='checkbox']")) sfx("check");
  });

  $$(".tabs button").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchTab(btn.dataset.tab);
      sfx("tab");
    });
  });

  $$("[data-go-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchTab(btn.dataset.goTab);
      sfx("tab");
    });
  });

  const onBagClick = (e) => {
    const btn = e.target.closest("[data-act]");
    if (btn) {
      const id = btn.dataset.id;
      if (btn.dataset.act === "target") toggleTarget(id);
      if (btn.dataset.act === "mat") toggleMat(id);
      if (btn.dataset.act === "drop") {
        removeStone(id);
        sfx("decompose");
        toast("已分解");
        refresh();
      }
      return;
    }
    const card = e.target.closest("[data-id]");
    if (!card) return;
    if (e.shiftKey) toggleMat(card.dataset.id);
    else toggleTarget(card.dataset.id);
  };
  $$(".inventory").forEach((box) => {
    box.addEventListener("click", onBagClick);
    box.addEventListener("dragstart", (e) => {
      const card = e.target.closest("[data-id]");
      if (!card) return;
      e.dataTransfer.setData("text/plain", card.dataset.id);
      e.dataTransfer.effectAllowed = "move";
      card.classList.add("dragging");
      sfx("drag");
    });
    box.addEventListener("dragend", (e) => {
      e.target.closest("[data-id]")?.classList.remove("dragging");
    });
  });

  $(".sockets")?.addEventListener("click", (e) => {
    const drop = e.target.closest("[data-act='drop']");
    if (drop) {
      removeStone(drop.dataset.id);
      sfx("decompose");
      toast("已分解");
      refresh();
      return;
    }
    if (e.target.closest("[data-clear]")) return;
    const socket = e.target.closest("[data-drop]");
    if (!socket) return;
    openStonePicker(socket.dataset.drop);
  });

  const picker = $("#stone-picker");
  picker?.addEventListener("pointerdown", (e) => {
    if (!e.target.closest("#stone-picker-list")) return;
    pickerDrag = { y: e.clientY, moved: false };
  });
  picker?.addEventListener("pointermove", (e) => {
    if (Math.abs(e.clientY - pickerDrag.y) > 10) pickerDrag.moved = true;
  });
  picker?.addEventListener("click", (e) => {
    if (e.target.closest("[data-picker-close]") || e.target.closest("#stone-picker-close")) {
      closeStonePicker();
      return;
    }
    const filter = e.target.closest("[data-picker-filter]");
    if (filter) {
      state.pickerFilter = filter.dataset.pickerFilter;
      sfx("tab");
      renderStonePicker();
      return;
    }
    const card = e.target.closest("#stone-picker-list [data-id]");
    if (!card || !state.pickerSlot || pickerDrag.moved) return;
    if (state.pickerSlot === "target") setTarget(card.dataset.id);
    else setMat(card.dataset.id);
    closeStonePicker();
  });

  $$("[data-drop]").forEach((socket) => {
    socket.addEventListener("dragover", (e) => {
      e.preventDefault();
      socket.classList.add("drag-over");
    });
    socket.addEventListener("dragleave", () => socket.classList.remove("drag-over"));
    socket.addEventListener("drop", (e) => {
      e.preventDefault();
      socket.classList.remove("drag-over");
      const id = e.dataTransfer.getData("text/plain");
      if (!id || !findStone(id)) return;
      sfx("drop");
      if (socket.dataset.drop === "target") setTarget(id);
      else setMat(id);
    });
  });

  $$(".bag-filters").forEach((el) => {
    el.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-bag-filter]");
      if (!btn) return;
      state.bagFilter = btn.dataset.bagFilter;
      sfx("tab");
      renderBag();
    });
  });

  $("#panel-forge").addEventListener("click", (e) => {
    const clear = e.target.closest("[data-clear]");
    if (!clear) return;
    if (clear.dataset.clear === "target") state.targetId = null;
    if (clear.dataset.clear === "mat") state.matId = null;
    sfx("unslot");
    refresh();
  });

  $("#wash-stone").addEventListener("click", (e) => {
    const drop = e.target.closest("[data-act='drop']");
    if (drop) {
      removeStone(drop.dataset.id);
      state.washLock = -1;
      sfx("decompose");
      toast("已分解");
      refresh();
      return;
    }
    const li = e.target.closest("[data-lock]");
    if (!li) return;
    state.washLock = Number(li.dataset.lock);
    sfx("lock");
    renderWash();
  });

  $("#hammer-stone").addEventListener("click", (e) => {
    const drop = e.target.closest("[data-act='drop']");
    if (drop) {
      removeStone(drop.dataset.id);
      sfx("decompose");
      toast("已分解");
      refresh();
      return;
    }
    const card = e.target.closest("[data-id]");
    if (!card) return;
    setTarget(card.dataset.id);
  });

  $("#btn-custom").addEventListener("click", doCustom);
  $("#btn-batch-epic1").addEventListener("click", () => doBatchEpicSkill(100, 1));
  $("#btn-batch-epic2").addEventListener("click", () => doBatchEpicSkill(10, 2));
  $("#btn-batch-epic3").addEventListener("click", () => doBatchEpicSkill(10, 3));
  $("#btn-batch-epic4").addEventListener("click", () => doBatchEpicSkill(10, 4));
  $("#btn-fuse").addEventListener("click", doFuse);
  $("#btn-wash").addEventListener("click", doWash);
  $("#btn-hammer").addEventListener("click", doHammer);
  $("#use-final-blade")?.addEventListener("change", () => {
    if ($("#use-final-blade").checked && $("#use-blade")) $("#use-blade").checked = false;
    renderHammer();
  });
  $("#use-blade")?.addEventListener("change", () => {
    if ($("#use-blade").checked && $("#use-final-blade")) $("#use-final-blade").checked = false;
    renderHammer();
  });
  $("#btn-hammer-epic4").addEventListener("click", () => doBatchEpicSkill(10, 4));
  $("#btn-calc").addEventListener("click", runCalc);
  $("#btn-batch").addEventListener("click", runBatch);
  $$("[data-clear-bag]").forEach((el) => {
    el.addEventListener("click", () => {
      if (!confirm("清空背包与统计？")) return;
      sfx("clear");
      state.bag = [];
      state.targetId = null;
      state.matId = null;
      state.history = [];
      state.stats = { fuses: 0, seals: 0, treasures: 0, origins: 0, skill2: 0, skill3: 0, cost: 0 };
      refresh();
    });
  });

  $$("[data-preset]").forEach((b) =>
    b.addEventListener("click", () => {
      applyPreset(b.dataset.preset);
      sfx("tab");
      sfx("calc");
    })
  );
  $("#custom-grade").addEventListener("change", renderCustomSlots);
}

function paintSky() {
  const c = $("#sky");
  const ctx = c.getContext("2d");
  const stars = [];

  function resize() {
    c.width = window.innerWidth;
    c.height = window.innerHeight;
  }

  function spawn() {
    stars.length = 0;
    const n = Math.floor((c.width * c.height) / 9000);
    for (let i = 0; i < n; i++) {
      stars.push({
        x: Math.random() * c.width,
        y: Math.random() * c.height,
        r: Math.random() * 1.3 + 0.2,
        a: Math.random(),
        s: Math.random() * 0.02 + 0.005,
      });
    }
  }

  function tick() {
    ctx.fillStyle = "#07060c";
    ctx.fillRect(0, 0, c.width, c.height);
    const g = ctx.createRadialGradient(c.width * 0.5, c.height * 0.15, 20, c.width * 0.5, c.height * 0.2, c.width * 0.55);
    g.addColorStop(0, "rgba(80, 60, 20, 0.16)");
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    for (const s of stars) {
      s.a += s.s;
      ctx.fillStyle = `rgba(232, 220, 196, ${0.25 + Math.abs(Math.sin(s.a)) * 0.6})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(tick);
  }

  resize();
  spawn();
  window.addEventListener("resize", () => {
    resize();
    spawn();
  });
  tick();
}

function initCustomForm() {
  $("#custom-star").innerHTML = STAR_NAMES.map(
    (n, i) => `<option value="${i + 1}">星序 ${String(i + 1).padStart(2, "0")} · ${n}</option>`
  ).join("");
}

function formatConfigCell(type, key) {
  const raw = type.values[key];
  if (raw == null || raw === "") return "待填";
  return formatAffixNumber(type, raw);
}

function formatExoCell(type, key) {
  const raw = type.exo ? type.exo[key] : null;
  if (raw == null || raw === "") return "待填";
  return String(raw);
}

function fmtPct(p) {
  return `${+(Number(p) * 100).toFixed(2)}%`;
}

function fillConfigCopy() {
  const pct = (table) =>
    Object.entries(table)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([n, p]) => `${n} 条 ${fmtPct(p)}`)
      .join(" / ");

  const costWrap = $("#stat-cost-wrap");
  if (costWrap) {
    costWrap.title = `固能环 ${costYuan(COST.ring)} / 1史技 ${costYuan(COST.generate[1])} / 2史技 ${costYuan(COST.generate[2])} / 3史技 ${costYuan(COST.generate[3])} / 4史技 ${costYuan(COST.generate[4])} / 锤炼之刃 ${costYuan(COST.blade)} / 终炼之刃 ${costYuan(COST.finalBlade)}`;
  }

  const craftHint = $("#craft-hint");
  if (craftHint) {
    craftHint.textContent = `先在这里做出星源石，放入背包后再去合成、洗练或锤炼。每个槽都会生成一条词条；没改过的槽会随机补一条 T${JUNK_MIN_TIER}～T7、不带皇冠的词条。生成成本：1 史诗技攻 ${costYuan(COST.generate[1])} · 2 史诗技攻 ${costYuan(COST.generate[2])} · 3 史诗技攻 ${costYuan(COST.generate[3])} · 4 史诗技攻 ${costYuan(COST.generate[4])}。合成本身不计成本，勾选固能环每次 ${costYuan(COST.ring)}。`;
  }

  const washHint = $("#wash-hint");
  if (washHint) {
    washHint.textContent = `只改词条品级，不改种类与星序。每石 ${WASH_LIMIT} 次，每条独立随机：史诗 ${fmtPct(WASH_TABLE.epic)} / 神器 ${fmtPct(WASH_TABLE.artifact)} / 稀有 ${fmtPct(WASH_TABLE.rare)} / 高级 ${fmtPct(WASH_TABLE.advanced)} / 普通 ${fmtPct(WASH_TABLE.common)}。最高洗到史诗。勾选稳定剂并点击一条词条即可锁定。已锤炼的星源石不能洗练。`;
  }

  const hammerHint = $("#hammer-hint");
  if (hammerHint) {
    const stay = fmtPct(1 - HAMMER_DOUBLE_P);
    hammerHint.textContent = `背包里所有带史诗皇冠的珍品都会出现在这里，点选后锤炼。锤炼之刃：${pct(HAMMER_COUNT_TABLE.blade)}。空锤：${pct(HAMMER_COUNT_TABLE.raw)}。终炼之刃：只能打已锤炼过的石，概率同锤炼之刃，每石一次。起源已是满级，不会被选中；一条最多升到起源，整石最多四起源。第一次若已命中 7 次，终炼只打剩下那 1 次。被选中且未满级的每条有 ${fmtPct(HAMMER_DOUBLE_P)} 连升两级、${stay} 升一级。锤炼后不可再合成、不可再洗练。`;
  }

  const blade = $("#label-blade");
  if (blade) blade.textContent = `使用锤炼之刃（${costYuan(COST.blade)}）`;
  const finalBlade = $("#label-final-blade");
  if (finalBlade) finalBlade.textContent = `使用终炼之刃（${costYuan(COST.finalBlade)}）`;

  const ruleRing = $("#rule-ring");
  if (ruleRing) {
    ruleRing.innerHTML = `<b>固能环</b>：抽中的词条保留来源数值；不使用时，抽中词条会按目标石品级重随机稀有度。勾选时每次合成计成本 ${costYuan(COST.ring)}；合成本身不计成本。`;
  }
  const ruleCost = $("#rule-cost");
  if (ruleCost) {
    ruleCost.innerHTML = `<b>成本</b>：生成 1 / 2 / 3 / 4 条史诗技攻分别计 ${costYuan(COST.generate[1])} / ${costYuan(COST.generate[2])} / ${costYuan(COST.generate[3])} / ${costYuan(COST.generate[4])}。固能环 ${costYuan(COST.ring)}。锤炼之刃 ${costYuan(COST.blade)}，终炼之刃 ${costYuan(COST.finalBlade)}，空锤不计。顶栏 2史技、3史技、玉玺为累计获得颗数。`;
  }
}

function renderOddsTables() {
  const synthHTML = GRADES.flatMap((tg) =>
    GRADES.map((mg) => {
      const w = SYNTH_AFFIX_P[tg][mg];
      const ts = GRADE_META[tg].slots;
      const ms = GRADE_META[mg].slots;
      return `<tr>
        <td>${GRADE_META[tg].name} · ${ts} 条</td>
        <td>${GRADE_META[mg].name} · ${ms} 条</td>
        <td>${fmtPct(w.target)}</td>
        <td>${fmtPct(w.material)}</td>
        <td>100%</td>
      </tr>`;
    })
  ).join("");
  $$(".synth-odds-body").forEach((el) => {
    el.innerHTML = synthHTML;
  });

  const washBody = $("#wash-odds-body");
  if (washBody) {
    washBody.innerHTML = `<tr>
      <td>每条独立</td>
      <td>${fmtPct(WASH_TABLE.common)}</td>
      <td>${fmtPct(WASH_TABLE.advanced)}</td>
      <td>${fmtPct(WASH_TABLE.rare)}</td>
      <td>${fmtPct(WASH_TABLE.artifact)}</td>
      <td>${fmtPct(WASH_TABLE.epic)}</td>
    </tr>`;
  }

  const hammerBody = $("#hammer-odds-body");
  if (hammerBody) {
    const cell = (table, n) => (table[n] == null ? "—" : fmtPct(table[n]));
    hammerBody.innerHTML = `
      <tr>
        <td>锤炼之刃</td>
        <td>${cell(HAMMER_COUNT_TABLE.blade, 1)}</td>
        <td>${cell(HAMMER_COUNT_TABLE.blade, 2)}</td>
        <td>${cell(HAMMER_COUNT_TABLE.blade, 3)}</td>
        <td>${cell(HAMMER_COUNT_TABLE.blade, 4)}</td>
        <td rowspan="3">${fmtPct(HAMMER_DOUBLE_P)}</td>
      </tr>
      <tr>
        <td>终炼之刃</td>
        <td>${cell(HAMMER_COUNT_TABLE.blade, 1)}</td>
        <td>${cell(HAMMER_COUNT_TABLE.blade, 2)}</td>
        <td>${cell(HAMMER_COUNT_TABLE.blade, 3)}</td>
        <td>${cell(HAMMER_COUNT_TABLE.blade, 4)}</td>
      </tr>
      <tr>
        <td>空锤</td>
        <td>${cell(HAMMER_COUNT_TABLE.raw, 1)}</td>
        <td>${cell(HAMMER_COUNT_TABLE.raw, 2)}</td>
        <td>${cell(HAMMER_COUNT_TABLE.raw, 3)}</td>
        <td>${cell(HAMMER_COUNT_TABLE.raw, 4)}</td>
      </tr>`;
  }
}

function renderAffixValueTable() {
  const keys = ["common", "advanced", "rare", "artifact", "epic", "transcendent", "origin"];
  const rows = (pick) =>
    AFFIX_CONFIG.map((type) => {
      const tierName = (typeof TIER_META !== "undefined" && TIER_META[type.tier]) || `档${type.tier}`;
      return `<tr><td>${type.name}</td><td>T${type.tier} ${tierName}</td>${keys
        .map((k) => `<td>${pick(type, k)}</td>`)
        .join("")}</tr>`;
    }).join("");
  const body = $("#affix-value-body");
  if (body) body.innerHTML = rows(formatConfigCell);
  const exoBody = $("#affix-exo-body");
  if (exoBody) exoBody.innerHTML = rows(formatExoCell);
}

load();
loadStarterBag();
bind();
initCustomForm();
renderCustomSlots();
renderAffixValueTable();
renderOddsTables();
fillConfigCopy();
fillSkillSelects();
applyPreset("seal");
refresh();
paintSky();
syncSfxButton();
