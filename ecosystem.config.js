module.exports = {
  apps: [
    {
      name: 'telegram-backend',
      cwd: './backend',
      script: 'server.js',
      watch: true,
      ignore_watch: [
        'node_modules',
        'uploads',
        '*.db',
        '*.db-journal',
        '*.sqlite',
        '*.sqlite-journal'
      ],
      env: {
        PORT: 5001,
        NODE_ENV: 'production'
      }
    },
    {
      name: 'telegram-frontend',
      cwd: './frontend',
      script: 'npm',
      args: 'run dev',
      watch: false,
      env: {
        PORT: 5000,
        NODE_ENV: 'development',
        VITE_DISABLE_FILE_SYSTEM_API: true
      }
    }
  ]
};
