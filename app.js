// =====================
// ✅ ตั้งค่าใช้งานตรงนี้
// =====================
const MODE = "ON_ESP";       // DEMO | FILE_TO_ESP | ON_ESP
let apiUrl = "https://Tui.trycloudflare.com/api";
let DEMO_MODE = false;

if (MODE === "DEMO") {
  DEMO_MODE = true;
  apiUrl = "/api";
} else if (MODE === "FILE_TO_ESP") {
  DEMO_MODE = false;
  apiUrl = `http://${ESP_IP}/api`;
} else if (MODE === "ON_ESP") {
  DEMO_MODE = false;
  apiUrl = "/api";
}

const el = {
  status: document.getElementById("status"),
  voltage: document.getElementById("voltage"),
  current: document.getElementById("current"),
  hz: document.getElementById("hz"),
  watt: document.getElementById("watt"),
  uptime: document.getElementById("uptime"),
  relayState: document.getElementById("relayState"),

  btnOnce: document.getElementById("btnOnce"),
  btnToggle: document.getElementById("btnToggle"),
  btnLightOn: document.getElementById("btnLightOn"),
  btnLightOff: document.getElementById("btnLightOff"),
};

let timer = null;
let running = true;

function setStatus(text, ok = null) {
  if (!el.status) return;
  el.status.textContent = text;
  el.status.classList.remove("ok", "bad");
  if (ok === true) el.status.classList.add("ok");
  if (ok === false) el.status.classList.add("bad");
}

function fmt(n, digits = 2) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "-";
  return x.toFixed(digits);
}

async function fetchJson(url) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 1500);
  try {
    const r = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

// ✅ ส่งคำสั่งไป /relay?state=1 หรือ 0 (ยังไม่แก้ ESP32 ก็ได้ แต่ถ้าไม่มี endpoint จะ fail)
async function sendRelay(state) {
  const base = apiUrl.replace(/\/api$/, "");
  const url = `${base}/relay?state=${state}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return await r.json(); // คาดหวัง { relay: 1 } หรือ { relay: 0 } (ถ้ามี)
}

function demoData() {
  const now = Math.floor(Date.now() / 1000);
  const v = 220 + (Math.random() - 0.5) * 2;
  const i = Math.random() < 0.85 ? 0 : (0.2 + Math.random() * 0.8);
  return { voltage: v, current: i, hz: 50, uptime_s: now, relay: Math.random() > 0.5 ? 1 : 0 };
}

function setRelayState(val) {
  if (!el.relayState) return;
  if (val === 1 || val === true) el.relayState.textContent = "ON";
  else if (val === 0 || val === false) el.relayState.textContent = "OFF";
  else el.relayState.textContent = "-";
}

function render(data) {
  const v = Number(data.voltage ?? data.vrms ?? 0);
  const i = Number(data.current ?? data.irms ?? 0);
  const hz = Number(data.hz ?? 0);

  if (el.voltage) el.voltage.textContent = fmt(v, 1);
  if (el.current) el.current.textContent = fmt(i, 3);
  if (el.hz) el.hz.textContent = fmt(hz, 2);
  if (el.uptime) el.uptime.textContent = (data.uptime_s ?? "-");

  if (el.watt) {
    const w = Number(data.watt ?? (v * i)); // (ประมาณ) ถ้า ESP ยังไม่ส่ง watt
    el.watt.textContent = fmt(w, 2);
  }

  // ถ้า /api ส่ง relay มา จะอัปเดตให้
  if (data.relay !== undefined) setRelayState(data.relay);
}

let failCount = 0;

async function tick() {
  try {
    const data = DEMO_MODE ? demoData() : await fetchJson(apiUrl);
    render(data);
    failCount = 0;
    setStatus(`ออนไลน์ (เช็ค ${apiUrl})`, true);
  } catch (e) {
    failCount++;
    if (failCount >= 2) setStatus(`ออฟไลน์ (เช็ค ${apiUrl})`, false);
  }
}

function start() {
  if (timer) clearInterval(timer);
  timer = setInterval(tick, 1000);
  tick();
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

if (el.btnOnce) el.btnOnce.onclick = () => tick();

if (el.btnToggle) el.btnToggle.onclick = () => {
  running = !running;
  if (running) {
    el.btnToggle.textContent = "หยุดอัปเดต";
    start();
  } else {
    el.btnToggle.textContent = "เริ่มอัปเดต";
    stop();
    setStatus("หยุดอัปเดตแล้ว", null);
  }
};

// ✅ ปุ่ม เปิด/ปิดไฟ (ทำงานเมื่อ ESP32 มี /relay)
if (el.btnLightOn) el.btnLightOn.onclick = async () => {
  try {
    const r = await sendRelay(1);
    setRelayState(r?.relay ?? 1);
    setStatus("สั่ง: เปิดไฟ ✅", true);
  } catch {
    setStatus("สั่งเปิดไฟไม่สำเร็จ (ยังไม่มี /relay?)", false);
  }
};

if (el.btnLightOff) el.btnLightOff.onclick = async () => {
  try {
    const r = await sendRelay(0);
    setRelayState(r?.relay ?? 0);
    setStatus("สั่ง: ปิดไฟ ✅", true);
  } catch {
    setStatus("สั่งปิดไฟไม่สำเร็จ (ยังไม่มี /relay?)", false);
  }
};

start();
