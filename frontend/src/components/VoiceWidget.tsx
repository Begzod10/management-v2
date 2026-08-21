import { useRef, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useVoice, ChatMessage } from "@/contexts/VoiceContext";
import { cn } from "@/lib/utils";
import { Mic, MicOff, X, Minimize2, Loader2, CheckCheck, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function Message({ msg }: { msg: ChatMessage }) {
  if (msg.kind === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-3 py-2 text-xs">
          {msg.text}
        </div>
      </div>
    );
  }
  if (msg.kind === "ai") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] bg-muted rounded-2xl rounded-tl-sm px-3 py-2 text-xs text-foreground">
          {msg.text}
        </div>
      </div>
    );
  }
  if (msg.kind === "mission") {
    return (
      <div className="flex justify-center">
        <div className="border border-green-500/40 bg-green-500/5 rounded-xl px-3 py-2 text-xs flex items-center gap-2 w-full">
          <CheckCheck className="h-3.5 w-3.5 text-green-600 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">{msg.title}</p>
            <p className="text-muted-foreground truncate">{msg.executor} · {msg.deadline}</p>
          </div>
          <Badge className="ml-auto text-[10px] px-1.5 bg-green-500/10 text-green-600 border-green-500/30 shrink-0">
            #{msg.mission_id}
          </Badge>
        </div>
      </div>
    );
  }
  if (msg.kind === "error") {
    return (
      <div className="flex justify-center">
        <div className="text-[11px] text-red-500 bg-red-500/10 rounded-lg px-3 py-1.5 max-w-full text-center">
          {msg.text}
        </div>
      </div>
    );
  }
  return null;
}

export function VoiceWidget() {
  const { user } = useAuth();
  const { wsState, messages, aiText, connect, disconnect, clearMessages } = useVoice();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && !minimized) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, aiText, open, minimized]);

  if (user?.role !== "owner") return null;

  const isActive = wsState !== "disconnected";

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => { setOpen((o) => !o); setMinimized(false); }}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all focus:outline-none",
          isActive
            ? "bg-red-500 hover:bg-red-600 shadow-red-500/40"
            : "bg-primary hover:bg-primary/90 shadow-primary/30"
        )}
        title="Ovozli yordamchi"
      >
        {wsState === "connecting" ? (
          <Loader2 className="h-6 w-6 text-white animate-spin" />
        ) : isActive ? (
          <MicOff className="h-6 w-6 text-white" />
        ) : (
          <Mic className="h-6 w-6 text-white" />
        )}
        {isActive && (
          <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-25 pointer-events-none" />
        )}
        {messages.length > 0 && !open && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center border-2 border-background">
            {messages.length > 9 ? "9+" : messages.length}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          className={cn(
            "fixed bottom-24 right-6 z-50 w-80 bg-background border border-border/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all",
            minimized ? "h-12" : "h-[480px]"
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/40 shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {isActive && (
                <span className="h-2 w-2 rounded-full bg-green-500 shrink-0 animate-pulse" />
              )}
              <span className="text-sm font-medium truncate">Ovozli yordamchi</span>
              {wsState === "connected" && (
                <Badge className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-600 border-green-500/30 shrink-0">
                  Jonli
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              {messages.length > 0 && (
                <button
                  onClick={clearMessages}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Tozalash"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => setMinimized((m) => !m)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* Chat area */}
              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
                {messages.length === 0 && !aiText && wsState === "disconnected" && (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                    <Mic className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">
                      Ulanish uchun pastdagi tugmani bosing
                    </p>
                  </div>
                )}
                {messages.length === 0 && !aiText && wsState === "connected" && (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                    <span className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                    <p className="text-xs text-muted-foreground">
                      Gapiring — AI sizni tinglaydi
                    </p>
                  </div>
                )}

                {messages.map((msg, i) => <Message key={i} msg={msg} />)}

                {aiText && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] bg-muted rounded-2xl rounded-tl-sm px-3 py-2 text-xs text-foreground">
                      {aiText}
                      <span className="inline-block w-0.5 h-3 bg-foreground/60 ml-0.5 align-middle animate-pulse" />
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Connect / Disconnect button */}
              <div className="px-3 pb-3 pt-2 shrink-0 border-t border-border/30">
                {wsState === "disconnected" ? (
                  <button
                    onClick={connect}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-colors"
                  >
                    <Mic className="h-4 w-4" />
                    Ulanish
                  </button>
                ) : wsState === "connecting" ? (
                  <button disabled className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-muted text-muted-foreground text-sm font-medium">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Ulanmoqda...
                  </button>
                ) : (
                  <button
                    onClick={disconnect}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 text-sm font-medium transition-colors"
                  >
                    <MicOff className="h-4 w-4" />
                    To'xtatish
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
