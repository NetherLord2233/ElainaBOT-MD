import db from '#db';

const COLORS = ['Rojo', 'Amarillo', 'Verde', 'Azul'];
const VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '🚫', '🔁', '➕2'];
const COLOR_EMOJIS = { 'Rojo': '🔴', 'Amarillo': '🟡', 'Verde': '🟢', 'Azul': '🔵' };

const getCardText = (color, value) => {
    if (color === 'Especial') {
        if (value === '➕4') return '[ 🌈 +4 ]';
        return '[ 🌈 Comodín Color ]';
    }
    const emoji = COLOR_EMOJIS[color] || '🃏';
    return `[ ${emoji} ${color}${value} ]`;
};

const createDeck = (playerCount = 2) => {
    let deck = []; let sets = playerCount > 4? 2 : 1;
    for (let s = 0; s < sets; s++) {
        for (const color of COLORS) {
            for (const value of VALUES) {
                deck.push({ color, value, type: 'normal', text: getCardText(color, value) });
                if (value!== '0') deck.push({ color, value, type: 'normal', text: getCardText(color, value) });
            }
        }
        for (let i = 0; i < 4; i++) {
            deck.push({ color: 'Especial', value: '🎨', type: 'wild', text: getCardText('Especial', '🎨') });
            deck.push({ color: 'Especial', value: '➕4', type: 'wild4', text: getCardText('Especial', '➕4') });
        }
    }
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    return deck;
};

const renderPublicTable = (game) => {
    let msg = `─── ❛ *TABLERO DE JUEGO :: UNO* ❜ ───\n\n`;
    msg += `> • *Pozo acumulado:* \`¥${game.pot.toLocaleString()}\`\n`;
    msg += `> • *Carta en mesa:* \`${game.currentCard?.text || 'Ninguna'}\`\n`;
    if (game.currentColor) {
        const emojiColor = COLOR_EMOJIS[game.currentColor] || '🌈';
        msg += `> • *Color activo:* \`${emojiColor} ${game.currentColor}\`\n`;
    }
    if (game.accumulatedDraw > 0) msg += `> • *Acumulado (+2):* \`+${game.accumulatedDraw} cartas\`\n`;
    msg += `\n*Jugadores en mesa:*\n`;
    (game.players || []).forEach(p => {
        const isTurn = game.turn === p;
        const status = isTurn? ' ➔ (Turno actual)' : '';
        const cardCount = (game.hands && game.hands[p])? game.hands[p].length : 0;
        const unoBadge = (game.saidUno && game.saidUno[p])? ' [¡UNO!]' : '';
        msg += `> • *@${p.split('@')[0]}*${unoBadge}${status}\n`;
        msg += `> └ Cartas: \`${cardCount}\` | Apuesta: \`¥${game.bets? (game.bets[p] || 0).toLocaleString() : 0}\`\n`;
    });
    if(game.status==='waiting'){
        msg += `\n*Responde a este mensaje:*\n> • *join* para unirte\n> • *leave* para salir\n> • *start* para iniciar (creador)`;
    } else {
        msg += `\n*Responde a este mensaje para jugar:*\n> • *1* o *1 rojo uno* para jugar\n> • *robar* - robar carta\n> • *tomar* - aceptar +2\n> • *rendirse* - abandonar`;
    }
    return msg;
};

export default {
    command: ['uno'],
    category: 'economy',
    description: 'Juego de cartas UNO multijugador con apuestas.',
    run: async ({ msg, sock, args, usedPrefix }) => {
    const chat = db.getChat(msg.chat);
if (chat.adminonly || !chat.game) {
  return msg.reply(`ꕥ Los comandos de *Juegos* están desactivados en este grupo.\n\nUn *administrador* puede activarlos con el comando:\n» *${usedPrefix}juegos on*`);
}
        try {
            const chatId = msg.chat;
            const senderId = msg.sender;
            if (!chatId ||!senderId) return;
            global.unoMultiGames = global.unoMultiGames || {};
            db.setCreate('chat_users', [chatId, senderId], 'coins', 10000);

            if(args[0]?.toLowerCase()==='reglas'){
                let r=`─── ❛ *REGLAMENTO OFICIAL DE UNO* ❜ ───\n\n`;
                r+=`*Requisito de privacidad:*\n> Debes iniciar un chat privado con el bot, o añadirlo a tus contactos para evitar que whatsapp suspenda la cuenta del socket.\n\n`;
                r+=`*Reglas de juego:*\n> 1. Empareja la carta en mesa por su color, número o símbolo.\n> 2. Al soltar tu penúltima carta, debes cantar *UNO* (respondiendo con "uno" ej: \`1 azul uno\`).\n> 3. Si te olvidas de cantar UNO, recibirás \`+2 cartas\` de penalización automáticamente.\n\n`;
                r+=`*Cartas de acción:*\n> • *Bloqueo (🚫):* Anula el turno del siguiente jugador.\n> • *Reversa (🔁):* Invierte la dirección de la partida.\n> • *Suma 2 (➕2):* Se acumula. El siguiente responde con +2 o usa \`tomar\`.\n> • *Comodín Color (🎨):* Permite cambiar el color activo de la mesa.\n> • *Comodín +4 (➕4):* Cambia el color, hace robar 4 cartas al siguiente jugador y le salta el turno.`;
                return sock.sendMessage(chatId,{text:r},{quoted:msg});
            }

            let roomId = Object.keys(global.unoMultiGames).find(id => global.unoMultiGames[id]?.chatId === chatId);
            let game = global.unoMultiGames[roomId];

            if(!game){
                let maxPlayers = parseInt(args[0])||0; let buyin = parseInt(args[1])||0;
                if(!maxPlayers ||!buyin){
                    let m=`─── ❛ *SISTEMA DE JUEGO :: UNO* ❜ ───\n\n`;
                    m+=`*Para crear sala:*\n> • \`${usedPrefix}uno [jugadores] [apuesta]\`\n> • Ejemplo: \`${usedPrefix}uno 4 5000\`\n\n`;
                    m+=`*Límites permitidos:*\n> • *Jugadores:* Mínimo \`2\` | Máximo \`8\`\n> • *Entrada/Apuesta:* Mínimo \`¥1,000\` | Máximo \`¥500,000\`\n\n`;
                    m+=`*Una vez creada, responde al tablero con:*\n> • *join* — Unirse\n> • *leave* — Salir\n> • *start* — Iniciar\n> • \`${usedPrefix}uno reglas\` — Reglas`;
                    return sock.sendMessage(chatId,{text:m},{quoted:msg});
                }
                if (maxPlayers < 2 || maxPlayers > 8) return sock.sendMessage(chatId,{text:'> El número de jugadores debe estar entre `2` y `8`.'},{quoted:msg});
                if (buyin < 1000 || buyin > 500000) return sock.sendMessage(chatId,{text:'> La entrada debe estar entre `¥1,000` y `¥500,000`.'},{quoted:msg});
                const userCoins = db.getChatUser(chatId, senderId)?.coins || 0;
                if (userCoins < buyin) return sock.sendMessage(chatId,{text:`> Fondos insuficientes. Requieres \`¥${buyin.toLocaleString()}\` para ingresar.`},{quoted:msg});
                db.updateChatUser(chatId, senderId, 'coins', userCoins - buyin);
                const id = chatId + '_' + Date.now();
                global.unoMultiGames[id] = { chatId, status: 'waiting', players: [senderId], bets: { [senderId]: buyin }, pot: buyin, maxPlayers, buyin, creator: senderId, direction: 1, accumulatedDraw: 0, saidUno: {}, deck: [], hands: {}, turn: null, msgId: null };
                const sent = await sock.sendMessage(chatId,{text:`─── ❛ *SALA CREADA CON ÉXITO* ❜ ───\n\n> • *Capacidad:* \`1/${maxPlayers}\` jugadores\n> • *Entrada:* \`¥${buyin.toLocaleString()}\`\n> • *Pozo inicial:* \`¥${buyin.toLocaleString()}\`\n\nPara unirte responde a este mensaje con: *join*`},{quoted:msg});
                global.unoMultiGames[id].msgId = sent.key.id;

                const lobbyCollector = async (upsert) => {
                    const mm = upsert.messages?.[0]; if(!mm || mm.key.remoteJid!==chatId) return;
                    const cur = global.unoMultiGames[id]; if(!cur) { sock.ev.off('messages.upsert', lobbyCollector); return; }
                    if(cur.status!=='waiting') return;
                    const snd = mm.key.participant || mm.sender || mm.key.remoteJid;
                    const ctx = mm.message?.extendedTextMessage?.contextInfo; if(!ctx || ctx.stanzaId!==cur.msgId) return;
                    const txt = (mm.message?.conversation || mm.message?.extendedTextMessage?.text || '').toLowerCase().trim();

                    if(txt==='join'){
                        if(cur.players.includes(snd)) return;
                        const openCoins = db.getChatUser(chatId, snd)?.coins || 0;
                        if(openCoins < cur.buyin){ await sock.sendMessage(chatId,{text:`> Saldo insuficiente. Requieres: \`¥${cur.buyin.toLocaleString()}\`.`},{quoted:mm}); return; }
                        if(cur.players.length>=cur.maxPlayers){ await sock.sendMessage(chatId,{text:'> La sala ha alcanzado el límite máximo de jugadores.'},{quoted:mm}); return; }
                        db.setCreate('chat_users', [chatId, snd], 'coins', 10000);
                        db.updateChatUser(chatId, snd, 'coins', openCoins - cur.buyin);
                        cur.players.push(snd); cur.bets[snd]=cur.buyin; cur.pot+=cur.buyin;
                        const b=await sock.sendMessage(chatId,{text:`Te has unido a la partida correctamente.\n> • Jugadores: \`${cur.players.length}/${cur.maxPlayers}\`\n> • Pozo acumulado: \`¥${cur.pot.toLocaleString()}\`\n\n${renderPublicTable(cur)}`,mentions:cur.players},{quoted:mm}); cur.msgId=b.key.id;
                    }
                    if(txt==='leave'){
                        if(!cur.players.includes(snd)) return;
                        const idx=cur.players.indexOf(snd); cur.players.splice(idx,1);
                        const cc=db.getChatUser(chatId,snd)?.coins||0;
                        db.updateChatUser(chatId,snd,'coins',cc+(cur.bets[snd]||0)); cur.pot-=cur.bets[snd]; delete cur.bets[snd];
                        if(cur.creator===snd && cur.players.length>0) cur.creator=cur.players[0];
                        if(cur.players.length===0){ delete global.unoMultiGames[id]; sock.ev.off('messages.upsert',lobbyCollector); await sock.sendMessage(chatId,{text:'> La sala ha sido cancelada por falta de participantes.'},{quoted:mm}); return; }
                        const b=await sock.sendMessage(chatId,{text:`Has abandonado la sala.\n> • Jugadores restantes: \`${cur.players.length}/${cur.maxPlayers}\`\n\n${renderPublicTable(cur)}`,mentions:cur.players},{quoted:mm}); cur.msgId=b.key.id;
                    }
                    if(txt==='start'){
                        if(snd!==cur.creator){ await sock.sendMessage(chatId,{text:'> Solo el creador de la sala tiene permisos para iniciar.'},{quoted:mm}); return; }
                        if(cur.players.length<2){ await sock.sendMessage(chatId,{text:'> Se requieren al menos `2` participantes para comenzar.'},{quoted:mm}); return; }
                        cur.status='playing'; cur.deck=createDeck(cur.players.length); cur.hands={}; cur.saidUno={}; cur.accumulatedDraw=0;
                        cur.players.forEach(p=>{ cur.hands[p]=[]; cur.saidUno[p]=false; for(let i=0;i<7;i++) cur.hands[p].push(cur.deck.pop()); });
                        let startingCard=cur.deck.pop(); while(startingCard.type==='wild'||startingCard.type==='wild4'||['🚫','🔁','➕2'].includes(startingCard.value)){ cur.deck.unshift(startingCard); startingCard=cur.deck.pop(); }
                        cur.currentCard=startingCard; cur.currentColor=startingCard.color; cur.turn=cur.players[0];
                        for(const p of cur.players){
                            let pm=`─── ❛ *CARTAS ASIGNADAS* ❜ ───\n\n> • *Carta en mesa:* \`${cur.currentCard.text}\`\n\n*Tu mano actual:*\n`;
                            cur.hands[p].forEach((c,i)=>{ pm+=`> \`${i+1}.\` ${c.text}\n`; });
                            pm+=`\nPara jugar desde el grupo responde al tablero con: \`1\` o \`1 azul\``;
                            try{ await sock.sendMessage(p,{text:pm}); }catch{}
                        }
                        sock.ev.off('messages.upsert',lobbyCollector);
                        const board=await sock.sendMessage(chatId,{text:renderPublicTable(cur),mentions:cur.players}); cur.msgId=board.key.id;
                        startGame(cur, id, sock);
                    }
                };
                sock.ev.on('messages.upsert', lobbyCollector);
                return;
            }
            return sock.sendMessage(chatId,{text:renderPublicTable(game),mentions:game.players},{quoted:msg});
        } catch(e){ console.error(e); }
    }
};
function startGame(game, roomId, sock){
  const processed=new Set();
  const collector=async(upsert)=>{
    const m=upsert.messages?.[0]; if(!m||m.key.remoteJid!==game.chatId) return;
    const g=global.unoMultiGames[roomId]; if(!g||g.status!=='playing'){ sock.ev.off('messages.upsert',collector); return; }
    const sender=m.key.participant||m.sender||m.key.remoteJid;
    if(!g.players.includes(sender)) return;
    if(processed.has(m.key.id)) return;
    const ctx=m.message?.extendedTextMessage?.contextInfo; if(!ctx||ctx.stanzaId!==g.msgId) return;
    const txtRaw=(m.message?.conversation||m.message?.extendedTextMessage?.text||'').toLowerCase().trim();
    if(!txtRaw) return;
    if(txtRaw==='uno'){
      if(g.hands[sender] && g.hands[sender].length<=2 &&!g.saidUno[sender]){
        g.saidUno[sender]=true;
        await sock.sendMessage(g.chatId,{text:`📢 *@${sender.split('@')[0]} ha cantado UNO.*`,mentions:[sender]});
      }
      return;
    }
    if(g.turn!==sender){ await sock.sendMessage(g.chatId,{text:'> Aún no es tu turno.'},{quoted:m}); return; }
    processed.add(m.key.id);
    const parts=txtRaw.split(/\s+/); const cmd=parts[0];

    if(['rendirse','surrender'].includes(cmd)){
      if(g.hands[sender]){ g.hands[sender].forEach(c=>g.deck.unshift(c)); delete g.hands[sender]; }
      g.players=g.players.filter(p=>p!==sender);
      await sock.sendMessage(g.chatId,{text:`*@${sender.split('@')[0]} se ha retirado de la partida.*`,mentions:[sender]});
      if(g.players.length<2){
        const survivor=g.players[0];
        if(survivor){
          const sc=db.getChatUser(g.chatId,survivor)?.coins||0;
          db.updateChatUser(g.chatId,survivor,'coins',sc+g.pot);
          await sock.sendMessage(g.chatId,{text:`─── ❛ *FIN DE LA PARTIDA POR ABANDONO* ❜ ───\n\nEl jugador *@${survivor.split('@')[0]}* ha ganado la partida por ser el único en pie.\n> • *Premio obtenido:* \`¥${g.pot.toLocaleString()}\``,mentions:[survivor]});
        }
        delete global.unoMultiGames[roomId]; sock.ev.off('messages.upsert',collector); return;
      }
      if(g.creator===sender) g.creator=g.players[0];
      g.turn=g.players[0];
      const b=await sock.sendMessage(g.chatId,{text:renderPublicTable(g),mentions:g.players}); g.msgId=b.key.id;
      try{ let nm=`─── ❛ *NOTIFICACIÓN DE TURNO* ❜ ───\n\nEs tu turno de jugar.\n> • *Carta en mesa:* \`${g.currentCard?.text}\`\n> • *Color activo:* \`${g.currentColor}\`\n\n*Tus cartas en mano:*\n`; g.hands[g.turn].forEach((c,i)=>{ nm+=`> \`${i+1}.\` ${c.text}\n`; }); await sock.sendMessage(g.turn,{text:nm}); }catch{} return;
    }

    if(cmd==='robar'){
      if(g.accumulatedDraw>0){ await sock.sendMessage(g.chatId,{text:`> Existe un acumulado de +2 activo. Debes usar \`tomar\` para recibir la penalización.`},{quoted:m}); return; }
      if(g.deck.length===0) g.deck=createDeck(g.players.length);
      const drawn=g.deck.pop(); g.hands[sender].push(drawn); g.saidUno[sender]=false;
      await sock.sendMessage(g.chatId,{text:`> Carta obtenida del mazo. Revisa tus mensajes privados.`},{quoted:m});
      try{ let pm=`─── ❛ *CARTA ROBADA* ❜ ───\n\nObtuviste: \`${drawn.text}\`\n\n*Tu mano actualizada:*\n`; g.hands[sender].forEach((c,i)=>{ pm+=`> \`${i+1}.\` ${c.text}\n`; }); await sock.sendMessage(sender,{text:pm}); }catch{}
      g.turn=g.players[(g.players.indexOf(sender)+g.direction+g.players.length)%g.players.length];
      const b=await sock.sendMessage(g.chatId,{text:renderPublicTable(g),mentions:g.players}); g.msgId=b.key.id;
      try{ let nm=`─── ❛ *NOTIFICACIÓN DE TURNO* ❜ ───\n\nEs tu turno de jugar.\n> • *Carta en mesa:* \`${g.currentCard?.text}\`\n> • *Color activo:* \`${g.currentColor}\`\n\n*Tus cartas en mano:*\n`; g.hands[g.turn].forEach((c,i)=>{ nm+=`> \`${i+1}.\` ${c.text}\n`; }); await sock.sendMessage(g.turn,{text:nm}); }catch{} return;
    }

    if(cmd==='tomar'){
      if(g.accumulatedDraw===0){ await sock.sendMessage(g.chatId,{text:'> No existen penalizaciones acumuladas en la mesa.'},{quoted:m}); return; }
      const tot=g.accumulatedDraw; for(let i=0;i<tot;i++){ if(g.deck.length===0) g.deck=createDeck(g.players.length); g.hands[sender].push(g.deck.pop()); } g.saidUno[sender]=false;
      await sock.sendMessage(g.chatId,{text:`> Has recibido las \`+${tot}\` cartas acumuladas.`},{quoted:m});
      try{ let pm=`─── ❛ *PENALIZACIÓN ACEPTADA (+${tot})* ❜ ───\n\n*Tu mano actualizada:*\n`; g.hands[sender].forEach((c,i)=>{ pm+=`> \`${i+1}.\` ${c.text}\n`; }); await sock.sendMessage(sender,{text:pm}); }catch{}
      g.accumulatedDraw=0; g.turn=g.players[(g.players.indexOf(sender)+g.direction+g.players.length)%g.players.length];
      const b=await sock.sendMessage(g.chatId,{text:renderPublicTable(g),mentions:g.players}); g.msgId=b.key.id;
      try{ let nm=`─── ❛ *NOTIFICACIÓN DE TURNO* ❜ ───\n\nEs tu turno de jugar.\n> • *Carta en mesa:* \`${g.currentCard?.text}\`\n> • *Color activo:* \`${g.currentColor}\`\n\n*Tus cartas en mano:*\n`; g.hands[g.turn].forEach((c,i)=>{ nm+=`> \`${i+1}.\` ${c.text}\n`; }); await sock.sendMessage(g.turn,{text:nm}); }catch{} return;
    }

    const idx=parseInt(cmd)-1;
    if(isNaN(idx)||!g.hands[sender][idx]){ await sock.sendMessage(g.chatId,{text:`> Número de carta no válido. Ejemplo: responde \`1\` o \`1 azul\``},{quoted:m}); return; }
    const chosen=g.hands[sender][idx];
    if(g.accumulatedDraw>0&&chosen.value!=='➕2'){ await sock.sendMessage(g.chatId,{text:`> Hay un +2 activo (\`+${g.accumulatedDraw} cartas\`). Responde con otro +2 o usa \`tomar\`.`},{quoted:m}); return; }
    if(chosen.type!=='wild'&&chosen.type!=='wild4'){ if(chosen.color!==g.currentColor&&chosen.value!==g.currentCard.value){ await sock.sendMessage(g.chatId,{text:`> Movimiento no permitido. La carta debe coincidir en color (\`${g.currentColor}\`) o en valor (\`${g.currentCard.value}\`).`},{quoted:m}); return; } }
    if(chosen.type==='wild'||chosen.type==='wild4'){
      let col=parts[1]? parts[1].charAt(0).toUpperCase()+parts[1].slice(1).toLowerCase() : '';
      if(!COLORS.includes(col)){ await sock.sendMessage(g.chatId,{text:`> Especifica un color válido: Rojo, Amarillo, Verde, Azul.\n> Ejemplo: responde \`1 azul\``},{quoted:m}); return; }
      g.currentColor=col; const em=COLOR_EMOJIS[col]||'🌈'; chosen.text=`[ 🌈 ${chosen.value} -> Color: ${em}${col} ]`;
    } else g.currentColor=chosen.color;

    if(parts.includes('uno')) g.saidUno[sender]=true;
    g.hands[sender].splice(idx,1); g.currentCard=chosen;

    if(g.hands[sender].length===1&&!g.saidUno[sender]){
      if(g.deck.length<2) g.deck=createDeck(g.players.length);
      g.hands[sender].push(g.deck.pop(), g.deck.pop());
      await sock.sendMessage(g.chatId,{text:`⚠️ *@${sender.split('@')[0]} no has cantado UNO al soltar tu penúltima carta... Recibes \`+2 cartas\` de penalización.*`,mentions:[sender]});
    }
    if(g.hands[sender].length>1) g.saidUno[sender]=false;

    if(g.hands[sender].length===0){
      const uc=db.getChatUser(g.chatId,sender)?.coins||0;
      db.updateChatUser(g.chatId,sender,'coins',uc+g.pot);
      await sock.sendMessage(g.chatId,{text:`─── ❛ *PARTIDA FINALIZADA* ❜ ───\n\nEl participante *@${sender.split('@')[0]}* se ha quedado sin cartas y gana la partida.\n> • *Premio ganado:* \`¥${g.pot.toLocaleString()}\``,mentions:[sender]});
      delete global.unoMultiGames[roomId]; sock.ev.off('messages.upsert',collector); return;
    }

    let currIdx=g.players.indexOf(sender);
    if(chosen.value==='🚫') currIdx=(currIdx+g.direction+g.players.length)%g.players.length;
    else if(chosen.value==='🔁'){ if(g.players.length===2) currIdx=(currIdx+g.direction+g.players.length)%g.players.length; else g.direction*=-1; }
    else if(chosen.value==='➕2'){ g.accumulatedDraw+=2; await sock.sendMessage(g.chatId,{text:`> Cadena +2 incrementada. Cartas acumuladas: \`+${g.accumulatedDraw}\`.`},{quoted:m}); }
    else if(chosen.type==='wild4'){
      let nextIdx=(currIdx+g.direction+g.players.length)%g.players.length; let nextP=g.players[nextIdx];
      for(let i=0;i<4;i++){ if(g.deck.length===0) g.deck=createDeck(g.players.length); g.hands[nextP].push(g.deck.pop()); }
      try{ let pm=`─── ❛ *NOTIFICACIÓN (+4)* ❜ ───\n\nRecibiste 4 cartas por un Comodín +4 y se omitió tu turno.\n\n*Tu mano actualizada:*\n`; g.hands[nextP].forEach((c,i)=>{ pm+=`> \`${i+1}.\` ${c.text}\n`; }); await sock.sendMessage(nextP,{text:pm}); }catch{}
      currIdx=nextIdx;
    }
    g.turn=g.players[(currIdx+g.direction+g.players.length)%g.players.length];
    const b=await sock.sendMessage(g.chatId,{text:renderPublicTable(g),mentions:g.players}); g.msgId=b.key.id;
    try{ let nm=`─── ❛ *NOTIFICACIÓN DE TURNO* ❜ ───\n\nEs tu turno de jugar.\n> • *Carta en mesa:* \`${g.currentCard?.text}\`\n> • *Color activo:* \`${COLOR_EMOJIS[g.currentColor]||'🌈'}${g.currentColor}\`\n`; if(g.accumulatedDraw>0) nm+=`> • *Aviso:* Cadena acumulada activa (\`+${g.accumulatedDraw}\` cartas). Lanza otro +2 o usa \`tomar\`.\n`; nm+=`\n*Tus cartas en mano:*\n`; g.hands[g.turn].forEach((c,i)=>{ nm+=`> \`${i+1}.\` ${c.text}\n`; }); await sock.sendMessage(g.turn,{text:nm}); }catch{}
  };
  sock.ev.on('messages.upsert', collector);
}