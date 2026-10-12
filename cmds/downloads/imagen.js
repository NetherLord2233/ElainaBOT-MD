import axios from 'axios';
import db from '#db';

export default {
  command: ['imagen', 'img', 'image'],
  category: 'downloads',
  description: 'Buscar y descargar imágenes de Google.',
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    const text = args.join(' ');
    
    if (!text) {
      return sock.reply(msg.chat, `《✧》 Por favor, Ingrese un término de búsqueda.`, msg);
    }

    const bannedWords = ['+18', '18+', 'contenido adulto', 'contenido explícito', 'contenido sexual', 'actriz porno', 'actor porno', 'estrella porno', 'pornstar', 'video xxx', 'xxx', 'x x x', 'pornhub', 'xvideos', 'xnxx', 'redtube', 'brazzers', 'onlyfans', 'cam4', 'chaturbate', 'myfreecams', 'bongacams', 'livejasmin', 'spankbang', 'tnaflix', 'hclips', 'fapello', 'mia khalifa', 'lana rhoades', 'riley reid', 'abella danger', 'brandi love', 'eva elfie', 'nicole aniston', 'janice griffith', 'alexis texas', 'lela star', 'gianna michaels', 'adriana chechik', 'asa akira', 'mandy muse', 'kendra lust', 'jordi el niño polla', 'johnny sins', 'danny d', 'manuel ferrara', 'mark rockwell', 'porno', 'porn', 'sexo', 'sex', 'desnudo', 'desnuda', 'erótico', 'erotico', 'erotika', 'tetas', 'pechos', 'boobs', 'boob', 'nalgas', 'culo', 'culos', 'qlos', 'trasero', 'pene', 'verga', 'vergota', 'pito', 'chocha', 'vagina', 'vaginas', 'coño', 'concha', 'genital', 'genitales', 'masturbar', 'masturbación', 'masturbacion', 'gemidos', 'gemir', 'orgía', 'orgy', 'trío', 'trio', 'gangbang', 'creampie', 'facial', 'cum', 'milf', 'teen', 'incesto', 'incest', 'violación', 'violacion', 'rape', 'bdsm', 'hentai', 'tentacle', 'tentáculos', 'fetish', 'fetiche', 'sado', 'sadomaso', 'camgirl', 'camsex', 'camshow', 'playboy', 'playgirl', 'playmate', 'striptease', 'striptis', 'slut', 'puta', 'putas', 'perra', 'perras', 'whore', 'fuck', 'fucking', 'fucked', 'cock', 'dick', 'pussy', 'ass', 'shemale', 'trans', 'transgénero', 'transgenero', 'lesbian', 'lesbiana', 'gay', 'lgbt', 'explicit', 'hardcore', 'softcore', 'nudista', 'nudismo', 'nudity', 'deepthroat', 'dp', 'double penetration', 'analplay', 'analplug', 'rimjob', 'spank', 'spanking', 'lick', 'licking', '69', 'doggystyle', 'reverse cowgirl', 'cowgirl', 'blowjob', 'bj', 'handjob', 'hj', 'p0rn', 's3x', 'v@gina', 'c0ck', 'd1ck', 'fuk', 'fuking', 'fak', 'boobz', 'pusy', 'azz', 'cumshot', 'sexcam', 'livecam', 'webcam', 'sexchat', 'sexshow', 'sexvideo', 'sexvid', 'sexpics', 'sexphoto', 'seximage', 'sexgif', 'pornpic', 'pornimage', 'pornvid', 'pornvideo', 'only fan', 'only-fans', 'only_fans', 'onlyfans.com', 'mia khalifha', 'mia khalifah', 'mia khalifaa', 'mia khalif4', 'mia khal1fa', 'mia khalifa +18', 'mia khalifa xxx', 'mia khalifa desnuda', 'mia khalifa porno'];
    const lowerText = text.toLowerCase();
    const chat = db.getChat(msg.chat);
    const nsfwEnabled = chat.nsfw === 1;

    if (!nsfwEnabled && bannedWords.some(word => lowerText.includes(word))) {
      return msg.reply('《✧》 Este comando no *permite* búsquedas de contenido *+18* o *NSFW*');
    }

    try {
      const results = await getImageSearchResults(text);
      
      if (!results || results.length === 0) {
        return sock.reply(msg.chat, `《✧》 No se encontraron imágenes para "${text}".`, msg);
      }

      const validResults = await filterValidImages(results);
      
      if (validResults.length < 2) {
        return sock.reply(msg.chat, `《✧》 Se requieren al menos 2 imágenes válidas para mostrar un álbum.`, msg);
      }

      const shuffled = validResults.sort(() => Math.random() - 0.5);

      const medias = shuffled.slice(0, 20).map(r => ({
        type: 'image',
        data: { url: r.url },
        caption: `ㅤ۟∩　ׅ　★　ׅ　🅖oogle 🅘mage 🅢earch　ׄᰙ　\n\n${r.title ? `𖣣ֶㅤ֯⌗ ☆  ⬭ *Título* › ${r.title}\n` : ''}${r.domain ? `𖣣ֶㅤ֯⌗ ☆  ⬭ *Fuente* › ${r.domain}\n` : ''}${r.resolution ? `𖣣ֶㅤ֯⌗ ☆  ⬭ *Resolución* › ${r.resolution}\n` : ''}𖣣ֶㅤ֯⌗ ☆  ⬭ *Búsqueda* › ${text}`
      }));

      await sock.sendAlbumMessage(msg.chat, medias, { quoted: msg });
    } catch (e) {
      await msg.reply(`> An unexpected error occurred while executing command *${usedPrefix + command}*.\n> [Error: *${e.message}*]`);
    }
  }
};

async function isImageAccessible(url) {
  try {
    const response = await axios.head(url, {
      timeout: 6000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      },
      maxRedirects: 3,
      validateStatus: (status) => status < 400
    });
    return (response.headers['content-type'] || '').startsWith('image/');
  } catch {
    try {
      await axios.get(url, {
        timeout: 6000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Range': 'bytes=0-1023'
        },
        maxRedirects: 3,
        responseType: 'arraybuffer',
        validateStatus: (status) => status < 400 || status === 206
      });
      return true;
    } catch {
      return false;
    }
  }
}

async function filterValidImages(results) {
  const checks = await Promise.allSettled(
    results.map(async (r) => {
      const ok = await isImageAccessible(r.url);
      return ok ? r : null;
    })
  );
  return checks
    .filter(c => c.status === 'fulfilled' && c.value !== null)
    .map(c => c.value);
}

async function getImageSearchResults(query) {
  try {
    const apiUrl = global.APIs?.evogb?.url || 'https://api.evogb.org';
    const apiKey = global.APIs?.evogb?.key;
    if (!apiKey) return [];

    const { data } = await axios.get(`${apiUrl}/search/googleimage`, {
      params: { key: apiKey, query: query },
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const items = data?.result || data?.results || data?.data || [];
    if (!Array.isArray(items) || items.length === 0) return [];

    const mapped = items.map(item => {
      const imgUrl = item.image || item.url || item.link;
      let domainVal = null;
      try { domainVal = new URL(item.source || imgUrl).hostname; } catch {}
      return {
        url: imgUrl,
        title: item.title || null,
        domain: domainVal,
        resolution: (item.width && item.height) ? `${item.width}x${item.height}` : null
      };
    }).filter(r => r.url && /^https?:\/\//i.test(r.url));

    const unique = [...new Map(mapped.map(m => [m.url, m])).values()];
    return unique.sort(() => Math.random() - 0.5);

  } catch (e) {
    console.log('[EvoGB gimage error]', e.message);
    return [];
  }
}