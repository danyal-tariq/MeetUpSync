// Frontend WebSocket Client Example (Next.js)
'use client';
import { useEffect, useState, useRef } from 'react';

interface Message {
  type: string;
  data: string;
  sender?: string;
  reciver?: string;
}
interface History {
  sender: string;
  message: string;
  sent?: boolean;
  delivered?: boolean;
}

export default function Home() {
  const selectedClient = useRef<HTMLSelectElement | null>(null);

  const [message, setMessage] = useState('');
  const [recievedMessage, setRecievedMessage] = useState('');
  const [reciever, setReciever] = useState('');
  const [sender, setSender] = useState('');

  const [clients, setClients] = useState<Map<string, WebSocket>>(new Map());
  const [messageHistory, setMessageHistory] = useState<History[]>([]);

  const socket = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Connect to the WebSocket signaling server
    socket.current = new WebSocket('https://wtw1vt8p-5000.inc1.devtunnels.ms'); // Replace with your signaling server URL

    socket.current.onopen = () => {
      console.log('Connected to WebSocket signaling server');
    };

    socket.current.onmessage = (event: MessageEvent) => {
      const parsedMessage = JSON.parse(event.data);
      const { type, data, sender } = parsedMessage;
      console.log('Message recieved', parsedMessage);
      switch (type) {
        case 'id':
          setSender(data);
          break;
        case 'ack':
          console.log('Message sent');
          break;
        case 'message':
          setRecievedMessage(`${sender}: ${data}`);
          setMessageHistory((prev) => [
            ...prev,
            { sender: sender, message: data },
          ]);
          break;
        case 'new-connection':
          setClients((prev) => new Map([...prev, [data, socket.current!]]));
          break;
        case 'existing-clients':
          const newClients = new Map<string, WebSocket>();
          data.forEach((clientId: string) => {
            newClients.set(clientId, socket.current!);
          });
          setClients(newClients);
          break;
        case 'disconnection':
          setClients((prev) => {
            prev.delete(data);
            return new Map(prev);
          });
          break;
      }
    };

    return () => {
      socket.current?.close();
    };
  }, []);

  const chatHistoryRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    //scroll to bottom of message history
    if (chatHistoryRef.current) {
      chatHistoryRef.current.lastElementChild?.scrollIntoView({
        behavior: 'smooth',
      });
    }
  }, [messageHistory]);

  const sendMessage = (msg: Message) => {
    if (socket.current) {
      socket.current.send(JSON.stringify(msg)); // Send message to signaling server
      // Update message history
      setMessageHistory((prev) => [
        ...prev,
        { sender: sender, message: msg.data },
      ]);
    }
  };

  const prepareMessage = (sender: string, reciever: string) => {
    const randomMessage = {
      type: 'message',
      data: message,
      sender: sender,
      reciever: reciever,
    };
    sendMessage(randomMessage);
  };

  return (
    <div className="flex-col justify-center w-full place-items-center p-4 gap-8 flex">
      <h1 className="text-3xl">Web RTC : Your Id is {sender}</h1>
      <div className=" flex-col flex gap-3 w-full max-w-[400px]">
        <label htmlFor="message">Enter Message</label>
        <textarea
          id="message"
          placeholder="Enter message"
          className="flex border-white rounded-lg p-2 text-black"
          onChange={(e) => setMessage(e.target.value)}
        />
        <label htmlFor="reciever">Select Reciever</label>
        <select
          className="flex border-white rounded-lg p-2 text-black"
          defaultValue={reciever}
          ref={selectedClient}
          onChange={(e) => {
            setReciever(e.target.value);
          }}
        >
          {Array.from(clients).map(([key]) => (
            <option key={key} value={key}>
              {key}
            </option>
          ))}
        </select>
        <button
          onClick={() =>
            prepareMessage(sender, selectedClient.current?.value || '')
          }
          className="bg-blue-500 text-white p-2 rounded-lg"
        >
          Send Message
        </button>
      </div>
      <p className="w-full flex text-center opacity-15 ">
        Received:
        <br /> {recievedMessage}
      </p>
      {
        <>
          <h1>Online Clients: {clients.size}</h1>
          <ul className="gap-2 flex">
            {Array.from(clients).map(([key]) => (
              <li
                key={key}
                className="text-gray-300 rounded-full bg-slate-700 px-2 flex justify-center items-center gap-2"
                onClick={() => {
                  setReciever(key);
                  selectedClient.current!.value = key;
                }}
              >
                {key}
                <div className="w-3 h-3 bg-green-500 rounded-full" />
              </li>
            ))}
          </ul>
        </>
      }
      {
        <div className="flex flex-col border-t w-full justify-start items-center mt-6 pt-12 overflow-y-scroll scroll-smooth h-[400px] p-2">
          <h2 className="text-2xl">History</h2>
          <ul className="w-full flex flex-col gap-2" ref={chatHistoryRef}>
            {messageHistory.map((msg, index) => (
              <li
                key={index}
                className={msg.sender === sender ? ' self-end ' : 'self-start'}
              >
                <div
                  className={`flex flex-col gap-1 px-5 py-2 transition-all   ${
                    msg.sender === sender
                      ? 'bg-green-800 text-white rounded-s-xl rounded-t-xl'
                      : 'bg-white text-black rounded-r-xl rounded-t-xl'
                  }`}
                >
                  <span className="font-bold text-[12px]">
                    From : {msg.sender}
                  </span>
                  <span>Message : {msg.message}</span>
                  {/* {// Show delivered status} */}
                  {msg.sent && (
                    <span className="text-[10px] text-green-500">*</span>
                  )}
                  {msg.delivered && (
                    <span className="text-[10px] text-green-500">*</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      }
    </div>
  );
}
