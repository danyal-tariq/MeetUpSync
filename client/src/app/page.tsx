'use client'
import { useState, useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import Peer from 'simple-peer';
import Search from '../components/ui/search';
import FriendList from '../components/ui/friendlist';
import FriendRequests from '../components/ui/friendrequest';
import { axiosInstance } from '@/utils/axios';

export default function ChatPage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [username, setUsername] = useState('');
  const [id, setId] = useState('');

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
  const [callerSignal, setCallerSignal] = useState<Peer.SignalData | null>(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [peer, setPeer] = useState<Peer.Instance | null>(null);
  const myVideo = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setToken(localStorage.getItem('token'));
  }, []);

  useEffect(() => {
    if (!token) return;
    const newSocket = io('https://wtw1vt8p-3001.inc1.devtunnels.ms', { query: { token } });
    setSocket(newSocket);

    // Get media stream
    //if device is
    navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      .then((currentStream) => {
        setStream(currentStream);
        if (myVideo.current) {
          myVideo.current.srcObject = currentStream;
        }
      }).catch((err) => {
        console.error('Failed to get user media:', err);
      });



    newSocket.on('connected', (data) => {
      console.log('Connected to socket server');
      setUsername(data.username);
      setId(data.id);
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
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
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

    console.log('currentChat:', currentChat);
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

  const callUser = (idToCall: string) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: stream as MediaStream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    peer.on('signal', (data) => {
      socket!.emit('callUser', {
        userToCall: idToCall,
        signalData: data,
        from: id,
        name: username,
      });
    });

    peer.on('stream', (stream) => {
      console.log('stream:', stream.getTracks());
      if (myVideo.current) {
        myVideo.current.srcObject = stream;
      }
    });

    peer.on('error', (err) => {
      console.error("Peer connection error:", err);
    });

    peer.on('connect', () => {
      console.log("Peer connection established!");
    });

    socket!.on('callAccepted', (signal) => {
      console.log('call accepted:', signal);
      setCallAccepted(true);
      peer.signal(signal);
    });

    setPeer(peer);
  };

  const answerCall = () => {
    setCallAccepted(true);

    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: stream as MediaStream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    peer.on('signal', (data) => {
      socket!.emit('answerCall', { signal: data, to: caller });
    });

    peer.on('stream', (stream) => {
      console.log('stream:', stream.getTracks());
      if (myVideo.current) {
        myVideo.current.srcObject = stream;
      }
    });

    peer.on('error', (err) => {
      console.error("Peer connection error:", err);
    });

    peer.on('connect', () => {
      console.log("Peer connection established!");
    });

    peer.signal(callerSignal as Peer.SignalData);
    setPeer(peer);
  };

  const endCall = () => {
    socket?.emit('endCall', { to: caller });
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
        <FriendList callUser={callUser} newMessage={newMessage ? newMessage : undefined} setChatWith={setCurrentChat as (arg0: { type: 'user' | 'room'; id: string }) => void} />
        <div className='border' />
        <FriendRequests callUser={callUser} socket={socket} />
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
            {/* User video */}
            {callAccepted && (
              <div className="bg-gray-200 rounded p-2">
                <h2 className="text-lg font-semibold mb-2">{"User"}&apos;s Video</h2>
                <video
                  ref={myVideo}
                  playsInline
                  autoPlay
                  className="w-full h-full bg-black"
                />
              </div>
            )}|
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
