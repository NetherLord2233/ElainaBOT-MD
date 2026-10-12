import db from '#db';
export default {
  command: [
    'welcome', 'bienvenida',
    'goodbye', 'despedida',
    'alerts', 'alertas',
    'nsfw', 
    'antilink', 'antienlaces', 'antilinks', 
    'antistatus', 'antiestados', 
    'anticall', 'antillamadas', 
    'rpg', 'economy', 'economia', 
    'gacha', 
    'game', 'juegos', 'juego',
    'adminonly', 'onlyadmin'
  ],
  category: 'group',
  description: 'Configurar opciones del grupo.',
  isAdmin: true,
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    let chatData = db.getChat(msg.chat);
    const botId = sock.user.id.split(':')[0] + "@s.whatsapp.net";
    const botSettings = db.getSettings(botId) || {};
    const botname = botSettings.botname || 'Bot';
    const stateArg = args[0]?.toLowerCase();
    const validStates = ['on', 'off', 'enable', 'disable'];
    const mapTerms = {
      antilinks: 'antilinks',
      antienlaces: 'antilinks',
      antilink: 'antilinks',
      antistatus: 'antistatus',
      antiestados: 'antistatus',
      anticall: 'anticall',
      antillamadas: 'anticall',
      welcome: 'welcome',
      bienvenida: 'welcome',
      goodbye: 'goodbye',
      despedida: 'goodbye',
      alerts: 'alerts',
      alertas: 'alerts',
      economy: 'economy',
      economia: 'economy',
      adminonly: 'adminonly',
      onlyadmin: 'adminonly',
      nsfw: 'nsfw',
      rpg: 'gacha',
      gacha: 'gacha',
      game: 'game',
      juegos: 'game',
      juego: 'game'
    };
    const featureNames = {
      antilinks: 'el *AntiEnlace*',
      antistatus: 'el *AntiEstado*',
      anticall: 'el *AntiLlamadas*',
      welcome: 'el mensaje de *Bienvenida*',
      goodbye: 'el mensaje de *Despedida*',
      alerts: 'las *Alertas*',
      economy: 'los comandos de *Economía*',
      gacha: 'los comandos de *Gacha*',
      game: 'los comandos de *Juegos*',
      adminonly: 'el modo *Solo Admin*',
      nsfw: 'los comandos *NSFW*'
    };
    const featureTitles = {
      antilinks: 'AntiEnlace',
      antistatus: 'AntiEstado',
      anticall: 'AntiLlamadas',
      welcome: 'Bienvenida',
      goodbye: 'Despedida',
      alerts: 'Alertas',
      economy: 'Economía',
      gacha: 'Gacha',
      game: 'Juegos',
      adminonly: 'AdminOnly',
      nsfw: 'NSFW'
    };
    const messages = {
      antilinks: `> Si el *antienlace* está activado, *${botname}* eliminará a todos los usuarios que envíen links de otros grupos.`,
      antistatus: `> Si el *antiestado* está activado, *${botname}* eliminará a todos los usuarios que envié o mencionen al grupo en sus estado.`,
      anticall: `> Si el *antillamadas* está activado, *${botname}* eliminará a todos los usuarios que inicien una llamada, videollamada o chat de voz en el grupo.`,
      welcome: `> Si el mensaje de bienvenida está activado, *${botname}* enviará un mensaje de bienvenida a los nuevos miembros del grupo.`,
      goodbye: `> Si el mensaje de despedida está activado, *${botname}* enviará un mensaje de despedida en el momento que un usuario abandone el grupo.`,
      alerts: `> Si las alertas están activadas, *${botname}* avisará a los administradores cuando se realicen cambios en admins.`,
      adminonly: `> Si el modo *Solo Admin* está activado, solo los administradores podrán utilizar los comandos de *${botname}*.`
    };
    const normalizedKey = mapTerms[command] || command;
    const current = chatData[normalizedKey] === true || chatData[normalizedKey] === 1;
    const estado = current ? '✓ Activado' : '✗ Desactivado';
    const nombreBonito = featureNames[normalizedKey] || `la función *${normalizedKey}*`;
    const titulo = featureTitles[normalizedKey] || normalizedKey;
    const types = messages[normalizedKey] || "";
    if (!stateArg) {
      return sock.reply(msg.chat, `*✩ ${titulo} (✿❛◡❛)*\n\nꕥ Un administrador puede activar o desactivar ${nombreBonito} utilizando:\n\n● _Habilitar ›_ *${usedPrefix + normalizedKey} enable*\n● _Deshabilitar ›_ *${usedPrefix + normalizedKey} disable*\n\n❒ *Estado actual ›* ${estado}\n${types}`, msg);
    }
    if (!validStates.includes(stateArg)) {
      return msg.reply(`✎ Estado no válido. Usa *on*, *off*, *enable* o *disable*\n\nEjemplo:\n${usedPrefix}${normalizedKey} enable`);
    }
    const enabled = ['on', 'enable'].includes(stateArg);
    const newValue = enabled ? 1 : 0;
    if ((chatData[normalizedKey] === 1 && enabled) || (chatData[normalizedKey] === 0 && !enabled) || (chatData[normalizedKey] === true && enabled) || (chatData[normalizedKey] === false && !enabled)) {
      return msg.reply(`✎ *${titulo}* ya estaba *${enabled ? 'activado' : 'desactivado'}*.`);
    }
    chatData[normalizedKey] = newValue;
    db.updateChat(msg.chat, normalizedKey, newValue);
    return msg.reply(`✎ Has *${enabled ? 'activado' : 'desactivado'}* ${nombreBonito}.`);
  }
};
