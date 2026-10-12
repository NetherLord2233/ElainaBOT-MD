import db from "#db"

export default {
  command: ['addgroup'],
  isInv: true,
  category: 'owner',
  description: 'Agregar alguien al grupo.',
  run: async ({ msg, sock, args }) => {
    if (!msg.isGroup) return msg.reply('《✧》 Este comando solo funciona en grupos.')

    const idBot = sock.user.id.split(':')[0] + '@s.whatsapp.net'
    const metadata = await sock.groupMetadata(msg.chat).catch(() => null)
    if (!metadata) return msg.reply('《✧》 No pude obtener info del grupo.')

    const botIsAdmin = metadata.participants.find(p => p.id === idBot)?.admin
    if (!botIsAdmin) return msg.reply('《✧》 Necesito ser admin para agregar.')

    if (!args[0]) return msg.reply('《✧》 Usa: addgroup 57300xxxxxxx')

    const numbers = args.join(' ').split(/[,;\s]+/).map(n => n.replace(/[^0-9]/g, '')).filter(n => n.length >= 8)
    if (!numbers.length) return msg.reply('《✧》 Número inválido.')

    const jids = numbers.map(n => n + '@s.whatsapp.net')

    try {
      const res = await sock.groupParticipantsUpdate(msg.chat, jids, 'add')

      for (const r of res) {
        if (r.status == 200) {
          await msg.reply(`《✧》 Agregado @${r.jid.split('@')[0]}`, { mentions: [r.jid] })
        } else {
          // Si no deja agregar por privacidad, le manda el link
          try {
            const code = await sock.groupInviteCode(msg.chat)
            await sock.sendMessage(r.jid, { text: `Te invitaron a ${metadata.subject}\nhttps://chat.whatsapp.com/${code}` })
            await msg.reply(`《✧》 @${r.jid.split('@')[0]} tiene privacidad, le envié el link por privado.`, { mentions: [r.jid] })
          } catch {
            await msg.reply(`《✧》 No se pudo agregar a @${r.jid.split('@')[0]}`, { mentions: [r.jid] })
          }
        }
      }
    } catch (e) {
      return msg.reply(`《✧》 Error al agregar: ${String(e.message || e).slice(0,150)}`)
    }
  },
}
