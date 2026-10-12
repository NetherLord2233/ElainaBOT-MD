import fs from 'fs';
import path from 'path';
import db from '#db';

const CONFIRM_MS = 60_000;
const pending = new Map();

export default {
  command: ['formatdb', 'cleardb', 'resetdb'],
  category: 'owner',
  isOwner: true,
  description: 'Borra toda la base de datos (database.db, -wal y -shm) y reinicia el bot.',
  run: async ({ msg, args, usedPrefix, command }) => {
    try {
      const who = msg.sender;
      const confirming = ['confirmar', 'confirm'].includes((args[0] || '').toLowerCase());
      const since = pending.get(who);

      // Paso 1: advertencia. Paso 2: el mismo comando con "confirmar" dentro de 60 s
      if (!confirming || !since || Date.now() - since > CONFIRM_MS) {
        pending.set(who, Date.now());
        return msg.reply(
          `❖ *Esto borrará TODA la base de datos* (usuarios, chats, ajustes del bot y stickers) y reiniciará el bot.\n\n` +
          `> ✐ No se puede deshacer.\n` +
          `> ✐ Para continuar, usa *${usedPrefix + command} confirmar* en los próximos 60 segundos.`
        );
      }
      pending.delete(who);

      await msg.reply('❖ Formateando la base de datos...');

      // Cerrar la conexión antes de borrar los archivos
      try { db.db.close(); } catch {}

      const base = path.join(process.cwd(), 'database.db');
      const results = [];
      let failed = false;
      for (const suffix of ['', '-wal', '-shm']) {
        const file = base + suffix;
        const name = path.basename(file);
        try {
          const existed = fs.existsSync(file);
          fs.rmSync(file, { force: true });
          results.push(`${existed ? '✓' : '–'} ${name}${existed ? '' : ' (no existía)'}`);
        } catch (e) {
          failed = true;
          results.push(`✘ ${name} (${e.message})`);
        }
      }

      await msg.reply(
        `「✿」 Base de datos ${failed ? 'formateada con errores' : 'formateada'}:\n\n${results.join('\n')}\n\n` +
        `> ✐ Reiniciando el bot...`
      );

      // Salida con código 1, igual que los reinicios de index.js; el gestor de procesos lo vuelve a levantar
      setTimeout(() => process.exit(1), 2000);
    } catch (e) {
      return msg.reply(`> An unexpected error occurred while executing command *${usedPrefix + command}*. Please try again or contact support if the issue persists.\n> [Error: *${e.message}*]`);
    }
  }
};
