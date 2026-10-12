import fs from 'fs' 
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { exec } from 'child_process'
import { promisify } from 'util'

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
  command: ['update'],
  isOwner: true,
  description: 'Hace lo mismo que fix pero de forma burda.',
  run: async ({ sock, msg }) => {
    try {
      await sock.sendMessage(msg.chat, { text: 'ꕥ *Actualizando repositorio y recargando comandos...*' }, { quoted: msg })

      const { stdout } = await execPromise('git pull')
      const pluginsDir = path.resolve(__dirname, '..')

      await reloadCommands(pluginsDir)

      const isUpToDate = stdout.includes('Already up to date.') || stdout.includes('Ya está actualizado.')
      const responseText = isUpToDate
        ? 'ꕥ *Estado:* El bot ya se encuentra en la versión más reciente.'
        : `ꕥ *Actualización completada con éxito*\n\n\`\`\`\n${stdout.trim()}\n\`\`\``

      await sock.sendMessage(msg.chat, { text: responseText }, { quoted: msg })
    } catch (error) {
      console.error('Error durante la ejecución de update:', error)
      await sock.sendMessage(
        msg.chat,
        { text: `《✧》 Ocurrió un error al ejecutar git pull:\n\n\`\`\`${error.message || error}\`\`\`` },
        { quoted: msg }
      )
    }
  }
}
