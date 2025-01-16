const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const db = new sqlite3.Database(path.join(__dirname, 'messages.db'));

async function migrateDatabase() {
    try {
        // Crea la tabella telegram_configs se non esiste
        await new Promise((resolve, reject) => {
            db.run(`
                CREATE TABLE IF NOT EXISTS telegram_configs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    bot_token TEXT NOT NULL,
                    channel_id TEXT NOT NULL,
                    description TEXT,
                    is_active BOOLEAN DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Crea la tabella messages se non esiste
        await new Promise((resolve, reject) => {
            db.run(`
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    text TEXT NOT NULL,
                    file_path TEXT,
                    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    user_id INTEGER,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            `, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        console.log('Migrazione completata con successo');
    } catch (error) {
        console.error('Errore durante la migrazione:', error);
    } finally {
        db.close();
    }
}

migrateDatabase();
