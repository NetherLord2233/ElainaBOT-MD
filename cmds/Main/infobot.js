import db from "#db"
import { prepareWAMessageMedia } from 'baileys'
import os from 'os'

function rTime(seconds) {
  const d = Math.floor(seconds / (3600 * 24))
  const h = Math.floor((seconds % (3600 * 24)) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return [d > 0 ? `${d}d` : '', h > 0 ? `${h}h` : '', m > 0 ? `${m}m` : '', `${s}s`].filter(Boolean).join(' ')
}

function getDefaultHostId() {
  return process.env.HOSTNAME ? process.env.HOSTNAME.split('-')[0] : 'default_host_id'
}

export default {
  command: ['infobot', 'infosocket', 'info', 'status'],
  category: 'info',
  run: async ({ msg, sock }) => {
    try {
      const botId = sock.user.id.split(':')[0] + "@s.whatsapp.net"
      const botSettings = await db.getSettings(botId)
      const users = await db.getUser()
      const chats = await db.getChat()

      const { namebot = 'Ai Surus', namebot2 = 'Surus', currency = 'BitCoins', banner = '', prefijo = '', owner = '', commandsejecut = 0 } = botSettings
      
      const isOficialBot = botId === (global?.sock?.user?.id?.split(':')[0] + '@s.whatsapp.net')
      const botType = isOficialBot ? 'Owner' : 'Sub Bot'

      const link = 'https://api.evogb.org'
      const platform = `${os.type()} ${os.release()} ${os.arch()}`
      const nodeVersion = process.version
      const cpu = os.cpus().length
      const ramTotal = (os.totalmem() / 1024 ** 3).toFixed(2)
      const ramUsada = ((os.totalmem() - os.freemem()) / 1024 ** 3).toFixed(2)
      const hostId = getDefaultHostId()
      
      const userCount = users ? Object.keys(users).length : 0
      const registeredGroups = chats ? Object.keys(chats).length : 0
      
      const uptimeDate = new Date(Date.now() - process.uptime() * 1000).toLocaleString('es-ES', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      const uptimeDuration = rTime(process.uptime())

      const dev = owner && !isNaN(owner.replace('@s.whatsapp.net', '')) ? `@${owner.split('@')[0]}` : owner || 'Oculto'

      const menu = `> ꕤ ˖ Información :: *${namebot2}*

✤ *Nombre:* ${namebot}
✤ *Moneda:* ${currency}
✤ *Prefijos:* ${prefijo}
✤ *Cmd Ejec:* ${commandsejecut.toLocaleString()}
✤ *Users:* ${userCount.toLocaleString()}
✤ *Grupos:* ${registeredGroups.toLocaleString()}

✿ *Tipo:* ${botType}
✿ *Developer:* ${dev}
✿ *Activo Desde:* ${uptimeDate} (${uptimeDuration})
✿ *Plataforma:* ${platform}
✿ *CPU:* ${cpu} Cores
✿ *RAM:* ${ramUsada} GB / ${ramTotal} GB
✿ *NodeJS:* ${nodeVersion}
✿ *Host ID:* ${hostId}

> \`Enlace:\` ${link}`.trim()

      const isVideo = /\.(mp4|gif|webm)$/i.test(banner)
      const ctx = { mentionedJid: [owner, msg.sender].filter(Boolean), isForwarded: false }

      if (isVideo) {
        await sock.sendMessage(msg.chat, { video: { url: banner }, caption: menu, contextInfo: ctx }, { quoted: msg })
      } else {
        const preview = banner ? await prepareWAMessageMedia({ image: { url: banner } }, { upload: sock.waUploadToServer, mediaTypeOverride: 'thumbnail-link' }).then(m => ({ 'canonical-url': link, 'matched-text': link, title: namebot, description: `${namebot2}, Built With 💜 By 𝙻𝚘𝙵𝚒 ☕︎ 𝚃𝙴𝙰𝙼™`, jpegThumbnail: m.imageMessage?.jpegThumbnail ? Buffer.from(m.imageMessage.jpegThumbnail) : undefined, highQualityThumbnail: m.imageMessage || undefined })) : undefined
        await sock.sendMessage(msg.chat, { text: menu, linkPreview: preview, contextInfo: ctx }, { quoted: msg })
      }
    } catch (e) {
      msg.reply(typeof msgglobal !== 'undefined' ? msgglobal : '❌ Error al obtener la información.')
    }
  }
}
