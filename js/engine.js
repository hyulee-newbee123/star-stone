/**
 * DNF 手游 · 星源石工坊引擎
 * 合成模型：结果继承目标石品级与星序。
 * 从目标 / 材料全部词条组成抽取池，按官方权重不放回抽取（一条来源最多进结果一次）。
 * 因此 3 史诗技攻 + 3 史诗技攻最少 2 技攻，不可能出 1 技攻。稀有 2 / 神器 3 / 史诗 4。
 * 固能环：抽中的词条保留来源数值，不重随机稀有度。
 */

function getAffixType(typeId) {
  return (
    AFFIX_CONFIG.find((t) => t.id === typeId) || {
      id: typeId,
      name: typeId,
      unit: "",
      tier: 7,
      values: {},
      exo: {},
    }
  );
}

function junkTypes() {
  return AFFIX_CONFIG.filter((t) => t.id !== "skillAtk");
}

let _uid = 1;

function uid() {
  return `s${Date.now().toString(36)}${(_uid++).toString(36)}`;
}

function rand() {
  return Math.random();
}

function pick(arr) {
  return arr[Math.floor(rand() * arr.length)];
}

function weightedPick(table) {
  const entries = Object.entries(table);
  const total = entries.reduce((sum, [, p]) => sum + Number(p), 0);
  let r = rand() * (total || 1);
  for (const [key, p] of entries) {
    r -= p;
    if (r <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

function combinations(n, k) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  k = Math.min(k, n - k);
  let res = 1;
  for (let i = 1; i <= k; i++) res = (res * (n - k + i)) / i;
  return res;
}

function hypergeometricP(successes, population, draws, k) {
  const den = combinations(population, draws);
  if (den === 0) return 0;
  return (combinations(successes, k) * combinations(population - successes, draws - k)) / den;
}

function binomialP(n, k, p) {
  if (k < 0 || k > n) return 0;
  if (p <= 0) return k === 0 ? 1 : 0;
  if (p >= 1) return k === n ? 1 : 0;
  return combinations(n, k) * p ** k * (1 - p) ** (n - k);
}

function synthWeights(targetGrade, materialGrade) {
  const raw = SYNTH_AFFIX_P[targetGrade][materialGrade];
  const ts = GRADE_META[targetGrade].slots;
  const ms = GRADE_META[materialGrade].slots;
  const total = ts * raw.target + ms * raw.material;
  return {
    target: raw.target / total,
    material: raw.material / total,
    display: raw,
  };
}

function pickSynthAffixes(target, material, slots) {
  const w = synthWeights(target.grade, material.grade);
  const remain = [
    ...target.affixes.map((a) => ({ affix: a, p: w.target })),
    ...material.affixes.map((a) => ({ affix: a, p: w.material })),
  ];
  const picked = [];
  const take = Math.min(slots, remain.length);
  for (let i = 0; i < take; i++) {
    const total = remain.reduce((sum, x) => sum + x.p, 0);
    let r = rand() * (total || 1);
    let idx = remain.length - 1;
    for (let j = 0; j < remain.length; j++) {
      r -= remain[j].p;
      if (r <= 0) {
        idx = j;
        break;
      }
    }
    picked.push(cloneAffix(remain[idx].affix));
    remain.splice(idx, 1);
  }
  return picked;
}

function cloneAffix(a) {
  return { id: a.id, typeId: a.typeId, rarity: a.rarity, crown: !!a.crown };
}

function affixValue(affix) {
  const type = getAffixType(affix.typeId);
  const raw = type.values[affix.rarity];
  return raw == null || raw === "" ? null : raw;
}

function affixExo(affix) {
  const type = getAffixType(affix.typeId);
  const raw = type.exo ? type.exo[affix.rarity] : null;
  if (raw == null || raw === "") return RARITY_META[affix.rarity]?.exo || 0;
  return Number(raw);
}

function formatAffixNumber(type, value) {
  const n = Number(value);
  const text = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return `${text}${type.unit || ""}`;
}

function formatAffix(affix) {
  const type = getAffixType(affix.typeId);
  const value = affixValue(affix);
  if (value == null) return `${type.name} （待填官方数值）`;
  return `${type.name} +${formatAffixNumber(type, value)}`;
}

function skillCount(stone) {
  return stone.affixes.filter((a) => a.typeId === "skillAtk").length;
}

function crownCount(stone) {
  return stone.affixes.filter((a) => a.crown).length;
}

function epicSkillCount(stone) {
  return stone.affixes.filter(
    (a) => a.typeId === "skillAtk" && RARITY_META[a.rarity].rank >= RARITY_META.epic.rank
  ).length;
}

function totalSkillAtk(stone) {
  return stone.affixes
    .filter((a) => a.typeId === "skillAtk")
    .reduce((sum, a) => sum + (affixValue(a) || 0), 0);
}

function isTreasure(stone) {
  if (stone.grade !== "epic") return false;
  if (isSeal(stone)) return true;
  return stone.affixes.some(
    (a) => a.crown && RARITY_META[a.rarity].rank >= RARITY_META.epic.rank
  );
}

function isSeal(stone) {
  const slots = GRADE_META.epic.slots;
  return (
    stone.grade === "epic" &&
    stone.affixes.length === slots &&
    stone.affixes.every(
      (a) => a.typeId === "skillAtk" && RARITY_META[a.rarity].rank >= RARITY_META.epic.rank
    )
  );
}

function isQuadOrigin(stone) {
  const slots = GRADE_META.epic.slots;
  return stone.affixes.length >= slots && stone.affixes.every((a) => a.rarity === "origin");
}

function hasEpicCrown(stone) {
  return stone.affixes.some(
    (a) => a.crown && RARITY_META[a.rarity].rank >= RARITY_META.epic.rank
  );
}

function isHammerCandidate(stone) {
  return stone.grade === "epic" && hasEpicCrown(stone);
}

function calcExorcism(stone) {
  return stone.affixes.reduce((sum, a) => sum + affixExo(a), 0);
}

function shouldHaveCrown(type) {
  return (type.tier ?? 7) <= CROWN_MAX_TIER;
}

function createAffix(typeId, rarity, crown = false) {
  const type = getAffixType(typeId);
  return {
    id: uid(),
    typeId,
    rarity,
    crown: shouldHaveCrown(type),
  };
}

function createStone(grade, starIndex, affixes, extra = {}) {
  const stone = {
    id: extra.id || uid(),
    grade,
    starIndex,
    affixes: affixes.map((a) => {
      const c = cloneAffix(a);
      c.crown = shouldHaveCrown(getAffixType(c.typeId));
      return c;
    }),
    washLeft: extra.washLeft ?? WASH_LIMIT,
    hammered: extra.hammered ?? false,
    finalHammered: extra.finalHammered ?? false,
    sealed: extra.sealed ?? false,
  };
  stone.exorcism = calcExorcism(stone);
  stone.treasure = isTreasure(stone);
  stone.seal = isSeal(stone);
  return stone;
}

function randomStar() {
  return 1 + Math.floor(rand() * STAR_NAMES.length);
}

function rollIdentifyRarity(grade) {
  return weightedPick(IDENTIFY_TABLE[grade]);
}

function fillJunk(usedSkill, slots) {
  const types = [];
  const pool = [...junkTypes()];
  while (types.length < slots - usedSkill && pool.length) {
    const i = Math.floor(rand() * pool.length);
    types.push(pool.splice(i, 1)[0].id);
  }
  return types;
}

/**
 * 鉴定一颗源石。tactical 宝箱至少 1 条技攻。
 * skillBias: 0~1，提高出技攻的权重。
 */
function identifyStone(grade, options = {}) {
  const slots = GRADE_META[grade].slots;
  let skill = 0;
  const p = options.tactical ? IDENTIFY_SKILL_P.tactical : options.skillBias ?? IDENTIFY_SKILL_P.default;
  for (let i = 0; i < slots; i++) {
    if (rand() < p) skill++;
  }
  if (options.tactical && skill < 1) skill = 1;
  if (options.fixedSkill != null) skill = Math.max(0, Math.min(slots, options.fixedSkill));

  const affixes = [];
  for (let i = 0; i < skill; i++) {
    affixes.push(createAffix("skillAtk", rollIdentifyRarity(grade)));
  }
  for (const typeId of fillJunk(skill, slots)) {
    affixes.push(createAffix(typeId, rollIdentifyRarity(grade)));
  }

  return createStone(grade, options.starIndex || randomStar(), affixes);
}

function customStone(grade, skillN, rarity = null, starIndex = null) {
  const slots = GRADE_META[grade].slots;
  const n = Math.max(0, Math.min(slots, skillN));
  const r0 = rarity || (grade === "epic" ? "epic" : grade === "artifact" ? "artifact" : "rare");
  const specs = [];
  for (let i = 0; i < n; i++) specs.push({ typeId: "skillAtk", rarity: r0 });
  for (const typeId of fillJunk(n, slots)) specs.push({ typeId, rarity: r0 });
  return makeStoneFromSpecs(grade, starIndex, specs);
}

function randomPlainSpec(usedIds = []) {
  const pool = AFFIX_CONFIG.filter((t) => t.tier >= JUNK_MIN_TIER && !usedIds.includes(t.id));
  const list = pool.length ? pool : AFFIX_CONFIG.filter((t) => t.tier >= JUNK_MIN_TIER);
  const type = list[Math.floor(Math.random() * list.length)];
  const rarity = EMBRYO_RARITIES[Math.floor(Math.random() * EMBRYO_RARITIES.length)];
  return { typeId: type.id, rarity };
}

function spawnEpicSkillStones(n, skillN) {
  const specs = Array.from({ length: skillN }, () => ({ typeId: "skillAtk", rarity: "epic" }));
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(makeStoneFromSpecs("epic", randomStar(), specs));
  }
  return out;
}

function makeStoneFromSpecs(grade, starIndex, specs) {
  const slots = GRADE_META[grade].slots;
  const used = [];
  const filled = [];
  for (let i = 0; i < slots; i++) {
    const spec = specs && specs[i];
    if (spec && spec.typeId) {
      filled.push({
        typeId: spec.typeId,
        rarity: EMBRYO_RARITIES.includes(spec.rarity) ? spec.rarity : "epic",
      });
      used.push(spec.typeId);
    } else {
      const plain = randomPlainSpec(used);
      filled.push(plain);
      used.push(plain.typeId);
    }
  }
  return createStone(
    grade,
    starIndex || randomStar(),
    filled.map((s) => createAffix(s.typeId, s.rarity))
  );
}

function sampleWithoutReplacement(arr, n) {
  const copy = arr.slice();
  const out = [];
  const take = Math.min(n, copy.length);
  for (let i = 0; i < take; i++) {
    const idx = Math.floor(rand() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

function synthesize(target, material, useRing = false) {
  if (target.hammered || material.hammered) {
    return { error: "已锤炼的星源石无法参与合成" };
  }
  const slots = GRADE_META[target.grade].slots;
  const picked = pickSynthAffixes(target, material, slots);

  if (!useRing) {
    for (const a of picked) {
      a.rarity = weightedPick(WASH_TABLE);
      if (!EMBRYO_RARITIES.includes(a.rarity)) a.rarity = "epic";
      a.crown = shouldHaveCrown(getAffixType(a.typeId));
    }
  }

  const result = createStone(target.grade, target.starIndex, picked, { washLeft: WASH_LIMIT });
  return { result };
}

function washStone(stone, lockIndex = -1) {
  if (stone.hammered || stone.finalHammered) return { error: "已锤炼的星源石不能洗练" };
  if (stone.washLeft <= 0) return { error: "洗练次数已耗尽" };
  const next = createStone(
    stone.grade,
    stone.starIndex,
    stone.affixes.map((a, i) => {
      const c = cloneAffix(a);
      if (i === lockIndex) return c;
      c.rarity = weightedPick(WASH_TABLE);
      if (!EMBRYO_RARITIES.includes(c.rarity)) c.rarity = "epic";
      c.crown = shouldHaveCrown(getAffixType(c.typeId));
      return c;
    }),
    { washLeft: stone.washLeft - 1, hammered: stone.hammered, finalHammered: stone.finalHammered, sealed: stone.sealed, id: stone.id }
  );
  return { result: next };
}

function canHammerAffix(affix) {
  return RARITY_META[affix.rarity].rank < RARITY_META.origin.rank;
}

function remainingHammerSteps(stone) {
  const cap = RARITY_META.origin.rank;
  return stone.affixes.reduce((sum, a) => sum + Math.max(0, cap - RARITY_META[a.rarity].rank), 0);
}

function hammerStone(stone, useBlade = false, useFinalBlade = false) {
  if (!isTreasure(stone)) return { error: "仅珍品或玉玺可锤炼（史诗，且为玉玺或至少一条史诗以上皇冠词条）" };
  if (useFinalBlade) {
    if (!stone.hammered) return { error: "终炼之刃只能用于已经锤炼过的星源石" };
    if (stone.finalHammered) return { error: "终炼之刃每石仅可使用一次" };
  } else if (stone.hammered) {
    return { error: "已锤炼过。勾选终炼之刃可再锻一次" };
  }
  if (remainingHammerSteps(stone) <= 0) return { error: "已是四起源，无法再提升" };

  const rolled = Number(weightedPick(useBlade || useFinalBlade ? HAMMER_COUNT_TABLE.blade : HAMMER_COUNT_TABLE.raw));
  const idxs = stone.affixes.map((_, i) => i).filter((i) => canHammerAffix(stone.affixes[i]));
  const chosen = sampleWithoutReplacement(idxs, Math.min(rolled, idxs.length));
  const affixes = stone.affixes.map(cloneAffix);

  const bump = (i) => {
    if (!canHammerAffix(affixes[i])) return false;
    affixes[i].rarity = RARITIES[RARITY_META[affixes[i].rarity].rank + 1];
    return true;
  };

  let hits = 0;
  let upgraded = 0;
  let doubled = 0;
  chosen.forEach((i) => {
    if (!bump(i)) return;
    hits++;
    upgraded++;
    if (rand() < HAMMER_DOUBLE_P && bump(i)) {
      hits++;
      doubled++;
    }
  });

  const result = createStone(stone.grade, stone.starIndex, affixes, {
    washLeft: stone.washLeft,
    hammered: true,
    finalHammered: useFinalBlade || stone.finalHammered,
    sealed: stone.sealed,
    id: stone.id,
  });
  return { result, upgraded, doubled, hits, final: !!useFinalBlade };
}

function bitCount(n) {
  let c = 0;
  while (n) {
    n &= n - 1;
    c++;
  }
  return c;
}

/**
 * 精确计算：按官方权重从两石词条池不放回抽 draws 条。
 * 首槽技攻率仍是 skillA * w.target + skillB * w.material，后续槽会因已抽走的来源变化。
 */
function skillOdds(targetGrade, skillA, materialGrade, skillB) {
  const slotsA = GRADE_META[targetGrade].slots;
  const slotsB = GRADE_META[materialGrade].slots;
  const draws = slotsA;
  const a = Math.min(skillA, slotsA);
  const b = Math.min(skillB, slotsB);
  const w = synthWeights(targetGrade, materialGrade);
  const pSlot = Math.min(1, a * w.target + b * w.material);
  const items = [];
  for (let i = 0; i < slotsA; i++) items.push({ skill: i < a, w: w.target });
  for (let i = 0; i < slotsB; i++) items.push({ skill: i < b, w: w.material });
  const n = items.length;
  const size = 1 << n;
  let cur = new Float64Array(size);
  cur[0] = 1;
  for (let step = 0; step < draws; step++) {
    const next = new Float64Array(size);
    for (let mask = 0; mask < size; mask++) {
      const p = cur[mask];
      if (p === 0 || bitCount(mask) !== step) continue;
      let tw = 0;
      for (let i = 0; i < n; i++) if (((mask >> i) & 1) === 0) tw += items[i].w;
      if (tw <= 0) continue;
      for (let i = 0; i < n; i++) {
        if ((mask >> i) & 1) continue;
        next[mask | (1 << i)] += p * (items[i].w / tw);
      }
    }
    cur = next;
  }
  const dist = [];
  for (let k = 0; k <= draws; k++) dist.push({ k, p: 0 });
  for (let mask = 0; mask < size; mask++) {
    if (bitCount(mask) !== draws) continue;
    let k = 0;
    for (let i = 0; i < n; i++) if ((mask >> i) & 1 && items[i].skill) k++;
    dist[k].p += cur[mask];
  }
  const atLeast = [];
  let acc = 0;
  for (let k = draws; k >= 0; k--) {
    acc += dist[k].p;
    atLeast[k] = acc;
  }
  return { draws, pool: n, goods: a + b, dist, atLeast, pSlot, weights: w };
}

function simulateBatch(targetGrade, skillA, materialGrade, skillB, times, useRing = false) {
  const counts = Array(GRADE_META[targetGrade].slots + 1).fill(0);
  let seals = 0;
  for (let i = 0; i < times; i++) {
    const t = customStone(targetGrade, skillA);
    const m = customStone(materialGrade, skillB);
    const { result } = synthesize(t, m, useRing);
    const n = skillCount(result);
    counts[n]++;
    if (result.seal) seals++;
  }
  return { counts, seals, times };
}

function stoneTitle(stone) {
  const g = GRADE_META[stone.grade].name;
  const n = skillCount(stone);
  const tot = totalSkillAtk(stone);
  const pct = tot > 0 ? ` ${tot.toFixed(1)}%` : "";
  if (stone.seal) return `${g}·玉玺${pct}`;
  if (n > 0) return `${g}${n}技攻${pct}`;
  return `${g}星源石`;
}

function serializeStone(s) {
  return {
    id: s.id,
    grade: s.grade,
    starIndex: s.starIndex,
    affixes: s.affixes.map((a) => ({ typeId: a.typeId, rarity: a.rarity, crown: a.crown })),
    washLeft: s.washLeft,
    hammered: s.hammered,
    finalHammered: s.finalHammered,
    sealed: s.sealed,
  };
}

function restoreStone(raw) {
  return createStone(
    raw.grade,
    raw.starIndex,
    raw.affixes.map((a) => ({ id: uid(), typeId: a.typeId, rarity: a.rarity, crown: a.crown })),
    { washLeft: raw.washLeft, hammered: raw.hammered, finalHammered: raw.finalHammered, sealed: raw.sealed, id: raw.id }
  );
}
