// chat-app/components/Search.js
import { useState } from 'react';
import axios from 'axios';
import { Socket } from 'socket.io-client';
import { axiosInstance } from '@/utils/axios';

export default function Search({ socket }: { socket: Socket | null }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);

    const handleSearch = async () => {
        try {
            const res = await axios.get(`http://localhost:3001/api/friends/search?q=${query}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            setResults(res.data);
        } catch (err) {
            console.error('Search failed:', err);
        }
    };

    const sendFriendRequest = async (userId: string) => {
        try {
            await axiosInstance.post(
                'friends/send',
                { to: userId },
            );
            if (!socket) {
                alert('Socket not connected');
                return;
            } else {
                socket?.emit('sendFriendRequest', { to: userId });
                alert('Friend request sent');
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            alert('Failed to send friend request ' + err);
        }
    };

    return (
        <div className='flex w-full max-w-sm flex-col items-center justify-center gap-4'>
            <h3>Search Users</h3>
            <div className='flex gap-2 w-full'>
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search users"
                    className='text-black p-2 rounded-md'
                />
                <button
                    className='bg-[#a3a3a342] hover:bg-[#dadada42] text-white font-bold py-2 px-2 rounded-md'
                    onClick={handleSearch}>Search</button>
            </div>
            <ul className='w-full flex flex-col gap-2'>
                {results.map((user: {
                    _id: string;
                    username: string;
                }) => (
                    <li key={user._id} className='flex gap-2 w-full bg-slate-400 justify-between items-center p-2 rounded-md'>
                        <p className='text-blue-500'>{user.username}{' '}</p>
                        <button
                            className='bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-2 rounded-md'
                            onClick={() => sendFriendRequest(user._id)}>Add Friend</button>
                    </li>
                ))}
            </ul>
        </div>
    );
}