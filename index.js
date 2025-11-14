const qrcode = require("qrcode-terminal");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const fs = require("fs");
const path = require("path");
const { TARGET_GROUP_NAME, BOT_NAME } = require("./config");
const { sendTextToDifYai, sendImageToDifYai } = require("./difyai");

// Buat client dengan LocalAuth (session tersimpan di folder .wwebjs_auth)
const client = new Client({
  authStrategy: new LocalAuth({ clientId: "kjs-ai-bot" }),
  puppeteer: { headless: true } // false kalau mau lihat browser
});

client.on("qr", (qr) => {
  console.log("QR diterima, scan dengan WhatsApp mobile Anda:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log(`${BOT_NAME} siap dan terhubung ke WhatsApp.`);
});

client.on("auth_failure", (msg) => {
  console.error("Autentikasi gagal:", msg);
});

client.on("disconnected", (reason) => {
  console.log("Terputus:", reason);
});

// Helper: mengambil nama kontak/pengguna (pushname atau formattedName)
async function getSenderContactName(message) {
  try {
    // jika group, message.author berisi id peserta (contoh: '12345@c.us'),
    // jika pesan pribadi, message.from adalah id pengirim.
    const participantId = message.author || message.from;
    const contact = await client.getContactById(participantId);
    // Prefer pushname, jika tidak ada gunakan name (pushname bisa null)
    return contact?.pushname || contact?.name || contact?.shortName || participantId;
  } catch (err) {
    console.warn("Gagal ambil contact:", err?.message || err);
    return message.author || message.from;
  }
}

/**
 * Cek apakah chat adalah grup target "KJS Ai"
 */
async function isTargetGroup(chat) {
  if (!chat) return false;
  // Untuk group, chat.isGroup = true, chat.name tersedia
  if (!chat.isGroup) return false;
  // Cocokkan nama grup (case-sensitive? kita gunakan case-insensitive)
  return (chat.name || "").toLowerCase().trim() === TARGET_GROUP_NAME.toLowerCase().trim();
}

client.on("message", async (message) => {
  try {
    // Jangan balas pesan dari bot itu sendiri
    if (message.fromMe) return;

    const chat = await message.getChat();

    // Hanya tangani jika chat adalah group target
    const target = await isTargetGroup(chat);
    if (!target) {
      // tidak melakukan apa apa untuk DM atau grup lain
      return;
    }

    // Dapatkan nama pengirim (sebagai string) untuk mention
    const senderName = await getSenderContactName(message);
    // Dapatkan contact object untuk mentions
    const participantId = message.author || message.from;
    const mentionContact = await client.getContactById(participantId);

    // Jika pesan mengandung media (image/audio/video/document)
    if (message.hasMedia) {
      // download media
      const media = await message.downloadMedia();
      if (!media) {
        console.warn("Media tidak dapat di-download.");
        await chat.sendMessage(`@${senderName} Maaf, saya gagal memproses file Anda.`, { mentions: [mentionContact] });
        return;
      }

      // media.data adalah base64; ubah ke buffer
      const buffer = Buffer.from(media.data, "base64");
      const ext = media.mimetype ? media.mimetype.split("/")[1] : "jpg";
      const filename = `upload_${Date.now()}.${ext}`;

      // Kirim file ke DifYai
      let difyResponseText;
      try {
        difyResponseText = await sendImageToDifYai(buffer, filename, media.mimetype, {
          from: participantId,
          chatName: chat.name
        });
      } catch (err) {
        console.error("Error saat kirim image ke DifYai:", err?.message || err);
        await chat.sendMessage(`@${senderName} Maaf, terjadi error saat memproses gambar Anda.`, { mentions: [mentionContact] });
        return;
      }

      // Balas di group dengan mention nama pengirim
      const reply = `@${senderName} ${difyResponseText}`;
      await chat.sendMessage(reply, { mentions: [mentionContact] });
      return;
    }

    // Jika pesan teks biasa
    if (message.body && message.body.trim().length > 0) {
      // Kirim teks ke DifYai
      let difyResponseText;
      try {
        difyResponseText = await sendTextToDifYai(message.body, {
          from: participantId,
          chatName: chat.name
        });
      } catch (err) {
        console.error("Error saat kirim teks ke DifYai:", err?.message || err);
        await chat.sendMessage(`@${senderName} Maaf, terjadi error saat memproses pesan Anda.`, { mentions: [mentionContact] });
        return;
      }

      // Balas di group dengan mention nama pengirim
      const reply = `@${senderName} ${difyResponseText}`;
      await chat.sendMessage(reply, { mentions: [mentionContact] });
      return;
    }
  } catch (err) {
    console.error("Error pada handler message:", err?.message || err);
  }
});

client.initialize();
