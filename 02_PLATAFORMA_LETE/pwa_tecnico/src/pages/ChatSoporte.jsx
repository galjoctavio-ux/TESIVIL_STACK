import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Send, User, Bot, Smartphone, HardHat, StickyNote, CheckCircle, ArrowLeft } from 'lucide-react';
// Si usas un Router como react-router-dom, usa esto para el botón de regresar
import { useNavigate } from 'react-router-dom';

// IMPORTANTE: Aquí apuntamos a la IP de la OTRA máquina (VM NUEVA)
const API_URL = 'https://api.tesivil.com/api';

const api = axios.create({ baseURL: API_URL });

const ChatSoporte = () => {
    const navigate = useNavigate(); // Hook para navegación
    const [conversations, setConversations] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [isInternal, setIsInternal] = useState(false);

    const messagesEndRef = useRef(null);

    // 1. Cargar Chats (Solo los de la bolsa de técnicos o asignados a técnicos)
    const fetchConversations = async () => {
        try {
            const res = await api.get('/conversations');
            // Filtramos en el cliente para mostrar solo lo relevante al técnico
            // (TECH_POOL = Bolsa de trabajo, TECH = Asignado a mí/colega)
            const techChats = res.data.filter(c => c.status === 'TECH_POOL' || c.assigned_to_role === 'TECH');
            setConversations(techChats);
        } catch (error) {
            console.error("Error conectando con CRM:", error);
        }
    };

    useEffect(() => {
        fetchConversations();
        const interval = setInterval(fetchConversations, 5000);
        return () => clearInterval(interval);
    }, []);

    // 2. Cargar Mensajes
    useEffect(() => {
        if (!selectedChat) return;
        const fetchMessages = async () => {
            try {
                const res = await api.get(`/conversations/${selectedChat.id}/messages`);
                setMessages(res.data);
                scrollToBottom();
            } catch (error) { console.error(error); }
        };
        fetchMessages();
        const interval = setInterval(fetchMessages, 3000);
        return () => clearInterval(interval);
    }, [selectedChat]);

    const scrollToBottom = () => {
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    };

    // 3. Enviar Mensaje
    const handleSend = async (e) => {
        e.preventDefault();
        if (!inputText.trim() || !selectedChat) return;
        const tempContent = inputText;
        setInputText('');

        try {
            // Si el chat estaba en POOL, al responder me lo asigno automáticamente
            if (selectedChat.status === 'TECH_POOL' && !isInternal) {
                await handleStatusChange('OPEN', 'TECH');
            }

            await api.post(`/conversations/${selectedChat.id}/send`, {
                content: tempContent,
                is_internal: isInternal
            });

            // Recargar mensajes
            const res = await api.get(`/conversations/${selectedChat.id}/messages`);
            setMessages(res.data);
            scrollToBottom();
            setIsInternal(false);
        } catch (error) {
            alert("Error enviando mensaje (Revisa conexión)");
            setInputText(tempContent);
        }
    };

    const handleStatusChange = async (newStatus, newRole) => {
        if (!selectedChat) return;
        try {
            await api.patch(`/conversations/${selectedChat.id}/status`, {
                status: newStatus,
                assigned_to_role: newRole
            });
            fetchConversations();
            setSelectedChat(prev => ({ ...prev, status: newStatus, assigned_to_role: newRole }));
        } catch (e) { console.error(e); }
    };

    // --- VISTA MÓVIL: LISTA DE CHATS ---
    if (!selectedChat) {
        return (
            <div className="flex flex-col h-screen bg-gray-50 pb-20"> {/* pb-20 para dejar espacio al menu inferior si existe */}
                {/* Header */}
                <div className="bg-white p-4 shadow-sm flex items-center gap-3 sticky top-0 z-10">
                    <button onClick={() => navigate(-1)} className="p-2">
                        <ArrowLeft className="text-gray-600" />
                    </button>
                    <h1 className="font-bold text-lg text-gray-800">Soporte Técnico</h1>
                </div>

                {/* Lista */}
                <div className="flex-1 overflow-y-auto p-2">
                    {conversations.length === 0 ? (
                        <div className="text-center mt-10 text-gray-400">
                            <HardHat className="mx-auto mb-2 opacity-20" size={48} />
                            <p>No hay casos pendientes</p>
                        </div>
                    ) : (
                        conversations.map(chat => (
                            <div
                                key={chat.id}
                                onClick={() => setSelectedChat(chat)}
                                className="bg-white p-4 rounded-lg shadow-sm mb-3 border-l-4 border-l-blue-500 active:bg-gray-100"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-gray-800">{chat.client_name || 'Cliente WhatsApp'}</h3>
                                    {chat.unread_count > 0 && <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">{chat.unread_count}</span>}
                                </div>
                                <div className="flex gap-2 mb-1">
                                    {chat.status === 'TECH_POOL' && <span className="bg-orange-100 text-orange-800 text-xs px-2 py-0.5 rounded font-bold">POR ASIGNAR</span>}
                                    {chat.assigned_to_role === 'TECH' && <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded flex items-center gap-1"><HardHat size={10} /> ASIGNADO</span>}
                                </div>
                                <p className="text-xs text-gray-400 text-right">
                                    {new Date(chat.last_interaction).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    }

    // --- VISTA MÓVIL: CHAT ABIERTO ---
    return (
        <div className="flex flex-col h-screen bg-[#e5ddd5] pb-0">
            {/* Header Chat */}
            <div className="bg-white p-3 shadow-sm flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <button onClick={() => setSelectedChat(null)} className="p-1">
                        <ArrowLeft className="text-gray-600" />
                    </button>
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                        <User size={16} />
                    </div>
                    <div>
                        <h2 className="font-bold text-sm text-gray-800 truncate w-32">{selectedChat.client_name}</h2>
                        <p className="text-[10px] text-green-600">WhatsApp Web</p>
                    </div>
                </div>

                {selectedChat.status === 'TECH_POOL' && (
                    <button
                        onClick={() => handleStatusChange('OPEN', 'TECH')}
                        className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded font-bold shadow-sm animate-pulse"
                    >
                        TOMAR CASO
                    </button>
                )}
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#e5ddd5]">
                {messages.map((msg) => {
                    const isClient = msg.sender_type === 'CLIENT';
                    const isInternalMsg = msg.is_internal;

                    return (
                        <div key={msg.id} className={`flex ${isClient ? 'justify-start' : 'justify-end'}`}>
                            <div className={`max-w-[85%] rounded-lg p-2 text-sm shadow-sm relative ${isInternalMsg ? 'bg-yellow-100 border border-yellow-300 text-gray-800' :
                                isClient ? 'bg-white text-gray-900 rounded-tl-none' :
                                    'bg-[#d9fdd3] text-gray-900 rounded-tr-none'
                                }`}>
                                {/* Label pequeño */}
                                {!isClient && (
                                    <p className="text-[9px] font-bold mb-1 opacity-60 flex gap-1 uppercase">
                                        {isInternalMsg ? <StickyNote size={9} /> : <HardHat size={9} />}
                                        {isInternalMsg ? 'Nota Interna' : 'Tú'}
                                    </p>
                                )}
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                                <p className="text-[9px] text-gray-400 text-right mt-1">
                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className={`p-2 pb-4 border-t ${isInternal ? 'bg-yellow-50' : 'bg-gray-100'}`}>
                <div className="flex justify-end mb-2">
                    <button
                        onClick={() => setIsInternal(!isInternal)}
                        className={`text-[10px] px-2 py-1 rounded-full font-bold border flex items-center gap-1 ${isInternal ? 'bg-yellow-200 border-yellow-400' : 'bg-white border-gray-300'}`}
                    >
                        {isInternal ? <StickyNote size={10} /> : <Send size={10} />}
                        {isInternal ? 'MODO NOTA PRIVADA' : 'MODO PÚBLICO'}
                    </button>
                </div>
                <form onSubmit={handleSend} className="flex gap-2">
                    <input
                        className="flex-1 p-2 rounded-full border border-gray-300 focus:outline-none focus:border-blue-500 text-sm"
                        placeholder={isInternal ? "Nota oculta..." : "Escribe al cliente..."}
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                    />
                    <button type="submit" className={`p-2 rounded-full text-white shadow-sm ${isInternal ? 'bg-yellow-600' : 'bg-blue-600'}`}>
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ChatSoporte;