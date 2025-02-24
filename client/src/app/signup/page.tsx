'use client'
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function Signup() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const router = useRouter();

    const handleSignup = async () => {
        try {
            await axios.post('http://localhost:3001/api/auth/signup', {
                username,
                password,
            });
            router.push('/login');
        } catch (err) {
            setError(err.response?.data?.error || 'Signup failed');
        }
    };

    return (
        <div className='container flex w-full max-w-sm mx-auto flex-col items-center justify-center gap-4 h-screen'>
            <h1>Signup</h1>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className='input text-black p-2'
            />
            <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className='input text-black p-2'
            />
            <button onClick={handleSignup} className='button'>
                Signup
            </button>
            <p>
                Already have an account?{' '}
                <a href="/login" style={{ color: 'blue' }}>
                    Login
                </a>
            </p>
        </div>
    );
}