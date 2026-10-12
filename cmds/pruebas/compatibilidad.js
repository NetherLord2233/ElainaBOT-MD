import db from '#db';

export default {
  command: ['compatibilidad','compat','ship','amorce','lovecompat'],
  category: 'fun',
  description: 'Compatibilidad amorosa entre 2 personas random del grupo',
  run: async ({ msg, sock, args, usedPrefix }) => {
    const chatId = msg.chat
    const senderId = msg.sender

    
    let participants = []
    try {
      const meta = await sock.groupMetadata(chatId).catch(()=>null)
      if (meta?.participants) participants = meta.participants.map(p=>p.id)
    } catch {}
    if (participants.length < 2) participants = [senderId, senderId]

    let user1, user2

  
    if (msg.mentions && msg.mentions.length >= 1) {
      user1 = senderId
      user2 = msg.mentions[0]
    } else if (msg.mentions && msg.mentions.length == 0 && args[0]?.includes('@')) {
      
      user1 = senderId
      user2 = args[0].replace(/[^0-9]/g,'')+'@s.whatsapp.net'
    } else if (args.length >= 1 && args[0].startsWith('@')) {
      user1 = senderId
      user2 = participants.find(p=>p.includes(args[0].replace('@',''))) || participants[Math.floor(Math.random()*participants.length)]
    } else {
      
      let shuffled = [...participants].sort(()=>0.5-Math.random())
      
      const botId = sock.user.id.split(':')[0]+'@s.whatsapp.net'
      shuffled = shuffled.filter(p=>p!==botId)
      user1 = shuffled[0] || senderId
      user2 = shuffled[1] || shuffled[0] || senderId
      if (user1===user2) {
        let extra = participants.filter(p=>p!==user1 && p!==botId)
        user2 = extra[Math.floor(Math.random()*extra.length)] || user1
      }
    }

    if (!user1 ||!user2) return msg.reply(`Menciona a alguien: ${usedPrefix}ship @usuario`)

    
    let seed = (user1+user2).split('').reduce((a,b)=>a+b.charCodeAt(0),0)
    let porcentaje = (seed * 9301 + 49297) % 233280
    porcentaje = Math.floor((porcentaje / 233280) * 101) // 0-100
    if (porcentaje < 5) porcentaje += 10

    let barra = '█'.repeat(Math.floor(porcentaje/10)) + '░'.repeat(10-Math.floor(porcentaje/10))

    let frases = []
    if (porcentaje < 20) frases = ['💔 Son como agua y aceite','😭 Mejor ni lo intenten','🚫 Cero química','Van a terminar bloqueados']
    else if (porcentaje < 40) frases = ['🤔 Hay algo pero falta chispa','😅 Amigos con suerte... poca','Puede que solo como amigos']
    else if (porcentaje < 60) frases = ['😏 Hay tensión por ahí','👀 Se gustan pero no lo admiten','🔥 Potencial para algo']
    else if (porcentaje < 80) frases = ['💖 Compatibles, háganle!','😍 Química potente','💘 Casi novios ya']
    else if (porcentaje < 90) frases = ['💞 ALMAS GEMELAS','❤️‍🔥 Puro fuego','💍 Ya cásense']
    else frases = ['💯 100% DESTINADOS','👩‍❤️‍👨 HECHOS EL UNO PARA EL OTRO','💒 BODA SEGURA']

    let frase = frases[Math.floor(Math.random()*frases.length)]

    let texto = `╭━━━ *💘 COMPATIBILIDAD* ━━━╮
┃
┃ 👤 @${user1.split('@')[0]}
┃ ❤️‍🔥 +
┃ 👤 @${user2.split('@')[0]}
┃
┣━━━ *RESULTADO* ━━━
┃ ${barra} ${porcentaje}%
┃
┃ *${frase}*
┃
╰━━━━━━━━━━━━━━╯
${porcentaje > 80? '¡Se besan o qué? 😏' : porcentaje < 20? 'Ni para amigos 😂' : '¿Se dan una oportunidad?'}`

    await sock.sendMessage(chatId, { text: texto, mentions: [user1, user2] }, { quoted: msg })

    
    if (porcentaje > 85) {
      try { await sock.sendMessage(chatId, { react: { text: '💖', key: msg.key } }) } catch {}
    }
  }
      }
