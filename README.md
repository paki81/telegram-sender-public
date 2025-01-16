# 📬 Telegram Sender

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg?cacheSeconds=2592000)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Node Version](https://img.shields.io/badge/node-%3E%3D%2014-green.svg)

</div>

<p align="center">
  <img src="docs/screenshot.png" alt="Telegram Sender Screenshot" width="600">
</p>

> Un'applicazione web moderna per l'invio di messaggi su canali Telegram con supporto per configurazioni multiple e gestione utenti.

## ✨ Caratteristiche

- 🚀 **Interfaccia Moderna** - UI reattiva e intuitiva
- 📝 **Editor Rich Text** - Formattazione avanzata dei messaggi
- 📎 **Gestione Allegati** - Supporto per immagini, PDF e altri file
- 👥 **Multi-Utente** - Sistema completo di autenticazione e gestione utenti
- ⚙️ **Configurazioni Multiple** - Gestione di più bot e canali Telegram
- 🔕 **Messaggi Silenziosi** - Opzione per inviare notifiche senza suono
- 📋 **Registro Messaggi** - Storico completo con paginazione
- 👨‍💼 **Pannello Admin** - Gestione utenti e configurazioni

## 🚀 Installazione Rapida

### Prerequisiti

- Node.js (v14 o superiore)
- Un bot Telegram (ottenibile tramite [@BotFather](https://t.me/botfather))
- Un canale Telegram dove il bot ha i permessi di amministratore

### Installazione Automatica

```bash
# 1. Clona il repository
git clone https://github.com/yourusername/telegram-sender.git
cd telegram-sender

# 2. Esegui lo script di installazione
./install.sh
```

Lo script di installazione:
- ✅ Verifica i prerequisiti
- 📦 Installa tutte le dipendenze
- 🗄️ Inizializza il database
- 🔧 Crea i file di configurazione necessari
- 🏗️ Compila il frontend

### Configurazione

1. Modifica il file `backend/.env` con i tuoi parametri:
   ```env
   # Server Configuration
   PORT=3000
   JWT_SECRET=il_tuo_secret_qui

   # Telegram Configuration
   DEFAULT_BOT_TOKEN=il_tuo_bot_token_qui
   ```

2. Avvia l'applicazione:
   ```bash
   # Terminal 1 - Backend
   cd backend
   npm start

   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

3. Accedi all'applicazione:
   - URL: `http://localhost:5173`
   - Username: `admin`
   - Password: `admin`

   > ⚠️ **IMPORTANTE**: Cambia immediatamente la password dell'amministratore dopo il primo accesso!

## 🛠️ Tecnologie Utilizzate

### Frontend
- **React.js** - Framework UI
- **TipTap** - Editor rich text
- **Tailwind CSS** - Framework CSS utility-first

### Backend
- **Node.js** - Runtime JavaScript
- **Express.js** - Framework web
- **SQLite** - Database
- **node-telegram-bot-api** - Integrazione Telegram

## 📖 Documentazione

Per informazioni dettagliate su configurazione e utilizzo, consulta la [documentazione completa](docs/README.md).

## 🤝 Contribuire

Siamo aperti a contributi! Se vuoi migliorare Telegram Sender:

1. 🍴 Fai un fork del repository
2. 🌿 Crea un branch per la tua feature (`git checkout -b feature/AmazingFeature`)
3. 💾 Committa le modifiche (`git commit -m 'Add some AmazingFeature'`)
4. 📤 Pusha sul branch (`git push origin feature/AmazingFeature`)
5. 🔍 Apri una Pull Request

## 📝 Licenza

Distribuito sotto licenza MIT. Vedi [`LICENSE`](LICENSE) per maggiori informazioni.

## 💬 Supporto

- 📫 Apri una issue su GitHub
- 💡 Proponi nuove funzionalità
- 🐛 Segnala bug
- 📚 Contribuisci alla documentazione

---

<div align="center">
  <sub>Built with ❤️ by the community</sub>
</div>
