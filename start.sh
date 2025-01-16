#!/bin/bash

# Colori per output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Funzione per stampare messaggi con stile
print_step() {
    echo -e "${BOLD}${GREEN}==>${NC} ${BOLD}$1${NC}"
}

print_error() {
    echo -e "${RED}Errore: $1${NC}"
}

# Verifica PM2
if ! command -v pm2 &> /dev/null; then
    print_step "PM2 non trovato. Installazione in corso..."
    npm install -g pm2
    if [ $? -ne 0 ]; then
        print_error "Impossibile installare PM2. Assicurati di avere i permessi necessari."
        exit 1
    fi
fi

# Avvia le applicazioni con PM2
print_step "Avvio delle applicazioni con PM2..."
pm2 start ecosystem.config.js

# Mostra lo stato delle applicazioni
print_step "Stato delle applicazioni:"
pm2 status

print_step "Le applicazioni sono state avviate!"
echo -e "\nPuoi accedere all'applicazione su: ${BOLD}http://localhost:5000${NC}"
echo -e "Per visualizzare i log: ${BOLD}pm2 logs${NC}"
echo -e "Per fermare le applicazioni: ${BOLD}pm2 stop all${NC}"
