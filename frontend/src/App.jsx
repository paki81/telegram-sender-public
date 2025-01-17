import React, { useState, useEffect, useRef } from "react";
import { useEditor, EditorContent } from '@tiptap/react';
import { Paperclip, X } from 'lucide-react';
import StarterKit from '@tiptap/starter-kit';
import EmojiPicker from "emoji-picker-react";
import Login from './components/Login';
import FileUpload from './components/FileUpload';
import Settings from './components/Settings';

const API_URL = '/api';

const MenuBar = ({ editor }) => {
  if (!editor) {
    return null;
  }

  const preventDefault = (e, action) => {
    e.preventDefault();
    action();
  };

  return (
    <div className="flex gap-1 p-2 border-b border-gray-200">
      <button
        type="button"
        onClick={(e) => preventDefault(e, () => editor.chain().focus().toggleBold().run())}
        className={`p-2 rounded ${editor.isActive('bold') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
      >
        <i className="fas fa-bold"></i>
      </button>
      <button
        type="button"
        onClick={(e) => preventDefault(e, () => editor.chain().focus().toggleItalic().run())}
        className={`p-2 rounded ${editor.isActive('italic') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
      >
        <i className="fas fa-italic"></i>
      </button>
      <button
        type="button"
        onClick={(e) => preventDefault(e, () => editor.chain().focus().toggleBulletList().run())}
        className={`p-2 rounded ${editor.isActive('bulletList') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
      >
        <i className="fas fa-list"></i>
      </button>
      <button
        type="button"
        onClick={(e) => preventDefault(e, () => editor.chain().focus().toggleOrderedList().run())}
        className={`p-2 rounded ${editor.isActive('orderedList') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
      >
        <i className="fas fa-list-ol"></i>
      </button>
    </div>
  );
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const [currentUser, setCurrentUser] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMessages, setTotalMessages] = useState(0);
  const [isSilent, setIsSilent] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const fileInputRef = useRef(null);

  const updateUserInfo = () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        setCurrentUser(decoded);
      } catch (error) {
        console.error('Errore nel decodificare il token:', error);
        localStorage.removeItem('token');
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
    } else {
      setIsAuthenticated(false);
      setCurrentUser(null);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      updateUserInfo();
    }
  }, [isAuthenticated]);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setCurrentUser(null);
    setIsAuthenticated(false);
    setShowSettings(false);
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        setCurrentUser(decoded);
      } catch (error) {
        console.error('Errore nel decodificare il token:', error);
        localStorage.removeItem('token');
      }
    }
  }, []);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const totalSize = files.reduce((acc, file) => acc + file.size, 0);
    if (totalSize > 50 * 1024 * 1024) {
      alert("La dimensione totale degli allegati non può superare 50MB");
      return;
    }
    setAttachments([...attachments, ...files]);
  };

  const removeAttachment = (index) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
  });

  const fetchMessages = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/messages?page=${currentPage}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setIsAuthenticated(false);
          localStorage.removeItem('token');
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data) {
        setMessages(data.messages);
        setTotalPages(data.totalPages);
        setTotalMessages(data.total);
      }
    } catch (error) {
      console.error("Errore nel caricare i messaggi:", error);
      if (!(error instanceof TypeError)) {
        alert("Errore nel caricare i messaggi. Riprova più tardi.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchMessages();
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);
  }, [currentPage, isAuthenticated]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!editor?.getText()?.trim() && attachments.length === 0) {
      alert("Il messaggio non può essere vuoto.");
      return;
    }

    setIsSending(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert("Token non trovato. Effettua nuovamente il login.");
        setIsAuthenticated(false);
        return;
      }

      const formData = new FormData();
      formData.append('message', editor.getHTML());
      formData.append('silent', isSilent.toString());

      for (const file of attachments) {
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
        if (!validTypes.includes(file.type)) {
          throw new Error(`Tipo di file non supportato: ${file.type}`);
        }

        console.log('Aggiunta allegato:', {
          name: file.name,
          type: file.type,
          size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`
        });

        const timestamp = new Date().getTime();
        const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        formData.append('attachments', file, `${timestamp}-${safeFileName}`);
      }

      for (const pair of formData.entries()) {
        console.log('FormData entry:', pair[0], pair[1] instanceof File ? pair[1].name : pair[1]);
      }

      const response = await fetch(`${API_URL}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = `Errore del server (${response.status})`;
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
          } else {
            const textError = await response.text();
            if (textError.includes("413")) {
              errorMessage = "File troppo grande";
            } else if (textError.includes("415")) {
              errorMessage = "Tipo di file non supportato";
            } else {
              errorMessage = "Errore del server durante l'upload del file";
            }
          }
        } catch (e) {
          console.error('Errore nel parsing della risposta:', e);
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('Risposta server:', result);

      editor.commands.setContent('');
      setIsSilent(false);
      setAttachments([]);
      setCurrentPage(1);
      await fetchMessages();
    } catch (error) {
      console.error("Errore dettagliato:", error);
      alert(`Errore nell'invio del messaggio: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Sei sicuro di voler eliminare questo messaggio?")) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/messages/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (response.status === 401 || response.status === 403) {
        setIsAuthenticated(false);
        localStorage.removeItem('token');
        return;
      }

      if (response.ok) {
        setCurrentPage(1);
        fetchMessages();
      }
    } catch (error) {
      console.error("Errore nell'eliminazione:", error);
      alert("Errore nell'eliminazione del messaggio. Riprova.");
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm("Sei sicuro di voler eliminare tutti i messaggi?")) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/messages/all`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (response.status === 401 || response.status === 403) {
        setIsAuthenticated(false);
        localStorage.removeItem('token');
        return;
      }

      if (response.ok) {
        setCurrentPage(1);
        fetchMessages();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore nell\'eliminazione dei messaggi');
      }
    } catch (error) {
      console.error("Errore nell'eliminazione:", error);
      alert(`Errore nell'eliminazione dei messaggi: ${error.message}`);
    }
  };

  const handleEmojiClick = (emojiData) => {
    editor?.commands.insertContent(emojiData.emoji);
    setShowEmojiPicker(false);
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  if (showSettings) {
    return <Settings onBack={() => setShowSettings(false)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100">
      {isAuthenticated && (
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row justify-between py-3 sm:h-16">
              <div className="flex items-center justify-center sm:justify-start mb-3 sm:mb-0">
                <div className="flex-shrink-0">
                  <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Telegram Messenger</h1>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4">
                {currentUser && (
                  <div className="flex items-center space-x-2 mb-2 sm:mb-0">
                    <span className="text-sm text-gray-700">
                      {currentUser.username}
                    </span>
                    {currentUser.config && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {currentUser.config.description}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowSettings(true)}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Impostazioni
                  </button>
                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </nav>
      )}
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl sm:text-4xl font-bold text-center mb-4 sm:mb-8 text-blue-800 drop-shadow-sm">
            Telegram Messenger
          </h1>

          <div className="bg-white rounded-lg shadow-lg p-3 sm:p-6 mb-4 sm:mb-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="border rounded-lg overflow-hidden bg-white">
                <MenuBar editor={editor} />
                <EditorContent editor={editor} className="p-4 min-h-[100px] sm:min-h-[150px]" />
              </div>

              <FileUpload
                onFileSelect={(files) => setAttachments([...attachments, ...files])}
                selectedFiles={attachments}
                onRemoveFile={(index) => {
                  setAttachments(attachments.filter((_, i) => i !== index));
                }}
              />

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="relative w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="w-full sm:w-auto px-4 py-2 bg-yellow-400 text-white rounded-lg shadow hover:bg-yellow-500 transition-colors"
                  >
                    😊 Emoji
                  </button>
                  {showEmojiPicker && (
                    <div className="absolute mt-2 z-50">
                      <EmojiPicker onEmojiClick={handleEmojiClick} />
                    </div>
                  )}
                </div>

                <div className="w-full sm:w-auto">
                  <label className="flex items-center justify-center sm:justify-start">
                    <input
                      type="checkbox"
                      className="mr-2 w-4 h-4"
                      checked={isSilent}
                      onChange={() => setIsSilent(!isSilent)}
                    />
                    <span className="text-sm sm:text-base">Messaggio silenzioso</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isSending}
                  className={`w-full sm:w-auto px-6 py-2 rounded-lg shadow transition-colors ${
                    isSending
                      ? 'bg-blue-300 cursor-not-allowed'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  {isSending ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Invio in corso...
                    </span>
                  ) : (
                    isSilent ? 'Invia (Silenzioso)' : 'Invia'
                  )}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-3 sm:p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-800">
                Registro Messaggi
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({totalMessages} messaggi totali, pagina {currentPage} di {totalPages})
                </span>
              </h2>
              <button
                onClick={handleDeleteAll}
                className="px-4 py-2 bg-red-500 text-white rounded-lg shadow hover:bg-red-600 transition-colors"
              >
                Elimina Tutto
              </button>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Nessun messaggio trovato
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                          <span>{new Date(msg.sent_at).toLocaleString()}</span>
                          {currentUser?.isAdmin && (
                            <>
                              <span className="text-gray-300">•</span>
                              <span className="font-medium text-gray-600">
                                {msg.sender.username}
                              </span>
                              <span className="text-gray-300">•</span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {msg.channel.description || msg.channel.id}
                              </span>
                            </>
                          )}
                        </div>
                        <div
                          className="prose max-w-none"
                          dangerouslySetInnerHTML={{ __html: msg.message }}
                        />
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <div className="text-sm font-medium text-gray-700">Allegati:</div>
                            {msg.attachments.map((attachment, index) => {
                              const attachmentUrl = `${API_URL}/attachments/${attachment.filename}`;
                              
                              return (
                                <a
                                  key={index}
                                  href="#"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    const downloadAttachment = async () => {
                                      try {
                                        const token = localStorage.getItem('token');
                                        console.log('Tentativo di download:', attachmentUrl);
                                        
                                        const response = await fetch(attachmentUrl, {
                                          headers: {
                                            'Authorization': `Bearer ${token}`
                                          }
                                        });
                                        
                                        if (!response.ok) {
                                          const errorText = await response.text();
                                          console.error('Errore risposta server:', {
                                            status: response.status,
                                            statusText: response.statusText,
                                            errorText
                                          });
                                          throw new Error(`Errore nel download del file: ${response.status} ${response.statusText}`);
                                        }
                                        
                                        const blob = await response.blob();
                                        const url = window.URL.createObjectURL(blob);
                                        
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = attachment.originalName;
                                        document.body.appendChild(a);
                                        a.click();
                                        
                                        window.URL.revokeObjectURL(url);
                                        document.body.removeChild(a);
                                      } catch (error) {
                                        console.error('Errore dettagliato nel download:', error);
                                        alert(`Errore nel download del file: ${error.message}`);
                                      }
                                    };
                                    
                                    downloadAttachment();
                                  }}
                                  className="block text-blue-500 hover:text-blue-600"
                                >
                                  {attachment.originalName}
                                </a>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="ml-4 flex flex-col items-end">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            msg.status === "sent"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {msg.status === "sent" ? "Inviato ✉️" : "Errore ❌"}
                        </span>
                        <button
                          onClick={() => handleDelete(msg.id)}
                          className="mt-2 text-red-500 hover:text-red-600"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {totalPages > 1 && (
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className={`px-3 py-1 rounded ${
                        currentPage === 1
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                    >
                      <i className="fas fa-chevron-left"></i>
                    </button>

                    {[...Array(totalPages)].map((_, i) => {
                      const pageNum = i + 1;
                      // Mostra sempre la prima e l'ultima pagina
                      // Per le pagine intermedie, mostra solo quelle vicine alla pagina corrente
                      if (
                        pageNum === 1 ||
                        pageNum === totalPages ||
                        (pageNum >= currentPage - 2 && pageNum <= currentPage + 2)
                      ) {
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`px-3 py-1 rounded ${
                              currentPage === pageNum
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 hover:bg-gray-300'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      } else if (
                        pageNum === currentPage - 3 ||
                        pageNum === currentPage + 3
                      ) {
                        return <span key={pageNum} className="px-2">...</span>;
                      }
                      return null;
                    })}

                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className={`px-3 py-1 rounded ${
                        currentPage === totalPages
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                    >
                      <i className="fas fa-chevron-right"></i>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;