'use client'
import { useState, useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import Search from '../components/ui/search';
import FriendList from '../components/ui/friendlist';
import FriendRequests from '../components/ui/friendrequest';
import { axiosInstance } from '@/utils/axios';


export default function ChatPage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [username, setUsername] = useState('');

  interface Message {
    sender: { username: string };
    text: string;
    timestamp: number;
  }
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState<Message | null>(null);
  const [currentChat, setCurrentChat] = useState<{ type: 'user' | 'room'; id: string } | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setToken(localStorage.getItem('token'));
  }, []);

  useEffect(() => {
    if (!token) return;
    const newSocket = io('http://localhost:3001', { query: { token } });
    setSocket(newSocket);

    newSocket.on('connected', (data) => {
      console.log('Connected to socket server');
      setUsername(data.username);
    });

    newSocket.on('newMessage', (message) => {
      setMessages((prev) => [
        ...prev,
        {
          sender: { username: message.sender },
          text: message.text,
          timestamp: message.timestamp,
        },
      ]);
      setNewMessage({
        sender: { username: message.sender },
        text: message.text,
        timestamp: message.timestamp,
      });
    });

    newSocket.on('friendRequest', (data) => {
      alert(data.message);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [token]);

  useEffect(() => {
    if (currentChat) {
      const fetchHistory = async () => {
        try {
          const res = await axiosInstance.get(
            `chat/history?type=${currentChat.type}&id=${currentChat.id}`,
          );
          setMessages(res.data);
        } catch (err) {
          console.error('Failed to fetch chat history:', err);
        }
      };
      fetchHistory();

      if (currentChat.type === 'room') {
        socket?.emit('joinRoom', currentChat.id);
      }
    }
  }, [currentChat, socket, token]);

  const sendMessage = () => {
    if (socket && currentChat && messageInput.trim()) {
      socket.emit('sendMessage', {
        recipientType: currentChat.type,
        recipientId: currentChat.id,
        text: messageInput,
      });
      const newMessage = {
        sender: { username },
        text: messageInput,
        timestamp: Date.now(),
      };
      setNewMessage(newMessage);
      setMessageInput('');
      setMessages((prev) => [
        ...prev,
        newMessage,
      ]);
    }
  };


  useEffect(() => {
    //animate scroll to bottom
    chatRef.current?.scrollTo({
      top: chatRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages]);
  return (
    <div className="flex h-screen">
      <div className="border-r border-gray-300/10 p-4 flex flex-col w-fit h-full justify-start">
        <Search socket={socket} />
        <div className='border' />
        <FriendList newMessage={newMessage ? newMessage : undefined} setChatWith={setCurrentChat as (arg0: { type: 'user' | 'room'; id: string }) => void} />
        <div className='border' />
        <FriendRequests socket={socket} />
        <div className='border' />
        <button
          onClick={() => setCurrentChat({ type: 'room', id: 'general' })}
          className="mt-4 w-full px-4 py-2 bg-[#a3a3a342] hover:bg-[#dadada42] text-white rounded  self-end"
        >
          Join General Room
        </button>
      </div>
      <div className="flex-1 flex flex-col">
        {currentChat ? (
          <>
            <div ref={chatRef} className="flex flex-col gap-2 w-full p-4 overflow-auto justify-start h-full">
              {messages.map((msg, idx) => (
                <div key={idx} className={`${msg.sender.username === username ? 'self-end bg-[#d4d4d442] rounded-l-xl rounded-br-xl' : 'bg-[#141414] rounded-r-xl rounded-bl-xl self-start text-white'} max-w-[50%] p-4`}>
                  <p className="mb-1">{msg.text}</p>
                  <p className="text-xs">
                    {new Date(msg.timestamp).toLocaleString()}
                  </p>
                </div>
              ))}
              {
                !messages.length && <div className='flex justify-center'>No messages yet</div>
              }
            </div>
            <div className="p-4 border-t border-gray-300/10 flex items-center w-full justify-between self-end">
              <textarea
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Type a message"
                onKeyDown={(e) => e.key === 'Enter' && e.shiftKey && sendMessage()}
                className="w-full p-2 rounded-md text-black max-h-24 h-12 bg-slate-600"
              />
              <button
                onClick={sendMessage}
                className="ml-2 px-8 py-2 bg-[#a3a3a342] hover:bg-[#dadada42] text-white rounded  h-full"
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            Select a chat to start messaging
          </div>
        )}
      </div>
    </div>
  );
}
