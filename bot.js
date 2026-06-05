/**
 * ╔══════════════════════════════════════════════════════════════╗
 *   BEKZOD HELP BOT  v5.0  —  Node.js + Express
 *   Muallif: Bekzod Baratov  |  @bekzod_stack
 *   v5.0 yangiliklari:
 *    - AI tizimi to'liq qayta yozildi (salomlashish muammosi hal)
 *    - Tezlashtirilgan API so'rovlar + timeout himoyasi
 *    - Parallel fakt yuklash (bot to'xtab qolmaydi)
 *    - Kuchaytirilgan Groq system prompt
 *    - Tartibli modulli kod strukturasi
 *    - Xatoliklarni ushlash yaxshilandi
 * ╚══════════════════════════════════════════════════════════════╝
 */

'use strict';

require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const express     = require('express');
const path        = require('path');
const fs          = require('fs');
const https       = require('https');
const http        = require('http');

// ════════════════════════════════════════════════════
//  §1. KONFIGURATSIYA
// ════════════════════════════════════════════════════
const CONFIG = {
  TOKEN:        process.env.TOKEN,
  ADMIN_ID:     parseInt(process.env.ADMIN_ID) || 7376786974,
  PORT:         process.env.PORT || 3000,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  GROQ_MODEL:   'llama-3.3-70b-versatile',   // tez va kuchli model
  GROQ_TIMEOUT: 20000,                        // 20s timeout
  API_TIMEOUT:  8000,                         // tashqi API timeout
  HISTORY_MAX:  20,                           // xabar tarixi chegarasi
  HISTORY_TTL:  24 * 60 * 60 * 1000,         // 24 soat (ms)
};

// ════════════════════════════════════════════════════
//  §2. HTTP YORDAMCHI FUNKSIYALAR
// ════════════════════════════════════════════════════

/** JSON qaytaruvchi GET so'rov */
function fetchJSON(url, timeoutMs = CONFIG.API_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: timeoutMs }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('JSON parse error')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

/** Matn qaytaruvchi GET so'rov */
function fetchText(url, timeoutMs = CONFIG.API_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: timeoutMs }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data.trim()));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

/** Xatolik yuqolmasin — null qaytaradi */
async function safeFetch(fn, fallback = null) {
  try { return await fn(); }
  catch { return fallback; }
}

// ════════════════════════════════════════════════════
//  §3. TARJIMA (MyMemory)
// ════════════════════════════════════════════════════

async function translateToUz(text) {
  if (!text || text.length < 5) return null;
  const encoded = encodeURIComponent(text.slice(0, 400));
  const url = `https://api.mymemory.translated.net/get?q=${encoded}&langpair=en|uz`;
  const data = await safeFetch(() => fetchJSON(url));
  const tr = data?.responseData?.translatedText || '';
  if (tr && tr.toLowerCase() !== text.toLowerCase() && tr.length > 3) return tr;
  return null;
}

async function translateAuto(text, from = 'en', to = 'uz') {
  const encoded = encodeURIComponent(text.slice(0, 400));
  const url = `https://api.mymemory.translated.net/get?q=${encoded}&langpair=${from}|${to}`;
  const data = await safeFetch(() => fetchJSON(url));
  return data?.responseData?.translatedText || null;
}

// ════════════════════════════════════════════════════
//  §4. FAKTLAR
// ════════════════════════════════════════════════════

const FACTS_STATIC = [
  '🔬 Inson tanasida taxminan 37 trillion hujayra bor.',
  '🧬 DNK ni cho\'zsangiz Yer va Quyosh orasini 600 martadan oshiq bosib o\'tadi.',
  '⚛️ Atom 99.9999999% bo\'sh joydan iborat.',
  '🌡️ Mutlaq nol harorat −273.15°C — bu eng past mumkin bo\'lgan harorat.',
  '🌙 Oy Yerdan har yili 3.8 sm uzoqlashib bormoqda.',
  '☀️ Quyoshning diametri Yernikidan 109 marta katta.',
  '🪐 Saturn shunchalik engil — katta dengizga tashlaganingizda suv ustida qolardi.',
  '🌌 Somon Yo\'li galaktikasida 200–400 milliard yulduz bor.',
  '🚀 Yorug\'lik bir soniyada 299,792 km yo\'l bosadi.',
  '🐘 Fil 10 km uzoqlikdagi suvni his qila oladi.',
  '🐬 Delfin uyquda miyasining faqat yarmi dam oladi, qolgan yarmi ishlaydi.',
  '🦋 Kapalaklar ta\'m bilishni oyoqlari orqali his qiladi.',
  '🐙 Ahtapotning uchta yuragi va ko\'k qoni bor.',
  '🐝 Asalari bir umrida atigi bir choy qoshiq asal ishlab chiqaradi.',
  '🌳 Amazon o\'rmonlari Yer kislorodining 20% ini ishlab chiqaradi.',
  '🌵 Kaktus 3 yil davomida suvsiz yashay oladi.',
  '🌺 Bambuk bir kunda 91 sm gacha o\'sishi mumkin.',
  '📜 Qog\'oz Xitoyda miloddan avvalgi 105-yilda ixtiro qilingan.',
  '💻 Birinchi kompyuter "bug\'i" — 1947-yilda topilgan haqiqiy kapalak.',
  '📱 Smartfonlar insoniyat tarixidagi eng tez tarqalgan texnologiya hisoblanadi.',
  '🇺🇿 O\'zbekiston Markaziy Osiyoning eng ko\'p aholiga ega davlati — 37 mln+.',
  '🕌 Registon maydoni dunyodagi eng chiroyli arxitektura ansamblllaridan biri.',
  '📖 Ibn Sino (Avicenna) — tibbiyotning "Otasi", X asrda yashagan o\'zbek olimi.',
  '🔭 Ulug\'bek XV asrda Samarqandda rasadxona qurgan va yulduzlar katalogini tuzgan.',
  '🎵 Musiqa inson miyasida til bilan bir xil hissiy jarayonlarni ishga tushiradi.',
  '😴 Odamlar umrining taxminan 1/3 qismini uxlab o\'tkazadi.',
  '👁️ Ko\'z 10 million xil rangni ajrata oladi.',
  '🧠 Miya atigi 20 vatt quvvatda ishlaydi — kichik LED chiroq kabi.',
  '😂 Kulish immunitetni kuchaytiradi va stress gormonini kamaytiradi.',
  '⚡ Chaqmoq 30,000°C gacha isiydi — Quyosh yuzasidan 5 marta issiq!',
  '🦁 Sher kuniga 18–20 soat uxlaydi.',
  '🦒 Jirafa tilining uzunligi 45 sm — u bilan o\'z quloqlarini yalaydi.',
  '🐊 Timsoh 200 million yildan beri deyarli o\'zgarmasdan qolgan.',
  '🐋 Ko\'k kit Yer tarixidagi eng yirik jonzot — 30 m uzun, 180 tonna.',
  '🌍 Amir Temur XIV asrda ulkan imperiya barpo etdi.',
  '🌾 O\'zbekiston paxta ishlab chiqarish bo\'yicha dunyoda 6-o\'rinda.',
  '🏛️ Rim imperiyasi avjida o\'sha davrning 21% aholi — 70 mln kishini boshqargan.',
  '🎭 Shekspir 1700 dan ortiq yangi inglizcha so\'z yaratgan.',
  '🦅 Burgut 3 km uzoqlikdagi nishonni ko\'ra oladi.',
  '🐬 Delfinlar bir-birini ism bilan chaqiradi — o\'ziga xos tovush bilan.',
];

/** API dan fakt olish — parallel urinish, birinchi muvaffaqiyatli qaytariladi */
async function getFactFromAPI() {
  const engines = [
    async () => {
      const d = await fetchJSON('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en', 6000);
      if (d?.text?.length > 10) return { text: d.text, emoji: '🌟', source: 'UselessFacts' };
      return null;
    },
    async () => {
      const n = Math.floor(Math.random() * 9999) + 1;
      const t = await fetchText(`http://numbersapi.com/${n}/trivia`, 6000);
      if (t && !t.includes('missing') && t.length > 15) return { text: t, emoji: '🔢', source: 'NumbersAPI' };
      return null;
    },
    async () => {
      const d = await fetchJSON('https://catfact.ninja/fact', 6000);
      if (d?.fact) return { text: d.fact, emoji: '🐱', source: 'CatFact' };
      return null;
    },
  ];

  // Tasodifiy tartibda, timeout bilan urinish
  const shuffled = [...engines].sort(() => Math.random() - 0.5);
  for (const fn of shuffled) {
    const result = await safeFetch(fn);
    if (result) return result;
  }

  // Statik fallback
  const t = FACTS_STATIC[Math.floor(Math.random() * FACTS_STATIC.length)];
  return { text: t, emoji: '🌟', source: 'local' };
}

/** Fakt + tarjima (parallel) */
async function getFactWithTranslation() {
  const { text, emoji, source } = await getFactFromAPI();
  let uz = null;

  if (source !== 'local' && /[a-zA-Z]{3,}/.test(text)) {
    uz = await safeFetch(() => translateToUz(text));
  }

  return { en: text, uz, emoji, source };
}

// ════════════════════════════════════════════════════
//  §5. OB-HAVO
// ════════════════════════════════════════════════════

async function getWeather(city) {
  const data = await safeFetch(() =>
    fetchJSON(`https://wttr.in/${encodeURIComponent(city)}?format=j1`)
  );
  const cur = data?.current_condition?.[0];
  if (!cur) return null;
  return {
    temp:     cur.temp_C,
    feels:    cur.FeelsLikeC,
    humidity: cur.humidity,
    wind:     cur.windspeedKmph,
    desc:     cur.weatherDesc?.[0]?.value || '',
  };
}

// ════════════════════════════════════════════════════
//  §6. VALYUTA
// ════════════════════════════════════════════════════

async function getCurrency(from, to, amount = 1) {
  const data = await safeFetch(() =>
    fetchJSON(`https://api.exchangerate-api.com/v4/latest/${from.toUpperCase()}`)
  );
  const rate = data?.rates?.[to.toUpperCase()];
  if (!rate) return null;
  return { from, to, amount, result: (rate * amount).toFixed(2), rate: rate.toFixed(4) };
}

// ════════════════════════════════════════════════════
//  §7. HAZILLAR
// ════════════════════════════════════════════════════

const JOKES_UZ = [
  '😄 Dasturchi nima uchun ko\'zoynak taqadi?\n\n😂 Chunki u C# (sharp — o\'tkir) ko\'ra olmaydi!',
  '😄 Python dasturlash tilida nima eng qo\'rqinchli?\n\n😂 Indentatsiya xatosi!',
  '😄 Kompyuter sovqatib qolsa nima qiladi?\n\n😂 Windows ni yopadi!',
  '😄 Nima uchun dasturchilar tunni sevadi?\n\n😂 Chunki bug\'lar (hasharotlar) tunida faol bo\'ladi!',
  '😄 Git commit xabari:\n\n😂 "fix bug" → "fix the fix" → "this should work" → "WHY???"',
  '😄 Programmist xotiniga: "Bozorga bor, 1 ta non ol. Tuxum bo\'lsa, 10 ta ol."\nXotin 10 ta non olib keldi.\n\n😂 Chunki tuxum bor edi!',
  '😄 Nima uchun dasturchilar botinka kiyishmaydi?\n\n😂 Chunki ular faqat loafer (dangasa) bo\'ladi!',
  '😄 Database so\'radi: "Nega yig\'layapsan?"\nSQL: "Chunki meni JOIN qilmayaptilar..." \n\n😂 LEFT JOIN qilishdi lekin RIGHT side yo\'q edi!',
];

async function getJoke() {
  const data = await safeFetch(() =>
    fetchJSON('https://v2.jokeapi.dev/joke/Any?blacklistFlags=nsfw,racist,sexist&type=twopart&lang=en', 5000)
  );
  if (data?.setup && data?.delivery) return `😄 ${data.setup}\n\n😂 ${data.delivery}`;
  if (data?.joke) return `😄 ${data.joke}`;
  return JOKES_UZ[Math.floor(Math.random() * JOKES_UZ.length)];
}

// ════════════════════════════════════════════════════
//  §8. MOTIVATSIYA
// ════════════════════════════════════════════════════

const QUOTES_UZ = [
  { quote: 'Har bir katta muvaffaqiyat kichik qadamlardan boshlanadi.', author: 'Bekzod Baratov' },
  { quote: 'Bilim — kuch. O\'rganishni to\'xtatma.', author: 'Aristotel' },
  { quote: 'Muvaffaqiyat — bu tasodif emas. Bu qat\'iyat, mehnat va o\'rganish natijasidir.', author: 'Colin Powell' },
  { quote: 'Bugun yaxshi boshlang, ertaga emas.', author: 'Mark Twain' },
  { quote: 'Eng uzun safar ham bitta qadam bilan boshlanadi.', author: 'Lao Tzu' },
  { quote: 'O\'zingga ishon — bu muvaffaqiyatning birinchi siri.', author: 'Ralph Waldo Emerson' },
  { quote: 'Qiyin yo\'l oson hayotga olib boradi.', author: 'Zig Ziglar' },
];

async function getQuote() {
  const data = await safeFetch(() =>
    fetchJSON('https://zenquotes.io/api/random', 5000)
  );
  if (data?.[0]?.q && data[0]?.a) return { quote: data[0].q, author: data[0].a };
  return QUOTES_UZ[Math.floor(Math.random() * QUOTES_UZ.length)];
}

// ════════════════════════════════════════════════════
//  §9. GROQ AI — KUCHAYTIRILGAN
// ════════════════════════════════════════════════════
const SYSTEM_PROMPT = `
Sen Bekzod Baratovning shaxsiy AI yordamchi botisan.

━━━ BEKZOD HAQIDA ━━━
- Ism: Bekzod Baratov
- Yosh: 18, Toshkent
- Kasb: Full-stack dasturchi (JavaScript, Node.js, React, Python, HTML/CSS)
- Telegram: @bekzod_stack
- Kelajak maqsad: Meta (Facebook) kompaniyasida muhandis bo'lib ishlash — chin dildan
- Qiziqishlar: AI/Telegram botlar, Game dev, kino/serial, voleybol

━━━ LOYIHALAR ━━━
- CosmoX Portfolio → cosmosx.onrender.com
- Do'kon Guzor Hozmak → do-kon-guzor-hozmak.vercel.app
- Country Info → country-information-bekzod-ten.vercel.app
- QR Generator → qr-code-bekzod-six.vercel.app
- KFC UZ Admin → kfc-uz-admin.vercel.app

━━━ SEVIMLI KINOLAR VA SERIALLAR ━━━
- Marvel: Avengers (eng sevimli), Guardians of the Galaxy, Captain America
  - Sevimli personajlar: Thor (1-chi o'rin), Captain America
- Game of Thrones — Jon Snow, Tyrion, Jaime Lannister
- Merlin (Afsungar) — kuchli nostalgiya bergan serial
- Yoqtirgan janrlar: fantastika, adventure, action, tarixiy/jang
  - Misol: Troya, Gladiator, Braveheart, 1917, Kingdom of Heaven
- Texnologiya/thriller: The Social Network, Inception, Interstellar, Matrix
- Yoqtirmaydi: DC olami (umuman)

━━━ SPORT ━━━
- Hozir: Voleybol — yaxshi darajada o'ynaydi
- Ilgari: Futbol (yoshligida faol o'ynagan)
- Kuzatadi: Formula 1, NBA

━━━ O'QISH VA VAQT ━━━
- Kunlik dars: ~7 soat (juft kunlari 10+ soat)
- Mustaqil o'qish: kuniga 3–4 soat
- Eng produktiv vaqt: Ertalab
- Haftalik umumiy: ~50+ soat

━━━ IELTS ━━━
- Maqsad: kamida 6.5 band
- Holat: yaqin orada topshiradi
- Ingliz tili: dasturlash va kino orqali mustaqil rivojlantirgan

━━━ ROL ━━━
Sen Bekzodning shaxsiy AI yordamchisisisan — aqlli, tez, ishonchli.
Chatbot emassan, yordamchi do'stsan.
Foydalanuvchiga aniq, qisqa va tushunarli javob berish — asosiy maqsading.

━━━ JAVOB USLUBI ━━━
- 2–5 gap ichida javob ber; murakkab mavzuda biroz uzunroq bo'lishi mumkin
- Oddiy, tabiiy, do'stona ohang — rasmiy emas
- Keraksiz kirish so'zlari yo'q ("Albatta!", "Zo'r savol!", "Keling...")
- Hazil — o'rinli bo'lsa, bir-ikki so'z, ortiqcha emas
- Faqat foydali, aniq ma'lumot ber

━━━ TELEGRAM MARKDOWN ━━━
- *matn* → bold
- _matn_ → italic
- \`kod\` → inline kod
- \`\`\`kod\`\`\` → kod bloki
- [matn](url) → havola

━━━ QOIDALAR ━━━
1. Har doim o'zbek tilida javob ber
2. Ingliz tiliga faqat foydalanuvchi aniq so'rasa o't
3. Hech qachon ortiqcha salomlashish bilan boshlama
4. Foydalanuvchi salom bersa — qisqa, tabiiy javob ber
5. Foydalanuvchi gapini takrorlama
6. "Sen kimsan?" → "Men Bekzodning shaxsiy AI yordamchisiman 🤖"
7. Shaxsiy ma'lumotlar haqida:
   ✅ Berishingmumkin: loyiha linklari, Telegram (@bekzod_stack), kasb, yosh
   ❌ Berma: yashash manzili, kundalik jadval, qayerda o'qishi,
      oilaviy ma'lumotlar, moliyaviy holat, do'stlar/tanishlar haqida
   ⚠️ Ehtiyotkorlik bilan: IELTS rejalari, kunlik vaqt jadvali —
      faqat maslahat so'ralsa ayt, o'z-o'zidan oshirma
8. Sog'liq haqida so'ralsa — umumiy tavsiya ber, kerak bo'lsa shifokorga murojaat qilishni ayt
9. Dasturlash, matematika, til, texnologiya, hayot maslahati — hammasiga yordam ber
10. "Men sun'iy intellektman, his-tuyg'um yo'q" kabi sovuq iboralar ishlatma

━━━ AQLLI XULQ-ATVOR ━━━
- Savol tushunarsiz bo'lsa — 1 ta qisqa aniqlashtiruvchi savol ber
- Foydalanuvchi xato tushunsa — muloyim, to'g'ri tushuntir
- Savol oddiy bo'lsa — cho'zma, to'g'ri javob ber
- Kod so'ralsa — ishlaydigan, toza kod yoz, kerak bo'lsa qisqacha izohla
- Ro'yxat kerak bo'lsa — raqamlangan yoki belgilangan ro'yxat ishlat
- Bitta savolga qarama-qarshi javob berma

━━━ CHEKLOVLAR ━━━
- Siyosat, din, millat haqida bahslashma
- Zararli, noqonuniy ma'lumot berma
- O'zingni ChatGPT, Gemini yoki boshqa bot deb ko'rsatma

━━━ MUHIM ━━━
Har doim foydalanuvchiga *real yordam* berishga fokus qil.
Sen — Bekzodning raqamli yordamchisi. Aqlli, tez, ishonchli.
`;
/** Groq AI ga so'rov */
async function askGroq(userText, chatId = null) {
  if (!CONFIG.GROQ_API_KEY) return { answer: null, error: 'GROQ_API_KEY topilmadi' };

  const history = chatId && userHistory[chatId]
    ? userHistory[chatId].slice(-CONFIG.HISTORY_MAX)
    : [];

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: userText },
  ];

  const body = JSON.stringify({
    model:       CONFIG.GROQ_MODEL,
    messages,
    max_tokens:  600,
    temperature: 0.6,
    top_p:       0.9,
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.groq.com',
      path:     '/openai/v1/chat/completions',
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Authorization':  `Bearer ${CONFIG.GROQ_API_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: CONFIG.GROQ_TIMEOUT,
      rejectUnauthorized: false,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json?.error) {
            const msg = json.error.message || JSON.stringify(json.error);
            console.error('❌ Groq xato:', msg.slice(0, 120));
            return resolve({ answer: null, error: msg.slice(0, 100) });
          }
          const raw = json?.choices?.[0]?.message?.content || null;
          const answer = raw ? raw.trim() : null;
          console.log('✅ Groq:', answer ? answer.slice(0, 80) : 'bo\'sh');

          // Tarixga qo'shish
          if (answer && chatId) {
            if (!userHistory[chatId]) userHistory[chatId] = [];
            userHistory[chatId].push({ role: 'user',      content: userText });
            userHistory[chatId].push({ role: 'assistant', content: answer  });
            // Haddan oshsa — eski xabarlarni o'chir (oxirgi N tasini saqlash)
            if (userHistory[chatId].length > CONFIG.HISTORY_MAX * 2) {
              userHistory[chatId] = userHistory[chatId].slice(-CONFIG.HISTORY_MAX);
            }
          }

          resolve({ answer: answer?.length > 2 ? answer : null, error: null });
        } catch (e) {
          console.error('❌ Groq parse xato:', e.message);
          resolve({ answer: null, error: `Parse xato` });
        }
      });
    });

    req.on('error', (e) => { console.error('❌ Groq ulanish:', e.message); resolve({ answer: null, error: e.message }); });
    req.on('timeout', () => { req.destroy(); resolve({ answer: null, error: 'Timeout (20s)' }); });
    req.write(body);
    req.end();
  });
}

// ════════════════════════════════════════════════════
//  §10. MAHALLIY AI (tez javoblar — API kerak emas)
// ════════════════════════════════════════════════════

/** Faqat sof salomlashish/xayrlashish/rahmat uchun tez javoblar */
const QUICK_RESPONSES = {
  greetings: [
    'Yaxshi, nima yordam kerak? 😊',
    'Nima haqida gaplashamiz? 😄',
    'Ha, quloq solaman! Savolingiz bormi?',
  ],
  farewell: [
    '👋 Xayr, sog\' bo\'ling! Ko\'rishguncha!',
    '✌️ Alvido! Muvaffaqiyatlar! 🌟',
    '👋 Xo\'sh! Yana keling!',
  ],
  thanks: [
    '😊 Arzimaydi! Yana murojaat qiling.',
    '🙏 Xizmat qilishdan mamnunman!',
    '✅ Har doim yordam berishga tayyorman!',
  ],
};

const QUICK_PATTERNS = [
  { re: /^(salom|assalom|assalomu alaykum|hi|hello|hey|привет|salom\s*bor)$/i, key: 'greetings' },
  { re: /^(xayr|bye|ko['']rishguncha|alvido|hosh|chao|goodbye)$/i,             key: 'farewell'  },
  { re: /^(rahmat|tashakkur|sog[''] bo['']l|merci|thank|thanks|спасибо)$/i,    key: 'thanks'    },
];

function quickReply(text) {
  const lower = text.toLowerCase().trim();
  for (const { re, key } of QUICK_PATTERNS) {
    if (re.test(lower)) {
      const arr = QUICK_RESPONSES[key];
      return arr[Math.floor(Math.random() * arr.length)];
    }
  }
  return null;
}

// ════════════════════════════════════════════════════
//  §11. MASLAHATLAR
// ════════════════════════════════════════════════════

const TIPS = {
  health: [
    '🏃 Kun davomida kamida 7,000 qadam yuring.',
    '💧 Har kuni kamida 8 stakan suv iching.',
    '😴 Har kecha 7–8 soat uxlang — miya to\'la ishlashi uchun shart.',
    '🥦 Har kuni meva va sabzavot iste\'mol qiling — immunitet uchun.',
    '🧘 Stressni kamaytirish uchun kuniga 10 daqiqa meditatsiya qiling.',
    '🚶 Lift o\'rniga zinapoyadan foydalaning — kichik odatlar katta o\'zgarish yaratadi.',
    '🌞 Ertalab quyosh nurida 10–15 daqiqa o\'tiring — D vitamini va kayfiyat uchun.',
    '🦷 Tishlarni faqat tozalab emas, til va milklarni ham tozalang — butun og\'iz salomatligi muhim.',
    '🫁 Har kuni 5 daqiqa chuqur nafas mashqi bajaring — qon bosimini pasaytiradi.',
    '🍽️ Ovqatni sekin va chaynab yeng — hazm yaxshi bo\'ladi, ortiqcha ovqat yemaysiz.',
    '🚭 Tamaki va alkogoldan uzoq turing — bu ikki narsa umrni qisqartiruvchi birinchi omillar.',
    '🧂 Tuzni kamaytiring — kunlik norma 5 gramm, ko\'pchilik 10–15 gramm iste\'mol qiladi.',
    '🫀 Haftada kamida 3 marta 30 daqiqa aerob mashq qiling — yurak sog\'ligi uchun.',
    '🩺 Yiliga bir marta to\'liq tibbiy tekshiruvdan o\'ting — kasallikni erta aniqlash hayot qutqaradi.',
    '🛁 Kech tunda issiq dush — tana haroratini pasaytiradi va uyquni chuqurlashtiradi.',
    '🧃 Suyuqlik faqat suv emas — mevali choy, sho\'rva, ko\'kat ham hisob.',
    '🏋️ Mushaklar uchun haftada 2 marta kuch mashqi qiling — metabolizmni tezlashtiradi.',
    '👁️ Har 20 daqiqada ekrandan ko\'z uzib, 20 soniya uzoqqa qarang — ko\'z charchog\'ini kamaytiradi.',
    '🧬 Ota-onangizda qanday kasalliklar bo\'lganini biling — genetik xavflarni oldindan kamaytirish mumkin.',
    '🌿 Uyga havorang o\'simlik qo\'ying — havo tozalanadi, ruh ko\'tariladi.',
  ],

  productivity: [
    '⏰ Eng muhim vazifani ertalab birinchi bajaring.',
    '📱 Telefonsiz 1 soat ishlash samaradorlikni 40% oshiradi.',
    '📝 Har kecha ertangi kunning rejasini tuzing.',
    '🎯 Bir vaqtda bitta vazifaga e\'tibor qarating — multitasking mif!',
    '⏳ Pomodoro texnikasi: 25 daqiqa ish, 5 daqiqa dam.',
    '📂 Har ishni boshlamasdan oldin ish joyingizni tartibga soling — tartibsiz muhit — tartibsiz fikr.',
    '🔕 Bildirishnomalarni o\'chiring — har bir signal e\'tiboringizni 23 daqiqaga buzadi.',
    '🗑️ "Kerak bo\'lar" degan narsalarni ertaga o\'ching — agar 6 oy ishlatmagan bo\'lsangiz, kerak emas.',
    '🌅 Tongda 30 daqiqa faqat o\'zingiz uchun ajrating — kun rejasini o\'ylab chiqing.',
    '📊 Har hafta shunday savol bering: "Bu hafta nima yaxshi bo\'ldi? Nima o\'zgartirishim kerak?"',
    '🔋 Energiya boshqaruvi vaqt boshqaruvidan muhimroq — zo\'riqsangiz, dam oling.',
    '✉️ Emailni faqat ikki marta ko\'ring — ertalab va tushdan keyin. Doimiy tekshirish vaqt o\'ldiradi.',
    '🧩 Katta vazifalarni kichik bo\'laklarga bo\'ling — "loyihani tugatish" emas, "birinchi bo\'limni yozing".',
    '🚫 "Yo\'q" deb aytishni o\'rganing — hamma narsaga rozi bo\'lish sizni eng muhim ishlardan uzadi.',
    '🎵 Instrumental musiqa ishlash vaqtida koncentratsiyani oshiradi — so\'zsiz musiqa tanlang.',
    '📅 Yilik, oylik va haftalik maqsadlaringizni yozma ravishda saqlang — ko\'rinmas maqsad yo\'qoladi.',
    '💼 Har kuni "uch asosiy natija" aniqlang — kech boshida shularni bajardingizmi, deb so\'rang.',
    '🔄 Takroriy ishlar uchun shablon yarating — har safar qaytadan ixtiro qilmang.',
    '🧠 Muhim qarorlarni ertalab qabul qiling — kech bo\'lganda irodangiz charchagan bo\'ladi.',
    '📵 Uyquga ketishdan 1 soat oldin telefonni yoqmang — bu vaqt kitob yoki fikrlash uchun.',
  ],

  learning: [
    '📚 Kitob o\'qish miyani kuchaytiradigan eng yaxshi mashq.',
    '🔄 Yangi narsani o\'rganing va uni birovga tushuntiring — eng yaxshi usul.',
    '✍️ Qo\'lda yozish — yodda saqlash uchun eng samarali usul.',
    '🎧 Podcast tinglash — piyoda yurganda ham o\'rganish mumkin.',
    '🌐 Har kuni 15 daqiqa ingliz tilida video ko\'ring.',
    '🧪 Nazariyani o\'qish bilan cheklanmang — hoziroq amaliyotda sinab ko\'ring.',
    '📖 Bitta kitobni boshlamay turib ikkinchisini ochmang — chuqurlik kenglikdan qimmatroq.',
    '🗂️ O\'qigan narsalaringizni qaydlar sistemasiga saqlang — Notion, Obsidian yoki oddiy daftar.',
    '🎯 O\'rganish maqsadini aniq qo\'ying: "ingliz tilini o\'rganaman" emas, "3 oyda B2 darajaga chiqaman".',
    '👨‍🏫 Mentor toping — to\'g\'ri yo\'l ko\'rsatuvchi odam o\'n yilni uch yilga aylantiradi.',
    '🔁 Spaced repetition (takroriy takrorlash) usulidan foydalaning — Anki ilovasini sinab ko\'ring.',
    '🎮 Gamifikatsiya qiling — Duolingo, Khan Academy kabi platformalar o\'rganishni o\'yinga aylantiradi.',
    '🤔 "Feynman texnikasi": tushunmagan narsangizni bola tushunganday sodda tushuntirishga harakat qiling.',
    '🌍 Tilni o\'rganish uchun tanishlar toping — real suhbat hech qanday darslikdan yaxshiroq.',
    '📰 Kunlik yangilikni ingliz tilida o\'qing — tilni ham o\'rganasiz, dunyo yangiligidan xabardor ham bo\'lasiz.',
    '💻 Dasturlashni o\'rganmoqchimisiz? Bitta loyiha qurishni maqsad qiling — tutorial emas.',
    '🧘 O\'rganishdan oldin 5 daqiqa dam oling — tinch miya yangi ma\'lumotni yaxshiroq qabul qiladi.',
    '📊 Har hafta o\'zingizni sinab ko\'ring — test qilish yodlashdan ko\'ra ko\'proq narsani yoddartiradi.',
    '🌱 "O\'sish mentaliteti" — iste\'dod tug\'ma emas, mehnat va mashq bilan rivojlanadi.',
    '🎤 Notiq bo\'lishni o\'rganing — o\'z fikrini bayon eta olish barcha sohalarda ustunlik beradi.',
  ],

  success: [
    '💪 Harakat qilmasdan natija kutma.',
    '🌱 Har kuni 1% yaxshilanish — yil oxirida 37 marta o\'sish!',
    '💡 Xato qilishdan qo\'rqma — bu tajriba.',
    '🤝 Muhim kishilarga vaqt ajrating — ular hammadan qimmat.',
    '⭐ Minnatdorchilik daftari yurit — har kuni 3 ta yaxshilik yoz.',
    '🏆 Muvaffaqiyat odatlardan iborat — har bir katta natija kichik kundalik harakatlarning yig\'indisi.',
    '🔥 Ishtiyoqingizni toping — agar ishingizni yaxshi ko\'rsangiz, raqobatchilaringiz tunamaydi, siz tunyasiz.',
    '🧭 Qadriyatlaringizni aniqlang — kimligingizni bilgan odam nima qilishini biladi.',
    '📣 O\'zingizni taqdim eta oling — eng yaxshi mahsulot ham reklama bo\'lmasa sotilmaydi.',
    '🌊 Muvaffaqiyatsizlik — bu oxir emas, istiqomatlilikning imtihoni.',
    '💰 Daromadingizning 20%ini tejaing — boylik sarflamasdan qolgan puldan, emas ishlagan puldan boshlanadi.',
    '🤲 Boshqalarga yordam bering — bu dunyo g\'alati: ko\'proq bersangiz, ko\'proq qaytadi.',
    '🔗 Tarmoq (network) quring — bilim va pul yashaydi, ammo to\'g\'ri odamlar bilan aloqa o\'zgartirilmas kuch.',
    '📌 Maqsadlaringizni ko\'rinadigan joyga yozing — ko\'z o\'ngida bo\'lgan narsa ongda qoladi.',
    '🎭 Muammolarni muammo sifatida emas, vazifa sifatida ko\'ring — bu kichik o\'zgarish katta farq yaratadi.',
    '🕰️ Vaqtni narxlang — "bepul" o\'tkazilgan har bir soat aslida narxli.',
    '🧱 Disiplin erkinlikdan kuchli — o\'zingizni boshqara olgan odam hamma narsani boshqara oladi.',
    '🌟 Taqqoslashni bas qiling — siz o\'zingizning yillar avvalgi versiyangiz bilan raqobatdashingsiz.',
    '📢 Yutuqlaringizni nishonlang — kichik g\'alabalar ham e\'tirofga loyiq, bu davom etish kuchini beradi.',
    '🚀 Hozir boshlang — "tayyor bo\'lgandan keyin" degan kun hech qachon kelmaydi.',
  ],

  mindset: [
    '🧠 Fikrlaringiz taqdiringsizdir — salbiy fikrni e\'tirof eting, lekin unga ishonmang.',
    '☀️ Har ertalab o\'zingizga: "Bugun ajoyib kun bo\'ladi" — deng va bunga ishoning.',
    '🪞 O\'zingizga shafqatli bo\'ling — o\'zingizni eng yaqin do\'stingizga muomala qilganday muomala qiling.',
    '🌈 Optimizm — bu soddagarlik emas, kelajakka ishonchli tayyorgarlik.',
    '🎋 Qattiq daraxt shamolda sinadi, moslashuvchan qamish esa egilib saqlanadi — hayotda ham shunday.',
    '🔍 Muammo ichida imkoniyat qidiring — ikki kishi bir xil vaziyatda turli narsani ko\'radi.',
    '🫂 Yolg\'izlik va yolg\'iz qolish farqlari bor — birinchisi og\'riq, ikkinchisi kuch manbai.',
    '💭 O\'z ichki dialogingizga e\'tibor bering — o\'zingiz o\'zingizga qanday gapiraysiz?',
    '🌓 Qarama-qarshiliklarni qabul qiling — hayot ikki rangli emas, minglab tusli.',
    '🏔️ Cho\'qqi muhim emas, yo\'l muhim — jarayon natijadan ko\'ra ko\'proq narsa o\'rgatadi.',
    '🔓 Qo\'rquvga qaramay harakat qiling — jasorat qo\'rqmaslik emas, qo\'rqib ham oldinga yurish.',
    '🌺 Hozirgi lahzada yashang — o\'tmish o\'tdi, kelajak kelmadi, faqat "hozir" mavjud.',
    '🧩 Barcha his-tuyg\'ular ma\'lumot — g\'azab, qayg\'u, qo\'rquv — hammasi sizga biror narsa aytmoqchi.',
    '🕊️ Kechirish — bu boshqa kishi uchun emas, o\'zingiz uchun. Kinani tashlab, ozod bo\'ling.',
    '📡 E\'tiboringiz — bu hayotingizning yo\'nalishi. Nimaga qarasangiz, shu tomonga o\'sasiz.',
  ],

  relationships: [
    '👂 Tinglovchi bo\'ling — odamlar so\'zlashuvchi emas, haqiqiy tinglovchini izlashadi.',
    '💌 Yaqinlaringizga "seni sevinchim uchun sevaman" emas, "senga shunchaki qo\'ng\'iroq qildim" deya murojaat qiling.',
    '🤜 Do\'stlikni saqlab turish uchun ham aktiv harakat kerak — munosabatlar o\'z-o\'zidan o\'smaydi.',
    '🎁 Sovg\'a buyum bo\'lmasin — vaqt, e\'tibor, yordam — bular haqiqiy sovg\'a.',
    '🚦 Munosabatlardagi qizil bayroqlarni e\'tiborsiz qoldirmang — kichik muammolar katta kasalliklarga aylanadi.',
    '🗣️ Nizolarda "sen doim…" emas, "men … his qilyapman" deb gapiring — ayblov emas, tuyg\'u ifodalash.',
    '🌉 Ko\'prik qurishni bilgan odam devor qurishni bilgandan ko\'ra uzoqqa boradi.',
    '💑 Romntik munosabatda ham do\'stlik asosi bo\'lishi kerak — ehtiroslar so\'nadi, do\'stlik qoladi.',
    '👨‍👩‍👧 Oilaga vaqt ajrating — karyera muvaffaqiyati yolg\'iz kechgan kecha bilan to\'lanmaydi.',
    '🌐 Turli yoshdagi, turli sohadagi odamlar bilan muloqot qiling — perspektiva kengayadi.',
  ],

  finance: [
    '💵 Daromad olmagan narsaga qarz olmang — qarz yashash uchun emas, investitsiya uchun.',
    '📈 Foiz bilan ishlaydigan investitsiyani erta boshlang — vaqt sizning eng kuchli ittifoqchingiz.',
    '🏦 Favqulodda fond yarating — kamida 3–6 oylik xarajatlarni tejab qo\'ying.',
    '🧾 Har oylik xarajatlaringizni kategoriyalarga bo\'ling — nima uchun pul ketishini bilmasangiz, boshqara olmaysiz.',
    '🛒 Xariddan oldin 24 soat kuting — impulsiv xaridlarning 80% bu vaqtda o\'z-o\'zidan bekor bo\'ladi.',
    '📉 Inflyatsiya pul qadrini yildan-yilga pasaytiradi — naqd pul emas, aktiv saqlang.',
    '💡 Daromad manbalarini ko\'paytiring — bir manbali daromad zaif, uch manbali daromad barqaror.',
    '🎓 O\'zingizga investitsiya qiling — ko\'nikmaga qilingan xarajat bir umr qaytadi.',
    '🔄 Avtomatik tejashni o\'rnating — maosh tushganda avtomatik ravishda tejarlik hisobga o\'tsin.',
    '📊 Soliq, sug\'urta va pensiya haqida o\'rganing — bu bilimlar ming dollarlab pul tejatadi.',
  ],

  habits: [
    '🌄 Ertalabki muhim odatlarni birinchi yarim soatga joylashtiring — iroda kechqurun tugaydi.',
    '🔗 Yangi odatni mavjud odatga "bog\'lang" — "Qahva ichgandan keyin 5 daqiqa kitob o\'qiyman".',
    '📏 Odat kichikroq bo\'lsa, boshlash osonroq — 2 daqiqalik versiyadan boshlang.',
    '🗓️ 21 kun mif — odat o\'rnatish o\'rtacha 66 kun oladi. Sabrli bo\'ling.',
    '📓 Odat kuzatgich yurit — ko\'rish va belgilash motivatsiyani kuchaytiradi.',
    '🔁 Odat buzilsa, keyingi kuni qaytib boshlang — ikki kun ketma-ket o\'tkazib yubormaslik qoidasi.',
    '🌙 Kechki routine yarating — ertangi kun ertalab emas, kecha boshlanadi.',
    '🏆 Kichik g\'alabalarni nishonlang — miya mukofot ko\'rsa, odatni mustahkamlaydi.',
    '🌀 Yomon odatni yo\'qotmoqchisiz? Uni boshqa narsa bilan almashtiring — bo\'shliqni to\'ldirmagan odat qaytadi.',
    '⚡ Muhit dizaynlang — yaxshi odatni oson, yomon odatni qiyin qiling (masalan, telefonni boshqa xonaga qo\'ying).',
  ],
};

const TIP_EMOJI = { health: '🏃 Sog\'liq', productivity: '⚡ Samaradorlik', learning: '📚 O\'rganish', success: '🌟 Muvaffaqiyat' , mindset: '🧠 Tafakkur' , relationships: '👥 Munosabat' , finance: '💸 Daromad' , habits: '🗓️ Odatlar'};

let lastTip = null;
let usedTips = [];
let startTime = Date.now();

function getRandomTip(category = null) {
  const ONE_HOUR = 60 * 60 * 1000;

  // 1 soat o‘tsa reset qilamiz
  if (Date.now() - startTime > ONE_HOUR) {
    usedTips = [];
    lastTip = null;
    startTime = Date.now();
  }

  const cats = Object.keys(TIPS);
  const cat = (category && TIPS[category])
    ? category
    : cats[Math.floor(Math.random() * cats.length)];

  const tips = TIPS[cat];

  let tip;

  do {
    tip = tips[Math.floor(Math.random() * tips.length)];
  } while ((tip === lastTip || usedTips.includes(tip)) && tips.length > 1);

  lastTip = tip;
  usedTips.push(tip);

  return `${TIP_EMOJI[cat]} *Maslahat:*\n\n${tip}`;
}

// ════════════════════════════════════════════════════
//  §12. VIKTORINA
// ════════════════════════════════════════════════════

const QUIZ = [
  { q: "O'zbekiston mustaqilligini qaysi yilda e'lon qildi?",      opts: ['1991','1990','1992','1989'],                                    c: 0 },
  { q: 'Python dasturlash tili kimlar tomonidan yaratilgan?',       opts: ['Guido van Rossum','Linus Torvalds','Bill Gates','James Gosling'], c: 0 },
  { q: 'Dunyo bo\'yicha eng ko\'p ishlatiladigan ijtimoiy tarmoq?', opts: ['Instagram','TikTok','Facebook','Twitter'],                       c: 2 },
  { q: 'HTML nima uchun ishlatiladi?',                              opts: ['Ma\'lumotlar bazasi','Animatsiya','Web sahifalar','Mobil ilova'], c: 2 },
  { q: 'Samarqand — qaysi davlatning shahri?',                      opts: ['Tojikiston','Qozog\'iston','Afgʻoniston','O\'zbekiston'],        c: 3 },
  { q: 'Node.js qaysi tilda yozilgan?',                             opts: ['Python','Java','C++','JavaScript'],                              c: 3 },
  { q: 'Quyosh sistemasida nechta sayyora bor?',                    opts: ['7','8','9','10'],                                               c: 1 },
  { q: 'IELTS da maksimal ball nechta?',                            opts: ['8','9','10','100'],                                             c: 1 },
  { q: 'Yer yuzida eng ko\'p so\'zlanadigan til?',                   opts: ['Ingliz','Ispan','Xitoy (Mandarin)','Arab'],                      c: 2 },
  { q: 'CPU nima degan ma\'noni anglatadi?',                         opts: ['Central Processing Unit','Computer Power Unit','Central Power Update','Core Processing Unit'], c: 0 },
  { q: 'GitHub qaysi kompaniyaga tegishli?',                        opts: ['Google','Apple','Microsoft','Amazon'],                          c: 2 },
  { q: 'Toshkent O\'zbekistonning nimasi?',                          opts: ['Poytaxti','Eng katta shahri','Ikkalasi ham','Iqtisodiy markazi'], c: 2 },
  { q: 'JavaScript qaysi yilda yaratilgan?',                        opts: ['1990','1995','2000','2005'],                                    c: 1 },
  { q: 'Eng mashhur versiya nazorat tizimi?',                       opts: ['SVN','Git','Mercurial','CVS'],                                  c: 1 },
  { q: 'Ibn Sino qaysi sohada mashhur?',                            opts: ['Matematika','Astronomiya','Tibbiyot','Falsafa'],                 c: 2 },
  { q: 'React qaysi kompaniya tomonidan yaratilgan?',               opts: ['Google','Meta (Facebook)','Microsoft','Twitter'],               c: 1 },
  { q: 'WWW (World Wide Web) ni kim yaratgan?',                     opts: ['Bill Gates','Steve Jobs','Tim Berners-Lee','Linus Torvalds'],   c: 2 },
  { q: 'Birinchi iPhone qaysi yilda chiqdi?',                       opts: ['2005','2006','2007','2008'],                                    c: 2 },
];

// ════════════════════════════════════════════════════
//  §13. BMI HISOBLAGICH
// ════════════════════════════════════════════════════

function calcBMI(weight, height) {
  const h = height / 100;
  const bmi = (weight / (h * h)).toFixed(1);
  let cat, advice;
  if      (bmi < 18.5) { cat = '⚠️ Tana og\'irligi kam (Underweight)';   advice = '• Ko\'proq kaloriya iste\'mol qiling\n• Protein ko\'p ovqat yeng\n• Shifokor bilan maslahatlashing'; }
  else if (bmi < 25)   { cat = '✅ Normal (Healthy)';                      advice = '• Sog\'lom ovqatlanishni davom ettiring\n• Muntazam sport qiling\n• Zo\'r ishlapsiz! 💪'; }
  else if (bmi < 30)   { cat = '⚠️ Ortiqcha vazn (Overweight)';           advice = '• Qand va yog\'li ovqatni kamaytiring\n• Kuniga 30 daqiqa yuring\n• Ko\'proq suv iching'; }
  else                 { cat = '❌ Semizlik (Obese)';                       advice = '• Shifokor bilan zudlik bilan maslahatlashing\n• Parhez tutishni boshlang\n• Muntazam jismoniy faoliyat'; }

  return `📊 *BMI Natija*\n\n⚖️ Vazn: *${weight} kg*\n📏 Bo'y: *${height} sm*\nBMI: *${bmi}*\n\nHolat: ${cat}\n\n💡 *Maslahat:*\n${advice}`;
}

function calcIdealWeight(height, gender) {
  const ideal = gender === 'erkak'
    ? ((height - 100) * 0.9).toFixed(1)
    : ((height - 100) * 0.85).toFixed(1);
  return `💪 *Ideal vazn*\n\n📏 Bo'y: *${height} sm*\n👤 Jins: *${gender}*\n\n✅ Ideal vazn: *${ideal} kg* (taxminiy)\n\n_Har bir inson tanasi boshqacha. Bu faqat taxmin._`;
}

// ════════════════════════════════════════════════════
//  §14. LOYIHALAR VA PDF
// ════════════════════════════════════════════════════

const PROJECTS = [
  { name: '🌐 CosmoX — Shaxsiy Portfolio',  url: 'https://cosmosx.onrender.com/' },
  { name: '🛒 Do\'kon Guzor Hozmak',          url: 'https://do-kon-guzor-hozmak.vercel.app/' },
  { name: '🌍 Country Information',          url: 'https://country-information-bekzod-ten.vercel.app/' },
  { name: '📲 QR Code Generator',            url: 'https://qr-code-bekzod-six.vercel.app/' },
  { name: '🍗 KFC UZ Admin Panel',           url: 'https://kfc-uz-admin.vercel.app/' },
];

const PDF_DIR = path.join(__dirname, 'pdfs');
const PDFS = {
  vocab:    { file: path.join(PDF_DIR, 'ielts_vocabulary.pdf'),  caption: '📚 *IELTS Vocabulary* — Sinonimlar va tarjimalar (Adjectives, Verbs, Nouns)' },
  grammar:  { file: path.join(PDF_DIR, 'grammar_guide.pdf'),     caption: '📖 *Grammar Guide* — If Conditions (0–3+Mix) • Modals • Being+V3' },
  speaking: { file: path.join(PDF_DIR, 'speaking_phrases.pdf'),  caption: '🎤 *IELTS Speaking* — Band 7–9 iboralar, esda qolarli jumlalar' },
};

// ════════════════════════════════════════════════════
//  §15. BOT VA EXPRESS SOZLASH
// ════════════════════════════════════════════════════

const bot = new TelegramBot(CONFIG.TOKEN, {
  polling: { interval: 300, autoStart: true, params: { timeout: 10 } },
});
bot.on('polling_error', (err) => console.warn('⚠️ Polling:', err.code, err.message?.slice(0, 60)));

const app = express();
app.use(express.json());

// ════════════════════════════════════════════════════
//  §16. STATE VA STATISTIKA
// ════════════════════════════════════════════════════

const userState   = {};
const ratings     = {};
const stats       = { messages: 0, users: new Set(), apiCalls: 0 };
let   userHistory = {};

// Har 24 soatda tarixi tozalash
setInterval(() => {
  userHistory = {};
  console.log('🧹 Suhbat tarixi tozalandi (24h)');
}, CONFIG.HISTORY_TTL);

// ════════════════════════════════════════════════════
//  §17. KLAVIATURALAR
// ════════════════════════════════════════════════════

const MAIN_KB = {
  reply_markup: {
    keyboard: [
      [{ text: '📁 Loyihalarim' },        { text: '📚 IELTS So\'zlar' }],
      [{ text: '🐍 Python Darslar' },     { text: '🧮 Matematika' }],
      [{ text: '🌟 Qiziqarli Faktlar' },  { text: '💡 Hayotiy Maslahatlar' }],
      [{ text: '🎬 Marvel Kinolar' },     { text: '🎮 O\'yinlar' }],
      [{ text: '😂 Hazillar' },           { text: '💪 Motivatsiya' }],
      [{ text: '🌤 Ob-havo' },            { text: '💱 Valyuta Kursi' }],
      [{ text: '✉️ Adminga Savol' },      { text: '⭐ Botni Baholash' }],
      [{ text: 'ℹ️ Bot Haqida' },         { text: '📊 Statistika' }],
      [{ text: '🔢 BMI Hisoblash' },      { text: '🌐 Tarjimon' }],
      [{ text: '🎲 Tasodifiy Tanlov' },   { text: '🎨 Rasm Yaratish' }],
      [{ text: '🎵 Musiqa Topish' },      { text: '🔍 Qidirish' }],
    ],
    resize_keyboard: true,
  },
};

const NO_KB = { reply_markup: { remove_keyboard: true } };

// ════════════════════════════════════════════════════
//  §18. YORDAMCHI FUNKSIYALAR
// ════════════════════════════════════════════════════

function md(chatId, text, extra = {}) {
  return bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...extra }).catch(e => {
    // Markdown parse xatosi bo'lsa oddiy matn yuboramiz
    if (e.code === 'ETELEGRAM') {
      return bot.sendMessage(chatId, text.replace(/[*_`]/g, ''), extra).catch(() => {});
    }
  });
}

function typing(chatId) {
  return bot.sendChatAction(chatId, 'typing').catch(() => {});
}

function sendPDF(chatId, key) {
  const p = PDFS[key];
  if (!p || !fs.existsSync(p.file)) {
    return md(chatId, '⚠️ PDF fayli topilmadi. Admin bilan bog\'laning.', MAIN_KB);
  }
  return bot.sendDocument(chatId, p.file, { caption: p.caption, parse_mode: 'Markdown' }).catch(() =>
    md(chatId, '❌ PDF yuborib bo\'lmadi.', MAIN_KB)
  );
}

// ════════════════════════════════════════════════════
//  §19. /start VA /help
// ════════════════════════════════════════════════════

bot.onText(/\/start/, (msg) => {
  const name = msg.from.first_name || 'Do\'stim';
  userState[msg.chat.id] = null;
  stats.users.add(msg.from.id);
  md(msg.chat.id,
    `🤖 *Assalomu alaykum, ${name}!*\n\n` +
    `Men *Bekzod Help Bot v5.0* — sizga yordam berish uchun yaratilganman!\n\n` +
    `👨‍💻 *Yaratuvchi:* Bekzod Baratov (@bekzod_stack)\n\n` +
    `⚡ *Imkoniyatlar:*\n` +
    `• 🤖 Kuchaytirilgan AI suhbat (har qanday savol)\n` +
    `• 🌍 Real-time faktlar + o'zbek tarjima\n` +
    `• 🌤 Ob-havo (istalgan shahar)\n` +
    `• 💱 Valyuta kurslari (real-vaqt)\n` +
    `• 😂 Hazillar va 💪 Motivatsiya\n` +
    `• 📁 5 ta loyiha | 📚 3 ta IELTS PDF\n` +
    `• 🎮 3 ta o'yin | 🔢 BMI hisoblagich\n` +
    `• 🎨 Rasm yaratish | 🌐 Tarjimon\n\n` +
    `📌 Menyudan tanlang yoki shunchay yozing ⬇️`,
    MAIN_KB
  );
});

bot.onText(/\/help/, (msg) => {
  md(msg.chat.id,
    `📋 *Buyruqlar:*\n\n` +
    `/start — Botni qayta ishga tushirish\n` +
    `/fact — Tasodifiy fakt\n` +
    `/joke — Hazil\n` +
    `/quote — Motivatsiya iqtibosi\n` +
    `/weather [shahar] — Ob-havo\n` +
    `/currency [FROM] [TO] — Valyuta\n` +
    `/bmi — BMI hisoblash\n` +
    `/tip — Hayotiy maslahat\n` +
    `/quiz — Viktorina\n` +
    `/stats — Statistika (admin)`,
    MAIN_KB
  );
});

// ════════════════════════════════════════════════════
//  §20. SLASH BUYRUQLARI
// ════════════════════════════════════════════════════

bot.onText(/\/fact/, async (msg) => {
  await typing(msg.chat.id);
  // Bot to'xtab qolmasligi uchun timeout bilan parallel yuklash
  const timeoutPromise = new Promise(res => setTimeout(() => res(null), 7000));
  const factPromise = getFactWithTranslation();
  const result = await Promise.race([factPromise, timeoutPromise]);

  stats.apiCalls++;
  if (!result) {
    const t = FACTS_STATIC[Math.floor(Math.random() * FACTS_STATIC.length)];
    return md(msg.chat.id, `🌟 *Qiziqarli Fakt:*\n\n${t}`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '🔄 Yana bir fakt', callback_data: 'fact_api' }]] },
    });
  }

  const { en, uz, emoji, source } = result;
  const sourceLabel = source !== 'local' ? `\n\n_Manba: ${source}_` : '';
  const text = uz
    ? `${emoji} *Qiziqarli Fakt:*\n\n🇬🇧 _${en}_\n\n🇺🇿 *${uz}*${sourceLabel}`
    : `${emoji} *Qiziqarli Fakt:*\n\n${en}${sourceLabel}`;
  return md(msg.chat.id, text, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [[{ text: '🔄 Yana bir fakt', callback_data: 'fact_api' }]] },
  });
});

bot.onText(/\/joke/, async (msg) => {
  await typing(msg.chat.id);
  const joke = await getJoke();
  stats.apiCalls++;
  md(msg.chat.id, joke, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [[{ text: '😂 Yana hazil', callback_data: 'joke_api' }]] },
  });
});

bot.onText(/\/quote/, async (msg) => {
  await typing(msg.chat.id);
  const { quote, author } = await getQuote();
  stats.apiCalls++;
  md(msg.chat.id, `💪 *Motivatsiya:*\n\n_"${quote}"_\n\n— *${author}*`, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [[{ text: '🔄 Yana iqtibos', callback_data: 'quote_api' }]] },
  });
});

bot.onText(/\/weather (.+)/, async (msg, match) => {
  await typing(msg.chat.id);
  const city = match[1].trim();
  const w = await getWeather(city);
  stats.apiCalls++;
  if (!w) return md(msg.chat.id, `❌ *${city}* uchun ob-havo topilmadi.\n\nInglizchalab yozing: \`/weather Tashkent\``, MAIN_KB);
  md(msg.chat.id,
    `🌤 *${city} ob-havosi:*\n\n🌡 Harorat: *${w.temp}°C* (his qilinishi: ${w.feels}°C)\n💧 Namlik: *${w.humidity}%*\n💨 Shamol: *${w.wind} km/h*\n☁️ Holat: *${w.desc}*`,
    MAIN_KB
  );
});

bot.onText(/\/currency (.+)/, async (msg, match) => {
  await typing(msg.chat.id);
  const parts = match[1].toUpperCase().split(/\s+/);
  const [from = 'USD', to = 'UZS'] = parts;
  const amount = parseFloat(parts[2]) || 1;
  const res = await getCurrency(from, to, amount);
  stats.apiCalls++;
  if (!res) return md(msg.chat.id, '❌ Valyuta topilmadi. Misol: `/currency USD UZS 100`', MAIN_KB);
  md(msg.chat.id,
    `💱 *Valyuta Kursi:*\n\n${amount} *${from}* = *${res.result} ${to}*\n📈 Kurs: 1 ${from} = ${res.rate} ${to}`,
    MAIN_KB
  );
});

bot.onText(/\/bmi/, (msg) => {
  userState[msg.chat.id] = { mode: 'bmi_weight' };
  md(msg.chat.id, '⚖️ *BMI Hisoblagich*\n\nVazningizni kiriting (kg, masalan: 70):', NO_KB);
});

bot.onText(/\/tip/, (msg) => {
  md(msg.chat.id, getRandomTip(), {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🏃 Sog\'liq', callback_data: 'tip_health' }, { text: '⚡ Samaradorlik', callback_data: 'tip_productivity' }],
        [{ text: '📚 O\'rganish', callback_data: 'tip_learning' }, { text: '🌟 Muvaffaqiyat', callback_data: 'tip_success' }],
        [{ text: '🧠 Tafakkur', callback_data: 'tip_mindset' }, { text: '👥 Munosabat', callback_data: 'tip_relationships' }],
        [{ text: '💸 Moliya', callback_data: 'tip_finance' }, { text: '🗓️ Odatlar', callback_data: 'tip_habits' }],
      ],
    },
  });
});

bot.onText(/\/quiz/, (msg) => startQuiz(msg.chat.id));

bot.onText(/\/stats/, (msg) => {
  if (msg.from.id !== CONFIG.ADMIN_ID) return md(msg.chat.id, '❌ Ruxsat yo\'q.', MAIN_KB);
  showAdminStats(msg.chat.id);
});

bot.onText(/\/reply (\d+) (.+)/, async (msg, match) => {
  if (msg.from.id !== CONFIG.ADMIN_ID) return;
  try {
    await md(parseInt(match[1]), `📨 *Admin javobi:*\n\n${match[2]}`, MAIN_KB);
    md(msg.chat.id, '✅ Javob yuborildi!');
  } catch { md(msg.chat.id, '❌ Yuborib bo\'lmadi.'); }
});

// ════════════════════════════════════════════════════
//  §21. YORDAMCHI FUNKSIYALAR (menu)
// ════════════════════════════════════════════════════

function startQuiz(chatId) {
  const questions = [...QUIZ].sort(() => Math.random() - 0.5).slice(0, 8);
  userState[chatId] = { mode: 'quiz', questions, qIndex: 0, score: 0 };
  sendQuizQuestion(chatId);
}

function sendQuizQuestion(chatId) {
  const st = userState[chatId];
  if (!st || st.mode !== 'quiz') return;
  const q = st.questions[st.qIndex];
  const total = st.questions.length;
  md(chatId,
    `🧠 *Viktorina!* (${st.qIndex + 1}/${total})\n\n📝 ${q.q}\n\n` +
    q.opts.map((o, i) => `${i + 1}. ${o}`).join('\n') +
    '\n\n_Raqamni yozing (1–4)_'
  );
}

function showAdminStats(chatId) {
  const vals = Object.values(ratings);
  const avg  = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '—';
  md(chatId,
    `📊 *Bot Statistikasi*\n\n` +
    `💬 Xabarlar: *${stats.messages}*\n` +
    `👥 Foydalanuvchilar: *${stats.users.size}*\n` +
    `🔗 API so\'rovlar: *${stats.apiCalls}*\n` +
    `⭐ O\'rtacha baho: *${avg}/10*\n` +
    `🗂 Baholar: *${vals.length}*\n` +
    `💾 Tarixli chatlar: *${Object.keys(userHistory).length}*`
  );
}

// ════════════════════════════════════════════════════
//  §22. ASOSIY XABAR HANDLER
// ════════════════════════════════════════════════════

bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;

  const chatId = msg.chat.id;
  const text   = msg.text.trim();
  const lower  = text.toLowerCase();
  const state  = userState[chatId];

  stats.messages++;
  stats.users.add(msg.from.id);

  // ── Inline matn buyruqlari ─────────────────────

  // Ob-havo: "ob-havo Toshkent" / "weather London"
  const weatherMatch = text.match(/^(?:ob-havo|weather|havo)\s+(.+)/i);
  if (weatherMatch) {
    const city = weatherMatch[1].trim();
    await typing(chatId);
    const w = await getWeather(city);
    stats.apiCalls++;
    if (!w) return md(chatId, `❌ *${city}* uchun ob-havo topilmadi.\n\nInglizchalab yozing.`, MAIN_KB);
    return md(chatId,
      `🌤 *${city} ob-havosi:*\n\n🌡 Harorat: *${w.temp}°C* (his: ${w.feels}°C)\n💧 Namlik: *${w.humidity}%*\n💨 Shamol: *${w.wind} km/h*\n☁️ Holat: *${w.desc}*`,
      MAIN_KB
    );
  }

  // Valyuta: "kurs USD UZS" / "dollar kurs"
  if (/^kurs\s+/i.test(text) || /^(dollar|euro|rubl)\s*(kurs|narx)/i.test(text)) {
    await typing(chatId);
    let from = 'USD', to = 'UZS', amount = 1;
    const m = text.match(/kurs\s+([A-Za-z]{3})\s+([A-Za-z]{3})(?:\s+(\d+))?/i);
    if (m) { from = m[1].toUpperCase(); to = m[2].toUpperCase(); amount = parseFloat(m[3]) || 1; }
    else if (/euro/i.test(text)) from = 'EUR';
    else if (/rubl/i.test(text)) from = 'RUB';
    const res = await getCurrency(from, to, amount);
    stats.apiCalls++;
    if (!res) return md(chatId, '❌ Valyuta kursini yuklab bo\'lmadi. Keyinroq urinib ko\'ring.', MAIN_KB);
    return md(chatId,
      `💱 *Valyuta Kursi:*\n\n${amount} *${from}* = *${res.result} ${to}*\n📈 Kurs: 1 ${from} = ${res.rate} ${to}`,
      MAIN_KB
    );
  }

  // Hazil inline
  if (/^(hazil|joke|kuldur|kulgi)$/i.test(lower)) {
    await typing(chatId);
    const joke = await getJoke();
    stats.apiCalls++;
    return md(chatId, joke, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '😂 Yana hazil', callback_data: 'joke_api' }]] },
    });
  }

  // ── State machine'lar ──────────────────────────

  // Baho
  if (state?.mode === 'rating') {
    const n = parseInt(text);
    if (isNaN(n) || n < 1 || n > 10) return md(chatId, '⚠️ 1 dan 10 gacha son kiriting.');
    ratings[chatId] = n;
    const emojis = ['','😢','😔','😕','😐','🙂','😃','😄','😁','🤩','🏆'];
    const msgs   = ['','Afsus...','Yaxshilanishga harakat qilamiz.','Tushundik!',
                    'Yaxshilashimiz mumkin.','O\'rtacha, rahmat!','Yaxshi!',
                    'Juda yaxshi!','Zo\'r!','Juda zo\'r!','Mukammal! ❤️'];
    userState[chatId] = null;
    return md(chatId, `${emojis[n]} *${msgs[n]}*\n\nBahoyingiz: *${n}/10* ✅\n\nRahmat! 🙏`, MAIN_KB);
  }

  // Admin savol
  if (state?.mode === 'question') {
    userState[chatId] = null;
    await md(chatId, '✅ Savolingiz adminga yuborildi! 24 soat ichida javob kuting. 😊', MAIN_KB);
    return md(CONFIG.ADMIN_ID,
      `📩 *Yangi savol!*\n\n👤 ${msg.from.first_name} (@${msg.from.username || '—'})\n🆔 \`${msg.from.id}\`\n\n💬 *${text}*\n\n📤 Javob: \`/reply ${msg.from.id} JAVOB\``
    );
  }

  // BMI — vazn
  if (state?.mode === 'bmi_weight') {
    const w = parseFloat(text);
    if (isNaN(w) || w < 10 || w > 500) return md(chatId, '⚠️ To\'g\'ri vazn kiriting (kg, masalan: 70)');
    userState[chatId] = { mode: 'bmi_height', weight: w };
    return md(chatId, '📏 Bo\'yingizni kiriting (sm, masalan: 175):', NO_KB);
  }

  // BMI — bo'y
  if (state?.mode === 'bmi_height') {
    const h = parseFloat(text);
    if (isNaN(h) || h < 50 || h > 300) return md(chatId, '⚠️ To\'g\'ri bo\'y kiriting (sm, masalan: 175)');
    const result = calcBMI(state.weight, h);
    const savedH = h;
    userState[chatId] = null;
    return md(chatId, result, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '💪 Ideal vazn hisoblash', callback_data: `idealw_${savedH}` }]],
        ...MAIN_KB.reply_markup,
      },
    });
  }

  // Tarjimon
  if (state?.mode === 'translate') {
    userState[chatId] = null;
    await typing(chatId);
    const hasLatin = /[a-zA-Z]{3,}/.test(text);
    const from = hasLatin ? 'en' : 'uz';
    const to   = hasLatin ? 'uz' : 'en';
    const translated = await safeFetch(() => translateAuto(text, from, to));
    stats.apiCalls++;
    const encoded  = encodeURIComponent(text);
    const fromLang = from === 'en' ? '🇬🇧 Inglizcha' : '🇺🇿 O\'zbekcha';
    const toLang   = to   === 'uz' ? '🇺🇿 O\'zbekcha' : '🇬🇧 Inglizcha';
    return md(chatId,
      `🌐 *Tarjima natijasi:*\n\n${fromLang}: _${text}_\n${toLang}: *${translated || 'Tarjima topilmadi'}*`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🌐 Google Translate', url: `https://translate.google.com/?text=${encoded}&sl=${from}&tl=${to}` }],
            [{ text: '🔄 Yana tarjima', callback_data: 'translate_more' }],
          ],
          ...MAIN_KB.reply_markup,
        },
      }
    );
  }

  // Ob-havo city
  if (state?.mode === 'weather_city') {
    await typing(chatId);
    userState[chatId] = null;
    const w = await getWeather(text);
    stats.apiCalls++;
    if (!w) return md(chatId, `❌ *${text}* uchun ob-havo topilmadi. Inglizchalab yozing.`, MAIN_KB);
    return md(chatId,
      `🌤 *${text} ob-havosi:*\n\n🌡 Harorat: *${w.temp}°C* (his: ${w.feels}°C)\n💧 Namlik: *${w.humidity}%*\n💨 Shamol: *${w.wind} km/h*\n☁️ Holat: *${w.desc}*`,
      MAIN_KB
    );
  }

  // Raqam topish o'yini
  if (state?.mode === 'guess') {
    const n = parseInt(text);
    if (isNaN(n) || n < 1 || n > 100) return md(chatId, '🔢 1 dan 100 gacha son kiriting.');
    state.tries++;
    if (state.tries > 10) {
      userState[chatId] = null;
      return md(chatId, `😅 Urinishlar tugadi! Son: *${state.secret}*\n\nQayta o'ynash?`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '🔄 Qayta o\'ynash', callback_data: 'game_guess' }]] },
      });
    }
    if (n < state.secret) return md(chatId, `📈 Kattaroq! (urinish: ${state.tries}/10)`);
    if (n > state.secret) return md(chatId, `📉 Kichikroq! (urinish: ${state.tries}/10)`);
    userState[chatId] = null;
    const stars = state.tries <= 5 ? '🌟🌟🌟 Ajoyib!' : state.tries <= 8 ? '⭐⭐ Yaxshi!' : '⭐ Davom eting!';
    return md(chatId,
      `🎉 *To\'g\'ri! Topding!*\n\nSon: *${state.secret}*\nUrinishlar: *${state.tries}*\n\n${stars}`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '🔄 Qayta o\'ynash', callback_data: 'game_guess' }]], ...MAIN_KB.reply_markup },
      }
    );
  }

  // Tosh-Qaychi-Qog'oz
  if (state?.mode === 'rps') {
    const map = { 'tosh':0,'qaychi':1,"qog'oz":2,'qogoz':2,'tash':0,'paper':2,'scissors':1,'rock':0 };
    const k = lower.replace(/'/g, "'");
    if (!(k in map)) return md(chatId, "✋ *Tosh*, *Qaychi* yoki *Qog'oz* deb yozing.");
    const opts = ['Tosh 🪨','Qaychi ✂️',"Qog'oz 📄"];
    const botChoice = Math.floor(Math.random() * 3);
    const usr = map[k];
    const diff = (usr - botChoice + 3) % 3;
    const res = diff === 0 ? '🤝 Durrang!' : diff === 1 ? '🏆 Siz yutdingiz!' : '🤖 Men yutdim!';
    userState[chatId] = null;
    return md(chatId,
      `Siz: *${opts[usr]}*\nMen: *${opts[botChoice]}*\n\n${res}`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '🔄 Qayta o\'ynash', callback_data: 'game_rps' }]], ...MAIN_KB.reply_markup },
      }
    );
  }

  // Viktorina
  if (state?.mode === 'quiz') {
    const qi = state.qIndex;
    const q  = state.questions[qi];
    const n  = parseInt(text) - 1;
    if (n < 0 || n >= q.opts.length) return md(chatId, `1 dan ${q.opts.length} gacha raqam kiriting.`);

    let fb = '';
    if (n === q.c) { state.score++; fb = '✅ *To\'g\'ri!*\n\n'; }
    else           { fb = `❌ *Noto\'g\'ri!*\nTo\'g\'ri: *${q.opts[q.c]}*\n\n`; }
    state.qIndex++;

    const total = state.questions.length;
    if (state.qIndex < total) {
      const nq = state.questions[state.qIndex];
      return md(chatId,
        fb + `📊 Natija: *${state.score}/${state.qIndex}*\n\n📝 *${state.qIndex + 1}/${total}:* ${nq.q}\n\n` +
        nq.opts.map((o, i) => `${i + 1}. ${o}`).join('\n') + '\n\n_Raqamni yozing (1–4)_'
      );
    }

    userState[chatId] = null;
    const sc    = state.score;
    const pct   = Math.round(sc / total * 100);
    const medal = sc === total ? '🏆 Mukammal!' : pct >= 75 ? '🥇 Zo\'r natija!' : pct >= 50 ? '🥈 Yaxshi!' : '🥉 Ko\'proq mashq!';
    return md(chatId,
      fb + `🏁 *Viktorina tugadi!*\n\nNatija: *${sc}/${total}* (${pct}%)\n\n${medal}`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '🔄 Qayta o\'ynash', callback_data: 'game_quiz' }]], ...MAIN_KB.reply_markup },
      }
    );
  }

  // Rasm yaratish
  if (state?.mode === 'image_gen') {
    userState[chatId] = null;
    await typing(chatId);
    const prompt   = encodeURIComponent(text);
    const imageUrl = `https://image.pollinations.ai/prompt/${prompt}?width=512&height=512&nologo=true`;
    try {
      await bot.sendPhoto(chatId, imageUrl, {
        caption: `🎨 *${text}*`,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '🔄 Yana rasm', callback_data: `img_${text.slice(0, 50)}` }]], ...MAIN_KB.reply_markup },
      });
    } catch {
      md(chatId, '❌ Rasm yaratib bo\'lmadi. Boshqa so\'z bilan urinib ko\'ring.', MAIN_KB);
    }
    return;
  }

  // Musiqa qidirish
  if (state?.mode === 'music_search') {
    userState[chatId] = null;
    await typing(chatId);
    let videoId = null;
    let videoTitle = text;

    const ytLinkMatch = text.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/);
    if (ytLinkMatch) {
      videoId = ytLinkMatch[1];
    } else {
      const query = encodeURIComponent(text);
      const html  = await safeFetch(() => fetchText(`https://www.youtube.com/results?search_query=${query}`, 8000));
      if (html) {
        const m = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
        if (m) videoId = m[1];
        const t = html.match(/"title":{"runs":\[{"text":"([^"]+)"/);
        if (t) videoTitle = t[1];
      }
    }

    if (!videoId) {
      return md(chatId, '❌ Qo\'shiq topilmadi. Boshqacha yozing yoki YouTube link yuboring.', {
        reply_markup: { inline_keyboard: [[{ text: '🔄 Qayta urinish', callback_data: 'music_again' }]] },
      });
    }

    const ytUrl = `https://youtube.com/watch?v=${videoId}`;
    const q     = encodeURIComponent(videoTitle !== text ? videoTitle : text);
    return md(chatId, `🎵 *${videoTitle}*`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '⬇️ MP3 yuklab olish', url: `https://yt1s.com/youtube-to-mp3?q=${q}` }],
          [{ text: '⬇️ Boshqa converter',  url: `https://ytmp3.cc/youtube-to-mp3/?url=${encodeURIComponent(ytUrl)}` }],
          [{ text: '▶️ YouTube',           url: ytUrl }],
          [{ text: '🔄 Boshqa qo\'shiq',   callback_data: 'music_again' }],
        ],
      },
    });
  }

  // Qidirish
  if (state?.mode === 'web_search') {
    userState[chatId] = null;
    const q = encodeURIComponent(text);
    return md(chatId, `🔍 *"${text}"* bo'yicha qidirish:`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🌐 Google',    url: `https://www.google.com/search?q=${q}` }],
          [{ text: '📺 YouTube',   url: `https://www.youtube.com/results?search_query=${q}` }],
          [{ text: '📖 Wikipedia', url: `https://uz.wikipedia.org/w/index.php?search=${q}` }],
          [{ text: '🔄 Yana qidirish', callback_data: 'search_again' }],
        ],
      },
    });
  }

  // Tasodifiy tanlov (state)
  if (state?.mode === 'random_choice') {
    userState[chatId] = null;
    const orMatch = text.replace('?', '').match(/(.+?)\s+yoki\s+(.+)/i);
    if (!orMatch) return md(chatId, '⚠️ Format: *pizza yoki osh?*', MAIN_KB);
    const opts   = [orMatch[1].trim(), orMatch[2].trim()];
    const chosen = opts[Math.floor(Math.random() * opts.length)];
    return md(chatId,
      `🎲 *Tasodifiy tanlov:*\n\n${opts.map(o => `• ${o}`).join('\n')}\n\n🏆 Tanlov: *${chosen}*`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '🔄 Qayta tashlash', callback_data: `rnd_${text}` }]], ...MAIN_KB.reply_markup },
      }
    );
  }

  // ── Menyu tanlovlari ──────────────────────────

  if (/Loyihalarim|📁/.test(text)) {
    return md(chatId, `📁 *Bekzod Baratov — Loyihalar*\n\nQuyidagi tugmalarni bosing 👇`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: PROJECTS.map(p => [{ text: p.name, url: p.url }]) },
    });
  }

  if (/IELTS|📚/.test(text) && !/Python/.test(text)) {
    return bot.sendMessage(chatId, '📚 *IELTS PDF Kutubxonasi*\n\nQaysi PDF ni yuklab olishni xohlaysiz?', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📖 Vocabulary (Sinonimlar)',    callback_data: 'pdf_vocab' }],
          [{ text: '📝 Grammar Guide (If+Modals)',  callback_data: 'pdf_grammar' }],
          [{ text: '🎤 Speaking Phrases (Band 7-9)', callback_data: 'pdf_speaking' }],
          [{ text: '📦 Barcha 3 PDF',               callback_data: 'pdf_all' }],
        ],
      },
    });
  }

  if (/Dasturlash va Python|🐍/.test(text)) {
    return md(chatId, '🐍 *Dasturlash O\'rganish Resurslari*', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📗 W3Schools Python',       url: 'https://www.w3schools.com/python/' }],
          [{ text: '📘 Python Rasmiy Docs',      url: 'https://docs.python.org/3/' }],
          [{ text: '🎓 CS50P (Bepul Harvard)',    url: 'https://cs50.harvard.edu/python/2022/' }],
          [{ text: '📺 Corey Schafer (YouTube)', url: 'https://www.youtube.com/@CoreySchafer' }],
          [{ text: '🚀 Real Python',             url: 'https://realpython.com/' }],
          [{ text: '🤖 Automate Boring Stuff',   url: 'https://automatetheboringstuff.com/' }],
        ],
      },
    });
  }

  if (/Matematika|🧮/.test(text)) {
    return md(chatId, '🧮 *Matematika Resurslari*', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📐 Khan Academy',  url: 'https://www.khanacademy.org/math' }],
          [{ text: '🔢 Wolfram Alpha', url: 'https://www.wolframalpha.com/' }],
          [{ text: '📊 Desmos',        url: 'https://www.desmos.com/calculator' }],
          [{ text: '🧮 Math is Fun',   url: 'https://www.mathsisfun.com/' }],
          [{ text: '📹 3Blue1Brown',   url: 'https://www.youtube.com/@3blue1brown' }],
        ],
      },
    });
  }

  if (/Faktlar|🌟/.test(text) && !/Motivatsiya/.test(text)) {
    await typing(chatId);
    const timeoutP = new Promise(r => setTimeout(() => r(null), 7000));
    const factP    = getFactWithTranslation();
    const res      = await Promise.race([factP, timeoutP]);
    stats.apiCalls++;
    if (!res) {
      const t = FACTS_STATIC[Math.floor(Math.random() * FACTS_STATIC.length)];
      return md(chatId, `🌟 *Qiziqarli Fakt:*\n\n${t}`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '🔄 Yana bir fakt', callback_data: 'fact_api' }]] },
      });
    }
    const { en, uz, emoji, source } = res;
    const src   = source !== 'local' ? `\n\n_Manba: ${source}_` : '';
    const fText = uz
      ? `${emoji} *Qiziqarli Fakt:*\n\n🇬🇧 _${en}_\n\n🇺🇿 *${uz}*${src}`
      : `${emoji} *Qiziqarli Fakt:*\n\n${en}${src}`;
    return md(chatId, fText, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '🔄 Yana bir fakt', callback_data: 'fact_api' }]] },
    });
  }

  if (/Maslahatlar|💡/.test(text)) {
    return md(chatId, getRandomTip(), {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🏃 Sog\'liq', callback_data: 'tip_health' }, { text: '⚡ Samaradorlik', callback_data: 'tip_productivity' }],
          [{ text: '📚 O\'rganish', callback_data: 'tip_learning' }, { text: '🌟 Muvaffaqiyat', callback_data: 'tip_success' }],
          [{ text: '🧠 Tafakkur', callback_data: 'tip_mindset' }, { text: '👥 Munosabat', callback_data: 'tip_relationships' }],
          [{ text: '💸 Moliya', callback_data: 'tip_finance' }, { text: '🗓️ Odatlar', callback_data: 'tip_habits' }],

        ],
        ...MAIN_KB.reply_markup,
      },
    });
  }

  if (/Marvel|🎬/.test(text)) {
    const movies = [
      '🎬 Iron Man (2008)', '🎬 The Avengers (2012)',
      '🎬 Guardians of the Galaxy (2014)', '🎬 Black Panther (2018)',
      '🎬 Avengers: Infinity War (2018)', '🎬 Avengers: Endgame (2019)',
      '🎬 Spider-Man: No Way Home (2021)', '🎬 Doctor Strange MoM (2022)',
      '🎬 Thor: Love and Thunder (2022)', '🎬 Guardians Vol.3 (2023)',
      '🎬 Deadpool & Wolverine (2024)',
    ].join('\n');
    return md(chatId, `🎬 *MCU Kinolari*\n\n${movies}`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎥 Marvel.com',  url: 'https://www.marvel.com/movies' }],
          [{ text: '🍿 IMDB Marvel', url: 'https://www.imdb.com/search/title/?companies=co0051941' }],
        ],
      },
    });
  }

  if (/O'yinlar|🎮/.test(text)) {
    return bot.sendMessage(chatId, '🎮 *O\'yin tanlang:*', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔢 Raqam topish (1–100)',   callback_data: 'game_guess' }],
          [{ text: "✂️ Tosh-Qaychi-Qog'oz",     callback_data: 'game_rps' }],
          [{ text: '🧠 Viktorina (8 savol)',     callback_data: 'game_quiz' }],
        ],
      },
    });
  }

  if (/Hazillar|😂/.test(text)) {
    await typing(chatId);
    const joke = await getJoke();
    stats.apiCalls++;
    return md(chatId, joke, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '😂 Yana hazil', callback_data: 'joke_api' }]] },
    });
  }

  if (/Motivatsiya|💪/.test(text)) {
    await typing(chatId);
    const { quote, author } = await getQuote();
    stats.apiCalls++;
    return md(chatId, `💪 *Motivatsiya:*\n\n_"${quote}"_\n\n— *${author}*`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '🔄 Yana iqtibos', callback_data: 'quote_api' }]], ...MAIN_KB.reply_markup },
    });
  }

  if (/Ob-havo|🌤/.test(text)) {
    userState[chatId] = { mode: 'weather_city' };
    return md(chatId, '🌤 *Ob-havo ma\'lumoti*\n\nQaysi shahar?\n\n_Misol: Tashkent, Samarkand, London_', NO_KB);
  }

  if (/Valyuta|💱/.test(text)) {
    return md(chatId,
      '💱 *Valyuta Kursi*\n\nFormat:\n\n👉 *kurs USD UZS*\n👉 *kurs EUR USD 100*\n👉 *dollar kurs*',
      MAIN_KB
    );
  }

  if (/Adminga|✉️/.test(text)) {
    userState[chatId] = { mode: 'question' };
    return md(chatId, '✉️ Savolingizni yozing, adminga yuboriladi:', NO_KB);
  }

  if (/Baholash|⭐/.test(text)) {
    userState[chatId] = { mode: 'rating' };
    return md(chatId, '⭐ Botni 1 dan 10 gacha baholang (10 — eng yaxshi):', NO_KB);
  }

  if (/Bot Haqida|ℹ️/.test(text)) {
    return md(chatId,
      `ℹ️ *Bekzod Help Bot v5.0*\n\n` +
      `👨‍💻 Muallif: *Bekzod Baratov* (@bekzod_stack)\n` +
      `📅 Yaratilgan: 2025-yil\n` +
      `🛠 Stack: Node.js + Express\n` +
      `🤖 AI: Groq (llama-3.3-70b)\n\n` +
      `*Imkoniyatlar:*\n` +
      `• 🤖 AI suhbat (kuchaytirilgan)\n` +
      `• 🌍 Real-time faktlar + tarjima\n` +
      `• 🌤 Ob-havo, 💱 Valyuta kurslari\n` +
      `• 😂 Hazillar, 💪 Motivatsiya\n` +
      `• 📁 5 loyiha | 📚 3 IELTS PDF\n` +
      `• 🎮 3 o'yin | 🔢 BMI hisoblagich\n` +
      `• 🎨 Rasm yaratish | 🌐 Tarjimon\n` +
      `• ✉️ Admin aloqasi | ⭐ Baho tizimi`,
      MAIN_KB
    );
  }

  if (/Statistika|📊/.test(text)) {
    const vals = Object.values(ratings);
    const avg  = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '—';
    return md(chatId,
      `📊 *Bot Statistikasi*\n\n` +
      `💬 Xabarlar: *${stats.messages}*\n` +
      `👥 Foydalanuvchilar: *${stats.users.size}*\n` +
      `🔗 API so'rovlar: *${stats.apiCalls}*\n` +
      `⭐ O'rtacha baho: *${avg}/10*`,
      MAIN_KB
    );
  }

  if (/BMI|🔢/.test(text)) {
    userState[chatId] = { mode: 'bmi_weight' };
    return md(chatId, '⚖️ *BMI Hisoblagich*\n\nVazningizni kiriting (kg, masalan: 70):', NO_KB);
  }

  if (/Tarjimon|🌐/.test(text)) {
    userState[chatId] = { mode: 'translate' };
    return md(chatId,
      '🌐 *Tarjima tizimi*\n\nSo\'z yoki jumlani yozing:\n• Inglizcha → O\'zbekchaga\n• O\'zbekcha → Inglizchaga\n_(avtomatik aniqlaydi)_',
      NO_KB
    );
  }

  if (/Rasm Yaratish|🎨/.test(text)) {
    userState[chatId] = { mode: 'image_gen' };
    return md(chatId,
      '🎨 *Rasm Yaratish*\n\nRasm haqida inglizcha yozing:\n👉 _a cat sitting on a mountain_\n👉 _sunset over ocean, realistic_\n👉 _futuristic city at night_',
      NO_KB
    );
  }

  if (/Musiqa|🎵/.test(text)) {
    userState[chatId] = { mode: 'music_search' };
    return md(chatId,
      '🎵 *Musiqa Topish*\n\nQo\'shiq nomi yoki ijrochi yozing:\n👉 _Dua Lipa Levitating_\n👉 _Shaxriyor Yomg\'ir_\n👉 _https://youtu.be/xxxxx_',
      NO_KB
    );
  }

  if (/Qidirish|🔍/.test(text)) {
    userState[chatId] = { mode: 'web_search' };
    return md(chatId, '🔍 *Qidirish*\n\nNima qidirmoqchisiz?\n👉 _Python darslari_\n👉 _iPhone 16 narxi_', NO_KB);
  }

  if (/Tasodifiy|🎲/.test(text) || (/yoki/i.test(text) && text.includes('?'))) {
    const orMatch = text.replace('?', '').match(/(.+?)\s+yoki\s+(.+)/i);
    if (orMatch) {
      const opts   = [orMatch[1].trim(), orMatch[2].trim()];
      const chosen = opts[Math.floor(Math.random() * opts.length)];
      return md(chatId,
        `🎲 *Tasodifiy tanlov:*\n\n${opts.map(o => `• ${o}`).join('\n')}\n\n🏆 Tanlov: *${chosen}*`,
        MAIN_KB
      );
    }
    userState[chatId] = { mode: 'random_choice' };
    return md(chatId, '🎲 *Tasodifiy Tanlov*\n\nVariantlarni yozing:\n👉 *pizza yoki osh?*\n👉 *kino yoki kitob?*', NO_KB);
  }

  // ── Tez mahalliy javob ────────────────────────
  const quick = quickReply(text);
  if (quick) return md(chatId, quick, MAIN_KB);

  // ── Groq AI — asosiy AI javob ─────────────────
  await typing(chatId);
  const { answer, error } = await askGroq(text, chatId);

  if (answer) {
    return md(chatId, answer, { parse_mode: 'Markdown', reply_markup: MAIN_KB.reply_markup });
  }

  // Groq ishlamasa — xato xabari
  if (error) {
    const fallbacks = [
      '🤔 Hozir AI tizimida muammo bor. Keyinroq urinib ko\'ring! 😊',
      '⚠️ AI vaqtinchalik ishlamayapti. Menyudan foydalaning! 👇',
      '🔄 Javob yuklanmadi. Iltimos, qayta yozing.',
    ];
    return md(chatId, fallbacks[Math.floor(Math.random() * fallbacks.length)], MAIN_KB);
  }

  // Umumiy fallback
  const defaults = [
    '🤔 Tushunmadim. Aniqroq yozing yoki menyudan tanlang! 😊',
    '💡 Bu savolga javob topa olmadim. Menyudan kerakli bo\'limni oching! 👇',
  ];
  md(chatId, defaults[Math.floor(Math.random() * defaults.length)], MAIN_KB);
});

// ════════════════════════════════════════════════════
//  §23. CALLBACK QUERIES
// ════════════════════════════════════════════════════

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data   = query.data;
  await bot.answerCallbackQuery(query.id).catch(() => {});

  // PDF
  if (data === 'pdf_vocab')    return sendPDF(chatId, 'vocab');
  if (data === 'pdf_grammar')  return sendPDF(chatId, 'grammar');
  if (data === 'pdf_speaking') return sendPDF(chatId, 'speaking');
  if (data === 'pdf_all') {
    await md(chatId, '📦 Barcha 3 ta PDF yuborilmoqda...');
    for (const k of ['vocab', 'grammar', 'speaking']) await sendPDF(chatId, k);
    return md(chatId, '✅ Barcha PDFlar yuborildi! Muvaffaqiyatlar! 🎓', MAIN_KB);
  }

  // Fakt
  if (data === 'fact_api') {
    await bot.answerCallbackQuery(query.id, { text: '⏳ Yuklanmoqda...' }).catch(() => {});
    await typing(chatId);
    const timeoutP = new Promise(r => setTimeout(() => r(null), 7000));
    const res = await Promise.race([getFactWithTranslation(), timeoutP]);
    stats.apiCalls++;
    if (!res) {
      const t = FACTS_STATIC[Math.floor(Math.random() * FACTS_STATIC.length)];
      return md(chatId, `🌟 *Fakt:*\n\n${t}`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '🔄 Yana bir fakt', callback_data: 'fact_api' }]] },
      });
    }
    const { en, uz, emoji, source } = res;
    const src   = source !== 'local' ? `\n\n_Manba: ${source}_` : '';
    const fText = uz
      ? `${emoji} *Qiziqarli Fakt:*\n\n🇬🇧 _${en}_\n\n🇺🇿 *${uz}*${src}`
      : `${emoji} *Qiziqarli Fakt:*\n\n${en}${src}`;
    return md(chatId, fText, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '🔄 Yana bir fakt', callback_data: 'fact_api' }]] },
    });
  }

  // Hazil
  if (data === 'joke_api') {
    await bot.answerCallbackQuery(query.id, { text: '😂 Yuklanyapti...' }).catch(() => {});
    await typing(chatId);
    const joke = await getJoke();
    stats.apiCalls++;
    return md(chatId, joke, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '😂 Yana hazil', callback_data: 'joke_api' }]] },
    });
  }

  // Iqtibos
  if (data === 'quote_api') {
    await bot.answerCallbackQuery(query.id, { text: '💪 Yuklanmoqda...' }).catch(() => {});
    await typing(chatId);
    const { quote, author } = await getQuote();
    stats.apiCalls++;
    return md(chatId, `💪 *Motivatsiya:*\n\n_"${quote}"_\n\n— *${author}*`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '🔄 Yana iqtibos', callback_data: 'quote_api' }]] },
    });
  }

  // Maslahat kategoriyalari
  if (data.startsWith('tip_')) {
    const cat = data.replace('tip_', '');
    return md(chatId, getRandomTip(cat), {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
            [{ text: '🏃 Sog\'liq', callback_data: 'tip_health' }, { text: '⚡ Samaradorlik', callback_data: 'tip_productivity' }],
            [{ text: '📚 O\'rganish', callback_data: 'tip_learning' }, { text: '🌟 Muvaffaqiyat', callback_data: 'tip_success' }],
            [{ text: '🧠 Tafakkur', callback_data: 'tip_mindset' }, { text: '👥 Munosabat', callback_data: 'tip_relationships' }],
            [{ text: '💸 Moliya', callback_data: 'tip_finance' }, { text: '🗓️ Odatlar', callback_data: 'tip_habits' }],
        ],
        ...MAIN_KB.reply_markup,
      },
    });
  }

  // Tarjima
  if (data === 'translate_more') {
    userState[chatId] = { mode: 'translate' };
    return md(chatId, '🌐 Tarjima qilmoqchi bo\'lgan so\'z yoki jumlani yozing:', NO_KB);
  }

  // Rasm
  if (data.startsWith('img_')) {
    const prompt   = data.replace('img_', '');
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true&seed=${Math.floor(Math.random() * 9999)}`;
    try {
      await bot.sendPhoto(chatId, imageUrl, {
        caption: `🎨 *${prompt}*`,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '🔄 Yana rasm', callback_data: `img_${prompt}` }]], ...MAIN_KB.reply_markup },
      });
    } catch {
      md(chatId, '❌ Rasm yaratib bo\'lmadi.', MAIN_KB);
    }
    return;
  }

  // Musiqa
  if (data === 'music_again') {
    userState[chatId] = { mode: 'music_search' };
    return md(chatId, '🎵 Qo\'shiq nomi yoki ijrochi yozing:', NO_KB);
  }

  if (data === 'search_again') {
    userState[chatId] = { mode: 'web_search' };
    return md(chatId, '🔍 Nima qidirmoqchisiz?', NO_KB);
  }

  // Tasodifiy tanlov — qayta
  if (data.startsWith('rnd_')) {
    const original = data.replace('rnd_', '');
    const orMatch  = original.replace('?', '').match(/(.+?)\s+yoki\s+(.+)/i);
    if (orMatch) {
      const opts   = [orMatch[1].trim(), orMatch[2].trim()];
      const chosen = opts[Math.floor(Math.random() * opts.length)];
      return md(chatId,
        `🎲 *Tasodifiy tanlov:*\n\n${opts.map(o => `• ${o}`).join('\n')}\n\n🏆 Tanlov: *${chosen}*`, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '🔄 Qayta tashlash', callback_data: `rnd_${original}` }]], ...MAIN_KB.reply_markup },
        }
      );
    }
  }

  // O'yinlar
  if (data === 'game_guess') {
    userState[chatId] = { mode: 'guess', secret: Math.floor(Math.random() * 100) + 1, tries: 0 };
    return md(chatId, '🔢 *Raqam topish!*\n\n1 dan 100 gacha son o\'yladim.\n10 ta urinish bor! 🤔');
  }

  if (data === 'game_rps') {
    userState[chatId] = { mode: 'rps' };
    return md(chatId, "✂️ *Tosh-Qaychi-Qog'oz*\n\nYozing: *Tosh* 🪨, *Qaychi* ✂️ yoki *Qog'oz* 📄");
  }

  if (data === 'game_quiz') {
    return startQuiz(chatId);
  }

  // Ideal vazn
  if (data.startsWith('idealw_')) {
    const height = parseFloat(data.replace('idealw_', ''));
    return md(chatId, '👤 Jinsingizni tanlang:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '👨 Erkak', callback_data: `idealc_erkak_${height}` }],
          [{ text: '👩 Ayol',  callback_data: `idealc_ayol_${height}` }],
        ],
      },
    });
  }

  if (data.startsWith('idealc_')) {
    const parts  = data.replace('idealc_', '').split('_');
    const gender = parts[0];
    const height = parseFloat(parts[1]);
    return md(chatId, calcIdealWeight(height, gender), MAIN_KB);
  }

  // Admin statistika
  if (data === 'admin_stats' && query.from.id === CONFIG.ADMIN_ID) {
    return showAdminStats(chatId);
  }
});

// ════════════════════════════════════════════════════
//  §24. EXPRESS SERVERI
// ════════════════════════════════════════════════════

app.get('/',       (_, res) => res.json({ status: 'ok', bot: 'Bekzod Help Bot v5', version: '5.0' }));
app.get('/health', (_, res) => res.json({
  uptime:   process.uptime().toFixed(0) + 's',
  messages: stats.messages,
  users:    stats.users.size,
  apiCalls: stats.apiCalls,
  model:    CONFIG.GROQ_MODEL,
}));

app.listen(CONFIG.PORT, '0.0.0.0', () =>
  console.log(`🌐 Express server: http://0.0.0.0:${CONFIG.PORT}`)
);

// ════════════════════════════════════════════════════
//  §25. ISHGA TUSHIRISH LOG
// ════════════════════════════════════════════════════

console.log('');
console.log('╔═══════════════════════════════════════════╗');
console.log('║   BEKZOD HELP BOT v5.0 — Ishga tushdi!   ║');
console.log('╚═══════════════════════════════════════════╝');
console.log(`🤖 Model: ${CONFIG.GROQ_MODEL}`);
console.log(`🔑 GROQ:  ${CONFIG.GROQ_API_KEY ? '✅ (' + CONFIG.GROQ_API_KEY.slice(0, 8) + '...)' : '❌ YO\'Q!'}`);
console.log(`🌐 Port:  ${CONFIG.PORT}`);
console.log('✅ APIs:  UselessFacts · NumbersAPI · CatFact · MyMemory · wttr.in · ExchangeRate · JokeAPI · ZenQuotes');
console.log('');