import React, { useEffect, useState, useRef } from 'react';
import { getChatHistory } from '../apiService';
import './ChatModal.css';

const ChatModal = ({ cliente, onClose }) => {
    const [mensajes, setMensajes] = useState([]);
    const [loading, setLoading] = useState(true);
    const scrollRef = useRef(null);

    useEffect(() => {
        const fetchChat = async () => {
            if (!cliente) return;
            try {
                const data = await getChatHistory(cliente.cliente_id);
                setMensajes(data);
            } catch (error) {
                console.error("Error cargando chat", error);
            } finally {
                setLoading(false);
            }
        };
        fetchChat();
    }, [cliente]);

    // Auto-scroll al final
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [mensajes]);

    if (!cliente) return null;

    return (
        <div className="chat-modal-overlay" onClick={onClose}>
            <div className="chat-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="chat-header">
                    <h3>Chat con {cliente.nombre_completo}</h3>
                    <button onClick={onClose} className="close-btn">×</button>
                </div>

                <div className="chat-body" ref={scrollRef}>
                    {loading ? <p className="loading">Cargando conversación...</p> : (
                        mensajes.length === 0 ? <p className="empty">No hay mensajes registrados.</p> :
                            mensajes.map((msg) => (
                                <div key={msg.id} className={`chat-bubble ${msg.role === 'assistant' ? 'me' : 'them'}`}>
                                    <div className="text">{msg.content}</div>
                                    <div className="meta">
                                        {new Date(msg.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}
                                        {msg.status && <span> • {msg.status}</span>}
                                    </div>
                                </div>
                            ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChatModal;