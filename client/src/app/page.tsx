'use client'
import { useState, useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import SimplePeer from 'simple-peer';
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

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState('');
  const [callerSignal, setCallerSignal] = useState<SimplePeer.SignalData | null>(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [peer, setPeer] = useState<SimplePeer.Instance | null>(null);

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

    newSocket.on('callUser', (data) => {
      setReceivingCall(true);
      setCaller(data.from);
      setCallerSignal(data.signal);
    });

    newSocket.on('endCall', () => {
      endCall();
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

  const callUser = (id: string) => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
      setStream(stream);
      const peer = new SimplePeer({
        initiator: true,
        trickle: false,
        stream: stream,
      });

      peer.on('signal', (data) => {
        socket?.emit('callUser', {
          userToCall: id,
          signalData: data,
          from: username,
        });
      });

      peer.on('stream', (stream) => {
        const video = document.querySelector('video#remoteVideo') as HTMLVideoElement;
        if (video) {
          video.srcObject = stream;
        }
      });

      setPeer(peer);
    });
  };

  const answerCall = () => {
    setCallAccepted(true);
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
      setStream(stream);
      const peer = new SimplePeer({
        initiator: false,
        trickle: false,
        stream: stream,
      });

      peer.on('signal', (data) => {
        socket?.emit('answerCall', { signal: data, to: caller });
      });

      peer.on('stream', (stream) => {
        const video = document.querySelector('video#remoteVideo') as HTMLVideoElement;
        if (video) {
          video.srcObject = stream;
        }
      });

      peer.signal(callerSignal!);
      setPeer(peer);
    });
  };

  const endCall = () => {
    setCallAccepted(false);
    setReceivingCall(false);
    setCaller('');
    setCallerSignal(null);
    if (peer) {
      peer.destroy();
    }
    setPeer(null);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    setStream(null);
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
              <button
                onClick={() => callUser(currentChat.id)}
                className="ml-2 px-8 py-2 bg-[#a3a3a342] hover:bg-[#dadada42] text-white rounded  h-full"
              >
                Call
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            Select a chat to start messaging
          </div>
        )}
      </div>
      {receivingCall && !callAccepted && (
        <div className="fixed bottom-4 right-4 bg-white p-4 rounded shadow-lg">
          <p>{caller} is calling you</p>
          <button onClick={answerCall} className="bg-green-500 text-white px-4 py-2 rounded">Answer</button>
          <button onClick={endCall} className="bg-red-500 text-white px-4 py-2 rounded ml-2">Decline</button>
        </div>
      )}
      {callAccepted && (
        <div className="fixed bottom-4 right-4 bg-white p-4 rounded shadow-lg">
          <video id="remoteVideo" autoPlay playsInline className="w-full h-full"></video>
          <button onClick={endCall} className="bg-red-500 text-white px-4 py-2 rounded mt-2">End Call</button>
        </div>
      )}
    </div>
  );
}
