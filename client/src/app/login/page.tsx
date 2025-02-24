'use client'
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const router = useRouter();

    const handleLogin = async () => {
        try {
            const res = await axios.post('http://localhost:3001/api/auth/login', {
                username,
                password,
            });
            localStorage.setItem('token', res.data.token);
            router.push('/');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            setError(err.response?.data?.error || 'Login failed');
        }
    };

    return (
        <div className='container flex w-full max-w-sm mx-auto flex-col items-center justify-center gap-4 h-screen'>
            <h1>Login</h1>
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
            <button onClick={handleLogin} className='button'>
                Login
            </button>
            <p>
                Don't have an account?{' '}
                <a href="/signup" style={{ color: 'blue' }}>
                    Signup
                </a>
            </p>
        </div>
    );
}