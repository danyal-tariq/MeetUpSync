// Frontend WebSocket Client Example (Next.js)
'use client';
import { useEffect, useState, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Head from 'next/head';

interface Message {
  type: string;
  data: string;
  sender?: string;
  receiver?: string;
  timeStamp?: string;
}
interface ChatMessage {
  sender: string;
  message: string;
  timeStamp?: string;
  sent?: boolean;
  delivered?: boolean;
}
interface History {
  chatWith: string;
  chats: ChatMessage[];
}

export default function Home() {
  const selectedClient = useRef<HTMLSelectElement | null>(null);
  const chatsRef = useRef<HTMLButtonElement | null>(null);

  const [message, setMessage] = useState('');
  const [receivedMessage, setReceivedMessage] = useState('');
  const [receiver, setReceiver] = useState('');
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
      const { type, data, sender, receiver, timeStamp } = parsedMessage;
      switch (type) {
        case 'id':
          setSender(data);
          //set id as tab title
          break;
        case 'ack':
          setMessageHistory((prev) => {
            const updatedHistory = prev.map((history) => {
              if (history.chatWith === receiver) {
                return {
                  ...history,
                  chats: history.chats.map((chat) => {
                    if (chat.timeStamp === timeStamp) {
                      return { ...chat, delivered: true };
                    }
                    return chat;
                  }),
                };
              }
              return history;
            });
            return updatedHistory;
          });
          break;
        case 'message':
          setReceivedMessage(`${sender}: ${data}`);
          // Update message history with received message for the sender if it exists else create a new history
          setMessageHistory((prev) => {
            const updatedHistory = prev.map((history) => {
              if (history.chatWith === sender) {
                return {
                  ...history,
                  chats: [
                    ...history.chats,
                    {
                      sender: sender,
                      message: data,
                      delivered: true,
                      timeStamp,
                    },
                  ],
                };
              }
              return history;
            });
            if (
              !updatedHistory.some((history) => history.chatWith === sender)
            ) {
              return [
                ...updatedHistory,
                {
                  chatWith: sender,
                  chats: [
                    {
                      sender: sender,
                      message: data,
                      delivered: true,
                      timeStamp,
                    },
                  ],
                },
              ];
            }
            return updatedHistory;
          });
          break;
        case 'new-connection':
          if (receiver === '') setReceiver(data);
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
          if (clients.size === 0) setReceiver('');
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
      // Update message history or create a new history for the receiver
      setMessageHistory((prev) => {
        const updatedHistory = prev.map((history) => {
          if (history.chatWith === receiver) {
            return {
              ...history,
              chats: [
                ...history.chats,
                {
                  sender: sender,
                  message: message,
                  sent: true,
                  timeStamp: msg.timeStamp,
                },
              ],
            };
          }
          return history;
        });
        if (!updatedHistory.some((history) => history.chatWith === receiver)) {
          return [
            ...updatedHistory,
            {
              chatWith: receiver,
              chats: [
                {
                  sender: sender,
                  message: message,
                  sent: true,
                  timeStamp: msg.timeStamp,
                },
              ],
            },
          ];
        }
        return updatedHistory;
      });
    }
  };

  const prepareMessage = (sender: string, receiver: string) => {
    const randomMessage = {
      type: 'message',
      data: message,
      sender: sender,
      receiver: receiver,
      timeStamp: new Date().getTime().toString(),
    };
    sendMessage(randomMessage);
  };

  return (
    <div className="flex-col justify-center w-full place-items-center p-4 gap-8 flex h-full">
      <title>{sender}</title>
      <h1 className="text-3xl">UID : {sender}</h1>
      <div className=" flex-col flex gap-3 w-full max-w-[400px]">
        <label htmlFor="message">Enter Message</label>
        <textarea
          id="message"
          placeholder="Enter message"
          className="flex border-white rounded-lg p-2 text-white bg-transparent border"
          onChange={(e) => setMessage(e.target.value)}
        />
        <label htmlFor="receiver">Select Receiver</label>
        <select
          className="flex border-white border rounded-lg p-2 text-white bg-transparent"
          defaultValue={receiver}
          ref={selectedClient}
          onChange={(e) => {
            setReceiver(e.target.value);
          }}
        >
          {Array.from(clients).map(([key]) => (
            <option
              key={key}
              value={key}
              className="bg-black text-white appearance-none flex w-full p-2"
            >
              {key}
            </option>
          ))}
        </select>
        <button
          onClick={() =>
            prepareMessage(sender, selectedClient.current?.value || '')
          }
          disabled={message === '' || receiver === ''}
          className="bg-blue-500 text-white p-2 rounded-lg disabled:bg-gray-500 disabled:cursor-not-allowed"
        >
          Send Message
        </button>
      </div>
      {/* <p className="w-full flex text-center opacity-15 ">
        Received:
        <br /> {receivedMessage}
      </p> */}
      {
        <>
          <h1>Online Clients: {clients.size}</h1>
          <ul className="gap-2 grid md:grid-cols-2 sm:grid-cols-1">
            {Array.from(clients).map(([key]) => (
              <li
                key={key}
                className="text-gray-300 rounded-full bg-slate-700 px-2 flex justify-center items-center gap-2 text-[12px] cursor-pointer"
                onClick={() => {
                  setReceiver(key);
                  selectedClient.current!.value = key;
                }}
              >
                {key}
                <div className="w-[10px] h-[10px] bg-green-500 rounded-full" />
              </li>
            ))}
          </ul>
        </>
      }
      {
        <div className="flex flex-col border-t-2 w-full justify-start items-center mt-6 pt-3 h-[500px] p-2 relative">
          <h2 className="text-2xl pb-2">History</h2>
          {messageHistory.length > 0 ? (
            <Tabs
              defaultValue={messageHistory[0].chatWith}
              className="w-full scroll-smooth grid grid-cols-4 overflow-hidden bg-[#75757525] rounded-lg h-full p-3"
              orientation={'vertical'}
            >
              <TabsList className="flex-col flex h-full col-span-1 border-r-2 rounded-nonew  mr-4 justify-start pt-8">
                {messageHistory.map((msg, index) => (
                  <TabsTrigger
                    key={index}
                    value={msg.chatWith}
                    className="text-[12px] w-[90%] flex-col justify-start items-start gap-2 cursor-pointer"
                    onClick={() => {
                      setReceiver(msg.chatWith);
                      selectedClient.current!.value = msg.chatWith;
                    }}
                  >
                    <p>{msg.chatWith.substring(0, 18)}...</p>
                    {msg.chats.length > 0 && (
                      <div className="flex justify-between w-full">
                        <p className="text-[10px] text-gray-300">
                          {msg.chats[msg.chats.length - 1].message.substring(
                            0,
                            10
                          )}
                        </p>
                        <p className="text-[10px]">
                          {new Date(
                            Number(msg.chats[msg.chats.length - 1].timeStamp)
                          ).toLocaleTimeString()}
                        </p>
                      </div>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
              {messageHistory.map((msg, index) => (
                <TabsContent
                  key={index}
                  value={msg.chatWith}
                  className="pt-12 col-span-3 overflow-auto pr-2"
                >
                  {/* <p className="text-2xl text-center fixed ">{msg.chatWith}</p> */}
                  <ul
                    className="w-full flex flex-col gap-2 "
                    ref={chatHistoryRef}
                  >
                    {msg.chats.map((chat, index) => (
                      <li
                        key={index}
                        className={
                          chat.sender === sender ? ' self-end ' : 'self-start'
                        }
                      >
                        <div
                          className={`flex flex-col gap-1 px-5 py-2 transition-all animate-fadeIn   ${
                            chat.sender === sender
                              ? 'bg-gray-600 text-white rounded-s-xl rounded-t-xl'
                              : 'bg-stone-700 text-white rounded-r-xl rounded-t-xl'
                          }`}
                        >
                          <span className="font-bold text-[12px] text-yellow-300">
                            {chat.sender}
                          </span>
                          <span>{chat.message}</span>
                          <div className="flex flex-row justify-between">
                            {chat.sent && (
                              <span className="text-[15px] text-green-500">
                                *
                              </span>
                            )}
                            {chat.delivered && (
                              <span className="text-[15px] text-green-500">
                                *
                              </span>
                            )}
                            {
                              <span className="text-[12px] text-gray-300">
                                {new Date(
                                  Number(chat.timeStamp)
                                ).toLocaleTimeString()}
                              </span>
                            }
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <h1>No Chats Found</h1>
          )}
        </div>
      }
    </div>
  );
}
