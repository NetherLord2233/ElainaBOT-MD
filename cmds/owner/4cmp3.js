import fetch from 'node-fetch'
import yts from 'yt-search'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import path from 'path'

const CHANNEL_JID = '120363410785614699@newsletter'

try {
  const ffmpegInstaller = await import('@ffmpeg-installer/ffmpeg')
  const installedPath = ffmpegInstaller?.default?.path || ffmpegInstaller?.path
  if (installedPath) ffmpeg.setFfmpegPath(installedPath)
} catch {
  ffmpeg.setFfmpegPath('ffmpeg')
}

function generateWaveform() {
  const waveform = new Uint8Array(64)
  for (let i = 0; i < 64; i++) waveform[i] = Math.floor(Math.random() * 60) + 15
  return waveform
}

async function toPTT(buffer) {
  const tmpIn = path.join('./tmp', `${Date.now()}_in.media`)
  const tmpOut = path.join('./tmp', `${Date.now()}_out.opus`)
  await fs.promises.mkdir('./tmp', { recursive: true }).catch(() => {})
  await fs.promises.writeFile(tmpIn, buffer)
  return new Promise((resolve, reject) => {
    ffmpeg(tmpIn).noVideo().audioCodec('libopus').audioChannels(1).audioFrequency(48000)
    .outputOptions(['-b:a 64k','-avoid_negative_ts make_zero','-map_metadata -1']).format('ogg')
    .on('end', async () => {
        try {
          const outBuffer = await fs.promises.readFile(tmpOut)
          await fs.promises.unlink(tmpIn).catch(() => {})
          await fs.promises.unlink(tmpOut).catch(() => {})
          resolve(outBuffer)
        } catch(e){ reject(e) }
      })
    .on('error', async (err) => {
        await fs.promises.unlink(tmpIn).catch(() => {})
        await fs.promises.unlink(tmpOut).catch(() => {})
        reject(err)
      }).save(tmpOut)
  })
}

async function getVideoInfo(query, videoMatch, text) {
  if (videoMatch && videoMatch[1]) {
    const vidId = videoMatch[1]
    return { videoId: vidId, url: `https://www.youtube.com/watch?v=${vidId}`, title: 'Audio de YouTube' }
  }
  try {
    const evoUrl = global.APIs?.evogb?.url || 'https://api.evogb.org'
    const evoKey = global.APIs?.evogb?.key || 'Mai301520-art'
    const endpoint = `${evoUrl}/search/yt?query=${encodeURIComponent(text)}&key=${encodeURIComponent(evoKey)}`
    const res = await fetch(endpoint).then(r => r.json())
    if (res?.status && Array.isArray(res.result) && res.result.length) {
      const v = res.result[0]
      return { videoId: v.url?.match(/([a-zA-Z0-9_-]{11})/)?.[1] || '', url: v.url, title: v.title || 'Audio de YouTube' }
    }
  } catch {}
  try {
    const res = await yts(query)
    const video = res?.videos?.[0]
    if (video) return { videoId: video.videoId, url: video.url, title: video.title }
  } catch {}
  return null
}

export default {
  command: ['4cmp3'],
  isInv: true,
  description: 'Envía cualquier audio al canal.',
  category: 'downloader',
  run: async ({ sock, msg, args, usedPrefix, command }) => {
    try {
      const isChannel = msg.chat.endsWith('@newsletter')
      const options = isChannel? undefined : { quoted: msg }
      const q = msg.quoted? msg.quoted : msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
      const mime = (q?.msg || q)?.mimetype || q?.mimetype || ''
      const isQuotedAudio = q && (/audio/.test(mime) || q.mtype === 'audioMessage' || q.audioMessage)
      let rawBuffer

      if (isQuotedAudio) {
        await sock.sendMessage(msg.chat, { react: { text: '📢', key: msg.key } })
        rawBuffer = typeof q.download === 'function'? await q.download() : await sock.downloadMediaMessage(q)
      } else {
        if (!args ||!args[0]) return sock.sendMessage(msg.chat, { text: '《✧》 Por favor, menciona el nombre o URL del video que deseas descargar' }, options)
        const text = args.join(' ')
        const videoMatch = text.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/))([a-zA-Z0-9_-]{11})/)
        const query = videoMatch? 'https://youtu.be/' + videoMatch[1] : text
        let videoInfo = null
        try { videoInfo = await getVideoInfo(query, videoMatch, text) } catch {}
        if (!videoInfo ||!videoInfo.url) return sock.sendMessage(msg.chat, { text: '《✧》 No se pudo encontrar ningún resultado.' }, options)
        await sock.sendMessage(msg.chat, { react: { text: '📢', key: msg.key } })
        const downloadUrl = await getAudioMedia(videoInfo.url)
        if (!downloadUrl) return sock.sendMessage(msg.chat, { text: '《✧》 No se pudo obtener el enlace de descarga, intenta más tarde.' }, options)
        const response = await fetch(downloadUrl, { headers: { 'User-Agent': 'Mozilla/5.0 Chrome/124.0.0.0' } })
        const arrayBuffer = await response.arrayBuffer()
        rawBuffer = Buffer.from(arrayBuffer)
        if (rawBuffer.length < 50000) return sock.sendMessage(msg.chat, { text: '《✧》 El servidor entregó un archivo vacío.' }, options)
      }

      const voiceBuffer = await toPTT(rawBuffer)
      await sock.sendMessage(CHANNEL_JID, { audio: voiceBuffer, mimetype: 'audio/ogg; codecs=opus', ptt: true, waveform: generateWaveform() })
      await sock.sendMessage(msg.chat, { text: '☘︎Archivo de audio enviado con éxito☂︎' }, options)
      await sock.sendMessage(msg.chat, { react: { text: '', key: msg.key } })

    } catch (e) {
      const options = msg.chat.endsWith('@newsletter')? undefined : { quoted: msg }
      await sock.sendMessage(msg.chat, { text: `> Error en *${usedPrefix + command}*: ${e.message}` }, options)
    }
  }
}

async function getAudioMedia(url) {
  const evoUrl = global.APIs?.evogb?.url || 'https://api.evogb.org'
  const evoKey = global.APIs?.evogb?.key || global.api?.evogb?.apikey || 'Mai301520-art'

  try {
    const endpoint = `${evoUrl}/dl/ytmp3?url=${encodeURIComponent(url)}&key=${encodeURIComponent(evoKey)}`
    const res = await fetch(endpoint).then(r => r.json())
    if (res?.status && res?.data?.dl) return res.data.dl
  } catch {}

  try {
    const endpoint2 = `${evoUrl}/api/downloader/ytmp3?url=${encodeURIComponent(url)}&apikey=${encodeURIComponent(evoKey)}`
    const res = await fetch(endpoint2).then(r => r.json())
    const media = res?.result?.media || res?.data?.media || res?.media || res?.result?.dl || res?.download || res?.url
    const direct = typeof media === 'object'? (media.direct || media.dl_download || media.url) : media
    if (direct) return direct.startsWith('/')? `${evoUrl}${direct}` : direct
  } catch {}

  try {
    const skyRes = await fetch('https://api-sky.ultraplus.click/youtube/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': 'Russellxz', 'Accept': 'application/json, */*' },
      body: JSON.stringify({ url: url, type: 'audio', format: 'mp3' })
    }).then(r => r.json())
    const media = skyRes?.result?.media || skyRes?.data?.media
    const directUrl = media?.direct || media?.dl_download || media?.dl_inline || media?.url
    if (directUrl) return directUrl.startsWith('/')? `https://api-sky.ultraplus.click${directUrl}` : directUrl
  } catch {}

  const apis = [
    { endpoint: `https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(url)}`, extractor: res => res?.data?.dl || res?.data?.url || res?.url || null },
    { endpoint: `https://delirius-api-oficial.vercel.app/download/ytmp3?url=${encodeURIComponent(url)}`, extractor: res => res?.data?.download || res?.url || res?.result?.dl || null },
    { endpoint: `https://api.vreden.my.id/api/ytmp3?url=${encodeURIComponent(url)}`, extractor: res => res?.result?.url || res?.result?.download || null },
    { endpoint: `${global.APIs?.stellar?.url || ''}/api/downloader/ytmp3?url=${encodeURIComponent(url)}&apikey=${global.APIs?.stellar?.key || ''}`, extractor: res => res?.url || res?.download || res?.result?.url || null }
  ]
  for (const { endpoint, extractor } of apis) {
    try {
      const res = await fetch(endpoint).then(r => r.json())
      const result = extractor(res)
      if (result) return result
    } catch {}
    await new Promise(r => setTimeout(r, 400))
  }
  return null
}