'use client';

import React, { useEffect, useRef, useState } from 'react';

const ScreenShare = () => {
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [clientId, setClientId] = useState('');
  const [targetId, setTargetId] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);
  const socket = useRef<WebSocket | null>(null);

  useEffect(() => {
    socket.current = new WebSocket('ws://localhost:5000');

    socket.current.onmessage = async (message) => {
      const parsed = JSON.parse(message.data);
      
      if (parsed.type === 'client-id') {
        setClientId(parsed.data);
        return;
      }

      const { type, data, sender } = parsed;
      
      switch (type) {
        case 'offer':
          await handleOffer(data, sender);
          break;
        case 'answer':
          await handleAnswer(data);
          break;
        case 'ice-candidate':
          await handleICECandidate(data);
          break;
      }
    };

    return () => {
      socket.current?.close();
    };
  }, []);

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socket.current) {
        socket.current.send(JSON.stringify({
          type: 'ice-candidate',
          data: event.candidate,
          receiver: targetId
        }));
      }
    };

    pc.ontrack = (event) => {
      if (screenRef.current && event.streams.length) {
        screenRef.current.srcObject = event.streams[0];
        setRemoteStream(event.streams[0]);
      }
    };

    return pc;
  };

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      setLocalStream(stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const pc = createPeerConnection();
      setPeerConnection(pc);

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.current?.send(JSON.stringify({
        type: 'offer',
        data: offer,
        receiver: targetId
      }));
    } catch (error) {
      console.error('Error sharing screen:', error);
    }
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit, sender: string) => {
    const pc = createPeerConnection();
    setPeerConnection(pc);
    setTargetId(sender);

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.current?.send(JSON.stringify({
      type: 'answer',
      data: answer,
      receiver: sender
    }));
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    if (peerConnection) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }
  };

  const handleICECandidate = async (candidate: RTCIceCandidateInit) => {
    if (peerConnection) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  };

  return (
    <div>
      <h1>Screen Sharing</h1>
      <div>
        <p>Your ID: {clientId}</p>
        <input
          type="text"
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          placeholder="Enter target client ID"
        />
        <button onClick={startScreenShare}>Start Screen Share</button>
      </div>
      <div>
        <h2>Local Screen</h2>
        <video ref={videoRef} autoPlay playsInline muted />
      </div>
      <div>
        <h2>Remote Screen</h2>
        <video ref={screenRef} autoPlay playsInline />
      </div>
    </div>
  );
};

export default ScreenShare;