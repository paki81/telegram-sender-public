#!/bin/bash

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Funzione per stampare messaggi con stile
print_step() {
    echo -e "${BOLD}${GREEN}==>${NC} ${BOLD}$1${NC}"
}

print_error() {
    echo -e "${RED}Errore: $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}Attenzione: $1${NC}"
}

# Verifica Node.js
print_step "Verifico la presenza di Node.js..."
if ! command -v node &> /dev/null; then
    print_error "Node.js non trovato. Per favore installa Node.js (v14 o superiore)"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d 'v' -f 2)
if [ "$(echo $NODE_VERSION | cut -d '.' -f 1)" -lt 14 ]; then
    print_error "Node.js v14 o superiore richiesto. Versione attuale: $NODE_VERSION"
    exit 1
fi

print_step "Verifico la presenza di npm..."
if ! command -v npm &> /dev/null; then
    print_error "npm non trovato. Per favore installa npm"
    exit 1
fi

# Creazione directory uploads se non esiste
print_step "Creo la directory uploads..."
mkdir -p backend/uploads
chmod 755 backend/uploads

# Installazione dipendenze backend
print_step "Installo le dipendenze del backend..."
cd backend
npm install
if [ $? -ne 0 ]; then
    print_error "Errore nell'installazione delle dipendenze del backend"
    exit 1
fi

# Copia file .env se non esiste
if [ ! -f .env ]; then
    print_step "Copio il file .env.example in .env..."
    cp .env.example .env
    print_warning "Ricordati di configurare il file .env con i tuoi parametri"
fi

# Inizializzazione database
print_step "Inizializzo il database..."
node init-db.js
if [ $? -ne 0 ]; then
    print_error "Errore nell'inizializzazione del database"
    exit 1
fi

# Installazione dipendenze frontend
print_step "Installo le dipendenze del frontend..."
cd ../frontend
npm install
if [ $? -ne 0 ]; then
    print_error "Errore nell'installazione delle dipendenze del frontend"
    exit 1
fi

# Build del frontend
print_step "Eseguo la build del frontend..."
npm run build
if [ $? -ne 0 ]; then
    print_error "Errore nella build del frontend"
    exit 1
fi

# Torna alla directory principale
cd ..

echo -e "\n${GREEN}${BOLD}Installazione completata con successo!${NC}\n"
echo -e "Per avviare l'applicazione:"
echo -e "1. Configura il file ${BOLD}backend/.env${NC} con i tuoi parametri"
echo -e "2. Avvia il backend: ${BOLD}cd backend && npm start${NC}"
echo -e "3. Avvia il frontend: ${BOLD}cd frontend && npm run dev${NC}"
echo -e "\nCredenziali di default:"
echo -e "Username: ${BOLD}admin${NC}"
echo -e "Password: ${BOLD}admin${NC}"
echo -e "\n${YELLOW}IMPORTANTE: Cambia la password dell'amministratore dopo il primo accesso!${NC}\n"
