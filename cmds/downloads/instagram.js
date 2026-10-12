import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export default {
  command: ['ig','instagram'],
  category: 'downloads',
  description: 'descarga fotos y videos de instagram.',
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    if (!args[0]) return msg.reply('《✧》 Por favor, ingrese un enlace de Instagram.')
    if (!args[0].match(/instagram\.com\/(p|reel|share|tv|stories)\//)) return msg.reply('《✧》 El enlace no parece *válido*.')
    try {
      const data = await getInstagramMedia(args[0])
      if (!data ||!data.medias?.length) return msg.reply('《✧》 No se pudo obtener el contenido.')
      const meta = data.meta
      const isAllPhotos = data.medias.every(m => m.type!== 'video')
      if (data.medias.length > 1) {
        const captionAlbum = `ㅤ۟∩　ׅ　★ ໌　ׅ　🅘𝖦 🅓ownload　ׄᰙ\n\n${meta.title? `𖣣ֶㅤ֯⌗ ❀ ⬭ *Usuario* › ${meta.title}\n` : ''}${meta.caption? `𖣣ֶㅤ֯⌗ ❀ ⬭ *Descripción* › ${meta.caption.slice(0, 400)}\n` : ''}${meta.like? `𖣣ֶㅤ֯⌗ ❀ ⬭ *Likes* › ${meta.like}\n` : ''}${meta.views? `𖣣ֶㅤ֯⌗ ❀ ⬭ *Vistas* › ${meta.views}\n` : ''}𖣣ֶㅤ֯⌗ ❀ ⬭ *Archivos* › ${data.medias.length}\n𖣣ֶㅤ֯⌗ ❀ ⬭ *Enlace* › ${args[0]}`.trim()
        const albumMedias = data.medias.map((m, i) => ({
          type: m.type === 'video'? 'video' : 'image',
          data: { url: m.url },
          caption: i === 0? captionAlbum : ''
        }))
        await sock.sendAlbumMessage(msg.chat, albumMedias, { quoted: msg })
        if (isAllPhotos && data.audioUrl) {
          await sock.sendMessage(msg.chat, { audio: { url: data.audioUrl }, mimetype: 'audio/mpeg', fileName: 'ig_audio.mp3' }, { quoted: msg }).catch(async () => {
            const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ig-'))
            try {
              const input = path.join(tmp, 'in.mp3')
              const r = await fetch(data.audioUrl)
              fs.writeFileSync(input, Buffer.from(await r.arrayBuffer()))
              await sock.sendMessage(msg.chat, { audio: fs.readFileSync(input), mimetype: 'audio/mpeg' }, { quoted: msg })
            } catch {} finally { try { fs.rmSync(tmp, { recursive: true, force: true }) } catch {} }
          })
        }
        return
      }
      const caption = `ㅤ۟∩　ׅ　★ ໌　ׅ　🅘𝖦 🅓ownload　ׄᰙ\n\n${meta.title? `𖣣ֶㅤ֯⌗ ❀ ⬭ *Usuario* › ${meta.title}\n` : ''}${meta.caption? `𖣣ֶㅤ֯⌗ ❀ ⬭ *Descripción* › ${meta.caption}\n` : ''}${meta.like? `𖣣ֶㅤ֯⌗ ❀ ⬭ *Likes* › ${meta.like}\n` : ''}${meta.views? `𖣣ֶㅤ֯⌗ ❀ ⬭ *Vistas* › ${meta.views}\n` : ''}${meta.duration? `𖣣ֶㅤ֯⌗ ❀ ⬭ *Duración* › ${meta.duration}\n` : ''}${meta.format? `𖣣ֶㅤ֯⌗ ❀ ⬭ *Formato* › ${meta.format}\n` : ''}𖣣ֶㅤ֯⌗ ❀ ⬭ *Enlace* › ${args[0]}`
      const m = data.medias[0]
      if (m.type === 'video') {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ig-'))
        const input = path.join(tempDir, 'input.mp4')
        const output = path.join(tempDir, 'output.mp4')
        try {
          const res = await fetch(m.url)
          fs.writeFileSync(input, Buffer.from(await res.arrayBuffer()))
          try {
            await execFileAsync('ffmpeg', ['-y','-i',input,'-c:v','libx264','-preset','veryfast','-crf','23','-c:a','aac','-movflags','+faststart',output])
            await sock.sendMessage(msg.chat, { video: fs.readFileSync(output), caption, mimetype: 'video/mp4', fileName: 'ig.mp4' }, { quoted: msg })
          } catch {
            await sock.sendMessage(msg.chat, { video: fs.readFileSync(input), caption, mimetype: 'video/mp4', fileName: 'ig.mp4' }, { quoted: msg })
          }
        } finally { try { fs.rmSync(tempDir, { recursive: true, force: true }) } catch {} }
      } else {
        await sock.sendMessage(msg.chat, { image: { url: m.url }, caption }, { quoted: msg })
        if (data.audioUrl) {
          await sock.sendMessage(msg.chat, { audio: { url: data.audioUrl }, mimetype: 'audio/mpeg' }, { quoted: msg })
        }
      }
    } catch (e) {
      await msg.reply(`> Error en *${usedPrefix + command}*: ${e.message}`)
    }
  }
}

function parseEvogbUrl(item) {
  if (!item) return null
  if (typeof item.url === 'string') return item.url
  if (Array.isArray(item.url) && item.url[0]?.url) return item.url[0].url
  if (Array.isArray(item.url) && typeof item.url[0] === 'string') return item.url[0]
  return null
}

async function getInstagramMedia(url) {
  const evogbUrl = global.APIs?.evogb?.url || 'https://api.evogb.org'
  const evogbKey = global.APIs?.evogb?.key
  const apis = [
    {
      endpoint: `${evogbUrl.replace(/\/$/, '')}/dl/instagram?key=${evogbKey}&url=${encodeURIComponent(url)}`,
      extractor: (res) => {
        if (!res.status ||!res.data?.length) return null
        const medias = res.data.map(v => {
          const finalUrl = parseEvogbUrl(v)
          if (!finalUrl) return null
          const type = v.type === 'video'? 'video' : 'image'
          return { type, url: finalUrl }
        }).filter(Boolean)
        if (!medias.length) return null
        return {
          meta: { title: null, caption: null, like: null, views: null, duration: null, format: medias[0].type === 'video'? 'mp4' : 'jpg' },
          medias,
          audioUrl: null
        }
      }
    },
    {
      endpoint: `${global.APIs?.yuki?.url || ''}/dl/instagram?url=${encodeURIComponent(url)}&key=${global.APIs?.yuki?.key || ''}`,
      extractor: (res) => {
        if (!res.status ||!res.data?.length) return null
        const medias = res.data.map(v => ({ type: v.url?.includes('.mp4')? 'video' : 'image', url: v.url })).filter(v => v.url)
        return { meta: { format: 'mp4' }, medias, audioUrl: res.data[0]?.music || res.audio || null }
      }
    },
    {
      endpoint: `${global.APIs?.delirius?.url || ''}/download/instagram?url=${encodeURIComponent(url)}`,
      extractor: (res) => {
        if (!res.status ||!res.data?.length) return null
        const medias = res.data.map(v => ({ type: v.type || (v.url?.includes('.mp4')? 'video' : 'image'), url: v.url })).filter(v => v.url)
        return { meta: { format: medias[0]?.type === 'video'? 'mp4' : 'jpg' }, medias, audioUrl: null }
      }
    }
  ]
  for (const { endpoint, extractor } of apis) {
    try {
      if (!endpoint.includes('http')) continue
      const r = await fetch(endpoint)
      if (!r.ok) continue
      const res = await r.json()
      const result = extractor(res)
      if (result?.medias?.length) return result
    } catch { continue }
    await new Promise(r => setTimeout(r, 400))
  }
  return null
}