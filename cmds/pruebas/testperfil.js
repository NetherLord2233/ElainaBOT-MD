import axios from 'axios';

export default {
  command: ['testperfl', 'testlvl'],
  category: 'owner',
  description: 'Test level card canvas',
  isOwner: true,
  run: async ({ msg, sock }) => {
    const apiUrl = global.APIs?.evogb?.url || 'https://api.evogb.org';
    const apiKey = global.APIs?.evogb?.key;
    
    if (!apiKey) return msg.reply('No hay API key.');

    try {
      const { data } = await axios.get(`${apiUrl}/canvas/generate-level-card`, {
        params: {
          key: apiKey,
          avatar: 'https://i.pravatar.cc/300',
          username: 'TestUser',
          level: 10,
          currentXp: 500,
          requiredXp: 1000,
          rank: 1
        },
        responseType: 'arraybuffer',
        timeout: 15000
      });

      const contentType = data ? 'image' : null;
      
      if (data.byteLength < 500) {
        const text = Buffer.from(data).toString();
        return msg.reply(`Respuesta: ${text.slice(0, 1000)}`);
      }

      await sock.sendMessage(msg.chat, { image: Buffer.from(data), caption: 'Level Card Test' }, { quoted: msg });

    } catch (e) {
      const errText = e.response?.data ? Buffer.from(e.response.data).toString().slice(0, 1000) : e.message;
      if (errText.includes('<!doctype') || errText.includes('<html')) {
        return msg.reply('No se pudo procesar');
      }
      return msg.reply(`No se pudo procesar\n${errText}`);
    }
  }
};