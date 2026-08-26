/**
 * 星源石词条官方数值配置表
 *
 * values：词条效果。列顺序：普通 / 高级 / 稀有 / 神器 / 史诗 / 超凡 / 起源
 * exo：该词条在对应品质下的抗魔。同样把 null 改成官方数字，保存后刷新即生效。
 * unit 只影响界面显示，百分数词条填 "%"，固定值留空字符串。
 * 新增词条只需在本数组再加一行，鉴定/合成/规则表会自动识别。
 *
 * tier 收益档位（0 最高 → 8 最低）：
 * 0 技能攻击力 / 1 分段技能伤害 / 2 所有属性强化 / 3 力智攻击暴击
 * 4 命中抗性回避减伤 / 5 防御 / 6 速度 / 7 生命魔法上限 / 8 体力精神
 * 皇冠只看 tier：T0～T2 一律带皇冠。
 */
const TIER_META = {
  0: "技能攻击力",
  1: "分段技能伤害",
  2: "所有属性强化",
  3: "力智 / 攻击 / 暴击",
  4: "命中 / 抗性 / 回避 / 减伤",
  5: "防御",
  6: "速度",
  7: "生命 / 魔法上限",
  8: "体力 / 精神",
};

const AFFIX_CONFIG = [
  { id: "skillAtk", name: "技能攻击力", unit: "%", tier: 0, values: { common: 0.6, advanced: 1.2, rare: 1.8, artifact: 2.7, epic: 3.6, transcendent: 4.8, origin: 6.0 }, exo: { common: 247, advanced: 494, rare: 743, artifact: 1113, epic: 1484, transcendent: 1980, origin: 2474 } },
  { id: "skill1030", name: "10~30级技能伤害", unit: "%", tier: 1, values: { common: 1, advanced: 2, rare: 3, artifact: 4, epic: 5, transcendent: 6, origin: 8 }, exo: { common: 176, advanced: 351, rare: 528, artifact: 791, epic: 1054, transcendent: 1407, origin: 1758 } },
  { id: "skill3545", name: "35~45级技能伤害", unit: "%", tier: 1, values: { common: 1, advanced: 2, rare: 3, artifact: 4, epic: 5, transcendent: 6, origin: 8 }, exo: { common: 176, advanced: 351, rare: 528, artifact: 791, epic: 1054, transcendent: 1407, origin: 1758 } },
  { id: "skill50", name: "50级技能伤害", unit: "%", tier: 1, values: { common: 1, advanced: 2, rare: 3, artifact: 4, epic: 5, transcendent: 6, origin: 8 }, exo: { common: 176, advanced: 351, rare: 528, artifact: 791, epic: 1054, transcendent: 1407, origin: 1758 } },
  { id: "skill6570", name: "65~70级技能伤害", unit: "%", tier: 1, values: { common: 1, advanced: 2, rare: 3, artifact: 4, epic: 5, transcendent: 6, origin: 8 }, exo: { common: 176, advanced: 351, rare: 528, artifact: 791, epic: 1054, transcendent: 1407, origin: 1758 } },
  { id: "skill75", name: "75级技能伤害", unit: "%", tier: 1, values: { common: 1, advanced: 2, rare: 3, artifact: 4, epic: 5, transcendent: 6, origin: 8 }, exo: { common: 176, advanced: 351, rare: 528, artifact: 791, epic: 1054, transcendent: 1407, origin: 1758 } },
  { id: "skill80", name: "80级技能伤害", unit: "%", tier: 1, values: { common: 1, advanced: 2, rare: 3, artifact: 4, epic: 5, transcendent: 6, origin: 8 }, exo: { common: 176, advanced: 351, rare: 528, artifact: 791, epic: 1054, transcendent: 1407, origin: 1758 } },
  { id: "allElem", name: "所有属性强化", unit: "", tier: 2, values: { common: 3, advanced: 5, rare: 8, artifact: 11, epic: 15, transcendent: 20, origin: 25 }, exo: { common: 156, advanced: 312, rare: 469, artifact: 703, epic: 937, transcendent: 1250, origin: 1562 } },
  { id: "str", name: "力量", unit: "", tier: 3, values: { common: 20, advanced: 40, rare: 60, artifact: 90, epic: 120, transcendent: 160, origin: 200 }, exo: { common: 130, advanced: 260, rare: 391, artifact: 586, epic: 781, transcendent: 1042, origin: 1302 } },
  { id: "int", name: "智力", unit: "", tier: 3, values: { common: 20, advanced: 40, rare: 60, artifact: 90, epic: 120, transcendent: 160, origin: 200 }, exo: { common: 130, advanced: 260, rare: 391, artifact: 586, epic: 781, transcendent: 1042, origin: 1302 } },
  { id: "phyAtk", name: "物理攻击力", unit: "", tier: 3, values: { common: 7, advanced: 14, rare: 21, artifact: 32, epic: 42, transcendent: 56, origin: 70 }, exo: { common: 130, advanced: 260, rare: 391, artifact: 586, epic: 781, transcendent: 1042, origin: 1302 } },
  { id: "magAtk", name: "魔法攻击力", unit: "", tier: 3, values: { common: 7, advanced: 14, rare: 21, artifact: 32, epic: 42, transcendent: 56, origin: 70 }, exo: { common: 130, advanced: 260, rare: 391, artifact: 586, epic: 781, transcendent: 1042, origin: 1302 } },
  { id: "phyCrit", name: "物理暴击", unit: "", tier: 3, values: { common: 5, advanced: 10, rare: 15, artifact: 23, epic: 30, transcendent: 40, origin: 50 }, exo: { common: 130, advanced: 260, rare: 391, artifact: 586, epic: 781, transcendent: 1042, origin: 1302 } },
  { id: "magCrit", name: "魔法暴击", unit: "", tier: 3, values: { common: 5, advanced: 10, rare: 15, artifact: 23, epic: 30, transcendent: 40, origin: 50 }, exo: { common: 130, advanced: 260, rare: 391, artifact: 586, epic: 781, transcendent: 1042, origin: 1302 } },

  { id: "hitRate", name: "命中率", unit: "%", tier: 4, values: { common: 0.1, advanced: 0.2, rare: 0.3, artifact: 0.5, epic: 0.6, transcendent: 0.8, origin: 1.0 }, exo: { common: 78, advanced: 156, rare: 235, artifact: 352, epic: 469, transcendent: 625, origin: 781 } },
  { id: "hit", name: "命中", unit: "", tier: 4, values: { common: 10, advanced: 20, rare: 30, artifact: 45, epic: 60, transcendent: 80, origin: 100 }, exo: { common: 78, advanced: 156, rare: 235, artifact: 352, epic: 469, transcendent: 625, origin: 781 } },
  { id: "phyDmgRed", name: "物理伤害减少率", unit: "%", tier: 4, values: { common: 0.1, advanced: 0.2, rare: 0.3, artifact: 0.5, epic: 0.6, transcendent: 0.8, origin: 1.0 }, exo: { common: 78, advanced: 156, rare: 235, artifact: 352, epic: 469, transcendent: 625, origin: 781 } },
  { id: "magDmgRed", name: "魔法伤害减少率", unit: "%", tier: 4, values: { common: 0.1, advanced: 0.2, rare: 0.3, artifact: 0.5, epic: 0.6, transcendent: 0.8, origin: 1.0 }, exo: { common: 78, advanced: 156, rare: 235, artifact: 352, epic: 469, transcendent: 625, origin: 781 } },
  { id: "evaRate", name: "回避率", unit: "%", tier: 4, values: { common: 0.1, advanced: 0.2, rare: 0.3, artifact: 0.5, epic: 0.6, transcendent: 0.8, origin: 1.0 }, exo: { common: 78, advanced: 156, rare: 235, artifact: 352, epic: 469, transcendent: 625, origin: 781 } },
  { id: "eva", name: "回避", unit: "", tier: 4, values: { common: 10, advanced: 20, rare: 30, artifact: 45, epic: 60, transcendent: 80, origin: 100 }, exo: { common: 78, advanced: 156, rare: 235, artifact: 352, epic: 469, transcendent: 625, origin: 781 } },
  { id: "resFire", name: "火属性抗性", unit: "", tier: 4, values: { common: 2, advanced: 4, rare: 6, artifact: 9, epic: 12, transcendent: 16, origin: 20 }, exo: { common: 78, advanced: 156, rare: 235, artifact: 352, epic: 469, transcendent: 625, origin: 781 } },
  { id: "resIce", name: "冰属性抗性", unit: "", tier: 4, values: { common: 2, advanced: 4, rare: 6, artifact: 9, epic: 12, transcendent: 16, origin: 20 }, exo: { common: 78, advanced: 156, rare: 235, artifact: 352, epic: 469, transcendent: 625, origin: 781 } },
  { id: "resLight", name: "光属性抗性", unit: "", tier: 4, values: { common: 2, advanced: 4, rare: 6, artifact: 9, epic: 12, transcendent: 16, origin: 20 }, exo: { common: 78, advanced: 156, rare: 235, artifact: 352, epic: 469, transcendent: 625, origin: 781 } },
  { id: "resDark", name: "暗属性抗性", unit: "", tier: 4, values: { common: 2, advanced: 4, rare: 6, artifact: 9, epic: 12, transcendent: 16, origin: 20 }, exo: { common: 78, advanced: 156, rare: 235, artifact: 352, epic: 469, transcendent: 625, origin: 781 } },

  { id: "phyDef", name: "物理防御力", unit: "", tier: 5, values: { common: 50, advanced: 100, rare: 150, artifact: 225, epic: 300, transcendent: 400, origin: 500 }, exo: { common: 77, advanced: 153, rare: 231, artifact: 346, epic: 461, transcendent: 615, origin: 768 } },
  { id: "magDef", name: "魔法防御力", unit: "", tier: 5, values: { common: 50, advanced: 100, rare: 150, artifact: 225, epic: 300, transcendent: 400, origin: 500 }, exo: { common: 77, advanced: 153, rare: 231, artifact: 346, epic: 461, transcendent: 615, origin: 768 } },

  { id: "atkSpd", name: "攻击速度", unit: "", tier: 6, values: { common: 0.2, advanced: 0.4, rare: 0.6, artifact: 0.9, epic: 1.2, transcendent: 1.6, origin: 2.0 }, exo: { common: 72, advanced: 143, rare: 215, artifact: 322, epic: 430, transcendent: 573, origin: 716 } },
  { id: "castSpd", name: "释放速度", unit: "", tier: 6, values: { common: 0.3, advanced: 0.6, rare: 0.9, artifact: 1.4, epic: 1.8, transcendent: 2.4, origin: 3.0 }, exo: { common: 72, advanced: 143, rare: 215, artifact: 322, epic: 430, transcendent: 573, origin: 716 } },
  { id: "moveSpd", name: "移动速度", unit: "", tier: 6, values: { common: 0.2, advanced: 0.4, rare: 0.6, artifact: 0.9, epic: 1.2, transcendent: 1.6, origin: 2.0 }, exo: { common: 72, advanced: 143, rare: 215, artifact: 322, epic: 430, transcendent: 573, origin: 716 } },

  { id: "hp", name: "生命值上限", unit: "", tier: 7, values: { common: 30, advanced: 60, rare: 90, artifact: 135, epic: 180, transcendent: 240, origin: 300 }, exo: { common: 65, advanced: 130, rare: 196, artifact: 293, epic: 391, transcendent: 521, origin: 651 } },
  { id: "mp", name: "魔法值上限", unit: "", tier: 7, values: { common: 30, advanced: 60, rare: 90, artifact: 135, epic: 180, transcendent: 240, origin: 300 }, exo: { common: 65, advanced: 130, rare: 196, artifact: 293, epic: 391, transcendent: 521, origin: 651 } },

  { id: "sta", name: "体力", unit: "", tier: 8, values: { common: 12, advanced: 24, rare: 36, artifact: 54, epic: 72, transcendent: 96, origin: 120 }, exo: { common: 62, advanced: 125, rare: 188, artifact: 281, epic: 375, transcendent: 500, origin: 625 } },
  { id: "spi", name: "精神", unit: "", tier: 8, values: { common: 12, advanced: 24, rare: 36, artifact: 54, epic: 72, transcendent: 96, origin: 120 }, exo: { common: 62, advanced: 125, rare: 188, artifact: 281, epic: 375, transcendent: 500, origin: 625 } },
];
