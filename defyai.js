const axios = require("axios");
const FormData = require("form-data");
const { DIFYAI_API_URL, DIFYAI_API_KEY } = require("./config");

/**
 * Kirim teks ke DifYai dan dapatkan respon teks.
 * Jika model Anda menerima JSON saja:
 * - adjust sesuai API DifYai Anda
 */
async function sendTextToDifYai(text, metadata = {}) {
  try {
    const payload = {
      inputs: {},
      query: text,                       // WAJIB ADA
      user: metadata.from || "unknown",  // WAJIB ADA
      response_mode: "blocking"          // supaya balasan langsung diterima
    };

    const res = await axios.post(DIFYAI_API_URL, payload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DIFYAI_API_KEY}`
      },
      timeout: 60000
    });

    return res.data?.answer || JSON.stringify(res.data);
  } catch (err) {
    console.error("Error sendTextToDifYai:", err?.response?.data || err.message);
    throw err;
  }
}

/**
 * Kirim file (image) ke DifYai. Mengembalikan teks jawaban dari DifYai.
 * - fileBuffer: Buffer
 * - filename: string
 * - mimeType: string
 */
async function sendImageToDifYai(fileBuffer, filename, mimeType = "image/jpeg", extra = {}) {
  try {
    const form = new FormData();
    form.append("file", fileBuffer, { filename, contentType: mimeType });

    // WAJIB: kirim query untuk memicu vision
    form.append("query", extra.caption || "Silakan analisa gambar ini ya 😊");

    // User info
    form.append("user", extra.from || "unknown-user");
    form.append("response_mode", "blocking");

    const res = await axios.post(DIFYAI_API_URL, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${DIFYAI_API_KEY}`
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 120000
    });

    return res.data?.answer || res.data?.output_text || JSON.stringify(res.data);
  } catch (err) {
    console.error("Error sendImageToDifYai:", err?.response?.data || err.message);
    throw err;
  }
}

module.exports = {
  sendTextToDifYai,
  sendImageToDifYai
};
