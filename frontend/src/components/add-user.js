const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const db = new sqlite3.Database('messages.db');

async function addUser(username, password) {
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        await new Promise((resolve, reject) => {
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            )`, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        await new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO users (username, password) VALUES (?, ?)',
                [username, hashedPassword],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });

        console.log(`Utente ${username} creato con successo!`);
    } catch (error) {
        console.error('Errore:', error);
    } finally {
        db.close();
    }
}

const username = process.argv[2];
const password = process.argv[3];

if (!username || !password) {
    console.log('Uso: node add-user.js username password');
} else {
    addUser(username, password);
}
