
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Plus, Trash2, MessageSquare, Bot, User, Upload, Save, Bookmark, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

interface Chat {
  id: string;
  messages: Message[];
  title: string;
}

const ChatInterface = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [backendUrl] = useState('https://techmate-stage.vertekx.com');
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [savingStates, setSavingStates] = useState<{[key: string]: boolean}>({});
  const [liveSearchEnabled, setLiveSearchEnabled] = useState(false);
  const [selectedText, setSelectedText] = useState<{text: string, messageIndex: number} | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chats]);

  const makeRequest = async (url: string, options: RequestInit = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        mode: 'cors'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response;
    } catch (error) {
      console.error('Request failed:', error);
      throw error;
    }
  };

  const loadChats = useCallback(async () => {
    if (isLoadingChats) return; // Prevent multiple simultaneous requests
    
    setIsLoadingChats(true);
    try {
      console.log('Loading chats from:', `${backendUrl}/chats/`);
      const response = await makeRequest(`${backendUrl}/chats/`);
      const data = await response.json();
      
      console.log('Received chats data:', data);
      
      if (data.chat_ids && Array.isArray(data.chat_ids)) {
        const loadedChats = data.chat_ids.map((chatId: string, index: number) => ({
          id: chatId,
          messages: [],
          title: `Chat ${index + 1}`
        }));
        setChats(loadedChats);
        console.log('Updated chats state:', loadedChats);
      } else {
        console.log('No chat_ids found in response');
        setChats([]);
      }
    } catch (error) {
      console.error('Failed to load chats:', error);
      setChats([]);
      toast({
        title: "Info",
        description: "Starting with a fresh session. Create your first chat!",
      });
    } finally {
      setIsLoadingChats(false);
    }
  }, [backendUrl, isLoadingChats]);

  // Load chats when component mounts
  useEffect(() => {
    loadChats();
  }, []);

  const currentChat = chats.find(chat => chat.id === currentChatId);

  const createNewChat = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      console.log('Creating new chat...');
      const response = await makeRequest(`${backendUrl}/create_chat/`, {
        method: 'POST'
      });
      
      const data = await response.json();
      console.log('New chat created:', data);
      
      if (data.chat_id) {
        const newChat: Chat = {
          id: data.chat_id,
          messages: [],
          title: `Chat ${chats.length + 1}`
        };
        setChats(prev => [...prev, newChat]);
        setCurrentChatId(data.chat_id);
        toast({
          title: "New chat created",
          description: "Ready to start chatting!",
        });
      }
    } catch (error) {
      console.error('Create chat error:', error);
      toast({
        title: "Error",
        description: "Failed to create new chat. Please check your backend URL in settings.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteChat = async (chatId: string) => {
    try {
      const response = await makeRequest(`${backendUrl}/chats/${chatId}/`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setChats(prev => prev.filter(chat => chat.id !== chatId));
        if (currentChatId === chatId) {
          setCurrentChatId(null);
        }
        toast({
          title: "Chat deleted",
          description: "Chat removed successfully",
        });
      }
    } catch (error) {
      console.error('Delete chat error:', error);
      toast({
        title: "Error",
        description: "Failed to delete chat",
        variant: "destructive"
      });
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !currentChatId || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: message,
      isUser: true,
      timestamp: new Date()
    };

    setChats(prev => prev.map(chat => 
      chat.id === currentChatId 
        ? { ...chat, messages: [...chat.messages, userMessage] }
        : chat
    ));

    const currentMessage = message;
    setMessage('');
    setIsLoading(true);

    try {
      // Use web search if live search is enabled, otherwise use normal chat
      const endpoint = liveSearchEnabled ? `search/${currentChatId}` : `query/${currentChatId}`;
      const body = liveSearchEnabled 
        ? JSON.stringify({ query: currentMessage })
        : JSON.stringify({ user_query: currentMessage });

      const response = await makeRequest(`${backendUrl}/${endpoint}/`, {
        method: 'POST',
        body: body
      });

      const data = await response.json();
      
      const responseContent = data.result || data.response;
      if (responseContent) {
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: responseContent,
          isUser: false,
          timestamp: new Date()
        };

        setChats(prev => prev.map(chat => 
          chat.id === currentChatId 
            ? { ...chat, messages: [...chat.messages, botMessage] }
            : chat
        ));
      }
    } catch (error) {
      console.error('Send message error:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please check your backend connection.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const uploadFiles = async (files: FileList) => {
    if (!files.length) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch(`${backendUrl}/upload_documents/`, {
        method: 'POST',
        body: formData,
        mode: 'cors'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      toast({
        title: "Upload successful",
        description: data.message || "Documents uploaded and added to knowledge base",
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload documents. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const saveSpecificResponse = async (messageIndex: number) => {
    if (!currentChatId) return;

    // Convert frontend message index to backend conversation pair index
    // Since only bot messages have save buttons (odd indices: 1, 3, 5...)
    // We need to calculate which conversation pair this bot response belongs to
    // Frontend: [user0, bot1, user2, bot3, user4, bot5] -> indices: 0,1,2,3,4,5
    // Backend: [(user0,bot1), (user2,bot3), (user4,bot5)] -> indices: 0,1,2
    // So bot message at index N maps to conversation pair index Math.floor(N/2)
    const conversationIndex = Math.floor(messageIndex / 2);

    const saveKey = `${currentChatId}-${messageIndex}`;
    setSavingStates(prev => ({ ...prev, [saveKey]: true }));

    try {
      const response = await makeRequest(`${backendUrl}/save_specific_response/${currentChatId}/`, {
        method: 'POST',
        body: JSON.stringify({ message_index: conversationIndex })
      });

      const data = await response.json();
      toast({
        title: "Response saved",
        description: data.message || "Response saved to knowledge base",
      });
    } catch (error) {
      console.error('Save specific response error:', error);
      toast({
        title: "Save failed",
        description: "Failed to save response. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSavingStates(prev => ({ ...prev, [saveKey]: false }));
    }
  };

  const saveSelectedText = async (messageIndex: number, text: string) => {
    if (!currentChatId || !text.trim()) return;

    const conversationIndex = Math.floor(messageIndex / 2);
    const saveKey = `${currentChatId}-${messageIndex}-selected`;
    setSavingStates(prev => ({ ...prev, [saveKey]: true }));

    try {
      const response = await makeRequest(`${backendUrl}/save_selected_text/${currentChatId}/`, {
        method: 'POST',
        body: JSON.stringify({ 
          message_index: conversationIndex,
          selected_text: text
        })
      });

      const data = await response.json();
      toast({
        title: "Selected text saved",
        description: data.message || "Selected text saved to knowledge base",
      });
      setSelectedText(null);
    } catch (error) {
      console.error('Save selected text error:', error);
      toast({
        title: "Save failed",
        description: "Failed to save selected text. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSavingStates(prev => ({ ...prev, [saveKey]: false }));
    }
  };

  const handleTextSelection = (messageIndex: number) => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      setSelectedText({
        text: selection.toString().trim(),
        messageIndex
      });
    } else {
      setSelectedText(null);
    }
  };

  const searchWeb = async () => {
    if (!message.trim() || !currentChatId) return;

    setIsLoading(true);
    console.log('Calling search endpoint:', `${backendUrl}/search/${currentChatId}/`);
    try {
      const response = await makeRequest(`${backendUrl}/search/${currentChatId}/`, {
        method: 'POST',
        body: JSON.stringify({ query: message })
      });

      const data = await response.json();
      
      if (data.result) {
        const searchMessage: Message = {
          id: Date.now().toString(),
          content: `🔍 Search: ${message}`,
          isUser: true,
          timestamp: new Date()
        };

        const searchResult: Message = {
          id: (Date.now() + 1).toString(),
          content: data.result,
          isUser: false,
          timestamp: new Date()
        };

        if (currentChatId) {
          setChats(prev => prev.map(chat => 
            chat.id === currentChatId 
              ? { ...chat, messages: [...chat.messages, searchMessage, searchResult] }
              : chat
          ));
        }

        setMessage('');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Search failed",
        description: "Failed to perform web search. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      uploadFiles(files);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };


  return (
    <div className="h-screen flex bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Sidebar */}
      <div className="w-80 bg-white/80 backdrop-blur-sm border-r border-white/20 shadow-xl">
        <div className="p-4 border-b border-white/20 bg-gradient-to-r from-blue-600 to-purple-600">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Bot className="w-6 h-6" />
              TeachMate-AI
            </h1>
          </div>
          <Button
            onClick={createNewChat}
            disabled={isLoading}
            className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30 mb-2"
            variant="outline"
          >
            <Plus className="w-4 h-4 mr-2" />
            {isLoading ? 'Creating...' : 'New Chat'}
          </Button>
          
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30"
            variant="outline"
          >
            <Upload className="w-4 h-4 mr-2" />
            {isUploading ? 'Uploading...' : 'Upload Documents'}
          </Button>
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-2">
            {isLoadingChats ? (
              <div className="text-center py-8 text-gray-500">
                <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-sm">Loading chats...</p>
              </div>
            ) : chats.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No chats yet</p>
                <p className="text-xs">Click "New Chat" to start</p>
              </div>
            ) : (
              chats.map(chat => (
                <Card
                  key={chat.id}
                  className={`p-3 cursor-pointer transition-all duration-200 hover:shadow-md ${
                    currentChatId === chat.id 
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg' 
                      : 'bg-white/60 hover:bg-white/80'
                  }`}
                  onClick={() => setCurrentChatId(chat.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <MessageSquare className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate text-sm font-medium">{chat.title}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteChat(chat.id);
                      }}
                      className={`ml-2 h-6 w-6 p-0 ${
                        currentChatId === chat.id 
                          ? 'text-white hover:bg-white/20' 
                          : 'text-gray-500 hover:text-red-500 hover:bg-red-50'
                      }`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  {chat.messages.length > 0 && (
                    <Badge 
                      variant="secondary" 
                      className={`mt-2 text-xs ${
                        currentChatId === chat.id 
                          ? 'bg-white/20 text-white' 
                          : 'bg-gray-100'
                      }`}
                    >
                      {chat.messages.length} messages
                    </Badge>
                  )}
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {currentChat ? (
          <>
            {/* Chat Header */}
            <div className="p-4 bg-white/80 backdrop-blur-sm border-b border-white/20 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-800">{currentChat.title}</h2>
                  <p className="text-sm text-gray-500">AI Research Assistant</p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4 max-w-4xl mx-auto">
                {currentChat.messages.length === 0 ? (
                  <div className="text-center py-12">
                    <Bot className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-medium text-gray-600 mb-2">Start the conversation</h3>
                    <p className="text-gray-500">Ask me anything about consumer behavior, ageing, or wellbeing</p>
                  </div>
                ) : (
                  currentChat.messages.map((msg, index) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${msg.isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      {!msg.isUser && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-4 h-4 text-white" />
                        </div>
                      )}
                      <div className="flex-1 max-w-[70%]">
                        <div
                          className={`p-4 rounded-2xl shadow-sm ${
                            msg.isUser
                              ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                              : 'bg-white/80 backdrop-blur-sm text-gray-800 border border-white/20'
                          }`}
                        >
                          <p 
                            className="whitespace-pre-wrap leading-relaxed select-text"
                            onMouseUp={() => !msg.isUser && handleTextSelection(index)}
                            onKeyUp={() => !msg.isUser && handleTextSelection(index)}
                          >
                            {msg.content}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <p className={`text-xs ${msg.isUser ? 'text-blue-100' : 'text-gray-500'}`}>
                              {msg.timestamp.toLocaleTimeString()}
                            </p>
                            {!msg.isUser && (
                              <div className="flex gap-1">
                                {/* Save Selected Text Button */}
                                {selectedText && selectedText.messageIndex === index && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => saveSelectedText(selectedText.messageIndex, selectedText.text)}
                                    disabled={savingStates[`${currentChatId}-${index}-selected`]}
                                    className="h-6 w-6 p-0 text-orange-500 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                                    title={`Save selected text: "${selectedText.text.slice(0, 30)}..."`}
                                  >
                                    {savingStates[`${currentChatId}-${index}-selected`] ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Bookmark className="w-3 h-3" />
                                    )}
                                  </Button>
                                )}
                                {/* Save Full Response Button */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => saveSpecificResponse(index)}
                                  disabled={savingStates[`${currentChatId}-${index}`]}
                                  className="h-6 w-6 p-0 text-green-500 hover:text-green-600 hover:bg-green-50 transition-colors"
                                  title="Save entire response to knowledge base"
                                >
                                  {savingStates[`${currentChatId}-${index}`] ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Save className="w-3 h-3" />
                                  )}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {msg.isUser && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-teal-500 flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                  ))
                )}
                {isLoading && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-white/20">
                      <div className="flex space-x-2">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 bg-white/80 backdrop-blur-sm border-t border-white/20">
              <div className="max-w-4xl mx-auto">
                <div className="flex gap-3 items-end">
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask me anything"
                    className="flex-1 bg-white/60 border-white/20 focus:bg-white/80 transition-all duration-200 min-h-[60px] max-h-40 resize-none"
                    disabled={isLoading}
                    rows={3}
                  />
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="font-medium">Live Search</span>
                      <Switch
                        checked={liveSearchEnabled}
                        onCheckedChange={setLiveSearchEnabled}
                        className="data-[state=checked]:bg-blue-500"
                      />
                    </div>
                    <Button
                      onClick={sendMessage}
                      disabled={!message.trim() || isLoading}
                      className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <Bot className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-700 mb-2">Welcome to TeachMate-AI</h2>
              <p className="text-gray-500 mb-6">Your AI teaching assistant for consumer behavior, ageing, and wellbeing</p>
              <Button
                onClick={createNewChat}
                disabled={isLoading}
                className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg"
              >
                <Plus className="w-4 h-4 mr-2" />
                {isLoading ? 'Creating...' : 'Start New Chat'}
              </Button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default ChatInterface;
