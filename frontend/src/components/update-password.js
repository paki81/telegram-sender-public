const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const db = new sqlite3.Database('messages.db');

async function updatePassword(username, newPassword) {
    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET password = ? WHERE username = ?',
                [hashedPassword, username],
                function(err) {
                    if (err) reject(err);
                    else if (this.changes === 0) {
                        reject(new Error('Utente non trovato'));
                    } else {
                        resolve();
                    }
                }
            );
        });

        console.log(`Password aggiornata per l'utente ${username}`);
    } catch (error) {
        console.error('Errore:', error);
    } finally {
        db.close();
    }
}

const username = process.argv[2];
const newPassword = process.argv[3];

if (!username || !newPassword) {
    console.log('Uso: node update-password.js username nuova_password');
} else {
    updatePassword(username, newPassword);
}