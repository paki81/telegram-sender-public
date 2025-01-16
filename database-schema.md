# Database Schema Documentation

## Overview
This document describes the database schema for the Telegram Sender application. The application uses SQLite3 as its database system.

## Tables

### 1. users
Stores user account information.

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  is_admin INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2. telegram_configs
Stores Telegram bot configurations.

```sql
CREATE TABLE telegram_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bot_token TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  description TEXT,
  is_active INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 3. user_configs
Junction table linking users to their telegram configurations.

```sql
CREATE TABLE user_configs (
  user_id INTEGER,
  config_id INTEGER,
  PRIMARY KEY (user_id, config_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (config_id) REFERENCES telegram_configs(id) ON DELETE CASCADE
);
```

### 4. messages
Stores messages sent through the system.

```sql
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
);
```

### 5. attachments
Stores file attachments associated with messages.

```sql
CREATE TABLE attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER,
  telegram_message_id TEXT,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);
```

## Relationships

1. A user can have multiple telegram configurations (many-to-many through user_configs)
2. A telegram configuration can be assigned to multiple users (many-to-many through user_configs)
3. A message belongs to one user and one telegram configuration
4. A message can have multiple attachments
5. An attachment belongs to one message

## Default Data

- An admin user is created by default with username 'admin' and password 'admin'
- Foreign key constraints are enabled (PRAGMA foreign_keys = ON)

## Notes

1. All timestamps are stored using SQLite's DATETIME type
2. Passwords are hashed using bcrypt before storage
3. The system uses ON DELETE CASCADE for related records in user_configs and attachments tables
4. The messages table uses 'sent' as the default status for new messages
