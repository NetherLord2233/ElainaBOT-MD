export default {
  command: ['gay'],
  category: 'fun',
  description: 'Detector gay',
  run: async ({ msg, sock }) => {
    const chatId = msg.chat;
    const sender = msg.sender;
    const ctx = msg.message?.extendedTextMessage?.contextInfo;

    let target = sender;

    if (msg.mentionedJid && msg.mentionedJid.length > 0) {
      target = msg.mentionedJid[0];
    } else if (ctx?.participant) {
      target = ctx.participant;
    } else if (ctx?.mentionedJid && ctx.mentionedJid.length > 0) {
      target = ctx.mentionedJid[0];
    }

    const isSelf = target === sender;
    const percent = Math.floor(Math.random() * 101);

    let barra = '';
    let fill = Math.floor(percent / 10);
    for (let i = 0; i < 10; i++) {
      barra += i < fill? '🏳️‍🌈' : '⬜';
    }

    let text = '';

    if (isSelf) {
      text += `─── ❛ *🌈 DETECTOR GAY 🌈* ❜ ───\n\n`;
      text += `> 💅 • Usuario » *@${sender.split('@')[0]}*\n`;
      text += `> 📊 • Gaymetro » \`${percent}%\`\n`;
      text += `> ${barra}\n\n`;
      text += `> ✨ Eres la más loca de todas, la reina del brillo ✨\n`;
      if (percent >= 90) {
        text += `> 👑 Te coronamos como la DIOSA GAY SUPREMA 💖`;
      } else if (percent >= 70) {
        text += `> 💃 Mija ya sal del closet, todo el grupo lo sabe`;
      } else if (percent >= 40) {
        text += `> 😏 Mitad hetero mitad brillo, eres bi-curiosa`;
      } else {
        text += `> 🤭 Te haces la santa pero te tiemblan las patitas`;
      }
    } else {
      text += `─── ❛ *🌈 DETECTOR GAY 🌈* ❜ ───\n\n`;
      text += `> 👀 • Víctima » *@${target.split('@')[0]}*\n`;
      text += `> 📊 • Gaymetro » \`${percent}%\`\n`;
      text += `> ${barra}\n\n`;
      if (percent >= 90) {
        text += `> 🏳️‍🌈 ¡ALERTA! @${target.split('@')[0]} es 100% arcoiris andante 💅✨`;
      } else if (percent >= 70) {
        text += `> 💋 @${target.split('@')[0]} se le nota lo loca de lejos`;
      } else if (percent >= 40) {
        text += `> 🤝 @${target.split('@')[0]} está en el medio, le da a todo`;
      } else {
        text += `> 😐 @${target.split('@')[0]} se hace el macho pero esconde el brillo`;
      }
    }

    text += `\n───────────────`;

    return sock.sendMessage(chatId, { text, mentions: [target] }, { quoted: msg });
  }
};