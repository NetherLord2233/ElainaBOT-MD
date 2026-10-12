import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { exec } from 'child_process'
import { promisify } from 'util'
import chalk from 'chalk'

const execPromise = promisify(exec)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function reloadCommands(dir) {
  const commandsMap = new Map()

  async function readCommands(folder) {
    const files = fs.readdirSync(folder)
    for (const file of files) {
      const fullPath = path.join(folder, file)
      if (fs.lstatSync(fullPath).isDirectory()) {
        await readCommands(fullPath)
      } else if (file.endsWith('.js')) {
        try {
          const fileUrl = `${pathToFileURL(fullPath).href}?v=${Date.now()}`
          const { default: cmd } = await import(fileUrl)

          if (cmd?.command) {
            const commandsList = Array.isArray(cmd.command) ? cmd.command : [cmd.command]
            commandsList.forEach((c) => {
              commandsMap.set(c.toLowerCase(), cmd)
            })
          }
        } catch (err) {
          console.error(`Error recargando comando ${file}:`, err)
        }
      }
    }
  }

  await readCommands(dir)
  global.comandos = commandsMap
}

export default {
  command: ['fix'],
  isOwner: true,
  description: 'Actualiza el bot desde GitHub y recarga todos los comandos.',
  run: async ({ sock, msg }) => {
    const client = sock
    const m = msg

    const permitidos = [
      '573015200599',
      '5491128178894',
      '584148014097',
      '593989068253', 
      '584122228574',
    ]
    const who = m?.sender || m?.key?.participant || m?.key?.remoteJid
    const normalizar = (jid = '') => jid.replace(/[^0-9]/g, '')
    if (!permitidos.map(normalizar).includes(normalizar(who))) {
      return client.sendMessage(m.chat, { text: '《✧》 No tienes permiso para usar este comando.\n\n> Solo usuarios autorizados pueden usar fix' }, { quoted: m })
    }

    try {
      await client.sendMessage(m.chat, { react: { text: '🕑', key: m.key } })

      await execPromise('git config user.email "bot@host.com"')
      await execPromise('git config user.name "HostBot"')

      await execPromise('git fetch origin')

      const { stdout: branch } = await execPromise('git rev-parse --abbrev-ref HEAD')
      const currentBranch = branch.trim()

      const { stdout: diffStatus } = await execPromise(`git diff --name-status HEAD..origin/${currentBranch}`).catch(() => ({ stdout: '' }))
      const { stdout: info } = await execPromise(`git log HEAD..origin/${currentBranch} --format="%an" -1`).catch(() => ({ stdout: 'Desconocido' }))

      const lines = diffStatus.trim().split('\n').filter(line => line.trim() !== '')
      const totalFiles = lines.length

      await execPromise(`git reset --hard origin/${currentBranch}`)

      const pluginsDir = path.resolve(__dirname, '..')
      await reloadCommands(pluginsDir)

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

      let responseMsg = `❀ *Actualización exitosa*\n\n`
      responseMsg += `亗 *Editor:* ${info.trim()}\n`
      responseMsg += `✎ *Total Cambios:* ${totalFiles}\n\n`

      if (totalFiles > 0) {
        responseMsg += `ꕥ *Detalles de archivos:*\n\`\`\`${changeList}${totalFiles > 20 ? '\n...entre otros.' : ''}\`\`\`\n\n`
        responseMsg += `> *Los cambios se aplicaron y los comandos fueron recargados.*`
      } else {
        responseMsg += `> *El bot ya se encuentra en su última versión (comandos refrescados).*`
      }

      if (global.db && global.db.write) await global.db.write()

      await client.sendMessage(m.chat, { text: responseMsg }, { quoted: m })
      await client.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

      console.log(chalk.greenBright(`✅ Bot actualizado y comandos recargados.`))

    } catch (error) {
      console.log(chalk.red('[Error al actualizar y recargar]:'), error)
      await client.sendMessage(m.chat, { text: `⚠️ *Error al actualizar:* \n${error.message}` }, { quoted: m })
    }
  }
}
