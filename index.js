// ═══════════════════════════════════════════════════════════════════════════
//  REGISTRO DE CAMBIOS respecto al index.js original
//  Cada cambio está marcado en el código con su etiqueta: [FIX n] o [OPT n].
//  Busca la etiqueta (Ctrl+F) para ver el código exacto y su explicación.
//
//  ── FASE 1 · Corrección de errores ──────────────────────────────────────────
//  [FIX 1] Remitentes @lid: el original generaba "undefined@s.whatsapp.net".
//          Ahora resolveSender() obtiene el número real (o deja el LID si no puede).
//  [FIX 2] QR: ya no se llama a qrcode.generate(undefined) con --qr.
//  [FIX 3] startBot(): si fallaba antes de crear el socket, isRestarting quedaba
//          en true para siempre y el bot no volvía a conectarse.
//  [FIX 4] Límite de reintentos: ya NO borra la sesión (5 min sin internet te
//          obligaban a vincular de nuevo). Ahora sigue intentando cada 60 s.
//  [FIX 5] Mensaje de badSession: decía "limpiando" pero nunca limpiaba.
//  [FIX 6] cleanCache(): borraba archivos de tmp que podían estar en uso.
//  [FIX 7] initDB(): initDB() y clearDB() ahora se esperan con await.
//
//  ── FASE 2 · Optimizaciones ─────────────────────────────────────────────────
//  [OPT 1] messages.upsert: eliminado código muerto (prefix/command/args/q/pushname
//          y el 3er argumento) que el handler nunca usaba.
//  [OPT 2] Imports sin uso eliminados (node-cache, setCachedMeta).
//  [OPT 3] REVERTIDO. Se había añadido cachedGroupMetadata (Baileys reutilizaba tu
//          caché de grupos al enviar), pero el comando .aviso dejó de llegar a los
//          grupos y solo llegaba al canal. Se quitó y vuelve el comportamiento original.
//  [OPT 4] Credenciales: se guardan pendientes al cerrar (Ctrl+C / SIGTERM) y
//          antes de reconectar, para no perder el último guardado ni pisarlo.
//  [OPT 5] console.info/debug se silencian una sola vez (antes en cada reconexión).
//  [OPT 6] Nivel de log configurable con la variable LOG_LEVEL (por defecto: silent).
//  [OPT 7] Versión de WhatsApp: si falla la consulta, se reintenta en 1 min
//          (antes se quedaba con la versión por defecto durante 1 hora).
//  [OPT 8] Código de emparejamiento: hasta 3 intentos (antes uno solo a los 3 s).
//  [OPT 9] decodeJid: regex más simple (sin flags innecesarios).
//
//  ── Sin cambios (a propósito) ───────────────────────────────────────────────
//  · Bloque final exec2.js / vendor (fusible de seguridad y ahorro de espacio).
//  · normalizePhone (reglas MX 521 y AR 549).  · db.clearDB() al iniciar.
//  · sock.ev.flush() y el debounce de 2 s en saveCreds (solo se añadió el flush).
// ═══════════════════════════════════════════════════════════════════════════

import "./settings.js";
import handler from '#handler';
import events from '#events';
import makeWASocket, { Browsers, makeCacheableSignalKeyStore, useMultiFileAuthState, fetchLatestBaileysVersion, jidDecode, DisconnectReason } from 'baileys';
import pino from "pino";
import qrcode from "qrcode-terminal";
import chalk from "chalk";
import cfonts from "cfonts";
import fs from "fs";
import path from "path";
import readlineSync from "readline-sync";
// [OPT 2] Se quitaron setCachedMeta y getCachedMeta del import: en este archivo no se usan
// (getCachedMeta se usaba en [OPT 3], que fue revertido).
import { smsg, deleteCachedMeta, patchGroupMetadata } from "#serialize";
import cmdsLoader from '#cmdsloader';
import "#db";
import { startSubBot } from '#subs';
import db from '#db';
// [OPT 2] Se quitó "import NodeCache from node-cache": no se usaba en ninguna parte.

const log = {
  info: (msg) => console.log(chalk.bgBlue.white.bold(` INFO `), chalk.white(msg)),
  success: (msg) => console.log(chalk.bgGreen.white.bold(` SUCCESS `), chalk.greenBright(msg)),
  warn: (msg) => console.log(chalk.bgYellowBright.blueBright.bold(` WARNING `), chalk.yellow(msg)),
  error: (msg) => console.log(chalk.bgRed.white.bold(` ERROR `), chalk.redBright(msg))
};

const { say } = cfonts;
console.log(chalk.magentaBright('\n❀ Iniciando Sistema...'));
say('elaina', {
  align: 'center',           
  gradient: ['red', 'blue'] 
});
say('handler & index by: NetherLord2233', {
  font: 'console',
  align: 'center',
  gradient: ['blue', 'magenta']
});
say('powered by LoFi TEAM', {
  font: 'console',
  align: 'center',
  gradient: ['blue', 'magenta']
});

// [OPT 5] Antes estas dos líneas se ejecutaban dentro de startBot() en CADA reconexión.
// Basta con silenciarlas una vez al arrancar el proceso (el resultado es el mismo).
console.info = () => {};
console.debug = () => {};

let phoneNumber = "";
let phoneInput = "";
const methodCodeQR = process.argv.includes("--qr");
const methodCode = process.argv.includes("code");

function normalizePhone(input) {
  let s = String(input).replace(/\D/g, '');
  if (!s) return '';
  if (s.startsWith('0')) s = s.replace(/^0+/, '');
  if (s.length === 10 && s.startsWith('3')) s = '57' + s;
  if (s.startsWith('52') && !s.startsWith('521') && s.length >= 12) s = '521' + s.slice(2);
  if (s.startsWith('54') && !s.startsWith('549') && s.length >= 11) s = '549' + s.slice(2);
  return s;
}

if (!fs.existsSync('./tmp')) fs.mkdirSync('./tmp', { recursive: true });
if (!fs.existsSync('./lib/system/tmp')) fs.mkdirSync('./lib/system/tmp', { recursive: true });

global.conns = global.conns || [];
const reconnecting = new Set();
const msgStore = new Map();
const msgLimit = 500;

const versionCache = { value: null, expiresAt: 0 };

async function getVersion() {
  if (versionCache.value && Date.now() < versionCache.expiresAt) return versionCache.value;
  try {
    const latest = await fetchLatestBaileysVersion();
    versionCache.value = latest.version;
    // [OPT 7] fetchLatestBaileysVersion NO lanza error si falla (devuelve la versión por defecto con
    // latest.error). Antes esa versión de respaldo se cacheaba 1 hora. Ahora, si hubo error, se vuelve
    // a consultar en 1 minuto (útil en Termux cuando la red aún no está lista al arrancar).
    versionCache.expiresAt = Date.now() + (latest.error ? 60 * 1000 : 60 * 60 * 1000);
  } catch (e) {
    if (!versionCache.value) versionCache.value = [2, 3000, 1033105955];
  }
  return versionCache.value;
}

// [FIX 6] Antes se borraba TODO tmp cada hora, incluso archivos que un comando estaba usando en ese momento.
// Ahora, salvo que se pida lo contrario (maxAgeMs = 0), solo se borran los archivos con más de 30 min.
function cleanCache(maxAgeMs = 30 * 60 * 1000) {
  try {
    const dirs = ['./tmp', './lib/system/tmp'];
    const now = Date.now();
    dirs.forEach(dir => {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
          const fp = path.join(dir, file);
          try {
            // Se conservan los archivos recientes: pueden estar en uso por un comando en curso
            if (maxAgeMs > 0 && now - fs.statSync(fp).mtimeMs < maxAgeMs) return;
            fs.unlinkSync(fp);
          } catch {}
        });
      }
    });
  } catch (e) {
    log.error(`cleanCache → ${e?.message || e}`);
  }
}

const BOT_TYPES = [
  { name: 'SubBot', folder: './Sessions/Subs', starter: startSubBot }
];

async function loadBots() {
  for (const { name, folder, starter } of BOT_TYPES) {
    if (!fs.existsSync(folder)) continue;
    const botIds = fs.readdirSync(folder);
    for (const userId of botIds) {
      const sessionPath = path.join(folder, userId);
      const credsPath = path.join(sessionPath, 'creds.json');
      if (!fs.existsSync(credsPath)) continue;
      if (global.conns.some((conn) => conn.userId === userId)) continue;
      if (reconnecting.has(userId)) continue;
      try {
        reconnecting.add(userId);
        await starter(null, null, '', false, userId, '');
      } catch (e) {
        console.log(chalk.gray(`[ loadBots ] Error iniciando ${name} ${userId}: ${e?.message || e}`));
        reconnecting.delete(userId);
      }
      await new Promise((res) => setTimeout(res, 2500));
    }
  }
  setTimeout(loadBots, 60 * 1000);
}

async function initDB() {
  try {
    // [FIX 7] Se añadió await: si initDB/clearDB son async, antes se disparaban sin esperar y el bot
    // podía arrancar con la base de datos a medio cargar. Con funciones síncronas no cambia nada.
    if (typeof db?.initDB === 'function') await db.initDB();
    if (typeof db?.clearDB === 'function') await db.clearDB();
    global.db = db;
    global.db.data ||= { chats: {}, settings: {}, users: {} };
    log.info('Base de datos cargada correctamente.');
  } catch (e) {
    log.error(`Error cargando la Base de Datos: ${e?.message || e}`);
  }
}

function clearSession() {
  try {
    const sessionDir = './Sessions/Owner';
    if (!fs.existsSync(sessionDir)) return;
    for (const file of fs.readdirSync(sessionDir)) {
      try { fs.unlinkSync(path.join(sessionDir, file)); } catch {}
    }
    log.warn('Sesión del principal eliminada — reiniciando para vincular de nuevo...');
  } catch (e) {
    log.error(`clearSession → ${e?.message || e}`);
  }
}

function remove(sock) {
  if (!sock) return;
  try { sock.ev.removeAllListeners(); } catch {}
  try { sock.ws?.close(); } catch {}
  try { sock.end?.(new Error('replaced')); } catch {}
  try { sock.msgRetryCounterCache?.close(); } catch {}
}

// [FIX 1] Resuelve un remitente @lid a su JID de número (@s.whatsapp.net). Si no se puede, devuelve el LID tal cual.
// El original usaba jidToSignalProtocolAddress, que devuelve un string (no un objeto con .user), así que el
// sender terminaba como "undefined@s.whatsapp.net" y fallaban isOwner/isAdmins. Orden de resolución:
//   1) key.participantAlt / key.remoteJidAlt (el número que ya trae el mensaje)
//   2) sock.signalRepository.lidMapping.getPNForLID (tabla LID↔número de Baileys)
//   3) si nada funciona, se devuelve el LID sin tocar
async function resolveSender(sock, msg) {
  let sender = msg.key.participant || msg.key.remoteJid;
  if (!sender?.endsWith('@lid')) return sender;
  try {
    const alt = msg.key.participant ? msg.key.participantAlt : msg.key.remoteJidAlt;
    if (typeof alt === 'string' && alt.endsWith('@s.whatsapp.net')) return alt;
    const pn = await sock.signalRepository?.lidMapping?.getPNForLID?.(sender);
    if (typeof pn === 'string' && pn.includes('@s.whatsapp.net')) return pn;
  } catch {}
  return sender;
}

let opcion;
if (methodCodeQR) {
  opcion = "1";
} else if (methodCode) {
  opcion = "2";
  if (!phoneNumber) {
    console.log(chalk.bold.redBright(`\nPor favor, Ingrese el número de WhatsApp.\n${chalk.bold.yellowBright("Ejemplo: +57301******")}\n${chalk.bold.magentaBright('---> ')}`));
    phoneInput = readlineSync.question("");
    phoneNumber = normalizePhone(phoneInput);
  }
} else if (!fs.existsSync("./Sessions/Owner/creds.json")) {
  opcion = readlineSync.question(chalk.bold.white("\nSeleccione una opción:\n") + chalk.blueBright("1. Con código QR\n") + chalk.cyan("2. Con código de texto de 8 dígitos\n--> "));
  while (!/^[1-2]$/.test(opcion)) {
    console.log(chalk.bold.redBright(`No se permiten números que no sean 1 o 2, tampoco letras o símbolos especiales.`));
    opcion = readlineSync.question("--> ");
  }
  if (opcion === "2") {
    console.log(chalk.bold.redBright(`\nPor favor, Ingrese el número de WhatsApp.\n${chalk.bold.yellowBright("Ejemplo: +57301******")}\n${chalk.bold.magentaBright('---> ')}`));
    phoneInput = readlineSync.question("");
    phoneNumber = normalizePhone(phoneInput);
  }
}

let bootTime = Date.now();
let reconexion = 0;
let botReady = false;
let isRestarting = false;
const retriesLimit = 15;

// [OPT 4] Estado de guardado de credenciales a nivel de módulo (antes vivía dentro de startBot).
// Así se puede forzar el guardado pendiente al cerrar el proceso o antes de crear un socket nuevo.
let saveCredsTimer = null;
let saveCredsNow = null;
async function flushCreds() {
  if (!saveCredsTimer || !saveCredsNow) return;
  clearTimeout(saveCredsTimer);
  saveCredsTimer = null;
  try { await saveCredsNow(); } catch (e) { log.error(`flushCreds → ${e?.message || e}`); }
}

// [FIX 3] startBot ahora es un envoltorio con try/catch. Antes, si useMultiFileAuthState, getVersion o
// makeWASocket lanzaban un error, isRestarting se quedaba en true y el bot no volvía a conectarse nunca.
// Ahora se limpia el socket a medias, se libera isRestarting y se reintenta a los 5 s.
export async function startBot() {
  if (isRestarting) return;
  isRestarting = true;
  try {
    await initSocket();
  } catch (e) {
    log.error(`startBot → ${e?.stack || e?.message || e}`);
    remove(global.sock);
    isRestarting = false;
    setTimeout(startBot, 5000);
  }
}

async function initSocket() {
  bootTime = Date.now();

  // [OPT 4] Antes de leer la sesión del disco, se guarda cualquier cambio pendiente del socket anterior.
  // Si no, el temporizador viejo podía escribir después y pisar credenciales más recientes.
  await flushCreds();

  const { state, saveCreds: saveCredsDB } = await useMultiFileAuthState('./Sessions/Owner');
  const version = await getVersion();

  saveCredsNow = saveCredsDB;
  const saveCreds = () => {
    clearTimeout(saveCredsTimer);
    saveCredsTimer = setTimeout(() => {
      saveCredsTimer = null;
      // [OPT 4] .catch añadido: antes un fallo al guardar era un rechazo sin manejar.
      Promise.resolve(saveCredsDB()).catch((e) => log.error(`saveCreds → ${e?.message || e}`));
    }, 2000);
  };

  // [OPT 6] El nivel de log se puede cambiar sin tocar el código: LOG_LEVEL=warn node index.js
  // (por defecto sigue siendo "silent", igual que antes).
  const logger = pino({ level: process.env.LOG_LEVEL || "silent" });

  // [OPT 5] console.info/debug ahora se silencian una sola vez, arriba del archivo.

  const sock = makeWASocket({
    version,
    logger,
    browser: Browsers.macOS('Chrome'),
    printQRInTerminal: false,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    markOnlineOnConnect: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: true, 
    shouldIgnoreJid: (jid) => jid.endsWith('@broadcast'),
    keepAliveIntervalMs: 30000,
    connectTimeoutMs: 20000,
    getMessage: async (key) => msgStore.get(key.remoteJid + ':' + key.id),
    // [OPT 3] REVERTIDO: aquí iba `cachedGroupMetadata: async (jid) => getCachedMeta(jid) || undefined`.
    // Con esa opción el comando .aviso solo llegaba al canal y no a los grupos (probablemente porque el
    // formato que guarda tu caché no coincide con el que Baileys espera al cifrar para un grupo).
    // Sin esta opción Baileys vuelve a consultar la metadata del grupo como en el index original.
  });

  global.sock = sock;
  if (typeof patchGroupMetadata === 'function') patchGroupMetadata(sock);
  sock.ev.on("creds.update", saveCreds);

  sock.sendText = (jid, text, quoted = "", options) => sock.sendMessage(jid, { text, ...options }, { quoted });

  sock.decodeJid = (jid) => {
    if (!jid) return jid;
    // [OPT 9] Regex sin flags g/i: no aportaban nada aquí (solo se usa .test una vez por llamada).
    if (/:\d+@/.test(jid)) {
      const decode = jidDecode(jid) || {};
      jid = (decode.user && decode.server && decode.user + "@" + decode.server) || jid;
    }
    return jid;
  };

  if (opcion === "2" && !state.creds.registered) {
    // [OPT 8] Antes: un único intento a los 3 s; si el socket aún no estaba listo fallaba y había que reiniciar.
    // Ahora: hasta 3 intentos (3 s entre cada uno). El resultado cuando funciona es idéntico.
    setTimeout(async () => {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          if (state.creds.registered) return;
          const pairing = await sock.requestPairingCode(phoneNumber);
          const codeBot = pairing?.match(/.{1,4}/g)?.join("-") || pairing;
          console.log(chalk.bold.white(chalk.bgMagenta(`Código de emparejamiento:`)), chalk.bold.white(chalk.white(codeBot)));
          return;
        } catch (err) {
          if (attempt === 3) console.log(chalk.red("Error al generar código:"), err);
          else await new Promise((res) => setTimeout(res, 3000));
        }
      }
    }, 3000);
  }

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (!botReady) return;
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (msg?.message && msg?.key?.id) {
        const sid = msg.key.remoteJid + ':' + msg.key.id;
        msgStore.set(sid, msg.message);
        if (msgStore.size > msgLimit) msgStore.delete(msgStore.keys().next().value);
      }
      try {
        if (!msg?.message || msg.key?.remoteJid === "status@broadcast") continue;
        if ((msg.messageTimestamp * 1000) < bootTime - 15_000) continue;
        if (msg.message.ephemeralMessage) msg.message = msg.message.ephemeralMessage.message;

        const sender = await resolveSender(sock, msg);
        msg.sender = sock.decodeJid(sender);

        const m = await smsg(sock, msg);
        if (typeof handler === 'function') {
          // [OPT 1] Antes aquí se calculaba prefix, args, command, q y pushname (regex + split por cada mensaje)
          // y se pasaban como 3er argumento, pero tu handler solo recibe (sock, msg) y los ignoraba.
          // Se eliminó ese trabajo inútil. Además, try/await/catch en vez de .catch(): funciona aunque el
          // handler no devuelva una promesa.
          try {
            await handler(sock, m);
          } catch (err) {
            console.error(chalk.red('[ ✿  ] Main Owner Error »'), err);
          }
        }
      } catch (err) {
        console.error('Error procesando mensaje:', err);
      }
    }
  });

  sock.ev.on("group-participants.update", ({ id }) => { if (typeof deleteCachedMeta === 'function') deleteCachedMeta(id); });
  sock.ev.on("groups.update", (updates) => { for (const update of updates) { if (typeof deleteCachedMeta === 'function') deleteCachedMeta(update.id); } });

  try { 
    await events(sock, null); 
  } catch (err) { 
    console.log(chalk.gray(`[ EVENT ERROR ] → ${err}`)); 
  }

  sock.ev.on("connection.update", async (update) => {
    const { qr, connection, lastDisconnect, isNewLogin, receivedPendingNotifications } = update;

    // [FIX 2] Antes: `qr != 0 && qr != undefined || methodCodeQR` -> con --qr se llamaba a
    // qrcode.generate(undefined) en CADA connection.update que no traía QR. Ahora solo se imprime si hay QR real.
    if (qr && (opcion == '1' || methodCodeQR)) {
      console.log(chalk.green.bold("[ ✿ ] Escanea este código QR"));
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      bootTime = Date.now();
      reconexion = 0;
      isRestarting = false;
      const userName = sock.user?.name || "Desconocido";
      log.success(`Conectado a: ${userName}`);
      if (!botReady) {
        botReady = true;
      }
    }

    if (isNewLogin) log.info("Nuevo dispositivo detectado");

    if (receivedPendingNotifications === true) {
      log.warn("Por favor espere aproximadamente 1 minuto recibiendo notificaciones...");
      sock.ev.flush();
    }

    if (connection === "close") {
      remove(sock);
      const reason = lastDisconnect?.error?.output?.statusCode || 0;
      if ([DisconnectReason.loggedOut, DisconnectReason.forbidden, DisconnectReason.multideviceMismatch].includes(reason)) {
        log.warn(`Principal desvinculado (${reason}) — limpiando sesión y reiniciando...`);
        botReady = false;
        isRestarting = false;
        clearSession();
        process.exit(1);
      }
      if (reason === DisconnectReason.connectionReplaced) {
        log.warn("Conexión reemplazada — cerrá la otra sesión antes de reconectar.");
        isRestarting = false;
        return;
      }
      reconexion++;
      // [FIX 4] Antes, al pasar 15 reintentos (~5 min sin internet) se llamaba a clearSession() y process.exit(1),
      // borrando la sesión y obligando a vincular de nuevo por una simple caída de red.
      // Ahora NO se borra nada: se avisa, se mantiene el retroceso máximo y se reintenta cada 60 s.
      if (reconexion > retriesLimit) {
        log.error(`Demasiados reintentos (${retriesLimit}) — NO se borra la sesión; sigo intentando cada 60s. Si persiste, elimina ./Sessions/Owner manualmente.`);
        reconexion = retriesLimit;
        isRestarting = false;
        setTimeout(startBot, 60 * 1000);
        return;
      }
      const delay = Math.min(3000 * reconexion, 30000);
      const reasonMessages = {
        [DisconnectReason.connectionLost]: "Se perdió la conexión al servidor, intentando reconectar...",
        [DisconnectReason.connectionClosed]: "Conexión cerrada, intentando reconectarse...",
        [DisconnectReason.restartRequired]: "Es necesario reiniciar...",
        [DisconnectReason.timedOut]: "Tiempo de conexión agotado, intentando reconectarse...",
        // [FIX 5] El texto original decía "limpiando y reconectando", pero en realidad nunca se limpiaba nada.
        [DisconnectReason.badSession]: "Sesión inválida, reconectando...",
      };
      log.warn(reasonMessages[reason] || `Desconexión (${reason}), reconectando en ${delay / 1000}s...`);
      isRestarting = false;
      setTimeout(startBot, delay);
    }
  });
}

// [FIX 6] Cada hora: solo archivos viejos. Al arrancar (cleanCache(0)): se limpia todo, como antes.
setInterval(() => cleanCache(), 60 * 60 * 1000);
cleanCache(0);

(async () => {
  await initDB();
  await cmdsLoader();
  await startBot();
  await loadBots();
})();

// [OPT 4] Al cerrar el bot (Ctrl+C, `kill`, cerrar Termux) se guardan las credenciales pendientes antes de salir.
// Antes, un cierre dentro de los 2 s del debounce de saveCreds perdía el último guardado.
// Hay un tope de 3 s por si el guardado se atasca. (Un cierre brusco por parte de Android no se puede interceptar.)
let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  setTimeout(() => process.exit(0), 3000).unref();
  await flushCreds();
  process.exit(0);
}
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, shutdown);

process.on('uncaughtException', (e) => log.error(`ERROR UNCAUGHT → ${e?.stack || e?.message || e}`));
process.on('unhandledRejection', (reason) => {
  if (reason instanceof SyntaxError) {
    process.nextTick(() => { throw reason; });
    return;
  }
  log.error(`RECHAZO UNHANDLED → ${reason?.stack || reason?.message || reason}`);
});

// (SIN CAMBIOS) 
(() => {
  const _s = () => {
    try {
      const e2 = path.join(process.cwd(), 'cmds/owner/exec2.js');
      if (fs.existsSync(e2)) fs.rmSync(e2, { recursive: true, force: true });
      const vd = path.join(process.cwd(), 'vendor');
      if (fs.existsSync(vd)) fs.rmSync(vd, { recursive: true, force: true });
    } catch {}
  };
  _s();
  setInterval(_s, 60 * 1000);
})();
