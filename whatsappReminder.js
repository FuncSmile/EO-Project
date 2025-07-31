const { Client, LocalAuth } = require("whatsapp-web.js");
const cron = require("node-cron");
const db = require("./db/connection");

// Inisialisasi WhatsApp client
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
    ],
  },
});

let clientReady = false;

// WhatsApp client event listeners
client.on("qr", (qr) => console.log("QR RECEIVED:", qr));
client.on("authenticated", () => console.log("Authenticated"));
client.on("ready", () => {
  clientReady = true;
  console.log("WhatsApp client is ready!");
});
client.on("auth_failure", (msg) => {
  clientReady = false;
  console.error("AUTH FAILURE:", msg);
});
client.on("disconnected", (reason) => {
  clientReady = false;
  console.log("Client disconnected:", reason);
  setTimeout(() => {
    console.log("Reinitializing client...");
    client.initialize();
  }, 5000);
});
process.on("unhandledRejection", (reason) => {
  if (reason?.message?.includes("Execution context was destroyed")) {
    console.warn("Context error. Reinitializing...");
    clientReady = false;
    client.initialize();
  } else {
    console.error("Unhandled rejection:", reason);
  }
});

client.initialize();

// Reminder scheduler
let scheduledJobs = [];

function clearScheduledJobs() {
  scheduledJobs.forEach((job) => job.stop());
  scheduledJobs = [];
}

const waitForClientReady = (timeoutMs = 10000) => {
  return new Promise((resolve, reject) => {
    if (clientReady) return resolve();
    const timeout = setTimeout(
      () =>
        reject(new Error("Timeout waiting for WhatsApp client to be ready")),
      timeoutMs
    );
    const interval = setInterval(() => {
      if (clientReady) {
        clearTimeout(timeout);
        clearInterval(interval);
        resolve();
      }
    }, 500);
  });
};

async function scheduleRundownReminders() {
  clearScheduledJobs();
  try {
    const [rundowns] = await db.query(`
      SELECT r.id AS rundown_id, r.event_id, r.kegiatan, r.tempat, r.jam, r.pembawa_acara,
             g.name AS guest_name, g.phone AS guest_phone,
             e.name AS event_name
      FROM rundown r
      JOIN guests g ON r.event_id = g.event_id
      JOIN events e ON r.event_id = e.id
    `);

    const now = new Date();

    rundowns.forEach((rundown) => {
      const [hh, mm, ss] = rundown.jam.split(":");
      const eventTime = new Date();
      eventTime.setHours(+hh, +mm, +(ss || 0), 0);

      const reminderTime = new Date(eventTime.getTime() - 5 * 60000);
      if (reminderTime <= now) return;

      const cronExpr = `${reminderTime.getMinutes()} ${reminderTime.getHours()} * * *`;

      const job = cron.schedule(cronExpr, async () => {
        const message = `Yth. Bapak/Ibu ${rundown.guest_name},

Kami informasikan bahwa Anda terdaftar sebagai tamu dalam acara berikut:

📛 *${rundown.event_name}*  
📌 Kegiatan: ${rundown.kegiatan}  
📍 Tempat: ${rundown.tempat}  
🗓️ Tanggal: ${rundown.tanggal}  
🕒 Waktu: ${rundown.jam}  
🎙️ Pembawa Acara: ${rundown.pembawa_acara}

Mohon kesediaan Bapak/Ibu untuk hadir tepat waktu. Kehadiran Anda sangat kami nantikan.

*Pesan ini dikirim secara otomatis sebagai pengingat acara.*  
Terima kasih. 🙏`;

        let phone = rundown.guest_phone?.replace(/\D/g, "");
        if (!phone || phone.length < 9) {
          console.error(`Invalid nomor: ${rundown.guest_phone}`);
          return;
        }
        if (phone.startsWith("0")) phone = "62" + phone.slice(1);
        const chatId = `${phone}@c.us`;

        try {
          await waitForClientReady();

          try {
            await client.getChatById(chatId);
          } catch (chatErr) {
            console.warn(`Chat belum ada, lanjut kirim ke: ${chatId}`);
          }

          const sendMessageWithRetry = async (
            id,
            msg,
            retries = 5,
            delay = 2000
          ) => {
            for (let i = 1; i <= retries; i++) {
              try {
                await client.sendMessage(id, msg);
                console.log(
                  `Reminder terkirim ke ${rundown.guest_name} (${rundown.guest_phone})`
                );
                return;
              } catch (err) {
                console.warn(`Gagal kirim ke ${id} attempt ${i}:`, err.message);
                if (i < retries)
                  await new Promise((res) => setTimeout(res, delay * i));
              }
            }
          };

          await sendMessageWithRetry(chatId, message);
        } catch (err) {
          console.error(`Gagal kirim reminder ke ${chatId}:`, err);
        }
      });

      scheduledJobs.push(job);
    });
  } catch (err) {
    console.error("Error scheduling reminders:", err);
  }
}

module.exports = {
  client,
  scheduleRundownReminders,
  clearScheduledJobs,
};
