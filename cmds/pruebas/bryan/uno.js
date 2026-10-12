/*

import db from '#db';

const COLORS = ['Rojo', 'Amarillo', 'Verde', 'Azul'];
const VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '🚫', '🔁', '➕2'];

const COLOR_EMOJIS = {
    'Rojo': '🔴',
    'Amarillo': '🟡',
    'Verde': '🟢',
    'Azul': '🔵'
};

const getCardText = (color, value) => {
    if (color === 'Especial') {
        if (value === '➕4') return '[ 🌈 +4 ]';
        return '[ 🌈 Comodín Color ]';
    }
    const emoji = COLOR_EMOJIS[color] || '🃏';
    return `[ ${emoji} ${color}${value} ]`;
};

const createDeck = (playerCount = 2) => {
    let deck = [];
    let sets = playerCount > 4 ? 2 : 1;

    for (let s = 0; s < sets; s++) {
        for (const color of COLORS) {
            for (const value of VALUES) {
                deck.push({ color, value, type: 'normal', text: getCardText(color, value) });
                if (value !== '0') {
                    deck.push({ color, value, type: 'normal', text: getCardText(color, value) });
                }
            }
        }
        for (let i = 0; i < 4; i++) {
            deck.push({ color: 'Especial', value: '🎨', type: 'wild', text: getCardText('Especial', '🎨') });
            deck.push({ color: 'Especial', value: '➕4', type: 'wild4', text: getCardText('Especial', '➕4') });
        }
    }

    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
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
        const status = isTurn ? ' ➔ (Turno actual)' : '';
        const cardCount = (game.hands && game.hands[p]) ? game.hands[p].length : 0;
        const unoBadge = (game.saidUno && game.saidUno[p]) ? ' [¡UNO!]' : '';
        msg += `> • *@${p.split('@')[0]}*${unoBadge}${status}\n`;
        msg += `>    └ Cartas: \`${cardCount}\` | Apuesta: \`¥${game.bets ? (game.bets[p] || 0).toLocaleString() : 0}\`\n`;
    });

    return msg;
};

export default {
    command: ['uno', 'uno-crear', 'uno-join', 'uno-leave', 'uno-start', 'uno-play', 'uno-draw', 'uno-tomar', 'uno-reglas', 'uno-surrender', 'uno-rendirse'],
    category: 'economy',
    description: 'Juego de cartas UNO multijugador con apuestas.',
    run: async ({ msg, sock, args, usedPrefix, command }) => {
        try {
            const chatId = msg.chat;
            const senderId = msg.sender;

            if (!chatId || !senderId) return;

            const reply = async (text, options = {}) => {
                return sock.sendMessage(chatId, { text, ...options }, { quoted: msg });
            };

            const chat = db.getChat(chatId);

            if (chat?.adminonly || !chat?.economy) {
                return reply(
                    `ꕥ Los comandos de *Economía* están desactivados en este grupo.\n\n` +
                    `Un *administrador* puede activarlos con el comando:\n» *${usedPrefix}economy on*`
                );
            }

            db.setCreate('chat_users', [chatId, senderId], 'coins', 10000);

            const userCoins = db.getChatUser ? (db.getChatUser(chatId, senderId)?.coins || 0) : 0;

            global.unoMultiGames = global.unoMultiGames || {};

            const roomId = Object.keys(global.unoMultiGames).find(
                id => global.unoMultiGames[id]?.players?.includes(senderId) && global.unoMultiGames[id]?.chatId === chatId
            );

            const game = global.unoMultiGames[roomId];

            const userMessage = (msg.text || msg.body || '').trim().toLowerCase();
            if (userMessage === 'uno' && game && game.status === 'playing') {
                const hand = game.hands ? game.hands[senderId] : null;
                if (hand && hand.length <= 2) {
                    if (!game.saidUno[senderId]) {
                        game.saidUno[senderId] = true;
                        return reply(`📢 *@${senderId.split('@')[0]} ha cantado UNO.* (Le queda 1 carta en mano)`, { mentions: [senderId] });
                    }
                }
            }

            if (command === 'uno-reglas') {
                let rulesMsg = `─── ❛ *REGLAMENTO OFICIAL DE UNO* ❜ ───\n\n`;
                rulesMsg += `*Requisito de privacidad:*\n`;
                rulesMsg += `> Debes iniciar un chat privado con el bot, o añadirlo a tus contactos para evitar que whatsapp suspenda la cuenta del socket.\n\n`;
                rulesMsg += `*Reglas de juego:*\n`;
                rulesMsg += `> 1. Empareja la carta en mesa por su color, número o símbolo.\n`;
                rulesMsg += `> 2. Al soltar tu penúltima carta, debes cantar *UNO* (enviando "uno" al chat o incluyéndolo en tu jugada: \`${usedPrefix}uno-play 1 uno\`).\n`;
                rulesMsg += `> 3. Si te olvidas de cantar UNO, recibirás \`+2 cartas\` de penalización automáticamente.\n\n`;
                rulesMsg += `*Cartas de acción:*\n`;
                rulesMsg += `> • *Bloqueo (🚫):* Anula el turno del siguiente jugador.\n`;
                rulesMsg += `> • *Reversa (🔁):* Invierte la dirección de la partida.\n`;
                rulesMsg += `> • *Suma 2 (➕2):* Se acumula. El siguiente responde con +2 o usa \`${usedPrefix}uno-tomar\`.\n`;
                rulesMsg += `> • *Comodín Color (🎨):* Permite cambiar el color activo de la mesa.\n`;
                rulesMsg += `> • *Comodín +4 (➕4):* Cambia el color, hace robar 4 cartas al siguiente jugador y le salta el turno.`;
                return reply(rulesMsg);
            }

            if (command === 'uno' || command === 'uno-crear') {
                if (command === 'uno' && !args[0]) {
                    let menu = `─── ❛ *SISTEMA DE JUEGO :: UNO* ❜ ───\n\n`;
                    menu += `*Comandos de sala:*\n`;
                    menu += `> • \`${usedPrefix}uno crear [jugadores] [apuesta]\` — Crea una sala.\n`;
                    menu += `> • \`${usedPrefix}uno-crear [jugadores] [apuesta]\` — Crea una sala.\n`;
                    menu += `> • \`${usedPrefix}uno-join\` — Unirse a la sala.\n`;
                    menu += `> • \`${usedPrefix}uno-leave\` — Salir de la sala antes de iniciar.\n`;
                    menu += `> • \`${usedPrefix}uno-start\` — Iniciar la partida.\n`;
                    menu += `> • \`${usedPrefix}uno-reglas\` — Consultar reglas.\n\n`;
                    menu += `*Comandos de partida:*\n`;
                    menu += `> • \`${usedPrefix}uno-play [número] [color] [uno]\` — Jugar una carta.\n`;
                    menu += `> • \`${usedPrefix}uno-draw\` — Robar del mazo.\n`;
                    menu += `> • \`${usedPrefix}uno-tomar\` — Aceptar acumulado +2.\n`;
                    menu += `> • \`${usedPrefix}uno-surrender\` — Abandonar partida.`;
                    return reply(menu);
                }

                if (command === 'uno-crear' || args[0] === 'crear') {
                    if (game) return reply('> Ya estás registrado en una partida o sala de espera.');

                    let argOffset = command === 'uno-crear' ? 0 : 1;

                    if (!args[argOffset] || !args[argOffset + 1] || isNaN(args[argOffset]) || isNaN(args[argOffset + 1])) {
                        let usageMsg = `─── ❛ *CREACIÓN DE SALA UNO* ❜ ───\n\n`;
                        usageMsg += `Debes especificar los jugadores y la entrada:\n`;
                        usageMsg += `👉 *Uso:* \`${usedPrefix}${command === 'uno-crear' ? 'uno-crear' : 'uno crear'} [jugadores] [entrada]\`\n`;
                        usageMsg += `👉 *Ejemplo:* \`${usedPrefix}${command === 'uno-crear' ? 'uno-crear' : 'uno crear'} 4 5000\`\n\n`;
                        usageMsg += `*Límites permitidos:*\n`;
                        usageMsg += `> • *Jugadores:* Mínimo \`2\` | Máximo \`8\`\n`;
                        usageMsg += `> • *Entrada/Apuesta:* Mínimo \`¥1,000\` | Máximo \`¥500,000\``;
                        return reply(usageMsg);
                    }

                    let maxPlayers = parseInt(args[argOffset]);
                    let buyin = parseInt(args[argOffset + 1]);

                    if (maxPlayers < 2 || maxPlayers > 8) {
                        return reply('> El número de jugadores debe estar entre `2` y `8`.');
                    }

                    if (buyin < 1000 || buyin > 500000) {
                        return reply('> La entrada debe estar entre `¥1,000` y `¥500,000`.');
                    }

                    if (userCoins < buyin) {
                        return reply(`> Fondos insuficientes. Requieres \`¥${buyin.toLocaleString()}\` para ingresar.`);
                    }

                    db.updateChatUser(chatId, senderId, 'coins', userCoins - buyin);

                    const id = chatId + '_' + Date.now();
                    global.unoMultiGames[id] = { 
                        chatId: chatId, 
                        status: 'waiting', 
                        players: [senderId], 
                        bets: { [senderId]: buyin }, 
                        pot: buyin,
                        maxPlayers: maxPlayers,
                        buyin: buyin,
                        creator: senderId,
                        direction: 1,
                        accumulatedDraw: 0,
                        saidUno: {}
                    };

                    let msgCrear = `─── ❛ *SALA CREADA CON ÉXITO* ❜ ───\n\n`;
                    msgCrear += `> • *Capacidad:* \`1/${maxPlayers}\` jugadores\n`;
                    msgCrear += `> • *Entrada:* \`¥${buyin.toLocaleString()}\`\n`;
                    msgCrear += `> • *Pozo inicial:* \`¥${buyin.toLocaleString()}\`\n\n`;
                    msgCrear += `Para unirte a la partida utiliza: \`${usedPrefix}uno-join\``;
                    return reply(msgCrear);
                }
            }

            if (command === 'uno-join') {
                if (game) return reply('> Ya eres participante de una sala en este grupo.');
                const openGameId = Object.keys(global.unoMultiGames).find(id => global.unoMultiGames[id]?.status === 'waiting' && global.unoMultiGames[id]?.chatId === chatId);
                if (!openGameId) return reply('> No existen salas de espera activas en este grupo.');

                const openGame = global.unoMultiGames[openGameId];
                if (openGame.players.length >= openGame.maxPlayers) return reply('> La sala ha alcanzado el límite máximo de jugadores.');
                if (userCoins < openGame.buyin) return reply(`> Saldo insuficiente. Requieres: \`¥${openGame.buyin.toLocaleString()}\`.`);

                db.updateChatUser(chatId, senderId, 'coins', userCoins - openGame.buyin);

                openGame.players.push(senderId);
                openGame.bets[senderId] = openGame.buyin;
                openGame.pot += openGame.buyin;

                return reply(`Te has unido a la partida correctamente.\n> • Jugadores: \`${openGame.players.length}/${openGame.maxPlayers}\`\n> • Pozo acumulado: \`¥${openGame.pot.toLocaleString()}\``);
            }

            if (command === 'uno-leave') {
                if (!game) return reply('> No te encuentras registrado en ninguna sala.');
                if (game.status !== 'waiting') return reply(`> La partida ya inició. Para salir utiliza: \`${usedPrefix}uno-surrender\``);

                const index = game.players.indexOf(senderId);
                game.players.splice(index, 1);

                if (game.bets[senderId]) {
                    db.updateChatUser(chatId, senderId, 'coins', userCoins + game.bets[senderId]);
                    game.pot -= game.bets[senderId];
                    delete game.bets[senderId];
                }

                if (game.creator === senderId && game.players.length > 0) {
                    game.creator = game.players[0];
                }

                if (game.players.length === 0) {
                    delete global.unoMultiGames[roomId];
                    return reply('> La sala ha sido cancelada por falta de participantes.');
                }

                return reply(`Has abandonado la sala.\n> • Jugadores restantes: \`${game.players.length}/${game.maxPlayers}\``);
            }

            if (['uno-surrender', 'uno-rendirse'].includes(command)) {
                if (!game) return reply('> No estás participando en ninguna partida activa.');
                if (game.status !== 'playing') return reply('> La partida aún se encuentra en sala de espera.');

                const activePlayers = game.players;
                const index = activePlayers.indexOf(senderId);
                const isMyTurn = game.turn === senderId;

                if (game.hands[senderId]) {
                    game.hands[senderId].forEach(c => game.deck.unshift(c));
                    delete game.hands[senderId];
                }

                activePlayers.splice(index, 1);
                reply(`*@${senderId.split('@')[0]} se ha retirado de la partida.* Sus cartas se han devuelto al mazo.`, { mentions: [senderId] });

                if (activePlayers.length < 2) {
                    const survivor = activePlayers[0];
                    const survivorCoins = db.getChatUser ? (db.getChatUser(chatId, survivor)?.coins || 0) : 0;

                    db.updateChatUser(chatId, survivor, 'coins', survivorCoins + game.pot);

                    let abortMsg = `─── ❛ *FIN DE LA PARTIDA POR ABANDONO* ❜ ───\n\n`;
                    abortMsg += `El jugador *@${survivor.split('@')[0]}* ha ganado la partida por ser el único en pie.\n`;
                    abortMsg += `> • *Premio obtenido:* \`¥${game.pot.toLocaleString()}\``;

                    delete global.unoMultiGames[roomId];
                    return sock.sendMessage(chatId, { text: abortMsg, mentions: [survivor] });
                }

                if (game.creator === senderId) {
                    game.creator = activePlayers[0];
                }

                if (isMyTurn) {
                    let currentIdx = index % activePlayers.length;
                    game.turn = activePlayers[currentIdx];

                    let nextTurnMsg = `─── ❛ *NOTIFICACIÓN DE TURNO* ❜ ───\n\n`;
                    nextTurnMsg += `Es tu turno de jugar.\n`;
                    nextTurnMsg += `> • *Carta en mesa:* \`${game.currentCard?.text}\`\n`;
                    nextTurnMsg += `> • *Color activo:* \`${game.currentColor}\`\n\n`;
                    nextTurnMsg += `*Tus cartas en mano:*\n`;
                    game.hands[game.turn].forEach((c, idx) => {
                        nextTurnMsg += `> \`${idx + 1}.\` ${c.text}\n`;
                    });

                    sock.sendMessage(game.turn, { text: nextTurnMsg });
                }

                return reply(renderPublicTable(game), { mentions: game.players });
            }

            if (command === 'uno-start') {
                if (!game || game.status !== 'waiting') return reply('> No hay salas de espera pendientes de iniciar.');
                if (game.creator !== senderId) return reply('> Solo el creador de la sala tiene permisos para iniciar.');
                if (game.players.length < 2) return reply('> Se requieren al menos `2` participantes para comenzar.');

                game.status = 'playing';
                game.deck = createDeck(game.players.length);
                game.hands = {};
                game.saidUno = {};
                game.accumulatedDraw = 0;

                game.players.forEach(p => {
                    game.hands[p] = [];
                    game.saidUno[p] = false;
                    for (let i = 0; i < 7; i++) {
                        game.hands[p].push(game.deck.pop());
                    }
                });

                let startingCard = game.deck.pop();
                while (startingCard.type === 'wild' || startingCard.type === 'wild4' || ['🚫', '🔁', '➕2'].includes(startingCard.value)) {
                    game.deck.unshift(startingCard);
                    startingCard = game.deck.pop();
                }
                game.currentCard = startingCard;
                game.currentColor = startingCard.color;
                game.turn = game.players[0];

                game.players.forEach(p => {
                    let privateMsg = `─── ❛ *CARTAS ASIGNADAS* ❜ ───\n\n`;
                    privateMsg += `> • *Carta en mesa:* \`${game.currentCard.text}\`\n\n`;
                    privateMsg += `*Tu mano actual:*\n`;
                    game.hands[p].forEach((c, idx) => {
                        privateMsg += `> \`${idx + 1}.\` ${c.text}\n`;
                    });
                    privateMsg += `\nPara jugar desde el grupo usa: \`${usedPrefix}uno-play [número]\``;

                    sock.sendMessage(p, { text: privateMsg });
                });

                return reply(renderPublicTable(game), { mentions: game.players });
            }

            if (['uno-play', 'uno-draw', 'uno-tomar'].includes(command)) {
                if (!game || game.status !== 'playing') return reply('> No hay partidas en curso.');
                if (game.turn !== senderId) return reply('> Aún no es tu turno.');

                const activePlayers = game.players;
                let currentIdx = activePlayers.indexOf(senderId);

                if (command === 'uno-play') {
                    const cardIdx = parseInt(args[0]) - 1;
                    const playerHand = game.hands[senderId];

                    if (isNaN(cardIdx) || cardIdx < 0 || cardIdx >= playerHand.length) {
                        return reply(`> Número de carta no válido. Ejemplo: \`${usedPrefix}uno-play 1\``);
                    }

                    const chosenCard = playerHand[cardIdx];

                    if (game.accumulatedDraw > 0 && chosenCard.value !== '➕2') {
                        return reply(`> Hay un +2 activo (\`+${game.accumulatedDraw} cartas\`). Responde con otro +2 o usa \`${usedPrefix}uno-tomar\`.`);
                    }

                    if (chosenCard.type !== 'wild' && chosenCard.type !== 'wild4') {
                        if (chosenCard.color !== game.currentColor && chosenCard.value !== game.currentCard.value) {
                            return reply(`> Movimiento no permitido. La carta debe coincidir en color (\`${game.currentColor}\`) o en valor (\`${game.currentCard.value}\`).`);
                        }
                    }

                    if (chosenCard.type === 'wild' || chosenCard.type === 'wild4') {
                        let chosenColor = args[1] ? args[1].toLowerCase().trim() : '';
                        chosenColor = chosenColor.charAt(0).toUpperCase() + chosenColor.slice(1);
                        if (!COLORS.includes(chosenColor)) {
                            return reply(`> Especifica un color válido: Rojo, Amarillo, Verde, Azul.\n> Ejemplo: \`${usedPrefix}uno-play ${args[0]} azul\``);
                        }
                        game.currentColor = chosenColor;
                        const emojiSel = COLOR_EMOJIS[chosenColor] || '🌈';
                        chosenCard.text = `[ 🌈 ${chosenCard.value} -> Color: ${emojiSel}${chosenColor} ]`;
                    } else {
                        game.currentColor = chosenCard.color;
                    }

                    const containsUnoInArgs = args.some(arg => arg.toLowerCase() === 'uno');
                    if (containsUnoInArgs && playerHand.length <= 2) {
                        game.saidUno[senderId] = true;
                    }

                    playerHand.splice(cardIdx, 1);
                    game.currentCard = chosenCard;

                    let unoPenaltyText = '';
                    if (playerHand.length === 1 && !game.saidUno[senderId]) {
                        if (game.deck.length < 2) game.deck = createDeck(activePlayers.length);

                        playerHand.push(game.deck.pop());
                        playerHand.push(game.deck.pop());

                        unoPenaltyText = `⚠️ *@${senderId.split('@')[0]} no has cantado UNO al soltar tu penúltima carta... Recibes \`+2 cartas\` de penalización.*`;
                    }

                    if (playerHand.length > 1) {
                        game.saidUno[senderId] = false;
                    }

                    if (playerHand.length === 0) {
                        db.updateChatUser(chatId, senderId, 'coins', userCoins + game.pot);

                        let winMsg = `─── ❛ *PARTIDA FINALIZADA* ❜ ───\n\n`;
                        winMsg += `El participante *@${senderId.split('@')[0]}* se ha quedado sin cartas y gana la partida.\n`;
                        winMsg += `> • *Premio ganado:* \`¥${game.pot.toLocaleString()}\``;

                        delete global.unoMultiGames[roomId];
                        return reply(winMsg, { mentions: [senderId] });
                    }

                    if (unoPenaltyText) {
                        reply(unoPenaltyText, { mentions: [senderId] });
                    }

                    if (chosenCard.value === '🚫') {
                        currentIdx = (currentIdx + game.direction + activePlayers.length) % activePlayers.length;
                    } else if (chosenCard.value === '🔁') {
                        if (activePlayers.length === 2) {
                            currentIdx = (currentIdx + game.direction + activePlayers.length) % activePlayers.length;
                        } else {
                            game.direction *= -1;
                        }
                    } else if (chosenCard.value === '➕2') {
                        game.accumulatedDraw += 2;
                        reply(`> Cadena +2 incrementada. Cartas acumuladas: \`+${game.accumulatedDraw}\`.`);
                    } else if (chosenCard.type === 'wild4') {
                        let nextPlayerIdx = (currentIdx + game.direction + activePlayers.length) % activePlayers.length;
                        let nextPlayer = activePlayers[nextPlayerIdx];
                        
                        for (let i = 0; i < 4; i++) {
                            if (game.deck.length === 0) game.deck = createDeck(activePlayers.length);
                            game.hands[nextPlayer].push(game.deck.pop());
                        }

                        let privateMsgDraw = `─── ❛ *NOTIFICACIÓN (+4)* ❜ ───\n\nRecibiste 4 cartas por un Comodín +4 y se omitió tu turno.\n\n*Tu mano actualizada:*\n`;
                        game.hands[nextPlayer].forEach((c, idx) => {
                            privateMsgDraw += `> \`${idx + 1}.\` ${c.text}\n`;
                        });
                        sock.sendMessage(nextPlayer, { text: privateMsgDraw });

                        currentIdx = nextPlayerIdx;
                    }

                } else if (command === 'uno-draw') {
                    if (game.accumulatedDraw > 0) {
                        return reply(`> Existe un acumulado de +2 activo. Debes usar \`${usedPrefix}uno-tomar\` para recibir la penalización.`);
                    }
                    if (game.deck.length === 0) game.deck = createDeck(activePlayers.length);
                    const drawnCard = game.deck.pop();
                    game.hands[senderId].push(drawnCard);
                    game.saidUno[senderId] = false;

                    reply(`> Carta obtenida del mazo. Revisa tus mensajes privados.`);

                    let privateMsg = `─── ❛ *CARTA ROBADA* ❜ ───\n\nObtuviste: \`${drawnCard.text}\`\n\n*Tu mano actualizada:*\n`;
                    game.hands[senderId].forEach((c, idx) => {
                        privateMsg += `> \`${idx + 1}.\` ${c.text}\n`;
                    });
                    sock.sendMessage(senderId, { text: privateMsg });

                } else if (command === 'uno-tomar') {
                    if (game.accumulatedDraw === 0) {
                        return reply('> No existen penalizaciones acumuladas en la mesa.');
                    }

                    const totalATomar = game.accumulatedDraw;

                    for (let i = 0; i < totalATomar; i++) {
                        if (game.deck.length === 0) game.deck = createDeck(activePlayers.length);
                        game.hands[senderId].push(game.deck.pop());
                    }

                    game.saidUno[senderId] = false;
                    reply(`> Has recibido las \`+${totalATomar}\` cartas acumuladas.`);

                    let privateMsgTomar = `─── ❛ *PENALIZACIÓN ACEPTADA (+${totalATomar})* ❜ ───\n\n*Tu mano actualizada:*\n`;
                    game.hands[senderId].forEach((c, idx) => {
                        privateMsgTomar += `> \`${idx + 1}.\` ${c.text}\n`;
                    });
                    sock.sendMessage(senderId, { text: privateMsgTomar });

                    game.accumulatedDraw = 0;
                }

                let nextIdx = (currentIdx + game.direction + activePlayers.length) % activePlayers.length;
                game.turn = activePlayers[nextIdx];

                let nextTurnMsg = `─── ❛ *NOTIFICACIÓN DE TURNO* ❜ ───\n\n`;
                nextTurnMsg += `Es tu turno de jugar.\n`;
                nextTurnMsg += `> • *Carta en mesa:* \`${game.currentCard?.text}\`\n`;
                const emojiColor = COLOR_EMOJIS[game.currentColor] || '🌈';
                nextTurnMsg += `> • *Color activo:* \`${emojiColor}${game.currentColor}\`\n`;
                if (game.accumulatedDraw > 0) nextTurnMsg += `> • *Aviso:* Cadena acumulada activa (\`+${game.accumulatedDraw}\` cartas). Lanza otro +2 o usa \`${usedPrefix}uno-tomar\`.\n`;
                nextTurnMsg += `\n*Tus cartas en mano:*\n`;
                game.hands[game.turn].forEach((c, idx) => {
                    nextTurnMsg += `> \`${idx + 1}.\` ${c.text}\n`;
                });

                sock.sendMessage(game.turn, { text: nextTurnMsg });
                return reply(renderPublicTable(game), { mentions: game.players });
            }
        } catch (error) {
            console.error("Error en el juego UNO:", error);
        }
    }
};

*/