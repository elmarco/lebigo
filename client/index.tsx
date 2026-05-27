import {
  SignInWithGoogle,
  signInWithGoogle,
  signOut,
  useAuth,
  useMutation,
  useQuery,
} from "lakebed/client";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { BG_IMAGE } from "../shared/bg";
import { PHONE_IMAGE } from "../shared/phone";
import { tarCreate } from "../shared/tar";

type RecordingRow = {
  id: string;
  audioData: string;
  mimeType: string;
  ownerId: string;
  displayName: string;
  picture: string;
  duration: string;
  createdAt: string;
  updatedAt: string;
};

const MAX_DURATION = 60;

const CARD_COLORS = [
  { border: "border-red-400", bg: "bg-red-50", btnBg: "bg-red-500", hoverBg: "hover:bg-red-600" },
  { border: "border-amber-400", bg: "bg-amber-50", btnBg: "bg-amber-500", hoverBg: "hover:bg-amber-600" },
  { border: "border-yellow-400", bg: "bg-yellow-50", btnBg: "bg-yellow-500", hoverBg: "hover:bg-yellow-600" },
  { border: "border-orange-400", bg: "bg-orange-50", btnBg: "bg-orange-500", hoverBg: "hover:bg-orange-600" },
  { border: "border-rose-400", bg: "bg-rose-50", btnBg: "bg-rose-500", hoverBg: "hover:bg-rose-600" },
];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64ToObjectUrl(base64: string, mimeType: string): string {
  const blob = new Blob([base64ToBytes(base64)], { type: mimeType });
  return URL.createObjectURL(blob);
}

function Avatar({ name, picture, size = "md" }: { name: string; picture?: string; size?: "md" | "lg" }) {
  const initial = name.trim().slice(0, 1).toUpperCase() || "?";
  const dim = size === "lg" ? "h-16 w-16 text-xl" : "h-8 w-8 text-sm";

  if (picture) {
    return (
      <img
        alt=""
        className={`${dim} shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm`}
        referrerPolicy="no-referrer"
        src={picture}
      />
    );
  }

  return (
    <span className={`${dim} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-400 to-yellow-400 font-bold text-white ring-2 ring-white shadow-sm`}>
      {initial}
    </span>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "à l'instant";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 ml-0.5">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  );
}

function RecordingCard({ rec, isOwn, colorIndex }: { rec: RecordingRow; isOwn: boolean; colorIndex: number }) {
  const deleteRecording = useMutation<[], void>("deleteRecording");
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const colors = CARD_COLORS[colorIndex % CARD_COLORS.length];

  useEffect(() => {
    const objectUrl = base64ToObjectUrl(rec.audioData, rec.mimeType);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [rec.audioData, rec.mimeType]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => setPlaying(false);
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [url]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      audio.currentTime = 0;
      setPlaying(false);
    } else {
      void audio.play();
      setPlaying(true);
    }
  }, [playing]);

  if (!url) return null;

  return (
    <div className={`relative flex flex-col items-center gap-3 rounded-2xl border-2 ${colors.border} ${colors.bg} backdrop-blur-sm p-5 shadow-sm transition-shadow hover:shadow-md`}>
      {isOwn && (
        <button
          type="button"
          onClick={() => void deleteRecording()}
          className="absolute top-2 right-2 rounded-full p-1 text-gray-300 hover:text-red-400 transition-colors"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      )}

      <Avatar name={rec.displayName} picture={rec.picture || undefined} size="lg" />

      <div className="text-center">
        <p className="text-sm font-semibold text-gray-800 truncate max-w-[140px]">
          {rec.displayName || "Anonyme"}
        </p>
        <p className="text-xs text-gray-400">
          {timeAgo(rec.updatedAt)}{rec.duration ? ` · ${formatTime(Number(rec.duration))}` : ""}
        </p>
      </div>

      <button
        type="button"
        onClick={togglePlay}
        className={`flex h-11 w-11 items-center justify-center rounded-full text-white shadow-md transition-all active:scale-95 ${colors.btnBg} ${colors.hoverBg}`}
      >
        {playing ? <StopIcon /> : <PlayIcon />}
      </button>

      <audio ref={audioRef} src={url} preload="auto" />
    </div>
  );
}

function Recorder() {
  const auth = useAuth();
  const saveRecording = useMutation<[string, string, string, string, string], void>("saveRecording");

  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const elapsedRef = useRef(0);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size === 0) return;

        setSaving(true);
        try {
          const base64 = await blobToBase64(blob);
          await saveRecording(
            base64,
            mimeType,
            auth.displayName || "Anonyme",
            auth.picture || "",
            String(elapsedRef.current)
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(`Échec de la sauvegarde: ${msg}`);
        } finally {
          setSaving(false);
        }
      };

      setElapsed(0);
      elapsedRef.current = 0;
      setIsRecording(true);
      mediaRecorder.start(1000);

      let seconds = 0;
      timerRef.current = window.setInterval(() => {
        seconds++;
        setElapsed(seconds);
        elapsedRef.current = seconds;
        if (seconds >= MAX_DURATION) {
          stopRecording();
        }
      }, 1000);
    } catch {
      setError("Accès au micro refusé");
    }
  }, [auth.displayName, auth.picture, saveRecording, stopRecording]);

  return (
    <div className="flex flex-col items-center gap-5 rounded-3xl bg-white/80 backdrop-blur-sm p-8 shadow-lg ring-1 ring-orange-100">
      <p className="text-sm font-medium text-gray-400 tracking-wide uppercase">
        {isRecording ? "Enregistrement…" : saving ? "Sauvegarde…" : "Enregistrer un bigo"}
      </p>

      <div className="text-5xl font-bold font-mono tabular-nums text-gray-800">
        {formatTime(isRecording ? elapsed : 0)}
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => {
          if (auth.isGuest) {
            signInWithGoogle();
            return;
          }
          if (isRecording) {
            stopRecording();
          } else {
            void startRecording();
          }
        }}
        className={`flex h-20 w-20 items-center justify-center rounded-full transition-all active:scale-95 ${
          isRecording
            ? "bg-red-500 shadow-lg shadow-red-200 hover:bg-red-600"
            : "bg-gradient-to-br from-red-500 via-orange-500 to-yellow-400 shadow-lg shadow-orange-200 hover:shadow-xl hover:shadow-orange-300"
        }`}
      >
        {isRecording ? (
          <span className="h-7 w-7 rounded-md bg-white" />
        ) : (
          <span className="h-7 w-7 rounded-full bg-white" />
        )}
      </button>

      {isRecording && (
        <div className="w-56 rounded-full bg-gray-100 h-2 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-red-500 via-orange-400 to-yellow-400 transition-all duration-1000 ease-linear"
            style={{ width: `${(elapsed / MAX_DURATION) * 100}%` }}
          />
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <p className="text-xs text-gray-300">
        {auth.isGuest ? "Connectez-vous pour enregistrer" : "1 min max · remplace votre bigo précédent"}
      </p>
    </div>
  );
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 40) || "anonyme";
}

function downloadAllAsTar(recordings: RecordingRow[]) {
  const ext = (mime: string) => mime.includes("webm") ? "webm" : mime.includes("ogg") ? "ogg" : "audio";
  const entries = recordings.map((rec) => ({
    name: `${sanitizeFilename(rec.displayName)}_${rec.id.slice(0, 8)}.${ext(rec.mimeType)}`,
    data: base64ToBytes(rec.audioData),
  }));
  const tar = tarCreate(entries);
  const blob = new Blob([tar], { type: "application/x-tar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bigos.tar";
  a.click();
  URL.revokeObjectURL(url);
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M10 3a1 1 0 011 1v7.586l2.293-2.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 11.586V4a1 1 0 011-1z" />
      <path d="M3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
    </svg>
  );
}

function Feed() {
  const auth = useAuth();
  const allRecordings = useQuery<RecordingRow[]>("allRecordings");

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-lg font-bold text-gray-700">Tous les bigos</h2>
        {allRecordings.length > 0 && (
          <span className="rounded-full bg-gradient-to-r from-red-400 to-amber-400 px-2 py-0.5 text-xs font-semibold text-white">
            {allRecordings.length}
          </span>
        )}
        {allRecordings.length > 0 && auth.email === "marcandre.lureau@gmail.com" && (
          <button
            type="button"
            onClick={() => downloadAllAsTar(allRecordings)}
            className="ml-auto flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-600 shadow-sm ring-1 ring-gray-200 hover:ring-orange-300 hover:text-orange-600 transition-colors"
          >
            <DownloadIcon />
            Télécharger tout
          </button>
        )}
      </div>
      {allRecordings.length === 0 ? (
        <p className="text-center text-gray-400 py-12 text-sm">
          Aucun bigo pour l'instant — soyez le premier à en enregistrer un !
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {allRecordings.map((rec, i) => (
            <RecordingCard
              key={rec.id}
              rec={rec}
              isOwn={rec.ownerId === auth.userId}
              colorIndex={i}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const BG_DATA_URI = `data:image/jpeg;base64,${BG_IMAGE}`;

function useBackgroundImage() {
  useEffect(() => {
    const body = document.body;
    body.style.backgroundImage = `url("${BG_DATA_URI}")`;
    body.style.backgroundSize = "cover";
    body.style.backgroundPosition = "center";
    body.style.backgroundAttachment = "fixed";
    body.style.backgroundRepeat = "no-repeat";
    return () => {
      body.style.backgroundImage = "";
    };
  }, []);
}

export function App() {
  const auth = useAuth();
  useBackgroundImage();

  return (
    <main
      style={{ position: "relative", minHeight: "100vh", backgroundColor: "rgba(255, 252, 245, 0.8)" }}
    >
      <div className="px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 flex items-center justify-between">
            <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 bg-clip-text text-transparent">
              25 ans de Byin Mayé!
            </h1>
            <div className="flex items-center gap-3">
              {!auth.isLoading && auth.isGuest ? (
                <SignInWithGoogle className="shrink-0 rounded-full bg-white px-4 py-1.5 text-sm font-medium text-gray-600 shadow-sm ring-1 ring-gray-200 hover:ring-gray-300" />
              ) : !auth.isLoading ? (
                <>
                  <Avatar name={auth.displayName} picture={auth.picture} />
                  <button
                    type="button"
                    onClick={() => signOut()}
                    className="text-sm text-gray-400 hover:text-gray-600"
                  >
                    Déconnexion
                  </button>
                </>
              ) : null}
            </div>
          </div>

          <div className="relative mb-8 overflow-hidden rounded-2xl bg-white/70 backdrop-blur-sm px-6 py-5">
            <img
              src={`data:image/png;base64,${PHONE_IMAGE}`}
              alt=""
              style={{
                position: "absolute",
                right: "-40px",
                top: "-20px",
                width: "220px",
                height: "220px",
                objectFit: "contain",
                transform: "rotate(15deg)",
                opacity: 0.25,
                pointerEvents: "none",
              }}
            />
            <p className="relative text-center text-gray-800 text-base font-medium leading-relaxed" style={{ zIndex: 1 }}>
              Partagez un souvenir, une anecdote, ou tout autre revendication, le bigo vous écoute! Mais vous avez <span className="text-red-500 font-bold">1 minute</span>, et pas plus.
            </p>
          </div>

          <div className="mb-10">
            <Recorder />
          </div>

          <Feed />
        </div>
      </div>
    </main>
  );
}
