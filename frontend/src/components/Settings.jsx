// src/components/Settings.jsx
import React, { useState, useEffect } from 'react';

const API_URL = '/api';

function Settings({ onBack }) {
  // Stati per la configurazione
  const [botToken, setBotToken] = useState('');
  const [channelId, setChannelId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  
  // Stati per la gestione password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Stati per la gestione utenti
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [userError, setUserError] = useState(null);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userListError, setUserListError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedConfig, setSelectedConfig] = useState('');
  const [availableConfigs, setAvailableConfigs] = useState([]);
  const [userConfigs, setUserConfigs] = useState({});
  const [isLoadingUserConfigs, setIsLoadingUserConfigs] = useState(false);
  const [userConfigError, setUserConfigError] = useState(null);

  // Stati per la gestione dei tab
  const [activeTab, setActiveTab] = useState('users');

  // Stati per la gestione delle configurazioni Telegram
  const [telegramConfigs, setTelegramConfigs] = useState([]);
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(false);
  const [configError, setConfigError] = useState(null);
  const [description, setDescription] = useState('');

  useEffect(() => {
    fetchConfig();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (activeTab === 'telegram') {
      fetchTelegramConfigs();
    }
  }, [activeTab]);

  useEffect(() => {
    if (currentUser?.isAdmin) {
      fetchTelegramConfigs();
    }
  }, [currentUser]);

  const fetchConfig = async () => {
    console.log('Recupero configurazione...');
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      console.log('Token:', token ? 'presente' : 'mancante');
      
      const response = await fetch(`${API_URL}/config`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('Risposta ricevuta:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Dati ricevuti:', data);
        setBotToken(data.bot_token || '');
        setChannelId(data.channel_id || '');
        setLastUpdate(data.updated_at);
      } else {
        const errorData = await response.json();
        console.error('Errore nella risposta:', errorData);
        throw new Error(errorData.error || 'Errore nel recuperare la configurazione');
      }
    } catch (error) {
      console.error('Errore nel recuperare la configurazione:', error);
      setError('Errore nel recuperare la configurazione. Riprova più tardi.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    setUserListError(null);
    try {
      const token = localStorage.getItem('token');
      console.log('Recupero utenti con token:', token ? 'presente' : 'mancante');
      
      const response = await fetch(`${API_URL}/users`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      console.log('Risposta ricevuta:', response.status);
      console.log('Headers ricevuti:', [...response.headers.entries()]);

      let data;
      const responseText = await response.text();
      console.log('Risposta text:', responseText);
      
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Errore nel parsing JSON:', e);
        throw new Error('Risposta non valida dal server: ' + responseText.substring(0, 100));
      }

      if (response.ok) {
        console.log('Dati ricevuti:', data);
        // Trova l'utente corrente dal token JWT
        const token = localStorage.getItem('token');
        const tokenData = JSON.parse(atob(token.split('.')[1]));
        const currentUserData = data.find(user => user.id === tokenData.userId);
        
        setCurrentUser({
          ...currentUserData,
          isAdmin: currentUserData.is_admin === 1
        });
        setUsers(data);
      } else {
        throw new Error(data.error || `Errore nel recuperare gli utenti (${response.status})`);
      }
    } catch (error) {
      console.error('Errore nel recupero utenti:', error);
      setUserListError(`${error.message}. Riprova o controlla la console per maggiori dettagli.`);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Salvataggio configurazione...');
    setIsSaving(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      console.log('Token:', token ? 'presente' : 'mancante');
      
      const response = await fetch(`${API_URL}/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ bot_token: botToken, channel_id: channelId })
      });
      console.log('Risposta ricevuta:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('Risultato:', result);
        if (result.success) {
          await fetchConfig(); // Ricarica le impostazioni
          alert('Configurazione salvata con successo!');
        } else {
          throw new Error('Errore nel salvare la configurazione');
        }
      } else {
        const errorData = await response.json();
        console.error('Errore nella risposta:', errorData);
        throw new Error(errorData.error || 'Errore nel salvare la configurazione');
      }
    } catch (error) {
      console.error('Errore nel salvare la configurazione:', error);
      setError('Errore nel salvare la configurazione. Riprova.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setPasswordError(null);
    
    if (newPassword !== confirmPassword) {
      setPasswordError('Le nuove password non corrispondono');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('La nuova password deve essere di almeno 6 caratteri');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/update-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      if (response.ok) {
        alert('Password aggiornata con successo!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const data = await response.json();
        setPasswordError(data.error || 'Errore durante l\'aggiornamento della password');
      }
    } catch (error) {
      console.error('Errore:', error);
      setPasswordError('Errore di connessione. Riprova più tardi.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setIsAddingUser(true);
    setUserError(null);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: newUsername,
          password: newUserPassword,
          configId: selectedConfig
        })
      });

      if (response.ok) {
        alert('Utente creato con successo!');
        setNewUsername('');
        setNewUserPassword('');
        setSelectedConfig('');
        await fetchUsers(); // Ricarica la lista degli utenti
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore nella creazione dell\'utente');
      }
    } catch (error) {
      console.error('Errore:', error);
      setUserError('Errore nella creazione dell\'utente. Riprova.');
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo utente?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        await fetchUsers(); // Ricarica la lista degli utenti
        alert('Utente eliminato con successo');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore nell\'eliminazione dell\'utente');
      }
    } catch (error) {
      console.error('Errore:', error);
      alert(error.message);
    }
  };

  const fetchTelegramConfigs = async () => {
    setIsLoadingConfigs(true);
    setConfigError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/telegram-configs`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Errore nel recuperare le configurazioni');
      }

      const configs = await response.json();
      setTelegramConfigs(configs);
      setAvailableConfigs(configs.map(config => ({
        ...config,
        display_name: config.description || config.channel_id
      })));
    } catch (error) {
      console.error('Errore:', error);
      setConfigError('Errore nel recuperare le configurazioni');
    } finally {
      setIsLoadingConfigs(false);
    }
  };

  const handleAddConfig = async (e) => {
    e.preventDefault();
    setConfigError(null);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/telegram-configs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bot_token: botToken,
          channel_id: channelId,
          description: description
        })
      });

      if (!response.ok) {
        throw new Error('Errore nel salvare la configurazione');
      }

      setBotToken('');
      setChannelId('');
      setDescription('');
      fetchTelegramConfigs();
    } catch (error) {
      console.error('Errore:', error);
      setConfigError('Errore nel salvare la configurazione');
    }
  };

  const handleDeleteConfig = async (configId) => {
    if (!window.confirm('Sei sicuro di voler eliminare questa configurazione?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/telegram-configs/${configId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Errore nell\'eliminazione della configurazione');
      }

      fetchTelegramConfigs();
    } catch (error) {
      console.error('Errore:', error);
      setConfigError('Errore nell\'eliminazione della configurazione');
    }
  };

  const handleToggleConfig = async (configId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/telegram-configs/${configId}/toggle`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Errore nell\'attivazione della configurazione');
      }

      fetchTelegramConfigs();
    } catch (error) {
      console.error('Errore:', error);
      setConfigError('Errore nell\'attivazione della configurazione');
    }
  };

  const fetchUserConfigs = async (userId) => {
    if (!currentUser?.isAdmin) {
      alert('Solo gli amministratori possono gestire le configurazioni degli utenti');
      return;
    }

    setIsLoadingUserConfigs(true);
    setUserConfigError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/users/${userId}/configs`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Non hai i permessi per gestire le configurazioni degli utenti');
      }

      const configs = await response.json();
      setUserConfigs(prev => ({
        ...prev,
        [userId]: configs
      }));
    } catch (error) {
      console.error('Errore:', error);
      alert(error.message);
      setUserConfigError('Accesso non autorizzato');
    } finally {
      setIsLoadingUserConfigs(false);
    }
  };

  const handleUpdateUserConfigs = async (userId, selectedConfigIds) => {
    if (!currentUser?.isAdmin) {
      alert('Solo gli amministratori possono modificare le configurazioni degli utenti');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/users/${userId}/configs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ configIds: selectedConfigIds })
      });

      if (!response.ok) {
        throw new Error('Non hai i permessi per modificare le configurazioni degli utenti');
      }

      await fetchUserConfigs(userId);
      alert('Configurazioni aggiornate con successo!');
    } catch (error) {
      console.error('Errore:', error);
      alert(error.message);
    }
  };

  const TabButton = ({ id, label, active }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-4 py-2 font-medium text-sm rounded-t-lg ${active ? 'bg-white text-blue-600 border-t border-x border-gray-200' : 'text-gray-500 hover:text-gray-700 bg-gray-50'}`}
    >
      {label}
    </button>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 py-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center">Caricamento impostazioni...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow">
          {/* Header con bottone back */}
          <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Impostazioni</h2>
            <button
              onClick={onBack}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              ← Indietro
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex flex-wrap gap-2 px-4 sm:px-6 py-2" aria-label="Tabs">
              {/* Tab Telegram sempre visibile per admin */}
              {currentUser?.isAdmin && (
                <button
                  onClick={() => setActiveTab('telegram')}
                  className={`flex-grow sm:flex-grow-0 whitespace-nowrap py-2 px-3 text-center border-b-2 font-medium text-sm ${
                    activeTab === 'telegram'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Configurazione
                </button>
              )}
              
              {/* Tab Utenti sempre visibile */}
              <button
                onClick={() => setActiveTab('users')}
                className={`flex-grow sm:flex-grow-0 whitespace-nowrap py-2 px-3 text-center border-b-2 font-medium text-sm ${
                  activeTab === 'users'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Utenti
              </button>
              
              {/* Tab Password sempre visibile */}
              <button
                onClick={() => setActiveTab('password')}
                className={`flex-grow sm:flex-grow-0 whitespace-nowrap py-2 px-3 text-center border-b-2 font-medium text-sm ${
                  activeTab === 'password'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Password
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Contenuto tab Telegram solo per admin */}
            {activeTab === 'telegram' && currentUser?.isAdmin && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Configurazioni Telegram</h3>
                  
                  {/* Tabella configurazioni */}
                  <div className="mt-4">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Stato
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Bot Token
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Channel ID
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Descrizione
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Azioni
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {isLoadingConfigs ? (
                            <tr>
                              <td colSpan="5" className="px-6 py-4 text-center">
                                <div className="flex justify-center">
                                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                                </div>
                              </td>
                            </tr>
                          ) : telegramConfigs.length === 0 ? (
                            <tr>
                              <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">
                                Nessuna configurazione presente
                              </td>
                            </tr>
                          ) : (
                            telegramConfigs.map((config) => (
                              <tr key={config.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <button
                                    onClick={() => handleToggleConfig(config.id)}
                                    className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                      config.is_active
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-gray-100 text-gray-800'
                                    }`}
                                  >
                                    {config.is_active ? 'Attivo' : 'Inattivo'}
                                  </button>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  <span className="font-mono">{config.bot_token}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  <span className="font-mono">{config.channel_id}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {config.display_name || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  <button
                                    onClick={() => handleDeleteConfig(config.id)}
                                    className="text-red-600 hover:text-red-900"
                                  >
                                    Elimina
                                  </button>
                                  {!config.is_active && (
                                    <button
                                      onClick={() => handleDeleteConfig(config.id)}
                                      className="ml-2 text-red-600 hover:text-red-900"
                                    >
                                      Elimina definitivamente
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {configError && (
                    <div className="mt-4 text-red-600 text-sm">{configError}</div>
                  )}
                </div>

                {/* Form nuova configurazione */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-md font-medium text-gray-900 mb-4">Aggiungi Nuova Configurazione</h4>
                  <form onSubmit={handleAddConfig} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div>
                        <label htmlFor="botToken" className="block text-sm font-medium text-gray-700">
                          Bot Token
                        </label>
                        <input
                          type="text"
                          id="botToken"
                          value={botToken}
                          onChange={(e) => setBotToken(e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="channelId" className="block text-sm font-medium text-gray-700">
                          Channel ID
                        </label>
                        <input
                          type="text"
                          id="channelId"
                          value={channelId}
                          onChange={(e) => setChannelId(e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                          Descrizione
                        </label>
                        <input
                          type="text"
                          id="description"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Aggiungi Configurazione
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div className="space-y-8">
                {/* Sezione Utente Corrente */}
                {currentUser && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center">
                          <span className="text-white text-lg font-semibold">
                            {currentUser.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-blue-900">
                          Utente Corrente
                        </h3>
                        <p className="text-sm text-blue-700">
                          {currentUser.username}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Aggiungi Nuovo Utente</h3>
                  {/* Form aggiunta utente solo per admin */}
                  {currentUser?.isAdmin && (
                    <form onSubmit={handleAddUser} className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div>
                          <label htmlFor="newUsername" className="block text-sm font-medium text-gray-700">
                            Username
                          </label>
                          <input
                            type="text"
                            id="newUsername"
                            value={newUsername}
                            onChange={(e) => setNewUsername(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="newUserPassword" className="block text-sm font-medium text-gray-700">
                            Password
                          </label>
                          <input
                            type="password"
                            id="newUserPassword"
                            value={newUserPassword}
                            onChange={(e) => setNewUserPassword(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="configSelect" className="block text-sm font-medium text-gray-700">
                            Configurazione Telegram
                          </label>
                          <select
                            id="configSelect"
                            value={selectedConfig}
                            onChange={(e) => setSelectedConfig(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            required
                          >
                            <option value="">Seleziona configurazione</option>
                            {availableConfigs.map((config) => (
                              <option key={config.id} value={config.id}>
                                {config.display_name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {userError && (
                        <div className="text-red-600 text-sm">{userError}</div>
                      )}
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={isAddingUser}
                          className="inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
                        >
                          {isAddingUser ? 'Creazione in corso...' : 'Aggiungi Utente'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Lista Utenti</h3>
                  {isLoadingUsers ? (
                    <div className="text-center py-4">Caricamento utenti...</div>
                  ) : userListError ? (
                    <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-600 text-sm">
                      {userListError}
                      <button
                        onClick={fetchUsers}
                        className="ml-2 text-red-700 underline hover:text-red-800"
                      >
                        Riprova
                      </button>
                    </div>
                  ) : (
                    <div className="bg-white shadow overflow-hidden border border-gray-200 sm:rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              ID
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Username
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Configurazione
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Azioni
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {users.map((user) => (
                            <tr key={user.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {user.id}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {user.username}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                {currentUser?.isAdmin ? (
                                  <>
                                    {isLoadingUserConfigs ? (
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                                    ) : (
                                      <div>
                                        {userConfigs[user.id]?.map(config => (
                                          <label key={config.id} className="flex items-center space-x-2 mb-2">
                                            <input
                                              type="checkbox"
                                              checked={config.is_assigned}
                                              onChange={(e) => {
                                                const currentConfigs = userConfigs[user.id] || [];
                                                const selectedConfigIds = currentConfigs
                                                  .filter(c => c.id !== config.id || e.target.checked)
                                                  .map(c => c.id);
                                                handleUpdateUserConfigs(user.id, selectedConfigIds);
                                              }}
                                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span>{config.description || config.channel_id}</span>
                                          </label>
                                        ))}
                                        {!userConfigs[user.id] && (
                                          <button
                                            onClick={() => fetchUserConfigs(user.id)}
                                            className="text-blue-600 hover:text-blue-800 text-sm"
                                          >
                                            Carica configurazioni
                                          </button>
                                        )}
                                        {userConfigError && (
                                          <div className="text-red-500 text-sm mt-1">{userConfigError}</div>
                                        )}
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <div className="text-gray-500">
                                    {user.config ? (
                                      <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        {user.config.description || user.config.channel_id || 'Configurazione attiva'}
                                      </div>
                                    ) : (
                                      <span className="text-gray-400">Nessuna configurazione</span>
                                    )}
                                    {user.id === currentUser?.id && (
                                      <div className="text-sm text-gray-400 mt-1">
                                        Contatta l'amministratore per modificare le configurazioni
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                {currentUser?.isAdmin && user.id !== currentUser.id && (
                                  <button
                                    onClick={() => handleDeleteUser(user.id)}
                                    className="text-red-600 hover:text-red-900"
                                  >
                                    Elimina
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {users.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          Nessun utente trovato
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'password' && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900">Cambia Password</h3>
                <form onSubmit={handlePasswordUpdate} className="space-y-4">
                  <div>
                    <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">
                      Password Attuale
                    </label>
                    <input
                      type="password"
                      id="currentPassword"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                      Nuova Password
                    </label>
                    <input
                      type="password"
                      id="newPassword"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                      Conferma Nuova Password
                    </label>
                    <input
                      type="password"
                      id="confirmPassword"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      required
                    />
                  </div>
                  {passwordError && (
                    <div className="text-red-600 text-sm">{passwordError}</div>
                  )}
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isUpdatingPassword}
                      className="inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
                    >
                      {isUpdatingPassword ? 'Aggiornamento...' : 'Aggiorna Password'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;