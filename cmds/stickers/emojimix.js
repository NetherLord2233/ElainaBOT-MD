import fetch from 'node-fetch';
import fs from 'fs';
import db from '#db';

const fetchJson = (url, options) => new Promise((resolve, reject) => { fetch(url, options).then(res => res.json()).then(json => resolve(json)).catch(err => reject(err)) });

export default {
  command: ['emojimix'],
  category: 'stickers',
  description: 'Mezclar dos emojis en un sticker.',
  run: async ({ msg, sock, args, usedPrefix, command, text }) => {
    try {
      if (!text) {
        return msg.reply(`《✧》 Ingresa 2 emojis para combinar.\n> Ejemplo: *${usedPrefix + command}* 👻+👀`);
      }

      let emoji1, emoji2;
      
      if (text.includes('+')) {
        [emoji1, emoji2] = text.split('+').map(e => e.trim().replace(/\uFE0F/g, ''));
      } else {
        const parts = text.trim().split(/\s+/).map(e => e.trim().replace(/\uFE0F/g, ''));
        emoji1 = parts[0];
        emoji2 = parts[1];
      }

      if (!emoji1) {
        return msg.reply(`《✧》 Ingresa 2 emojis para combinar.\n> Ejemplo: *${usedPrefix + command}* 👻+👀`);
      }
      if (!emoji2) emoji2 = emoji1; 

      await msg.react('🕒');

      if (!db.data) db.data = {};
      if (!db.data.users) db.data.users = {};
      let user = db.getUser ? db.getUser(msg.sender) : (db.data.users[msg.sender] || {});
      
      const name = user.name || msg.sender.split('@')[0];
      const meta1 = user.metadatos ? String(user.metadatos).trim() : '';
      const meta2 = user.metadatos2 ? String(user.metadatos2).trim() : '';
      let texto1 = meta1 ? meta1 : 'Elaina 💜';
      let texto2 = meta1 ? (meta2 ? meta2 : '') : `@${name}`;

      const apiKey = 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ';
      const baseUrl = `https://tenor.googleapis.com/v2/featured?key=${apiKey}&contentfilter=high&media_filter=png_transparent&component=proactive&collection=emoji_kitchen_v5&q=`;

      let res = await fetchJson(baseUrl + encodeURIComponent(`${emoji1}_${emoji2}`));

      if (!res.results || res.results.length === 0) {
        res = await fetchJson(baseUrl + encodeURIComponent(`${emoji2}_${emoji1}`));
      }

      if (!res.results || res.results.length === 0) {
        res = await fetchJson(baseUrl + encodeURIComponent(emoji1));
      }

      if (!res.results || res.results.length === 0) {
        res = await fetchJson(baseUrl + encodeURIComponent(emoji2));
      }

      if (!res.results || res.results.length === 0) {
        throw new Error('《✧》 No se encontraron stickers para la combinación de esos emojis.');
      }

      const result = res.results[0];
      const imgUrl = result.media_formats?.png_transparent?.url || result.media_formats?.webp_transparent?.url || result.url;

      const tmpFile = `./tmp/emojimix-${Date.now()}.webp`;
      const buffer = await (await fetch(imgUrl)).arrayBuffer();
      fs.writeFileSync(tmpFile, Buffer.from(buffer));
      
      await sock.sendImageAsSticker(msg.chat, tmpFile, msg, { packname: texto1, author: texto2 });
      fs.unlinkSync(tmpFile);
      
      await msg.react('✔️');
    } catch (e) {
      await msg.react('✖️');
      return msg.reply(`> Ocurrió un error al ejecutar el comando *${usedPrefix + command}*.\n> [Error: *${e.message}*]`);
    }
  }
};
        
