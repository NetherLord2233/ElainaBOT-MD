import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFileSync } from 'fs' 
import path from 'path' 
import chalk from 'chalk' 

const execPromise = promisify(exec)

export default {
  command: ['rupdate', 'rfix'],
  isOwner: true,
  description: 'Actualiza el bot y luego reinicia el host.',
  run: async ({sock, msg}) => {
   const client = sock
   const m = msg

    const permitidos = [
      '573015200599',
      '5491128178894',
    ]
    const who = m?.sender || m?.key?.participant || m?.key?.remoteJid
    const normalizar = (jid = '') => jid.replace(/[^0-9]/g, '')
    if (!permitidos.map(normalizar).includes(normalizar(who))) {
      return client.sendMessage(m.chat, { text: '《✧》 No tienes permiso para usar este comando.\n\n> Solo usuarios autorizados pueden usar rfix' }, { quoted: m })
    }

    try {
      await client.sendMessage(m.chat, { react: { text: '🕑', key: m.key } })

      await execPromise('git config user.email "bot@host.com"')
      await execPromise('git config user.name "HostBot"')

      await execPromise('git fetch origin')

      const { Logger } = './log.log'

      const { stdout: branch } = await execPromise('git rev-parse --abbrev-ref HEAD')
      const currentBranch = branch.trim()

      const { stdout: diffStatus } = await execPromise(`git diff --name-status HEAD..origin/${currentBranch}`).catch(() => ({ stdout: '' }))
      const { stdout: info } = await execPromise(`git log HEAD..origin/${currentBranch} --format="%an" -1`).catch(() => ({ stdout: 'Desconocido' }))

      const lines = diffStatus.trim().split('\n').filter(line => line.trim() !== '')
      const totalFiles = lines.length

      await execPromise(`git reset --hard origin/${currentBranch}`)

      let changeList = lines.map(line => {
        const [status, ...fileParts] = line.split(/\s+/)
        const file = fileParts.join(' ')
        switch (status) {
          case 'A': return `+ ${file}`
          case 'M': return `• ${file}`
          case 'D': return `- ${file}`
          default: return `? ${file}`
        }
      }).slice(0, 20).join('\n')

      let msg = `❀ *Actualización exitosa*\n\n`
      msg += `亗 *Editor:* ${info.trim()}\n`
      msg += `✎ *Total Cambios:* ${totalFiles}\n\n`

      if (totalFiles > 0) {
          msg += `ꕥ *Detalles de archivos:*\n\`\`\`${changeList}${totalFiles > 20 ? '\n...entre otros.' : ''}\`\`\`\n\n`
      } else {
          msg += `> *El bot ya se encuentra en su última versión.*\n\n`
      }

      msg += `> *Reiniciando el bot, por favor espere...*`

      await client.sendMessage(m.chat, { text: msg }, { quoted: m })
      await client.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

      console.log(chalk.greenBright(`✅ Actualizado, reiniciando el bot.`)) 

      const botJid = client.user.id.split(':')[0] + '@s.whatsapp.net';
      const userJid = m.sender;
//      Logger.registerRestart(botJid, userJid);

      if (global.db && global.db.write) await global.db.write()

      const chatID = m.chat; 
//      const filePath = path.join(process.cwd(), 'restart_flag.txt');

 //     writeFileSync(filePath, chatID); 

      setTimeout(() => {
        process.exit(0)
      }, 3000)

    } catch (error) {
      console.log(chalk.red('[Error al actualizar y/o reiniciar]:'), error)
      await client.sendMessage(m.chat, { text: `⚠️ *Error al actualizar:* \n${error.message}` }, { quoted: m })
    }
  }
}