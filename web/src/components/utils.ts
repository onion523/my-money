export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' });
}

export function today(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function thisMonth(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export const CATEGORIES = {
  expense: [
    '餐飲',
    '交通',
    '汽機車輛',
    '居家水電',
    '數位訂閱',
    '購物',
    '生活',
    '娛樂',
    '美妝保養',
    '醫療',
    '教育',
    '寵物毛孩',
    '旅行度假',
    '社交人情',
    '保險稅費',
    '其他'
  ],
  income: [
    '薪資',
    '獎金',
    '投資',
    '兼職',
    '政府補貼',
    '禮金餽贈',
    '二手出清',
    '其他'
  ],
};

export const CATEGORY_ICONS: Record<string, string> = {
  '餐飲': '🍜',
  '交通': '🚇',
  '汽機車輛': '🚗',
  '居家水電': '⚡',
  '數位訂閱': '📱',
  '購物': '🛍️',
  '生活': '💡',
  '娛樂': '🎮',
  '美妝保養': '💄',
  '醫療': '💊',
  '教育': '📚',
  '寵物毛孩': '🐱',
  '旅行度假': '✈️',
  '社交人情': '🧧',
  '保險稅費': '📑',
  '薪資': '💵',
  '獎金': '🎁',
  '投資': '📈',
  '兼職': '💼',
  '政府補貼': '🏛️',
  '禮金餽贈': '🧧',
  '二手出清': '♻️',
  '信用卡還款': '💳',
  '內部轉帳': '🔄',
  'ATM提款': '🏧',
  '公帳代墊報銷': '🤝',
  '其他': '📦',
};

export const CYCLE_LABELS: Record<string, string> = {
  monthly: '每月',
  bimonthly: '每雙月',
  quarterly: '每季',
  semiannual: '每半年',
  annual: '每年',
};

export const ACCOUNT_COLORS = [
  '#FF8A8A', '#FFD4A0', '#A8D8EA', '#95E1D3',
  '#F38181', '#FCE38A', '#EAFFD0', '#C9D6FF'
];

export function formatLocalDate(utcDateStr?: string): string {
  if (!utcDateStr) return '';
  let iso = utcDateStr;
  if (!iso.includes('T') && !iso.endsWith('Z')) {
    iso = iso.replace(' ', 'T') + 'Z';
  }
  const d = new Date(iso);
  if (isNaN(d.getTime())) return utcDateStr.slice(0, 10);
  return d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

// ==========================================
// 雙層智慧分類推薦引擎 (Two-Tier Recommendation)
// ==========================================

export interface CategoryRecommendation {
  category: string;
  source: 'history' | 'lexicon';
}

export const EXPENSE_LEXICON: Array<{ category: string; pattern: RegExp }> = [
  { category: '汽機車輛', pattern: /中油|台塑|全國加油|加油|92|95|98|柴油|機油|保養|修車|車貸|停車|停車場|停車費|嘟嘟房|udrive|irent|和運|格上|特斯拉|tesla|gogoro|驗車|過路費|etc|etag|e-tag|洗車|輪胎|鈑金/i },
  { category: '居家水電', pattern: /房租|水費|電費|台電|瓦斯|天然氣|管理費|管委會|社區管理|寬頻|光世代|第四台|大樓管理|房東|押金/i },
  { category: '數位訂閱', pattern: /netflix|spotify|chatgpt|openai|youtube|premium|disney|icloud|google one|apple one|apple music|github|cursor|midjourney|notion|kkbox|line music|電信費|遠傳|台灣大哥大|中華電信|門號|月租/i },
  { category: '美妝保養', pattern: /剪髮|理髮|剪頭|頭髮|染髮|燙髮|美甲|美睫|做臉|護膚|spa|彩妝|化妝品|口紅|粉底|精華液|面膜|醫美|雷射|sk-ii|雅詩蘭黛|蘭蔻|植村秀|理膚寶水/i },
  { category: '寵物毛孩', pattern: /貓砂|飼料|罐頭|主食罐|副食罐|肉泥|化毛膏|貓草|獸醫|動物醫院|寵物看診|狂犬病|驅蟲|寵物美容|結紮|貓抓板|汪喵星球|怪獸部落|毛孩|寵物公園/i },
  { category: '旅行度假', pattern: /機票|長榮|華航|星宇|虎航|airbnb|agoda|booking|飯店|民宿|渡假|度假|旅館|青年旅館|包棟|出國|伴手禮|景點門票|迪士尼|環球影城|klook|kkday/i },
  { category: '社交人情', pattern: /喜酒|紅包|白包|奠儀|禮金|彌月|滿月|過年紅包|壓歲錢|伴手禮|送禮|禮盒|請客|聚餐費|交際|應酬/i },
  { category: '保險稅費', pattern: /保費|保險|南山|國泰人壽|富邦人壽|新光人壽|台灣人壽|三商美邦|醫療險|意外險|儲蓄險|車險|強制險|第三責任險|所得稅|綜所稅|房屋稅|地價稅|牌照稅|燃料費/i },
  { category: '餐飲', pattern: /飯|麵|餐|吃|喝|早|午|晚|宵夜|咖啡|茶|飲料|麥當勞|肯德基|摩斯|星巴克|壽司|爭鮮|拉麵|便當|火鍋|餐廳|披薩|全家|7-11|小七|路易莎|麻古|迷客夏|五十嵐|50嵐|清心|可不可|外送|ubereats|foodpanda|下午茶|點心|麵包|烘焙/i },
  { category: '交通', pattern: /捷運|公車|高鐵|台鐵|火車|悠遊卡|一卡通|icash|uber|計程車|小黃|大都會|55688|客運|國光|統聯|渡輪|纜車/i },
  { category: '娛樂', pattern: /遊戲|switch|ps5|xbox|steam|電影|威秀|國賓|秀泰|ktv|錢櫃|好樂迪|唱歌|展覽|演唱會|門票|扭蛋|動漫|桌遊|露營|公仔/i },
  { category: '醫療', pattern: /診所|醫院|看病|掛號|牙醫|眼科|耳鼻喉|皮膚科|健保|感冒|藥局|大樹藥局|丁丁藥局|屈臣氏藥妝|康是美藥品|保健食品|維他命|益生菌|疫苗|復健/i },
  { category: '教育', pattern: /書|書店|誠品|博客來|線上課程|hahow|udemy|學費|補習|補習班|文具|筆記本|考試|考照|多益|教材/i },
  { category: '購物', pattern: /買|衣服|服飾|鞋|包|uniqlo|net|zara|h&m|gu|網購|蝦皮|momo|pchome|淘寶|amazon|好市多|costco|無印良品|muji|宜得利|nitori|飾品|手錶|3c|筆電|手機|ipad|iphone|鍵盤|耳機/i },
  { category: '生活', pattern: /日常|生活|超市|全聯|家樂福|大潤發|愛買|屈臣氏|康是美|寶雅|ikea|特力屋|小北百貨|水電行|五金|燈泡|電池|洗髮精|沐浴乳|洗衣精|洗碗精|抹布|垃圾袋|打掃/i },
];

export const INCOME_LEXICON: Array<{ category: string; pattern: RegExp }> = [
  { category: '政府補貼', pattern: /補貼|補助|津貼|退稅|租金補貼|育兒津貼|托育補助|節能補助|生育補助/i },
  { category: '禮金餽贈', pattern: /紅包|壓歲錢|孝親費|親友給|長輩給|禮金|贈與/i },
  { category: '二手出清', pattern: /二手|出清|拍賣|旋轉拍賣|蝦皮賣家|二手衣|出清變現/i },
  { category: '薪資', pattern: /薪水|薪資|發薪|底薪|本薪|月薪/i },
  { category: '獎金', pattern: /獎金|年終|三節|紅利|分紅|績效/i },
  { category: '投資', pattern: /股息|利息|股票|基金|獲利|配息|etf|美股|證券/i },
  { category: '兼職', pattern: /兼職|副業|打工|接案|外快|鐘點|稿費/i },
];

export function buildHistoryMemo(transactions?: Array<{ note?: string; category?: string }>): Map<string, string> {
  const memo = new Map<string, string>();
  const SYSTEM_CATEGORIES = ['信用卡還款', '內部轉帳', 'ATM提款', '公帳代墊報銷'];
  if (!Array.isArray(transactions)) return memo;
  for (const t of transactions) {
    if (t && t.note && t.category && !SYSTEM_CATEGORIES.includes(t.category)) {
      const key = t.note.trim();
      if (key && !memo.has(key)) {
        memo.set(key, t.category);
      }
    }
  }
  return memo;
}

export function recommendCategory(
  note: string,
  type: 'expense' | 'income',
  historyMemo?: Map<string, string>
): CategoryRecommendation | null {
  if (!note || !note.trim()) return null;
  const trimmed = note.trim();
  const lower = trimmed.toLowerCase();

  // 1. 第一層：歷史習慣記憶 (Historical Note Memory)
  if (historyMemo) {
    if (historyMemo.has(trimmed)) {
      const cat = historyMemo.get(trimmed)!;
      if (CATEGORIES[type].includes(cat)) {
        return { category: cat, source: 'history' };
      }
    }
    for (const [histNote, cat] of Array.from(historyMemo.entries())) {
      if (histNote.length >= 2 && (lower.includes(histNote.toLowerCase()) || histNote.toLowerCase().includes(lower))) {
        if (CATEGORIES[type].includes(cat)) {
          return { category: cat, source: 'history' };
        }
      }
    }
  }

  // 2. 第二層：生活語意規則詞庫 (Lexicon Fallback)
  const rules = type === 'expense' ? EXPENSE_LEXICON : INCOME_LEXICON;
  for (const { category, pattern } of rules) {
    if (pattern.test(lower)) {
      return { category, source: 'lexicon' };
    }
  }

  return null;
}
