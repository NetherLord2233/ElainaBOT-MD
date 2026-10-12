import db from '#db';

global.infiltrado = global.infiltrado || {};

const categorias = {
  cantantes: [
    "Bad Bunny", "Feid", "Karol G", "Anuel AA", "Daddy Yankee", "Romeo Santos", 
    "Rauw Alejandro", "Michael Jackson", "Shakira", "Luis Alfonso", "Roberto Carlos", "Duki"
  ],
  famosos: [
    "Messi", "Cristiano Ronaldo", "MrBeast", "Ibai", "AuronPlay", "Will Smith", 
    "Keanu Reeves", "Dwayne Johnson", "Neymar", "Spreen", "Kylian Mbappé", "Bad Bunny"
  ],
  anime: [
    "Naruto", "Goku", "Luffy", "One Piece", "Attack on Titan", "Death Note", 
    "Demon Slayer", "Jujutsu Kaisen", "My Hero Academia", "Pokemon", "Bleach", "Hunter x Hunter"
  ],
  paises: [
    "Ecuador", "Colombia", "Venezuela", "Argentina", "Perú", "Chile", 
    "México", "España", "Japón", "Brasil", "Estados Unidos", "Canadá", "Francia", "Italia"
  ],
  objetos: [
    "Guitarra", "Teléfono", "Televisor", "Reloj", "Zapato", "Cuchillo", 
    "Computadora", "Anillo", "Camisa", "Lámpara", "Espejo", "Cámara", "Silla"
  ],
  frutas: [
    "Manzana", "Plátano", "Fresa", "Mango", "Uva", "Sandía", 
    "Piña", "Limón", "Naranja", "Melocotón", "Aguacate", "Pera"
  ],
  comidas: [
    "Pizza", "Hamburguesa", "Cerveza", "Helado", "Chocolate", "Café", 
    "Tacos", "Sushi", "Encebollado", "Arroz con Pollo", "Lasaña", "Pasta"
  ],
  deportes: [
    "Fútbol", "Baloncesto", "Tenis", "Ecuavoley", "Natación", "Boxeo", 
    "Béisbol", "Voleibol", "Ciclismo", "Atletismo"
  ],
  animales: [
    "Perro", "Gato", "León", "Tigre", "Elefante", "Águila", 
    "Tiburón", "Serpiente", "Caballo", "Oso", "Delfín", "Lobo"
  ]
};

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const shuffleArray = (array) => {
  let arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export default {
  command: ['infiltrado', 'infiltrado-votar'],
  category: 'games',
  description: 'Juega al infiltrado por categorías con tus amigos.',

  before: async ({ msg, sock }) => {
    const chatId = msg.chat;
    const juego = global.infiltrado[chatId];
    if (!juego || !juego.activo) return;

    const texto = msg.text?.trim();
    if (!texto) return;

    if (texto.startsWith('#') || texto.startsWith('/') || texto.startsWith('.') || texto.startsWith('!')) return;

    if (juego.fase === 'pistas') {
      const jugadorActual = juego.turnosOrder[juego.turnoIndex];

      if (msg.sender === jugadorActual) {
        if (msg.pushName) juego.nombres[msg.sender] = msg.pushName;

        juego.pistasDadas[jugadorActual] = texto;
        juego.turnoIndex++;

        if (juego.turnoIndex >= juego.turnosOrder.length) {
          juego.rondaActual++;
          juego.turnoIndex = 0;

          await sock.reply(chatId, `─── ❖ *¡RONDA DE PISTAS COMPLETADA!* ❖ ───\n\n> \`Estado:\` *Ronda ${juego.rondaActual - 1} finalizada*\n\n✐ *Pueden debatir sobre las pistas, pedir votación (\`#infiltrado votar\`) o pedir 1 ronda más (\`#infiltrado masronda\`).*`, msg);

          const maxRondas = juego.permitirExtraRonda ? 4 : 3;

          if (juego.rondaActual > maxRondas) {
            await sock.reply(chatId, `> \`Aviso:\` *¡Se ha alcanzado el límite de rondas (${maxRondas})! Iniciando votación obligatoria...*`, msg);
            await iniciarVotacion(chatId, sock, msg);
            return true;
          }

          await notificarTurno(chatId, sock, msg);
          return true;
        } else {
          await notificarTurno(chatId, sock, msg);
          return true;
        }
      }
    }
  },

  run: async ({ msg, sock, args, usedPrefix, command }) => {
    const chatId = msg.chat;

    if (!msg.isGroup) {
      return msg.reply('> `Error:` *Este juego solo se puede jugar en grupos.*');
    }

    const chat = db.getChat(msg.chat);
    if (chat.adminonly || !chat.game) {
      return msg.reply(`ꕥ Los comandos de *Juegos* están desactivados en este grupo.\n\nUn *administrador* puede activarlos con el comando:\n» *${usedPrefix}juegos on*`);
    }

    const subCommand = args[0]?.toLowerCase();

    if (!subCommand || subCommand === 'reglas' || subCommand === 'ayuda') {
      const listaCategorias = Object.keys(categorias).map(c => `• *${c}*`).join('\n');

      const menu = `─── ❖ *EL INFILTRADO - REGLAS* ❖ ───

> \`¿Cómo jugar?\`
1. Únanse al juego escribiendo \`${usedPrefix + command} join [modo]\`
2. Cuando estén listos (Mínimo 3), el creador escribe \`${usedPrefix + command} start [modo]\`
3. El bot le enviará a cada jugador la **Palabra Secreta** al privado.
4. Los Infiltrados no sabrán la palabra y deberán disimular.
5. Por turnos, cada jugador escribe **UNA SOLA PALABRA** de pista.
6. Si sospechan de alguien, usen \`${usedPrefix + command} votar\` para abrir encuesta.

───────────────
🎯 *MODOS / CATEGORÍAS DISPONIBLES:*
${listaCategorias}
• *aleatorio* (por defecto)

───────────────
⚠ *¡MUY IMPORTANTE PARA EVITAR SUSPENSIONES!*
> \`Paso 1:\` Agregar al bot a sus contactos.
> \`Paso 2:\` Escribirle un \`Hola\` al privado del bot.

───────────────
*Comandos:*
> \`${usedPrefix + command} join [modo]\` • Unirse a la sala
> \`${usedPrefix + command} start [modo]\` • Iniciar la partida
> \`${usedPrefix + command} masronda\` • Habilitar 1 ronda extra
> \`${usedPrefix + command} votar\` • Proponer votación
> \`${usedPrefix + command} reset\` • Cancelar / borrar la sala
> \`${usedPrefix + command} leave\` • Salir del juego`;

      return sock.reply(chatId, menu, msg);
    }

    let juego = global.infiltrado[chatId];

    if (subCommand === 'join' || subCommand === 'entrar') {
      if (juego && juego.activo) {
        return sock.reply(chatId, '> `Error:` *Ya hay una partida en curso en este grupo.*', msg);
      }

      const modoIngresado = args[1]?.toLowerCase();
      
      if (!juego) {
        const timeoutAutoCancel = setTimeout(async () => {
          if (global.infiltrado[chatId] && !global.infiltrado[chatId].activo) {
            delete global.infiltrado[chatId];
            await sock.sendMessage(chatId, { text: '─── ❖ *SALA CANCELADA* ❖ ───\n\n> `Aviso:` *La sala de El Infiltrado se ha cancelado automáticamente por inactividad (5 minutos).*' });
          }
        }, 300000);

        juego = global.infiltrado[chatId] = {
          creador: msg.sender,
          activo: false,
          fase: 'espera',
          jugadores: [],
          infiltrados: [],
          palabra: '',
          categoria: modoIngresado && categorias[modoIngresado] ? modoIngresado : 'aleatorio',
          turnosOrder: [],
          turnoIndex: 0,
          rondaActual: 1,
          permitirExtraRonda: false,
          pistasDadas: {},
          votosParaVotar: new Set(),
          nombres: {},
          votosEncuesta: {},
          pollMsgKey: null,
          autoCancelTimer: timeoutAutoCancel
        };
      } else if (modoIngresado && categorias[modoIngresado]) {
        juego.categoria = modoIngresado;
      }

      if (juego.jugadores.includes(msg.sender)) {
        return sock.reply(chatId, '> `Aviso:` *Ya estás dentro de la sala.*', msg);
      }

      if (juego.jugadores.length >= 8) {
        return sock.reply(chatId, '> `Error:` *La sala está llena (Máximo 8 jugadores).*', msg);
      }

      juego.jugadores.push(msg.sender);
      juego.nombres[msg.sender] = msg.pushName || msg.sender.split('@')[0];

      return sock.reply(chatId, `─── ❖ *SALA DEL INFILTRADO* ❖ ───\n\n> \`Jugador unido:\` *${juego.nombres[msg.sender]}*\n> \`Modo elegido:\` *${juego.categoria.toUpperCase()}*\n> \`Total en sala:\` *${juego.jugadores.length}/8 jugadores*\n\n✐ *Recuerda escribirle "Hola" al privado del bot para recibir tu palabra.*`, msg);
    }

    if (subCommand === 'leave' || subCommand === 'salir') {
      if (!juego || !juego.jugadores.includes(msg.sender)) {
        return sock.reply(chatId, '> `Error:` *No estás en ninguna sala.*', msg);
      }

      if (juego.activo) {
        return sock.reply(chatId, '> `Error:` *No puedes salir con la partida ya iniciada.*', msg);
      }

      const nombreSale = juego.nombres[msg.sender] || msg.sender.split('@')[0];
      juego.jugadores = juego.jugadores.filter(j => j !== msg.sender);
      delete juego.nombres[msg.sender];

      return sock.reply(chatId, `> \`Info:\` *${nombreSale} se ha salido de la sala.*`, msg);
    }

    if (subCommand === 'reset' || subCommand === 'cancel' || subCommand === 'borrar' || subCommand === 'cancelar') {
      if (!juego) {
        return sock.reply(chatId, '> `Error:` *No hay ninguna sala o partida en curso.*', msg);
      }

      const esCreador = juego.creador === msg.sender;
      const esAdmin = msg.isAdmin;

      if (!esCreador && !esAdmin) {
        return sock.reply(chatId, '> `Error:` *Solo el creador de la sala o un administrador del grupo pueden cancelar la partida.*', msg);
      }

      if (juego.autoCancelTimer) {
        clearTimeout(juego.autoCancelTimer);
      }

      delete global.infiltrado[chatId];
      return sock.reply(chatId, `─── ❖ *SALA CANCELADA* ❖ ───\n\n> \`Acción:\` *La partida ha sido eliminada por ${esCreador ? 'el creador de la sala' : 'un administrador'}.*`, msg);
    }

    if (subCommand === 'masronda' || subCommand === 'mas-ronda' || subCommand === 'extra') {
      if (!juego || !juego.activo) {
        return sock.reply(chatId, '> `Error:` *No hay ninguna partida activa.*', msg);
      }

      if (!juego.jugadores.includes(msg.sender)) {
        return sock.reply(chatId, '> `Error:` *No eres participante de esta partida.*', msg);
      }

      if (juego.permitirExtraRonda) {
        return sock.reply(chatId, '> `Aviso:` *Ya se ha habilitado la ronda extra para esta partida.*', msg);
      }

      juego.permitirExtraRonda = true;
      return sock.reply(chatId, `─── ❖ *RONDA EXTRA HABILITADA* ❖ ───\n\n> \`Solicitado por:\` *${juego.nombres[msg.sender] || msg.sender.split('@')[0]}*\n> \`Límite de rondas:\` *4 rondas en total.*\n\n✐ *¡Aprovechen bien la ronda extra para descubrir al infiltrado!*`, msg);
    }

    if (subCommand === 'start' || subCommand === 'iniciar') {
      if (!juego || juego.jugadores.length < 3) {
        return sock.reply(chatId, `> \`Error:\` *Se necesitan al menos 3 jugadores para iniciar.* (${juego?.jugadores?.length || 0}/3)`, msg);
      }

      if (juego.activo) {
        return sock.reply(chatId, '> `Error:` *El juego ya está activo.*', msg);
      }

      if (juego.autoCancelTimer) {
        clearTimeout(juego.autoCancelTimer);
      }

      const modoIngresado = args[1]?.toLowerCase();
      if (modoIngresado && categorias[modoIngresado]) {
        juego.categoria = modoIngresado;
      }

      let listaPalabras;
      if (juego.categoria === 'aleatorio' || !categorias[juego.categoria]) {
        const todas = Object.values(categorias).flat();
        listaPalabras = todas;
        juego.categoria = 'aleatorio';
      } else {
        listaPalabras = categorias[juego.categoria];
      }

      juego.activo = true;
      juego.fase = 'pistas';
      juego.palabra = pickRandom(listaPalabras);
      juego.turnosOrder = shuffleArray(juego.jugadores);

      const numInfiltrados = juego.jugadores.length >= 6 ? 2 : 1;
      const copiaJugadores = shuffleArray(juego.jugadores);
      juego.infiltrados = copiaJugadores.slice(0, numInfiltrados);

      await sock.reply(chatId, `─── ❖ *¡PARTIDA INICIADA!* ❖ ───\n\n> \`Modo:\` *${juego.categoria.toUpperCase()}*\n> \`Jugadores:\` *${juego.jugadores.length}*\n> \`Infiltrados ocultos:\` *${numInfiltrados}*\n\n✐ *Enviando la información por mensaje privado a cada participante...*`, msg);

      for (const jugador of juego.jugadores) {
        const esInfiltrado = juego.infiltrados.includes(jugador);
        try {
          if (esInfiltrado) {
            await sock.sendMessage(jugador, {
              text: `─── ❖ *EL INFILTRADO* ❖ ───\n\n> *¡Eres el infiltrado!*\n> \`Categoría de esta partida:\` *${juego.categoria.toUpperCase()}*\n\n> \`Tu objetivo:\` *No conoces la palabra secreta. Escucha las pistas de los demás y disimula dando una pista creíble sin que te descubran.*`
            });
          } else {
            await sock.sendMessage(jugador, {
              text: `─── ❖ *EL INFILTRADO* ❖ ───\n\n> \`Categoría:\` *${juego.categoria.toUpperCase()}*\n> \`Palabra:\` *${juego.palabra}*\n\n> \`Tu objetivo:\` *Da una pista corta relacionada con esta palabra sin ser tan directo.*`
            });
          }
        } catch (e) {
          console.log(`Error enviando MP a ${jugador}:`, e);
        }
      }

      await notificarTurno(chatId, sock, msg);
      return;
    }

    if (subCommand === 'votar' || subCommand === 'votacion') {
      if (!juego || !juego.activo) {
        return sock.reply(chatId, '> `Error:` *No hay ninguna partida activa.*', msg);
      }

      if (!juego.jugadores.includes(msg.sender)) {
        return sock.reply(chatId, '> `Error:` *No eres participante de esta partida.*', msg);
      }

      juego.votosParaVotar.add(msg.sender);
      const votosNecesarios = Math.ceil(juego.jugadores.length / 2);

      if (juego.votosParaVotar.size >= votosNecesarios) {
        await sock.reply(chatId, `─── ❖ *¡VOTACIÓN ACEPTADA!* ❖ ───\n\n> \`Votos alcanzados:\` *${juego.votosParaVotar.size}/${votosNecesarios}*\n\n✐ *Iniciando fase de acusación y votación por encuesta...*`, msg);
        await iniciarVotacion(chatId, sock, msg);
      } else {
        const nombreVotante = juego.nombres[msg.sender] || msg.sender.split('@')[0];
        await sock.reply(chatId, `> \`Votación:\` *${nombreVotante} quiere iniciar la votación.* (${juego.votosParaVotar.size}/${votosNecesarios} requeridos para abrir encuesta)`, msg);
      }
      return;
    }
  }
};

async function notificarTurno(chatId, sock, msg) {
  const juego = global.infiltrado[chatId];
  const jugadorActual = juego.turnosOrder[juego.turnoIndex];
  const nombreTurno = juego.nombres[jugadorActual] || jugadorActual.split('@')[0];

  const txt = `─── ❖ *RONDA ${juego.rondaActual} - TURNO* ❖ ───

> \`Turno de:\` *${nombreTurno}*
> \`Instrucciones:\` *Escribe tu pista en este chat.*

───────────────
✐ *Progresión:* \`[${juego.turnoIndex + 1}/${juego.turnosOrder.length}]\``;

  await sock.reply(chatId, txt, msg, { mentions: [jugadorActual] });
}

async function iniciarVotacion(chatId, sock, msg) {
  const juego = global.infiltrado[chatId];
  juego.fase = 'votacion';

  const opciones = juego.jugadores.map(j => juego.nombres[j] || j.split('@')[0]);

  const pollMsg = await sock.sendMessage(chatId, {
    poll: {
      name: `🔍 ¿Quién crees que es el Infiltrado? (Modo: ${juego.categoria.toUpperCase()})`,
      values: opciones,
      selectableCount: 1
    }
  });

  if (pollMsg?.key) {
    juego.pollMsgKey = pollMsg.key;
  }

  const resumenPistas = juego.jugadores.map(j => {
    const nom = juego.nombres[j] || j.split('@')[0];
    const pista = juego.pistasDadas[j] ? `"${juego.pistasDadas[j]}"` : '_Sin pista_';
    return `• *${nom}*: ${pista}`;
  }).join('\n');

  await sock.reply(chatId, `─── ❖ *ENCUESTA CREADA* ❖ ───

> \`Pistas de esta partida:\`
${resumenPistas}

───────────────
✐ *¡Voten directamente en la encuesta de arriba!*
_Tienen 40 segundos antes de evaluar el resultado de los votos y revelar al infiltrado._`, msg);

  const pollHandler = async ({ messages }) => {
    for (const m of messages) {
      if (m.message?.pollUpdateMessage) {
        const pollCreationKey = m.message.pollUpdateMessage.pollCreationMessageKey;
        if (juego.pollMsgKey && pollCreationKey.id === juego.pollMsgKey.id) {
          const votante = m.key.participant || m.key.remoteJid;
          if (juego.jugadores.includes(votante)) {
            const voteVotes = m.message.pollUpdateMessage.selectedOptions || [];
            if (voteVotes.length > 0) {
              juego.votosEncuesta[votante] = voteVotes[0].name || voteVotes[0];
            }
          }
        }
      }
    }
  };

  sock.ev.on('messages.upsert', pollHandler);

  setTimeout(async () => {
    sock.ev.off('messages.upsert', pollHandler);

    if (global.infiltrado[chatId]?.activo) {
      const conteo = {};
      Object.values(juego.votosEncuesta).forEach(opcionElegida => {
        conteo[opcionElegida] = (conteo[opcionElegida] || 0) + 1;
      });

      let masVotadoNombre = null;
      let maxVotos = 0;
      for (const [nombre, votos] of Object.entries(conteo)) {
        if (votos > maxVotos) {
          maxVotos = votos;
          masVotadoNombre = nombre;
        }
      }

      const infiltradosNombres = juego.infiltrados.map(i => juego.nombres[i] || i.split('@')[0]);
      const descubierto = masVotadoNombre && infiltradosNombres.includes(masVotadoNombre);

      let resultadoTexto = '';
      if (descubierto) {
        resultadoTexto = `🎉 *¡VICTORIA DEL PUEBLO / TRIPULACIÓN!* 🎉\n\n> \`Votado más sospechoso:\` *${masVotadoNombre}* (${maxVotos} votos)\n> \`Resultado:\` *¡Han atrapado al Infiltrado con éxito!*`;
      } else {
        resultadoTexto = `😈 *¡VICTORIA DEL INFILTRADO!* 😈\n\n> \`Resultado:\` *El pueblo no logró ponerse de acuerdo o votó a un inocente.* ¡El Infiltrado logró engañarlos a todos!`;
      }

      await sock.reply(chatId, `─── ❖ *RESULTADOS DE LA PARTIDA* ❖ ───

${resultadoTexto}

───────────────
> \`Modo:\` *${juego.categoria.toUpperCase()}*
> \`Palabra secreta:\` *${juego.palabra}*
> \`El/Los Infiltrados eran:\` *${infiltradosNombres.join(', ')}*

───────────────
✐ *¡Gracias por jugar! Usen \`#infiltrado join\` para iniciar una nueva partida.*`, msg);

      delete global.infiltrado[chatId];
    }
  }, 40000);
}
