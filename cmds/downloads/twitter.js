import fetch from 'node-fetch'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export default {
  command: ['twitter', 'x'],
  category: 'downloads',
  description: 'Descargar un video/imagen de Twitter/X.',
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    if (!args[0]) {
      return msg.reply('《✧》 Por favor, ingrese un enlace de Twitter/X.')
    }
    if (!args[0].match(/(twitter|x)\.com\/\w+\/status\//)) {
      return msg.reply('《✧》 El enlace no parece válido. Asegúrate de que sea de Twitter/X.')
    }
    try {
      const data = await getTwitterMedia(args[0])
      if (!data) return msg.reply('《✧》 No se pudo obtener el contenido.')
      const caption = `ㅤ۟∩　ׅ　★ ໌　ׅ　🅣witter 🅓ownload　ׄᰙ\n\n${data.title? `𖣣ֶㅤ֯⌗ ❀ ⬭ *Título* › ${data.title}\n` : ''}${data.author? `𖣣ֶㅤ֯⌗ ❀ ⬭ *Autor* › ${data.author}\n` : ''}${data.date? `𖣣ֶㅤ֯⌗ ❀ ⬭ *Fecha* › ${data.date}\n` : ''}${data.duration? `𖣣ֶㅤ֯⌗ ❀ ⬭ *Duración* › ${data.duration}\n` : ''}${data.resolution? `𖣣ֶㅤ֯⌗ ❀ ⬭ *Resolución* › ${data.resolution}\n` : ''}${data.views? `𖣣ֶㅤ֯⌗ ❀ ⬭ *Vistas* › ${data.views}\n` : ''}${data.likes? `𖣣ֶㅤ֯⌗ ❀ ⬭ *Likes* › ${data.likes}\n` : ''}${data.comments? `𖣣ֶㅤ֯⌗ ❀ ⬭ *Comentarios* › ${data.comments}\n` : ''}${data.retweets? `𖣣ֶㅤ֯⌗ ❀ ⬭ *Retweets* › ${data.retweets}\n` : ''}𖣣ֶㅤ֯⌗ ❀ ⬭ *Enlace* › ${args[0]}`
      if (data.type === 'video') {
        const tmpDir = os.tmpdir()
        const inputPath = path.join(tmpDir, `twitter_${Date.now()}_in.mp4`)
        const outputPath = path.join(tmpDir, `twitter_${Date.now()}_out.mp4`)
        try {
          const res = await fetch(data.url)
          const buffer = Buffer.from(await res.arrayBuffer())
          fs.writeFileSync(inputPath, buffer)
          await execAsync(`ffmpeg -y -i "${inputPath}" -c:v libx264 -preset fast -crf 28 -c:a aac -b:a 128k -movflags +faststart "${outputPath}"`)
          await sock.sendMessage(msg.chat, { video: fs.readFileSync(outputPath), caption, mimetype: 'video/mp4', fileName: 'twitter.mp4' }, { quoted: msg })
        } finally {
          if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath)
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath)
        }
      } else if (data.type === 'image') {
        await sock.sendMessage(msg.chat, { image: { url: data.url }, caption }, { quoted: msg })
      } else {
        throw new Error('Contenido no soportado.')
      }
    } catch (e) {
      await msg.reply(`> An unexpected error occurred while executing command *${usedPrefix + command}*. Please try again or contact support if the issue persists.\n> [Error: *${e.message}*]`)
    }
  }
}

async function getTwitterMedia(url) {
  const apiConfig = global.APIs?.evogb || global.APIs?.evoGB
  if (!apiConfig?.url ||!apiConfig?.key) {
    throw new Error('Falta configuración de evoGB en settings.js (global.APIs.evogb)')
  }
  const endpoint = `${apiConfig.url}/dl/twitter?url=${encodeURIComponent(url)}&key=${apiConfig.key}`
  const res = await fetch(endpoint).then(r => r.json())
  if (!res.status ||!res.data?.result?.length) return null
  const best = res.data.result.find(x => x.quality?.includes('1080') || x.quality?.includes('720')) || res.data.result[0]
  return {
    type: res.data.type || 'video',
    title: res.data.title || null,
    author: null,
    date: null,
    duration: res.data.duration!== '-'? res.data.duration : null,
    resolution: best.quality || null,
    views: null,
    likes: null,
    comments: null,
    retweets: null,
    url: best.url
  }
}