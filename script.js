// DiaLife — логика приложения (данные хранятся в localStorage браузера)
const $ = (s) => document.querySelector(s);
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

let readings = load("dl_glu", []);   // {v, when, t}
let meals = load("dl_meals", []);    // {xe, t}
let meal = [];                       // текущий приём пищи

// ---------- Навигация ----------
function go(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === id));
  document.querySelectorAll(".nav button").forEach((b) => b.classList.toggle("active", b.dataset.go === id));
  window.scrollTo(0, 0);
  if (id === "sugar") drawChart();
}
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-go]");
  if (el) { e.preventDefault(); go(el.dataset.go); }
});

// ---------- Сахар ----------
const status = (v) => v < 3.9 ? ["low", "Низкий"] : v > 10 ? ["high", "Высокий"] : v > 7.8 ? ["", "Повышен"] : ["ok", "В норме"];
const fmt = (t) => new Date(t).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function renderSugar() {
  const list = $("#gluList");
  list.innerHTML = "";
  readings.slice(-8).reverse().forEach((r) => {
    const [cls, label] = status(r.v);
    const li = document.createElement("li");
    li.innerHTML = `<span><b></b> ммоль/л · <span class="muted"></span></span><span class="tag ${cls}">${label}</span>`;
    li.querySelector("b").textContent = r.v.toFixed(1);
    li.querySelector(".muted").textContent = `${r.when}, ${fmt(r.t)}`;
    list.append(li);
  });
  const last = readings[readings.length - 1];
  $("#lastGlu").textContent = last ? last.v.toFixed(1) : "—";
  $("#lastGluNote").textContent = last ? `${status(last.v)[1]} · ${fmt(last.t)}` : "Замеров пока нет";
  const week = readings.filter((r) => Date.now() - r.t < 7 * 864e5);
  if (week.length) {
    $("#avgGlu").textContent = (week.reduce((a, r) => a + r.v, 0) / week.length).toFixed(1);
    const inR = week.filter((r) => r.v >= 3.9 && r.v <= 10).length;
    $("#inRange").textContent = `В целевом диапазоне: ${Math.round((inR / week.length) * 100)}%`;
  }
  const today = new Date().toDateString();
  $("#xeToday").textContent = meals.filter((m) => new Date(m.t).toDateString() === today).reduce((a, m) => a + m.xe, 0).toFixed(1);
  drawChart();
}

function drawChart() {
  const c = $("#chart"), w = (c.width = c.clientWidth || 600), h = c.height, g = c.getContext("2d");
  g.clearRect(0, 0, w, h);
  const pts = readings.slice(-12);
  const y = (v) => h - 20 - ((v - 2) / 16) * (h - 40);
  g.fillStyle = "#E9FFF9"; g.fillRect(0, y(10), w, y(3.9) - y(10)); // целевая зона 3.9–10
  if (pts.length < 2) { g.fillStyle = "#467599"; g.font = "14px sans-serif"; g.fillText("Добавьте 2+ замера, чтобы увидеть график", 12, h / 2); return; }
  g.strokeStyle = "#1D3354"; g.lineWidth = 2; g.beginPath();
  pts.forEach((r, i) => { const x = 20 + (i / (pts.length - 1)) * (w - 40); i ? g.lineTo(x, y(r.v)) : g.moveTo(x, y(r.v)); });
  g.stroke();
  pts.forEach((r, i) => { const x = 20 + (i / (pts.length - 1)) * (w - 40); g.fillStyle = status(r.v)[0] === "ok" ? "#467599" : "#D64045"; g.beginPath(); g.arc(x, y(r.v), 5, 0, 7); g.fill(); });
}

$("#saveGlu").onclick = () => {
  const v = parseFloat($("#gluVal").value.replace(",", "."));
  const msg = $("#gluMsg");
  if (!(v >= 1 && v <= 40)) { msg.textContent = "Введите значение от 1 до 40 ммоль/л."; return; }
  readings.push({ v, when: $("#gluWhen").value, t: Date.now() });
  save("dl_glu", readings);
  $("#gluVal").value = "";
  msg.textContent = v < 3.9
    ? "Сахар низкий: съешьте 15 г быстрых углеводов (например, сок 150 мл) и перемерьте через 15 минут."
    : v > 13 ? "Сахар сильно повышен: проверьте кетоны (при 1 типе) и свяжитесь с врачом по вашему плану." : "Замер сохранён.";
  renderSugar();
};

// ---------- Еда и ХЕ ----------
const FOODS = { // углеводы, г на 100 г
  "Хлеб белый": 49, "Гречка варёная": 21, "Рис варёный": 28, "Макароны варёные": 25, "Картофель варёный": 17,
  "Овсянка на воде": 12, "Яблоко": 11, "Банан": 21, "Молоко": 5, "Яблочный сок": 11, "Куриная грудка": 0, "Овощной салат": 4, "Пицца": 33,
};
Object.keys(FOODS).forEach((n) => $("#prod").append(new Option(n, n)));
const xeOf = (name, g) => (FOODS[name] * g) / 100 / 12;

function renderMeal() {
  const ul = $("#meal"); ul.innerHTML = "";
  meal.forEach((m, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<span></span><button class="tag" aria-label="Убрать">${xeOf(m.n, m.g).toFixed(1)} ХЕ ✕</button>`;
    li.firstChild.textContent = `${m.n}, ${m.g} г`;
    li.querySelector("button").onclick = () => { meal.splice(i, 1); renderMeal(); };
    ul.append(li);
  });
  $("#mealXe").textContent = meal.reduce((a, m) => a + xeOf(m.n, m.g), 0).toFixed(1) + " ХЕ";
}
$("#addProd").onclick = () => {
  const g = parseFloat($("#grams").value);
  if (g > 0) { meal.push({ n: $("#prod").value, g }); renderMeal(); }
};
$("#saveMeal").onclick = () => {
  if (!meal.length) return;
  meals.push({ xe: meal.reduce((a, m) => a + xeOf(m.n, m.g), 0), t: Date.now() });
  save("dl_meals", meals); meal = []; renderMeal(); renderSugar();
  $("#photoMsg").textContent = "Приём пищи сохранён.";
};
$("#photoBtn").onclick = () => $("#photo").click();
$("#photo").onchange = (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const img = $("#preview"); img.src = URL.createObjectURL(f); img.hidden = false;
  // ДЕМО: настоящее распознавание требует сервера с моделью. Здесь подставляется пример тарелки.
  meal = [{ n: "Гречка варёная", g: 150 }, { n: "Куриная грудка", g: 100 }, { n: "Овощной салат", g: 80 }];
  renderMeal();
  $("#photoMsg").textContent = "Демо-распознавание: предложен пример блюда. Поправьте вес и состав вручную.";
};

// ---------- Обучение ----------
const LESSONS = [
  ["Что такое диабет 1 и 2 типа", "При 1 типе поджелудочная почти не вырабатывает инсулин, нужна инсулинотерапия. При 2 типе инсулин есть, но ткани плохо на него реагируют; лечение — питание, активность, таблетки, иногда инсулин."],
  ["Как измерять сахар", "Мойте руки, берите каплю сбоку подушечки пальца. Мерьте натощак, до и через 2 часа после еды, перед сном. Записывайте результаты в дневник."],
  ["Что такое хлебная единица (ХЕ)", "1 ХЕ = 12 г углеводов. Это удобная мера, чтобы сравнивать продукты и планировать приём пищи. Считайте углеводы, а не калории."],
  ["Гипогликемия: что делать", "Сахар ниже 3,9 ммоль/л: слабость, дрожь, потливость. Съешьте 15 г быстрых углеводов (150 мл сока, глюкоза), перемерьте через 15 минут."],
  ["Гипергликемия и когда к врачу", "Сильная жажда, частое мочеиспускание, сахар выше 13 ммоль/л, тошнота — повод связаться с врачом. При 1 типе проверьте кетоны."],
];
LESSONS.forEach(([t, d], i) => {
  const el = document.createElement("details");
  el.className = "card lesson";
  el.innerHTML = `<summary></summary><p></p>`;
  el.querySelector("summary").textContent = `Урок ${i + 1}. ${t}`;
  el.querySelector("p").textContent = d;
  $("#lessons").append(el);
});

// ---------- AI-помощник (демо на правилах) ----------
const RULES = [
  [/гипо|низк|3[.,]\d|дрож|потлив/, "Похоже на низкий сахар. Съешьте 15 г быстрых углеводов (сок 150 мл или глюкоза), перемерьте через 15 минут. Если не проходит или есть спутанность сознания — вызовите скорую."],
  [/хе|хлебн|углевод/, "1 ХЕ = 12 г углеводов. Откройте «Еда и ХЕ», сфотографируйте блюдо или выберите продукты — я посчитаю ХЕ."],
  [/инсулин|доз/, "Дозы инсулина подбирает только врач. Я могу помочь посчитать ХЕ и записать сахар, чтобы вы показали дневник эндокринологу."],
  [/высок|13|жажд|кетон/, "При сахаре выше 13 ммоль/л и жажде выпейте воды, проверьте кетоны (при 1 типе) и свяжитесь с врачом."],
  [/ед[ау]|питан|ужин|завтрак|обед/, "Выбирайте продукты с клетчаткой: овощи, цельнозерновые, белок. Сладкие напитки и белый хлеб поднимают сахар быстрее."],
  [/привет|здравств/, "Здравствуйте! Я помогу с сахаром, ХЕ и питанием. О чём хотите спросить?"],
];
function say(text, who) {
  const b = document.createElement("div");
  b.className = "bubble " + who; b.textContent = text;
  $("#chat").append(b); $("#chat").scrollTop = 1e6;
}
function ask() {
  const q = $("#q").value.trim();
  if (!q) return;
  say(q, "me"); $("#q").value = "";
  const hit = RULES.find(([re]) => re.test(q.toLowerCase()));
  setTimeout(() => say(hit ? hit[1] : "Пока я знаю не всё. Попробуйте спросить про сахар, ХЕ, питание или гипогликемию.", "bot"), 400);
}
$("#send").onclick = ask;
$("#q").addEventListener("keydown", (e) => e.key === "Enter" && ask());
say("Привет! Я AI-помощник DiaLife. Спросите про сахар, ХЕ или питание.", "bot");

// ---------- Старт ----------
const hr = new Date().getHours();
$("#hello").textContent = hr < 6 ? "Доброй ночи!" : hr < 12 ? "Доброе утро!" : hr < 18 ? "Добрый день!" : "Добрый вечер!";
$("#dtype").value = load("dl_type", "1");
$("#dtype").onchange = (e) => save("dl_type", e.target.value);
window.addEventListener("resize", () => $("#sugar").classList.contains("active") && drawChart());
renderSugar(); renderMeal();
