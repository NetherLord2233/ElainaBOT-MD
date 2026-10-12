import fetch from 'node-fetch'
import yts from 'yt-search'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import { getBuffer } from '#serialize'

const execAsync = promisify(exec)
const tmpDir = './tmp'
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
const TIMEOUT_MS = 10 * 60 * 1000
const MAX_DURATION_MIN = 35
const MAX_DURATION_SEC = MAX_DURATION_MIN * 60

async function getSpotifyLink(text) {
  try {
    const url = `${global.APIs?.evogb?.url}/search/spotify?query=${encodeURIComponent(text)}&key=${global.APIs?.evogb?.key}`
    const res = await fetch(url).then(r => r.json())
    if (res?.status && res.result?.[0]) return res.result[0]
  } catch {}
  return null
}

function extractYtId(url) {
  const reg = /(?:youtube\.com\/(?:.*v=|v\/|embed\/|shorts\/)|youtu\.be\/|music\.youtube\.com\/.*v=)([^&?\/\s]{11})/
  const match = url.match(reg)
  return match? match[1] : null
}

async function getYtLink(text) {
  try {
    const id = extractYtId(text)
    if (id) {
      try {
        const r = await yts({ videoId: id })
        if (r && r.title) return r
      } catch {}
      const r2 = await yts(id)
      return r2?.videos?.[0] || r2 || null
    }
    const r = await yts(text)
    return r?.videos?.[0] || null
  } catch {
    return null
  }
}

async function getYTMP3(ytUrl) {
  try {
    const url = `${global.APIs?.evogb?.url}/dl/ytmp3?url=${encodeURIComponent(ytUrl)}&key=${global.APIs?.evogb?.key}`
    const res = await fetch(url).then(r => r.json())
    if (res?.status && res.data?.dl) return res.data
  } catch {}
  return null
}

async function getYTMP4(ytUrl, quality = '360p') {
  try {
    const url = `${global.APIs?.evogb?.url}/dl/ytmp4?url=${encodeURIComponent(ytUrl)}&quality=${quality}&key=${global.APIs?.evogb?.key}`
    const res = await fetch(url).then(r => r.json())
    if (res?.status && res.data?.dl) return res.data
  } catch {}
  return null
}

async function getSpotifyDL(spUrl) {
  try {
    const url = `${global.APIs?.evogb?.url}/dl/spotify?url=${encodeURIComponent(spUrl)}&key=${global.APIs?.evogb?.key}`
    const res = await fetch(url).then(r => r.json())
    const d = res?.data || res?.result
    return d?.url || d?.dl || null
  } catch {}
  return null
}

async function downloadFile(url, dest) {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`Download ${res.status}`)
  const fileStream = fs.createWriteStream(dest)
  if (typeof res.body.pipe === 'function') await pipeline(res.body, fileStream)
  else await pipeline(Readable.fromWeb(res.body), fileStream)
}

const isYtUrl = (t) => /(youtube\.com|youtu\.be|music\.youtube\.com)/i.test(t)
const isSpotifyUrl = (t) => /open\.spotify\.com/i.test(t)

function parseDurationToSec(d) {
  if (!d) return 0
  if (typeof d === 'number') return d
  if (!isNaN(d)) return Number(d)
  const parts = String(d).split(':').map(Number)
  if (parts.length === 3) return parts[0]*3600 + parts[1]*60 + parts[2]
  if (parts.length === 2) return parts[0]*60 + parts[1]
  return 0
}

function formatViews(n) { if (!n) return 'Desconocido'; return Number(n).toLocaleString('es-ES') }
function formatBytes(b = 0) { if (!b) return 'Desconocido'; const u = ['B','KB','MB','GB']; let i = 0; let s = Number(b); while (s >= 1024 && i < u.length - 1) { s /= 1024; i++ } return `${s.toFixed(i === 0? 0 : 2)} ${u[i]}` }

export default {
  command: ['play','mp3','playaudio','ytaudio', 'ytmp3'],
  category: 'downloader',
  description: 'descarga audios o videos en spotify y yt', 
  run: async ({ sock, msg, text, usedPrefix, command }) => {
    try {
      const isChannel = msg.chat.endsWith('@newsletter')
      const options = isChannel? undefined : { quoted: msg }
      const chatId = msg.chat
      const q = text?.trim()
      if (!q) return sock.sendMessage(chatId, { text: '《✧》 Por favor, menciona el nombre o URL que deseas descargar.' }, options)
      await sock.sendMessage(chatId, { react: { text: '🕒', key: msg.key } })
      const timeoutMessage = `《✧》 *Tiempo de descarga agotado*\n\n> No seleccionaste ninguna opción a tiempo.\n> Vuelve a usar *${usedPrefix}${command}* y elige un servicio de descarga.\n\n> ⏰ *Límite: 10 minutos*`

      if (isYtUrl(q)) {
        const ytId = extractYtId(q) || q
        const videoInfo = await getYtLink(ytId)
        if (!videoInfo) return sock.sendMessage(chatId, { text: '《✧》 No se pudo obtener info.' }, options)
        const durationSec = videoInfo?.seconds || parseDurationToSec(videoInfo?.duration)
        if (durationSec > MAX_DURATION_SEC) return sock.sendMessage(chatId, { text: `《✧》 *Video muy largo*\n\n> El video dura *${videoInfo?.timestamp || Math.floor(durationSec/60)+' min'}* y el límite es *${MAX_DURATION_MIN} min*.` }, options)
        const finalUrl = videoInfo?.url || `https://www.youtube.com/watch?v=${ytId}`
        const isMusic = /music\.youtube\.com/i.test(q)

        if (isMusic) {
          await sock.sendMessage(chatId, { text: `➩ Descargando › ${videoInfo.title}\n\n> ❖ Canal › *${videoInfo.author?.name || 'Desconocido'}*\n> ⴵ Duración › *${videoInfo.timestamp || 'Desconocido'}*` }, options)
          const data = await getYTMP3(finalUrl)
          if (!data?.dl) return sock.sendMessage(chatId, { text: '《✧》 No se pudo obtener MP3.' }, options)
          await sock.sendMessage(chatId, { audio: { url: data.dl }, mimetype: 'audio/mpeg', fileName: `${data.title}.mp3` }, options)
          return sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } })
        }

        const canal = videoInfo.author?.name || 'Desconocido'
        const vistas = formatViews(videoInfo.views)
        const infoMessage = `➩ Descargando › ${videoInfo.title}\n\n> ❖ Canal › *${canal}*\n> ⴵ Duración › *${videoInfo.timestamp || 'Desconocido'}*\n> ❀ Vistas › *${vistas}*\n> ❒ Enlace › *${finalUrl}*\n\n> Si los botones no funcionan, responde a este mensaje con *mp3* o *mp4*`
        const buttons = [
          { buttonId: `ytaudio|${finalUrl}`, buttonText: { displayText: '🎧 MP3' }, type: 1 },
          { buttonId: `ytvideo|${finalUrl}`, buttonText: { displayText: '🎥 MP4' }, type: 1 }
        ]
        let sent
        try { const buf = await getBuffer(videoInfo.thumbnail); sent = await sock.sendMessage(chatId, { image: buf, caption: infoMessage, buttons, footer: `2 intentos / 10 min` }, options) }
        catch { sent = await sock.sendMessage(chatId, { text: infoMessage, buttons, footer: `2 intentos / 10 min` }, options) }
        let uses = 0
        const maxUses = 2
        const sentId = sent.key.id
        const usedTypes = new Set()
        const processingTypes = new Set()
        const processedIds = new Set()
        const collector = async (upsert) => {
          const m = upsert.messages?.[0]
          if (!m || m.key.remoteJid!== chatId) return
          if (processedIds.has(m.key.id)) return
          const btnId = m.message?.buttonsResponseMessage?.selectedButtonId || m.message?.templateButtonReplyMessage?.selectedId || ''
          const raw = (m.message?.conversation || m.message?.extendedTextMessage?.text || '').toLowerCase().trim()
          let type
          if (btnId) type = btnId.split('|')[0]
          else { const ctx = m.message?.extendedTextMessage?.contextInfo; if (ctx?.stanzaId!== sentId) return; if (['mp3','audio','ytaudio'].includes(raw)) type = 'ytaudio'; else if (['mp4','video','ytvideo'].includes(raw)) type = 'ytvideo'; else return }
          if (usedTypes.has(type) || processingTypes.has(type)) return
          if (uses >= maxUses) return
          processedIds.add(m.key.id)
          processingTypes.add(type)
          try {
            uses++
            if (uses >= maxUses) { clearTimeout(timer); sock.ev.off('messages.upsert', collector) }
            await sock.sendMessage(chatId, { react: { text: '🕒', key: m.key } })
            if (type === 'ytvideo') {
              const data = await getYTMP4(finalUrl, '360p')
              if (!data?.dl) { processingTypes.delete(type); return sock.sendMessage(chatId, { text: '《✧》 No se pudo obtener MP4.' }, { quoted: m }) }
              let input = path.join(tmpDir, `in_${Date.now()}.mp4`)
              let output = path.join(tmpDir, `out_${Date.now()}.mp4`)
              try {
                await downloadFile(data.dl, input)
                try { await execAsync(`ffmpeg -y -i "${input}" -c:v libx264 -preset veryfast -crf 28 -c:a aac -b:a 96k -movflags +faststart "${output}"`) } catch { fs.copyFileSync(input, output) }
                const finalSize = fs.existsSync(output)? fs.statSync(output).size : 0
                const caption = `乂 *Video descargado*\n\n> ❒ Calidad › *${data.quality || data.quality_context || '360p'}*\n> ❒ Tamaño › *${formatBytes(finalSize)}*`
                await sock.sendMessage(chatId, { video: { url: output }, mimetype: 'video/mp4', fileName: `${data.title}.mp4`, caption }, { quoted: m })
                usedTypes.add(type)
              } catch (e) { await sock.sendMessage(chatId, { text: `> Error MP4: ${e.message}` }, { quoted: m }) }
              finally { try { if (fs.existsSync(input)) fs.unlinkSync(input) } catch {}; try { if (fs.existsSync(output)) fs.unlinkSync(output) } catch {}; processingTypes.delete(type) }
            } else {
              const data = await getYTMP3(finalUrl)
              if (!data?.dl) { processingTypes.delete(type); return sock.sendMessage(chatId, { text: '《✧》 No se pudo obtener MP3.' }, { quoted: m }) }
              await sock.sendMessage(chatId, { audio: { url: data.dl }, mimetype: 'audio/mpeg', fileName: `${data.title}.mp3` }, { quoted: m })
              usedTypes.add(type)
              processingTypes.delete(type)
            }
            await sock.sendMessage(chatId, { react: { text: '✅', key: m.key } })
          } catch { processingTypes.delete(type) }
        }
        sock.ev.on('messages.upsert', collector)
        const timer = setTimeout(async () => { try { sock.ev.off('messages.upsert', collector) } catch {}; if (uses === 0) await sock.sendMessage(chatId, { text: timeoutMessage }, options) }, TIMEOUT_MS)
        return sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } })
      }

      if (isSpotifyUrl(q)) {
        const dl = await getSpotifyDL(q)
        if (!dl) return sock.sendMessage(chatId, { text: '《✧》 No se pudo obtener Spotify.' }, options)
        await sock.sendMessage(chatId, { audio: { url: dl }, mimetype: 'audio/mpeg' }, options)
        return sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } })
      }

      const [videoInfo, spInfo] = await Promise.all([getYtLink(q), getSpotifyLink(q)])
      if (!videoInfo &&!spInfo) return sock.sendMessage(chatId, { text: '《✧》 Sin resultados.' }, options)
      const durationSec = videoInfo?.seconds || parseDurationToSec(videoInfo?.duration)
      if (durationSec > MAX_DURATION_SEC) return sock.sendMessage(chatId, { text: `《✧》 *Video muy largo*\n\n> *${videoInfo?.title}* dura *${videoInfo?.timestamp || Math.floor(durationSec/60)+' min'}*.\n> Límite: *${MAX_DURATION_MIN} min*.` }, options)
      const canal = videoInfo?.author?.name || spInfo?.artist || 'Desconocido'
      const vistas = formatViews(videoInfo?.views)
      const ytLink = videoInfo?.url || 'No encontrado'
      const spLink = spInfo?.link || 'No encontrado'
      const infoMessage = `➩ Descargando › ${videoInfo?.title || spInfo?.title || q}\n\n> ❖ Canal › *${canal}*\n> ⴵ Duración › *${videoInfo?.timestamp || 'Desconocido'}*\n> ❀ Vistas › *${vistas}*\n> ❒ YouTube › *${ytLink}*\n> ❒ Spotify › *${spLink}*\n\n> Si los botones no funcionan, responde a este mensaje con *mp3*, *mp4* o *spotify*`
      const buttons = [
        { buttonId: `ytaudio|${videoInfo?.url}|${spInfo?.link}`, buttonText: { displayText: '🎧 MP3' }, type: 1 },
        { buttonId: `ytvideo|${videoInfo?.url}|${spInfo?.link}`, buttonText: { displayText: '🎥 MP4' }, type: 1 },
        { buttonId: `spotify|${videoInfo?.url}|${spInfo?.link}`, buttonText: { displayText: '🎵 Spotify' }, type: 1 }
      ]
      let sent
      const thumb = videoInfo?.thumbnail || spInfo?.image || null
      if (thumb) { try { const buf = await getBuffer(thumb); sent = await sock.sendMessage(chatId, { image: buf, caption: infoMessage, buttons, footer: `3 intentos / 10 min` }, options) } catch { sent = await sock.sendMessage(chatId, { text: infoMessage, buttons, footer: `3 intentos / 10 min` }, options) } }
      else sent = await sock.sendMessage(chatId, { text: infoMessage, buttons, footer: `3 intentos / 10 min` }, options)
      let uses = 0
      const maxUses = 3
      const sentId = sent.key.id
      const usedTypes = new Set()
      const processingTypes = new Set()
      const processedIds = new Set()
      const collector = async (upsert) => {
        const m = upsert.messages?.[0]
        if (!m || m.key.remoteJid!== chatId) return
        if (processedIds.has(m.key.id)) return
        const btnId = m.message?.buttonsResponseMessage?.selectedButtonId || m.message?.templateButtonReplyMessage?.selectedId || ''
        const raw = (m.message?.conversation || m.message?.extendedTextMessage?.text || '').toLowerCase().trim()
        let type, yUrl, sUrl
        if (btnId) { const p = btnId.split('|'); type = p[0]; yUrl = p[1]; sUrl = p[2] }
        else { const ctx = m.message?.extendedTextMessage?.contextInfo; if (ctx?.stanzaId!== sentId) return; if (['mp3','ytaudio','audio'].includes(raw)) type = 'ytaudio'; else if (['mp4','ytvideo','video'].includes(raw)) type = 'ytvideo'; else if (['spotify','spot'].includes(raw)) type = 'spotify'; else return; yUrl = videoInfo?.url; sUrl = spInfo?.link }
        if (usedTypes.has(type) || processingTypes.has(type)) return
        if (uses >= maxUses) return
        processedIds.add(m.key.id)
        processingTypes.add(type)
        try {
          uses++
          if (uses >= maxUses) { clearTimeout(timer); sock.ev.off('messages.upsert', collector) }
          await sock.sendMessage(chatId, { react: { text: '🕒', key: m.key } })
          if (type === 'ytvideo') {
            const data = await getYTMP4(yUrl, '360p')
            if (!data?.dl) { processingTypes.delete(type); return sock.sendMessage(chatId, { text: '《✧》 Error MP4.' }, { quoted: m }) }
            let input = path.join(tmpDir, `in_${Date.now()}.mp4`)
            let output = path.join(tmpDir, `out_${Date.now()}.mp4`)
            try {
              await downloadFile(data.dl, input)
              try { await execAsync(`ffmpeg -y -i "${input}" -c:v libx264 -preset veryfast -crf 28 -c:a aac -b:a 96k -movflags +faststart "${output}"`) } catch { fs.copyFileSync(input, output) }
              const finalSize = fs.existsSync(output)? fs.statSync(output).size : 0
              const caption = `乂 *Video descargado*\n\n> ❒ Calidad › *${data.quality || data.quality_context || '360p'}*\n> ❒ Tamaño › *${formatBytes(finalSize)}*`
              await sock.sendMessage(chatId, { video: { url: output }, mimetype: 'video/mp4', fileName: `${data.title}.mp4`, caption }, { quoted: m })
              usedTypes.add(type)
            } catch (e) { await sock.sendMessage(chatId, { text: `> Error MP4: ${e.message}` }, { quoted: m }) }
            finally { try { if (fs.existsSync(input)) fs.unlinkSync(input) } catch {}; try { if (fs.existsSync(output)) fs.unlinkSync(output) } catch {}; processingTypes.delete(type) }
          } else if (type === 'ytaudio') {
            const data = await getYTMP3(yUrl)
            if (!data?.dl) { processingTypes.delete(type); return sock.sendMessage(chatId, { text: '《✧》 Error MP3.' }, { quoted: m }) }
            await sock.sendMessage(chatId, { audio: { url: data.dl }, mimetype: 'audio/mpeg', fileName: `${data.title}.mp3` }, { quoted: m })
            usedTypes.add(type)
            processingTypes.delete(type)
          } else {
            const dl = await getSpotifyDL(sUrl)
            if (!dl) { processingTypes.delete(type); return sock.sendMessage(chatId, { text: '《✧》 Error Spotify.' }, { quoted: m }) }
            await sock.sendMessage(chatId, { audio: { url: dl }, mimetype: 'audio/mpeg' }, { quoted: m })
            usedTypes.add(type)
            processingTypes.delete(type)
          }
          await sock.sendMessage(chatId, { react: { text: '✅', key: m.key } })
        } catch { processingTypes.delete(type) }
      }
      sock.ev.on('messages.upsert', collector)
      const timer = setTimeout(async () => { try { sock.ev.off('messages.upsert', collector) } catch {}; if (uses === 0) await sock.sendMessage(chatId, { text: timeoutMessage }, options) }, TIMEOUT_MS)
      await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } })
    } catch (e) { await sock.sendMessage(msg.chat, { text: `> Error: ${e.message}` }, { quoted: msg }) }
  }
}