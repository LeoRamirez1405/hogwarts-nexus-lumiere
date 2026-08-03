import { useState, useCallback, useRef } from "react";

export interface VoiceRecorderState {
  recording: boolean;
  elapsed: number;
  recordedBlob: Blob | null;
  isPlaying: boolean;
  transcribing: boolean;
  start: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  playPreview: () => void;
  pausePreview: () => void;
  startTranscription: () => boolean;
  stopTranscription: () => void;
  cleanup: () => void;
  transcriptRef: React.MutableRefObject<string>;
  setTranscribing: (v: boolean) => void;
}

export function useVoiceRecorder(): VoiceRecorderState {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const speechRecRef = useRef<any>(null);
  const transcriptRef = useRef<string>("");

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (speechRecRef.current) {
      try { speechRecRef.current.stop(); } catch (error) { console.warn('Failed to stop speech recognition:', error); }
      speechRecRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setElapsed(0);
    setRecordedBlob(null);
    setRecording(false);
    setIsPlaying(false);
    setTranscribing(false);
    transcriptRef.current = "";
  }, []);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      chunksRef.current = chunks;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      streamRef.current = stream;
      mediaRecorderRef.current = recorder;
      chunksRef.current = chunks;
      setRecordedBlob(null);
      setElapsed(0);
      setRecording(true);
      transcriptRef.current = "";

      intervalRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);

      recorder.start();
    } catch (error) {
      console.error('Failed to start voice recording:', error);
      alert("No se pudo acceder al microfono");
    }
  }, []);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve(null);
        cleanup();
        return;
      }

      recorder.onstop = () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        mediaRecorderRef.current = null;
        setRecording(false);

        const chunks = chunksRef.current;
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: "audio/webm" });
          setRecordedBlob(blob);
          resolve(blob);
        } else {
          resolve(null);
        }
        chunksRef.current = [];
      };

      recorder.stop();
    });
  }, [cleanup]);

  const startTranscription = useCallback(() => {
    const SpeechRecognitionAPI =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).SpeechRecognition ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      alert("Tu navegador no soporta transcripcion. Intenta con Chrome o Edge.");
      return false;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "es-ES";
    recognition.continuous = true;
    recognition.interimResults = false;
    let finalTranscript = "";

    setTranscribing(true);
    transcriptRef.current = "";

    recognition.onresult = (event: { results: SpeechRecognitionResultList }) => {
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + " ";
        }
      }
      transcriptRef.current = finalTranscript;
    };

    recognition.onerror = () => {
      setTranscribing(false);
    };

    recognition.onend = () => {
      setTranscribing(false);
    };

    try {
      recognition.start();
      speechRecRef.current = recognition;
      return true;
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      setTranscribing(false);
      return false;
    }
  }, []);

  const stopTranscription = useCallback(() => {
    if (speechRecRef.current) {
      try { speechRecRef.current.stop(); } catch (error) { console.warn('Failed to stop speech recognition:', error); }
      speechRecRef.current = null;
    }
    setTranscribing(false);
  }, []);

  const playPreview = useCallback(() => {
    if (!recordedBlob) return;
    const url = URL.createObjectURL(recordedBlob);
    const audio = new Audio(url);
    audio.onended = () => setIsPlaying(false);
    audioRef.current = audio;
    audio.play();
    setIsPlaying(true);
  }, [recordedBlob]);

  const pausePreview = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  return {
    recording, elapsed, recordedBlob, isPlaying, transcribing,
    start, stopRecording, playPreview, pausePreview,
    startTranscription, stopTranscription, cleanup, transcriptRef,
    setTranscribing,
  };
}
