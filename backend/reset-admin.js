const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'messages.db'));

async function resetAdminPassword() {
    const newPassword = 'admin123';
    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Aggiorna la password dell'admin
        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET password = ? WHERE username = ?',
                [hashedPassword, 'admin'],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        if (this.changes === 0) {
                            // Se non esiste l'utente admin, lo creiamo
                            db.run(
                                'INSERT INTO users (username, password) VALUES (?, ?)',
                                ['admin', hashedPassword],
                                (err) => {
                                    if (err) reject(err);
                                    else resolve();
                                }
                            );
                        } else {
                            resolve();
                        }
                    }
                }
            );
        });

        console.log('Password admin reimpostata con successo a:', newPassword);
    } catch (error) {
        console.error('Errore:', error);
    } finally {
        db.close();
    }
}

resetAdminPassword();
