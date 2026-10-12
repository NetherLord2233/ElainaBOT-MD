import db from '#db';

if (!global.squidGames) global.squidGames = new Map()
const getGame = (id) => global.squidGames.get(id)
const setGame = (id, data) => data===null? global.squidGames.delete(id) : global.squidGames.set(id, data)

const JUEGOS = [
  { name: 'LUZ ROJA, LUZ VERDE', emoji: '🔴', prob: 0.75 },
  { name: 'DALGONA', emoji: '🍪', prob: 0.65 },
  { name: 'CANICAS', emoji: '⚪', prob: 0.60 },
  { name: 'PUENTE CRISTAL', emoji: '🌉', prob: 0.50 },
  { name: 'PELEA CUCHILLO', emoji: '🔪', prob: 0.50 },
  { name: 'CALAMAR FINAL', emoji: '🦑', prob: 0.50 }
]

function renderReal(game, currency){
  let stage = game.stage
  let txt = `╭━━ *🦑 SQUID GAME ${game.players.length}/10* ━━╮\n`
  txt+=`│ 💰 Bote: ¥${game.pot.toLocaleString()} | Apuesta: ¥${game.bet}\n`
  txt+=`│ ${game.started? `🎮 RONDA ${stage+1}/6: ${JUEGOS[stage].emoji} ${JUEGOS[stage].name}` : '📺 LOBBY'}\n`
  txt+=`╠═══════════════════════╣\n`
  if(!game.started){
    txt+=`│ 👥 ${game.players.length}/10 jugadores:\n`
    game.players.forEach((p,i)=>{ txt+=`│ ${i==0?'👑':'▪️'} @${p.split('@')[0]}\n` })
    txt+=`│\n│ ╔════════════╗\n│ ║ 👧 MUÑECA ║\n│ ║ ESPERANDO ║\n│ ╚════════════╝\n`
  } else {
    if(stage==0){
      let doll = game.luzRoja? `👧🔴 ROJA! NO TE MUEVAS! (◕_◕) 🔫` : `👧🟢 VERDE! CORRE! (◕‿◕) 💨`
      txt+=`│ ${doll}\n│\n`
      game.alive.forEach(p=>{
        let pr = game.progress?.[p]||0
        let bar = '🟩'.repeat(pr)+'⬜'.repeat(5-pr)+(pr>=5?'🏁':'🧍')
        txt+=`│ @${p.split('@')[0].slice(0,8)}: ${bar} ${pr}/5\n`
      })
    } else {
      txt+=`│ ${JUEGOS[stage].emoji} ${JUEGOS[stage].name} - Vivos: ${game.alive.length}\n`
    }
  }
  txt+=`╰━━━━━━━━━━━━━━━━━━━━╯`
  return txt
}

export default {
  command: ['squid', 'squidgame', 'calamar'],
  category: 'economy',
  description: 'Squid Game 1-10 jugadores.',
  run: async ({ msg, sock, args, usedPrefix }) => {
    const chatId = msg.chat;
    const senderId = msg.sender;
    const chatData = db.getChat(chatId);
    if (chatData.adminonly ||!chatData.economy) return msg.reply(`Economía off, usa ${usedPrefix}economy on`)

    const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const currency = db.getSettings(botId).currency || 'Monedas';
    db.setCreate('chat_users', [chatId, senderId], 'lastsquid', 0);
    const user = db.getChatUser(chatId, senderId);
    let game = getGame(chatId)

  
    let sub = (args[0]||'').toLowerCase()
    let btnId = msg.message?.buttonsResponseMessage?.selectedButtonId || msg.message?.templateButtonReplyMessage?.selectedId || msg.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson || ''
    try { if(btnId.includes('paramsJson')){ let j=JSON.parse(btnId); btnId=j.id||'' } } catch {}
    if(btnId.startsWith('squid_')) sub = btnId.replace('squid_','')
    

    if(!sub){
      if(!game) return msg.reply(`🦑 *SQUID GAME*\n\n*${usedPrefix}squid crear 700* - Crea sala 1-10 jugadores (SOLO se puede)\n*${usedPrefix}squid unirse* - Unirse\n*${usedPrefix}squid iniciar* - Iniciar con 1 solo si quieres\n*${usedPrefix}squid tablero*\n*${usedPrefix}squid jugar*`)
      return sock.sendMessage(chatId, { text: renderReal(game, currency), mentions: game.players }, { quoted: msg })
    }

    if(sub==='crear' || sub==='create'){
      if(game) return msg.reply(`Ya hay sala ${game.players.length}/10, usa ${usedPrefix}squid tablero`)
      let bet = parseInt(args[1])||700
      if(bet<100) return msg.reply(`Mínimo 100`)
      if((user.coins||0)<bet) return msg.reply(`No tienes ${bet}, tienes ${user.coins}`)
      if(Date.now()<user.lastsquid) return msg.reply(`Espera ${Math.floor((user.lastsquid-Date.now())/1000)}s`)

      db.updateChatUser(chatId, senderId, 'coins', user.coins-bet)
      db.updateChatUser(chatId, senderId, 'lastsquid', Date.now()+5000)

      setGame(chatId, { prefix: usedPrefix, bet, pot: bet, players: [senderId], alive: [senderId], stage:0, started:false, played:[], progress:{}, pos:{}, luzRoja:false, figura:['estrella','paraguas','circulo','triangulo'][Math.floor(Math.random()*4)] })
      game = getGame(chatId)

    
      return sock.sendMessage(chatId, {
        text: `✅ Sala creada 1/10\n💰 Apuesta: ¥${bet}\n\n${renderReal(game, currency)}\n\nPuedes iniciar SOLO con 1 jugador: toca INICIAR`,
        mentions: game.players,
        buttons: [
          { buttonId: `squid_unirse`, buttonText: { displayText: '➕ UNIRSE' }, type: 1 },
          { buttonId: `squid_iniciar`, buttonText: { displayText: '🚀 INICIAR (1-10)' }, type: 1 }
        ],
        headerType: 1
      }, { quoted: msg })
    }

    if(sub==='unirse' || sub==='join'){
      if(!game) return msg.reply(`No hay sala, crea con ${usedPrefix}squid crear 700`)
      if(game.started) return msg.reply(`Ya empezó`)
      if(game.players.includes(senderId)) return msg.reply(`Ya estás dentro`)
      if(game.players.length>=10) return msg.reply(`Llena 10/10`)
      if((user.coins||0)<game.bet) return msg.reply(`Necesitas ¥${game.bet}`)
      db.updateChatUser(chatId, senderId, 'coins', user.coins-game.bet)
      game.players.push(senderId); game.alive.push(senderId); game.pot+=game.bet
      setGame(chatId, game)
      return sock.sendMessage(chatId, { text: `➕ @${senderId.split('@')[0]} se unió! ${game.players.length}/10\n${renderReal(game, currency)}`, mentions: game.players }, { quoted: msg })
    }

    if(sub==='tablero' || sub==='board'){
      if(!game) return msg.reply(`No hay sala`)
      return sock.sendMessage(chatId, { text: renderReal(game, currency), mentions: game.players }, { quoted: msg })
    }

    if(sub==='iniciar' || sub==='start'){
      if(!game) return msg.reply(`No hay sala`)
      if(game.players[0]!==senderId) return msg.reply(`Solo host @${game.players[0].split('@')[0]} puede iniciar`, { mentions: [game.players[0]] })
      
      if(game.players.length<1) return msg.reply(`Necesitas al menos 1`)
      game.started=true; game.stage=0; game.played=[]; game.progress={}; game.pos={}; game.luzRoja=false
      setGame(chatId, game)
      return sock.sendMessage(chatId, {
        text: `🚨 *¡INICIA SQUID GAME!* 🚨\n👥 Jugadores: ${game.players.length}\n💰 Bote: ¥${game.pot}\n\n*RONDA 1: ${JUEGOS[0].name}* 🔴\n👧 Muñeca de espaldas 🟢\n\nTodos toquen:\n*${usedPrefix}squid jugar* o el botón`,
        mentions: game.players,
        buttons: [{ buttonId: 'squid_jugar', buttonText: { displayText: '🟢 CORRER' }, type: 1 }],
        headerType: 1
      }, { quoted: msg })
    }

    if(sub==='jugar' || sub==='play' || sub==='correr' || sub==='cortar'){
      if(!game?.started) return msg.reply(`No hay juego, crea con ${usedPrefix}squid crear 700`)
      if(!game.alive.includes(senderId)) return msg.reply(`💀 Estás muerto, eres espectador`)
      if(game.played.includes(senderId)) return msg.reply(`Ya jugaste esta ronda ${game.played.length}/${game.alive.length}, espera a los demás`)

      let j = JUEGOS[game.stage]
      let muere = Math.random() > j.prob
      if(game.stage===0){
        game.progress[senderId]=(game.progress[senderId]||0)+1
        if(Math.random()<0.35) game.luzRoja=!game.luzRoja
        if(game.luzRoja && Math.random()<0.45) muere=true
      }
      if(game.stage===3) game.pos[senderId]=(game.pos[senderId]||0)+2

      if(muere){
        game.alive=game.alive.filter(x=>x!==senderId); game.played.push(senderId); setGame(chatId, game)
        await sock.sendMessage(chatId, { text: `💀 @${senderId.split('@')[0]} ELIMINADO en *${j.name}* ${j.emoji}\n${game.stage==0?'👧🔴 ¡TE VIO! 🔫':'💥'}\nQuedan ${game.alive.length} vivos`, mentions: [senderId] }, { quoted: msg })
      } else {
        game.played.push(senderId); setGame(chatId, game)
        await sock.sendMessage(chatId, { text: `✅ @${senderId.split('@')[0]} SOBREVIVIÓ *${j.name}* ${j.emoji} ${game.stage==0?`\n${'🟩'.repeat(game.progress[senderId])} ${game.progress[senderId]}/5`:''}`, mentions: [senderId] }, { quoted: msg })
      }

      let todosJugaron = game.alive.every(p=>game.played.includes(p))
      if(todosJugaron){
        if(game.alive.length===1){
          let w=game.alive[0]; let wu=db.getChatUser(chatId,w); db.updateChatUser(chatId,w,'coins',(wu.coins||0)+game.pot); setGame(chatId,null)
          return sock.sendMessage(chatId, { text: `╔══ *🏆 JUGADOR 456 GANA* ══╗\n║ 👑 @${w.split('@')[0]}\n║ 💰 ¥${game.pot.toLocaleString()} ${currency}\n╚═══════════════════════╝\n\nGanó con ${game.players.length} jugadores!`, mentions:[w] }, { quoted: msg })
        }
        if(game.alive.length===0){ setGame(chatId,null); return msg.reply(`💀 Todos murieron! Bote perdido ¥${game.pot}`) }
        game.stage++; game.played=[]; game.luzRoja=false; game.figura=['estrella','paraguas','circulo','triangulo'][Math.floor(Math.random()*4)]
        if(game.stage>=JUEGOS.length){
          let w=game.alive[Math.floor(Math.random()*game.alive.length)]; let wu=db.getChatUser(chatId,w); db.updateChatUser(chatId,w,'coins',(wu.coins||0)+game.pot); setGame(chatId,null)
          return sock.sendMessage(chatId, { text: `🏆 Final con ${game.alive.length} vivos, gana @${w.split('@')[0]} ¥${game.pot}`, mentions:[w] }, { quoted: msg })
        }
        setGame(chatId, game)
        return sock.sendMessage(chatId, {
          text: `✅ Ronda ${game.stage}/6 terminada! Vivos: ${game.alive.length}\n➡️ SIGUIENTE: ${JUEGOS[game.stage].emoji} ${JUEGOS[game.stage].name}\n\n${renderReal(game, currency)}`,
          mentions: game.alive,
          buttons: [{ buttonId: 'squid_jugar', buttonText: { displayText: JUEGOS[game.stage].emoji+' '+JUEGOS[game.stage].name }, type:1 }],
          headerType:1
        }, { quoted: msg })
      }
    }

    if(sub==='terminar'){
      if(!game) return msg.reply(`No hay sala`)
      if(game.players[0]!==senderId) return msg.reply(`Solo host`)
      let dev=Math.floor(game.pot/game.players.length); for(let p of game.players){ let u=db.getChatUser(chatId,p); db.updateChatUser(chatId,p,'coins',(u.coins||0)+dev) }
      setGame(chatId,null); return msg.reply(`Cancelado, devuelto ${dev}`)
    }
  }
};

function msToTime(d){ return `${Math.floor(d/1000)}s` }
