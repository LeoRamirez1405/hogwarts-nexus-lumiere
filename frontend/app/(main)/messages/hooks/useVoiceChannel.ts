"use client";

import { useState, useRef, useCallback, useEffect } from "react";
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
  participants: VoiceChannelParticipant[];
  peers: PeerConnection[];
}

const initialVoiceState: VoiceChannelState = {
  channelId: null,
  roomId: null,
  isJoined: false,
  isMuted: false,
  participants: [],
  peers: [],
};

export function useVoiceChannel() {
  const [state, setState] = useState<VoiceChannelState>(initialVoiceState);
  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerMapRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const leaveChannelRef = useRef<() => Promise<void>>(async () => {});
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

  // Keep ref in sync for use in handleSignalMessage (avoids stale closure / dep issues)
  useEffect(() => {
    leaveChannelRef.current = leaveChannel;
  }, [leaveChannel]);

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

      if (t === "voice_channel_closed") {
        const closedChannelId = msg.channel_id as string;
        if (state.channelId === closedChannelId) {
          leaveChannelRef.current();
        }
        return;
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

  const toggleChannel = useCallback(async (roomId: string) => {
    if (state.channelId) {
      await voiceChannelsApi.delete(state.channelId);
    } else {
      await voiceChannelsApi.create(roomId, { name: "Chat de voz" });
    }
  }, [state.channelId]);

  return {
    ...state,
    joinChannel,
    leaveChannel,
    toggleMute,
    listChannels,
    createChannel,
    deleteChannel,
    toggleChannel,
  };
}
