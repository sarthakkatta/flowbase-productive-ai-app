"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  ArrowRight,
  Bot,
  CalendarPlus,
  Check,
  CheckSquare,
  LoaderCircle,
  Mic,
  MicOff,
  PenLine,
  Send,
  Sparkles,
  StickyNote,
  WandSparkles,
  X,
} from "lucide-react";

import {
  confirmAssistantAction,
  sendAssistantMessage,
  type AssistantChatMessage,
  type AssistantPendingAction,
  type AssistantResponse,
} from "@/app/ai-assistant/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  action?: AssistantPendingAction;
  href?: string;
};

type VoiceStatus = "idle" | "permission" | "connecting" | "listening" | "processing" | "speaking" | "error";

const suggestions = [
  { label: "Create a task for tomorrow", icon: CheckSquare },
  { label: "Add meeting reminder on calendar", icon: CalendarPlus },
  { label: "Summarize my notes", icon: StickyNote },
  { label: "Create a Kanban board", icon: CheckSquare },
  { label: "Plan my week", icon: PenLine },
  { label: "Generate a habit tracker template", icon: WandSparkles },
];

const voiceStatusText: Record<VoiceStatus, string> = {
  idle: "Voice ready",
  permission: "Requesting microphone access",
  connecting: "Connecting voice assistant",
  listening: "Listening",
  processing: "Processing speech",
  speaking: "Assistant speaking",
  error: "Voice error",
};

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function friendlyError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function responseToMessage(response: AssistantResponse): Message {
  if (response.type === "pending_action") {
    return {
      id: createId("assistant"),
      role: "assistant",
      content: response.message,
      action: response.action,
    };
  }

  return {
    id: createId("assistant"),
    role: "assistant",
    content: response.message,
    href: response.type === "action_result" ? response.href : undefined,
  };
}

function encodeBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary);
}

function useVoiceAgent(onTranscript: (text: string) => void) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const sourcesRef = useRef(new Set<AudioBufferSourceNode>());
  const playheadRef = useRef(0);
  const finalTranscriptRef = useRef("");
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const releaseAudio = useCallback(async () => {
    workletRef.current?.disconnect();
    workletRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    for (const source of sourcesRef.current) {
      try {
        source.stop();
      } catch {
        // Source may have already ended.
      }
    }
    sourcesRef.current.clear();

    const audioContext = audioContextRef.current;
    audioContextRef.current = null;

    if (audioContext && audioContext.state !== "closed") {
      await audioContext.close().catch(() => undefined);
    }
  }, []);

  const stop = useCallback(async () => {
    const websocket = websocketRef.current;

    if (websocket?.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify({ type: "session.end" }));
      window.setTimeout(() => websocket.close(), 250);
    } else if (websocket?.readyState === WebSocket.CONNECTING) {
      websocket.close();
    }

    websocketRef.current = null;
    await releaseAudio();
    setStatus("idle");
  }, [releaseAudio]);

  const playAudio = useCallback((base64Audio: string) => {
    const audioContext = audioContextRef.current;

    if (!audioContext) {
      return;
    }

    const raw = atob(base64Audio);
    const pcm = new Int16Array(raw.length / 2);

    for (let index = 0; index < pcm.length; index += 1) {
      pcm[index] = raw.charCodeAt(index * 2) | (raw.charCodeAt(index * 2 + 1) << 8);
    }

    const buffer = audioContext.createBuffer(1, pcm.length, 24000);
    const channel = buffer.getChannelData(0);

    for (let index = 0; index < pcm.length; index += 1) {
      channel[index] = pcm[index] / 32768;
    }

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    const startAt = Math.max(audioContext.currentTime, playheadRef.current);
    source.start(startAt);
    playheadRef.current = startAt + buffer.duration;
    sourcesRef.current.add(source);
    source.onended = () => sourcesRef.current.delete(source);
    setStatus("speaking");
  }, []);

  const start = useCallback(async () => {
    if (status !== "idle" && status !== "error") {
      await stop();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext || !window.WebSocket) {
      setError("Voice assistant is not supported in this browser.");
      setStatus("error");
      return;
    }

    setError(null);
    finalTranscriptRef.current = "";
    setStatus("permission");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
      streamRef.current = stream;
      setStatus("connecting");

      const tokenResponse = await fetch("/api/assemblyai/voice-token", { cache: "no-store" });
      const tokenData = (await tokenResponse.json().catch(() => null)) as { token?: string; error?: string } | null;

      if (!tokenResponse.ok || !tokenData?.token) {
        throw new Error(tokenData?.error || "Unable to start the voice assistant.");
      }

      const audioContext = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = audioContext;
      playheadRef.current = audioContext.currentTime;
      const processor = `
        class FlowbaseVoiceProcessor extends AudioWorkletProcessor {
          constructor(options) {
            super();
            this.inputSampleRate = options.processorOptions.inputSampleRate || sampleRate;
            this.targetSampleRate = 24000;
            this.ratio = this.inputSampleRate / this.targetSampleRate;
          }
          process(inputs) {
            const input = inputs[0] && inputs[0][0];
            if (!input) return true;
            const outputLength = Math.max(1, Math.floor(input.length / this.ratio));
            const pcm16 = new Int16Array(outputLength);
            for (let index = 0; index < outputLength; index += 1) {
              const sample = input[Math.min(input.length - 1, Math.floor(index * this.ratio))] || 0;
              pcm16[index] = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
            }
            this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
            return true;
          }
        }
        registerProcessor("flowbase-voice-processor", FlowbaseVoiceProcessor);
      `;
      const processorUrl = URL.createObjectURL(new Blob([processor], { type: "text/javascript" }));
      await audioContext.audioWorklet.addModule(processorUrl);
      URL.revokeObjectURL(processorUrl);

      const source = audioContext.createMediaStreamSource(stream);
      const worklet = new AudioWorkletNode(audioContext, "flowbase-voice-processor", {
        processorOptions: { inputSampleRate: audioContext.sampleRate },
      });
      workletRef.current = worklet;
      source.connect(worklet);
      await audioContext.resume();

      const websocketUrl = new URL("wss://agents.assemblyai.com/v1/ws");
      websocketUrl.searchParams.set("token", tokenData.token);
      const websocket = new WebSocket(websocketUrl);
      websocketRef.current = websocket;
      let ready = false;

      websocket.onopen = () => {
        websocket.send(
          JSON.stringify({
            type: "session.update",
            session: {
              system_prompt:
                "You are Flowbase's voice capture assistant. Keep spoken responses short. Your main job is to listen and transcribe the user's productivity request accurately.",
              greeting: "I'm listening.",
              output: { voice: "ivy" },
            },
          })
        );
      };

      worklet.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        if (!ready || websocket.readyState !== WebSocket.OPEN) {
          return;
        }

        websocket.send(JSON.stringify({ type: "input.audio", audio: encodeBase64(event.data) }));
      };

      websocket.onmessage = (event) => {
        const message = JSON.parse(String(event.data)) as {
          type?: string;
          text?: string;
          data?: string;
          status?: string;
          message?: string;
        };

        if (message.type === "session.ready") {
          ready = true;
          setStatus("listening");
        } else if (message.type === "input.speech.started") {
          for (const sourceNode of sourcesRef.current) {
            try {
              sourceNode.stop();
            } catch {
              // Already stopped.
            }
          }
          sourcesRef.current.clear();
          playheadRef.current = audioContext.currentTime;
          setStatus("listening");
        } else if (message.type === "input.speech.stopped") {
          setStatus("processing");
        } else if (message.type === "reply.audio" && message.data) {
          playAudio(message.data);
        } else if (message.type === "transcript.user" && message.text?.trim()) {
          const nextTranscript = message.text.trim();

          if (nextTranscript !== finalTranscriptRef.current) {
            finalTranscriptRef.current = nextTranscript;
            onTranscriptRef.current(nextTranscript);
          }
        } else if (message.type === "reply.done" && message.status !== "interrupted") {
          setStatus("listening");
        } else if (message.type === "session.error" || message.type === "error") {
          setError(message.message || "The voice assistant connection failed.");
          setStatus("error");
        } else if (message.type === "session.ended") {
          void stop();
        }
      };

      websocket.onerror = () => {
        setError("The voice assistant connection failed.");
        setStatus("error");
        void releaseAudio();
      };

      websocket.onclose = () => {
        websocketRef.current = null;
        void releaseAudio();
        setStatus((current) => (current === "error" ? current : "idle"));
      };
    } catch (nextError) {
      await releaseAudio();
      websocketRef.current?.close();
      websocketRef.current = null;
      setError(friendlyError(nextError, "Unable to start the voice assistant."));
      setStatus("error");
    }
  }, [playAudio, releaseAudio, status, stop]);

  useEffect(() => {
    const handlePageHide = () => {
      void stop();
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      void stop();
    };
  }, [stop]);

  return {
    status,
    error,
    isActive: status !== "idle" && status !== "error",
    start,
    stop,
  };
}

export function AiAssistantPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const submitPrompt = useCallback(
    (rawPrompt: string) => {
      const trimmedPrompt = rawPrompt.trim();

      if (!trimmedPrompt || isPending || !isSignedIn) {
        return;
      }

      const userMessage: Message = { id: createId("user"), role: "user", content: trimmedPrompt };
      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);
      setPrompt("");
      setError(null);

      startTransition(async () => {
        try {
          const chatMessages: AssistantChatMessage[] = nextMessages.map((message) => ({
            role: message.role,
            content: message.content,
          }));
          const response = await sendAssistantMessage({ messages: chatMessages });
          setMessages((current) => [...current, responseToMessage(response)]);
          if (response.type === "error") {
            setError(response.message);
          }
        } catch (sendError) {
          setError(friendlyError(sendError, "AI Assistant could not respond."));
        }
      });
    },
    [isPending, isSignedIn, messages]
  );

  const voice = useVoiceAgent(submitPrompt);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isPending]);

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }, [prompt]);

  function confirmAction(action: AssistantPendingAction) {
    setError(null);
    startTransition(async () => {
      try {
        const response = await confirmAssistantAction(action);
        setMessages((current) =>
          current
            .map((message) => (message.action?.id === action.id ? { ...message, action: undefined } : message))
            .concat(responseToMessage(response))
        );
        if (response.type === "action_result" && response.href?.startsWith("/ai-template-builder")) {
          window.dispatchEvent(new Event("generated-apps-changed"));
        }
        if (response.type === "error") {
          setError(response.message);
        }
      } catch (confirmError) {
        setError(friendlyError(confirmError, "The action could not be saved."));
      }
    });
  }

  function dismissAction(actionId: string) {
    setMessages((current) =>
      current.map((message) =>
        message.action?.id === actionId ? { ...message, action: undefined, content: "No problem. I did not save that action." } : message
      )
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitPrompt(prompt);
  }

  return (
    <section className="flex min-h-[calc(100vh-5rem)] flex-col bg-[#f8f7f2]">
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6 sm:px-6">
        <div className="min-h-0 flex-1 pb-5">
          {!isLoaded ? (
            <div className="rounded-lg border border-[#e7e1d6] bg-white p-6 text-sm text-[#665f55]">Loading assistant...</div>
          ) : null}

          {isLoaded && !isSignedIn ? (
            <div className="rounded-lg border border-[#e7e1d6] bg-white px-6 py-12 text-center shadow-sm">
              <Bot className="mx-auto size-8 text-[#7c5cff]" />
              <h2 className="mt-4 text-xl font-semibold text-[#24201c]">Sign in to use AI Assistant</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#665f55]">
                Your assistant can create tasks, notes, boards, calendar items, and templates only inside your account.
              </p>
            </div>
          ) : null}

          {isLoaded && isSignedIn && !messages.length ? (
            <div className="flex min-h-[54vh] flex-col items-center justify-center text-center">
              <div className="grid size-14 place-items-center rounded-2xl bg-[#e6f6e9] text-[#256f63] shadow-sm">
                <Sparkles className="size-6 text-[#f5a524]" />
              </div>
              <h2 className="mt-5 text-3xl font-semibold text-[#24201c]">AI Assistant</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#665f55]">
                Ask questions, plan your work, or queue actions across Flowbase. I will ask before saving anything important.
              </p>
              <div className="mt-7 grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {suggestions.map((suggestion) => {
                  const Icon = suggestion.icon;

                  return (
                    <button
                      key={suggestion.label}
                      type="button"
                      onClick={() => submitPrompt(suggestion.label)}
                      disabled={isPending}
                      className="flex min-h-24 items-start gap-3 rounded-lg border border-[#e7e1d6] bg-[#fffffb] p-4 text-left text-sm font-medium text-[#34302a] shadow-sm transition hover:border-[#cfe5d6] hover:bg-[#f3faf4] disabled:opacity-60"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#eef8ef] text-[#256f63]">
                        <Icon className="size-4" />
                      </span>
                      <span className="leading-5">{suggestion.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {messages.length ? (
            <div className="space-y-5">
              {messages.map((message) => (
                <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[min(760px,92%)] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm",
                      message.role === "user"
                        ? "rounded-br-md bg-[#256f63] text-white"
                        : "rounded-bl-md border border-[#e7e1d6] bg-[#fffffb] text-[#34302a]"
                    )}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.href ? (
                      <Button asChild size="sm" className="mt-3 h-8 rounded-lg bg-[#256f63] text-white hover:bg-[#1f5f55]">
                        <Link href={message.href}>
                          Open
                          <ArrowRight className="ml-1.5 size-3.5" />
                        </Link>
                      </Button>
                    ) : null}
                    {message.action ? (
                      <div className="mt-3 rounded-lg border border-[#d8eadf] bg-[#f3faf4] p-3 text-[#24201c]">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#256f63]">Confirm action</p>
                        <h3 className="mt-1 text-sm font-semibold">{message.action.title}</h3>
                        <p className="mt-1 text-xs leading-5 text-[#665f55]">{message.action.summary}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={isPending}
                            onClick={() => confirmAction(message.action as AssistantPendingAction)}
                            className="h-8 rounded-lg bg-[#256f63] text-white hover:bg-[#1f5f55]"
                          >
                            {isPending ? <LoaderCircle className="mr-1.5 size-3.5 animate-spin" /> : <Check className="mr-1.5 size-3.5" />}
                            Confirm
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isPending}
                            onClick={() => dismissAction((message.action as AssistantPendingAction).id)}
                            className="h-8 rounded-lg border-[#d9d1c4] bg-white text-[#665f55] hover:bg-[#fff8ef]"
                          >
                            <X className="mr-1.5 size-3.5" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
              {isPending ? (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-[#e7e1d6] bg-[#fffffb] px-4 py-3 text-sm text-[#665f55] shadow-sm">
                    <LoaderCircle className="size-4 animate-spin text-[#256f63]" />
                    Thinking...
                  </div>
                </div>
              ) : null}
              <div ref={endRef} />
            </div>
          ) : null}
        </div>

        {error || voice.error ? (
          <div className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-[#f2c8bd] bg-[#fff2ee] px-4 py-3 text-sm text-[#9f402a]">
            <span>{error || voice.error}</span>
            <button type="button" onClick={() => setError(null)} aria-label="Dismiss error">
              <X className="size-4" />
            </button>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="sticky bottom-0 rounded-2xl border border-[#e1dacd] bg-[#fffffb] p-2 shadow-[0_18px_70px_rgba(36,32,28,0.12)]">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submitPrompt(prompt);
                }
              }}
              disabled={!isSignedIn || isPending}
              rows={1}
              placeholder="Ask AI to plan, summarize, create, or update something..."
              className="max-h-44 min-h-11 flex-1 resize-none bg-transparent px-3 py-3 text-sm leading-6 text-[#34302a] outline-none placeholder:text-[#9a9287] disabled:opacity-60"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={!isSignedIn || isPending}
              onClick={() => (voice.isActive ? voice.stop() : voice.start())}
              title={voice.isActive ? "Stop voice assistant" : "Talk to AI"}
              aria-label={voice.isActive ? "Stop voice assistant" : "Talk to AI"}
              className={cn(
                "mb-1 size-10 rounded-lg text-[#665f55] hover:bg-[#eef8ef] hover:text-[#256f63]",
                voice.isActive && "bg-[#fff2ee] text-[#f04f78] hover:bg-[#ffe5dd] hover:text-[#d73d65]"
              )}
            >
              {voice.isActive ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            </Button>
            <Button
              type="submit"
              size="icon"
              disabled={!isSignedIn || isPending || !prompt.trim()}
              title="Send message"
              aria-label="Send message"
              className="mb-1 size-10 rounded-lg bg-[#256f63] text-white hover:bg-[#1f5f55]"
            >
              {isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#eee9df] px-3 py-2 text-xs text-[#8a8175]">
            <span>Shift + Enter for a new line</span>
            <span className={cn(voice.isActive && "font-medium text-[#256f63]")}>{voiceStatusText[voice.status]}</span>
          </div>
        </form>
      </div>
    </section>
  );
}
