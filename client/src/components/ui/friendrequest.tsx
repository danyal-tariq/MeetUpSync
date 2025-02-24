// chat-app/components/FriendRequests.js
import { useState, useEffect } from 'react';
import type { Socket } from 'socket.io-client';
import { axiosInstance } from '@/utils/axios';

export default function FriendRequests({ socket }: { socket: Socket | null }) {
    const [requests, setRequests] = useState<{ _id: string; username: string }[]>([]);

    useEffect(() => {
        const fetchRequests = async () => {
            try {
                const res = await axiosInstance.get('friends/requests', {
                });
                setRequests(res.data);
            } catch (err) {
                console.error('Failed to fetch requests:', err);
            }
        };
        fetchRequests();
    }, []);

    const acceptRequest = async (requestId: string) => {
        try {
            await axiosInstance.post(
                'friends/accept',
                { requestId },
            );
            setRequests(requests.filter((req: {
                _id: string;
            }) => req._id !== requestId));
        } catch (err) {
            console.error('Failed to accept request:', err);
        }
    };

    useEffect(() => {
        if (!socket) return;
        socket.on('friendRequest', (request: {
            from: string;
            id: string;
            message: string;
        }) => {
            setRequests([...requests, { _id: request.id, username: request.from }]);
        });
    }, [socket, requests]);

    return (
        <div className='flex flex-col w-full max-w-sm items-center justify-center gap-4 py-4'>
            <h3>Pending Friend Requests</h3>
            <ul className='flex w-full flex-col gap-2'>
                {requests.map((req: {
                    _id: string;
                    username: string;
                }) => (
                    <li key={req._id} className='flex w-full justify-start gap-2 items-center p-2 rounded-md'>
                        <div className='flex items-center bg-[#575757] p-4 rounded-full max-w-[40px] max-h-[40px] justify-center relative'>
                            <span
                                className='text-white text-lg'>
                                {req.username[0].toUpperCase()}
                            </span>
                        </div>
                        <div className='border h-full' />
                        <p className='w-full'>{req.username}{' '}</p>
                        <button
                            className='bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-2 rounded-md self-end'
                            onClick={() => acceptRequest(req._id)}>
                            Accept
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}