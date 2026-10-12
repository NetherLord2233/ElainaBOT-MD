import fetch from 'node-fetch'

export default {
  command: ['apk', 'aptoide', 'apkdl', 'mediafire', 'mf'],
  category: 'downloader',
  description: 'descarga archivos o juegos APK', 
  run: async ({ sock, msg, args, usedPrefix, command }) => {
    const isChannel = msg.chat?.endsWith('@newsletter')
    const options = isChannel ? undefined : { quoted: msg }

    if (!args || !args.length) {
      return sock.sendMessage(msg.chat, { text: '《✧》 Por favor, ingresa el nombre de la aplicación o un enlace de Mediafire.' }, options)
    }

    const query = args.join(' ').trim()

    try {
      if (/https?:\/\/(www\.)?mediafire\.com/i.test(query)) {
        const mfData = await scrapeMediafire(query)
        if (!mfData || !mfData.link) {
          return sock.sendMessage(msg.chat, { text: '《✧》 No se pudo extraer el enlace de Mediafire.' }, options)
        }

        const sizeBytes = parseSize(mfData.size)
        const caption = `✰ ᩧ 𓈒 ׄ Mediafire Directo  ׅ ✿\n\n➩ *Nombre ›* ${mfData.name}\n☆ *Tamaño ›* ${mfData.size}\n🔗 *Enlace ›* ${mfData.link}`

        if (sizeBytes > 524288000) {
          return sock.sendMessage(msg.chat, { text: `《✧》 El archivo supera el límite (500 MB) con un tamaño de ${mfData.size}.\n> Descárgalo directamente aquí:\n${mfData.link}` }, options)
        }

        return await sock.sendMessage(msg.chat, {
          document: { url: mfData.link },
          mimetype: mfData.mime || 'application/octet-stream',
          fileName: mfData.name,
          caption
        }, options)
      }

      const mfSearch = await searchMediafireQuery(query)
      if (mfSearch && mfSearch.link) {
        const sizeBytes = parseSize(mfSearch.size)
        const caption = `✰ ᩧ 𓈒 ׄ{ Búsqueda Mediafire APK } ׅ ✿\n\n➩ *Nombre ›* ${mfSearch.name}\n☆ *Tamaño ›* ${mfSearch.size}\n🔗 *Descarga Directa ›* ${mfSearch.link}\n🌐 *Fuente ›* ${mfSearch.sourceUrl}`

        if (sizeBytes > 524288000) {
          return sock.sendMessage(msg.chat, { text: `《✧》 El archivo supera el límite (${mfSearch.size}).\n> Descárgalo directamente aquí:\n${mfSearch.link}` }, options)
        }

        return await sock.sendMessage(msg.chat, {
          document: { url: mfSearch.link },
          mimetype: mfSearch.mime || 'application/vnd.android.package-archive',
          fileName: mfSearch.name.endsWith('.apk') || mfSearch.name.endsWith('.zip') || mfSearch.name.endsWith('.rar') ? mfSearch.name : `${mfSearch.name}.apk`,
          caption
        }, options)
      }

      let apkInfo = await searchAptoide(query)

      if (apkInfo && apkInfo.downloadUrl) {
        const formattedSize = formatBytes(apkInfo.size)
        const caption = `✰ ᩧ 𓈒 ׄ Aptoide Downloader  ׅ ✿\n\n➩ *Nombre ›* ${apkInfo.name}\n❖ *Paquete ›* ${apkInfo.package}\n🏢 *Desarrollador ›* ${apkInfo.developer}\n✿ *Última actualización ›* ${apkInfo.lastup}\n☆ *Tamaño ›* ${formattedSize}\n🔗 *Fuente ›* ${apkInfo.downloadUrl}`

        if (apkInfo.size > 524288000) {
          return sock.sendMessage(msg.chat, { text: `《✧》 El archivo es demasiado grande (${formattedSize}).\n> Descárgalo directamente aquí:\n${apkInfo.downloadUrl}` }, options)
        }

        return await sock.sendMessage(msg.chat, {
          document: { url: apkInfo.downloadUrl },
          mimetype: 'application/vnd.android.package-archive',
          fileName: `${apkInfo.name}.apk`,
          caption
        }, options)
      }

      return sock.sendMessage(msg.chat, { text: '《✧》 No se encontraron juegos ni aplicaciones válidas para esa búsqueda.' }, options)

    } catch (e) {
      await sock.sendMessage(msg.chat, { text: `> Ocurrió un error al ejecutar *${usedPrefix + command}*.\n> [Error: *${e.message}*]` }, options)
    }
  }
}

async function searchMediafireQuery(query) {
  try {
    const searchTerms = [
      `"${query}" apk full site:mediafire.com`,
      `"${query}" apk mod site:mediafire.com`,
      `${query} android apk site:mediafire.com`
    ]

    for (const q of searchTerms) {
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`
      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3'
        }
      })
      const html = await res.text()
      const matches = html.match(/https?:\/\/(www\.)?mediafire\.com\/(file|download)\/[^\s"'<>]+/gi)

      if (matches && matches.length > 0) {
        for (const matchUrl of matches.slice(0, 3)) {
          const scraped = await scrapeMediafire(matchUrl)
          if (scraped && scraped.link) {
            scraped.sourceUrl = matchUrl
            return scraped
          }
        }
      }
    }
    return null
  } catch {
    return null
  }
}

async function scrapeMediafire(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    })
    const html = await res.text()

    const link = html.match(/href="(https?:\/\/download[^"]+)"/i)?.[1] || 
                 html.match(/id="downloadButton"\s+href="([^"]+)"/i)?.[1] ||
                 html.match(/aria-label="Download file"\s+href="([^"]+)"/i)?.[1]

    if (!link) return null

    const name = html.match(/class="filename">([^<]+)</i)?.[1] ||
                 html.match(/<div class="dl-btn-label"[^>]*title="([^"]+)"/i)?.[1] ||
                 html.match(/<title>([^<]+)<\/title>/i)?.[1]?.replace('- MediaFire', '').trim() ||
                 'archivo'

    const size = html.match(/<li>File size: <span>([^<]+)<\/span>/i)?.[1] ||
                 html.match(/class="file-size"[^>]*><span>([^<]+)<\/span>/i)?.[1] ||
                 html.match(/(\d+(\.\d+)?\s*(KB|MB|GB|B))/i)?.[0] ||
                 'Desconocido'

    const ext = name.split('.').pop().toLowerCase()
    const mimeTypes = {
      apk: 'application/vnd.android.package-archive',
      zip: 'application/zip',
      rar: 'application/x-rar-compressed',
      pdf: 'application/pdf',
      mp3: 'audio/mpeg',
      mp4: 'video/mp4'
    }

    return { name: name.trim(), size: size.trim(), link, mime: mimeTypes[ext] || 'application/octet-stream' }
  } catch {
    return null
  }
}

async function searchAptoide(query) {
  try {
    const res = await fetch(`https://ws75.aptoide.com/api/7/apps/search?query=${encodeURIComponent(query)}`)
    const json = await res.json()
    const apps = json?.datalist?.list || []
    if (apps.length === 0) return null

    const ignoreWords = ['guide', 'guia', 'guía', 'walkthrough', 'tips', 'trucos', 'helper', 'companion', 'wallpaper', 'soundtrack', 'quiz', 'demo', 'prank', 'guide for', 'hint', 'education edition']

    let validApps = apps.filter(app => {
      const name = (app.name || '').toLowerCase()
      const isIgnored = ignoreWords.some(word => name.includes(word))
      const appSize = app.size || app.file?.fsize || app.file?.filesize || 0
      app.realSize = appSize
      return !isIgnored && appSize > 102400 
    })

    if (validApps.length === 0) return null

    const queryTokens = query.toLowerCase().trim().split(/\s+/)
    
    validApps.forEach(app => {
      const appName = (app.name || '').toLowerCase()
      let score = 0
      
      if (appName === query.toLowerCase()) score += 100
      
      queryTokens.forEach(token => {
        if (appName.includes(token)) score += 10
      })
      
      app.matchScore = score
    })

    validApps.sort((a, b) => b.matchScore - a.matchScore)

    const bestMatch = validApps[0]

    if (!bestMatch || !bestMatch.file?.path) return null

    return {
      name: bestMatch.name || 'Aplicacion',
      package: bestMatch.package || 'Desconocido',
      size: bestMatch.realSize,
      downloadUrl: bestMatch.file.path,
      lastup: bestMatch.updated || 'Desconocido',
      developer: bestMatch.developer?.name || 'Desconocido'
    }
  } catch {
    return null
  }
}

function parseSize(sizeStr) {
  if (!sizeStr) return 0
  const parts = sizeStr.trim().toUpperCase().split(' ')
  const value = parseFloat(parts[0])
  const unit = parts[1] || 'B'
  switch (unit) {
    case 'KB': return value * 1024
    case 'MB': return value * 1024 * 1024
    case 'GB': return value * 1024 * 1024 * 1024
    default: return value
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }
