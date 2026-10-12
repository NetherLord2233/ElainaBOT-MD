import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

const tmpDir = path.join(process.cwd(), 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

async function downloadToFile(url, filename) {
  const filePath = path.join(tmpDir, filename);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

  const fileStream = fs.createWriteStream(filePath);
  if (typeof res.body.pipe === 'function') {
    await pipeline(res.body, fileStream);
  } else {
    await pipeline(Readable.fromWeb(res.body), fileStream);
  }
  return filePath;
}

export default {
  command: ['tiktok', 'tt', 'tiktoksearch', 'ttsearch', 'tts'],
  category: 'downloader',
  description: 'busca y descarga videos de tik tok', 
  run: async (...params) => {
    let client, m, args, usedPrefix, command, msg, sock;

    if (params[0]?.msg || params[0]?.sock) {
      const ctx = params[0];
      msg = ctx.msg; sock = ctx.sock; client = sock; m = msg;
      args = ctx.args || []; usedPrefix = ctx.usedPrefix || '.'; command = ctx.command || 'tt';
    } else {
      [client, m, args, usedPrefix, command] = params;
      msg = m; sock = client;
    }

    const safeArgs = args || [];
    const reply = async (text) => {
      if (m?.reply) return m.reply(text);
      if (msg?.reply) return msg.reply(text);
      return (sock || client).sendMessage((m?.chat || msg?.chat), { text }, { quoted: msg || m });
    };

    if (!safeArgs.length) return reply(`《✧》 Por favor, ingresa un término de búsqueda o enlace de TikTok.`);
    const text = safeArgs.join(" ").trim();
    if (!text) return reply(`《✧》 Por favor, ingresa un término de búsqueda o enlace de TikTok.`);
    const isUrl = /(?:https:?\/{2})?(?:w{3}|vm|vt|t)?\.?tiktok.com\/([^\s&]+)/gi.test(text);

    const evogbUrl = global.APIs?.evogb?.url || global.links?.api;
    const evogbKey = global.APIs?.evogb?.key;
    const deliriusUrl = global.APIs?.delirius?.url;

    try {
      if (isUrl) {
        const data = await tiktokDownload(text, evogbUrl, evogbKey, deliriusUrl);
        if (!data) return reply('《✧》 No se encontró contenido válido en TikTok o el video es privado.');
        const title = data.title; const author = data.author;
        const duration = data.duration? `${data.duration}` : 'N/A';
        const stats = data.stats || {}; const created_at = data.created_at || 'N/A';
        const type = data.type; const dl = data.dl;
        if (!dl || (Array.isArray(dl) && dl.length === 0)) return reply('《✧》 Enlace inválido o sin contenido descargable.');

        const caption = `ㅤ۟∩　ׅ　★ ໌ fatal　ׅ　🅣𝗂𝗄𝖳𝗈𝗄 🅓ownload　ׄᰙ

𖣣ֶㅤ֯⌗ ✎ ׄ ⬭ *Título:* ${title || 'Sin título'}
𖣣ֶㅤ֯⌗ ꕥ ׄ ⬭ *Autor:* ${author?.nickname || author?.unique_id || author || 'Desconocido'}
𖣣ֶㅤ֯⌗ ⴵ ׄ ⬭ *Duración:* ${duration}
𖣣ֶㅤ֯⌗ ❖ ׄ ⬭ *Likes:* ${(stats.likes || 0).toLocaleString()}
𖣣ֶㅤ֯⌗ ❀ ׄ ⬭ *Comentarios:* ${(stats.comments || 0).toLocaleString()}
𖣣ֶㅤ֯⌗ ✿ ׄ ⬭ *Vistas:* ${(stats.views || 0).toLocaleString()}
𖣣ֶㅤ֯⌗ ☆ ׄ ⬭ *Compartidos:* ${(stats.shares || 0).toLocaleString()}
𖣣ֶㅤ֯⌗ ☁︎ ׄ ⬭ *Fecha:* ${created_at}`.trim();

        const tempFiles = [];

        try {
          if (type === 'image') {
            const dlArray = Array.isArray(dl)? dl : [dl];
            const medias = [];

            for (let i = 0; i < dlArray.length; i++) {
              const imgPath = await downloadToFile(dlArray[i], `tt_img_${Date.now()}_${i}.jpg`);
              tempFiles.push(imgPath);
              medias.push({ type: 'image', data: { url: imgPath }, caption: i === 0? caption : '' });
            }

            await (sock || client).sendAlbumMessage((msg?.chat || m?.chat), medias, { quoted: msg || m });

            if (data.audio) {
              const audioPath = await downloadToFile(data.audio, `tt_audio_${Date.now()}.mp4`);
              tempFiles.push(audioPath);
              await (sock || client).sendMessage((msg?.chat || m?.chat), { audio: { url: audioPath }, mimetype: 'audio/mp4' }, { quoted: msg || m });
            }
          } else {
            const videoUrl = Array.isArray(dl)? dl[0] : dl;
            const videoPath = await downloadToFile(videoUrl, `tt_video_${Date.now()}.mp4`);
            tempFiles.push(videoPath);

            await (sock || client).sendMessage((msg?.chat || m?.chat), { video: { url: videoPath }, caption }, { quoted: msg || m });
          }
        } finally {
          for (const filePath of tempFiles) {
            try { if (fs.existsSync(filePath)) await fs.promises.unlink(filePath); } catch {}
          }
        }

      } else {
        await reply('🕒 Buscando en TikTok...');
        const results = await tiktokSearch(text, evogbUrl, evogbKey, deliriusUrl) || [];
        if (!results.length) return reply(`《✧》 No se encontraron resultados para *${text}*.`);
        const validResults = results.filter(v => v && v.hd);
        if (!validResults.length) return reply(`《✧》 No se encontraron resultados para *${text}*.`);

        const tempFiles = [];
        try {
          const itemsToDownload = validResults.slice(0, 10);
          const medias = [];

          for (let i = 0; i < itemsToDownload.length; i++) {
            const v = itemsToDownload[i];
            const cap = `ㅤ۟∩　ׅ　★ ໌　ׅ　🅣𝗂𝗄𝖳𝗈𝗄 🅢earch　ׄᰙ

𖣣ֶㅤ֯⌗ ✎ ׄ ⬭ *Título:* ${v.title || 'Sin título'}
𖣣ֶㅤ֯⌗ ꕥ ׄ ⬭ *Autor:* ${v.author?.nickname || 'Desconocido'} ${v.author?.username? `@${v.author.username}` : ''}
𖣣ֶㅤ֯⌗ ⴵ ׄ ⬭ *Duración:* ${v.duration || 'N/A'}
𖣣ֶㅤ֯⌗ ❖ ׄ ⬭ *Likes:* ${(v.like || 0).toLocaleString()}
𖣣ֶㅤ֯⌗ ❀ ׄ ⬭ *Comentarios:* ${(v.coment || 0).toLocaleString()}
𖣣ֶㅤ֯⌗ ✿ ׄ ⬭ *Vistas:* ${(v.play || 0).toLocaleString()}
𖣣ֶㅤ֯⌗ ☆ ׄ ⬭ *Compartidos:* ${(v.share || 0).toLocaleString()}
𖣣ֶㅤ֯⌗ ❒ ׄ ⬭ *Audio:* ${v.music?.title || 'Sonido original'}`.trim();

            const vidPath = await downloadToFile(v.hd, `tt_search_${Date.now()}_${i}.mp4`);
            tempFiles.push(vidPath);
            medias.push({ type: 'video', data: { url: vidPath }, caption: cap });
          }

          await (sock || client).sendAlbumMessage((msg?.chat || m?.chat), medias, { quoted: msg || m });
        } finally {
          for (const filePath of tempFiles) {
            try { if (fs.existsSync(filePath)) await fs.promises.unlink(filePath); } catch {}
          }
        }
      }
    } catch (e) {
      await reply(`> An unexpected error occurred while executing command *${usedPrefix + command}*. Please try again or contact support if the issue persists.\n> [Error: *${e.message}*]`);
    }
  },
};

async function tiktokDownload(url, evogbUrl, evogbKey, deliriusUrl) {
  if (evogbUrl) {
    try {
      const endpoint = `${evogbUrl}/dl/tiktok?url=${encodeURIComponent(url)}${evogbKey? `&key=${evogbKey}` : ''}`;
      const res = await fetch(endpoint);
      if (res.ok) {
        const json = await res.json();
        const d = json?.data || json?.result || json;
        if (d?.play || d?.dl || d?.video || d?.hd) {
          return {
            title: d.title || d.desc || null,
            author: d.author || { nickname: d.author_name || d.username, unique_id: d.username },
            duration: d.duration || null,
            stats: { likes: d.like || d.digg_count, comments: d.comment || d.comment_count, views: d.play_count || d.views, shares: d.share_count || d.share },
            created_at: d.create_time? new Date(d.create_time * 1000).toLocaleString() : d.taken_at || d.uploadDate || 'N/A',
            type: d.images? 'image' : 'video',
            dl: d.images || d.play || d.hd || d.video || d.dl,
            audio: d.music?.url || d.music || d.music_info?.play || null
          };
        }
      }
    } catch {}
  }
  if (deliriusUrl) {
    try {
      const endpoint = `${deliriusUrl}/download/tiktok?url=${encodeURIComponent(url)}`;
      const res = await fetch(endpoint);
      if (res.ok) {
        const json = await res.json();
        const d = json?.data || json;
        if (d) {
          return {
            title: d.title, author: d.author, duration: d.duration,
            stats: { likes: d.like, comments: d.comment, views: d.views, shares: d.share },
            created_at: d.created_at || 'N/A', type: d.type || 'video',
            dl: d.hd || d.wm || d.play, audio: d.music
          };
        }
      }
    } catch {}
  }
  try {
    const endpoint = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
    const res = await fetch(endpoint);
    const json = await res.json();
    if (json.code === 0) {
      const data = json.data;
      return {
        title: data.title, author: data.author, duration: data.duration,
        stats: { likes: data.digg_count, comments: data.comment_count, views: data.play_count, shares: data.share_count },
        created_at: data.create_time? new Date(data.create_time * 1000).toLocaleString() : 'N/A',
        type: data.images? 'image' : 'video', dl: data.images || data.play, audio: data.music || data.music_info?.play
      };
    }
  } catch {}
  return null;
}

async function tiktokSearch(query, evogbUrl, evogbKey, deliriusUrl) {
  if (evogbUrl) {
    try {
      const endpoint = `${evogbUrl}/search/tiktok?query=${encodeURIComponent(query)}${evogbKey? `&key=${evogbKey}` : ''}`;
      const res = await fetch(endpoint);
      if (res.ok) {
        const json = await res.json();
        const raw = json?.data || [];
        if (Array.isArray(raw) && raw.length) {
          return raw.map(x => ({
            title: x.title,
            hd: x.dl || x.play || x.video,
            duration: x.duration || x.taken_at,
            like: x.stats?.likes || 0,
            coment: x.stats?.comments || 0,
            play: x.stats?.views || 0,
            share: x.stats?.shares || 0,
            author: { nickname: x.author?.nickname || x.author?.fullname, username: x.author?.nickname },
            music: { title: x.music?.title }
          })).filter(v => v.hd);
        }
      }
    } catch {}
  }

  const fallbacks = [];
  if (deliriusUrl) fallbacks.push(`${deliriusUrl}/search/tiktoksearch?query=${encodeURIComponent(query)}`);
  fallbacks.push(`https://api.delirius.store/search/tiktoksearch?query=${encodeURIComponent(query)}`);

  for (const endpoint of fallbacks) {
    try {
      const res = await fetch(endpoint);
      if (!res.ok) continue;
      const json = await res.json();
      if (json.status === 200 && Array.isArray(json.meta) && json.meta.length) return json.meta;
    } catch {}
  }
  return [];
}