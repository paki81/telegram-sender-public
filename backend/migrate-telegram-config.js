const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'messages.db'));

async function migrateTelegramConfig() {
    try {
        // Crea la nuova tabella telegram_configs
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

        // Migra i dati dalla vecchia tabella config se esiste
        await new Promise((resolve, reject) => {
            db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='config'", async (err, table) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (table) {
                    // La tabella config esiste, migriamo i dati
                    db.get('SELECT bot_token, channel_id FROM config ORDER BY id DESC LIMIT 1', (err, row) => {
                        if (err) {
                            reject(err);
                            return;
                        }

                        if (row) {
                            db.run(`
                                INSERT INTO telegram_configs (bot_token, channel_id, is_active)
                                VALUES (?, ?, 1)
                            `, [row.bot_token, row.channel_id], (err) => {
                                if (err) reject(err);
                                else resolve();
                            });
                        } else {
                            resolve();
                        }
                    });
                } else {
                    resolve();
                }
            });
        });

        console.log('Migrazione completata con successo');
    } catch (error) {
        console.error('Errore durante la migrazione:', error);
    } finally {
        db.close();
    }
}

migrateTelegramConfig();
