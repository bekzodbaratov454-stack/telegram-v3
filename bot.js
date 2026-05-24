/**
 * ╔══════════════════════════════════════════════════════════╗
 *   BEKZOD HELP BOT  v4.0  —  Node.js + Express
 *   Author: Bekzod Baratov
 *   Yangiliklar: API faktlar ulandi, AI kuchaytirildi,
 *   barcha funksiyalar yaxshilandi
 * ╚══════════════════════════════════════════════════════════╝
 */

const TelegramBot = require('node-telegram-bot-api');
const express     = require('express');
const path        = require('path');
const fs          = require('fs');
const https       = require('https');
const http        = require('http');

// ──────────────────────────────────────────────
//  FETCH HELPERS
// ──────────────────────────────────────────────
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: 8000 }, (res) => {
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

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: 8000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data.trim()));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ──────────────────────────────────────────────
//  TARJIMA  (MyMemory — bepul, 50k so'z/kun)
// ──────────────────────────────────────────────
async function translateToUz(text) {
  try {
    const encoded = encodeURIComponent(text.slice(0, 400));
    const url = `https://api.mymemory.translated.net/get?q=${encoded}&langpair=en|uz`;
    const data = await fetchJSON(url);
    const tr = data?.responseData?.translatedText || '';
    if (tr && tr.toLowerCase() !== text.toLowerCase() && tr.length > 3) {
      return tr;
    }
    return null;
  } catch {
    return null;
  }
}

async function translateAuto(text, from = 'auto', to = 'uz') {
  try {
    const langpair = from === 'auto' ? `en|${to}` : `${from}|${to}`;
    const encoded = encodeURIComponent(text.slice(0, 400));
    const url = `https://api.mymemory.translated.net/get?q=${encoded}&langpair=${langpair}`;
    const data = await fetchJSON(url);
    return data?.responseData?.translatedText || null;
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────
//  FAKTLAR STATIK (fallback)
// ──────────────────────────────────────────────
const FACTS_STATIC = [
  '🔬 Inson tanasida taxminan 37 trillion hujayra bor.',
  '🧬 DNK ni cho\'zsangiz Yer va Quyosh orasini 600 martadan oshiq bosib o\'tadi.',
  '⚛️ Atom 99.9999999% bo\'sh joydan iborat.',
  '🌡️ Mutlaq nol harorat −273.15°C — bu eng past mumkin bo\'lgan harorat.',
  '🌙 Oy Yerdan har yili 3.8 sm uzoqlashib bormoqda.',
  '☀️ Quyoshning diametri Yernikidan 109 marta katta.',
  '🪐 Saturn tuzilishi shunday engil — uni katta dengizga tashlaganingizda suv ustida qolardi.',
  '🌌 Somon Yo\'li galaktikasida taxminan 200-400 milliard yulduz bor.',
  '🚀 Yorug\'lik bir soniyada 299,792 km yo\'l bosadi.',
  '🐘 Fil 10 km uzoqlikdagi suvni his qila oladi.',
  '🐬 Delfin uyquda miyasining yarmi uxlaydi, qolgan yarmi ishlaydi.',
  '🦋 Kapalaklar ta\'m bilishni oyoqlari orqali his qiladi.',
  '🐙 Ahtapotning uchta yuragi va ko\'k qoni bor.',
  '🐝 Asalari bir umrida atigi bir choy qoshiq asal ishlab chiqaradi.',
  '🌳 Amazonian o\'rmonlari Yer kislorodining 20% ini ishlab chiqaradi.',
  '🌵 Kaktus 3 yil davomida suvsiz yashay oladi.',
  '🌺 Bambuk bir kunda 91 sm gacha o\'sishi mumkin.',
  '📜 Qog\'oz Xitoyda miloddan avvalgi 105-yilda ixtiro qilingan.',
  '💻 Birinchi kompyuter bug\'i — 1947-yilda topilgan haqiqiy kapalak (bug).',
  '📱 Smartfonlar insoniyat tarixidagi eng tez tarqalgan texnologiya.',
  '🇺🇿 O\'zbekiston Markaziy Osiyoning eng ko\'p aholiga ega davlati — 37 milliondan oshiq.',
  '🕌 Samarqandda joylashgan Registon maydoni dunyodagi eng chiroyli arxitektura ansamblllaridan biri.',
  '📖 Ibn Sino (Avicenna) — X asrda yashagan o\'zbek olimi, tibbiyotning "Ota"si.',
  '🔭 Ulug\'bek — Samarqandda XV asrda rasadxona qurgan va yulduzlar katalogini tuzgan.',
  '🎵 Musiqa inson miyasida xuddi tilga o\'xshash hissiy jarayonlarni ishga tushiradi.',
  '😴 Odamlar umrining ucdan bir qismini uxlab o\'tkazadi.',
  '👁️ Ko\'z 10 million xil rangni ajrata oladi.',
  '🧠 Miya 20 vatt quvvatda ishlaydi — bu kichik chiroq uchun yetarli.',
  '😂 Kulish immunitetni kuchaytiradi va kortizol (stres gormoni) ni kamaytiradi.',
  '🍕 Pizza dastlab Neapol, Italiyada 1700-yillarda ixtiro qilingan.',
  '🎮 Video o\'yinlar sanoati kino va musiqa sanoatini qo\'shib olganidan ham ko\'p daromad keltiradi.',
  '⚡ Chaqmoq 30,000°C gacha issiqlikka erishishi mumkin — Quyosh yuzasidan 5 marta issiq!',
  '🦁 Sher kuniga 20 soat uxlaydi.',
  '🦒 Jirafa ning tili 45 sm — u bilan o\'z quloqlarini yalaydi.',
  '🐊 Timsoh 200 million yildan beri deyarli o\'zgarmasdan qolgan.',
  '🐋 Ko\'k kit — Yer tarixidagi eng yirik jonzot, 30 metrdan uzun va 180 tonna.',
  '🌍 Amir Temur XIV asrda Yevropa va Osiyoning katta qismini birlashtirib ulkan imperiya barpo etdi.',
  '🌾 O\'zbekiston paxta ishlab chiqarish bo\'yicha dunyoda 6-o\'rinda turadi.',
  '🏛️ Rim imperiyasi avjida 70 million aholini boshqargan — o\'sha davrning 21%i.',
  '🎭 Shekspir 1700 dan ortiq yangi inglizcha so\'z yaratgan.',
];

// ──────────────────────────────────────────────
//  API ORQALI FAKT OLISH
// ──────────────────────────────────────────────
const factCache = new Set();

async function getFactFromAPI() {
  const engines = ['useless', 'numbers', 'ninja'];
  const pick = engines[Math.floor(Math.random() * engines.length)];

  try {
    if (pick === 'useless') {
      const data = await fetchJSON('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en');
      if (data?.text && data.text.length > 10) {
        return { text: data.text, emoji: '🌟', source: 'UselessFacts API' };
      }
    }

    if (pick === 'numbers') {
      const n = Math.floor(Math.random() * 9999) + 1;
      const text = await fetchText(`http://numbersapi.com/${n}/trivia`);
      if (text && !text.includes('missing') && text.length > 15) {
        return { text, emoji: '🔢', source: 'NumbersAPI' };
      }
    }

    if (pick === 'ninja') {
      // catfact.ninja bepul
      const data = await fetchJSON('https://catfact.ninja/fact');
      if (data?.fact) {
        return { text: `🐱 Cat fact: ${data.fact}`, emoji: '🐱', source: 'CatFact API' };
      }
    }
  } catch {
    // API ishlamasa fallbackga o'tamiz
  }

  // Statik fallback
  const t = FACTS_STATIC[Math.floor(Math.random() * FACTS_STATIC.length)];
  return { text: t, emoji: '🌟', source: 'local' };
}

async function getFactWithTranslation() {
  const { text, emoji, source } = await getFactFromAPI();

  // Faqat inglizcha faktlarni tarjima qilamiz
  let uz = null;
  if (source !== 'local' && /[a-zA-Z]/.test(text)) {
    uz = await translateToUz(text);
  }

  return { en: text, uz, emoji, source };
}

// ──────────────────────────────────────────────
//  OBHAVO (wttr.in — bepul, API key shart emas)
// ──────────────────────────────────────────────
async function getWeather(city) {
  try {
    const data = await fetchJSON(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
    const cur = data?.current_condition?.[0];
    if (!cur) return null;
    const desc = cur.weatherDesc?.[0]?.value || '';
    return {
      temp: cur.temp_C,
      feels: cur.FeelsLikeC,
      humidity: cur.humidity,
      wind: cur.windspeedKmph,
      desc,
    };
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────
//  VALYUTA KURSLARI (exchangerate-api.com bepul)
// ──────────────────────────────────────────────
async function getCurrency(from, to, amount = 1) {
  try {
    const data = await fetchJSON(`https://api.exchangerate-api.com/v4/latest/${from.toUpperCase()}`);
    const rate = data?.rates?.[to.toUpperCase()];
    if (!rate) return null;
    return { from, to, amount, result: (rate * amount).toFixed(2), rate: rate.toFixed(4) };
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────
//  HAZILLAR (jokeapi.dev — bepul)
// ──────────────────────────────────────────────
async function getJoke() {
  try {
    const data = await fetchJSON('https://v2.jokeapi.dev/joke/Any?blacklistFlags=nsfw,racist,sexist&type=twopart&lang=en');
    if (data?.setup && data?.delivery) {
      return `😄 ${data.setup}\n\n😂 ${data.delivery}`;
    }
    if (data?.joke) return `😄 ${data.joke}`;
  } catch {}
  // Fallback hazillar
  const jokes = [
    '😄 Dasturchi nima uchun ko\'zoynak taqadi?\n\n😂 Chunki u C# (sharp — o\'tkir) ko\'ra olmaydi!',
    '😄 Python dasturlash tilida nima eng qo\'rqinchli?\n\n😂 Indentatsiya xatosi!',
    '😄 Kompyuter sovqatib qolsa nima qiladi?\n\n😂 Windows ni yopadi!',
    '😄 Nima uchun dasturchilar tunni sevadi?\n\n😂 Chunki bug\'lar (hasharotlar) tunida faol bo\'ladi!',
    '😄 Git commit xabari:\n\n😂 "fix bug" ... "fix the fix" ... "this should work" ... "WHY"',
  ];
  return jokes[Math.floor(Math.random() * jokes.length)];
}

// ──────────────────────────────────────────────
//  MOTIVATSIYA IQTIBOSLARI (zenquotes.io — bepul)
// ──────────────────────────────────────────────
async function getQuote() {
  try {
    const data = await fetchJSON('https://zenquotes.io/api/random');
    if (data?.[0]?.q && data[0]?.a) {
      return { quote: data[0].q, author: data[0].a };
    }
  } catch {}
  // Fallback iqtiboslar
  const quotes = [
    { quote: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { quote: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
    { quote: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
    { quote: "Success is not final, failure is not fatal.", author: "Winston Churchill" },
    { quote: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
    { quote: "Har bir katta muvaffaqiyat kichik qadamlardan boshlanadi.", author: "Bekzod Baratov" },
    { quote: "Bilim — kuch. O'rganishni to'xtatma.", author: "Aristotel" },
  ];
  return quotes[Math.floor(Math.random() * quotes.length)];
}

// ──────────────────────────────────────────────
//  AI CHAT TIZIMI (kuchaytirilgan)
// ──────────────────────────────────────────────
const AI_RESPONSES = {
  greetings: [
    '👋 Salom! Men Bekzod Help Bot — sizga xizmat qilishdan xursandman! Nima yordam kerak? 😊',
    '👋 Assalomu alaykum! Bugun siz uchun nima qila olaman? 😄',
    '😊 Salom-salom! Menyudan tanlang yoki to\'g\'ridan-to\'g\'ri savolingizni yozing!',
    '🌟 Salom! Ajoyib kun tilayman! Qanday yordam kerak? ✨',
  ],
  farewell: [
    '👋 Xayr! Ko\'rishguncha, sog\' bo\'ling! 😊',
    '✌️ Alvido! Muvaffaqiyatlar tilayman! 🌟',
    '👋 Xo\'sh! Yana keling, doim kutib qolaman! 💙',
  ],
  thanks: [
    '😊 Arzimaydi! Yana murojaat qiling.',
    '🙏 Xizmat qilishdan mamnunman!',
    '💙 Rahmat sizga ham! Omad tilayman! 🌟',
    '✅ Har doim yordam berishga tayyorman!',
  ],
  howAreYou: [
    '😄 Rahmat so\'raganing uchun! Men ajoyibman — 24/7 xizmatdaman 🤖✨',
    '✅ Yaxshi, gap yo\'q! Siz qalaysiz? Savolingiz bormi? 😊',
    '🤖 Men hech qachon charchamaydigan botman — doim zo\'rman! Sizchi?',
  ],
  compliments: [
    '🎉 Katta rahmat! Sizning fikringiz menga ilhom beradi! 💙',
    '🤩 Voy! Siz juda mehribon ekansiz! Omad tilayman! 🌟',
    '😊 Rahmat! Meni quvontirdingiz! Yana nima yordam kerak?',
  ],
  whoAreYou: [
    '🤖 Men *Bekzod Help Bot v4* — Bekzod Baratov tomonidan yaratilgan botman!\n\n🛠 Stack: Node.js + Express\n\n📌 Imkoniyatlarim:\n• 🌍 Real-time API faktlar + tarjima\n• 🌤 Ob-havo ma\'lumotlari\n• 💱 Valyuta kurslari\n• 😂 Hazillar\n• 💬 Motivatsiya iqtiboslari\n• 📚 IELTS PDF kutubxona\n• 🎮 3 ta o\'yin\n• 🔢 BMI hisoblagich\n• 🤖 AI suhbat tizimi\n\nMenyudan tanlang! 👇',
  ],
  coding: [
    '💻 Dasturlash haqida so\'rayapsizmi?\n\n📌 Qaysi til bo\'yicha yordam kerak?\n• 🐍 Python — /python_tips\n• 🌐 JavaScript — /js_tips\n• 📱 HTML/CSS — /web_tips\n\nYoki menyudan 🐍 Python Darslar bo\'limini oching!',
    '🤖 Dasturlash dunyosi juda keng! Qaysi mavzuni o\'rganmoqchisiz?\n\nMenyudan tanlang yoki aniqroq yozing!',
  ],
  ielts: [
    '📚 IELTS bo\'yicha PDF yuklab olish uchun menyu dan 📚 IELTS So\'zlar tugmasini bosing!\n\n3 ta PDF bor:\n• Vocabulary\n• Grammar Guide\n• Speaking Phrases',
  ],
  food: [
    '🍜 Ovqat haqida gaplashamizmi? 😄 Mening "sevimli ovqatim" — ma\'lumotlar bazasi! Sizniki?',
    '🍕 Ovqat mavzusida gapirish yaxshi, lekin men robot bo\'lganimdan tushunmayman... Ammo pizzaning Python kabi yaxshi ekanligini bilaman! 😂',
  ],
  weather: [
    '🌤 Ob-havo ma\'lumotini bilmoqchimisiz?\n\nShunday yozing:\n👉 *ob-havo Toshkent*\n👉 *ob-havo Samarqand*\n👉 *weather London*',
  ],
  currency: [
    '💱 Valyuta kursini bilmoqchimisiz?\n\nShunday yozing:\n👉 *kurs USD UZS*\n👉 *kurs EUR USD 100*\n👉 *dollar kurs*',
  ],
  joke: [
    '😄 Hazil eshitmoqchimisiz?\n\nMenyudan 😂 Hazillar bo\'limini tanlang yoki to\'g\'ridan yozing: *hazil* deb!',
  ],
  motivation: [
    '💪 Motivatsiya kerakmi? Bugun kuchli bo\'lish uchun sabab bor! 🌟\n\nMenyudan 💪 Motivatsiya bo\'limini tanlang!',
  ],
  love: [
    '❤️ Sevgi — eng kuchli his! Men robot bo\'lsam ham, code yozish jarayonida sevgi bor! 😄',
    '💙 Men sizni — foydalanuvchini sevaman! Chunki siz bo\'lmasangiz, men hech kimga keraksizman 😄',
  ],
  math: [
    '🧮 Matematika so\'rayapsizmi?\n\nMenyudan 🧮 Matematika bo\'limini tanlang — eng yaxshi resurslar uchun!\n\nYoki kalkulyatsiya qilmoqchisiz? BMI hisoblash ham bor! 🔢',
  ],
};

// So'z + AI javob pattern engine
const AI_PATTERNS = [
  { keywords: ['salom','assalom','hi','hello','hey','привет'], key: 'greetings' },
  { keywords: ['xayr','bye','ko\'rishguncha','alvido','hoʻsh','chao'], key: 'farewell' },
  { keywords: ['rahmat','tashakkur','sog\' bo\'l','merci','thank','spasibo','рахмат'], key: 'thanks' },
];

function aiReply(text) {
  const lower = text.toLowerCase().trim();

  // Faqat sof salomlashish/xayrlashish/rahmat — boshqa hech narsa yo'q
  for (const pattern of AI_PATTERNS) {
    if (pattern.keywords.some(kw => lower === kw)) {
      const responses = AI_RESPONSES[pattern.key];
      return responses[Math.floor(Math.random() * responses.length)];
    }
  }

  // Qolgan hamma narsa Groq ga
  return null;
}

// ──────────────────────────────────────────────
//  CONFIG
// ──────────────────────────────────────────────
require('dotenv').config();
const TOKEN    = process.env.TOKEN;
const ADMIN_ID = parseInt(process.env.ADMIN_ID) || 7376786974;
const PORT     = process.env.PORT || 3000;

// ──────────────────────────────────────────────
//  GROQ AI SETUP
// ──────────────────────────────────────────────
async function askGroq(userText, chatId = null) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.log('⚠️ GROQ_API_KEY topilmadi!');
    return { answer: null, error: 'GROQ_API_KEY env da topilmadi' };
  }
  console.log('🤖 Groq ga so\'rov yuborilmoqda...');

  // Suhbat tarixini olish (oxirgi 6 ta xabar)
  const history = chatId && userHistory[chatId] ? userHistory[chatId].slice(-20) : [];

  const messages = [
    {
      role: 'system',
      content:
        'Sen o\'zbek tilida javob beruvchi aqlli, hazilkash va hushmuomila yordamchi botsiz.\n' +
        'ASOSIY QOIDALAR:\n' +
        '1. HAR DOIM o\'zbek tilida javob ber. Hech qachon javobsiz qolma.\n' +
        '2. Maksimum 3 jumla. Qisqa va aniq.\n' +
        '3. Foydalanuvchi gapini QAYTARMA.\n' +
        '4. Javob boshiga prefiks, nom yoki "Salom" yozma.\n' +
        '5. Iliq, hazilkash, do\'stona gapir 😄\n' +
        '6. O\'zbek so\'zlashuv: "kasal" yoki "yomon" so\'zlarini tushun. "mazzam yo\'q" degani kasal degani — shu haqida javob ber, o\'zing ishlatma.\n' +
        '\n' +
        'BEKZOD BARATOV haqida — bu savollarga HAR DOIM javob ber:\n' +
        '"Bekzod kim", "bot egasi", "seni kim yaratdi", "developer", "muallif" → quyidagini ber:\n' +
        'Bekzod Baratov — 18 yoshli Toshkentlik Full-stack dasturchi. JavaScript, Node.js, React, Python biladi. Telegram: @bekzod_stack. Iste\'dodli va kelajaği porloq yosh dasturchi!\n' +
        '\n' +
        'SHAXSIY MA\'LUMOT so\'ralsa (manzil, telefon, oila, do\'stlar):\n' +
        'Faqat shu jumlani yoz: "Bu ma\'lumotni bera olmayman 😊 Bekzod bilan bog\'lanish uchun: @bekzod_stack"\n' +
        '\n' +
        'LOYIHALAR: CosmoX portfolio, Do\'kon Guzor Hozmak, Country Information, QR Code Generator, KFC UZ Admin Panel.',
    },
    ...history,
    { role: 'user', content: userText },
  ];

  const body = JSON.stringify({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages,
    max_tokens: 400,
    temperature: 0.5,
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 15000,
      rejectUnauthorized: false,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json?.error) {
            const errMsg = json.error.message || JSON.stringify(json.error);
            console.log('❌ Groq API xato:', errMsg);
            return resolve({ answer: null, error: `API xato (${res.statusCode}): ${errMsg.slice(0, 120)}` });
          }
          const answer = json?.choices?.[0]?.message?.content
                      || json?.choices?.[0]?.message?.reasoning_content
                      || null;
          const trimmed = answer ? answer.trim() : null;
          console.log('✅ Groq javob berdi:', trimmed ? trimmed.slice(0, 100) : 'bo\'sh');

          // Tarixga qo'shish
          if (trimmed && chatId) {
            if (!userHistory[chatId]) userHistory[chatId] = [];
            userHistory[chatId].push({ role: 'user', content: userText });
            userHistory[chatId].push({ role: 'assistant', content: trimmed });
            // 20 ta xabarga yetsa — tozalab 0 dan boshlash
            if (userHistory[chatId].length >= 20) {
              userHistory[chatId] = [];
            }
            saveHistory();
          }

          resolve({ answer: trimmed && trimmed.length > 2 ? trimmed : null, error: trimmed ? null : `Bo'sh javob` });
        } catch (e) {
          console.log('❌ Groq parse xato:', e.message, data.slice(0, 100));
          resolve({ answer: null, error: `Parse xato: ${e.message}` });
        }
      });
    });

    req.on('error', (e) => {
      console.log('❌ Groq so\'rov xatosi:', e.message);
      resolve({ answer: null, error: `Ulanish xatosi: ${e.message}` });
    });
    req.on('timeout', () => {
      console.log('❌ Groq timeout!');
      req.destroy();
      resolve({ answer: null, error: 'Timeout (15s)' });
    });
    req.write(body);
    req.end();
  });
}


const bot = new TelegramBot(TOKEN, {
  polling: {
    interval: 1000,
    autoStart: true,
    params: { timeout: 10 }
  }
});

// Polling xatolarini tutish — bot o'chib qolmasin
bot.on('polling_error', (err) => {
  console.log('⚠️ Polling xato:', err.code, err.message?.slice(0, 80));
});
const app = express();
app.use(express.json());

// ──────────────────────────────────────────────
//  STATE STORAGE
// ──────────────────────────────────────────────
const userState   = {};
const ratings     = {};
const stats       = { totalMessages: 0, uniqueUsers: new Set(), apiCalls: 0 };

// Suhbat tarixini xotirada saqlash (fayl ishlatilmaydi)
let userHistory = {};

// Har 48 soatda barcha tarixni tozalash
setInterval(() => {
  userHistory = {};
  console.log('🧹 Suhbat tarixi tozalandi (48 soat)');
}, 48 * 60 * 60 * 1000);

function saveHistory() {} // fayl saqlanmaydi

// ──────────────────────────────────────────────
//  PROJECTS
// ──────────────────────────────────────────────
const PROJECTS = [
  { name: '🌐 CosmoX — Shaxsiy Portfolio', url: 'https://cosmosx.onrender.com/' },
  { name: '🛒 Do\'kon Guzor Hozmak',        url: 'https://do-kon-guzor-hozmak.vercel.app/' },
  { name: '🌍 Country Information',         url: 'https://country-information-bekzod-ten.vercel.app/' },
  { name: '📲 QR Code Generator',           url: 'https://qr-code-bekzod-six.vercel.app/' },
  { name: '🍗 KFC UZ Admin Panel',          url: 'https://kfc-uz-admin.vercel.app/' },
];

// ──────────────────────────────────────────────
//  PDF FILES
// ──────────────────────────────────────────────
const PDF_DIR = path.join(__dirname, 'pdfs');
const PDFS = {
  vocab:    { file: path.join(PDF_DIR, 'ielts_vocabulary.pdf'),  caption: '📚 *IELTS Vocabulary* — Sinonimlar va tarjimalar (Adjectives, Verbs, Nouns)' },
  grammar:  { file: path.join(PDF_DIR, 'grammar_guide.pdf'),     caption: '📖 *Grammar Guide* — If Conditions (0–3+Mix) • Modals • Being+V3' },
  speaking: { file: path.join(PDF_DIR, 'speaking_phrases.pdf'),  caption: '🎤 *IELTS Speaking* — Band 7–9 iboralar, esda qolarli jumlalar' },
};

// ──────────────────────────────────────────────
//  QUIZ (kengaytirilgan — 15 ta savol)
// ──────────────────────────────────────────────
const QUIZ = [
  { q: "O'zbekiston mustaqilligini qaysi yilda e'lon qildi?", opts: ['1991','1990','1992','1989'], c: 0 },
  { q: 'Python dasturlash tili kimlar tomonidan yaratilgan?', opts: ['Guido van Rossum','Linus Torvalds','Bill Gates','James Gosling'], c: 0 },
  { q: 'Dunyo bo\'yicha eng ko\'p ishlatiladigan ijtimoiy tarmoq?', opts: ['Instagram','TikTok','Facebook','Twitter'], c: 2 },
  { q: 'HTML nima uchun ishlatiladi?', opts: ['Ma\'lumotlar bazasi','Animatsiya','Web sahifalar','Mobil ilova'], c: 2 },
  { q: 'Samarqand — qaysi davlatning shahri?', opts: ['Tojikiston','Qozog\'iston','Afgʻoniston','O\'zbekiston'], c: 3 },
  { q: 'Node.js qaysi tilda yozilgan?', opts: ['Python','Java','C++','JavaScript'], c: 3 },
  { q: 'Quyosh sistemasida nechta sayyora bor?', opts: ['7','8','9','10'], c: 1 },
  { q: 'IELTS da maksimal ball nechinchi?', opts: ['8','9','10','100'], c: 1 },
  { q: 'Yer yuzida eng ko\'p so\'zlanadigan til?', opts: ['Ingliz','Ispan','Xitoy (Mandarin)','Arab'], c: 2 },
  { q: 'CPU nima degan ma\'noni anglatadi?', opts: ['Central Processing Unit','Computer Power Unit','Central Power Update','Core Processing Unit'], c: 0 },
  { q: 'GitHub qaysi kompaniyaga tegishli?', opts: ['Google','Apple','Microsoft','Amazon'], c: 2 },
  { q: 'Toshkent O\'zbekistonning nima?', opts: ['Poytaxti','Eng katta shahri','Ikkalasi ham','Iqtisodiy markazi'], c: 2 },
  { q: 'JavaScript qaysi yilda yaratilgan?', opts: ['1990','1995','2000','2005'], c: 1 },
  { q: 'Eng mashhur versiya nazorat tizimi?', opts: ['SVN','Git','Mercurial','CVS'], c: 1 },
  { q: 'Ibn Sino qaysi sohada mashhur?', opts: ['Matematika','Astronomiya','Tibbiyot','Falsafa'], c: 2 },
];

// ──────────────────────────────────────────────
//  KALKULYATOR — BMI, Yoshga qarab kalori va h.k.
// ──────────────────────────────────────────────
function calcBMI(weight, height) {
  const h = height / 100;
  const bmi = (weight / (h * h)).toFixed(1);
  let cat = '', advice = '';
  if (bmi < 18.5) { cat = '⚠️ Tana og\'irligi kam (Underweight)'; advice = '• Ko\'proq kaloriya iste\'mol qiling\n• Protein ko\'p ovqat yeng\n• Shifokor bilan maslahatlashing'; }
  else if (bmi < 25) { cat = '✅ Normal (Healthy)'; advice = '• Sog\'lom ovqatlanishni davom ettiring\n• Muntazam sport qiling\n• Yaxshi ishlapsiz! 💪'; }
  else if (bmi < 30) { cat = '⚠️ Ortiqcha vazn (Overweight)'; advice = '• Qand va yog\'li ovqatni kamaytiring\n• Kuniga 30 daqiqa yuring\n• Ko\'proq suv iching'; }
  else { cat = '❌ Semizlik (Obese)'; advice = '• Shifokor bilan zudlik bilan maslahatlashing\n• Parhez tutishni boshlang\n• Muntazam jismoniy faoliyat'; }
  return `📊 *BMI Natija*\n\n⚖️ Vazn: *${weight} kg*\n📏 Bo\'y: *${height} sm*\nBMI: *${bmi}*\n\nHolat: ${cat}\n\n💡 *Maslahat:*\n${advice}`;
}

function calcIdealWeight(height, gender) {
  const h = height - 100;
  let ideal = gender === 'erkak' ? h * 0.9 : h * 0.85;
  ideal = ideal.toFixed(1);
  return `💪 *Ideal vazn*\n\n📏 Bo\'y: *${height} sm*\n👤 Jins: *${gender}*\n\n✅ Ideal vazn: *${ideal} kg* (taxminiy)\n\n_Har bir inson tanasi boshqacha. Bu faqat taxmin._`;
}

// ──────────────────────────────────────────────
//  HAYOTIY MASLAHATLAR (kengaytirilgan)
// ──────────────────────────────────────────────
const TIPS_CATEGORIES = {
  health: [
    '🏃 Kun davomida kamida 7,000 qadam yuring.',
    '💧 Har kuni kamida 8 stakan suv iching.',
    '😴 Har kecha 7-8 soat uxlang — miya to\'la ishlashi uchun shart.',
    '🥦 Har kuni meva va sabzavot iste\'mol qiling — immunitet uchun.',
    '🧘 Stressni kamaytirish uchun kunda 10 daqiqa meditatsiya qiling.',
  ],
  productivity: [
    '⏰ Eng muhim vazifani ertalab birinchi bajaring.',
    '📱 Telefonsiz 1 soat ishlash — samaradorlikni 40% oshiradi.',
    '📝 Har kecha ertangi kunning rejasini tuzing.',
    '🎯 Bir vaqtda bitta vazifaga e\'tibor qarating (multitasking — mif).',
    '⏳ Pomodoro texnikasini qo\'llang: 25 daqiqa ish, 5 daqiqa dam.',
  ],
  learning: [
    '📚 Kitob o\'qish miyani kuchaytiradigan eng yaxshi mashq.',
    '🔄 Yangi narsani o\'rganib, uni birovga tushuntiring — bu eng yaxshi usul.',
    '✍️ Qo\'lda yozish — yodda saqlash uchun eng samarali usul.',
    '🎧 Podcast tinglash — piyoda yurganda ham o\'rganish mumkin.',
    '🌐 Har kuni 15 daqiqa ingliz tilida video ko\'ring.',
  ],
  success: [
    '💪 Harakat qilmasdan natija kutma.',
    '🌱 Kichik o\'zgarishlar — katta natijalar beradi. Har kuni 1% yaxshilanish.',
    '💡 Xato qilishdan qo\'rqma — bu tajriba.',
    '🤝 Muhim kishilarga vaqt ajrating — ular hammadan qimmat.',
    '⭐ Minnatdorchilik daftari yurit — har kuni 3 ta yaxshilik yoz.',
  ],
};

function getRandomTip(category = null) {
  const cats = Object.keys(TIPS_CATEGORIES);
  const cat = category || cats[Math.floor(Math.random() * cats.length)];
  const tips = TIPS_CATEGORIES[cat] || TIPS_CATEGORIES.success;
  const catEmoji = { health: '🏃 Sog\'liq', productivity: '⚡ Samaradorlik', learning: '📚 O\'rganish', success: '🌟 Muvaffaqiyat' };
  return `${catEmoji[cat] || '💡'} *Maslahat:*\n\n${tips[Math.floor(Math.random() * tips.length)]}`;
}

// ──────────────────────────────────────────────
//  KLAVIATURALAR
// ──────────────────────────────────────────────
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
      [{ text: '🎵 Musiqa Topish' },      { text: '� Qidirish' }],h
    ],
    resize_keyboard: true,
  },
};

const NO_KB = { reply_markup: { remove_keyboard: true } };

// ──────────────────────────────────────────────
//  YORDAMCHI FUNKSIYALAR
// ──────────────────────────────────────────────
function md(chatId, text, extra = {}) {
  return bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...extra });
}

function sendTyping(chatId) {
  return bot.sendChatAction(chatId, 'typing');
}

function sendPDF(chatId, key) {
  const p = PDFS[key];
  if (!fs.existsSync(p.file)) {
    return md(chatId, '⚠️ PDF fayli topilmadi. Admin bilan bog\'laning.', MAIN_KB);
  }
  return bot.sendDocument(chatId, p.file, { caption: p.caption, parse_mode: 'Markdown' });
}

// ──────────────────────────────────────────────
//  /start
// ──────────────────────────────────────────────
bot.onText(/\/start/, (msg) => {
  const name = msg.from.first_name || 'Do\'stim';
  userState[msg.chat.id] = null;
  stats.uniqueUsers.add(msg.from.id);
  md(msg.chat.id,
    `🤖 *Assalomu alaykum, ${name}!*\n\n` +
    `Men *Bekzod Help Bot v4.0* — sizga yordam berish uchun yaratilganman!\n\n` +
    `🆕 *Yangiliklar v4.0:*\n` +
    `• 🌍 Real-time API faktlar (ingliz + o\'zbek tarjima)\n` +
    `• 🌤 Ob-havo ma\'lumotlari (istalgan shahar)\n` +
    `• 💱 Valyuta kurslari (real-time)\n` +
    `• 😂 API hazillar\n` +
    `• 💪 Motivatsiya iqtiboslari\n` +
    `• 🤖 Kuchaytirilgan AI suhbat\n` +
    `• 🧮 BMI + maslahat tizimi\n\n` +
    `📌 *Qoidalar:*\n` +
    `• Menyudan tanlang yoki shunchaki yozing ⬇️\n` +
    `• Adminga hurmatli murojaat qiling 🙏`,
    MAIN_KB
  );
});

// ──────────────────────────────────────────────
//  /help
// ──────────────────────────────────────────────
bot.onText(/\/help/, (msg) => {
  md(msg.chat.id,
    `📋 *Buyruqlar ro\'yxati:*\n\n` +
    `/start — Botni qayta ishga tushirish\n` +
    `/help — Yordam\n` +
    `/fact — Tasodifiy fakt (API)\n` +
    `/joke — Hazil\n` +
    `/quote — Motivatsiya\n` +
    `/weather [shahar] — Ob-havo\n` +
    `/currency [dan] [ga] — Valyuta\n` +
    `/bmi — BMI hisoblash\n` +
    `/tip — Hayotiy maslahat\n` +
    `/quiz — Viktorina\n` +
    `/stats — Statistika`,
    MAIN_KB
  );
});

// ──────────────────────────────────────────────
//  SLASH BUYRUQLARI
// ──────────────────────────────────────────────
bot.onText(/\/fact/, async (msg) => {
  await sendTyping(msg.chat.id);
  const { en, uz, emoji, source } = await getFactWithTranslation();
  stats.apiCalls++;
  const sourceLabel = source !== 'local' ? `\n\n_Manba: ${source}_` : '';
  const text = uz
    ? `${emoji} *Qiziqarli Fakt:*\n\n🇬🇧 ${en}\n\n🇺🇿 ${uz}${sourceLabel}`
    : `${emoji} *Qiziqarli Fakt:*\n\n${en}${sourceLabel}`;
  return md(msg.chat.id, text, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [[{ text: '🔄 Yana bir fakt', callback_data: 'fact_api' }]] },
  });
});

bot.onText(/\/joke/, async (msg) => {
  await sendTyping(msg.chat.id);
  const joke = await getJoke();
  stats.apiCalls++;
  md(msg.chat.id, joke, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [[{ text: '😂 Yana hazil', callback_data: 'joke_api' }]] },
  });
});

bot.onText(/\/quote/, async (msg) => {
  await sendTyping(msg.chat.id);
  const { quote, author } = await getQuote();
  stats.apiCalls++;
  md(msg.chat.id,
    `💪 *Motivatsiya:*\n\n_"${quote}"_\n\n— *${author}*`,
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '🔄 Yana bir iqtibos', callback_data: 'quote_api' }]] },
    }
  );
});

bot.onText(/\/weather (.+)/, async (msg, match) => {
  await sendTyping(msg.chat.id);
  const city = match[1];
  const w = await getWeather(city);
  stats.apiCalls++;
  if (!w) return md(msg.chat.id, '❌ Shahar topilmadi yoki xato. Inglizcha yozing: `/weather Tashkent`', MAIN_KB);
  md(msg.chat.id,
    `🌤 *${city} ob-havosi:*\n\n` +
    `🌡 Harorat: *${w.temp}°C* (his qilinishi: ${w.feels}°C)\n` +
    `💧 Namlik: *${w.humidity}%*\n` +
    `💨 Shamol: *${w.wind} km/h*\n` +
    `☁️ Holat: *${w.desc}*`,
    MAIN_KB
  );
});

bot.onText(/\/currency (.+)/, async (msg, match) => {
  await sendTyping(msg.chat.id);
  const parts = match[1].toUpperCase().split(/\s+/);
  const from = parts[0], to = parts[1] || 'UZS', amount = parseFloat(parts[2]) || 1;
  if (!from || !to) return md(msg.chat.id, '⚠️ Format: `/currency USD UZS 100`', MAIN_KB);
  const res = await getCurrency(from, to, amount);
  stats.apiCalls++;
  if (!res) return md(msg.chat.id, '❌ Valyuta topilmadi. Misol: USD, EUR, UZS, RUB', MAIN_KB);
  md(msg.chat.id,
    `💱 *Valyuta Kursi:*\n\n` +
    `${amount} *${from}* = *${res.result} ${to}*\n\n` +
    `📈 Kurs: 1 ${from} = ${res.rate} ${to}`,
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
        [
          { text: '🏃 Sog\'liq', callback_data: 'tip_health' },
          { text: '⚡ Samaradorlik', callback_data: 'tip_productivity' },
        ],
        [
          { text: '📚 O\'rganish', callback_data: 'tip_learning' },
          { text: '🌟 Muvaffaqiyat', callback_data: 'tip_success' },
        ],
      ],
    },
  });
});

bot.onText(/\/quiz/, (msg) => {
  const shuffled = [...QUIZ].sort(() => Math.random() - 0.5).slice(0, 8);
  userState[msg.chat.id] = { mode: 'quiz', questions: shuffled, qIndex: 0, score: 0 };
  const q = shuffled[0];
  md(msg.chat.id,
    `🧠 *Viktorina!* (8 ta savol)\n\n📝 *1/8:* ${q.q}\n\n` +
    q.opts.map((o, i) => `${i+1}. ${o}`).join('\n') + '\n\n_Raqamni yozing (1-4)_'
  );
});

bot.onText(/\/stats/, (msg) => {
  if (msg.from.id !== ADMIN_ID) return;
  const vals = Object.values(ratings);
  const avg  = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1) : '—';
  md(msg.chat.id,
    `📊 *Bot Statistikasi (Admin)*\n\n` +
    `💬 Jami xabarlar: *${stats.totalMessages}*\n` +
    `👥 Unikal foydalanuvchilar: *${stats.uniqueUsers.size}*\n` +
    `🔗 API so\'rovlar: *${stats.apiCalls}*\n` +
    `⭐ O\'rtacha baho: *${avg}/10*\n` +
    `🗂 Baholar soni: *${vals.length}*`
  );
});

bot.onText(/\/reply (\d+) (.+)/, async (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;
  try {
    await md(parseInt(match[1]), `📨 *Admin javobi:*\n\n${match[2]}`, MAIN_KB);
    md(msg.chat.id, '✅ Javob yuborildi!');
  } catch { md(msg.chat.id, '❌ Yuborib bo\'lmadi.'); }
});

// ──────────────────────────────────────────────
//  ASOSIY XABAR HANDLER
// ──────────────────────────────────────────────
bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;
  const chatId = msg.chat.id;
  const text   = msg.text.trim();
  const state  = userState[chatId];
  const lower  = text.toLowerCase();

  stats.totalMessages++;
  stats.uniqueUsers.add(msg.from.id);

  // ══ INLINE BUYRUQLAR (matn orqali) ══════════

  // Ob-havo inline: "ob-havo Toshkent" yoki "weather London"
  if (/^(ob-havo|weather|havo)\s+(.+)/i.test(text)) {
    const cityMatch = text.match(/^(?:ob-havo|weather|havo)\s+(.+)/i);
    const city = cityMatch?.[1];
    if (city) {
      await sendTyping(chatId);
      const w = await getWeather(city);
      stats.apiCalls++;
      if (!w) return md(chatId, `❌ *${city}* shahri uchun ob-havo topilmadi.\n\nInglizchalab yozing: *weather Tashkent*`, MAIN_KB);
      return md(chatId,
        `🌤 *${city} ob-havosi:*\n\n` +
        `🌡 Harorat: *${w.temp}°C* (his qilinishi: ${w.feels}°C)\n` +
        `💧 Namlik: *${w.humidity}%*\n` +
        `💨 Shamol: *${w.wind} km/h*\n` +
        `☁️ Holat: *${w.desc}*`,
        MAIN_KB
      );
    }
  }

  // Valyuta inline: "kurs USD UZS" yoki "kurs USD UZS 100"
  if (/^kurs\s+/i.test(text) || /^(dollar|euro|rubl)\s*(kurs|narx)/i.test(text)) {
    await sendTyping(chatId);
    let from = 'USD', to = 'UZS', amount = 1;
    const m = text.match(/kurs\s+([A-Za-z]{3})\s+([A-Za-z]{3})(?:\s+(\d+))?/i);
    if (m) { from = m[1].toUpperCase(); to = m[2].toUpperCase(); amount = parseFloat(m[3]) || 1; }
    else if (/dollar/i.test(text)) { from = 'USD'; to = 'UZS'; }
    else if (/euro/i.test(text)) { from = 'EUR'; to = 'UZS'; }
    else if (/rubl/i.test(text)) { from = 'RUB'; to = 'UZS'; }
    const res = await getCurrency(from, to, amount);
    stats.apiCalls++;
    if (!res) return md(chatId, '❌ Valyuta kursini yuklab bo\'lmadi. Keyinroq urinib ko\'ring.', MAIN_KB);
    return md(chatId,
      `💱 *Valyuta Kursi:*\n\n${amount} *${from}* = *${res.result} ${to}*\n\n📈 Kurs: 1 ${from} = ${res.rate} ${to}`,
      MAIN_KB
    );
  }

  // Hazil inline
  if (/^(hazil|joke|kuldur|kulgi)$/i.test(lower)) {
    await sendTyping(chatId);
    const joke = await getJoke();
    stats.apiCalls++;
    return md(chatId, joke, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '😂 Yana hazil', callback_data: 'joke_api' }]] },
    });
  }

  // ══ STATE MACHINES ══════════════════════════

  // Rating
  if (state?.mode === 'rating') {
    const n = parseInt(text);
    if (!isNaN(n) && n >= 1 && n <= 10) {
      ratings[chatId] = n;
      const emojis = ['','😢','😔','😕','😐','🙂','😃','😄','😁','🤩','🏆'];
      const msgs   = ['','Afsus...','Bilaman, yaxshilanishga harakat qilamiz.','Tushundik!',
                      'Yaxshilashimiz mumkin.','O\'rtacha, rahmat!','Yaxshi! Davom etamiz.',
                      'Juda yaxshi, mamnunmiz!','Zo\'r!','Juda zo\'r baho!','Mukammal! ❤️'];
      userState[chatId] = null;
      return md(chatId, `${emojis[n]} *${msgs[n]}*\n\nBahoyingiz: *${n}/10* ✅\n\nRahmat, fikringiz muhim! 🙏`, MAIN_KB);
    }
    return md(chatId, '⚠️ 1 dan 10 gacha son kiriting.');
  }

  // Admin savol
  if (state?.mode === 'question') {
    userState[chatId] = null;
    await md(chatId, '✅ Savolingiz adminga yuborildi! 24 soat ichida javob kuting. 😊', MAIN_KB);
    return md(ADMIN_ID,
      `📩 *Yangi savol!*\n\n👤 ${msg.from.first_name} (@${msg.from.username||'—'})\n🆔 \`${msg.from.id}\`\n\n💬 *${text}*\n\n📤 Javob: \`/reply ${msg.from.id} JAVOB\``
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
    userState[chatId] = null;
    return md(chatId, result, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '💪 Ideal vazn hisoblash', callback_data: 'ideal_weight_' + state.weight + '_' + h }],
        ],
        ...MAIN_KB.reply_markup,
      },
    });
  }

  // Tarjimon mode
  if (state?.mode === 'translate') {
    userState[chatId] = null;
    await sendTyping(chatId);
    // Auto-detect: asosan inglizcha bo'lsa uz ga, o'zbekcha bo'lsa en ga
    const hasLatin = /[a-zA-Z]/.test(text);
    const to = hasLatin ? 'uz' : 'en';
    const from = hasLatin ? 'en' : 'uz';
    const translated = await translateAuto(text, from, to);
    stats.apiCalls++;
    const toLang = to === 'uz' ? '🇺🇿 O\'zbekcha' : '🇬🇧 Inglizcha';
    const fromLang = from === 'en' ? '🇬🇧 Inglizcha' : '🇺🇿 O\'zbekcha';
    const encoded = encodeURIComponent(text);
    return md(chatId,
      `🌐 *Tarjima natijasi:*\n\n${fromLang}: _${text}_\n${toLang}: *${translated || 'Tarjima topilmadi'}*`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🌐 Google Translate', url: `https://translate.google.com/?text=${encoded}&sl=auto&tl=${to}` }],
            [{ text: '🔄 Yana tarjima qilish', callback_data: 'translate_more' }],
          ],
          ...MAIN_KB.reply_markup,
        },
      }
    );
  }

  // Raqam topish o'yini
  if (state?.mode === 'guess') {
    const n = parseInt(text);
    if (isNaN(n) || n < 1 || n > 100) return md(chatId, '🔢 1 dan 100 gacha son kiriting.');
    state.tries++;
    if (n < state.secret) return md(chatId, `📈 Kattaroq! (urinish: ${state.tries}/10)`);
    if (n > state.secret) return md(chatId, `📉 Kichikroq! (urinish: ${state.tries}/10)`);
    userState[chatId] = null;
    const stars = state.tries <= 5 ? '🌟🌟🌟 Ajoyib!' : state.tries <= 8 ? '⭐⭐ Yaxshi!' : '⭐ Davom eting!';
    return md(chatId,
      `🎉 *To\'g\'ri! Topding!*\n\nSon: *${state.secret}*\nUrinishlar: *${state.tries}*\n\n${stars}`,
      { parse_mode: 'Markdown', reply_markup: {
        inline_keyboard: [[{ text: '🔄 Qayta o\'ynash', callback_data: 'game_guess' }]],
        ...MAIN_KB.reply_markup,
      }}
    );
  }

  // Tosh-qaychi-qog'oz
  if (state?.mode === 'rps') {
    const map = { 'tosh':0,'qaychi':1,"qog'oz":2,'qogoz':2,'tash':0,'paper':2,'scissors':1,'rock':0 };
    const k = lower.replace(/'/g,"'");
    if (!(k in map)) return md(chatId, "✋ *Tosh*, *Qaychi* yoki *Qog'oz* deb yozing.");
    const opts = ['Tosh 🪨','Qaychi ✂️',"Qog'oz 📄"];
    const botChoice = Math.floor(Math.random() * 3), usr = map[k];
    const diff = (usr - botChoice + 3) % 3;
    const res = diff === 0 ? '🤝 Durrang!' : diff === 1 ? '🏆 Siz yutdingiz!' : '🤖 Men yutdim!';
    userState[chatId] = null;
    return md(chatId,
      `Siz: *${opts[usr]}*\nMen: *${opts[botChoice]}*\n\n${res}`,
      { parse_mode: 'Markdown', reply_markup: {
        inline_keyboard: [[{ text: '🔄 Qayta o\'ynash', callback_data: 'game_rps' }]],
        ...MAIN_KB.reply_markup,
      }}
    );
  }

  // Viktorina
  if (state?.mode === 'quiz') {
    const questions = state.questions || QUIZ;
    const qi = state.qIndex, q = questions[qi];
    const n  = parseInt(text) - 1;
    let fb = '';
    if (n >= 0 && n < q.opts.length) {
      if (n === q.c) { state.score++; fb = '✅ *To\'g\'ri!*\n\n'; }
      else { fb = `❌ *Noto\'g\'ri!*\nTo\'g\'ri javob: *${q.opts[q.c]}*\n\n`; }
      state.qIndex++;
      const total = questions.length;
      if (state.qIndex < total) {
        const nq = questions[state.qIndex];
        return md(chatId,
          fb + `📊 Natija: *${state.score}/${state.qIndex}*\n\n📝 *${state.qIndex+1}/${total}:* ${nq.q}\n\n` +
          nq.opts.map((o,i) => `${i+1}. ${o}`).join('\n') + '\n\n_Raqamni yozing (1-4)_'
        );
      }
      userState[chatId] = null;
      const sc = state.score;
      const medal = sc === total ? '🏆 Mukammal!' : sc >= total * 0.75 ? '🥇 Zo\'r natija!' : sc >= total * 0.5 ? '🥈 Yaxshi!' : '🥉 Ko\'proq mashq!';
      return md(chatId,
        fb + `🏁 *Viktorina tugadi!*\n\nNatija: *${sc}/${total}* (${Math.round(sc/total*100)}%)\n\n${medal}`,
        { parse_mode: 'Markdown', reply_markup: {
          inline_keyboard: [[{ text: '🔄 Qayta o\'ynash', callback_data: 'game_quiz' }]],
          ...MAIN_KB.reply_markup,
        }}
      );
    }
    return md(chatId, `1 dan ${q.opts.length} gacha raqam kiriting.`);
  }

  // ══ MENYU TANLOVLARI ═════════════════════════

  if (text.includes('Loyihalarim') || text.includes('📁')) {
    return md(chatId, `📁 *Bekzod Baratov — Loyihalar*\n\nQuyidagi tugmalarni bosing 👇`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: PROJECTS.map(p => [{ text: p.name, url: p.url }]) },
    });
  }

  if (text.includes('IELTS') || (text.includes('📚') && !text.includes('Python'))) {
    return bot.sendMessage(chatId, '📚 *IELTS PDF Kutubxonasi*\n\nQaysi PDF ni yuklab olishni xohlaysiz?', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📖 Vocabulary (Sinonimlar)', callback_data: 'pdf_vocab' }],
          [{ text: '📝 Grammar Guide (If+Modals)', callback_data: 'pdf_grammar' }],
          [{ text: '🎤 Speaking Phrases (Band 7-9)', callback_data: 'pdf_speaking' }],
          [{ text: '📦 Barcha 3 PDF', callback_data: 'pdf_all' }],
        ],
      },
    });
  }

  if (text.includes('Python') || text.includes('🐍')) {
    return md(chatId, '🐍 *Python O\'rganish Resurslari*', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📗 W3Schools Python',          url: 'https://www.w3schools.com/python/' }],
          [{ text: '📘 Python Rasmiy Docs',         url: 'https://docs.python.org/3/' }],
          [{ text: '🎓 CS50P (Bepul Harvard)',       url: 'https://cs50.harvard.edu/python/2022/' }],
          [{ text: '📺 Corey Schafer (YouTube)',    url: 'https://www.youtube.com/@CoreySchafer' }],
          [{ text: '🚀 Real Python',                url: 'https://realpython.com/' }],
          [{ text: '🤖 Automate Boring Stuff',      url: 'https://automatetheboringstuff.com/' }],
        ],
      },
    });
  }

  if (text.includes('Matematika') || text.includes('🧮')) {
    return md(chatId, '🧮 *Matematika Resurslari*', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📐 Khan Academy',    url: 'https://www.khanacademy.org/math' }],
          [{ text: '🔢 Wolfram Alpha',   url: 'https://www.wolframalpha.com/' }],
          [{ text: '📊 Desmos',          url: 'https://www.desmos.com/calculator' }],
          [{ text: '🧮 Math is Fun',     url: 'https://www.mathsisfun.com/' }],
          [{ text: '📹 3Blue1Brown',     url: 'https://www.youtube.com/@3blue1brown' }],
        ],
      },
    });
  }

  if (text.includes('Faktlar') || (text.includes('🌟') && !text.includes('Motivatsiya'))) {
    await sendTyping(chatId);
    const { en, uz, emoji, source } = await getFactWithTranslation();
    stats.apiCalls++;
    const sourceLabel = source !== 'local' ? `\n\n_Manba: ${source}_` : '';
    const factText = uz
      ? `${emoji} *Qiziqarli Fakt:*\n\n🇬🇧 _${en}_\n\n🇺🇿 *${uz}*${sourceLabel}`
      : `${emoji} *Qiziqarli Fakt:*\n\n${en}${sourceLabel}`;
    return md(chatId, factText, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '🔄 Yana bir fakt', callback_data: 'fact_api' }]] },
    });
  }

  if (text.includes('Maslahatlar') || text.includes('💡')) {
    return md(chatId, getRandomTip(), {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🏃 Sog\'liq', callback_data: 'tip_health' },
            { text: '⚡ Samaradorlik', callback_data: 'tip_productivity' },
          ],
          [
            { text: '📚 O\'rganish', callback_data: 'tip_learning' },
            { text: '🌟 Muvaffaqiyat', callback_data: 'tip_success' },
          ],
        ],
        ...MAIN_KB.reply_markup,
      },
    });
  }

  if (text.includes('Marvel') || text.includes('🎬')) {
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

  if (text.includes("O'yinlar") || text.includes('🎮')) {
    return bot.sendMessage(chatId, '🎮 *O\'yin tanlang:*', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔢 Raqam topish (1-100)',   callback_data: 'game_guess' }],
          [{ text: "✂️ Tosh-Qaychi-Qog'oz",     callback_data: 'game_rps' }],
          [{ text: '🧠 Viktorina (8 savol)',    callback_data: 'game_quiz' }],
        ],
      },
    });
  }

  if (text.includes('Hazillar') || text.includes('😂')) {
    await sendTyping(chatId);
    const joke = await getJoke();
    stats.apiCalls++;
    return md(chatId, joke, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '😂 Yana hazil', callback_data: 'joke_api' }]] },
    });
  }

  if (text.includes('Motivatsiya') || text.includes('💪')) {
    await sendTyping(chatId);
    const { quote, author } = await getQuote();
    stats.apiCalls++;
    return md(chatId,
      `💪 *Motivatsiya:*\n\n_"${quote}"_\n\n— *${author}*`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '🔄 Yana bir iqtibos', callback_data: 'quote_api' }]],
          ...MAIN_KB.reply_markup,
        },
      }
    );
  }

  if (text.includes('Ob-havo') || text.includes('🌤')) {
    userState[chatId] = { mode: 'weather_city' };
    return md(chatId,
      '🌤 *Ob-havo ma\'lumoti*\n\nQaysi shahar ob-havosini bilmoqchisiz?\n\n_Misol: Tashkent, Samarkand, London, Moscow_',
      NO_KB
    );
  }

  if (state?.mode === 'weather_city') {
    await sendTyping(chatId);
    userState[chatId] = null;
    const w = await getWeather(text);
    stats.apiCalls++;
    if (!w) return md(chatId, `❌ *${text}* shahri uchun ob-havo topilmadi.\n\nInglizchalab yozing.`, MAIN_KB);
    return md(chatId,
      `🌤 *${text} ob-havosi:*\n\n` +
      `🌡 Harorat: *${w.temp}°C* (his qilinishi: ${w.feels}°C)\n` +
      `💧 Namlik: *${w.humidity}%*\n` +
      `💨 Shamol: *${w.wind} km/h*\n` +
      `☁️ Holat: *${w.desc}*`,
      MAIN_KB
    );
  }

  if (text.includes('Valyuta') || text.includes('💱')) {
    return md(chatId,
      '💱 *Valyuta Kursi*\n\nQanday format:\n\n👉 *kurs USD UZS*\n👉 *kurs EUR USD 100*\n👉 *dollar kurs*\n👉 *euro kurs*\n\nYoki shunchay yozing!',
      MAIN_KB
    );
  }

  if (text.includes('Adminga') || text.includes('✉️')) {
    userState[chatId] = { mode: 'question' };
    return md(chatId, '✉️ Savolingizni yozing, adminga yuboriladi:', NO_KB);
  }

  if (text.includes('Baholash') || text.includes('⭐')) {
    userState[chatId] = { mode: 'rating' };
    return md(chatId, '⭐ Botni 1 dan 10 gacha baholang (10 — eng yaxshi):', NO_KB);
  }

  if (text.includes('Bot Haqida') || text.includes('ℹ️')) {
    return md(chatId,
      `ℹ️ *Bekzod Help Bot v4.0*\n\n` +
      `👨‍💻 Muallif: *Bekzod Baratov*\n` +
      `📅 Yaratilgan: 2025-yil\n` +
      `🛠 Stack: Node.js + Express\n` +
      `🔄 Versiya: v4.0\n\n` +
      `*Imkoniyatlar:*\n` +
      `• 🌍 Real-time API faktlar + tarjima\n` +
      `• 🌤 Ob-havo (wttr.in)\n` +
      `• 💱 Valyuta kurslari\n` +
      `• 😂 API hazillar (jokeapi.dev)\n` +
      `• 💪 Motivatsiya iqtiboslari (zenquotes.io)\n` +
      `• 📁 5 ta loyiha\n` +
      `• 📚 3 ta IELTS PDF\n` +
      `• 🤖 Kuchaytirilgan AI suhbat\n` +
      `• 🎮 3 ta o\'yin\n` +
      `• 🔢 BMI + maslahat\n` +
      `• 🌐 Tarjimon (MyMemory)\n` +
      `• 💡 4 kategoriyali maslahatlar\n` +
      `• ✉️ Admin aloqasi\n` +
      `• ⭐ Baho tizimi`,
      MAIN_KB
    );
  }

  if (text.includes('Statistika') || text.includes('📊')) {
    const vals = Object.values(ratings);
    const avg  = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1) : '—';
    return md(chatId,
      `📊 *Bot Statistikasi*\n\n` +
      `💬 Jami xabarlar: *${stats.totalMessages}*\n` +
      `👥 Foydalanuvchilar: *${stats.uniqueUsers.size}*\n` +
      `🔗 API so\'rovlar: *${stats.apiCalls}*\n` +
      `⭐ O\'rtacha baho: *${avg}/10*\n` +
      `🌟 Faktlar soni: *${FACTS_STATIC.length}+ (API + statik)*\n` +
      `📁 Loyihalar: *${PROJECTS.length}*\n` +
      `📚 PDF kutubxona: *3 ta PDF*`,
      MAIN_KB
    );
  }

  if (text.includes('BMI') || text.includes('🔢')) {
    userState[chatId] = { mode: 'bmi_weight' };
    return md(chatId, '⚖️ *BMI Hisoblagich*\n\nVazningizni kiriting (kg, masalan: 70):', NO_KB);
  }

  if (text.includes('Tarjimon') || text.includes('🌐')) {
    userState[chatId] = { mode: 'translate' };
    return md(chatId,
      '🌐 *Tarjima tizimi*\n\nSo\'z yoki jumlani yozing:\n• Inglizcha → O\'zbekchaga\n• O\'zbekcha → Inglizchaga\n\n_(avtomatik aniqlaydi)_',
      NO_KB
    );
  }

  // ══ RASM YARATISH ═════════════════════════════
  if (text.includes('Rasm Yaratish') || text.includes('🎨')) {
    userState[chatId] = { mode: 'image_gen' };
    return md(chatId,
      '🎨 *Rasm Yaratish*\n\nRasm haqida inglizcha yozing:\n👉 _a cat sitting on a mountain_\n👉 _sunset over ocean, realistic_\n👉 _futuristic city at night_\n\n_(Inglizcha yozsangiz yaxshiroq natija beradi)_',
      NO_KB
    );
  }

  if (state?.mode === 'image_gen') {
    userState[chatId] = null;
    await sendTyping(chatId);
    const prompt = encodeURIComponent(text);
    const imageUrl = `https://image.pollinations.ai/prompt/${prompt}?width=512&height=512&nologo=true`;
    try {
      await bot.sendPhoto(chatId, imageUrl, {
        caption: `🎨 *${text}*`,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '🔄 Yana rasm', callback_data: `img_${text.slice(0,50)}` }]],
          ...MAIN_KB.reply_markup,
        },
      });
    } catch {
      md(chatId, '❌ Rasm yaratib bo\'lmadi. Boshqa so\'z bilan urinib ko\'ring.', MAIN_KB);
    }
    return;
  }

  // ══ MUSIQA TOPISH ════════════════════════════
  if (text.includes('Musiqa') || text.includes('🎵')) {
    userState[chatId] = { mode: 'music_search' };
    return md(chatId,
      '🎵 *Musiqa Topish*\n\nQo\'shiq nomi, ijrochi yoki YouTube link yozing:\n👉 _Dua Lipa Levitating_\n👉 _https://youtu.be/xxxxx_\n👉 _Shaxriyor Yomg\'ir_',
      NO_KB
    );
  }

  if (state?.mode === 'music_search') {
    userState[chatId] = null;
    await sendTyping(chatId);

    // YouTube link berilgan bo'lsa — to'g'ridan ID olish
    let videoId = null;
    let videoTitle = text;
    const ytLinkMatch = text.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/);
    if (ytLinkMatch) {
      videoId = ytLinkMatch[1];
    } else {
      // Nom bo'yicha qidirish
      const query = encodeURIComponent(text);
      try {
        const html = await fetchText(`https://www.youtube.com/results?search_query=${query}`);
        const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
        if (match) videoId = match[1];
        const titleMatch = html.match(/"title":{"runs":\[{"text":"([^"]+)"/);
        if (titleMatch) videoTitle = titleMatch[1];
      } catch {}
    }

    if (!videoId) {
      return md(chatId, '❌ Qo\'shiq topilmadi. Boshqacha yozing yoki YouTube link yuboring.', {
        reply_markup: { inline_keyboard: [[{ text: '🔄 Qayta urinish', callback_data: 'music_again' }]] }
      });
    }

    const ytUrl = `https://youtube.com/watch?v=${videoId}`;
    const q = encodeURIComponent(videoTitle !== text ? videoTitle : text);

    return md(chatId,
      `🎵 *${videoTitle}*`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '⬇️ MP3 yuklab olish', url: `https://yt1s.com/youtube-to-mp3?q=${q}` }],
            [{ text: '⬇️ Boshqa converter', url: `https://ytmp3.cc/youtube-to-mp3/?url=${encodeURIComponent(ytUrl)}` }],
            [{ text: '▶️ YouTube', url: ytUrl }],
            [{ text: '🔄 Boshqa qo\'shiq', callback_data: 'music_again' }],
          ],
        },
      }
    );
  }

  // ══ QIDIRISH ══════════════════════════════════
  if (text.includes('Qidirish') || text.includes('🔍')) {
    userState[chatId] = { mode: 'web_search' };
    return md(chatId,
      '🔍 *Qidirish*\n\nNima qidirmoqchisiz?\n👉 _Python darslari_\n👉 _Toshkent ob-havosi_\n👉 _iPhone 15 narxi_',
      NO_KB
    );
  }

  if (state?.mode === 'web_search') {
    userState[chatId] = null;
    const q = encodeURIComponent(text);
    return md(chatId, `🔍 *"${text}"* bo'yicha qidirish:`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🌐 Google', url: `https://www.google.com/search?q=${q}` }],
          [{ text: '📺 YouTube', url: `https://www.youtube.com/results?search_query=${q}` }],
          [{ text: '📖 Wikipedia', url: `https://uz.wikipedia.org/w/index.php?search=${q}` }],
          [{ text: '🔄 Yana qidirish', callback_data: 'search_again' }],
        ],
      },
    });
  }

  // ══ TASODIFIY TANLOV ══════════════════════════
  if (text.includes('Tasodifiy') || text.includes('🎲') ||
      /yoki/i.test(text) && text.includes('?')) {
    // "pizza yoki osh?" formatini parse qilish
    const orMatch = text.replace('?','').match(/(.+?)\s+yoki\s+(.+)/i);
    if (orMatch) {
      const options = [orMatch[1].trim(), orMatch[2].trim()];
      const chosen = options[Math.floor(Math.random() * options.length)];
      return md(chatId,
        `🎲 *Tasodifiy tanlov:*\n\n${options.map(o => `• ${o}`).join('\n')}\n\n🏆 Tanlov: *${chosen}*`,
        MAIN_KB
      );
    }
    userState[chatId] = { mode: 'random_choice' };
    return md(chatId,
      '🎲 *Tasodifiy Tanlov*\n\nVariantlarni yozing:\n👉 *pizza yoki osh?*\n👉 *kino yoki kitob?*\n👉 *uy yoki ko\'cha?*',
      NO_KB
    );
  }

  if (state?.mode === 'random_choice') {
    userState[chatId] = null;
    const orMatch = text.replace('?','').match(/(.+?)\s+yoki\s+(.+)/i);
    if (!orMatch) return md(chatId, '⚠️ Format: *pizza yoki osh?*', MAIN_KB);
    const options = [orMatch[1].trim(), orMatch[2].trim()];
    const chosen = options[Math.floor(Math.random() * options.length)];
    return md(chatId,
      `🎲 *Tasodifiy tanlov:*\n\n${options.map(o => `• ${o}`).join('\n')}\n\n🏆 Tanlov: *${chosen}*`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '🔄 Qayta tashlash', callback_data: `rnd_${text}` }]],
          ...MAIN_KB.reply_markup,
        },
      }
    );
  }

  // ══ AI JAVOB (kalit so'zlar) ══════════════════
  const ai = aiReply(text);
  if (ai) return md(chatId, ai, MAIN_KB);

  // ══ GROQ AI — har qanday savol ════════════════
  await sendTyping(chatId);
  const { answer: groqAnswer, error: groqError } = await askGroq(text, chatId);
  if (groqAnswer) {
    return md(chatId, groqAnswer, {
      parse_mode: 'Markdown',
      reply_markup: MAIN_KB.reply_markup,
    });
  }

  // ══ DEBUG: xatoni ko'rsatish ════════════════
  if (groqError) {
    return md(chatId, `⚠️ *AI xatosi (debug):*\n\`${groqError}\``, MAIN_KB);
  }

  // ══ DEFAULT ════════════════════════════════
  const defaults = [
    '🤔 Tushunmadim. Menyudan tanlang yoki aniqroq yozing! 😊',
    '💡 Bu buyruqni bilmayman. Menyudan kerakli bo\'limni tanlang! 👇',
    '🤖 Hmm... Boshqacha so\'rash mumkinmi? Yoki menyudan tanlang!',
  ];
  md(chatId, defaults[Math.floor(Math.random() * defaults.length)], MAIN_KB);
});

// ──────────────────────────────────────────────
//  CALLBACK QUERIES
// ──────────────────────────────────────────────
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data   = query.data;
  await bot.answerCallbackQuery(query.id);

  // PDF
  if (data === 'pdf_vocab')    return sendPDF(chatId, 'vocab');
  if (data === 'pdf_grammar')  return sendPDF(chatId, 'grammar');
  if (data === 'pdf_speaking') return sendPDF(chatId, 'speaking');
  if (data === 'pdf_all') {
    await md(chatId, '📦 Barcha 3 ta PDF yuborilmoqda...');
    await sendPDF(chatId, 'vocab');
    await sendPDF(chatId, 'grammar');
    await sendPDF(chatId, 'speaking');
    return md(chatId, '✅ Barcha PDFlar yuborildi! Muvaffaqiyatlar! 🎓', MAIN_KB);
  }

  // Faktlar (API)
  if (data === 'fact_api') {
    await bot.answerCallbackQuery(query.id, { text: '⏳ Yuklanmoqda...' });
    await sendTyping(chatId);
    const { en, uz, emoji, source } = await getFactWithTranslation();
    stats.apiCalls++;
    const sourceLabel = source !== 'local' ? `\n\n_Manba: ${source}_` : '';
    const factText = uz
      ? `${emoji} *Qiziqarli Fakt:*\n\n🇬🇧 _${en}_\n\n🇺🇿 *${uz}*${sourceLabel}`
      : `${emoji} *Qiziqarli Fakt:*\n\n${en}${sourceLabel}`;
    return md(chatId, factText, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '🔄 Yana bir fakt', callback_data: 'fact_api' }]] },
    });
  }

  // Hazil (API)
  if (data === 'joke_api') {
    await bot.answerCallbackQuery(query.id, { text: '😂 Yuklanyapti...' });
    await sendTyping(chatId);
    const joke = await getJoke();
    stats.apiCalls++;
    return md(chatId, joke, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '😂 Yana hazil', callback_data: 'joke_api' }]] },
    });
  }

  // Iqtibos (API)
  if (data === 'quote_api') {
    await bot.answerCallbackQuery(query.id, { text: '💪 Yuklanmoqda...' });
    await sendTyping(chatId);
    const { quote, author } = await getQuote();
    stats.apiCalls++;
    return md(chatId,
      `💪 *Motivatsiya:*\n\n_"${quote}"_\n\n— *${author}*`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '🔄 Yana bir iqtibos', callback_data: 'quote_api' }]] },
      }
    );
  }

  // Maslahatlar kategoriyalari
  if (data.startsWith('tip_')) {
    const cat = data.replace('tip_', '');
    return md(chatId, getRandomTip(cat), {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🏃 Sog\'liq', callback_data: 'tip_health' },
            { text: '⚡ Samaradorlik', callback_data: 'tip_productivity' },
          ],
          [
            { text: '📚 O\'rganish', callback_data: 'tip_learning' },
            { text: '🌟 Muvaffaqiyat', callback_data: 'tip_success' },
          ],
        ],
        ...MAIN_KB.reply_markup,
      },
    });
  }

  // Tarjima yana
  if (data === 'translate_more') {
    userState[chatId] = { mode: 'translate' };
    return md(chatId, '🌐 Tarjima qilmoqchi bo\'lgan so\'z yoki jumlani yozing:', NO_KB);
  }

  // Rasm — qayta yaratish
  if (data.startsWith('img_')) {
    const prompt = data.replace('img_', '');
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true&seed=${Math.floor(Math.random()*9999)}`;
    try {
      await bot.sendPhoto(chatId, imageUrl, {
        caption: `🎨 *${prompt}*`,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '🔄 Yana rasm', callback_data: `img_${prompt}` }]],
          ...MAIN_KB.reply_markup,
        },
      });
    } catch {
      md(chatId, '❌ Rasm yaratib bo\'lmadi.', MAIN_KB);
    }
    return;
  }

  // Musiqa — qayta qidirish
  if (data === 'music_again') {
    userState[chatId] = { mode: 'music_search' };
    return md(chatId, '🎵 Qo\'shiq nomi yoki ijrochi yozing:', NO_KB);
  }

  if (data === 'search_again') {
    userState[chatId] = { mode: 'web_search' };
    return md(chatId, '🔍 Nima qidirmoqchisiz?', NO_KB);
  }

  // Tasodifiy tanlov — qayta tashlash
  if (data.startsWith('rnd_')) {
    const originalText = data.replace('rnd_', '');
    const orMatch = originalText.replace('?','').match(/(.+?)\s+yoki\s+(.+)/i);
    if (orMatch) {
      const options = [orMatch[1].trim(), orMatch[2].trim()];
      const chosen = options[Math.floor(Math.random() * options.length)];
      return md(chatId,
        `🎲 *Tasodifiy tanlov:*\n\n${options.map(o => `• ${o}`).join('\n')}\n\n🏆 Tanlov: *${chosen}*`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '🔄 Qayta tashlash', callback_data: `rnd_${originalText}` }]],
            ...MAIN_KB.reply_markup,
          },
        }
      );
    }
  }

  // O'yinlar
  if (data === 'game_guess') {
    userState[chatId] = { mode: 'guess', secret: Math.floor(Math.random()*100)+1, tries: 0 };
    return md(chatId, '🔢 *Raqam topish!*\n\n1 dan 100 gacha son o\'yladim.\nTopish uchun 10 ta urinish bor! 🤔');
  }

  if (data === 'game_rps') {
    userState[chatId] = { mode: 'rps' };
    return md(chatId, "✂️ *Tosh-Qaychi-Qog'oz*\n\nYozing: *Tosh* 🪨, *Qaychi* ✂️ yoki *Qog'oz* 📄");
  }

  if (data === 'game_quiz') {
    const shuffled = [...QUIZ].sort(() => Math.random() - 0.5).slice(0, 8);
    userState[chatId] = { mode: 'quiz', questions: shuffled, qIndex: 0, score: 0 };
    const q = shuffled[0];
    return md(chatId,
      `🧠 *Viktorina!* (8 ta savol)\n\n📝 *1/8:* ${q.q}\n\n` +
      q.opts.map((o, i) => `${i+1}. ${o}`).join('\n') + '\n\n_Raqamni yozing (1-4)_'
    );
  }

  // Ideal vazn (BMI dan keyin)
  if (data.startsWith('ideal_weight_')) {
    const parts = data.split('_');
    // ideal_weight_WEIGHT_HEIGHT
    const height = parseFloat(parts[parts.length - 1]);
    userState[chatId] = { mode: 'ideal_gender', height };
    return md(chatId, '👤 Jinsingizni tanlang:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '👨 Erkak', callback_data: `ideal_calc_erkak_${height}` }],
          [{ text: '👩 Ayol', callback_data: `ideal_calc_ayol_${height}` }],
        ],
      },
    });
  }

  if (data.startsWith('ideal_calc_')) {
    const parts = data.replace('ideal_calc_', '').split('_');
    const gender = parts[0];
    const height = parseFloat(parts[1]);
    return md(chatId, calcIdealWeight(height, gender), MAIN_KB);
  }
});

// ──────────────────────────────────────────────
//  EXPRESS SERVER
// ──────────────────────────────────────────────
app.get('/', (_, res) => res.json({ status: 'ok', bot: 'Bekzod Help Bot v4', version: '4.0' }));
app.get('/health', (_, res) => res.json({
  uptime: process.uptime().toFixed(0) + 's',
  messages: stats.totalMessages,
  users: stats.uniqueUsers.size,
  apiCalls: stats.apiCalls,
}));
app.listen(PORT, '0.0.0.0', () => console.log(`🌐 Express server: http://0.0.0.0:${PORT}`));

// ──────────────────────────────────────────────
//  START
// ──────────────────────────────────────────────
console.log('');
console.log('╔════════════════════════════════════════╗');
console.log('║  BEKZOD HELP BOT v4.0 — Ishga tushdi! ║');
console.log('╚════════════════════════════════════════╝');
console.log('🤖 Telegram polling...');
console.log(`🔑 GROQ_API_KEY: ${process.env.GROQ_API_KEY ? '✅ topildi (' + process.env.GROQ_API_KEY.slice(0,8) + '...)' : '❌ YO\'Q!'}`);
console.log(`🌐 Express: http://localhost:${PORT}`);
console.log('✅ API ulangan: UselessFacts, NumbersAPI, CatFact');
console.log('✅ API ulangan: MyMemory Tarjima, wttr.in Ob-havo');
console.log('✅ API ulangan: ExchangeRate, JokeAPI, ZenQuotes');
