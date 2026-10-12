import db from '#db';

const personajes = {
  mario: { emoji: '👨‍🔧', nombre: 'Mario', precio: 0, bonus: 1 },
  luigi: { emoji: '👨‍🌾', nombre: 'Luigi', precio: 500, bonus: 1.2 },
  toad: { emoji: '🍄', nombre: 'Toad', precio: 1200, bonus: 1.5 },
  peach: { emoji: '👸', nombre: 'Peach', precio: 2500, bonus: 2.0 },
}

const niveles = {
  1: { nombre: 'Mundo 1-1', costo: 100, premio: 250, largo: 20, emoji: '🌳' },
  2: { nombre: 'Mundo 1-2 Subterraneo', costo: 300, premio: 700, largo: 25, emoji: '🧱' },
  3: { nombre: 'Mundo 1-3 Cielo', costo: 600, premio: 1500, largo: 30, emoji: '☁️' },
  4: { nombre: 'Castillo Bowser', costo: 1200, premio: 3500, largo: 35, emoji: '🏰' },
}

function generarPantalla(nivel, personaje, progreso) {
  let suelo = '🟫'.repeat(nivel.largo)
  let aire = '⬛'.repeat(nivel.largo)
  let pos = Math.min(progreso, nivel.largo - 2)
  let line1 = aire.split('')
  let line2 = suelo.split('')

  
  line1[pos] = personajes[personaje].emoji

  
  for(let i=0; i<nivel.largo; i++){
    if(i==pos) continue
    let r = Math.random()
    if(i > progreso && r > 0.85) line1[i] = '🐢'
    else if(i > progreso && r > 0.8) line1[i] = '🪙'
    else if(i > progreso && r > 0.78) line1[i] = '🕳️'
  }
  line1[nivel.largo-1] = '🏁'

  return `*${nivel.emoji} ${nivel.nombre} - NIVEL ${nivel.largo}*\n\n${line1.join('')}\n${line2.join('')}\n\n${personajes[personaje].emoji} en casilla ${progreso+1}/${nivel.largo}`
}

export default {
  command: ['mario', 'mariobros', 'supermario'],
  category: 'economy',
  description: 'Juego real de Mario Bros con economia, niveles y personajes.',

  run: async ({ msg, sock, args, usedPrefix, text }) => {
    const chatId = msg.chat;
    const senderId = msg.sender;
    const chatData = db.getChat(chatId);

    if (chatData.adminonly ||!chatData.economy) {
      return msg.reply(`ꕥ Los comandos de *Economía* están desactivados en este grupo.\n\nUn *administrador* puede activarlos con:\n» *${usedPrefix}economy on*`);
    }

    const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const botSettings = db.getSettings(botId);
    const currency = botSettings.currency || 'Monedas';

    db.setCreate('chat_users', [chatId, senderId], 'marioChar', 'mario');
    db.setCreate('chat_users', [chatId, senderId], 'marioChars', ['mario']);
    db.setCreate('chat_users', [chatId, senderId], 'marioLevel', 1);
    db.setCreate('chat_users', [chatId, senderId], 'marioPos', 0);
    db.setCreate('chat_users', [chatId, senderId], 'marioJugando', false);
    db.setCreate('chat_users', [chatId, senderId], 'lastmario', 0);

    const user = db.getChatUser(chatId, senderId);
    const sub = (args[0] || '').toLowerCase();

    
    if (!sub || sub === 'menu' || sub === 'help') {
      let txt = `╔═══ *🍄 SUPER MARIO BROS - MAQUINITA* ═══╗\n`
      txt += `║ 👤 ${personajes[user.marioChar].emoji} ${personajes[user.marioChar].nombre} | 📍 Nivel Max: ${user.marioLevel}\n`
      txt += `║ 💰 ${currency}: ${(user.coins||0).toLocaleString()}\n`
      txt += `╚═══════════════════════════╝\n\n`
      txt += `*-- PERSONAJES --*\n`
      for (let k in personajes) {
        let p = personajes[k]
        let tiene = user.marioChars.includes(k)? '✅' : `🔒 ${p.precio} ${currency}`
        txt += `${p.emoji} ${k} x${p.bonus} ${tiene}\n`
      }
      txt += `\n*-- MUNDOS --*\n`
      for (let i in niveles) {
        let n = niveles[i]
        let lock = i <= user.marioLevel? '✅' : '🔒'
        txt += `${lock} ${i}. ${n.nombre} | Costo: ${n.costo} | Premio: ${n.premio}\n`
      }
      txt += `\n*-- CONTROLES --*\n`
      txt += `» *${usedPrefix}mario jugar <nivel>* - Iniciar partida\n`
      txt += `» *${usedPrefix}mario avanzar* - Avanzar ➡️\n`
      txt += `» *${usedPrefix}mario saltar* - Saltar enemigos 🕳️🐢\n`
      txt += `» *${usedPrefix}mario elegir <pj>* - Cambiar personaje\n`
      txt += `» *${usedPrefix}mario comprar <pj>* - Comprar personaje\n`
      txt += `» *${usedPrefix}mario salir* - Abandonar partida`
      return msg.reply(txt)
    }

    if (sub === 'elegir') {
      let pj = (args[1] || '').toLowerCase()
      if (!personajes[pj]) return msg.reply(`Personajes: ${Object.keys(personajes).join(', ')}`)
      if (!user.marioChars.includes(pj)) return msg.reply(`No tienes a ${pj}. Cómpralo con *${usedPrefix}mario comprar ${pj}* cuesta ${personajes[pj].precio}`)
      db.updateChatUser(chatId, senderId, 'marioChar', pj)
      return msg.reply(`Ahora juegas con ${personajes[pj].emoji} *${personajes[pj].nombre}* Bonus x${personajes[pj].bonus}`)
    }

    if (sub === 'comprar') {
      let pj = (args[1] || '').toLowerCase()
      if (!personajes[pj]) return msg.reply(`Personajes: ${Object.keys(personajes).join(', ')}`)
      if (user.marioChars.includes(pj)) return msg.reply(`Ya tienes a ${pj}`)
      if ((user.coins||0) < personajes[pj].precio) return msg.reply(`Te faltan ${personajes[pj].precio - user.coins} ${currency} para ${pj}`)
      db.updateChatUser(chatId, senderId, 'coins', user.coins - personajes[pj].precio)
      let newChars = [...user.marioChars, pj]
      db.updateChatUser(chatId, senderId, 'marioChars', newChars)
      return msg.reply(`¡Compraste a ${personajes[pj].emoji} ${pj} por ${personajes[pj].precio} ${currency}!`)
    }

    if (sub === 'jugar' || sub === 'play') {
      if (user.marioJugando) return msg.reply(`Ya estás en una partida! Usa *${usedPrefix}mario avanzar* o *${usedPrefix}mario saltar*\n\n${generarPantalla(niveles[user.marioLevel], user.marioChar, user.marioPos)}`)
      let nivelNum = parseInt(args[1]) || user.marioLevel
      let nivel = niveles[nivelNum]
      if (!nivel) return msg.reply(`Nivel no existe. Del 1 al ${Object.keys(niveles).length}`)
      if (nivelNum > user.marioLevel) return msg.reply(`🔒 Nivel bloqueado. Llega al nivel ${nivelNum} primero.`)
      if ((user.coins||0) < nivel.costo) return msg.reply(`Necesitas ${nivel.costo} ${currency} para entrar a ${nivel.nombre}. Tienes ${user.coins}`)

      db.updateChatUser(chatId, senderId, 'coins', user.coins - nivel.costo)
      db.updateChatUser(chatId, senderId, 'marioJugando', nivelNum)
      db.updateChatUser(chatId, senderId, 'marioPos', 0)

      let pantalla = generarPantalla(nivel, user.marioChar, 0)
      return sock.sendMessage(chatId, { text: `🕹️ *PARTIDA INICIADA* - Pagaste ${nivel.costo} ${currency}\n\n${pantalla}\n\n*Controles:*\n${usedPrefix}mario avanzar ➡️\n${usedPrefix}mario saltar ⬆️` }, { quoted: msg })
    }

    if (sub === 'avanzar' || sub === 'saltar') {
      if (!user.marioJugando) return msg.reply(`No estás jugando. Usa *${usedPrefix}mario jugar*`)
      let nivel = niveles[user.marioJugando]
      let pos = user.marioPos || 0
      let esSalto = sub === 'saltar'

      
      let evento = Math.random()
      let mensajeEvento = ''
      let perdio = false

      if (!esSalto && evento > 0.7) {
        
        if (evento > 0.85) {
          mensajeEvento = `💥 ${personajes[user.marioChar].emoji} chocó con una tortuga 🐢! Retrocedes 2 casillas`
          pos = Math.max(0, pos - 2)
        } else {
          mensajeEvento = `🕳️ ${personajes[user.marioChar].emoji} cayó en un pozo! Tienes que saltar`
          perdio = true
        }
      } else {
        pos++
        if (Math.random() > 0.6) {
          let coinGain = Math.floor(Math.random()*15)+5
          db.updateChatUser(chatId, senderId, 'coins', (db.getChatUser(chatId, senderId).coins||0) + coinGain)
          mensajeEvento = `🪙 ¡Encontraste ${coinGain} ${currency}!`
        } else {
          mensajeEvento = esSalto? `✨ ¡Buen salto!` : `💨 Avanzas...`
        }
      }

      if (perdio &&!esSalto) {
        db.updateChatUser(chatId, senderId, 'marioPos', pos)
        let pantalla = generarPantalla(nivel, user.marioChar, pos)
        return sock.sendMessage(chatId, { text: `${pantalla}\n\n${mensajeEvento}\n\n⚠️ Usa *${usedPrefix}mario saltar* para pasar!` }, { quoted: msg })
      }

      
      if (pos >= nivel.largo - 1) {
        let bonus = personajes[user.marioChar].bonus
        let premio = Math.floor(nivel.premio * bonus)
        let actualCoins = db.getChatUser(chatId, senderId).coins || 0
        db.updateChatUser(chatId, senderId, 'coins', actualCoins + premio)
        db.updateChatUser(chatId, senderId, 'marioJugando', false)
        db.updateChatUser(chatId, senderId, 'marioPos', 0)
        if (user.marioLevel == user.marioJugando && user.marioLevel < Object.keys(niveles).length) {
          db.updateChatUser(chatId, senderId, 'marioLevel', user.marioLevel + 1)
        }
        return sock.sendMessage(chatId, {
          text: `🏁 *¡NIVEL COMPLETADO!* 🏁\n\n${personajes[user.marioChar].emoji} llegó al castillo!\n\n*Premio:* +${premio} ${currency} (Bonus x${bonus})\n*Desbloqueado:* Nivel ${db.getChatUser(chatId, senderId).marioLevel}\n\nUsa *${usedPrefix}mario jugar ${db.getChatUser(chatId, senderId).marioLevel}* para seguir`
        }, { quoted: msg })
      }

      db.updateChatUser(chatId, senderId, 'marioPos', pos)
      let pantalla = generarPantalla(nivel, user.marioChar, pos)
      return sock.sendMessage(chatId, { text: `${pantalla}\n\n${mensajeEvento}\n\n${usedPrefix}mario avanzar ➡️ | ${usedPrefix}mario saltar ⬆️` }, { quoted: msg })
    }

    if (sub === 'salir') {
      db.updateChatUser(chatId, senderId, 'marioJugando', false)
      db.updateChatUser(chatId, senderId, 'marioPos', 0)
      return msg.reply(`🚪 Saliste de la partida. Se perdió el progreso del nivel.`)
    }
  }
};

function msToTime(duration) {
  const seconds = Math.floor(duration / 1000);
  return `${seconds} segundo${seconds!== 1? 's' : ''}`;
          }