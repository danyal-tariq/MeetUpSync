import { useState, useEffect } from 'react';
import { axiosInstance } from '@/utils/axios';

interface friend {
    id: string;
    username: string;
    online: boolean;
    selected?: boolean;
    lastMessage?: {
        text: string;
        timestamp: number;
        seen?: boolean;
    };
}

export default function FriendList({ setChatWith, newMessage, callUser }:
    {
        setChatWith: (arg0: { type: 'user' | 'room'; id: string }) => void,
        newMessage?: { sender: {username:string}; text: string; timestamp: number },
        callUser: (id: string) => void
    }) {
    const [friends, setFriends] = useState<friend[]>([]);

    useEffect(() => {
        const fetchFriends = async () => {
            try {
                const res = await axiosInstance.get('friends', {
                });
                setFriends(res.data);
            } catch (err) {
                console.error('Failed to fetch friends:', err);
            }
        };
        fetchFriends();
    }, []);

    useEffect(() => {
        if (!newMessage) return;
        setFriends((prev) => {
            const newFriends = [...prev];
            const friendIndex = newFriends.findIndex((f) => f.username === newMessage.sender.username);
            if (friendIndex !== -1) {
                newFriends[friendIndex].lastMessage = newMessage;
                newFriends[friendIndex].online = true;
                newFriends[friendIndex].lastMessage.seen = false;
            }
            return newFriends;
        });
    }, [newMessage])
    return (
        <div className='container flex w-full max-w-sm flex-col items-center gap-4 py-4 h-full justify-start'>
            <h3>My Friends</h3>
            <ul className='w-full flex flex-col gap-2'>
                {friends.map((friend: friend) => (
                    <li key={friend.id}
                        onClick={() => {
                            setChatWith({ type: 'user', id: friend.id })
                            setFriends((prev) => {
                                const newFriends = [...prev];
                                const friendIndex = newFriends.findIndex((f) => f.id === friend.id);
                                if (friendIndex !== -1) {
                                    if (newFriends[friendIndex].lastMessage) {
                                        newFriends[friendIndex].lastMessage.seen = true;
                                    }
                                    newFriends.forEach((f) => f.selected = false);
                                    newFriends[friendIndex].selected = true;
                                }
                                return newFriends;
                            }
                            )
                        }}
                        className={`flex gap-2 w-full justify-center items-center p-2 rounded-md hover:bg-[#d4d4d442] hover:cursor-pointer flex-row ${friend.selected ? 'bg-[#d4d4d442]' : ''} transition-all`}>
                        <div className='flex items-center bg-[#575757] p-4 rounded-full max-w-[40px] max-h-[40px] justify-center relative'>
                            <span
                                className='text-white text-lg'>
                                {friend.username[0].toUpperCase()}
                            </span>
                            {friend.online ? <p className='bottom-[0.6px] right-[0.6px] bg-green-500 absolute p-[5px] rounded-full'></p> : <p className='bottom-[0.6px] right-[0.6px] bg-red-500 p-[5px] absolute rounded-full'></p>}
                        </div>
                        <div className='w-full justify-start items-start'>
                            <p className='text-lg flex justify-between items-center w-full'>
                                {friend.username}
                                <span className='text-xs opacity-30'>
                                    {friend.lastMessage ? new Date(friend.lastMessage.timestamp).toLocaleTimeString() : ''}
                                </span>
                            </p>
                            <p className={`text-sm ${friend.lastMessage?.seen ? 'opacity-30' : 'font-bold'}`}>
                                {friend?.lastMessage?.text}
                            </p>
                        </div>
                        <button
                            className='bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-2 rounded-md self-end'
                            onClick={(e) => {
                                e.stopPropagation();
                                callUser(friend.id);
                            }}>
                            Call
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
