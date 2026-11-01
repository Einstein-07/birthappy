export type SensitiveCategory =
  | "辱骂攻击"
  | "色情低俗"
  | "违法交易"
  | "暴力危险"
  | "危害国家安全"
  | "垃圾广告";

type SensitiveEntry = {
  term: string;
  category: SensitiveCategory;
  aliases?: string[];
};

const ENTRIES: SensitiveEntry[] = [
  {
    term: "傻逼",
    category: "辱骂攻击",
    aliases: ["傻b", "沙比", "傻比", "shabi", "shab"]
  },
  {
    term: "操你妈",
    category: "辱骂攻击",
    aliases: ["草泥马", "caonima", "caonm"]
  },
  {
    term: "去死",
    category: "辱骂攻击",
    aliases: ["qusi"]
  },
  {
    term: "fuck",
    category: "辱骂攻击",
    aliases: ["fuxk", "fck"]
  },
  {
    term: "bitch",
    category: "辱骂攻击"
  },
  {
    term: "色情",
    category: "色情低俗",
    aliases: ["seqing"]
  },
  {
    term: "约炮",
    category: "色情低俗",
    aliases: ["yuepao"]
  },
  {
    term: "裸聊",
    category: "色情低俗",
    aliases: ["luoliao"]
  },
  {
    term: "卖淫",
    category: "色情低俗",
    aliases: ["maiyin"]
  },
  {
    term: "嫖娼",
    category: "色情低俗",
    aliases: ["piaochang"]
  },
  {
    term: "porn",
    category: "色情低俗"
  },
  {
    term: "毒品",
    category: "违法交易",
    aliases: ["dupin"]
  },
  {
    term: "冰毒",
    category: "违法交易"
  },
  {
    term: "海洛因",
    category: "违法交易",
    aliases: ["hailuoyin"]
  },
  {
    term: "赌博",
    category: "违法交易",
    aliases: ["dubo"]
  },
  {
    term: "博彩",
    category: "违法交易",
    aliases: ["bocai"]
  },
  {
    term: "洗钱",
    category: "违法交易",
    aliases: ["xiqian"]
  },
  {
    term: "诈骗",
    category: "违法交易",
    aliases: ["zhapian"]
  },
  {
    term: "刷单",
    category: "违法交易",
    aliases: ["shuadan"]
  },
  {
    term: "代开发票",
    category: "违法交易",
    aliases: ["daikaifapiao"]
  },
  {
    term: "枪支",
    category: "暴力危险",
    aliases: ["qiangzhi"]
  },
  {
    term: "炸弹",
    category: "暴力危险",
    aliases: ["zhadan"]
  },
  {
    term: "爆炸物",
    category: "暴力危险",
    aliases: ["baozhawu"]
  },
  {
    term: "恐怖袭击",
    category: "暴力危险",
    aliases: ["kongbuxiji"]
  },
  {
    term: "强奸",
    category: "暴力危险",
    aliases: ["qiangjian"]
  },
  {
    term: "法轮功",
    category: "危害国家安全",
    aliases: ["falungong"]
  },
  {
    term: "六四事件",
    category: "危害国家安全",
    aliases: ["64事件", "liusi事件"]
  },
  {
    term: "台独",
    category: "危害国家安全",
    aliases: ["taiwanduli"]
  },
  {
    term: "藏独",
    category: "危害国家安全",
    aliases: ["xizangduli"]
  },
  {
    term: "疆独",
    category: "危害国家安全",
    aliases: ["xinjiangduli"]
  },
  {
    term: "港独",
    category: "危害国家安全",
    aliases: ["xianggangduli"]
  },
  {
    term: "分裂国家",
    category: "危害国家安全",
    aliases: ["fenlieguojia"]
  },
  {
    term: "颠覆国家政权",
    category: "危害国家安全",
    aliases: ["dianfuguojiazhengquan"]
  },
  {
    term: "恐怖主义",
    category: "危害国家安全",
    aliases: ["kongbuzhuyi"]
  },
  {
    term: "极端主义",
    category: "危害国家安全",
    aliases: ["jiduanzhuyi"]
  },
  {
    term: "加微信",
    category: "垃圾广告",
    aliases: ["jiaweixin"]
  },
  {
    term: "加qq",
    category: "垃圾广告",
    aliases: ["jiaqq"]
  }
];

type AutomatonNode = {
  next: Map<string, number>;
  fail: number;
  outputs: number[];
};

export type SensitiveMatch = {
  term: string;
  category: SensitiveCategory;
};

function compactNormalize(input: string, removeDigits: boolean) {
  let value = input
    .normalize("NFKD")
    .toLowerCase()
    .replace(/\p{M}/gu, "")
    .replace(/[\u200b-\u200f\u2060-\u206f\ufeff]/g, "");

  if (removeDigits) {
    value = value.replace(/[0-9]/g, "");
  } else {
    value = value
      .replaceAll("0", "o")
      .replaceAll("1", "i")
      .replaceAll("3", "e")
      .replaceAll("4", "a")
      .replaceAll("5", "s")
      .replaceAll("7", "t");
  }

  value = value
    .replaceAll("@", "a")
    .replaceAll("$", "s")
    .replaceAll("!", "i");

  return value.replace(/[^\p{Script=Han}a-z0-9]/gu, "");
}

function buildAutomaton(patterns: Map<string, number[]>) {
  const nodes: AutomatonNode[] = [
    { next: new Map(), fail: 0, outputs: [] }
  ];

  for (const [pattern, entryIndexes] of patterns) {
    let state = 0;
    for (const character of Array.from(pattern)) {
      const existing = nodes[state].next.get(character);
      if (existing != null) {
        state = existing;
        continue;
      }
      const nextState = nodes.length;
      nodes.push({ next: new Map(), fail: 0, outputs: [] });
      nodes[state].next.set(character, nextState);
      state = nextState;
    }
    nodes[state].outputs.push(...entryIndexes);
  }

  const queue: number[] = [];
  for (const child of nodes[0].next.values()) queue.push(child);

  while (queue.length > 0) {
    const state = queue.shift()!;
    for (const [character, nextState] of nodes[state].next) {
      queue.push(nextState);
      let fail = nodes[state].fail;
      while (fail !== 0 && !nodes[fail].next.has(character)) {
        fail = nodes[fail].fail;
      }
      const fallback = nodes[fail].next.get(character);
      nodes[nextState].fail =
        fallback != null && fallback !== nextState ? fallback : 0;
      nodes[nextState].outputs.push(
        ...nodes[nodes[nextState].fail].outputs
      );
    }
  }

  return nodes;
}

const PATTERNS = new Map<string, number[]>();
for (let index = 0; index < ENTRIES.length; index += 1) {
  const entry = ENTRIES[index];
  for (const candidate of [entry.term, ...(entry.aliases ?? [])]) {
    const normalized = compactNormalize(candidate, false);
    if (!normalized) continue;
    const existing = PATTERNS.get(normalized) ?? [];
    if (!existing.includes(index)) existing.push(index);
    PATTERNS.set(normalized, existing);
  }
}
const AUTOMATON = buildAutomaton(PATTERNS);

function scanVariant(text: string) {
  if (!text) return new Set<number>();
  const found = new Set<number>();
  let state = 0;

  for (const character of Array.from(text)) {
    while (state !== 0 && !AUTOMATON[state].next.has(character)) {
      state = AUTOMATON[state].fail;
    }
    state = AUTOMATON[state].next.get(character) ?? 0;
    for (const output of AUTOMATON[state].outputs) found.add(output);
  }

  return found;
}

export function findSensitiveWords(input: string): SensitiveMatch[] {
  const leet = compactNormalize(input, false);
  const withoutDigits = compactNormalize(input, true);
  const indexes = new Set<number>([
    ...scanVariant(leet),
    ...scanVariant(withoutDigits)
  ]);

  return Array.from(indexes)
    .sort((a, b) => a - b)
    .map((index) => ({
      term: ENTRIES[index].term,
      category: ENTRIES[index].category
    }));
}

export function sensitiveWarning(input: string) {
  const matches = findSensitiveWords(input);
  if (matches.length === 0) return null;
  return {
    matches,
    message: `输入内容包含违规词汇：${matches
      .map((item) => item.term)
      .slice(0, 3)
      .join("、")}`
  };
}

export const SENSITIVE_WORD_COUNT = ENTRIES.length;
