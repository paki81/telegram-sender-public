// Load environment variables
require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const cookieParser = require('cookie-parser');

// Configuration
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'telegram_sender_secret_key';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const corsOptions = {
  origin: FRONTEND_URL,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposedHeaders: ['Content-Type'],
  credentials: true,
  optionsSuccessStatus: 200
};

// Assicurati che la cartella uploads esista
const uploadsDir = path.join(__dirname, process.env.UPLOAD_DIR || 'uploads');
if (!fsSync.existsSync(uploadsDir)) {
  fsSync.mkdirSync(uploadsDir, { recursive: true });
  console.log('Cartella uploads creata:', uploadsDir);
}

// Assicurati che la cartella databases esista
const databasesDir = path.join(__dirname, process.env.DATABASES_DIR || 'databases');
if (!fsSync.existsSync(databasesDir)) {
  fsSync.mkdirSync(databasesDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log('Salvataggio file in:', path.join(__dirname, process.env.UPLOAD_DIR || 'uploads'));
    cb(null, path.join(__dirname, process.env.UPLOAD_DIR || 'uploads'));
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const safeFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const finalFileName = `${timestamp}-${safeFileName}`;
    console.log('Nome file generato:', finalFileName);
    cb(null, finalFileName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: process.env.MAX_FILE_SIZE || 50 * 1024 * 1024, // 50MB limite per file
    files: 10 // massimo 10 file per richiesta
  }
});

const app = express();

// Middleware per estrarre il token dai cookie
const extractToken = (req, res, next) => {
  const authCookie = req.cookies?.auth_token;
  const authHeader = req.headers['authorization'];
  
  if (authCookie) {
    req.headers['authorization'] = `Bearer ${authCookie}`;
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    // Mantieni il token dall'header se presente
    req.headers['authorization'] = authHeader;
  }
  
  next();
};

// Middleware di base
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(extractToken);

// Middleware per gestire errori CORS preflight
app.options('*', cors(corsOptions));

// Middleware di gestione errori globale
app.use((err, req, res, next) => {
  console.error('Errore globale:', err);
  
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'JSON non valido' });
  }
  
  res.status(500).json({ 
    error: 'Errore interno del server',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Middleware per logging delle richieste
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Funzione per reinizializzare la tabella messages
const reinitializeMessagesTable = (db) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Elimina la tabella messages se esiste
      db.run('DROP TABLE IF EXISTS messages', (err) => {
        if (err) {
          console.error('Errore nell\'eliminazione della tabella messages:', err);
          reject(err);
          return;
        }

        // Ricrea la tabella messages con la struttura corretta
        db.run(`
          CREATE TABLE messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            config_id INTEGER,
            message TEXT NOT NULL,
            sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'sent',
            telegram_message_id TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (config_id) REFERENCES telegram_configs(id)
          )
        `, (err) => {
          if (err) {
            console.error('Errore nella creazione della tabella messages:', err);
            reject(err);
          } else {
            console.log('Tabella messages reinizializzata con successo');
            resolve();
          }
        });
      });
    });
  });
};

// Funzione per inizializzare tutte le tabelle
const initializeTables = (db) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Abilita foreign keys
      db.run('PRAGMA foreign_keys = ON');

      // Crea la tabella users se non esiste
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          is_admin INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('Errore nella creazione della tabella users:', err);
          reject(err);
          return;
        }
      });

      // Crea la tabella telegram_configs se non esiste
      db.run(`
        CREATE TABLE IF NOT EXISTS telegram_configs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          bot_token TEXT NOT NULL,
          channel_id TEXT NOT NULL,
          description TEXT,
          is_active INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('Errore nella creazione della tabella telegram_configs:', err);
          reject(err);
          return;
        }
      });

      // Crea la tabella user_configs se non esiste
      db.run(`
        CREATE TABLE IF NOT EXISTS user_configs (
          user_id INTEGER,
          config_id INTEGER,
          PRIMARY KEY (user_id, config_id),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (config_id) REFERENCES telegram_configs(id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) {
          console.error('Errore nella creazione della tabella user_configs:', err);
          reject(err);
          return;
        }
      });

      // Crea la tabella attachments se non esiste
      db.run(`
        CREATE TABLE IF NOT EXISTS attachments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          message_id INTEGER NOT NULL,
          filename TEXT NOT NULL,
          original_name TEXT NOT NULL,
          mime_type TEXT,
          size INTEGER,
          telegram_message_id TEXT,
          FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) {
          console.error('Errore nella creazione della tabella attachments:', err);
          reject(err);
          return;
        }
      });

      resolve();
    });
  });
};

// Funzione per creare l'utente admin
const createAdminUser = (db) => {
  return new Promise(async (resolve, reject) => {
    try {
      const adminPassword = 'admin';
      const hash = await bcrypt.hash(adminPassword, 10);
      
      db.run(`
        INSERT OR IGNORE INTO users (username, password, is_admin)
        VALUES (?, ?, 1)
      `, ['admin', hash], (err) => {
        if (err) {
          console.error('Errore nella creazione dell\'utente admin:', err);
          reject(err);
        } else {
          console.log('Utente admin creato con successo');
          resolve();
        }
      });
    } catch (error) {
      console.error('Errore nella creazione dell\'utente admin:', error);
      reject(error);
    }
  });
};

// Funzione per inizializzare il database
const initializeDatabase = () => {
  return new Promise((resolve, reject) => {
    console.log('Inizializzazione database...');
    const dbPath = path.join(__dirname, process.env.DB_PATH || 'database.db');
    console.log('Percorso database:', dbPath);
    
    // Assicurati che la directory esista
    const dbDir = path.dirname(dbPath);
    if (!fsSync.existsSync(dbDir)) {
      fsSync.mkdirSync(dbDir, { recursive: true });
    }
    
    const db = new sqlite3.Database(dbPath, async (err) => {
      if (err) {
        console.error('Errore nella connessione al database:', err);
        reject(err);
        return;
      }
      console.log('Connesso al database SQLite');

      try {
        await initializeTables(db);
        await reinitializeMessagesTable(db);
        await createAdminUser(db);
        console.log('Database inizializzato con successo');
        resolve(db);
      } catch (error) {
        console.error('Errore nell\'inizializzazione del database:', error);
        reject(error);
      }
    });
  });
};

// Inizializza il database e lo rende disponibile globalmente
let db;
// Mappa per tenere traccia delle connessioni ai database
const databaseConnections = new Map();

initializeDatabase()
  .then((database) => {
    db = database;
    console.log('Database inizializzato con successo');
  })
  .catch((error) => {
    console.error('Errore nell\'inizializzazione del database:', error);
    process.exit(1);
  });

let bot = null;

// Funzione per ottenere o creare una connessione al database
function getDatabaseConnection(configId) {
  if (!configId) {
    return db; // Database principale per utenti e configurazioni
  }

  if (databaseConnections.has(configId)) {
    return databaseConnections.get(configId);
  }

  const dbPath = path.join(databasesDir, `config_${configId}.db`);
  const newDb = new sqlite3.Database(dbPath);

  // Inizializza il database dei messaggi
  newDb.serialize(() => {
    newDb.run(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message TEXT,
      sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Tabella utenti specifica per questa configurazione
    newDb.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      is_admin INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
  });

  databaseConnections.set(configId, newDb);
  return newDb;
}

// Funzione per creare un nuovo database per una configurazione
async function createConfigDatabase(configId) {
  const dbPath = path.join(databasesDir, `config_${configId}.db`);
  
  return new Promise((resolve, reject) => {
    const newDb = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }

      newDb.serialize(() => {
        newDb.run(`CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          message TEXT,
          sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        newDb.run(`CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE,
          password TEXT,
          is_admin INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    });
  });
}

// Funzione per eliminare il database di una configurazione
async function deleteConfigDatabase(configId) {
  const dbPath = path.join(databasesDir, `config_${configId}.db`);
  
  // Chiudi la connessione se esiste
  if (databaseConnections.has(configId)) {
    const db = databaseConnections.get(configId);
    db.close();
    databaseConnections.delete(configId);
  }

  // Elimina il file del database
  return new Promise((resolve, reject) => {
    fsSync.unlink(dbPath, (err) => {
      if (err && err.code !== 'ENOENT') {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

// Middleware di autenticazione
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token mancante' });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      console.error('Errore di verifica token:', err);
      return res.status(403).json({ error: 'Token non valido' });
    }
    req.user = user;
    next();
  });
};

// Middleware per verificare se l'utente è admin
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Accesso negato' });
  }
  next();
};

// Login route
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  console.log('Tentativo di login per username:', username);
  
  try {
    if (!username || !password) {
      return res.status(400).json({ error: 'Username e password sono richiesti' });
    }

    // Verifica che il database sia inizializzato
    if (!db) {
      console.error('Database non inizializzato');
      return res.status(500).json({ error: 'Database non inizializzato' });
    }

    // Recupera l'utente e la sua configurazione
    const user = await new Promise((resolve, reject) => {
      const query = `
        SELECT 
          u.*,
          tc.id as config_id,
          tc.bot_token,
          tc.channel_id,
          tc.description,
          tc.is_active
        FROM users u
        LEFT JOIN user_configs uc ON u.id = uc.user_id
        LEFT JOIN telegram_configs tc ON uc.config_id = tc.id
        WHERE u.username = ?`;
      
      db.get(query, [username], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    const config = user.config_id ? {
      id: user.config_id,
      bot_token: user.bot_token,
      channel_id: user.channel_id,
      description: user.description,
      is_active: user.is_active === 1
    } : null;

    const tokenData = { 
      userId: user.id, 
      username: user.username,
      isAdmin: user.is_admin === 1,
      config: config
    };

    const token = jwt.sign(tokenData, SECRET_KEY, { expiresIn: '24h' });
    
    // Imposta il cookie httpOnly
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 ore
    });

    res.json({ token, user: { username: user.username, isAdmin: user.is_admin === 1 } });
  } catch (error) {
    console.error('Errore dettagliato nel login:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
});

// Proteggi tutte le rotte API tranne login
app.use('/api/*', (req, res, next) => {
  if (req.path === '/api/login') {
    return next();
  }
  authenticateToken(req, res, next);
});

// Modifica l'endpoint per recuperare gli utenti includendo le configurazioni associate
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.username === 'admin') {
      // L'admin vede tutti gli utenti con le loro configurazioni
      const users = await new Promise((resolve, reject) => {
        db.all(`
          SELECT 
            u.id, 
            u.username, 
            u.is_admin,
            tc.id as config_id,
            tc.description as config_description,
            tc.channel_id as config_channel_id
          FROM users u
          LEFT JOIN user_configs uc ON u.id = uc.user_id
          LEFT JOIN telegram_configs tc ON uc.config_id = tc.id
        `, (err, rows) => {
          if (err) reject(err);
          else {
            // Raggruppa i risultati per utente
            const usersMap = rows.reduce((acc, row) => {
              if (!acc[row.id]) {
                acc[row.id] = {
                  id: row.id,
                  username: row.username,
                  is_admin: row.is_admin,
                  config: row.config_id ? {
                    id: row.config_id,
                    description: row.config_description || row.config_channel_id
                  } : null
                };
              }
              return acc;
            }, {});
            resolve(Object.values(usersMap));
          }
        });
      });
      res.json(users);
    } else {
      // Gli utenti normali vedono solo username e id
      const users = await new Promise((resolve, reject) => {
        db.all('SELECT id, username, is_admin FROM users', (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      res.json(users);
    }
  } catch (error) {
    console.error('Errore nel recuperare gli utenti:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
});

// Funzione per convertire HTML in formato Telegram
function convertHtmlToTelegramFormat(html) {
  // Rimuovi eventuali tag script
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Sostituisci i tag HTML con la formattazione Telegram
  let text = html
    // Gestisci prima i tag annidati
    .replace(/<strong><em>(.*?)<\/em><\/strong>|<em><strong>(.*?)<\/strong><\/em>/g, '*_$1$2_*')
    // Poi gestisci i tag singoli
    .replace(/<strong>(.*?)<\/strong>|<b>(.*?)<\/b>/g, '*$1$2*')
    .replace(/<em>(.*?)<\/em>|<i>(.*?)<\/i>/g, '_$1$2_')
    .replace(/<code>(.*?)<\/code>/g, '`$1`')
    .replace(/<pre>(.*?)<\/pre>/g, '```$1```')
    // Liste
    .replace(/<ul>\s*([\s\S]*?)<\/ul>/g, (match, content) => {
      return content.split(/<li>/).filter(Boolean).map(item => 
        '• ' + item.replace(/<\/li>/, '').trim()
      ).join('\n\n');
    })
    .replace(/<ol>\s*([\s\S]*?)<\/ol>/g, (match, content) => {
      let counter = 1;
      return content.split(/<li>/).filter(Boolean).map(item => 
        (counter++) + '. ' + item.replace(/<\/li>/, '').trim()
      ).join('\n\n');
    })
    // Paragrafi e line breaks
    .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
    .replace(/<br\s*\/?>/g, '\n')
    // Rimuovi tutti gli altri tag HTML
    .replace(/<[^>]+>/g, '');

  // Decodifica le entità HTML
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Rimuovi gli spazi multipli e le linee vuote multiple mantenendo gli a capo
  text = text
    .replace(/[ \t]+/g, ' ')  // Rimuovi spazi multipli
    .replace(/\n{3,}/g, '\n\n')  // Riduci più di 2 newline a 2
    .split('\n').map(line => line.trim()).join('\n')  // Trim ogni riga
    .trim();

  return text;
}

// Funzione per inviare messaggi su Telegram
async function sendTelegramMessage(message, isSilent, files, config) {
  console.log('Invio messaggio su Telegram:', { message, isSilent, files: files?.length });

  if (!config) {
    throw new Error('Configurazione Telegram non fornita');
  }

  const bot = new TelegramBot(config.bot_token, { polling: false });
  let mainMessageId = null;
  const fileMessageIds = [];

  // Invia prima il messaggio di testo
  if (message && message.trim() !== '') {
    // Converti il messaggio HTML in formato Telegram
    const formattedMessage = convertHtmlToTelegramFormat(message);
    console.log('Messaggio formattato:', formattedMessage);
    
    const result = await bot.sendMessage(config.channel_id, formattedMessage, {
      disable_notification: isSilent,
      parse_mode: 'Markdown'
    });
    mainMessageId = result.message_id;
    console.log('Messaggio di testo inviato:', result.message_id);
  }

  // Invia gli allegati
  if (files && files.length > 0) {
    for (const file of files) {
      try {
        console.log('Invio file:', file.filename);
        const filePath = path.join(__dirname, 'uploads', file.filename);
        
        const result = await bot.sendDocument(config.channel_id, filePath, {
          disable_notification: isSilent,
          caption: file.originalname
        });
        
        fileMessageIds.push({
          filename: file.filename,
          messageId: result.message_id
        });
        
        console.log('File inviato:', {
          filename: file.filename,
          messageId: result.message_id
        });
      } catch (error) {
        console.error('Errore nell\'invio del file:', error);
        throw error;
      }
    }
  }

  return {
    mainMessageId,
    fileMessageIds
  };
}

// Endpoint per l'invio dei messaggi
app.post('/api/messages', authenticateToken, upload.array('attachments'), async (req, res) => {
  console.log('Ricevuta richiesta POST /api/messages');
  console.log('Body:', req.body);
  console.log('Files:', req.files);

  const { message, silent } = req.body;
  const files = req.files || [];

  try {
    // Ottieni la configurazione associata all'utente
    const userConfig = await new Promise((resolve, reject) => {
      db.get(
        `SELECT tc.* 
         FROM telegram_configs tc 
         JOIN user_configs uc ON uc.config_id = tc.id 
         WHERE uc.user_id = ? AND tc.is_active = 1`,
        [req.user.userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!userConfig) {
      return res.status(400).json({ error: 'Nessuna configurazione Telegram attiva associata all\'utente' });
    }

    // Salva il messaggio nel database con il config_id corretto
    const messageId = await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO messages (user_id, config_id, message, status) VALUES (?, ?, ?, ?)',
        [req.user.userId, userConfig.id, message, 'pending'],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    console.log('Messaggio salvato con ID:', messageId);

    // Salva gli allegati nel database
    for (const file of files) {
      try {
        console.log('Salvataggio allegato nel database:', {
          filename: file.filename,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size
        });

        await new Promise((resolve, reject) => {
          db.run(
            'INSERT INTO attachments (message_id, filename, original_name, mime_type, size) VALUES (?, ?, ?, ?, ?)',
            [messageId, file.filename, file.originalname, file.mimetype, file.size],
            (err) => {
              if (err) {
                console.error('Errore nel salvataggio dell\'allegato nel database:', err);
                reject(err);
              } else {
                resolve();
              }
            }
          );
        });
      } catch (error) {
        console.error('Errore nel salvataggio dell\'allegato:', error);
      }
    }

    // Invia il messaggio su Telegram
    try {
      const result = await sendTelegramMessage(message, silent === 'true', files, userConfig);
      console.log('Risultato invio Telegram:', result);

      // Aggiorna il messaggio principale con l'ID Telegram
      if (result.mainMessageId) {
        await new Promise((resolve, reject) => {
          db.run(
            'UPDATE messages SET status = ?, telegram_message_id = ? WHERE id = ?',
            ['sent', result.mainMessageId, messageId],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      // Aggiorna gli allegati con gli ID dei messaggi Telegram
      for (const fileMessage of result.fileMessageIds) {
        await new Promise((resolve, reject) => {
          db.run(
            'UPDATE attachments SET telegram_message_id = ? WHERE message_id = ? AND filename = ?',
            [fileMessage.messageId, messageId, fileMessage.filename],
            (err) => {
              if (err) {
                console.error('Errore nell\'aggiornamento dell\'ID Telegram dell\'allegato:', err);
                reject(err);
              } else {
                console.log('Aggiornato ID Telegram per allegato:', fileMessage);
                resolve();
              }
            }
          );
        });
      }

      res.json({ 
        success: true, 
        messageId, 
        mainMessageId: result.mainMessageId,
        fileMessageIds: result.fileMessageIds
      });
    } catch (error) {
      console.error('Errore nell\'invio su Telegram:', error);
      
      // Aggiorna lo stato del messaggio in caso di errore
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE messages SET status = ? WHERE id = ?',
          ['error', messageId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      throw error;
    }
  } catch (error) {
    console.error('Errore completo:', error);
    res.status(500).json({ error: error.message || 'Errore nell\'invio del messaggio' });
  }
});

app.get('/api/messages', authenticateToken, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const offset = (page - 1) * limit;
  const userId = req.user.userId;
  const isAdmin = req.user.isAdmin;

  try {
    // Query base per contare il totale dei messaggi
    let countQuery = 'SELECT COUNT(*) as total FROM messages';
    let countParams = [];

    // Query base per selezionare i messaggi
    let selectQuery = `
      SELECT m.*,
             u.username as sender_username,
             tc.channel_id,
             tc.description as channel_description,
             GROUP_CONCAT(json_object(
               'id', a.id,
               'filename', a.filename,
               'originalName', a.original_name,
               'mimeType', a.mime_type,
               'size', a.size
             )) as attachments_json
      FROM messages m
      LEFT JOIN users u ON m.user_id = u.id
      LEFT JOIN telegram_configs tc ON m.config_id = tc.id
      LEFT JOIN attachments a ON m.id = a.message_id`;

    // Se non è admin, filtra solo i messaggi dell'utente
    if (!isAdmin) {
      countQuery += ' WHERE user_id = ?';
      selectQuery += ' WHERE m.user_id = ?';
      countParams.push(userId);
    }

    // Raggruppa per message_id per gestire gli allegati multipli
    selectQuery += ' GROUP BY m.id';
    
    // Ordina e limita i risultati
    selectQuery += ' ORDER BY m.sent_at DESC LIMIT ? OFFSET ?';

    // Ottieni il conteggio totale
    const totalResult = await new Promise((resolve, reject) => {
      db.get(countQuery, countParams, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    // Calcola i parametri per la query dei messaggi
    const queryParams = isAdmin ? [limit, offset] : [userId, limit, offset];

    // Ottieni i messaggi
    const messages = await new Promise((resolve, reject) => {
      db.all(selectQuery, queryParams, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Processa i risultati
    const processedMessages = messages.map(msg => ({
      ...msg,
      attachments: msg.attachments_json ? JSON.parse(`[${msg.attachments_json}]`) : [],
      sender: {
        username: msg.sender_username
      },
      channel: {
        id: msg.channel_id,
        description: msg.channel_description
      }
    }));

    delete processedMessages.attachments_json;
    delete processedMessages.sender_username;
    delete processedMessages.channel_id;
    delete processedMessages.channel_description;

    const totalPages = Math.ceil(totalResult.total / limit);

    res.json({
      messages: processedMessages,
      total: totalResult.total,
      totalPages,
      currentPage: page
    });
  } catch (error) {
    console.error('Errore nel recupero dei messaggi:', error);
    res.status(500).json({ error: 'Errore nel recupero dei messaggi' });
  }
});

app.get('/api/attachments/:filename', authenticateToken, async (req, res) => {
  console.log('Richiesta download allegato:', req.params.filename);
  
  try {
    // Verifica se il file esiste nel database
    const attachment = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM attachments WHERE filename = ?',
        [req.params.filename],
        (err, row) => {
          if (err) reject(err);
          else {
            console.log('Allegato trovato nel database:', row);
            resolve(row);
          }
        }
      );
    });

    if (!attachment) {
      console.log('Allegato non trovato nel database:', req.params.filename);
      return res.status(404).json({ error: 'Allegato non trovato' });
    }

    const filePath = path.join(__dirname, 'uploads', req.params.filename);
    console.log('Tentativo di accesso al file:', filePath);

    try {
      await fs.access(filePath);
      console.log('File trovato:', filePath);
      
      res.setHeader('Content-Type', attachment.mime_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${attachment.original_name}"`);
      
      const fileStream = fsSync.createReadStream(filePath);
      fileStream.pipe(res);
      
      fileStream.on('error', (error) => {
        console.error('Errore durante lo streaming del file:', error);
        res.status(500).json({ error: 'Errore durante l\'invio del file' });
      });
    } catch (error) {
      console.error('Errore accesso al file:', error);
      if (error.code !== 'ENOENT') {
        res.status(500).json({ error: 'Errore nel recupero del file' });
      } else {
        res.status(404).json({ error: 'File non trovato' });
      }
    }
  } catch (error) {
    console.error('Errore nel recupero dell\'allegato:', error);
    res.status(500).json({ error: 'Errore nel recupero dell\'allegato' });
  }
});

// Funzione per eliminare un messaggio da Telegram
const deleteTelegramMessage = async (bot_token, chat_id, message_id) => {
  try {
    const bot = new TelegramBot(bot_token, { polling: false });
    await bot.deleteMessage(chat_id, message_id);
    return true;
  } catch (error) {
    console.error('Errore nell\'eliminazione del messaggio da Telegram:', error);
    return false;
  }
};

app.delete('/api/messages/:id', authenticateToken, async (req, res) => {
  const messageId = req.params.id;
  const userId = req.user.userId;
  const isAdmin = req.user.isAdmin;

  try {
    // Recupera le informazioni del messaggio e della configurazione
    const messageInfo = await new Promise((resolve, reject) => {
      db.get(
        `SELECT m.*, tc.bot_token, tc.channel_id, tc.description, m.telegram_message_id
         FROM messages m
         LEFT JOIN telegram_configs tc ON m.config_id = tc.id
         WHERE m.id = ?`,
        [messageId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!messageInfo) {
      return res.status(404).json({ error: 'Messaggio non trovato' });
    }

    // Verifica i permessi
    if (!isAdmin && messageInfo.user_id !== userId) {
      return res.status(403).json({ error: 'Non autorizzato' });
    }

    // Se il messaggio ha un ID Telegram e una configurazione valida, prova a eliminarlo da Telegram
    if (messageInfo.telegram_message_id && messageInfo.bot_token && messageInfo.channel_id) {
      await deleteTelegramMessage(
        messageInfo.bot_token,
        messageInfo.channel_id,
        messageInfo.telegram_message_id
      );
    }

    // Elimina gli allegati
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM attachments WHERE message_id = ?', [messageId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Elimina il messaggio dal database
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM messages WHERE id = ?', [messageId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Errore nell\'eliminazione del messaggio:', error);
    res.status(500).json({ error: 'Errore nell\'eliminazione del messaggio' });
  }
});

// Modifica anche l'endpoint per eliminare tutti i messaggi
app.delete('/api/messages', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const isAdmin = req.user.isAdmin;

  try {
    // Recupera tutti i messaggi da eliminare con le loro configurazioni
    const messages = await new Promise((resolve, reject) => {
      const query = isAdmin
        ? `SELECT m.*, tc.bot_token, tc.channel_id 
           FROM messages m
           LEFT JOIN telegram_configs tc ON m.config_id = tc.id`
        : `SELECT m.*, tc.bot_token, tc.channel_id 
           FROM messages m
           LEFT JOIN telegram_configs tc ON m.config_id = tc.id
           WHERE m.user_id = ?`;
      
      db.all(query, isAdmin ? [] : [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Elimina ogni messaggio da Telegram
    for (const message of messages) {
      if (message.telegram_message_id && message.bot_token && message.channel_id) {
        await deleteTelegramMessage(
          message.bot_token,
          message.channel_id,
          message.telegram_message_id
        );
      }
    }

    // Elimina tutti gli allegati
    await new Promise((resolve, reject) => {
      const query = isAdmin
        ? 'DELETE FROM attachments'
        : 'DELETE FROM attachments WHERE message_id IN (SELECT id FROM messages WHERE user_id = ?)';
      
      db.run(query, isAdmin ? [] : [userId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Elimina tutti i messaggi
    await new Promise((resolve, reject) => {
      const query = isAdmin
        ? 'DELETE FROM messages'
        : 'DELETE FROM messages WHERE user_id = ?';
      
      db.run(query, isAdmin ? [] : [userId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Errore nell\'eliminazione dei messaggi:', error);
    res.status(500).json({ error: 'Errore nell\'eliminazione dei messaggi' });
  }
});

app.get('/api/telegram-configs', authenticateToken, async (req, res) => {
  try {
    const isAdmin = req.user.isAdmin;
    const query = isAdmin
      ? `SELECT 
          id,
          bot_token,
          description,
          channel_id,
          is_active,
          created_at,
          CASE 
            WHEN description IS NOT NULL AND description != '' 
            THEN description 
            ELSE channel_id 
          END as display_name
        FROM telegram_configs 
        ORDER BY created_at DESC`
      : `SELECT 
          id,
          description,
          channel_id,
          is_active,
          created_at,
          CASE 
            WHEN description IS NOT NULL AND description != '' 
            THEN description 
            ELSE channel_id 
          END as display_name
        FROM telegram_configs 
        ORDER BY created_at DESC`;

    const configs = await new Promise((resolve, reject) => {
      db.all(query, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json(configs);
  } catch (error) {
    console.error('Errore nel recupero delle configurazioni:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
});

app.post('/api/messages', authenticateToken, upload.array('attachments'), async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Ottieni la configurazione associata all'utente
    const userConfig = await new Promise((resolve, reject) => {
      db.get(
        `SELECT tc.* 
         FROM telegram_configs tc 
         JOIN user_configs uc ON uc.config_id = tc.id 
         WHERE uc.user_id = ? AND tc.is_active = 1`,
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!userConfig) {
      return res.status(400).json({ error: 'Nessuna configurazione Telegram attiva associata all\'utente' });
    }

    const { message, silent = false } = req.body;
    const files = req.files || [];

    // Salva il messaggio nel database con il config_id corretto
    const messageId = await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO messages (user_id, config_id, message, status) VALUES (?, ?, ?, ?)',
        [userId, userConfig.id, message, 'pending'],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    // Salva gli allegati nel database
    for (const file of files) {
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO attachments (message_id, filename, original_name, mime_type, size) VALUES (?, ?, ?, ?, ?)',
          [messageId, file.filename, file.originalname, file.mimetype, file.size],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    // Invia il messaggio su Telegram usando la configurazione dell'utente
    try {
      const result = await sendTelegramMessage(message, silent === 'true', files, userConfig);
      
      // Aggiorna il messaggio principale con l'ID Telegram
      if (result.mainMessageId) {
        await new Promise((resolve, reject) => {
          db.run(
            'UPDATE messages SET status = ?, sent_at = CURRENT_TIMESTAMP, telegram_message_id = ? WHERE id = ?',
            ['sent', result.mainMessageId, messageId],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      // Aggiorna gli allegati con gli ID dei messaggi Telegram
      for (const fileMessage of result.fileMessageIds) {
        await new Promise((resolve, reject) => {
          db.run(
            'UPDATE attachments SET telegram_message_id = ? WHERE message_id = ? AND filename = ?',
            [fileMessage.messageId, messageId, fileMessage.filename],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      res.json({
        success: true,
        messageId: messageId,
        mainMessageId: result.mainMessageId,
        fileMessageIds: result.fileMessageIds || []
      });
    } catch (error) {
      // In caso di errore nell'invio, aggiorna lo stato del messaggio
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE messages SET status = ?, error = ? WHERE id = ?',
          ['failed', error.message, messageId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      throw error;
    }
  } catch (error) {
    console.error('Errore completo:', error);
    res.status(500).json({ error: error.message || 'Errore nell\'invio del messaggio' });
  }
});

app.get('/api/users/:userId/configs', authenticateToken, requireAdmin, async (req, res) => {
  const userId = req.params.userId;
  
  try {
    const configs = await new Promise((resolve, reject) => {
      db.all(
        `SELECT tc.*, uc.user_id IS NOT NULL as is_assigned
         FROM telegram_configs tc
         LEFT JOIN user_configs uc ON tc.id = uc.config_id AND uc.user_id = ?
         WHERE tc.is_active = 1`,
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
    
    res.json(configs);
  } catch (error) {
    console.error('Errore:', error);
    res.status(500).json({ error: 'Errore nel recuperare le configurazioni' });
  }
});

app.post('/api/users/:userId/configs', authenticateToken, requireAdmin, async (req, res) => {
  const userId = req.params.userId;
  const { configIds } = req.body;
  
  try {
    // Rimuovi tutte le configurazioni esistenti dell'utente
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM user_configs WHERE user_id = ?', [userId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Aggiungi le nuove configurazioni
    for (const configId of configIds) {
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO user_configs (user_id, config_id) VALUES (?, ?)',
          [userId, configId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Errore:', error);
    res.status(500).json({ error: 'Errore nell\'aggiornare le configurazioni' });
  }
});

app.patch('/api/telegram-configs/:id/toggle', authenticateToken, requireAdmin, async (req, res) => {
  const configId = req.params.id;
  
  try {
    // Non c'è più bisogno di disattivare le altre configurazioni
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE telegram_configs SET is_active = NOT is_active WHERE id = ?',
        [configId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Errore:', error);
    res.status(500).json({ error: 'Errore nell\'attivare/disattivare la configurazione' });
  }
});

app.post('/api/users', authenticateToken, requireAdmin, bodyParser.json(), async (req, res) => {
  console.log('Richiesta POST /api/users ricevuta:', req.body);
  
  const { username, password, configId } = req.body;
  
  if (!username || !password || !configId) {
    return res.status(400).json({ error: 'Username, password e configurazione sono richiesti' });
  }

  try {
    // Verifica che la configurazione esista
    const config = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM telegram_configs WHERE id = ?', [configId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!config) {
      return res.status(400).json({ error: 'Configurazione non valida' });
    }

    // Verifica che l'username non sia già in uso
    const existingUser = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username già in uso' });
    }

    // Hash della password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Inserisci il nuovo utente
    const userId = await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO users (username, password, is_admin) VALUES (?, ?, 0)',
        [username, hashedPassword],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    // Associa l'utente alla configurazione
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO user_configs (user_id, config_id) VALUES (?, ?)',
        [userId, configId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ id: userId, username, message: 'Utente creato con successo' });
  } catch (error) {
    console.error('Errore nella creazione dell\'utente:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
});

app.post('/api/update-password', authenticateToken, bodyParser.json(), async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.userId;

  try {
    // Verify current password
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Password attuale non corretta' });
    }

    // Update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedPassword, userId],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ success: true, message: 'Password aggiornata con successo' });
  } catch (error) {
    console.error('Errore nell\'aggiornamento della password:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.username === 'admin') {
      // L'admin vede tutti gli utenti con le loro configurazioni
      const users = await new Promise((resolve, reject) => {
        db.all(`
          SELECT 
            u.id,
            u.username,
            u.is_admin,
            tc.id as config_id,
            tc.channel_id,
            tc.description,
            CASE 
              WHEN tc.description IS NOT NULL AND tc.description != '' 
              THEN tc.description 
              ELSE tc.channel_id 
            END as display_name
          FROM users u
          LEFT JOIN user_configs uc ON u.id = uc.user_id
          LEFT JOIN telegram_configs tc ON uc.config_id = tc.id
          ORDER BY u.id DESC
        `, [], (err, rows) => {
          if (err) {
            console.error('Errore nel recupero degli utenti:', err);
            reject(err);
            return;
          }

          // Log per debug
          console.log('Rows from database:', rows);

          const formattedUsers = rows.map(row => {
            const formattedUser = {
              id: row.id,
              username: row.username,
              is_admin: row.is_admin === 1,
              config: row.config_id ? {
                id: row.config_id,
                channel_id: row.channel_id,
                description: row.description,
                display_name: row.display_name
              } : null
            };

            // Log per debug
            console.log('Formatted user:', formattedUser);
            return formattedUser;
          });

          resolve(formattedUsers);
        });
      });
      res.json(users);
    } else {
      // Gli utenti normali vedono solo username e id
      const users = await new Promise((resolve, reject) => {
        db.all('SELECT id, username, is_admin FROM users', (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      res.json(users);
    }
  } catch (error) {
    console.error('Errore nel recuperare gli utenti:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
});

app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { configId } = req.query;

  try {
    const targetDb = configId ? getDatabaseConnection(configId) : db;

    const result = await new Promise((resolve, reject) => {
      targetDb.run('DELETE FROM users WHERE id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });

    if (result === 0) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    // Elimina l'associazione utente-configurazione
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM user_configs WHERE user_id = ?', [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ message: 'Utente eliminato con successo' });
  } catch (error) {
    console.error('Errore nell\'eliminazione dell\'utente:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
});

app.post('/api/send-message', authenticateToken, async (req, res) => {
  const { message } = req.body;

  try {
    // Recupera la configurazione attiva
    const activeConfig = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM telegram_configs WHERE is_active = 1', (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!activeConfig) {
      return res.status(400).json({ error: 'Nessuna configurazione Telegram attiva' });
    }

    // Sanitize the bot token by removing any whitespace
    const sanitizedToken = activeConfig.bot_token.replace(/\s/g, '');
    
    // Crea una nuova istanza del bot con il token della configurazione attiva
    const bot = new TelegramBot(sanitizedToken, { polling: false });

    // Invia il messaggio usando il channel ID della configurazione attiva
    await bot.sendMessage(activeConfig.channel_id, message);

    // Salva il messaggio nel database della configurazione attiva
    const configDb = getDatabaseConnection(activeConfig.id);
    await new Promise((resolve, reject) => {
      configDb.run('INSERT INTO messages (message) VALUES (?)', [message], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Errore nell\'invio del messaggio:', error);
    res.status(500).json({ error: 'Errore nell\'invio del messaggio: ' + error.message });
  }
});

app.get('/api/config', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const isAdmin = req.user.isAdmin;

  try {
    // Per gli utenti normali, restituisci solo la loro configurazione
    if (!isAdmin) {
      const userConfig = await new Promise((resolve, reject) => {
        db.get(
          `SELECT tc.* 
           FROM telegram_configs tc 
           JOIN user_configs uc ON uc.config_id = tc.id 
           WHERE uc.user_id = ? AND tc.is_active = 1`,
          [userId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!userConfig) {
        return res.status(404).json({ error: 'Nessuna configurazione attiva trovata per questo utente' });
      }

      return res.json(userConfig);
    }

    // Per gli admin, restituisci la prima configurazione attiva
    const adminConfig = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM telegram_configs WHERE is_active = 1 ORDER BY id ASC LIMIT 1',
        [],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!adminConfig) {
      return res.status(404).json({ error: 'Nessuna configurazione attiva trovata' });
    }

    res.json(adminConfig);
  } catch (error) {
    console.error('Errore nel recuperare la configurazione:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

app.delete('/api/messages/:id', authenticateToken, async (req, res) => {
  const messageId = req.params.id;

  try {
    // Recupera il messaggio e la configurazione attiva
    const [message, activeConfig] = await Promise.all([
      new Promise((resolve, reject) => {
        db.get('SELECT telegram_message_id FROM messages WHERE id = ?', [messageId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      }),
      new Promise((resolve, reject) => {
        db.get('SELECT * FROM telegram_configs WHERE is_active = 1', (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      })
    ]);

    if (!message) {
      return res.status(404).json({ error: 'Messaggio non trovato' });
    }

    console.log('Allegati da eliminare:', attachments);

    // Se c'è una configurazione attiva e un ID Telegram, prova a eliminare il messaggio da Telegram
    if (activeConfig && message.telegram_message_id) {
      try {
        const bot = new TelegramBot(activeConfig.bot_token, { polling: false });
        await bot.deleteMessage(activeConfig.channel_id, message.telegram_message_id);
      } catch (error) {
        console.error('Errore nell\'eliminazione del messaggio Telegram:', error);
      }
    }

    // Elimina il messaggio dal database
    await Promise.all([
      new Promise((resolve, reject) => {
        db.run('DELETE FROM attachments WHERE message_id = ?', [messageId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      }),
      new Promise((resolve, reject) => {
        db.run('DELETE FROM messages WHERE id = ?', [messageId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      })
    ]);

    res.json({ success: true });
  } catch (error) {
    console.error('Errore nell\'eliminazione del messaggio:', error);
    res.status(500).json({ error: 'Errore nell\'eliminazione del messaggio' });
  }
});

app.delete('/api/messages', authenticateToken, async (req, res) => {
  console.log('Richiesta DELETE /api/messages ricevuta');
  
  try {
    // Recupera la configurazione attiva
    const activeConfig = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM telegram_configs WHERE is_active = 1', (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!activeConfig) {
      return res.status(400).json({ error: 'Nessuna configurazione Telegram attiva' });
    }

    // Sanitize the bot token by removing any whitespace
    const sanitizedToken = activeConfig.bot_token.replace(/\s/g, '');
    
    // Recupera tutti i messaggi con i loro ID Telegram
    const messages = await new Promise((resolve, reject) => {
      db.all('SELECT id, telegram_message_id FROM messages', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Recupera tutti gli allegati
    const attachments = await new Promise((resolve, reject) => {
      db.all('SELECT message_id, filename, telegram_message_id FROM attachments', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Crea il bot Telegram con il token sanitizzato
    const bot = new TelegramBot(sanitizedToken, { polling: false });

    // Elimina i messaggi da Telegram
    for (const message of messages) {
      if (message.telegram_message_id) {
        try {
          // Converti telegram_message_id in numero
          const messageId = parseInt(message.telegram_message_id);
          if (!isNaN(messageId)) {
            await bot.deleteMessage(activeConfig.channel_id, messageId);
          }
        } catch (error) {
          console.error(`Errore nell'eliminazione del messaggio Telegram ${message.telegram_message_id}:`, error);
        }
      }
    }

    // Elimina i messaggi degli allegati da Telegram
    for (const attachment of attachments) {
      if (attachment.telegram_message_id) {
        try {
          // Converti telegram_message_id in numero
          const messageId = parseInt(attachment.telegram_message_id);
          if (!isNaN(messageId)) {
            await bot.deleteMessage(activeConfig.channel_id, messageId);
          }
        } catch (error) {
          console.error(`Errore nell'eliminazione dell'allegato Telegram ${attachment.telegram_message_id}:`, error);
        }
      }
    }

    // Elimina i file degli allegati
    for (const attachment of attachments) {
      try {
        const filePath = path.join(uploadsDir, attachment.filename);
        await fs.unlink(filePath);
        console.log('File eliminato:', filePath);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.error(`Errore nell'eliminazione del file ${attachment.filename}:`, error);
        }
      }
    }

    // Elimina tutti i record dal database
    await Promise.all([
      new Promise((resolve, reject) => {
        db.run('DELETE FROM attachments', (err) => {
          if (err) reject(err);
          else resolve();
        });
      }),
      new Promise((resolve, reject) => {
        db.run('DELETE FROM messages', (err) => {
          if (err) reject(err);
          else resolve();
        });
      })
    ]);

    res.json({ success: true });
  } catch (error) {
    console.error('Errore nell\'eliminazione di tutti i messaggi:', error);
    res.status(500).json({ error: 'Errore nell\'eliminazione di tutti i messaggi' });
  }
});

app.get('/api/telegram-configs', authenticateToken, async (req, res) => {
  try {
    const configs = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          id,
          description,
          channel_id,
          CASE 
            WHEN description IS NOT NULL AND description != '' 
            THEN description 
            ELSE channel_id 
          END as display_name
        FROM telegram_configs 
        ORDER BY created_at DESC
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json(configs);
  } catch (error) {
    console.error('Errore nel recupero delle configurazioni:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
});

app.post('/api/messages', authenticateToken, upload.array('attachments'), async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Ottieni la configurazione associata all'utente
    const userConfig = await new Promise((resolve, reject) => {
      db.get(
        `SELECT tc.* 
         FROM telegram_configs tc 
         JOIN user_configs uc ON uc.config_id = tc.id 
         WHERE uc.user_id = ? AND tc.is_active = 1`,
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!userConfig) {
      return res.status(400).json({ error: 'Nessuna configurazione Telegram attiva associata all\'utente' });
    }

    const { message, silent = false } = req.body;
    const files = req.files || [];

    // Salva il messaggio nel database con il config_id corretto
    const messageId = await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO messages (user_id, config_id, message, status) VALUES (?, ?, ?, ?)',
        [userId, userConfig.id, message, 'pending'],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    // Salva gli allegati nel database
    for (const file of files) {
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO attachments (message_id, filename, original_name, mime_type, size) VALUES (?, ?, ?, ?, ?)',
          [messageId, file.filename, file.originalname, file.mimetype, file.size],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    // Invia il messaggio su Telegram usando la configurazione dell'utente
    try {
      const result = await sendTelegramMessage(message, silent === 'true', files, userConfig);
      
      // Aggiorna il messaggio principale con l'ID Telegram
      if (result.mainMessageId) {
        await new Promise((resolve, reject) => {
          db.run(
            'UPDATE messages SET status = ?, sent_at = CURRENT_TIMESTAMP, telegram_message_id = ? WHERE id = ?',
            ['sent', result.mainMessageId, messageId],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      // Aggiorna gli allegati con gli ID dei messaggi Telegram
      for (const fileMessage of result.fileMessageIds) {
        await new Promise((resolve, reject) => {
          db.run(
            'UPDATE attachments SET telegram_message_id = ? WHERE message_id = ? AND filename = ?',
            [fileMessage.messageId, messageId, fileMessage.filename],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      res.json({
        success: true,
        messageId: messageId,
        mainMessageId: result.mainMessageId,
        fileMessageIds: result.fileMessageIds || []
      });
    } catch (error) {
      // In caso di errore nell'invio, aggiorna lo stato del messaggio
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE messages SET status = ?, error = ? WHERE id = ?',
          ['failed', error.message, messageId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      throw error;
    }
  } catch (error) {
    console.error('Errore completo:', error);
    res.status(500).json({ error: error.message || 'Errore nell\'invio del messaggio' });
  }
});

app.get('/api/users/:userId/configs', authenticateToken, requireAdmin, async (req, res) => {
  const userId = req.params.userId;
  
  try {
    const configs = await new Promise((resolve, reject) => {
      db.all(
        `SELECT tc.*, uc.user_id IS NOT NULL as is_assigned
         FROM telegram_configs tc
         LEFT JOIN user_configs uc ON tc.id = uc.config_id AND uc.user_id = ?
         WHERE tc.is_active = 1`,
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
    
    res.json(configs);
  } catch (error) {
    console.error('Errore:', error);
    res.status(500).json({ error: 'Errore nel recuperare le configurazioni' });
  }
});

app.post('/api/users/:userId/configs', authenticateToken, requireAdmin, async (req, res) => {
  const userId = req.params.userId;
  const { configIds } = req.body;
  
  try {
    // Rimuovi tutte le configurazioni esistenti dell'utente
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM user_configs WHERE user_id = ?', [userId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Aggiungi le nuove configurazioni
    for (const configId of configIds) {
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO user_configs (user_id, config_id) VALUES (?, ?)',
          [userId, configId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Errore:', error);
    res.status(500).json({ error: 'Errore nell\'aggiornare le configurazioni' });
  }
});

app.patch('/api/telegram-configs/:id/toggle', authenticateToken, requireAdmin, async (req, res) => {
  const configId = req.params.id;
  
  try {
    // Non c'è più bisogno di disattivare le altre configurazioni
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE telegram_configs SET is_active = NOT is_active WHERE id = ?',
        [configId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Errore:', error);
    res.status(500).json({ error: 'Errore nell\'attivare/disattivare la configurazione' });
  }
});

app.listen(PORT, () => {
  console.log(`Server in esecuzione sulla porta ${PORT}`);
});