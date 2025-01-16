const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'messages.db'));

async function migrateDatabase() {
    try {
        // Aggiungi la colonna clear_password se non esiste
        await new Promise((resolve, reject) => {
            db.run(`
                ALTER TABLE users 
                ADD COLUMN clear_password TEXT;
            `, (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });

        // Aggiorna l'utente admin con la password in chiaro
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE users 
                SET clear_password = 'admin123' 
                WHERE username = 'admin' AND clear_password IS NULL;
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
