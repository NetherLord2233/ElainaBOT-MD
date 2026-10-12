import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import db from '#db';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP_DIR = path.resolve(__dirname, '../../tmp');

const API_KEY = '98f554258c88c44f4dd28ccde0c28f36682b2a992490ab35ebcc7baf7e196a86d7550b174bce577b8cc3f544e9b3ad0f6aeb09ad63bf89a9141cc3eddb6fbfd2';
const USER_ID = '1917269';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const MAX_RESULTS = 10;
const DELAY_MS = 800;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function gifToMp4(input, output) {
  await execFileAsync('ffmpeg', [
    '-y', '-i', input,
    '-movflags', 'faststart',
    '-pix_fmt', 'yuv420p',
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-c:v', 'libx264',
    '-an',
    output
  ], { timeout: 60000 });
}

// Descarga un resultado a tmp/ y lo deja listo para enviar.
// Devuelve { type: 'image' | 'video', file, gif } y registra los temporales en `tempFiles`.
async function prepare(media, tempFiles) {
  const ext = path.extname(new URL(media).pathname).toLowerCase();
  const base = `gelbooru_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const filePath = path.join(TMP_DIR, `${base}${ext}`);
  tempFiles.push(filePath);

  const fileRes = await axios.get(media, {
    responseType: 'arraybuffer',
    headers: { 'Referer': 'https://gelbooru.com/', 'User-Agent': UA },
    timeout: 15000
  });
  await fs.promises.writeFile(filePath, Buffer.from(fileRes.data));

  if (ext === '.mp4') return { type: 'video', file: filePath, gif: false };

  if (ext === '.gif') {
    const mp4Path = path.join(TMP_DIR, `${base}_gif.mp4`);
    tempFiles.push(mp4Path);
    try {
      await gifToMp4(filePath, mp4Path);
      return { type: 'video', file: mp4Path, gif: true };
    } catch (err) {
      console.error('[gelbooru] ffmpeg falló, se envía el GIF como imagen:', err.message);
      return { type: 'image', file: filePath, gif: false };
    }
  }

  return { type: 'image', file: filePath, gif: false };
}

export default {
  command: ['gelbooru', 'gbooru'],
  category: 'nsfw',
  description: 'Buscar imágenes en Gelbooru.',
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    const tempFiles = [];
    try {
      const chat = db.getChat(msg.chat);
      if (!chat.nsfw) return msg.reply(`ꕥ El contenido *NSFW* está desactivado en este grupo.\n\nUn *administrador* puede activarlo con el comando:\n» *${usedPrefix}nsfw on*`);
      if (!args[0]) return sock.reply(msg.chat, `《✧》 Debes especificar tags para buscar\n> Ejemplo » *${usedPrefix + command} neko*`, msg);

      await msg.react('🕒');

      const tag = args.join('_');
      const url = `https://gelbooru.com/index.php?page=dapi&s=post&q=index&json=1&limit=100&tags=${encodeURIComponent(tag)}&api_key=${API_KEY}&user_id=${USER_ID}`;

      const res = await axios.get(url, {
        headers: { 'User-Agent': UA, 'Referer': 'https://gelbooru.com/', 'Accept': 'application/json' }
      });

      // Con tags sin resultados, `post` no viene o el body llega vacío
      const data = Array.isArray(res.data?.post) ? res.data.post : [];
      const valid = data
        .map(p => p?.file_url || p?.sample_url)
        .filter(u => typeof u === 'string' && /\.(jpe?g|png|gif|mp4)(\?.*)?$/i.test(u));
      const mediaList = [...new Set(valid)].sort(() => Math.random() - 0.5);

      if (!mediaList.length)
        return sock.reply(msg.chat, `《✧》 No se encontraron resultados para ${tag}`, msg);

      await fs.promises.mkdir(TMP_DIR, { recursive: true });

      // Preparar hasta MAX_RESULTS archivos, saltando los que fallen
      const items = [];
      for (const media of mediaList) {
        if (items.length >= MAX_RESULTS) break;
        try {
          items.push(await prepare(media, tempFiles));
        } catch (err) {
          console.error(`[gelbooru] se omite ${media}:`, err.message);
        }
      }

      if (!items.length) throw new Error('No se pudo preparar ningún resultado');

      const caption = `ꕥ Resultados para » ${tag} (${items.length})`;

      // Un solo resultado: mensaje normal
      if (items.length === 1) {
        const it = items[0];
        await sock.sendMessage(msg.chat, {
          [it.type]: { url: it.file },
          ...(it.gif ? { gifPlayback: true } : {}),
          caption,
          mentions: [msg.sender]
        }, { quoted: msg });
        await msg.react('✔️');
        return;
      }

      // Varios: álbum con el sistema del bot (sendAlbumMessage)
      try {
        const medias = items.map((it, i) => ({
          type: it.type,
          data: { url: it.file },
          ...(i === 0 ? { caption } : {})
        }));
        await sock.sendAlbumMessage(msg.chat, medias, { quoted: msg });
      } catch (err) {
        console.error('[gelbooru] álbum falló, se envía uno por uno:', err.message);
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          await sock.sendMessage(msg.chat, {
            [it.type]: { url: it.file },
            ...(it.gif ? { gifPlayback: true } : {}),
            caption: `${caption} [${i + 1}/${items.length}]`,
            mentions: [msg.sender]
          });
          if (i < items.length - 1) await sleep(DELAY_MS);
        }
      }

      await msg.react('✔️');
    } catch (e) {
      await msg.react('✖️');
      await msg.reply(`> An unexpected error occurred while executing command *${usedPrefix + command}*. Please try again or contact support if the issue persists.\n> [Error: *${e.message}*]`);
    } finally {
      for (const f of tempFiles) fs.promises.unlink(f).catch(() => {});
    }
  }
};