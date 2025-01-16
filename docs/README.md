# 📚 Documentazione Telegram Sender

## Indice
- [Configurazione](#configurazione)
  - [Requisiti di Sistema](#requisiti-di-sistema)
  - [Configurazione Bot Telegram](#configurazione-bot-telegram)
  - [Configurazione Server](#configurazione-server)
- [Utilizzo](#utilizzo)
  - [Gestione Utenti](#gestione-utenti)
  - [Invio Messaggi](#invio-messaggi)
  - [Gestione File](#gestione-file)
- [Risoluzione Problemi](#risoluzione-problemi)

## Configurazione

### Requisiti di Sistema

- **Sistema Operativo**: Linux, macOS, o Windows
- **Node.js**: v14.0.0 o superiore
- **NPM**: v6.0.0 o superiore
- **Spazio su Disco**: Minimo 500MB liberi
- **RAM**: Minimo 1GB libera

### Configurazione Bot Telegram

1. **Creazione Bot**
   - Apri Telegram e cerca [@BotFather](https://t.me/botfather)
   - Invia il comando `/newbot`
   - Segui le istruzioni per:
     - Impostare il nome del bot
     - Impostare lo username del bot (deve terminare con 'bot')
   - Salva il token fornito da BotFather

2. **Configurazione Canale**
   - Crea un nuovo canale su Telegram
   - Aggiungi il bot come amministratore
   - Imposta i seguenti permessi:
     - ✅ Invia messaggi
     - ✅ Modifica messaggi
     - ✅ Elimina messaggi
     - ✅ Invia media
   - Ottieni l'ID del canale:
     - Inoltra un messaggio dal canale a [@username_to_id_bot](https://t.me/username_to_id_bot)
     - Salva l'ID fornito (formato: -100xxxxxxxxxx)

### Configurazione Server

Il file `.env` supporta le seguenti variabili:

```env
# Server Configuration
PORT=3000                    # Porta del server
JWT_SECRET=your_secret       # Secret per JWT (importante: usa un valore sicuro)
NODE_ENV=production         # production/development

# Database Configuration
DB_PATH=./database.sqlite   # Percorso del database

# Telegram Configuration
DEFAULT_BOT_TOKEN=token     # Token del bot Telegram
UPLOAD_DIR=./uploads       # Directory per gli upload
MAX_FILE_SIZE=5242880      # Dimensione massima file (5MB default)

# Security
PASSWORD_SALT_ROUNDS=10    # Rounds per il salt delle password
```

## Utilizzo

### Gestione Utenti

L'applicazione supporta due tipi di utenti:
- 👑 **Amministratori**: Accesso completo a tutte le funzionalità
- 👤 **Utenti Standard**: Possono solo inviare messaggi

#### Creazione Nuovo Utente
1. Accedi come amministratore
2. Vai su "Impostazioni" > "Gestione Utenti"
3. Clicca "Aggiungi Utente"
4. Compila:
   - Username
   - Password
   - Tipo utente (Admin/Standard)
   - Configurazioni associate

### Invio Messaggi

L'editor supporta:
- **Formattazione Base**: 
  - Bold: `Ctrl/Cmd + B`
  - Italic: `Ctrl/Cmd + I`
- **Liste**:
  - Puntate: Usa il pulsante lista
  - Numerate: Usa il pulsante lista numerata
- **File**:
  - Trascina e rilascia
  - Click sul pulsante allegati
  - Dimensione massima: 50MB
  - Formati supportati: 
    - Immagini: JPG, PNG, GIF
    - Documenti: PDF

### Gestione File

I file caricati:
- Sono salvati in `backend/uploads/`
- Hanno nome file sicuro (timestamp + nome originale)
- Sono accessibili solo agli utenti autenticati
- Vengono eliminati automaticamente dopo l'invio

## Risoluzione Problemi

### Errori Comuni

1. **Errore: "Token non valido"**
   - Verifica che il token del bot sia corretto
   - Controlla che il bot sia amministratore del canale

2. **Errore: "File troppo grande"**
   - Limite default: 50MB
   - Modifica `MAX_FILE_SIZE` in `.env`

3. **Errore: "Impossibile connettersi al database"**
   - Verifica i permessi della directory
   - Controlla che SQLite sia installato

### Log

I log sono salvati in:
- `logs/error.log`: Errori applicazione
- `logs/combined.log`: Tutti gli eventi

### Supporto

Per assistenza:
1. Controlla la [sezione issues](https://github.com/yourusername/telegram-sender/issues)
2. Cerca tra le issues esistenti
3. Apri una nuova issue con:
   - Descrizione dettagliata
   - Steps per riprodurre
   - Log pertinenti
