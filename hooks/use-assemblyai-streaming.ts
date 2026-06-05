"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AssemblyAIStreamingStatus =
  | "idle"
  | "permission"
  | "connecting"
  | "recording"
  | "stopping"
  | "error";

type AssemblyAIWord = {
  text?: string;
  word_is_final?: boolean;
};

type AssemblyAITurn = {
  type: "Turn";
  turn_order?: number;
  transcript?: string;
  end_of_turn?: boolean;
  words?: AssemblyAIWord[];
};

type UseAssemblyAIStreamingOptions = {
  onFinalTranscript: (text: string) => void;
  onTimeLimit?: () => void;
  maxDurationSeconds?: number;
};

const SAMPLE_RATE = 16_000;
const DEFAULT_MAX_DURATION_SECONDS = 120;

function getErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Microphone permission was denied. Allow microphone access and try again.";
  }

  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "No microphone was found on this device.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to start speech-to-text.";
}

function encodePcm16(input: Float32Array) {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);

  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index]));
    view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return buffer;
}

function downsample(input: Float32Array, inputRate: number) {
  if (inputRate === SAMPLE_RATE) {
    return input;
  }

  const ratio = inputRate / SAMPLE_RATE;
  const outputLength = Math.round(input.length / ratio);
  const output = new Float32Array(outputLength);
  let inputOffset = 0;

  for (let outputOffset = 0; outputOffset < outputLength; outputOffset += 1) {
    const nextInputOffset = Math.round((outputOffset + 1) * ratio);
    let sum = 0;
    let count = 0;

    for (; inputOffset < nextInputOffset && inputOffset < input.length; inputOffset += 1) {
      sum += input[inputOffset];
      count += 1;
    }

    output[outputOffset] = count ? sum / count : 0;
  }

  return output;
}

export function useAssemblyAIStreaming({
  onFinalTranscript,
  onTimeLimit,
  maxDurationSeconds = DEFAULT_MAX_DURATION_SECONDS,
}: UseAssemblyAIStreamingOptions) {
  const [status, setStatus] = useState<AssemblyAIStreamingStatus>("idle");
  const [preview, setPreview] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const silenceGainRef = useRef<GainNode | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const committedByTurnRef = useRef(new Map<number, string[]>());
  const intentionalCloseRef = useRef(false);
  const onFinalTranscriptRef = useRef(onFinalTranscript);
  const onTimeLimitRef = useRef(onTimeLimit);
  const stopRecordingRef = useRef<(reason?: "manual" | "timeout" | "error") => Promise<void>>(
    async () => {}
  );

  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript;
    onTimeLimitRef.current = onTimeLimit;
  }, [onFinalTranscript, onTimeLimit]);

  const releaseResources = useCallback(async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    silenceGainRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current = null;
    silenceGainRef.current = null;

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;

    const audioContext = audioContextRef.current;
    audioContextRef.current = null;

    if (audioContext && audioContext.state !== "closed") {
      await audioContext.close().catch(() => undefined);
    }
  }, []);

  const stopRecording = useCallback(
    async (reason: "manual" | "timeout" | "error" = "manual") => {
      const websocket = websocketRef.current;
      intentionalCloseRef.current = true;

      if (status !== "idle" && reason !== "error") {
        setStatus("stopping");
      }

      await releaseResources();

      if (websocket?.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({ type: "Terminate" }));
        window.setTimeout(() => websocket.close(), 250);
      } else if (websocket?.readyState === WebSocket.CONNECTING) {
        websocket.close();
      }

      websocketRef.current = null;
      committedByTurnRef.current.clear();
      setPreview("");
      setElapsedSeconds(0);

      if (reason === "timeout") {
        onTimeLimitRef.current?.();
      }

      if (reason !== "error") {
        setStatus("idle");
      }
    },
    [releaseResources, status]
  );
  stopRecordingRef.current = stopRecording;

  const startRecording = useCallback(async () => {
    if (status !== "idle" && status !== "error") {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext || !window.WebSocket) {
      setError("Speech-to-text is not supported in this browser.");
      setStatus("error");
      return;
    }

    setError(null);
    setPreview("");
    setElapsedSeconds(0);
    intentionalCloseRef.current = false;
    committedByTurnRef.current.clear();
    setStatus("permission");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;
      setStatus("connecting");

      const tokenResponse = await fetch("/api/assemblyai/token", { cache: "no-store" });
      const tokenData = (await tokenResponse.json().catch(() => null)) as
        | { token?: string; error?: string }
        | null;

      if (!tokenResponse.ok || !tokenData?.token) {
        throw new Error(tokenData?.error || "Unable to start AssemblyAI streaming.");
      }

      const websocketUrl = new URL("wss://streaming.assemblyai.com/v3/ws");
      websocketUrl.searchParams.set("token", tokenData.token);
      websocketUrl.searchParams.set("speech_model", "universal-streaming-english");
      websocketUrl.searchParams.set("sample_rate", String(SAMPLE_RATE));
      websocketUrl.searchParams.set("format_turns", "true");

      const websocket = new WebSocket(websocketUrl);
      websocket.binaryType = "arraybuffer";
      websocketRef.current = websocket;

      websocket.onopen = async () => {
        const activeStream = mediaStreamRef.current;

        if (!activeStream) {
          await stopRecordingRef.current("error");
          return;
        }

        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(activeStream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        const silenceGain = audioContext.createGain();
        silenceGain.gain.value = 0;
        audioContextRef.current = audioContext;
        sourceRef.current = source;
        processorRef.current = processor;
        silenceGainRef.current = silenceGain;

        processor.onaudioprocess = (event) => {
          if (websocket.readyState !== WebSocket.OPEN) {
            return;
          }

          const channelData = event.inputBuffer.getChannelData(0);
          websocket.send(encodePcm16(downsample(channelData, audioContext.sampleRate)));
        };

        source.connect(processor);
        processor.connect(silenceGain);
        silenceGain.connect(audioContext.destination);
        await audioContext.resume();

        setStatus("recording");
        const startedAt = Date.now();
        intervalRef.current = setInterval(() => {
          setElapsedSeconds(Math.min(maxDurationSeconds, Math.floor((Date.now() - startedAt) / 1000)));
        }, 250);
        timeoutRef.current = setTimeout(() => {
          void stopRecordingRef.current("timeout");
        }, maxDurationSeconds * 1000);
      };

      websocket.onmessage = (event) => {
        let message: unknown;

        try {
          message = JSON.parse(String(event.data));
        } catch {
          return;
        }

        const turn = message as AssemblyAITurn;

        if (turn.type !== "Turn") {
          return;
        }

        const turnOrder = turn.turn_order ?? 0;
        const committedWords = committedByTurnRef.current.get(turnOrder) ?? [];
        const stableWords =
          turn.words
            ?.filter((word) => word.word_is_final && word.text)
            .map((word) => word.text as string) ?? [];
        const newWords = stableWords.slice(committedWords.length);

        if (newWords.length) {
          committedByTurnRef.current.set(turnOrder, stableWords);
          onFinalTranscriptRef.current(newWords.join(" "));
        }

        if (!turn.words?.length && turn.end_of_turn && turn.transcript?.trim()) {
          onFinalTranscriptRef.current(turn.transcript.trim());
        }

        setPreview(turn.transcript?.trim() ?? "");

        if (turn.end_of_turn) {
          setPreview("");
          committedByTurnRef.current.delete(turnOrder);
        }
      };

      websocket.onerror = () => {
        setError("The AssemblyAI streaming connection failed. Try again.");
        setStatus("error");
        void stopRecordingRef.current("error");
      };

      websocket.onclose = (event) => {
        websocketRef.current = null;

        if (event.code !== 1000 && event.code !== 1005 && !intentionalCloseRef.current) {
          setError("The speech-to-text session ended unexpectedly.");
          setStatus("error");
        }

        void releaseResources();
      };
    } catch (nextError) {
      await releaseResources();
      websocketRef.current?.close();
      websocketRef.current = null;
      setError(getErrorMessage(nextError));
      setStatus("error");
    }
  }, [maxDurationSeconds, releaseResources, status]);

  useEffect(() => {
    const handlePageHide = () => {
      void stopRecordingRef.current();
    };

    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      void stopRecordingRef.current();
    };
  }, []);

  return {
    status,
    preview,
    elapsedSeconds,
    error,
    isActive: status !== "idle" && status !== "error",
    isRecording: status === "recording",
    startRecording,
    stopRecording,
  };
}
