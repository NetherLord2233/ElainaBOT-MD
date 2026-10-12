export default {
  command: ['restart'],
  category: 'owner',
  description: 'Reiniciar el host.',
  isOwner: true,
  run: async ({ msg, sock }) => {
    await sock.reply(msg.chat, `✎ Reiniciando el Socket...\n> *Espere un momento...*`, msg);
    setTimeout(() => {
      if (process.send) {
        process.send("restart");
      } else {
        process.exit(0);
      }
    }, 3000);
  },
};
