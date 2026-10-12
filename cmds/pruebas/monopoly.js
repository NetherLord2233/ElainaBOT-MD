
import db from '#db';


const tablero = [
  { name: 'GO', tipo: 'go', precio: 0 },
  { name: 'BALTIC AVE', tipo: 'prop', precio: 60, renta: 4, color: '🟤' },
  { name: 'COMMUNITY CHEST', tipo: 'chest' },
  { name: 'ORIENTAL AVE', tipo: 'prop', precio: 100, renta: 6, color: '🩵' },
  { name: 'INCOME TAX', tipo: 'tax', precio: 200 },
  { name: 'READING RAILROAD', tipo: 'prop', precio: 200, renta: 25, color: '⬛' },
  { name: 'CHANCE', tipo: 'chance' },
  { name: 'JAIL', tipo: 'jail' },
  { name: 'ST CHARLES PLACE', tipo: 'prop', precio: 140, renta: 10, color: '🩷' },
  { name: 'ELECTRIC COMPANY', tipo: 'prop', precio: 150, renta: 20, color: '💡' },
  { name: 'STATES AVE', tipo: 'prop', precio: 140, renta: 10, color: '🩷' },
  { name: 'VIRGINIA AVE', tipo: 'prop', precio: 160, renta: 12, color: '🩷' },
  { name: 'PENN RAILROAD', tipo: 'prop', precio: 200, renta: 25, color: '⬛' },
  { name: 'ST JAMES PLACE', tipo: 'prop', precio: 180, renta: 14, color: '🟧' },
  { name: 'COMMUNITY CHEST', tipo: 'chest' },
  { name: 'TENNESSEE AVE', tipo: 'prop', precio: 180, renta: 14, color: '🟧' },
  { name: 'NEW YORK AVE', tipo: 'prop', precio: 200, renta: 16, color: '🟧' },
  { name: 'FREE PARKING', tipo: 'free' },
  { name: 'KENTUCKY AVE', tipo: 'prop', precio: 220, renta: 18, color: '🟥' },
  { name: 'CHANCE', tipo: 'chance' },
  { name: 'INDIANA AVE', tipo: 'prop', precio: 220, renta: 18, color: '🟥' },
  { name: 'ILLINOIS AVE', tipo: 'prop', precio: 240, renta: 20, color: '🟥' },
  { name: 'B&O RAILROAD', tipo: 'prop', precio: 200, renta: 25, color: '⬛' },
  { name: 'ATLANTIC AVE', tipo: 'prop', precio: 260, renta: 22, color: '🟨' },
  { name: 'VENTNOR AVE', tipo: 'prop', precio: 260, renta: 22, color: '🟨' },
  { name: 'WATER WORKS', tipo: 'prop', precio: 150, renta: 20, color: '💧' },
  { name: 'MARVIN GARDENS', tipo: 'prop', precio: 280, renta: 24, color: '🟨' },
  { name: 'GO TO JAIL', tipo: 'gojail' },
  { name: 'PACIFIC AVE', tipo: 'prop', precio: 300, renta: 26, color: '🟩' },
  { name: 'N CAROLINA AVE', tipo: 'prop', precio: 300, renta: 26, color: '🟩' },
  { name: 'COMMUNITY CHEST', tipo: 'chest' },
  { name: 'PENNSYLVANIA AVE', tipo: 'prop', precio: 320, renta: 28, color: '🟩' },
  { name: 'SHORT LINE', tipo: 'prop', precio: 200, renta: 25, color: '⬛' },
  { name: 'CHANCE', tipo: 'chance' },
  { name: 'PARK PLACE', tipo: 'prop', precio: 350, renta: 35, color: '🟦' },
  { name: 'LUXURY TAX', tipo: 'tax', precio: 100 },
  { name: 'BOARDWALK', tipo: 'prop', precio: 400, renta: 50, color: '🟦' },
]

const chanceCards = [
  "Avanzas a GO +200", "Ve a la cárcel", "Te regalan 100 coins", "Multa 150 coins", "Avanzas a BOARDWALK", "Cobra 50 coins"
]

function renderTablero(userData) {
  let pos = userData.monoPos || 0
  let props = userData.monoProps || []
  let txt = `┏━━━━ *🎩 MONOPOLY CLASSIC* ━━━━┓\n`
  txt += `┃ 📍 Estás en: ${tablero[pos].name} [${pos}]\n`
  txt += `┃ 🎲 Último dado: ${userData.monoLastDice || ' - '}\n`
  txt += `┃ 🏠 Propiedades: ${props.length} | 🟩 Casas: ${userData.monoCasas || 0} | 🟥 Hoteles: ${userData.monoHoteles || 0}\n`
  txt += `┗━━━━━━━━━━━━━━━━━━━━━━━┛\n\n`

  
  txt += `*TABLERO:*\n`
  for (let i = 0; i < tablero.length; i++) {
    let icon = i == pos? '👨‍🔧' : props.includes(i)? '🏠' : tablero[i].color || '⬜'
    txt += `${icon}`
    if ((i + 1) % 10 == 0) txt += `\n`
  }
  txt += `\n\n*Casilla actual:*\n${pos == 0? 'GO → +200' : JSON.stringify(tablero[pos])}\n`
  return txt
}

export default {
  command: ['monopoly', 'mono', 'monopolio'],
  category: 'economy',
  description: 'Juego real de Monopoly con tablero, dados y propiedades.',
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

    db.setCreate('chat_users', [chatId, senderId], 'monoPos', 0);
    db.setCreate('chat_users', [chatId, senderId], 'monoProps', []);
    db.setCreate('chat_users', [chatId, senderId], 'monoCasas', 0);
    db.setCreate('chat_users', [chatId, senderId], 'monoHoteles', 0);
    db.setCreate('chat_users', [chatId, senderId], 'monoLastDice', '');
    db.setCreate('chat_users', [chatId, senderId], 'lastmono', 0);
    db.setCreate('chat_users', [chatId, senderId], 'monoJail', 0);

    const user = db.getChatUser(chatId, senderId);
    const sub = (args[0] || '').toLowerCase()

    if (!sub || sub === 'menu' || sub === 'help') {
      let props = user.monoProps.map(i => `${tablero[i].color} ${tablero[i].name}`).join('\n') || 'Ninguna'
      return msg.reply(`*🎩 MONOPOLY - COMO LA FOTO* 🎲

${renderTablero(user)}

💰 Tu ${currency}: ${(user.coins||0).toLocaleString()}
🏠 Tus propiedades:
${props}

*COMANDOS:*
» *${usedPrefix}monopoly tirar [100]* - Tira dados y apuesta
» *${usedPrefix}monopoly comprar* - Compra la casilla donde estás
» *${usedPrefix}monopoly construir* - Construye casa 🟩 100 coins / hotel 🟥 500
» *${usedPrefix}monopoly tablero* - Ver tablero
» *${usedPrefix}monopoly vender <num>* - Vende propiedad
» *${usedPrefix}monopoly reset* - Reinicia tu juego

Apuesta mínima: 50 ${currency} para tirar`)
    }

    if (sub === 'tablero' || sub === 'board') {
      return msg.reply(renderTablero(user))
    }

    if (sub === 'reset') {
      db.updateChatUser(chatId, senderId, 'monoPos', 0)
      db.updateChatUser(chatId, senderId, 'monoProps', [])
      db.updateChatUser(chatId, senderId, 'monoCasas', 0)
      db.updateChatUser(chatId, senderId, 'monoHoteles', 0)
      db.updateChatUser(chatId, senderId, 'monoJail', 0)
      return msg.reply(`🔄 Tablero reiniciado. Vuelves a GO!`)
    }

    if (sub === 'tirar' || sub === 'roll' || sub === 'jugar') {
      let bet = parseInt(args[1]) || 50
      if (bet < 50) return msg.reply(`Apuesta mínima 50 ${currency}`)
      if ((user.coins||0) < bet) return msg.reply(`No tienes suficientes ${currency}. Tienes ${user.coins}`)

      const cooldown = 8 * 1000
      if (Date.now() < user.lastmono) {
        return msg.reply(`⏳ Espera ${Math.ceil((user.lastmono - Date.now())/1000)}s para tirar de nuevo`)
      }

      if (user.monoJail > 0) {
        db.updateChatUser(chatId, senderId, 'monoJail', user.monoJail - 1)
        db.updateChatUser(chatId, senderId, 'lastmono', Date.now() + cooldown)
        return msg.reply(`🔒 Estás en la CÁRCEL! Te quedan ${user.monoJail} turnos. Paga 150 ${currency} con *${usedPrefix}monopoly salir* para salir`)
      }

      let d1 = Math.floor(Math.random()*6)+1
      let d2 = Math.floor(Math.random()*6)+1
      let total = d1 + d2
      let newPos = (user.monoPos + total) % tablero.length
      let pasoPorGo = (user.monoPos + total) >= tablero.length
      let casilla = tablero[newPos]

      db.updateChatUser(chatId, senderId, 'monoPos', newPos)
      db.updateChatUser(chatId, senderId, 'monoLastDice', `${d1}+${d2}=${total}`)
      db.updateChatUser(chatId, senderId, 'lastmono', Date.now() + cooldown)

      let msgTxt = `🎲 *TIRASTE: ${d1} + ${d2} = ${total}*\n`
      msgTxt += `${renderTablero({...user, monoPos: newPos, monoLastDice: `${d1}+${d2}` })}\n`

      if (pasoPorGo) {
        db.updateChatUser(chatId, senderId, 'coins', (user.coins||0) + 200)
        msgTxt += `✅ Pasaste por GO! +200 ${currency}\n\n`
      }

      if (casilla.tipo === 'prop') {
        let owner = null
        
        let allUsers = db.getChatUsers(chatId)
        for (let u of allUsers) {
          if (u.monoProps && u.monoProps.includes(newPos) && u.jid!== senderId) owner = u
        }
        if (owner) {
          let renta = casilla.renta + (owner.monoCasas * 20) + (owner.monoHoteles * 100)
          if ((user.coins||0) < renta) {
            msgTxt += `💸 Caíste en ${casilla.name} de @${owner.jid.split('@')[0]} y no puedes pagar ${renta} ${currency}! Pierdes tu apuesta de ${bet}`
            db.updateChatUser(chatId, senderId, 'coins', Math.max(0, (user.coins||0) - bet))
          } else {
            db.updateChatUser(chatId, senderId, 'coins', (user.coins||0) - renta)
            db.updateChatUser(chatId, owner.jid, 'coins', (owner.coins||0) + renta)
            msgTxt += `💸 Caíste en ${casilla.name} de @${owner.jid.split('@')[0]}. Pagaste renta ${renta} ${currency}\n`
          }
        } else if ((user.monoProps||[]).includes(newPos)) {
          msgTxt += `🏠 Ya eres dueño de ${casilla.name}. Puedes construir con *${usedPrefix}monopoly construir*\n`
        } else {
          msgTxt += `🟩 *${casilla.name} ESTÁ EN VENTA*\n💲 Precio: ${casilla.precio} ${currency} | Renta: ${casilla.renta}\nUsa *${usedPrefix}monopoly comprar* para comprar\n`
        }
      } else if (casilla.tipo === 'tax') {
        db.updateChatUser(chatId, senderId, 'coins', (user.coins||0) - casilla.precio)
        msgTxt += `💸 TAX! Pagaste ${casilla.precio} ${currency} en ${casilla.name}\n`
      } else if (casilla.tipo === 'gojail') {
        db.updateChatUser(chatId, senderId, 'monoPos', 7)
        db.updateChatUser(chatId, senderId, 'monoJail', 3)
        msgTxt += `🚨 ¡GO TO JAIL! Vas directo a la cárcel 3 turnos\n`
      } else if (casilla.tipo === 'chance' || casilla.tipo === 'chest') {
        let card = chanceCards[Math.floor(Math.random()*chanceCards.length)]
        msgTxt += `❓ *${casilla.tipo.toUpperCase()}*: ${card}\n`
        if (card.includes('GO')) { db.updateChatUser(chatId, senderId, 'monoPos', 0); db.updateChatUser(chatId, senderId, 'coins', (user.coins||0)+200) }
        if (card.includes('cárcel')) { db.updateChatUser(chatId, senderId, 'monoPos', 7); db.updateChatUser(chatId, senderId, 'monoJail', 3) }
        if (card.includes('regalan')) db.updateChatUser(chatId, senderId, 'coins', (user.coins||0)+100)
        if (card.includes('Multa')) db.updateChatUser(chatId, senderId, 'coins', (user.coins||0)-150)
      }

      msgTxt += `\n💰 Balance: ${(db.getChatUser(chatId, senderId).coins||0).toLocaleString()} ${currency}`
      return sock.sendMessage(chatId, { text: msgTxt, mentions: [senderId] }, { quoted: msg })
    }

    if (sub === 'comprar' || sub === 'buy') {
      let pos = user.monoPos
      let casilla = tablero[pos]
      if (casilla.tipo!== 'prop') return msg.reply(`Aquí no puedes comprar. Es ${casilla.name}`)
      if ((user.monoProps||[]).includes(pos)) return msg.reply(`Ya eres dueño de ${casilla.name}`)
      if ((user.coins||0) < casilla.precio) return msg.reply(`Te faltan ${casilla.precio - user.coins} ${currency} para comprar ${casilla.name}`)

      db.updateChatUser(chatId, senderId, 'coins', user.coins - casilla.precio)
      db.updateChatUser(chatId, senderId, 'monoProps', [...user.monoProps, pos])
      return msg.reply(`✅ Compraste ${casilla.color} *${casilla.name}* por ${casilla.precio} ${currency}!\nAhora cobra ${casilla.renta} de renta cada vez que caigan.`)
    }

    if (sub === 'construir' || sub === 'casa' || sub === 'hotel') {
      let casas = user.monoCasas || 0
      if ((user.monoProps||[]).length === 0) return msg.reply(`Necesitas al menos 1 propiedad para construir`)
      if (sub === 'casa' || args[0] === 'construir') {
        if ((user.coins||0) < 100) return msg.reply(`Casa cuesta 100 ${currency}`)
        db.updateChatUser(chatId, senderId, 'coins', user.coins - 100)
        db.updateChatUser(chatId, senderId, 'monoCasas', casas + 1)
        return msg.reply(`🟩 Construiste 1 casa! Total casas: ${casas+1}. Tu renta sube +20 por propiedad`)
      }
    }

    if (sub === 'salir') {
      if (user.monoJail <= 0) return msg.reply(`No estás en la cárcel`)
      if ((user.coins||0) < 150) return msg.reply(`Necesitas 150 ${currency} para salir`)
      db.updateChatUser(chatId, senderId, 'coins', user.coins - 150)
      db.updateChatUser(chatId, senderId, 'monoJail', 0)
      return msg.reply(`🔓 Pagaste fianza y saliste de la cárcel!`)
    }
  }
};

function msToTime(duration) {
  const seconds = Math.floor(duration / 1000);
  return `${seconds} segundo${seconds!== 1? 's' : ''}`;
  }
