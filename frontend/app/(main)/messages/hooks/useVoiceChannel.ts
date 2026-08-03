"use client";

import { useState, useRef, useCallback } from "react";
import { useAuthStore } from "@/lib/authStore";
import { voiceChannelsApi, VoiceChannelParticipant, VoiceChannelResponse } from "@/lib/api/voice_channels";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

interface PeerConnection {
  userId: string;
  pc: RTCPeerConnection;
  stream?: MediaStream;
}

interface VoiceChannelState {
  channelId: string | null;
  roomId: string | null;
  isJoined: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  participants: VoiceChannelParticipant[];
  peers: PeerConnection[];
}

const initialVoiceState: VoiceChannelState = {
  channelId: null,
  roomId: null,
  isJoined: false,
  isMuted: false,
  isDeafened: false,
  isVideoEnabled: false,
  isScreenSharing: false,
  participants: [],
  peers: [],
};

export function useVoiceChannel() {
  const [state, setState] = useState<VoiceChannelState>(initialVoiceState);
  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerMapRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const { accessToken } = useAuthStore();

  const getWsUrl = useCallback(() => {
    if (!accessToken) return "";
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = process.env.NEXT_PUBLIC_API_URL
      ? new URL(process.env.NEXT_PUBLIC_API_URL).host
      : window.location.host;
    return `${protocol}//${host}/api/messages/voice-ws`;
  }, [accessToken]);

  const sendSignal = useCallback((op: string, payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ op, ...payload }));
    }
  }, []);

  const disconnectFromPeer = useCallback((userId: string) => {
    const pc = peerMapRef.current.get(userId);
    if (pc) {
      pc.close();
      peerMapRef.current.delete(userId);
    }
    setState((prev) => ({
      ...prev,
      peers: prev.peers.filter((p) => p.userId !== userId),
    }));
  }, []);

  const createPeerConnection = useCallback(
    (remoteUserId: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection(ICE_SERVERS);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal("signal", {
            channel_id: state.channelId,
            type: "ice-candidate",
            data: event.candidate,
          });
        }
      };

      pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        setState((prev) => ({
          ...prev,
          peers: prev.peers.map((p) =>
            p.userId === remoteUserId ? { ...p, stream: remoteStream } : p
          ),
        }));
      };

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "disconnected" ||
          pc.connectionState === "closed"
        ) {
          pc.close();
          peerMapRef.current.delete(remoteUserId);
          setState((prev) => ({
            ...prev,
            peers: prev.peers.filter((p) => p.userId !== remoteUserId),
          }));
        }
      };

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      setState((prev) => ({
        ...prev,
        peers: [...prev.peers, { userId: remoteUserId, pc }],
      }));
      peerMapRef.current.set(remoteUserId, pc);
      return pc;
    },
    [sendSignal, state.channelId]
  );

  const disconnectAllPeers = useCallback(() => {
    peerMapRef.current.forEach((pc) => pc.close());
    peerMapRef.current.clear();
    setState((prev) => ({ ...prev, peers: [] }));
  }, []);

  const stopLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
  }, []);

  const handleSignalMessage = useCallback(
    async (msg: Record<string, unknown>) => {
      const t = msg.t as string;

      if (t === "user_joined") {
        const newUserId = msg.user_id as string;
        if (!state.channelId || newUserId === accessToken) return;

        const pc = createPeerConnection(newUserId);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSignal("signal", {
            type: "offer",
            data: pc.localDescription,
          });
        } catch (e) {
          console.error("Offer creation failed", e);
        }
      }

      if (t === "user_left") {
        const leftUserId = msg.user_id as string;
        disconnectFromPeer(leftUserId);
      }

      if (t === "signal") {
        const from = msg.from as string;
        const signalType = msg.type as string;
        const signalData = msg.data as RTCSessionDescriptionInit;

        if (signalType === "offer") {
          const pc = peerMapRef.current.get(from) ?? createPeerConnection(from);
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(signalData));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendSignal("offer", {
              type: "answer",
              data: pc.localDescription,
            });
          } catch (e) {
            console.error("Offer handling failed", e);
          }
        }

        if (signalType === "answer") {
          const pc = peerMapRef.current.get(from);
          if (pc) {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(signalData));
            } catch (e) {
              console.error("Answer handling failed", e);
            }
          }
        }

        if (signalType === "ice-candidate") {
          const pc = peerMapRef.current.get(from);
          if (pc) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(signalData as RTCIceCandidateInit));
            } catch (e) {
              console.error("ICE candidate add failed", e);
            }
          }
        }
      }

      if (t === "voice_channel_state") {
        const data = msg.data as VoiceChannelResponse;
        setState((prev) => ({
          ...prev,
          participants: data.participants,
        }));
      }
    },
    [accessToken, createPeerConnection, disconnectFromPeer, sendSignal, state.channelId]
  );

  const connectSignaling = useCallback(
    (channelId: string) => {
      if (!accessToken) return;

      const url = getWsUrl();
      const ws = new WebSocket(url, [accessToken]);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ op: "join_channel", channel_id: channelId }));
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          await handleSignalMessage(msg);
        } catch (error) {
          console.warn('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        setState(initialVoiceState);
      };
    },
    [accessToken, getWsUrl, handleSignalMessage]
  );

  const joinChannel = useCallback(
    async (channelId: string, roomId: string) => {
      try {
        const localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
          video: false,
        });
        localStreamRef.current = localStream;

        await voiceChannelsApi.join(channelId);

        const channel = await voiceChannelsApi.get(channelId);

        setState({
          channelId,
          roomId,
          isJoined: true,
          isMuted: false,
          isDeafened: false,
          isVideoEnabled: false,
          isScreenSharing: false,
          participants: channel.participants,
          peers: [],
        });

        connectSignaling(channelId);
      } catch (e) {
        console.error("Failed to join voice channel", e);
        throw e;
      }
    },
    [connectSignaling]
  );

  const leaveChannel = useCallback(async () => {
    if (!state.channelId) return;

    disconnectAllPeers();
    stopLocalStream();

    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ op: "leave_channel", channel_id: state.channelId }));
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      await voiceChannelsApi.leave(state.channelId);
    } catch (err) {
      console.error("Voice channel leave failed", err);
    }

    setState(initialVoiceState);
  }, [state, disconnectAllPeers, stopLocalStream]);

  const toggleMute = useCallback(async () => {
    const { channelId, isMuted } = state;
    if (!channelId || !localStreamRef.current) return;

    const newMuted = !isMuted;
    localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = !newMuted));
    setState((prev) => ({ ...prev, isMuted: newMuted }));

    try {
      await voiceChannelsApi.updateMe(channelId, { muted: newMuted });
    } catch (err) {
      console.error("Failed to update mute state", err);
      localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = isMuted));
      setState((prev) => ({ ...prev, isMuted }));
    }
  }, [state]);

  const toggleDeafen = useCallback(async () => {
    const { channelId, isDeafened } = state;
    if (!channelId) return;

    const newDeafened = !isDeafened;
    if (newDeafened) {
      localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = false));
    } else {
      localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = true));
    }

    setState((prev) => ({ ...prev, isDeafened: newDeafened, isMuted: newDeafened }));

    try {
      await voiceChannelsApi.updateMe(channelId, { deafened: newDeafened, muted: newDeafened });
    } catch (err) {
      console.error("Failed to update deafen state", err);
      localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = true));
      setState((prev) => ({ ...prev, isDeafened: false, isMuted: false }));
    }
  }, [state]);

  const toggleVideo = useCallback(async () => {
    const { channelId, isVideoEnabled } = state;
    if (!channelId) return;

    const newVideo = !isVideoEnabled;
    if (newVideo) {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoStream.getVideoTracks().forEach((track) => localStreamRef.current?.addTrack(track));
        setState((prev) => ({ ...prev, isVideoEnabled: true }));
        await voiceChannelsApi.updateMe(channelId, { video_enabled: true });
      } catch (error) {
        console.warn('Camera access denied:', error);
      }
    } else {
      localStreamRef.current?.getVideoTracks().forEach((t) => t.stop());
      setState((prev) => ({ ...prev, isVideoEnabled: false }));
      try {
        await voiceChannelsApi.updateMe(channelId, { video_enabled: false });
      } catch (error) {
        console.error('Failed to update video state:', error);
      }
    }
  }, [state]);

  const listChannels = useCallback(async (roomId: string) => {
    return voiceChannelsApi.listForRoom(roomId);
  }, []);

  const createChannel = useCallback(
    async (roomId: string, name: string, description?: string) => {
      return voiceChannelsApi.create(roomId, { name, description });
    },
    []
  );

  const deleteChannel = useCallback(async (channelId: string) => {
    await voiceChannelsApi.delete(channelId);
  }, []);

  return {
    ...state,
    joinChannel,
    leaveChannel,
    toggleMute,
    toggleDeafen,
    toggleVideo,
    listChannels,
    createChannel,
    deleteChannel,
  };
}
