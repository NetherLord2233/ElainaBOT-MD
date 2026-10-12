import db from '#db';

function getXPNeeded(level) {
  if (level >= 30) return Infinity;
  if (level === 1) return 1500;
  if (level === 2) return 3500;
  if (level === 3) return 7000;
  return Math.floor(7000 + ((level - 3) * 3500) + Math.pow(level, 2.3) * 250);
}

function progressBar(current, max, length = 10) {
  if (max === Infinity || max === 0) return '█'.repeat(length);
  let percent = Math.min(1, current / max);
  let filled = Math.floor(percent * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled) + ` ${Math.floor(percent*100)}%`;
}

export default {
  command: ['prestamo', 'pbank', 'loan', 'payloan', 'payprestamo'],
  category: 'economy',
  description: 'ELAINA-BANK diseño premium mejorado.',
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    const chatId = msg.chat;
    const senderId = msg.sender;
    const botId = sock.user?.id? (sock.user.id.split(':')[0] + '@s.whatsapp.net') : '';
    const botSettings = await db.getSettings(botId);
    const monedas = botSettings?.currency || botSettings?.botcurrency || 'Monedas';
    const chatData = await db.getChat(chatId);

    if (chatData?.adminonly ||!chatData?.economy) {
      return msg.reply(`ꕥ Los comandos de *Economía* están desactivados.\n» *${usedPrefix}economy on*`);
    }

    db.setCreate('chat_users', [chatId, senderId], 'loan', null);
    db.setCreate('chat_users', [chatId, senderId], 'creditScore', 1);
    db.setCreate('chat_users', [chatId, senderId], 'creditXP', 0);
    db.setCreate('chat_users', [chatId, senderId], 'paidLoans', 0);

    const senderData = await db.getChatUser(chatId, senderId) || {};
    const walletField = senderData.coins!== undefined? 'coins' : 'money';
    const currentWallet = senderData[walletField] || 0;
    const currentBank = senderData.bank || 0;
    const netWorth = Math.max(0, currentWallet + currentBank);

    let creditScore = Math.min(30, senderData.creditScore || 1);
    let creditXP = senderData.creditXP || 0;
    const paidLoans = senderData.paidLoans || 0;
    const activeLoan = senderData.loan;

    const multiplier = 1 + (creditScore * 0.35);
    const maxLoan = Math.max(5000, Math.floor(netWorth * multiplier));

  
    if (activeLoan && activeLoan.amount > 0 && Date.now() >= activeLoan.dueTime) {
      const remainingDebt = activeLoan.remainingToPay;
      let debtToCollect = remainingDebt;
      let newBank = currentBank;
      let newWallet = currentWallet;
      if (newBank >= debtToCollect) { newBank -= debtToCollect; debtToCollect = 0; }
      else { debtToCollect -= newBank; newBank = 0; }
      if (debtToCollect > 0) newWallet -= debtToCollect;

      const newScore = Math.max(1, creditScore - 1);
      await db.updateChatUser(chatId, senderId, 'bank', newBank);
      await db.updateChatUser(chatId, senderId, walletField, newWallet);
      await db.updateChatUser(chatId, senderId, 'loan', null);
      await db.updateChatUser(chatId, senderId, 'creditScore', newScore);

      const text = `╭━─━─━─━─━─━─━─━─━─━─━╮
│ 🏛️ *ELAINA-BANK | INCAUTACIÓN* │
╰━─━─━─━─━─━─━─━─━─━─━╯

┏━━━ *⚠️ AVISO DE MORA* ━━━┓
┃ Cliente: @${senderId.split('@')[0]}
┃ Préstamo vencido: ¥${activeLoan.amount.toLocaleString()}
┗━━━━━━━━━━━━━━━━━━━━━┛

┌─ *📑 DETALLE DE COBRO* ─
│ • Deuda: ¥${remainingDebt.toLocaleString()} ${monedas}
│ • Banco descontado: ¥${(currentBank - newBank).toLocaleString()}
│ • Billetera descontada: ¥${(currentWallet - newWallet).toLocaleString()}
└────────────────────

┌─ *💳 ESTADO FINAL* ─
│ • Billetera: ¥${newWallet.toLocaleString()} ${newWallet < 0? '🔴 NEGATIVO' : '🟢'}
│ • Banco: ¥${newBank.toLocaleString()}
│ • Score: Nivel ${newScore} ⬇️ Penalizado
└────────────────────

> *ELAINA-BANK ejecutó cobro automático.*`;

      return sock.sendMessage(chatId, { text, mentions: [senderId] }, { quoted: msg });
    }

    const subCommand = args[0]?.toLowerCase();

    
    if (subCommand === 'pagar' || subCommand === 'payloan' || command === 'payloan' || command === 'payprestamo') {
      if (!activeLoan || activeLoan.amount <= 0) {
        return msg.reply('《✧》 No tienes préstamo activo en ELAINA-BANK.');
      }
      const paymentInput = (command === 'payloan' || command === 'payprestamo')? args[0]?.toLowerCase() : args[1]?.toLowerCase();
      const availableTotal = currentWallet + currentBank;
      if (availableTotal <= 0) return msg.reply('《✧》 Sin fondos.');

      let amountToPay = 0;
      if (!paymentInput || paymentInput === 'all' || paymentInput === 'todo') amountToPay = Math.min(activeLoan.remainingToPay, availableTotal);
      else amountToPay = parseInt(paymentInput);

      if (isNaN(amountToPay) || amountToPay <= 0) return msg.reply(`《✧》 Cantidad inválida.\nEj: *${usedPrefix}payloan 150000* o *${usedPrefix}payloan all*`);
      if (amountToPay > availableTotal) return msg.reply(`《✧》 Fondos insuficientes. Total: ¥${availableTotal.toLocaleString()}`);
      if (amountToPay > activeLoan.remainingToPay) amountToPay = activeLoan.remainingToPay;

      let debtToDeduct = amountToPay;
      let newWallet = currentWallet;
      let newBank = currentBank;
      if (newWallet >= debtToDeduct) { newWallet -= debtToDeduct; debtToDeduct = 0; }
      else { debtToDeduct -= newWallet; newWallet = 0; }
      if (debtToDeduct > 0) newBank -= debtToDeduct;

      const newRemaining = activeLoan.remainingToPay - amountToPay;
      let earnedXP = Math.min(100, Math.floor(amountToPay / 100000));
      const isFullyPaid = newRemaining <= 0;
      if (isFullyPaid) earnedXP += Math.floor(earnedXP * 0.10);

      creditXP += earnedXP;
      let leveledUp = false;
      while (creditScore < 30) {
        const xpNeeded = getXPNeeded(creditScore);
        if (creditXP >= xpNeeded) { creditXP -= xpNeeded; creditScore += 1; leveledUp = true; } else break;
      }
      if (creditScore >= 30) { creditScore = 30; creditXP = 0; }

      await db.updateChatUser(chatId, senderId, walletField, newWallet);
      await db.updateChatUser(chatId, senderId, 'bank', newBank);
      await db.updateChatUser(chatId, senderId, 'creditXP', creditXP);
      await db.updateChatUser(chatId, senderId, 'creditScore', creditScore);

      const xpNeeded = getXPNeeded(creditScore);
      const bar = progressBar(creditXP, xpNeeded);

      if (isFullyPaid) {
        const newPaidLoans = paidLoans + 1;
        await db.updateChatUser(chatId, senderId, 'loan', null);
        await db.updateChatUser(chatId, senderId, 'paidLoans', newPaidLoans);
        const text = `╭━━━ *💳 CRÉDITO LIQUIDADO* ━━━╮
│ ✅ *PAGO COMPLETADO*
╰━━━━━━━━━━━━━━━━━━━━━━╯

👤 @${senderId.split('@')[0]} liquidó su deuda.

┌─ *💸 RESUMEN* ─
│ • Abonado hoy: ¥${amountToPay.toLocaleString()}
│ • Deuda restante: ¥0
│ • XP ganada: +${earnedXP} ✨
└───────────────

┌─ *📈 PROGRESO CREDITICIO* ─
│ • Nivel: ${creditScore}/30 ${leveledUp? '🎉 ¡SUBISTE!' : ''}
│ • ${bar}
│ • ${creditScore >= 30? 'MAX' : `${creditXP}/${xpNeeded} XP`}
│ • Préstamos pagados: ${newPaidLoans}
└──────────────────────────

┌─ *💰 BILLETERA* ─
│ • Efectivo: ¥${newWallet.toLocaleString()}
│ • Banco: ¥${newBank.toLocaleString()}
└───────────────
> *ELAINA-BANK • Excelente historial.*`;
        return sock.sendMessage(chatId, { text, mentions: [senderId] }, { quoted: msg });
      } else {
        await db.updateChatUser(chatId, senderId, 'loan', {...activeLoan, remainingToPay: newRemaining });
        const text = `╭━━ *💳 ABONO RECIBIDO* ━━╮
│ ⏳ *PAGO PARCIAL*
╰━━━━━━━━━━━━━━━━━━╯

👤 @${senderId.split('@')[0]}

┌─ *💸 DETALLE* ─
│ • Abonado: ¥${amountToPay.toLocaleString()}
│ • Pendiente: ¥${newRemaining.toLocaleString()}
│ • XP: +${earnedXP} ✨
└──────────────

┌─ *📊 CRÉDITO* ─
│ • Nivel ${creditScore}/30 ${leveledUp? '⬆️ NIVEL UP!' : ''}
│ • ${bar}
│ • ${creditScore >= 30? 'MAX' : `${creditXP}/${xpNeeded} XP`}
└──────────────

💼 Efectivo: ¥${newWallet.toLocaleString()} | Banco: ¥${newBank.toLocaleString()}
> *Sigue abonando para liquidar.*`;
        return sock.sendMessage(chatId, { text, mentions: [senderId] }, { quoted: msg });
      }
    }

    
    if (!subCommand || isNaN(parseInt(subCommand))) {
      let loanInfo;
      if (activeLoan && activeLoan.amount > 0) {
        loanInfo = `│ • Prestado: ¥${activeLoan.amount.toLocaleString()}
│ • Total a pagar: ¥${activeLoan.totalToPay.toLocaleString()}
│ • Pendiente: ¥${activeLoan.remainingToPay.toLocaleString()} 🔴
│ • Vence en: ${msToDays(activeLoan.dueTime - Date.now())}`;
      } else {
        loanInfo = `│ • Sin deuda activa ✅`;
      }

      const chance = Math.min(100, (25 + ((creditScore - 1) * 1.5))).toFixed(1);
      const xpNeeded = getXPNeeded(creditScore);
      const bar = progressBar(creditXP, xpNeeded);
      const menu = `╭━─━─━─━─━─━─━╮
│ 🏛️ *ELAINA-BANK PREMIUM* │
╰━─━─━─━─━─━─━╯

┏━━ *👤 CLIENTE* ━━┓
┃ @${senderId.split('@')[0]}
┃ Nivel: ${creditScore}/30 ${creditScore >= 20? '💎' : creditScore >= 10? '🟢' : '🟡'}
┃ ${bar}
┃ ${creditScore >= 30? 'MAX LEVEL' : `${creditXP}/${xpNeeded} XP`}
┃ Aprobación: ${chance}% | Pagados: ${paidLoans}
┗━━━━━━━━━━━━━━┛

┌─ *💳 LÍMITE & PATRIMONIO* ─
│ • Billetera: ¥${currentWallet.toLocaleString()}
│ • Banco: ¥${currentBank.toLocaleString()}
│ • Patrimonio: ¥${netWorth.toLocaleString()}
│ • Límite crédito: ¥${maxLoan.toLocaleString()} ${monedas}
└─────────────────────────

┌─ *📑 CRÉDITO ACTIVO* ─
${loanInfo}
└────────────────────

┏━━ *⚙️ COMANDOS* ━━┓
┃ • Pedir: ${usedPrefix}prestamo <monto> <1-7 días>
┃ Ej: ${usedPrefix}prestamo 20000 3
┃ • Pagar: ${usedPrefix}payloan <monto|all>
┗━━━━━━━━━━━━━━━━┛

> 💡 Paga a tiempo para subir de nivel y desbloquear créditos de hasta x10 tu patrimonio.`;

      return sock.sendMessage(chatId, { text: menu, mentions: [senderId] }, { quoted: msg });
    }

    if (activeLoan && activeLoan.amount > 0) {
      return msg.reply(`《✧》 Ya tienes préstamo activo.\n» *${usedPrefix}payloan <monto>* para abonar.`);
    }

    const requestedAmount = parseInt(subCommand);
    const daysInput = parseInt(args[1]);

    if (isNaN(requestedAmount) || requestedAmount <= 0) return msg.reply('《✧》 Monto inválido.');
    if (requestedAmount > maxLoan) return msg.reply(`《✧》 Límite excedido. Tu máximo con Nivel ${creditScore} es ¥${maxLoan.toLocaleString()} ${monedas}.`);
    if (isNaN(daysInput) || daysInput < 1 || daysInput > 7) return msg.reply(`《✧》 Días inválidos (1-7).\nEj: *${usedPrefix + command} ${requestedAmount} 3*`);

    const successChance = Math.min(1.0, 0.25 + ((creditScore - 1) * 0.015));
    const isApproved = Math.random() < successChance;

    if (!isApproved) {
      const text = `╭━─━─━─━─━─━─━─━╮
│ ❌ *CRÉDITO RECHAZADO* │
╰━─━─━─━─━─━─━─━╯

👤 @${senderId.split('@')[0]}, el sistema de riesgo rechazó tu solicitud.

┌─ *📉 EVALUACIÓN* ─
│ • Solicitado: ¥${requestedAmount.toLocaleString()}
│ • Prob. rechazo: ${((1-successChance)*100).toFixed(1)}%
│ • Nivel actual: ${creditScore}/30
│ • ${progressBar(creditXP, getXPNeeded(creditScore))}
└─────────────────

> 💡 Sube tu nivel pagando préstamos anteriores puntualmente.`;
      return sock.sendMessage(chatId, { text, mentions: [senderId] }, { quoted: msg });
    }

    let interestRate = 0.12;
    if (daysInput >= 2 && daysInput <= 3) interestRate = 0.25;
    else if (daysInput >= 4) interestRate = 0.40;

    const totalInterest = Math.floor(requestedAmount * interestRate);
    const totalToPay = requestedAmount + totalInterest;
    const dueTime = Date.now() + (daysInput * 86400000);

    const loanData = { amount: requestedAmount, interest: Math.round(interestRate * 100), totalToPay, remainingToPay: totalToPay, days: daysInput, dueTime };
    const newWallet = currentWallet + requestedAmount;

    await db.updateChatUser(chatId, senderId, walletField, newWallet);
    await db.updateChatUser(chatId, senderId, 'loan', loanData);

    const approved = `╭━━━ *📋 CRÉDITO APROBADO* ━━━╮
│ ✅ *DESEMBOLSO EXITOSO*
╰━━━━━━━━━━━━━━━━━━━━━━━╯

👤 Cliente: @${senderId.split('@')[0]}

┌─ *💸 RESUMEN* ─
│ • Depositado: +¥${requestedAmount.toLocaleString()} ${monedas}
│ • Interés: ${Math.round(interestRate*100)}% (¥${totalInterest.toLocaleString()})
│ • Total a devolver: ¥${totalToPay.toLocaleString()}
│ • Plazo: ${daysInput} día(s)
│ • Vence: ${new Date(dueTime).toLocaleDateString()}
└────────────────

┌─ *💰 NUEVO SALDO* ─
│ • Billetera: ¥${newWallet.toLocaleString()}
└────────────────

> 💡 Usa *${usedPrefix}payloan <monto>* para abonar. Paga a tiempo y gana XP.`;

    return sock.sendMessage(chatId, { text: approved, mentions: [senderId] }, { quoted: msg });
  }
};

function msToDays(duration) {
  const hours = Math.floor((duration / (1000 * 60 * 60)) % 24);
  const days = Math.floor(duration / (1000 * 60 * 60 * 24));
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}
