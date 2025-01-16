const sqlite3 = require('sqlite3').verbose();

// Apri il database
const db = new sqlite3.Database('database.db');

// Esegui la migrazione
db.serialize(() => {
  // Backup della tabella messages
  db.run(`CREATE TABLE messages_backup AS SELECT * FROM messages`);
  
  // Drop della tabella messages originale
  db.run(`DROP TABLE messages`);
  
  // Ricrea la tabella messages con la nuova colonna
  db.run(`CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    telegram_message_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
  
  // Ripristina i dati
  db.run(`INSERT INTO messages (id, message, user_id, sent_at)
          SELECT id, message, user_id, sent_at FROM messages_backup`);
  
  // Elimina la tabella di backup
  db.run(`DROP TABLE messages_backup`);
});

// Chiudi il database
db.close((err) => {
  if (err) {
    console.error('Errore nella chiusura del database:', err);
  } else {
    console.log('Migrazione completata con successo');
  }
});
