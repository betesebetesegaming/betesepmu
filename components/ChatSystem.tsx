
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, ChatThread, ChatMessage } from '../types';

// --- Broadcast Notification Modal ---
interface BroadcastNotificationModalProps {
  message: ChatMessage;
  onClose: () => void;
}

export const BroadcastNotificationModal: React.FC<BroadcastNotificationModalProps> = ({ message, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-lg shadow-2xl w-full max-w-md transform transition-all animate-fade-in-up">
        <h3 className="text-xl font-bold text-betese-dark mb-2">New Broadcast Message</h3>
        <div className="p-4 bg-gray-50 rounded-lg border my-4">
            <p className="text-sm text-gray-500">From: <span className="font-semibold">{message.senderName}</span></p>
            <p className="mt-2 text-gray-800">{message.content}</p>
        </div>
        <button
          onClick={onClose}
          className="w-full px-4 py-2 bg-betese-green text-white font-semibold rounded-lg hover:bg-green-700"
        >
          Dismiss
        </button>
      </div>
       <style>{`
        @keyframes fade-in-up {
            0% { opacity: 0; transform: translateY(20px); }
            100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.5s ease-out forwards; }
      `}</style>
    </div>
  );
};

// --- New Message Modal (Internal to ChatPanel) ---
const NewMessageModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    vendors: User[];
    onSend: (recipients: string[], content: string) => void;
}> = ({ isOpen, onClose, vendors, onSend }) => {
    const [recipient, setRecipient] = useState('ALL_VENDORS');
    const [content, setContent] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim()) return;
        onSend([recipient], content);
        setContent('');
        onClose();
    };

    return (
        <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center z-30" onClick={onClose}>
            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-betese-dark mb-4">New Message</h3>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="recipient" className="block text-sm font-medium text-gray-700">To:</label>
                        <select
                            id="recipient"
                            value={recipient}
                            onChange={e => setRecipient(e.target.value)}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-betese-green focus:border-betese-green sm:text-sm rounded-md"
                        >
                            <option value="ALL_VENDORS">All Vendors (Broadcast)</option>
                            <option value="BACK_OFFICE">Back Office</option>
                            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="message-content" className="block text-sm font-medium text-gray-700">Message:</label>
                        <textarea
                            id="message-content"
                            rows={4}
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            className="mt-1 shadow-sm focus:ring-betese-green focus:border-betese-green block w-full sm:text-sm border border-gray-300 rounded-md"
                            placeholder="Type your message here..."
                        />
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-betese-green text-white rounded-md hover:bg-green-700">Send</button>
                </div>
            </form>
        </div>
    );
};


const MessagePanel: React.FC<{
    thread: ChatThread | null;
    messages: ChatMessage[];
    currentUser: User;
    onSend: (content: string, audioData?: { base64: string, duration: number }) => void;
    onBack?: () => void;
    onClose?: () => void;
    isMobile?: boolean;
}> = ({ thread, messages, currentUser, onSend, onBack, onClose, isMobile = false }) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [message, setMessage] = useState('');
    
    // Voice message state
    const [isRecording, setIsRecording] = useState(false);
    const [recordedAudio, setRecordedAudio] = useState<{ url: string; blob: Blob; duration: number } | null>(null);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordingIntervalRef = useRef<number | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // Playback state
    const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);
    
    useEffect(() => {
        // Cleanup audio player when component unmounts or thread changes
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
                setCurrentlyPlaying(null);
            }
        };
    }, [thread]);

    const formatDuration = (seconds: number) => {
        const min = Math.floor(seconds / 60);
        const sec = seconds % 60;
        return `${min}:${String(sec).padStart(2, '0')}`;
    };

    const handleStartRecording = async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert("Audio recording is not supported in this browser or context.");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Determine best supported mime type (Chrome uses webm, Safari uses mp4)
            let options: any = { mimeType: 'audio/webm' };
            if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
                if (!MediaRecorder.isTypeSupported('audio/webm')) {
                    if (MediaRecorder.isTypeSupported('audio/mp4')) {
                        options = { mimeType: 'audio/mp4' };
                    } else {
                        // Fallback to browser default if neither is explicitly supported
                        options = {}; 
                    }
                }
            }

            mediaRecorderRef.current = new MediaRecorder(stream, options);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current.onstop = () => {
                const mimeType = mediaRecorderRef.current?.mimeType || options.mimeType || 'audio/webm';
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                const audioUrl = URL.createObjectURL(audioBlob);
                setRecordedAudio({ url: audioUrl, blob: audioBlob, duration: recordingDuration });
                
                // Important: Stop all audio tracks to release the microphone
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordingDuration(0);
            recordingIntervalRef.current = window.setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);

        } catch (err: any) {
            console.error("Error accessing microphone:", err);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                alert("Microphone access was denied. Please grant permission in your browser settings.");
            } else if (err.name === 'NotFoundError') {
                alert("No microphone found on this device.");
            } else {
                alert(`Microphone Error: ${err.message}`);
            }
        }
    };

    const handleStopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
        }
        if (recordingIntervalRef.current) {
            clearInterval(recordingIntervalRef.current);
            recordingIntervalRef.current = null;
        }
        setIsRecording(false);
    };

    const handleCancelAudio = () => {
        if (recordedAudio) {
            URL.revokeObjectURL(recordedAudio.url);
        }
        setRecordedAudio(null);
        setRecordingDuration(0);
    };

    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = (reader.result as string).split(',')[1];
                resolve(base64String);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const handleSendAudio = async () => {
        if (recordedAudio) {
            const base64 = await blobToBase64(recordedAudio.blob);
            onSend('', { base64, duration: recordedAudio.duration });
            handleCancelAudio();
        }
    };

    const handleSendText = (e: React.FormEvent) => {
        e.preventDefault();
        if (message.trim()) {
            onSend(message);
            setMessage('');
        }
    };

    const handlePlayAudio = (messageId: string, base64: string) => {
        if (currentlyPlaying === messageId) {
            if (audioRef.current) {
                audioRef.current.pause();
                setCurrentlyPlaying(null);
            }
        } else {
            if (audioRef.current) {
                audioRef.current.pause();
            }
            // Determine type based on simple check or default (audio/webm covers most, but some might fail if mp4 was sent)
            // Since we store base64, we assume webm for simplicity in playback unless we stored type. 
            // Modern browsers are good at detecting container in blob/src.
            const audioSrc = `data:audio/webm;base64,${base64}`;
            audioRef.current = new Audio(audioSrc);
            audioRef.current.play().catch(e => {
                console.error("Audio play failed, trying mp4 fallback:", e);
                // Fallback for Safari generated content if webm fails
                const audioSrcMp4 = `data:audio/mp4;base64,${base64}`;
                audioRef.current = new Audio(audioSrcMp4);
                audioRef.current.play().catch(err => console.error("Audio play failed completely:", err));
            });
            
            if (audioRef.current) {
                audioRef.current.onended = () => {
                    setCurrentlyPlaying(null);
                };
            }
            setCurrentlyPlaying(messageId);
        }
    };

    const AudioMessage: React.FC<{ msg: ChatMessage }> = ({ msg }) => {
        if (!msg.audioBase64 || msg.audioDuration === undefined) return null;
        const isPlaying = currentlyPlaying === msg.id;

        return (
            <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-blue-100 max-w-xs">
                <button onClick={() => handlePlayAudio(msg.id, msg.audioBase64!)} className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center flex-shrink-0 transition-transform transform hover:scale-110">
                    {isPlaying ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                    )}
                </button>
                <div className="h-1.5 bg-blue-300 rounded-full flex-grow"></div>
                <span className="text-xs font-mono text-blue-800 tabular-nums">{formatDuration(msg.audioDuration)}</span>
            </div>
        );
    };

    if (!thread) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-500">
                <p>Select a conversation to start chatting.</p>
            </div>
        );
    }
    
    return (
        <div className="flex-1 flex flex-col bg-gray-50">
            <div className="p-4 border-b bg-white flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    {isMobile && onBack && (
                        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100" aria-label="Back to conversations">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        </button>
                    )}
                    <h3 className="font-bold text-lg truncate">{thread.name || messages.find(m => m.senderId !== currentUser.id)?.senderName || 'Conversation'}</h3>
                </div>
                {onClose && (
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100" aria-label="Close chat">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </button>
                )}
            </div>
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {messages.map(msg => {
                    const isSender = msg.senderId === currentUser.id;
                    return (
                        <div key={msg.id} className={`flex ${isSender ? 'justify-end' : 'justify-start'}`}>
                            <div className="flex flex-col">
                                <div className={`p-3 rounded-lg max-w-lg ${isSender ? 'bg-betese-green text-white' : 'bg-white shadow-sm'}`}>
                                    <p className={`text-xs font-bold mb-1 ${isSender ? 'text-yellow-300' : 'text-betese-dark'}`}>{isSender ? 'You' : msg.senderName}</p>
                                    {msg.contentType === 'audio' ? <AudioMessage msg={msg} /> : <p className="text-sm">{msg.content}</p>}
                                </div>
                                <p className="text-xs text-gray-400 mt-1 px-1">{new Date(msg.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-4 bg-white border-t">
                {isRecording ? (
                    <div className="flex items-center gap-4">
                        <span className="text-red-500 font-bold font-mono animate-pulse">Recording...</span>
                        <span className="text-lg font-mono tabular-nums">{formatDuration(recordingDuration)}</span>
                        <button onClick={handleStopRecording} className="ml-auto p-3 rounded-full bg-red-500 text-white hover:bg-red-600">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                        </button>
                    </div>
                ) : recordedAudio ? (
                    <div className="flex items-center gap-3">
                        <audio src={recordedAudio.url} controls className="hidden" />
                        <span className="font-semibold">Voice message ({formatDuration(recordedAudio.duration)})</span>
                        <button onClick={handleCancelAudio} className="p-2 rounded-full hover:bg-gray-200">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                        </button>
                        <button onClick={handleSendAudio} className="ml-auto p-3 rounded-full bg-betese-green text-white hover:bg-green-700">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSendText} className="flex items-center gap-3">
                        <input
                            type="text"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Type a message..."
                            className="flex-1 p-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-betese-green"
                            aria-label="Chat message input"
                        />
                         {message ? (
                            <button type="submit" className="p-3 rounded-full bg-betese-green text-white hover:bg-green-700" aria-label="Send message">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                            </button>
                         ) : (
                            <button type="button" onClick={handleStartRecording} className="p-3 rounded-full bg-gray-600 text-white hover:bg-gray-700" aria-label="Record voice message">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 017 8a1 1 0 10-2 0 7.001 7.001 0 006 6.93V17H9a1 1 0 100 2h2a1 1 0 100-2v-2.07z" clipRule="evenodd" /></svg>
                            </button>
                         )}
                    </form>
                )}
            </div>
        </div>
    );
};


const ThreadList: React.FC<{
    threads: ChatThread[];
    messages: ChatMessage[];
    currentUser: User;
    activeThreadId: string | null;
    onSelectThread: (threadId: string) => void;
    onNewMessage: () => void;
    onClose?: () => void;
}> = ({ threads, messages, currentUser, activeThreadId, onSelectThread, onNewMessage, onClose }) => {
    
    const getThreadDisplayNameAndParticipants = (thread: ChatThread) => {
        if (thread.isBroadcast) {
            return { name: thread.name || "Broadcast", participants: "All Vendors" };
        }
        const otherParticipantIds = thread.participantIds.filter(id => id !== currentUser.id && id !== 'ALL_VENDORS');
        
        if (otherParticipantIds.includes('BACK_OFFICE')) {
             return { name: "Back Office", participants: "Internal Support" };
        }

        const otherUser = messages.find(m => m.threadId === thread.id && m.senderId !== currentUser.id);
        const name = otherUser?.senderName || "Conversation";

        return { name, participants: "Direct Message" };
    };
    
    const sortedThreads = [...threads].sort((a,b) => (b.lastMessageTimestamp?.getTime() || 0) - (a.lastMessageTimestamp?.getTime() || 0));

    return (
        <div className="w-80 border-r flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
                <h2 className="font-bold text-xl">Messages</h2>
                <div className="flex items-center gap-2">
                    <button onClick={onNewMessage} className="p-2 rounded-full hover:bg-gray-100" aria-label="New message">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                    </button>
                    {onClose && (
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100" aria-label="Close chat">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        </button>
                    )}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto">
                {sortedThreads.map(thread => {
                    const { name } = getThreadDisplayNameAndParticipants(thread);
                    const lastMessage = messages.filter(m => m.threadId === thread.id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                    const isUnread = lastMessage && !lastMessage.readByIds.includes(currentUser.id) && lastMessage.senderId !== currentUser.id;

                    return (
                        <div
                            key={thread.id}
                            onClick={() => onSelectThread(thread.id)}
                            className={`p-4 border-b cursor-pointer ${activeThreadId === thread.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                        >
                            <div className="flex justify-between items-center">
                                <h3 className={`font-bold ${isUnread ? 'text-betese-dark' : 'text-gray-800'}`}>{name}</h3>
                                {isUnread && <span className="w-3 h-3 bg-blue-500 rounded-full"></span>}
                            </div>
                            <p className={`text-sm truncate ${isUnread ? 'font-semibold text-gray-700' : 'text-gray-500'}`}>
                                {lastMessage ? lastMessage.content : 'No messages yet.'}
                            </p>
                        </div>
                    )
                })}
            </div>
        </div>
    );
};


// --- Main Chat Panel ---
interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  users: User[];
  threads: ChatThread[];
  messages: ChatMessage[];
  onSendMessage: (threadId: string | 'new', content: string, recipients: string[], audioData?: { base64: string, duration: number }) => void;
  onMarkAsRead: (threadId: string) => void;
}


export const ChatPanel: React.FC<ChatPanelProps> = ({ isOpen, onClose, currentUser, users, threads, messages, onSendMessage, onMarkAsRead }) => {
    const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
    const [isNewMessageModalOpen, setIsNewMessageModalOpen] = useState(false);
    const [isMobile, setIsMobile] = useState<boolean>(() => window.innerWidth < 768);
    
    const userThreads = useMemo(() => {
        return threads.filter(thread => {
            if (thread.participantIds.includes(currentUser.id)) return true;
            if (currentUser.role === 'Vendor' && thread.participantIds.includes('ALL_VENDORS')) return true;
            if (['Admin', 'Supervisor'].includes(currentUser.role)) {
                // Admins/Supervisors are part of "BACK_OFFICE"
                if(thread.participantIds.includes('BACK_OFFICE')) return true;
                // And can see all broadcast threads
                if(thread.isBroadcast) return true;
            }
            return false;
        });
    }, [threads, currentUser]);

    const activeThread = useMemo(() => userThreads.find(t => t.id === activeThreadId), [userThreads, activeThreadId]);
    const activeThreadMessages = useMemo(() => messages.filter(m => m.threadId === activeThreadId), [messages, activeThreadId]);

    useEffect(() => {
        if(activeThreadId) {
            onMarkAsRead(activeThreadId);
        }
    }, [activeThreadId, messages, onMarkAsRead]);

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const handleSendMessage = (content: string, audioData?: { base64: string, duration: number }) => {
        if (activeThreadId) {
            onSendMessage(activeThreadId, content, [], audioData);
        }
    };

     const handleSendNewMessage = (recipients: string[], content: string) => {
        onSendMessage('new', content, recipients);
    };

    if (!isOpen) return null;

    const handleSelectThread = (threadId: string) => {
        setActiveThreadId(threadId);
    };

    const shouldShowThreads = !isMobile || !activeThreadId;
    const shouldShowMessages = !isMobile || Boolean(activeThreadId);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-30 z-40 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full h-full max-w-4xl max-h-[95vh] flex overflow-hidden" onClick={e => e.stopPropagation()}>
                <NewMessageModal 
                    isOpen={isNewMessageModalOpen}
                    onClose={() => setIsNewMessageModalOpen(false)}
                    vendors={users.filter(u => u.role === 'Vendor')}
                    onSend={handleSendNewMessage}
                />
                {shouldShowThreads && (
                    <ThreadList 
                        threads={userThreads}
                        messages={messages}
                        currentUser={currentUser}
                        activeThreadId={activeThreadId}
                        onSelectThread={handleSelectThread}
                        onNewMessage={() => setIsNewMessageModalOpen(true)}
                        onClose={onClose}
                    />
                )}
                {shouldShowMessages && (
                    <MessagePanel 
                        thread={activeThread || null}
                        messages={activeThreadMessages}
                        currentUser={currentUser}
                        onSend={handleSendMessage}
                        onBack={isMobile ? () => setActiveThreadId(null) : undefined}
                        onClose={onClose}
                        isMobile={isMobile}
                    />
                )}
            </div>
        </div>
    );
};
