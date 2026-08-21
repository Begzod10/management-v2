import { createContext, useContext, useRef, useState, useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { BASE_URL } from "@/lib/api";
import { toast } from "sonner";

export type VoiceMode = "openai" | "gemini";
export type WsState = "disconnected" | "connecting" | "connected";
export type ChatMessage =
  | { kind: "user"; text: string }
  | { kind: "ai"; text: string }
  | { kind: "mission"; mission_id: number; title: string; executor: string; deadline: string }
  | { kind: "error"; text: string };

interface VoiceContextValue {
  mode: VoiceMode;
  setMode: (m: VoiceMode) => void;
  wsState: WsState;
  messages: ChatMessage[];
  aiText: string;
  connect: () => Promise<void>;
  disconnect: () => void;
  clearMessages: () => void;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

function float32ToInt16(buf: Float32Array): ArrayBuffer {
  const out = new Int16Array(buf.length);
  for (let i = 0; i < buf.length; i++) {
    const s = Math.max(-1, Math.min(1, buf[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out.buffer;
}

function toWsUrl(base: string, path: string, creatorId: number): string {
  const token = localStorage.getItem("access_token") ?? "";
  const wsBase = base.replace(/^https?/, (s) => (s === "https" ? "wss" : "ws"));
  return `${wsBase}${path}?creator_id=${creatorId}&token=${token}`;
}

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [mode, setMode] = useState<VoiceMode>("gemini");
  const [wsState, setWsState] = useState<WsState>("disconnected");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [aiText, setAiText] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextPlayTimeRef = useRef(0);

  const pushMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      if (msg.kind === "ai" && prev.length > 0 && prev[prev.length - 1].kind === "ai") {
        const last = prev[prev.length - 1] as { kind: "ai"; text: string };
        return [...prev.slice(0, -1), { kind: "ai", text: last.text + msg.text }];
      }
      return [...prev, msg];
    });
  }, []);

  const playPcm16 = useCallback((buffer: ArrayBuffer) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const int16 = new Int16Array(buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 0x8000;
    const audioBuf = ctx.createBuffer(1, float32.length, 24000);
    audioBuf.copyToChannel(float32, 0);
    const src = ctx.createBufferSource();
    src.buffer = audioBuf;
    src.connect(ctx.destination);
    const startAt = Math.max(ctx.currentTime, nextPlayTimeRef.current);
    src.start(startAt);
    nextPlayTimeRef.current = startAt + audioBuf.duration;
  }, []);

  const stopMic = useCallback(() => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    processorRef.current = null;
    sourceRef.current = null;
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
  }, []);

  const connect = useCallback(async () => {
    if (!user?.id) return;
    const inputHz = mode === "openai" ? 24000 : 16000;
    const wsPath = mode === "openai" ? "/api/v1/voice-realtime/ws" : "/api/v1/gemini-voice/ws";

    setWsState("connecting");
    setAiText("");

    const url = toWsUrl(BASE_URL, wsPath, Number(user.id));
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.binaryType = "arraybuffer";

    ws.onopen = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const ctx = new AudioContext({ sampleRate: inputHz });
        audioCtxRef.current = ctx;
        nextPlayTimeRef.current = 0;

        const source = ctx.createMediaStreamSource(stream);
        sourceRef.current = source;
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(float32ToInt16(e.inputBuffer.getChannelData(0)));
          }
        };

        source.connect(processor);
        processor.connect(ctx.destination);
        setWsState("connected");
      } catch {
        toast.error("Mikrofonga ruxsat berilmagan");
        ws.close();
      }
    };

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        playPcm16(event.data);
        return;
      }
      try {
        const msg = JSON.parse(event.data as string);
        switch (msg.type) {
          case "session_ready": break;
          case "user_transcript":
            pushMessage({ kind: "user", text: msg.text });
            setAiText("");
            break;
          case "ai_transcript":
            setAiText((p) => p + (msg.text ?? ""));
            break;
          case "mission_created":
            setAiText("");
            pushMessage({ kind: "mission", mission_id: msg.mission_id, title: msg.title, executor: msg.executor, deadline: msg.deadline });
            break;
          case "error":
            pushMessage({ kind: "error", text: msg.message });
            break;
        }
      } catch { /* binary handled above */ }
    };

    ws.onclose = () => { stopMic(); setWsState("disconnected"); setAiText(""); };
    ws.onerror = () => { toast.error("WebSocket xatolik"); stopMic(); setWsState("disconnected"); };
  }, [user?.id, mode, pushMessage, playPcm16, stopMic]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setAiText("");
  }, []);

  useEffect(() => () => { wsRef.current?.close(); stopMic(); }, [stopMic]);

  return (
    <VoiceContext.Provider value={{ mode, setMode, wsState, messages, aiText, connect, disconnect, clearMessages }}>
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoice must be used within VoiceProvider");
  return ctx;
}
