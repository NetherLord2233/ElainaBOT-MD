import db from "#db"
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
  
const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default {
  command: ['bots', 'sockets'],
  category: 'socket',
description: 'mira las sesiones y sockets activos en el grupo', 
  isAdmin: true,
  run: async ({ msg, sock }) => {
    const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net'
    const bot = await db.getSettings(botId)
    const from = msg.key.remoteJid
    const groupMetadata = msg.isGroup? await sock.groupMetadata(from).catch(() => {}) : ''
    const groupParticipants = groupMetadata?.participants?.map((p) => p.phoneNumber || p.jid || p.lid || p.id) || []

    const mainBotJid = global?.sock? global?.sock?.user?.id?.split(':')[0] + '@s.whatsapp.net' : ''
    const isMainBotInGroup = groupParticipants.includes(mainBotJid)

    const basePath = path.join(dirname, '../../Sessions')
    const getBotsFromFolder = () => {
      const folderPath = path.join(basePath, 'Subs')
      if (!fs.existsSync(folderPath)) return []
      return fs.readdirSync(folderPath).filter((dir) => fs.existsSync(path.join(folderPath, dir, 'creds.json'))).map((id) => id.replace(/\D/g, ''))
    }

    const subs = getBotsFromFolder()
    const categorizedBots = { Owner: [], Sub: [] }
    const mentionedJid = []

    const formatBot = async (number, label) => {
      const jid = number + '@s.whatsapp.net'
      if (!groupParticipants.includes(jid)) return null
      mentionedJid.push(jid)
      const data = await db.getSettings(jid)
      const name = data?.namebot2 || 'Bot'
      return `- [${label} *${name}*] › @${number}`
    }

    if (db.getSettings(mainBotJid)) {
      const name = (await db.getSettings(mainBotJid))?.namebot2
      if (isMainBotInGroup) {
        mentionedJid.push(mainBotJid)
        categorizedBots.Owner.push(`- [Owner *${name}*] › @${mainBotJid.split('@')[0]}`)
      }
    }

    for (const num of subs) {
      const line = await formatBot(num, 'Sub')
      if (line) categorizedBots.Sub.push(line)
    }

    const totalBots = 1 + subs.length
    const totalInGroup = categorizedBots.Owner.length + categorizedBots.Sub.length

    let message = `ꕥ Números de Sockets activos *(${totalBots})*\n\n`
    message += `ੈ❖‧₊˚ Principales › *1*\n`
    message += `ੈ✿‧₊˚ Subs › *${subs.length}*\n\n`
    message += `➭ *Bots en el grupo ›* ${totalInGroup}\n`

    for (const cat of ['Owner', 'Sub']) {
      if (categorizedBots[cat].length) message += categorizedBots[cat].join('\n') + '\n'
    }

    const icon = bot.icon || bot.banner || ''

    if (icon) {
      await sock.sendMessage(msg.chat, {
        image: { url: icon },
        caption: message,
        contextInfo: { mentionedJid }
      }, { quoted: msg })
    } else {
      await sock.sendMessage(msg.chat, {
        text: message,
        contextInfo: { mentionedJid }
      }, { quoted: msg })
    }
  },
};