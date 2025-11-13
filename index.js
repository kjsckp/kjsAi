import { create } from 'venom-bot';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const DIFY_API_URL = process.env.DIFY_API_URL;
const DIFY_API_KEY = process.env.DIFY_API_KEY;

create({
  session: 'KJS_AI',
  multidevice: true,
  headless: true, // Tidak perlu GUI browser
  disableWelcome: true,
  browserArgs: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-zygote',
    '--single-process'
  ]
})
  .then((client) => start(client))
  .catch((err) => console.error('Gagal memulai venom:', err));

function start(client) {
  console.log('🤖 KJS AI siap digunakan! Menunggu pesan WhatsApp...');

  client.onMessage(async (message) => {
    try {
      // Hanya respon di grup
      if (!message.isGroupMsg) return;
      if (message.fromMe) return;

      const senderName = message.sender.pushname || "Teman";
      const userQuestion = message.body;

      // Kirim ke Dify AI
      const response = await fetch(DIFY_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${DIFY_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          inputs: { question: userQuestion },
          response_mode: "blocking"
        })
      });

      const data = await response.json();
      const aiReply = data.answer || "Maaf, aku belum bisa menjawab itu 😅";

      // Balas pesan di grup dengan mention nama
      await client.sendText(message.from, `@${senderName}, ${aiReply}`, {
        mentions: [message.sender.id]
      });

      console.log(`[BOT REPLY] ${senderName}: ${userQuestion}`);

    } catch (error) {
      console.error("Terjadi error:", error);
    }
  });
}
