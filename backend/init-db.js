const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const dbPath = path.join(__dirname, 'messages.db');
const db = new sqlite3.Database(dbPath);

async function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      try {
        // Tabella users
        db.run(`CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          is_admin INTEGER DEFAULT 0
        )`);

        // Tabella telegram_configs
        db.run(`CREATE TABLE IF NOT EXISTS telegram_configs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          bot_token TEXT NOT NULL,
          channel_id TEXT NOT NULL,
          description TEXT,
          is_active INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Drop tabella messages se esiste
        db.run(`DROP TABLE IF EXISTS messages`);

        // Ricrea tabella messages
        db.run(`CREATE TABLE messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          message TEXT NOT NULL,
          user_id INTEGER NOT NULL,
          sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          telegram_message_id INTEGER,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        // Drop tabella attachments se esiste
        db.run(`DROP TABLE IF EXISTS attachments`);

        // Ricrea tabella attachments
        db.run(`CREATE TABLE attachments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          message_id INTEGER NOT NULL,
          filename TEXT NOT NULL,
          original_name TEXT NOT NULL,
          mime_type TEXT,
          size INTEGER,
          FOREIGN KEY (message_id) REFERENCES messages (id)
        )`);

        // Crea password hash
        bcrypt.hash('admin', 10, (err, hashedPassword) => {
          if (err) {
            reject(err);
            return;
          }

          // Inserisci utente admin
          db.run(`INSERT OR IGNORE INTO users (username, password, is_admin) VALUES (?, ?, 1)`, 
            ['admin', hashedPassword], (err) => {
              if (err) {
                reject(err);
                return;
              }

              // Inserisci configurazione Telegram di test
              db.run(`INSERT OR IGNORE INTO telegram_configs (bot_token, channel_id, description, is_active) 
                VALUES (?, ?, ?, 1)`,
                ['YOUR_BOT_TOKEN', 'YOUR_CHANNEL_ID', 'Test Configuration'], (err) => {
                  if (err) {
                    reject(err);
                  } else {
                    resolve();
                  }
                });
            });
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}

initDatabase()
  .then(() => {
    console.log('Database inizializzato con successo');
    db.close();
  })
  .catch((error) => {
    console.error('Errore durante l\'inizializzazione del database:', error);
    db.close();
  });
