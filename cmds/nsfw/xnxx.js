import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';
import db from '#db';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP_DIR = path.resolve(__dirname, '../../tmp');

const BASE_URL = 'https://www.xnxx.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const MAX_RESULTS = 4;
const DELAY_MS = 800;

const sleep = ms => new Promise(r => setTimeout(r, ms));

export default {
  command: ['xnxx'],
  category: 'nsfw',
  description: 'Buscar y descargar videos de XNXX.',
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    const chat = db.getChat(msg.chat);
    if (!chat.nsfw) return msg.reply(`ꕥ El contenido *NSFW* está desactivado en este grupo.\n\nUn *administrador* puede activarlo con el comando:\n» *${usedPrefix}nsfw on*`);

    const tempFiles = [];
    try {
      const query = args.join(' ').trim();
      if (!query) return msg.reply('《✧》Por favor, ingresa el título o URL del video de XNXX.');

      await fs.promises.mkdir(TMP_DIR, { recursive: true });

      // ── Descarga por URL ──────────────────────────────────────────────
      if (query.includes('xnxx.com')) {
        const res = await xnxxdl(query);
        const { dur, qual, views } = res.result.info;
        const fileUrl = res.result.files.high || res.result.files.low;
        if (!fileUrl) throw new Error('No se pudo obtener el enlace del video');

        const filePath = path.join(TMP_DIR, `xnxx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.mp4`);
        tempFiles.push(filePath);
        await downloadToFile(fileUrl, filePath);

        const safeTitle = (res.result.title || 'xnxx').replace(/[\\/:*?"<>|]/g, '').slice(0, 100);
        await sock.sendMessage(msg.chat, {
          document: { url: filePath },
          mimetype: 'video/mp4',
          fileName: `${safeTitle}.mp4`,
          caption: `乂 ¡XNXX - DOWNLOAD! 乂

≡ Título : ${res.result.title}
≡ Duración : ${dur || 'Desconocida'}
≡ Calidad : ${qual || 'Desconocida'}
≡ Vistas : ${views || 'Desconocidas'}`
        }, { quoted: msg });
        return;
      }

      // ── Búsqueda: 4 resultados en álbum ───────────────────────────────
      await msg.react('🕒');

      const results = await search(encodeURIComponent(query));
      if (!results.length) {
        await msg.react('✖️');
        return msg.reply('《✧》 No se encontraron resultados.');
      }

      // Preparar hasta MAX_RESULTS miniaturas, saltando las que fallen
      const items = [];
      for (const r of results) {
        if (items.length >= MAX_RESULTS) break;
        if (!r.thumb) continue;
        try {
          const file = await prepareThumb(r.thumb, tempFiles);
          items.push({ ...r, file });
        } catch (err) {
          console.error(`[xnxx] se omite miniatura ${r.thumb}:`, err.message);
        }
      }

      const buildCaption = (r, i, total) => {
        const info = (r.info || '').replace(/\s+/g, ' ').trim();
        let cap = `${i + 1}. ${r.title}\n${info ? `≡ Info : ${info}\n` : ''}≡ Link : ${r.link}`;
        if (i === 0) cap = `乂 ¡XNXX - SEARCH! 乂\n\n${cap}`;
        if (i === total - 1) cap += `\n\n> » Usa directamente la URL de uno de los vídeos para descargarlo.`;
        return cap;
      };

      // Sin miniaturas suficientes: lista de texto con los 4 primeros
      if (items.length < 2) {
        const list = results.slice(0, MAX_RESULTS)
          .map((v, i) => `${i + 1}\n≡ Título : ${v.title}\n≡ Link : ${v.link}`)
          .join('\n\n');
        await sock.sendMessage(msg.chat, {
          text: `乂 ¡XNXX - SEARCH! 乂\n\n${list}\n\n> » Usa directamente la URL de uno de los vídeos para descargarlo.`
        }, { quoted: msg });
        await msg.react('✔️');
        return;
      }

      // Álbum con el sistema del bot (sendAlbumMessage)
      try {
        const medias = items.map((it, i) => ({
          type: 'image',
          data: { url: it.file },
          caption: buildCaption(it, i, items.length)
        }));
        await sock.sendAlbumMessage(msg.chat, medias, { quoted: msg });
      } catch (err) {
        console.error('[xnxx] álbum falló, se envía uno por uno:', err.message);
        for (let i = 0; i < items.length; i++) {
          await sock.sendMessage(msg.chat, {
            image: { url: items[i].file },
            caption: buildCaption(items[i], i, items.length)
          }, { quoted: msg });
          if (i < items.length - 1) await sleep(DELAY_MS);
        }
      }

      await msg.react('✔️');
    } catch (e) {
      await msg.react?.('✖️');
      return msg.reply(`> An unexpected error occurred while executing command *${usedPrefix + command}*. Please try again or contact support if the issue persists.\n> [Error: *${e.message}*]`);
    } finally {
      for (const f of tempFiles) fs.promises.unlink(f).catch(() => {});
    }
  },
};

async function downloadToFile(url, filePath) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`No se pudo descargar (HTTP ${res.status})`);
  await pipeline(res.body, fs.createWriteStream(filePath));
}

async function prepareThumb(url, tempFiles) {
  const ext = path.extname(new URL(url).pathname).toLowerCase() || '.jpg';
  const filePath = path.join(TMP_DIR, `xnxx_thumb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  tempFiles.push(filePath);
  await downloadToFile(url, filePath);
  return filePath;
}

function parseInfo(infoStr = '', viewsStr = '', pageText = '', jsonViews = '') {
  let dur = '', qual = '', views = '';
  const durMatch = infoStr.match(/(\d+\s?min)/i);
  if (durMatch) dur = durMatch[1];
  const qualMatch = infoStr.match(/([0-9]{3,4}p)/i);
  if (qualMatch) qual = qualMatch[1];
  const cleanNumber = (s) => {
    const m = (s || '').match(/([0-9][0-9.,\s]*)/);
    return m ? m[1].replace(/\s+/g, '').trim() : '';
  };
  if (!views && jsonViews) views = cleanNumber(jsonViews);
  if (!views && viewsStr) views = cleanNumber(viewsStr);
  if (!views && pageText) {
    const v2 = pageText.match(/([0-9][0-9.,\s]*)\s*(views|view|visualizaciones|vistas)/i);
    if (v2) views = cleanNumber(v2[1]);
  }
  return { dur, qual, views };
}

async function xnxxdl(URL) {
  const res = await fetch(URL, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`No se pudo abrir la página (HTTP ${res.status})`);
  const html = await res.text();
  const $ = cheerio.load(html, { xmlMode: false });

  const title = $('meta[property="og:title"]').attr('content') || $('title').text().trim();
  const image = $('meta[property="og:image"]').attr('content');
  const info = $('span.metadata').text() || $('.video-metadata .metadata').text();

  const scriptBlocks = [];
  $('#video-player-bg script, script').each((i, el) => {
    const txt = $(el).html() || '';
    if (txt.includes('html5player.setVideoUrl')) scriptBlocks.push(txt);
  });
  const videoScript = scriptBlocks.join('\n');
  const files = {
    low: (videoScript.match(/html5player\.setVideoUrlLow\('(.*?)'\);/) || [])[1],
    high: (videoScript.match(/html5player\.setVideoUrlHigh\('(.*?)'\);/) || [])[1],
  };

  const viewsCandidates = [
    $('.nb_views').text(),
    $('.rating-box strong').text(),
    $(".video-metadata .metadata:contains('views')").text(),
    $(".metadata:contains('views')").text(),
    $(".metadata:contains('vistas')").text(),
    $('.video-details').text(),
  ];
  const viewsStr = viewsCandidates.find(v => (v || '').trim().length) || '';

  let jsonViews = '';
  const jsonLd = $('script[type="application/ld+json"]').html();
  if (jsonLd) {
    try {
      const data = JSON.parse(jsonLd);
      if (typeof data === 'object') {
        jsonViews = String(data.interactionStatistic?.userInteractionCount || data.aggregateRating?.ratingCount || '');
      }
    } catch {}
  }

  const pageText = $.root().text();
  return { status: 200, result: { title, URL, image, info: parseInfo(info, viewsStr, pageText, jsonViews), files } };
}

async function search(query) {
  const page = Math.floor(Math.random() * 3) + 1;
  const res = await fetch(`${BASE_URL}/search/${query}/${page}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`No se pudo buscar (HTTP ${res.status})`);
  const html = await res.text();
  const $ = cheerio.load(html, { xmlMode: false });

  const results = new Map(); // dedupe por link
  $('div.mozaique').each((a, b) => {
    $(b).find('div.thumb-under').each((c, d) => {
      const href = $(d).find('a').attr('href') || '';
      if (!href) return;
      const link = BASE_URL + href.replace('/THUMBNUM/', '/');
      if (results.has(link)) return;

      const titleAttr = $(d).find('a').attr('title');
      const titleText = $(d).find('a').text().trim();
      const title = titleAttr || titleText || $(d).find('span').text().trim() || 'Sin título';
      const desc = $(d).find('p.metadata').text();

      const img = $(d).closest('.thumb-block').find('img').first();
      let thumb = img.attr('data-src') || img.attr('src') || '';
      try { thumb = thumb ? new URL(thumb, BASE_URL).href : ''; } catch { thumb = ''; }

      results.set(link, { title, info: desc, link, thumb });
    });
  });
  return [...results.values()];
}