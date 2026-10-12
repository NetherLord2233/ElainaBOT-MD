import fetch from 'node-fetch'
import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import os from 'os'

const execFileAsync = promisify(execFile)

export default {
  command: ['pinterest', 'pin'],
  category: 'downloads',
  description: 'Buscar y descarga imágenes y videos de Pinterest.',
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    const text = args.join(' ').trim()
    if (!text) return msg.reply('《✧》 Por favor, ingresa un término de búsqueda o un enlace de Pinterest.')
    const evogbUrl = global.APIs?.evogb?.url || 'https://api.evogb.org'
    const evogbKey = global.APIs?.evogb?.key
    const deliriusUrl = global.APIs?.delirius?.url
    try {
      if (/^https?:\/\//i.test(text)) {
        const data = await pinterestDownload(text, evogbUrl, evogbKey, deliriusUrl)
        if (!data?.url) return msg.reply('《✧》 No se pudo obtener el contenido del enlace.')
        const caption = `ㅤ۟∩ ׅ ★ ׅ 🅟𝖨𝖭 🅓ownload ׄᰙ \n\n${data.title? `𖣣ֶㅤ֯⌗ ☆  ⬭ *Título* › ${data.title}\n` : ''}${data.author? `𖣣ֶㅤ֯⌗ ☆  ⬭ *Autor* › ${data.author}\n` : ''}${data.username? `𖣣ֶㅤ֯⌗ ☆  ⬭ *Usuario* › ${data.username}\n` : ''}${data.uploadDate? `𖣣ֶㅤ֯⌗ ☆  ⬭ *Fecha* › ${data.uploadDate}\n` : ''}𖣣ֶㅤ֯⌗ ☆  ⬭ *Enlace* › ${text}`
        const isVideo = data.type === 'video' || /\.(mp4|mov|webm)(\?|$)/i.test(data.url)
        if (isVideo) {
          const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pinterest-'))
          const input = path.join(tempDir, 'input.mp4')
          const output = path.join(tempDir, 'output.mp4')
          try {
            const res = await fetch(data.url)
            if (!res.ok) throw new Error('No se pudo descargar el video')
            fs.writeFileSync(input, Buffer.from(await res.arrayBuffer()))
            try {
              await execFileAsync('ffmpeg', ['-y','-i',input,'-c:v','libx264','-preset','veryfast','-crf','23','-c:a','aac','-movflags','+faststart',output])
              await sock.sendMessage(msg.chat, { video: fs.readFileSync(output), caption, mimetype:'video/mp4', fileName:'pinterest.mp4' }, { quoted: msg })
            } catch {
              await sock.sendMessage(msg.chat, { video: fs.readFileSync(input), caption, mimetype:'video/mp4', fileName:'pinterest.mp4' }, { quoted: msg })
            }
          } finally { try { fs.rmSync(tempDir, { recursive:true, force:true }) } catch {} }
        } else {
          const buf = await getBuffer(data.url)
          await sock.sendMessage(msg.chat, { image: buf? buf : { url: data.url }, caption }, { quoted: msg })
        }
      } else {
        const results = await pinterestSearch(text, evogbUrl, evogbKey)
        if (!results.length) return msg.reply(`《✧》 No se encontraron resultados para *${text}*.`)
        const medias = results.slice(0, 15).map(r => ({
          type: 'image',
          data: { url: r.image },
          caption: `ㅤ۟∩ ׅ ★ ׅ 🅟𝖨𝖭 🅢earch ׄᰙ \n\n${r.title? `𖣣ֶㅤ֯⌗ ☆  ⬭ *Título* › ${r.title}\n` : ''}𖣣ֶㅤ֯⌗ ☆  ⬭ *Búsqueda* › ${text}\n`
        }))
        await sock.sendAlbumMessage(msg.chat, medias, { quoted: msg })
      }
    } catch (e) {
      await msg.reply(`> Ocurrió un error al ejecutar el comando *${usedPrefix + command}*.\n> [Error: *${e.message}*]`)
    }
  }
}

async function pinterestDownload(url, evogbUrl, evogbKey, deliriusUrl) {
  const endpoints = []
  if (evogbUrl) endpoints.push(`${evogbUrl.replace(/\/$/, '')}/dl/pinterest?url=${encodeURIComponent(url)}${evogbKey? `&key=${evogbKey}` : ''}`)
  if (deliriusUrl) endpoints.push(`${deliriusUrl}/download/pinterestdl?url=${encodeURIComponent(url)}`)
  for (const endpoint of endpoints) {
    try {
      const r = await fetch(endpoint)
      if (!r.ok) continue
      const res = await r.json()
      let dlUrl = null
      let rawType = 'image'
      let meta = {}
      if (res?.status && res?.data?.dl) {
        dlUrl = res.data.dl
        rawType = res.data.type
        meta = res.data
      } else if (res?.status && res?.data?.download?.url) {
        dlUrl = res.data.download.url
        rawType = res.data.download.type
        meta = res.data
      }
      if (dlUrl) {
        const isVideoByUrl = /\.(mp4|mov|webm|m3u8)(\?|$)/i.test(dlUrl) || dlUrl.includes('pinimg.com/videos') || dlUrl.includes('v.pinimg')
        const isVideoByType = String(rawType).toLowerCase().includes('video')
        const finalType = (isVideoByUrl || isVideoByType) ? 'video' : 'image'
        return { type: finalType, url: dlUrl, title: meta.title, author: meta.author || meta.author_name, username: meta.username, uploadDate: meta.uploadDate || meta.upload }
      }
    } catch {}
  }
  return null
}

async function pinterestSearch(query, evogbUrl, evogbKey) {
  const cleanUrl = evogbUrl.replace(/\/$/, '')
  const tries = [
    `${cleanUrl}/search/pinterest?key=${evogbKey}&q=${encodeURIComponent(query)}`,
    `${cleanUrl}/search/pinterest?key=${evogbKey}&query=${encodeURIComponent(query)}`,
    `${cleanUrl}/search/pinterest?key=${evogbKey}&text=${encodeURIComponent(query)}`,
    `${cleanUrl}/search/pinterestv3?key=${evogbKey}&q=${encodeURIComponent(query)}`,
    `${cleanUrl}/search/pinterestv3?key=${evogbKey}&query=${encodeURIComponent(query)}`
  ]
  for (const endpoint of tries) {
    try {
      const r = await fetch(endpoint)
      if (!r.ok) continue
      const res = await r.json()
      if (res?.status && Array.isArray(res.data) && res.data.length) {
        const out = res.data.map(p => ({
          image: p.hd || p.mini || p.image,
          title: p.title !== '-' ? p.title : query
        })).filter(x => x.image)
        if (out.length) return out
      }
      if (res?.status && res?.data?.images?.length) {
        const out = res.data.images.map(p => ({
          image: p.images?.orig || p.images?.['736x'] || p.images?.['474x'],
          title: p.title || query
        })).filter(x => x.image)
        if (out.length) return out
      }
    } catch {}
  }
  return []
}

async function getBuffer(url) {
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0', 'referer': 'https://www.pinterest.com/' } })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch { return null }
}