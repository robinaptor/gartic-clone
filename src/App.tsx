import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot, 
  updateDoc, 
  arrayUnion,
  increment,
  getDoc
} from 'firebase/firestore';
import { 
  Pencil, 
  Eraser, 
  Trash2, 
  Play, 
  CheckCircle, 
  Loader2, 
  Undo,
  Image as ImageIcon,
  Star,
  Crown,
  Palette,
  Zap,
  ArrowRight,
  Ghost,
  MessageSquare,
  XCircle,
  Camera,
  Upload,
  RefreshCw,
  Grid3X3, 
  PaintBucket,
  Volume2,
  VolumeX,
  Clock,
  User,
  Download
} from 'lucide-react';

// ==========================================
// 1. CONFIGURATION FIREBASE
// ==========================================

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

if (!firebaseConfig.apiKey) {
    console.error("Firebase config missing!");
    // Eviter un alert bloquant au chargement, mais logger
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ID unique de l'application pour séparer les données dans Firestore
const appId = 'gartic-final-omega-v7-ultimate'; 

// ==========================================
// 2. SYSTÈME AUDIO (HOOK)
// ==========================================

const useSound = () => {
    const [muted, setMuted] = useState(false);
    
    // Synthétiseur simple utilisant l'API Web Audio
    // Cela évite d'avoir à gérer des fichiers .mp3 externes
    const playTone = (freq: number, type: 'sine'|'square'|'sawtooth'|'triangle', duration: number, vol: number = 0.1) => {
        if (muted) return;
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = type;
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            
            gain.gain.setValueAtTime(vol, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start();
            osc.stop(ctx.currentTime + duration);
        } catch (e) {
            console.error("Audio error", e);
        }
    };

    const playPop = () => playTone(600, 'sine', 0.1, 0.1);
    const playJoin = () => { 
        playTone(400, 'sine', 0.1); 
        setTimeout(() => playTone(600, 'sine', 0.1), 100); 
    };
    const playStart = () => { 
        playTone(300, 'square', 0.1); 
        setTimeout(() => playTone(400, 'square', 0.1), 150); 
        setTimeout(() => playTone(500, 'square', 0.3), 300); 
    };
    const playTick = () => playTone(800, 'sawtooth', 0.05, 0.05);
    const playWin = () => {
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
            setTimeout(() => playTone(freq, 'triangle', 0.3, 0.2), i * 150);
        });
    };

    return { muted, setMuted, playPop, playJoin, playStart, playTick, playWin };
};

// ==========================================
// 3. STYLES GLOBAUX & UTILITAIRES
// ==========================================

const GlobalStyles = () => (
  <style>{`
    @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
    @keyframes wobble { 0%, 100% { transform: rotate(-2deg); } 50% { transform: rotate(2deg); } }
    @keyframes popIn { 0% { transform: scale(0); opacity: 0; } 80% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
    @keyframes pulse-red { 0%, 100% { background-color: #ef4444; } 50% { background-color: #991b1b; } }
    
    .animate-float { animation: float 3s ease-in-out infinite; }
    .animate-wobble { animation: wobble 2s ease-in-out infinite; }
    .animate-pop { animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
    
    .bg-pattern { 
        background-color: #7c3aed; 
        background-image: radial-gradient(#a78bfa 2px, transparent 2px); 
        background-size: 30px 30px; 
    }
    
    .shadow-hard { box-shadow: 4px 4px 0px 0px rgba(0,0,0,1); }
    .shadow-hard-lg { box-shadow: 8px 8px 0px 0px rgba(0,0,0,1); }
    .shadow-hard-sm { box-shadow: 2px 2px 0px 0px rgba(0,0,0,1); }
    
    /* OPTIMISATION MOBILE & SCROLL */
    html, body { 
        overflow-x: hidden; 
        width: 100%; 
        overscroll-behavior: none; 
        position: fixed; 
        height: 100%;
        overflow-y: auto;
    }
    
    .touch-none { 
        touch-action: none !important; 
        user-select: none !important; 
        -webkit-user-select: none !important; 
    }

    /* PIXEL ART RENDERING */
    .image-pixelated {
        image-rendering: pixelated;
        image-rendering: -moz-crisp-edges;
        image-rendering: crisp-edges;
    }
    
    /* HIDE SCROLLBAR */
    .scrollbar-hide::-webkit-scrollbar {
        display: none;
    }
    .scrollbar-hide {
        -ms-overflow-style: none;
        scrollbar-width: none;
    }
  `}</style>
);

// ==========================================
// 4. TYPES TYPESCRIPT
// ==========================================

type GameMode = 'CLASSIC' | 'EXQUISITE' | 'TRADITIONAL' | 'PIXEL';
type Phase = 'LOBBY' | 'WRITE_START' | 'DRAW' | 'GUESS' | 'VOTE' | 'PODIUM' | 'RESULTS' | 'EXQUISITE_DRAW';

interface Player {
  uid: string; 
  name: string;
  isHost: boolean;
  isReady: boolean;
  hasVoted: boolean;
  score: number;
  avatarColor: string;
  avatarImage?: string;
  isSpectator?: boolean; // <--- NOUVEAU
}

interface GameStep {
  type: 'TEXT' | 'DRAWING';
  authorId: string;
  authorName: string;
  content: string; 
  votes: number;
}

interface GameChain {
  ownerId: string; 
  steps: GameStep[];
}

interface RoomData {
  code: string;
  mode: GameMode;
  players: Player[];
  phase: Phase;
  round: number; 
  chains: Record<string, GameChain>; 
  maxRounds: number;
  createdAt: number;
  timerDuration: number; // 0 = infini
  turnExpiresAt?: number; // Timestamp de fin du tour
}

// ==========================================
// 5. CONSTANTES DE JEU
// ==========================================

const AVATAR_COLORS = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-400', 'bg-blue-400', 'bg-purple-400', 'bg-pink-400', 'bg-teal-400'];
const DRAW_COLORS = ['#000000', '#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#78350f'];
const BRUSH_SIZES = [4, 8, 16, 32];

// ==========================================
// 6. COMPOSANTS UI GÉNÉRIQUES
// ==========================================

const FunButton = ({ onClick, disabled, children, color = 'yellow', className = '', icon: Icon }: any) => {
  const colorClasses: any = {
    yellow: 'bg-yellow-400 hover:bg-yellow-300 border-yellow-900 text-black',
    green: 'bg-green-500 hover:bg-green-400 border-green-900 text-white',
    purple: 'bg-purple-600 hover:bg-purple-500 border-purple-900 text-white',
    red: 'bg-red-500 hover:bg-red-400 border-red-900 text-white',
    gray: 'bg-gray-200 hover:bg-gray-100 border-gray-800 text-gray-800',
    white: 'bg-white hover:bg-gray-50 border-black text-black',
    blue: 'bg-blue-500 hover:bg-blue-400 border-blue-900 text-white',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative group px-4 py-3 md:px-6 md:py-3 rounded-xl font-black text-sm md:text-lg uppercase tracking-wider transition-all
        border-2 border-b-[4px] md:border-b-[6px] active:border-b-2 active:translate-y-[2px] md:active:translate-y-[4px]
        disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:border-b-[4px] md:disabled:border-b-[6px]
        flex items-center justify-center gap-2 w-full md:w-auto
        ${colorClasses[color]} ${className}
      `}
    >
      {Icon && <Icon size={20} className="md:w-6 md:h-6" strokeWidth={3} />}
      {children}
    </button>
  );
};

const FunCard = ({ children, className = '', title }: any) => (
  <div className={`bg-white border-4 border-black rounded-3xl shadow-hard p-4 md:p-6 w-full ${className}`}>
    {title && (
      <div className="bg-black text-white inline-block px-3 py-1 md:px-4 md:py-1 rounded-full font-bold uppercase tracking-widest mb-4 transform -rotate-2 border-2 border-white shadow-sm text-sm md:text-base">
        {title}
      </div>
    )}
    {children}
  </div>
);

const PlayerBadge = ({ name, isHost, isReady, isMe, hasVoted, uid, color = 'bg-gray-400', avatarImage, onKick, canKick }: any) => (
  <div className={`
    relative flex flex-col items-center p-2 md:p-3 rounded-2xl border-4 border-black bg-white transition-all group
    ${isReady ? 'shadow-hard bg-green-50 -translate-y-1' : 'shadow-sm opacity-90'}
    ${hasVoted ? 'ring-4 ring-yellow-400' : ''}
  `}>
    {isHost && <Crown size={20} className="absolute -top-3 -right-3 md:-top-4 md:-right-4 text-yellow-500 fill-yellow-400 rotate-12 drop-shadow-md animate-bounce" />}
    {canKick && !isMe && (
      <button 
        onClick={() => onKick(uid, name)}
        className="absolute -top-2 -left-2 bg-red-500 text-white p-1 rounded-full border-2 border-black hover:scale-110 transition-transform z-10 shadow-sm md:opacity-0 md:group-hover:opacity-100 opacity-100"
      >
        <XCircle size={14} strokeWidth={3} />
      </button>
    )}
    <div className={`w-12 h-12 md:w-16 md:h-16 rounded-full border-4 border-black flex items-center justify-center text-xl md:text-2xl font-black text-white mb-2 ${color} shadow-inner overflow-hidden bg-white`}>
      {avatarImage ? (
        <img src={avatarImage} className="w-full h-full object-cover" alt="Avatar" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
    <div className="text-center w-full">
      <div className="font-bold text-black truncate w-full text-xs md:text-base leading-tight">{name}</div>
      {isMe && <div className="text-[10px] font-black text-purple-600 uppercase tracking-wider">(Moi)</div>}
    </div>
    {isReady && <div className="absolute -bottom-3 bg-green-500 text-white text-[10px] md:text-xs font-bold px-2 py-1 rounded-full border-2 border-black flex items-center gap-1"><CheckCircle size={10} /> PRÊT</div>}
    {hasVoted && <div className="absolute -bottom-3 bg-yellow-400 text-black text-[10px] md:text-xs font-bold px-2 py-1 rounded-full border-2 border-black flex items-center gap-1"><Star size={10} fill="black"/> A VOTÉ</div>}
  </div>
);

const TimerBar = ({ expiresAt, duration, onExpire }: { expiresAt?: number, duration: number, onExpire?: () => void }) => {
    const [timeLeft, setTimeLeft] = useState(duration);
    const [progress, setProgress] = useState(100);
    const lastTick = useRef(Math.ceil(duration));

    // Hook pour les sons (on le récupère ici pour le tic tac)
    const { playTick } = useSound();

    useEffect(() => {
        if (!expiresAt || duration <= 0) return;
        const interval = setInterval(() => {
            const now = Date.now();
            const diff = Math.ceil((expiresAt - now) / 1000);
            const p = Math.max(0, ((expiresAt - now) / (duration * 1000)) * 100);
            
            setTimeLeft(diff);
            setProgress(p);

            // Son de tic-tac pour les 10 dernières secondes
            if (diff <= 10 && diff > 0 && diff < lastTick.current) {
                playTick();
                lastTick.current = diff;
            }

            if (now >= expiresAt) {
                clearInterval(interval);
                if (onExpire) onExpire();
            }
        }, 100);
        return () => clearInterval(interval);
    }, [expiresAt, duration]);

    if (!expiresAt || duration <= 0) return null;

    return (
        <div className="fixed top-0 left-0 w-full h-2 bg-gray-200 z-50">
            <div 
                className={`h-full transition-all duration-100 ease-linear ${timeLeft <= 10 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}
                style={{ width: `${progress}%` }}
            />
            <div className={`absolute top-4 right-4 font-black text-xl bg-black text-white px-3 py-1 rounded-lg border-2 border-white shadow-md ${timeLeft <= 10 ? 'text-red-500 animate-bounce' : ''}`}>
                {Math.max(0, timeLeft)}s
            </div>
        </div>
    );
};

// ==========================================
// 7. ÉDITEURS (AVATAR, DESSIN, PIXEL)
// ==========================================

// --- AVATAR EDITOR ---
const AvatarEditor = ({ onSave }: { onSave: (data: string) => void }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    useEffect(() => {
        const canvas = canvasRef.current;
        if(canvas) {
            const ctx = canvas.getContext('2d');
            if(ctx) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0,0,100,100);
            }
        }
    }, []);

    const draw = (e: any) => {
        const canvas = canvasRef.current;
        if(!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
        const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
        const ctx = canvas.getContext('2d');
        if(ctx) {
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    };

    const clear = () => {
        const canvas = canvasRef.current;
        if(canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0,0,100,100);
            ctx!.fillStyle='#ffffff'; ctx!.fillRect(0,0,100,100);
            onSave('');
        }
    }

    return (
        <div className="flex flex-col items-center gap-2">
            <p className="font-bold text-sm uppercase text-purple-600">Dessine ta tête !</p>
            <div className="relative border-4 border-black rounded-xl overflow-hidden shadow-sm w-[100px] h-[100px]">
                <canvas 
                    ref={canvasRef} 
                    width={100} 
                    height={100} 
                    className="cursor-crosshair touch-none bg-white"
                    onPointerMove={(e) => { if(e.buttons === 1) draw(e); }}
                    onPointerDown={(e) => draw(e)}
                    onPointerUp={() => onSave(canvasRef.current?.toDataURL() || '')}
                    onTouchMove={(e) => draw(e)} // Support mobile explicite
                />
                <button onClick={clear} className="absolute bottom-1 right-1 bg-gray-200 p-1 rounded-md hover:bg-red-200"><Trash2 size={12}/></button>
            </div>
        </div>
    );
}

// --- PIXEL ART EDITOR ---
const PixelArtEditor = ({ onSave }: { onSave: (data: string) => void }) => {
  const GRID_WIDTH = 32;
  const GRID_HEIGHT = 24;
  const [pixels, setPixels] = useState<string[][]>(
    Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill('#ffffff'))
  );
  const [color, setColor] = useState('#000000');
  const [tool, setTool] = useState<'PENCIL' | 'BUCKET' | 'ERASER'>('PENCIL');
  const [showGrid, setShowGrid] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  useEffect(() => {
      drawCanvas();
  }, [pixels, showGrid]);

  const drawCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      const cellW = w / GRID_WIDTH;
      const cellH = h / GRID_HEIGHT;

      // Fond
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);

      // Pixels
      pixels.forEach((row, y) => {
          row.forEach((col, x) => {
              ctx.fillStyle = col;
              ctx.fillRect(x * cellW, y * cellH, cellW + 1, cellH + 1);
          });
      });

      // Grille
      if (showGrid) {
          ctx.strokeStyle = 'rgba(0,0,0,0.1)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let x = 0; x <= GRID_WIDTH; x++) {
              ctx.moveTo(x * cellW, 0);
              ctx.lineTo(x * cellW, h);
          }
          for (let y = 0; y <= GRID_HEIGHT; y++) {
              ctx.moveTo(0, y * cellH);
              ctx.lineTo(w, y * cellH);
          }
          ctx.stroke();
      }
  };

  const handleAction = (e: any) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      const x = Math.floor((clientX - rect.left) / (rect.width / GRID_WIDTH));
      const y = Math.floor((clientY - rect.top) / (rect.height / GRID_HEIGHT));

      if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
          if (tool === 'BUCKET') {
              floodFill(x, y, color);
          } else {
              const newColor = tool === 'ERASER' ? '#ffffff' : color;
              if (pixels[y][x] !== newColor) {
                  const newPixels = [...pixels];
                  newPixels[y] = [...newPixels[y]];
                  newPixels[y][x] = newColor;
                  setPixels(newPixels);
              }
          }
      }
  };

  const floodFill = (startX: number, startY: number, fillCol: string) => {
      const targetColor = pixels[startY][startX];
      if (targetColor === fillCol) return;

      const newPixels = pixels.map(row => [...row]);
      const stack = [[startX, startY]];

      while (stack.length) {
          const [x, y] = stack.pop()!;
          if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) continue;
          if (newPixels[y][x] !== targetColor) continue;

          newPixels[y][x] = fillCol;
          stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
      setPixels(newPixels);
  };

  const handleExport = () => {
      // Créer un canvas temporaire haute résolution pour l'export
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 640; 
      tempCanvas.height = 480;
      const ctx = tempCanvas.getContext('2d');
      if (ctx) {
          ctx.imageSmoothingEnabled = false; 
          
          const cellW = tempCanvas.width / GRID_WIDTH;
          const cellH = tempCanvas.height / GRID_HEIGHT;

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0,0, tempCanvas.width, tempCanvas.height);

          pixels.forEach((row, y) => {
              row.forEach((col, x) => {
                  ctx.fillStyle = col;
                  ctx.fillRect(x * cellW, y * cellH, cellW + 1, cellH + 1); 
              });
          });
          onSave(tempCanvas.toDataURL('image/jpeg', 0.8));
      }
  };

  return (
    <div className="flex flex-col gap-4 items-center w-full h-full max-w-3xl mx-auto">
       <div className="relative w-full aspect-[4/3] bg-gray-200 rounded-xl border-4 border-black shadow-hard-lg overflow-hidden touch-none cursor-crosshair">
          <canvas 
            ref={canvasRef}
            width={640}
            height={480}
            className="w-full h-full touch-none image-pixelated"
            onPointerDown={(e) => {
                e.preventDefault();
                isDrawing.current = true;
                handleAction(e);
            }}
            onPointerMove={(e) => {
                e.preventDefault();
                if (isDrawing.current && tool !== 'BUCKET') handleAction(e);
            }}
            onPointerUp={() => isDrawing.current = false}
            onPointerLeave={() => isDrawing.current = false}
          />
       </div>

       <div className="bg-white border-4 border-black rounded-2xl p-3 shadow-hard w-full">
           <div className="flex flex-col gap-3 items-center justify-center">
               <div className="flex gap-2 w-full justify-center overflow-x-auto pb-2 md:pb-0">
                   <button onClick={() => setTool('PENCIL')} className={`p-3 rounded-xl border-2 border-black ${tool === 'PENCIL' ? 'bg-blue-500 text-white shadow-hard-sm -translate-y-1' : 'bg-gray-100'}`}><Pencil size={20} /></button>
                   <button onClick={() => setTool('BUCKET')} className={`p-3 rounded-xl border-2 border-black ${tool === 'BUCKET' ? 'bg-orange-500 text-white shadow-hard-sm -translate-y-1' : 'bg-gray-100'}`}><PaintBucket size={20} /></button>
                   <button onClick={() => setTool('ERASER')} className={`p-3 rounded-xl border-2 border-black ${tool === 'ERASER' ? 'bg-red-500 text-white shadow-hard-sm -translate-y-1' : 'bg-gray-100'}`}><Eraser size={20} /></button>
                   <div className="w-px bg-gray-300 h-10 mx-2"></div>
                   <button onClick={() => setShowGrid(!showGrid)} className={`p-3 rounded-xl border-2 border-black ${showGrid ? 'bg-purple-100 border-purple-500' : 'bg-gray-100'}`}><Grid3X3 size={20} /></button>
                   <FunButton onClick={handleExport} color="green" className="py-2 text-sm px-6 ml-auto">FINI !</FunButton>
               </div>
               <div className="w-full h-px bg-gray-200"></div>
               <div className="flex flex-wrap justify-center gap-2 w-full px-2">
                   {DRAW_COLORS.map((c) => (
                       <button key={c} onClick={() => { setColor(c); if(tool === 'ERASER') setTool('PENCIL'); }} className={`w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-black transition-transform ${color === c && tool !== 'ERASER' ? 'ring-4 ring-blue-400 scale-110 z-10 shadow-lg' : 'hover:scale-105'}`} style={{ backgroundColor: c }} />
                   ))}
               </div>
           </div>
       </div>
    </div>
  );
};

// --- COMPOSANT DESSIN STANDARD ---
// --- COMPOSANT DESSIN ROBUSTE (CORRIGÉ UI) ---
// --- COMPOSANT DESSIN AMÉLIORÉ (AVEC BUCKET TOOL) ---
const DrawingCanvas = ({ 
  initialImage, 
  onSave, 
  isReadOnly = false,
  guideImage = null
}: { 
  initialImage?: string | null, 
  onSave: (data: string) => void, 
  isReadOnly?: boolean,
  guideImage?: string | null
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(8);
  const [tool, setTool] = useState<'PENCIL' | 'ERASER' | 'BUCKET'>('PENCIL'); // Nouveau state Tool
  const [history, setHistory] = useState<string[]>([]);

  const internalWidth = 800;
  const internalHeight = 600;
  const state = useRef({ isDrawing: false, lastX: 0, lastY: 0 });

  // --- ALGORITHME DE FLOOD FILL (POT DE PEINTURE) ---
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 0, g: 0, b: 0 };
  };

  const floodFill = (startX: number, startY: number, fillColorHex: string) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Sauvegarder avant modification
    saveState();

    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Coordonnées entières
    const x = Math.floor(startX);
    const y = Math.floor(startY);

    // Couleur cible (celle sous la souris)
    const startPos = (y * width + x) * 4;
    const startR = data[startPos];
    const startG = data[startPos + 1];
    const startB = data[startPos + 2];
    const startA = data[startPos + 3];

    // Couleur de remplissage
    const { r: fillR, g: fillG, b: fillB } = hexToRgb(fillColorHex);
    const fillA = 255;

    // Si la couleur est la même, on arrête
    if (startR === fillR && startG === fillG && startB === fillB && startA === fillA) return;

    const matchStartColor = (pos: number) => {
      return data[pos] === startR && data[pos + 1] === startG && data[pos + 2] === startB && data[pos + 3] === startA;
    };

    const colorPixel = (pos: number) => {
      data[pos] = fillR;
      data[pos + 1] = fillG;
      data[pos + 2] = fillB;
      data[pos + 3] = fillA;
    };

    const stack = [[x, y]];

    while (stack.length) {
      const newPos = stack.pop();
      if(!newPos) continue;
      const [cx, cy] = newPos;
      
      let pixelPos = (cy * width + cx) * 4;
      
      // Monter tant qu'on est sur la couleur de départ
      let currY = cy;
      while (currY >= 0 && matchStartColor(pixelPos)) {
        currY--;
        pixelPos -= width * 4;
      }
      pixelPos += width * 4;
      currY++;
      
      let reachLeft = false;
      let reachRight = false;
      
      while (currY < height && matchStartColor(pixelPos)) {
        colorPixel(pixelPos);
        
        if (cx > 0) {
          if (matchStartColor(pixelPos - 4)) {
            if (!reachLeft) { stack.push([cx - 1, currY]); reachLeft = true; }
          } else if (reachLeft) {
            reachLeft = false;
          }
        }
        
        if (cx < width - 1) {
          if (matchStartColor(pixelPos + 4)) {
            if (!reachRight) { stack.push([cx + 1, currY]); reachRight = true; }
          } else if (reachRight) {
            reachRight = false;
          }
        }
        
        currY++;
        pixelPos += width * 4;
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
    onSave(canvas.toDataURL('image/jpeg', 0.4));
  };

  // --- GESTION DU CANVAS ---

  useEffect(() => {
    const canvas = canvasRef.current; 
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        if (history.length === 0 && !initialImage) { 
            ctx.fillStyle = '#ffffff'; 
            ctx.fillRect(0, 0, canvas.width, canvas.height); 
        }
        if (initialImage) { 
            const img = new Image(); 
            img.onload = () => ctx.drawImage(img, 0, 0, internalWidth, internalHeight); 
            img.src = initialImage; 
        }
    }
  }, [initialImage]);

  const saveState = () => { 
      const canvas = canvasRef.current; 
      if(canvas) setHistory(prev => [...prev.slice(-10), canvas.toDataURL('image/jpeg', 0.5)]); 
  };

  const getCoords = (e: PointerEvent, canvas: HTMLCanvasElement) => {
      const rect = canvas.getBoundingClientRect();
      return { 
          x: (e.clientX - rect.left) * (canvas.width / rect.width), 
          y: (e.clientY - rect.top) * (canvas.height / rect.height) 
      };
  };

  useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || isReadOnly) return;

      const handlePointerDown = (e: PointerEvent) => {
          e.preventDefault(); 
          const { x, y } = getCoords(e, canvas);
          
          // SI TOOL EST BUCKET
          if (tool === 'BUCKET') {
            floodFill(x, y, color);
            return;
          }

          canvas.setPointerCapture(e.pointerId);
          saveState();
          state.current.isDrawing = true;
          state.current.lastX = x; state.current.lastY = y;
          const ctx = canvas.getContext('2d');
          if (ctx) { 
              ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y); 
              ctx.strokeStyle = tool === 'ERASER' ? '#ffffff' : color; 
              ctx.lineWidth = brushSize; ctx.stroke(); 
          }
      };

      const handlePointerMove = (e: PointerEvent) => {
          e.preventDefault(); 
          if (!state.current.isDrawing) return;
          const ctx = canvas.getContext('2d');
          if (ctx) {
              const { x, y } = getCoords(e, canvas);
              ctx.beginPath(); ctx.moveTo(state.current.lastX, state.current.lastY); ctx.lineTo(x, y); 
              ctx.strokeStyle = tool === 'ERASER' ? '#ffffff' : color; 
              ctx.lineWidth = brushSize; ctx.stroke();
              state.current.lastX = x; state.current.lastY = y;
          }
      };

      const handlePointerUp = (e: PointerEvent) => {
          e.preventDefault();
          if (state.current.isDrawing) {
              state.current.isDrawing = false;
              canvas.releasePointerCapture(e.pointerId);
              onSave(canvas.toDataURL('image/jpeg', 0.4));
          }
      };

      canvas.addEventListener('pointerdown', handlePointerDown, { passive: false });
      canvas.addEventListener('pointermove', handlePointerMove, { passive: false });
      canvas.addEventListener('pointerup', handlePointerUp);
      canvas.addEventListener('pointerleave', handlePointerUp);

      return () => {
          canvas.removeEventListener('pointerdown', handlePointerDown);
          canvas.removeEventListener('pointermove', handlePointerMove);
          canvas.removeEventListener('pointerup', handlePointerUp);
          canvas.removeEventListener('pointerleave', handlePointerUp);
      };
  }, [isReadOnly, color, brushSize, tool]); // Dépendance 'tool' ajoutée

  const undo = () => {
    if (history.length === 0) return;
    const lastState = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    const canvas = canvasRef.current; const ctx = canvas?.getContext('2d');
    if (canvas && ctx && lastState) { 
        const img = new Image(); 
        img.onload = () => { 
            ctx.fillStyle = '#ffffff'; 
            ctx.fillRect(0, 0, canvas.width, canvas.height); 
            ctx.drawImage(img, 0, 0); 
            onSave(canvas.toDataURL('image/jpeg', 0.4)); 
        }; 
        img.src = lastState; 
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current; const ctx = canvas?.getContext('2d');
    if(canvas && ctx) { 
        saveState(); 
        ctx.fillStyle = '#ffffff'; 
        ctx.fillRect(0,0,canvas.width, canvas.height); 
        onSave(canvas.toDataURL('image/jpeg', 0.4)); 
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-5xl mx-auto items-center justify-center gap-2 md:gap-4">
        <div className="relative w-full max-w-full max-h-full aspect-[4/3] bg-white rounded-xl border-4 border-black shadow-hard-lg overflow-hidden shrink-1 min-h-0">
            {guideImage && (
                <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-10 opacity-100">
                    <div className="w-full h-[15%] overflow-hidden relative border-b-2 border-dashed border-red-500 bg-white/50">
                         <img src={guideImage} className="absolute bottom-0 w-full h-[666%] object-cover object-bottom opacity-70" alt="Guide" />
                         <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-2 py-1">RACCORDE ICI</div>
                    </div>
                </div>
            )}
            <canvas 
                ref={canvasRef} 
                width={internalWidth} 
                height={internalHeight} 
                className={`w-full h-full touch-none select-none ${isReadOnly ? 'cursor-default' : tool === 'BUCKET' ? 'cursor-[url(https://api.iconify.design/lucide/paint-bucket.svg),_pointer]' : 'cursor-crosshair'}`} 
            />
            {!isReadOnly && (
                <div className="absolute top-2 left-2 md:top-4 md:left-4 flex gap-2 z-20">
                    <button onClick={undo} disabled={history.length === 0} className="bg-white border-2 border-black p-2 rounded-lg hover:bg-gray-100 shadow-hard-sm disabled:opacity-50"><Undo size={20}/></button>
                    <button onClick={clearCanvas} className="bg-red-100 border-2 border-black p-2 rounded-lg hover:bg-red-200 shadow-hard-sm text-red-600"><Trash2 size={20}/></button>
                </div>
            )}
        </div>

        {!isReadOnly && (
            <div className="bg-white border-4 border-black rounded-2xl p-2 shadow-hard w-full shrink-0">
                <div className="flex flex-col md:flex-row gap-2 md:gap-4 items-center justify-center">
                    <div className="flex w-full md:w-auto justify-between md:justify-start gap-4 items-center border-b-2 md:border-b-0 border-gray-200 pb-2 md:pb-0">
                        <div className="flex gap-2">
                            <button onClick={() => setTool('PENCIL')} className={`p-2 md:p-3 rounded-xl border-2 border-black transition-transform ${tool === 'PENCIL' ? 'bg-blue-500 text-white -translate-y-1 shadow-hard-sm' : 'bg-gray-100 text-gray-600'}`}><Pencil size={20} /></button>
                            <button onClick={() => setTool('BUCKET')} className={`p-2 md:p-3 rounded-xl border-2 border-black transition-transform ${tool === 'BUCKET' ? 'bg-orange-500 text-white -translate-y-1 shadow-hard-sm' : 'bg-gray-100 text-gray-600'}`}><PaintBucket size={20} /></button>
                            <button onClick={() => setTool('ERASER')} className={`p-2 md:p-3 rounded-xl border-2 border-black transition-transform ${tool === 'ERASER' ? 'bg-red-500 text-white -translate-y-1 shadow-hard-sm' : 'bg-gray-100 text-gray-600'}`}><Eraser size={20} /></button>
                        </div>
                        <div className="h-8 w-px bg-gray-300 hidden md:block"></div>
                        <div className="flex gap-1 md:gap-2 items-center">
                            {BRUSH_SIZES.map(size => <button key={size} onClick={() => setBrushSize(size)} className={`rounded-full bg-black transition-all ${brushSize === size ? 'ring-4 ring-yellow-400 scale-110' : 'opacity-30'}`} style={{ width: size/2 + 6, height: size/2 + 6 }} />)}
                        </div>
                    </div>
                    <div className="h-8 w-px bg-gray-300 hidden md:block"></div>
                    <div className="flex flex-wrap justify-center gap-1 md:gap-2 w-full md:w-auto">
                        {DRAW_COLORS.map((c) => <button key={c} onClick={() => { setColor(c); if (tool === 'ERASER') setTool('PENCIL'); }} className={`w-6 h-6 md:w-8 md:h-8 rounded-full border-2 border-black transition-transform shadow-sm ${color === c && tool !== 'ERASER' ? 'ring-4 ring-yellow-400 scale-110 z-10' : ''}`} style={{ backgroundColor: c }} />)}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

// --- COMPOSANT CAMÉRA ---
const CameraCapture = ({ onCapture }: { onCapture: (data: string) => void }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState<string>('');

    const startCamera = async () => {
        setIsStreaming(false); setError(''); setCapturedImage(null);
        try {
            const constraints = { video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } };
            let mediaStream;
            try { mediaStream = await navigator.mediaDevices.getUserMedia(constraints); } 
            catch (e) { mediaStream = await navigator.mediaDevices.getUserMedia({ video: true }); }
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
                videoRef.current.onloadedmetadata = () => { videoRef.current?.play(); setIsStreaming(true); };
            }
        } catch (err) { console.error(err); setError("Caméra inaccessible. Utilise l'import."); }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
            setIsStreaming(false);
        }
    };

    const takePhoto = () => {
        const video = videoRef.current; const canvas = canvasRef.current;
        if (video && canvas) {
            const ratio = video.videoHeight / video.videoWidth; const width = Math.min(600, video.videoWidth);
            canvas.width = width; canvas.height = width * ratio;
            canvas.getContext('2d')?.drawImage(video, 0, 0, width, width * ratio);
            setCapturedImage(canvas.toDataURL('image/jpeg', 0.5)); stopCamera();
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ratio = img.height / img.width; const width = Math.min(600, img.width);
                    canvas.width = width; canvas.height = width * ratio;
                    canvas.getContext('2d')?.drawImage(img, 0, 0, width, width * ratio);
                    setCapturedImage(canvas.toDataURL('image/jpeg', 0.5)); stopCamera();
                };
                img.src = event.target?.result as string;
            };
            reader.readAsDataURL(file);
        }
    };

    useEffect(() => { startCamera(); return () => stopCamera(); }, []);

    if (capturedImage) {
        return (
            <div className="w-full flex flex-col items-center gap-4 animate-pop">
                <img src={capturedImage} className="w-full rounded-xl border-4 border-black shadow-hard" alt="Captured" />
                <div className="flex gap-4 w-full max-w-md">
                    <FunButton onClick={() => {setCapturedImage(null); startCamera();}} color="red" icon={RefreshCw} className="flex-1">Refaire</FunButton>
                    <FunButton onClick={() => onCapture(capturedImage!)} color="green" icon={ArrowRight} className="flex-1">Envoyer</FunButton>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full flex flex-col items-center gap-4">
            <div className="relative w-full max-w-md bg-black rounded-xl overflow-hidden border-4 border-black shadow-hard aspect-[4/3] flex items-center justify-center">
                <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${isStreaming ? 'block' : 'hidden'}`} />
                {!isStreaming && !error && <div className="text-white flex flex-col items-center"><Loader2 className="animate-spin mb-2" size={32}/><p>Chargement...</p></div>}
                {error && <div className="p-4 text-center text-white"><p>⚠️ {error}</p></div>}
                <canvas ref={canvasRef} className="hidden" />
            </div>
            <div className="flex flex-col gap-3 w-full max-w-md">
                <FunButton onClick={takePhoto} disabled={!isStreaming} color="purple" icon={Camera} className="w-full">Prendre Photo</FunButton>
                <label className="cursor-pointer w-full"><div className="bg-white border-2 border-black border-dashed rounded-xl p-3 flex items-center justify-center gap-2 font-bold hover:bg-gray-50 text-gray-600 transition-all active:scale-95"><Upload size={20} /> Choisir depuis la galerie</div><input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" /></label>
            </div>
        </div>
    );
};

const SpectatorView = ({ room, myId }: { room: RoomData, myId: string }) => {
  const [focusedIndex, setFocusedIndex] = useState(0);
  
  // Filtre les joueurs qui ne sont PAS spectateurs pour ne regarder que ceux qui jouent
  const activePlayers = room.players.filter(p => !p.isSpectator);
  const focusedPlayer = activePlayers[focusedIndex] || activePlayers[0];

  const nextPlayer = () => setFocusedIndex((prev) => (prev + 1) % activePlayers.length);
  const prevPlayer = () => setFocusedIndex((prev) => (prev - 1 + activePlayers.length) % activePlayers.length);

  return (
      <div className="min-h-screen bg-gray-800 flex flex-col items-center justify-center p-4 font-sans relative">
          <GlobalStyles />
          
          {/* Header Spectateur */}
          <div className="absolute top-4 left-4 bg-red-600 text-white px-4 py-2 rounded-full border-2 border-white shadow-hard font-black animate-pulse flex items-center gap-2">
              <div className="w-3 h-3 bg-white rounded-full animate-ping"/>
              SPECTATEUR
          </div>

          {/* Main Card */}
          <div className="w-full max-w-lg relative">
              {/* Flèches Navigation */}
              <button onClick={prevPlayer} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-16 bg-white p-3 rounded-full border-4 border-black shadow-hard hover:scale-110 transition-transform z-20">
                  <ArrowRight className="rotate-180" size={32}/>
              </button>
              <button onClick={nextPlayer} className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-16 bg-white p-3 rounded-full border-4 border-black shadow-hard hover:scale-110 transition-transform z-20">
                  <ArrowRight size={32}/>
              </button>

              <FunCard className="text-center pb-12 pt-12 relative overflow-visible">
                  {/* Badge Joueur observé */}
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex flex-col items-center">
                      <div className={`w-24 h-24 rounded-full border-4 border-black ${focusedPlayer.avatarColor} flex items-center justify-center overflow-hidden shadow-hard`}>
                           {focusedPlayer.avatarImage ? <img src={focusedPlayer.avatarImage} className="w-full h-full object-cover"/> : <User size={40} color="white"/>}
                      </div>
                  </div>

                  <h2 className="text-3xl font-black mt-8 mb-2 uppercase">{focusedPlayer.name}</h2>
                  
                  <div className="bg-gray-100 rounded-xl p-4 border-2 border-black min-h-[100px] flex flex-col items-center justify-center gap-2">
                      {focusedPlayer.isReady ? (
                          <>
                              <CheckCircle className="text-green-500 w-12 h-12 mb-2" />
                              <p className="font-bold text-green-600 uppercase">A terminé son tour !</p>
                          </>
                      ) : (
                          <>
                              <Loader2 className="text-blue-500 w-12 h-12 mb-2 animate-spin" />
                              <p className="font-bold text-blue-600 uppercase animate-pulse">
                                  {room.phase === 'DRAW' || room.phase === 'EXQUISITE_DRAW' ? 'Est en train de dessiner...' : 'Est en train d\'écrire...'}
                              </p>
                          </>
                      )}
                  </div>

                  <p className="mt-4 text-gray-400 text-sm font-bold">
                      (Tu verras le résultat à la fin du chrono)
                  </p>
              </FunCard>
          </div>
          
          <div className="mt-8 text-white font-bold opacity-50">
              Joueur {focusedIndex + 1} / {activePlayers.length}
          </div>
      </div>
  );
}

// ==========================================
// 8. COMPOSANT PRINCIPAL (APP)
// ==========================================

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [playerName, setPlayerName] = useState('');
  const [playerAvatar, setPlayerAvatar] = useState('');
  const [roomCode, setRoomCode] = useState(''); 
  const [joinCode, setJoinCode] = useState(''); 
  const [currentRoom, setCurrentRoom] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(false);
  const [inputContent, setInputContent] = useState(''); 
  const [isReady, setIsReady] = useState(false);
  const [selectedMode, setSelectedMode] = useState<GameMode>('CLASSIC');
  const [timerDuration, setTimerDuration] = useState(0);

  // Hook Audio
  const { muted, setMuted, playPop, playJoin, playStart, playTick, playWin } = useSound();

  const [tabId] = useState(() => {
      const existing = sessionStorage.getItem('gartic_tab_id');
      if (existing) return existing;
      const newId = Math.random().toString(36).substring(2, 10);
      sessionStorage.setItem('gartic_tab_id', newId);
      return newId;
  });
  const myId = user ? `${user.uid}_${tabId}` : null;

  // --- EFFETS DE BORD ---

  useEffect(() => {
    signInAnonymously(auth).catch((err) => { console.error("Erreur Auth:", err); alert("Erreur de connexion Firebase."); });
    const unsubscribe = onAuthStateChanged(auth, (u) => { setUser(u); });
    return () => unsubscribe();
  }, []);

  const prevPhase = useRef<Phase | null>(null);
  const prevPlayerCount = useRef(0);

  useEffect(() => {
    if (!user || !roomCode) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'gartic_rooms', roomCode);
    return onSnapshot(roomRef, (snap) => {
      if (snap.exists()) {
          const data = snap.data() as RoomData;
          const amIStillIn = data.players.some(p => p.uid === myId);
          
          // Gestion des Sons
          if (data.phase !== prevPhase.current) {
              if (data.phase !== 'LOBBY') playStart();
              if (data.phase === 'PODIUM') playWin();
              prevPhase.current = data.phase;
          }
          if (data.players.length > prevPlayerCount.current) {
              playJoin();
              prevPlayerCount.current = data.players.length;
          }
          
          if (!amIStillIn && data.phase !== 'RESULTS') {
            alert("Tu as été éjecté de la partie !"); setCurrentRoom(null); setRoomCode(''); return;
          }
          setCurrentRoom(data);
          if (data.mode) setSelectedMode(data.mode);
      } else setCurrentRoom(null); 
    });
  }, [user, roomCode, myId]);

  // --- LOGIQUE DE JEU (ACTIONS) ---

  const createRoom = async () => {
    if (!playerName.trim()) {
        alert("Entre un pseudo !");
        return;
    }
    if (!user) {
        alert("Erreur: Non connecté au serveur de jeu (Firebase). Vérifie ta connexion internet.");
        return;
    }
    setLoading(true);
    
    try {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'gartic_rooms', code);
        const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

        const newPlayer: Player = { 
            uid: myId!, // Safe because we checked user above, but myId depends on it
            name: playerName, 
            isHost: true, 
            isReady: false, 
            hasVoted: false, 
            score: 0, 
            avatarColor: randomColor,
            avatarImage: playerAvatar 
        };
        const newRoom: RoomData = { 
            code, 
            mode: 'CLASSIC', 
            players: [newPlayer], 
            phase: 'LOBBY', 
            round: 0, 
            chains: {}, 
            maxRounds: 3, 
            createdAt: Date.now(),
            timerDuration: 0 
        };

        await setDoc(roomRef, newRoom);
        setRoomCode(code);
        playPop();
    } catch (e: any) {
        console.error("Erreur création room:", e);
        alert("Impossible de créer la partie : " + (e.message || "Erreur inconnue"));
    } finally {
        setLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!playerName.trim()) {
        alert("Choisis un pseudo !");
        return;
    }
    if (!joinCode.trim()) {
        alert("Entre un code !");
        return;
    }
    if (!user) {
        alert("Erreur: Non connecté (Firebase).");
        return;
    }

    setLoading(true);
    const code = joinCode.toUpperCase();
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'gartic_rooms', code);
    
    try {
        const snap = await getDoc(roomRef);
        if (snap.exists()) {
            const data = snap.data() as RoomData;
            
            // MODIFICATION ICI : On détermine si c'est un spectateur
            const isSpectator = data.phase !== 'LOBBY'; 
            
            let updatedPlayers = [...data.players];
            const existingIndex = updatedPlayers.findIndex(p => p.uid === myId);
            const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
            
            const playerObj: Player = { 
                uid: myId!, 
                name: playerName, 
                isHost: false, 
                isReady: isSpectator, // Un spectateur est toujours "prêt" pour ne pas bloquer
                hasVoted: isSpectator, // Il ne vote pas (ou compte comme ayant voté)
                score: 0, 
                avatarColor: randomColor,
                avatarImage: playerAvatar,
                isSpectator: isSpectator // Marqueur important
            };

            if (existingIndex >= 0) { 
                // Si le joueur revient, on garde son statut (sauf s'il était spectateur)
                updatedPlayers[existingIndex] = { 
                    ...updatedPlayers[existingIndex], 
                    name: playerName, 
                    avatarImage: playerAvatar,
                    // Si on rejoint en cours, on force le mode spectateur si on n'était pas déjà dans la liste active
                    isSpectator: isSpectator && !updatedPlayers[existingIndex].isSpectator ? false : isSpectator
                }; 
            } else { 
                updatedPlayers.push(playerObj); 
            }
            
            await updateDoc(roomRef, { players: updatedPlayers }); 
            setRoomCode(code); 
            playPop();
        } else { 
            alert("Code invalide ou partie terminée !"); 
        }
    } catch (error: any) { 
        console.error("Erreur JOIN:", error); 
        alert("Oups, impossible de rejoindre : " + (error.message || "Erreur inconnue")); 
    } finally {
        setLoading(false);
    }
  };

  const updateTimerSettings = async (duration: number) => {
      if (!currentRoom || !myId) return;
      const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'gartic_rooms', roomCode);
      await updateDoc(roomRef, { timerDuration: duration });
  }

  const startGame = async () => {
    if (!currentRoom || !user) return;
    const initialChains: Record<string, GameChain> = {};
    currentRoom.players.forEach(p => { initialChains[p.uid] = { ownerId: p.uid, steps: [] }; });
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'gartic_rooms', roomCode);
    const resetPlayers = currentRoom.players.map(p => ({...p, score: 0, hasVoted: false, isReady: false}));
    
    const updates: any = { chains: initialChains, players: resetPlayers, round: 0 };
    
    // Gestion Timer
    if (currentRoom.timerDuration > 0) {
        updates.turnExpiresAt = Date.now() + (currentRoom.timerDuration * 1000);
    } else {
        updates.turnExpiresAt = null;
    }

    if (currentRoom.mode === 'EXQUISITE') { updates.phase = 'EXQUISITE_DRAW'; updates.maxRounds = 3; } 
    else { updates.phase = 'WRITE_START'; updates.maxRounds = currentRoom.players.length; }
    await updateDoc(roomRef, updates);
  };

  const submitContent = async (contentOverride?: string) => {
    if (!currentRoom || !myId) return;
    setIsReady(true);
    playPop();
    const myIndex = currentRoom.players.findIndex(p => p.uid === myId);
    const totalPlayers = currentRoom.players.length;
    const ownerIndex = (myIndex - currentRoom.round + (totalPlayers * 10)) % totalPlayers;
    const ownerId = currentRoom.players[ownerIndex].uid;

    let stepType: 'TEXT' | 'DRAWING' = 'DRAWING';
    if (currentRoom.mode === 'CLASSIC' || currentRoom.mode === 'TRADITIONAL' || currentRoom.mode === 'PIXEL') {
        stepType = currentRoom.round % 2 === 0 ? 'TEXT' : 'DRAWING';
    }

    const finalContent = contentOverride || inputContent;
    const step: GameStep = { type: stepType, authorId: myId, authorName: currentRoom.players.find(p => p.uid === myId)?.name || 'Inconnu', content: finalContent || (stepType === 'TEXT' ? '...' : ''), votes: 0 };
    
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'gartic_rooms', roomCode);
    try { await updateDoc(roomRef, { [`chains.${ownerId}.steps`]: arrayUnion(step), players: currentRoom.players.map(p => p.uid === myId ? { ...p, isReady: true } : p) }); } catch (err) { console.error(err); }
    setInputContent('');
  };

  const castVote = async (targetChainOwnerId: string, stepIndex: number) => {
    if (!currentRoom || !myId) return;
    const chain = currentRoom.chains[targetChainOwnerId];
    if (!chain) return;
    playPop();
    const updatedSteps = [...chain.steps];
    if (updatedSteps[stepIndex]) updatedSteps[stepIndex].votes = (updatedSteps[stepIndex].votes || 0) + 1;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'gartic_rooms', roomCode);
    await updateDoc(roomRef, { [`chains.${targetChainOwnerId}.steps`]: updatedSteps, players: currentRoom.players.map(p => p.uid === myId ? { ...p, hasVoted: true } : p) });
  };

  // AUTO-NEXT (Gestion par le Host)
  useEffect(() => {
    if (!currentRoom || !myId) return;
    const me = currentRoom.players.find(p => p.uid === myId);
    if (!me?.isHost) return; 
    
    const allReady = currentRoom.players.every(p => p.isReady);
    const allVoted = currentRoom.players.every(p => p.hasVoted);

    // Passage automatique Round suivant
    if (allReady && !['LOBBY', 'VOTE', 'PODIUM', 'RESULTS'].includes(currentRoom.phase)) {
        const nextUpdates: any = {};
        
        if (currentRoom.round + 1 >= currentRoom.maxRounds) {
            nextUpdates.phase = 'VOTE';
            nextUpdates.players = currentRoom.players.map(p => ({...p, isReady: false, hasVoted: false}));
        } else {
            let nextPhase: Phase = (currentRoom.mode === 'CLASSIC' || currentRoom.mode === 'TRADITIONAL' || currentRoom.mode === 'PIXEL') 
                ? ((currentRoom.round + 1) % 2 === 0 ? 'GUESS' : 'DRAW') 
                : 'EXQUISITE_DRAW';
            nextUpdates.round = increment(1);
            nextUpdates.phase = nextPhase;
            nextUpdates.players = currentRoom.players.map(p => ({...p, isReady: false}));
            
            if (currentRoom.timerDuration > 0) {
                nextUpdates.turnExpiresAt = Date.now() + (currentRoom.timerDuration * 1000) + 1500; 
            }
        }
        const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'gartic_rooms', roomCode);
        setTimeout(() => { updateDoc(roomRef, nextUpdates); }, 1000);
    }

    // Passage automatique Podium
    if (currentRoom.phase === 'VOTE' && allVoted) {
        const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'gartic_rooms', roomCode);
        setTimeout(() => updateDoc(roomRef, { phase: 'PODIUM' }), 1500);
    }
  }, [currentRoom, myId, roomCode]);

  const getPreviousContent = () => {
      if (!currentRoom || !myId) return null;
      const myIndex = currentRoom.players.findIndex(p => p.uid === myId);
      const totalPlayers = currentRoom.players.length;
      const ownerIndex = (myIndex - currentRoom.round + (totalPlayers * 10)) % totalPlayers;
      const ownerId = currentRoom.players[ownerIndex].uid;
      const chain = currentRoom.chains[ownerId];
      if (!chain || chain.steps.length === 0) return null;
      return chain.steps[chain.steps.length - 1];
  };

  // RESET / RESTART
  const returnToLobby = async () => {
    if (!currentRoom || !roomCode) return;
    playPop();
    const resetPlayers = currentRoom.players.map(p => ({
        ...p,
        score: 0,
        isReady: false,
        hasVoted: false
    }));
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'gartic_rooms', roomCode);
    await updateDoc(roomRef, {
        phase: 'LOBBY',
        round: 0,
        chains: {},
        players: resetPlayers
    });
  };

  // ==========================================
  // 9. RENDU PRINCIPAL
  // ==========================================

  if (!user) return <div className="h-screen flex items-center justify-center bg-pattern"><Loader2 className="animate-spin text-white" size={48}/></div>;

  // ECRAN ACCUEIL
  if (!currentRoom) {
    return (
        <div className="min-h-screen bg-pattern flex items-center justify-center p-4 font-sans relative">
            <GlobalStyles />
            <button onClick={() => setMuted(!muted)} className="absolute top-4 right-4 bg-white p-2 rounded-full border-2 border-black shadow-hard z-50">
                {muted ? <VolumeX size={24}/> : <Volume2 size={24}/>}
            </button>

            <FunCard className="w-full max-w-md text-center border-black border-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transform md:rotate-1">
                <div className="mb-4 relative">
                    <h1 className="text-4xl md:text-6xl font-black text-yellow-400 tracking-tighter uppercase drop-shadow-md stroke-black" style={{WebkitTextStroke: '2px black'}}>Gartic Clone</h1>
                </div>
                <div className="space-y-4">
                    <div className="text-left space-y-2">
                        <label className="block text-lg font-black text-black uppercase tracking-wide">Ton Pseudo</label>
                        <input type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value)} className="w-full px-4 py-3 rounded-xl border-4 border-black font-bold text-lg focus:outline-none focus:shadow-hard bg-gray-50" placeholder="SuperArtiste..." maxLength={12}/>
                        
                        <div className="bg-gray-100 p-3 rounded-xl border-2 border-black flex justify-center flex-col items-center gap-2">
                             <p className="font-bold text-xs uppercase text-gray-500">Avatar (Optionnel)</p>
                             {/* Si l'utilisateur ne dessine rien (playerAvatar vide), le jeu utilisera la lettre + couleur */}
                             <AvatarEditor onSave={setPlayerAvatar} />
                        </div>
                    </div>
                    <div className="flex flex-col gap-3 pt-2">
                        {/* MODIFICATION ICI : J'ai retiré "!playerAvatar" des conditions disabled */}
                        <FunButton onClick={createRoom} disabled={loading || !playerName} color="purple" icon={Palette} className="w-full">Créer une Party</FunButton>
                        
                        <div className="flex items-center gap-4"><div className="h-1 flex-1 bg-black rounded-full"></div><span className="font-black text-gray-400">OU</span><div className="h-1 flex-1 bg-black rounded-full"></div></div>
                        
                        <div className="flex gap-2">
                            <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} className="flex-1 px-4 py-3 rounded-xl border-4 border-black font-mono text-center font-black text-xl uppercase tracking-widest focus:outline-none focus:shadow-hard min-w-0" placeholder="CODE" maxLength={6}/>
                            {/* MODIFICATION ICI AUSSI */}
                            <FunButton onClick={joinRoom} disabled={loading || !playerName || !joinCode} color="green">GO</FunButton>
                        </div>
                    </div>
                </div>
            </FunCard>
        </div>
    );
  }

  const me = currentRoom.players.find(p => p.uid === myId);
  const showTimer = currentRoom.turnExpiresAt && !['LOBBY','VOTE','PODIUM','RESULTS'].includes(currentRoom.phase) && !isReady;

  return (
      <>
        {/* TIMER BAR */}
        {showTimer && (
            <TimerBar 
                expiresAt={currentRoom.turnExpiresAt} 
                duration={currentRoom.timerDuration} 
                onExpire={() => { if (!isReady) submitContent(); }}
            />
        )}

        {/* MUTE BTN IN-GAME */}
        <button onClick={() => setMuted(!muted)} className="fixed top-4 right-4 bg-white p-2 rounded-full border-2 border-black shadow-hard z-50 hover:scale-110 transition-transform">
            {muted ? <VolumeX size={20}/> : <Volume2 size={20}/>}
        </button>

        {/* --- VIEW: SPECTATOR --- */}
        {me?.isSpectator && !['LOBBY', 'RESULTS', 'VOTE', 'PODIUM'].includes(currentRoom.phase) && (
            <SpectatorView room={currentRoom} myId={myId || ''} />
        )}

        {/* --- VIEW: LOBBY --- */}
        {currentRoom.phase === 'LOBBY' && (
          <div className="min-h-screen bg-pattern p-4 md:p-6 font-sans">
              <GlobalStyles />
              <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
                  <div className="bg-white border-4 border-black rounded-3xl p-4 md:p-6 shadow-hard-lg flex flex-col gap-6">
                      <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-b-4 border-black pb-6">
                        <div className="text-center md:text-left">
                            <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight mb-2">Salon d'attente</h2>
                            <div className="flex items-center gap-3 justify-center md:justify-start bg-gray-100 p-2 rounded-xl border-2 border-black">
                                <span className="text-gray-600 font-bold">CODE:</span>
                                <span className="font-mono font-black text-2xl md:text-3xl text-purple-600 tracking-widest select-all">{currentRoom.code}</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-center gap-2 w-full md:w-auto">
                            <span className="font-black text-sm uppercase tracking-widest">Mode de Jeu</span>
                            <div className="flex flex-wrap gap-2 bg-gray-100 p-1 rounded-xl border-2 border-black w-full md:w-auto justify-center mb-2">
                                <button onClick={() => me?.isHost && (playTick(), updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gartic_rooms', roomCode), {mode:'CLASSIC'}))} disabled={!me?.isHost} className={`px-3 py-2 rounded-lg font-bold flex items-center gap-2 text-xs ${currentRoom.mode === 'CLASSIC' ? 'bg-white border-2 border-black shadow-hard-sm' : 'text-gray-400'}`}><MessageSquare size={14}/> Classique</button>
                                <button onClick={() => me?.isHost && (playTick(), updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gartic_rooms', roomCode), {mode:'PIXEL'}))} disabled={!me?.isHost} className={`px-3 py-2 rounded-lg font-bold flex items-center gap-2 text-xs ${currentRoom.mode === 'PIXEL' ? 'bg-orange-500 border-2 border-black shadow-hard-sm text-white' : 'text-gray-400'}`}><Grid3X3 size={14}/> Pixel</button>
                                <button onClick={() => me?.isHost && (playTick(), updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gartic_rooms', roomCode), {mode:'EXQUISITE'}))} disabled={!me?.isHost} className={`px-3 py-2 rounded-lg font-bold flex items-center gap-2 text-xs ${currentRoom.mode === 'EXQUISITE' ? 'bg-purple-500 border-2 border-black shadow-hard-sm text-white' : 'text-gray-400'}`}><Ghost size={14}/> Exquis</button>
                                <button onClick={() => me?.isHost && (playTick(), updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gartic_rooms', roomCode), {mode:'TRADITIONAL'}))} disabled={!me?.isHost} className={`px-3 py-2 rounded-lg font-bold flex items-center gap-2 text-xs ${currentRoom.mode === 'TRADITIONAL' ? 'bg-blue-500 border-2 border-black shadow-hard-sm text-white' : 'text-gray-400'}`}><Camera size={14}/> Papier</button>
                            </div>
                            
                            {me?.isHost && (
                                <div className="flex items-center gap-2 bg-yellow-100 p-2 rounded-xl border-2 border-black">
                                    <Clock size={16}/>
                                    <select 
                                        value={currentRoom.timerDuration || 0} 
                                        onChange={(e) => { playTick(); updateTimerSettings(Number(e.target.value)); }}
                                        className="bg-transparent font-bold text-sm focus:outline-none"
                                    >
                                        <option value={0}>Temps illimité</option>
                                        <option value={30}>30 secondes (Speed)</option>
                                        <option value={60}>60 secondes (Normal)</option>
                                        <option value={90}>90 secondes (Chill)</option>
                                    </select>
                                </div>
                            )}
                            {!me?.isHost && currentRoom.timerDuration > 0 && (
                                <div className="text-xs font-bold bg-yellow-100 px-2 py-1 rounded border border-black">⏱️ {currentRoom.timerDuration}s par tour</div>
                            )}
                        </div>
                      </div>
                      <div className="flex justify-center">
                            {me?.isHost && currentRoom.players.length > 1 ? (
                              <FunButton onClick={startGame} color="green" icon={Play} className="animate-pop w-full md:w-auto">Lancer la partie !</FunButton>
                            ) : me?.isHost ? (
                              <div className="px-4 py-2 bg-yellow-100 border-2 border-black rounded-lg font-bold text-yellow-800 text-center animate-pulse text-sm md:text-base">Attends des potes... (2 min)</div>
                            ) : (
                              <div className="text-purple-600 font-black animate-pulse text-lg md:text-xl">L'hôte configure la partie...</div>
                            )}
                      </div>
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-6">
                      {currentRoom.players.map((p) => (
                        <PlayerBadge key={p.uid} {...p} isMe={p.uid === myId} color={p.avatarColor || 'bg-purple-400'} avatarImage={p.avatarImage} canKick={me?.isHost} onKick={() => {}} />
                      ))}
                      {[...Array(Math.max(0, 8 - currentRoom.players.length))].map((_, i) => <div key={i} className="border-4 border-dashed border-black/20 rounded-2xl aspect-square flex items-center justify-center"><div className="w-12 h-12 rounded-full bg-black/10"></div></div>)}
                  </div>
              </div>
          </div>
        )}

        {/* --- VIEW: WAITING --- */}
        {/* MODIFICATION : Ajout de !me?.isSpectator */}
        {me?.isReady && !me?.isSpectator && !['LOBBY','RESULTS', 'VOTE', 'PODIUM'].includes(currentRoom.phase) && (
            <div className="min-h-screen bg-pattern flex flex-col items-center justify-center p-4 text-center space-y-8">
                <GlobalStyles />
                <FunCard className="animate-float flex flex-col items-center p-8 md:p-12">
                    <Loader2 size={48} className="animate-spin text-purple-600 mb-6" />
                    <h2 className="text-2xl md:text-4xl font-black uppercase mb-2">Terminé !</h2>
                    <p className="text-gray-500 font-bold text-lg md:text-xl">On attend les escargots...</p>
                </FunCard>
            </div>
        )}

        {/* MODIFICATION : Ajout de !me?.isSpectator */}
        {!me?.isReady && !me?.isSpectator && (
            <>
                {currentRoom.phase === 'EXQUISITE_DRAW' && (
                    <div className="min-h-screen bg-purple-600 flex flex-col font-sans">
                        <GlobalStyles />
                        <div className="bg-white border-b-4 border-black p-3 md:p-4 shadow-md z-10 flex justify-between items-center">
                            <div className="flex items-center gap-2 md:gap-4">
                                <div className="bg-black text-white px-2 py-1 md:px-3 rounded font-black uppercase text-xs md:text-sm flex items-center gap-2"><Ghost size={14}/> Exquis</div>
                                <h2 className="text-lg md:text-2xl font-black text-purple-600">{currentRoom.round === 0 ? "TÊTE" : currentRoom.round === 1 ? "CORPS" : "JAMBES"}</h2>
                            </div>
                            <FunButton onClick={() => submitContent()} disabled={!inputContent} color="green" className="px-3 py-1 text-xs">Fini !</FunButton>
                        </div>
                        <div className="flex-1 overflow-y-auto bg-pattern p-2 md:p-8 flex items-start md:items-center justify-center">
                             <DrawingCanvas onSave={(data) => setInputContent(data)} guideImage={getPreviousContent()?.content} />
                        </div>
                    </div>
                )}

                {currentRoom.phase === 'WRITE_START' && (
                    <div className="min-h-screen bg-yellow-400 flex items-center justify-center p-4 font-sans bg-pattern">
                        <GlobalStyles />
                        <FunCard title="Round 1" className="w-full max-w-3xl text-center space-y-6 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
                            <div className="space-y-2"><h2 className="text-2xl md:text-4xl font-black text-black uppercase">Invente une situation !</h2></div>
                            <textarea value={inputContent} onChange={(e) => setInputContent(e.target.value)} className="w-full h-32 md:h-40 p-4 text-xl font-black border-4 border-black rounded-2xl focus:outline-none resize-none bg-gray-50" placeholder="Un pingouin qui mange une raclette..." maxLength={80}/>
                            <FunButton onClick={() => submitContent()} disabled={!inputContent.trim()} color="purple" className="w-full" icon={CheckCircle}>Valider</FunButton>
                        </FunCard>
                    </div>
                )}

                {currentRoom.phase === 'DRAW' && (
                    <div className="h-screen w-full bg-blue-500 flex flex-col font-sans overflow-hidden fixed inset-0">
                        <GlobalStyles />
                        {/* HEADER FIXE */}
                        <div className="bg-white border-b-4 border-black p-2 md:p-3 shadow-md z-50 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-2 md:gap-4 min-w-0">
                                <div className="bg-black text-white px-2 py-1 md:px-3 rounded font-black uppercase text-xs md:text-sm shrink-0">
                                    {currentRoom.mode === 'PIXEL' ? 'PIXELISE ÇA' : 'DESSINE ÇA'}
                                </div>
                                <h2 className="text-base md:text-2xl font-black truncate text-purple-600">
                                    "{getPreviousContent()?.content}"
                                </h2>
                            </div>
                            {currentRoom.mode !== 'TRADITIONAL' && currentRoom.mode !== 'PIXEL' && (
                                <FunButton onClick={() => submitContent()} disabled={!inputContent} color="green" className="px-2 py-1 md:px-4 md:py-2 text-xs md:text-sm shrink-0">
                                    {inputContent ? 'Fini !' : 'Fin'}
                                </FunButton>
                            )}
                        </div>

                        {/* ZONE CENTRALE (FLEX-1 pour prendre toute la place restante) */}
                        <div className="flex-1 bg-pattern p-2 flex flex-col items-center justify-center min-h-0 w-full">
                                {currentRoom.mode === 'PIXEL' ? (
                                    <PixelArtEditor onSave={(data) => submitContent(data)} />
                                ) : currentRoom.mode === 'TRADITIONAL' ? (
                                    <CameraCapture onCapture={submitContent} />
                                ) : (
                                    <DrawingCanvas onSave={(data: string) => setInputContent(data)} />
                                )}
                        </div>
                    </div>
                )}

                {currentRoom.phase === 'GUESS' && (
                    <div className="min-h-screen bg-purple-600 flex items-center justify-center p-4 font-sans bg-pattern">
                        <GlobalStyles />
                        <FunCard className="w-full max-w-5xl flex flex-col md:flex-row overflow-hidden p-0 border-0">
                            <div className="w-full md:w-2/3 bg-gray-100 border-b-4 md:border-b-0 md:border-r-4 border-black flex flex-col relative">
                                <div className="flex-1 flex items-center justify-center bg-white p-4"><img src={getPreviousContent()?.content} alt="Guess" className={`max-w-full max-h-[50vh] object-contain ${currentRoom.mode==='PIXEL'?'image-pixelated':''}`} /></div>
                            </div>
                            <div className="w-full md:w-1/3 p-6 md:p-8 flex flex-col justify-center space-y-6 bg-white">
                                <div className="text-center space-y-2"><h2 className="text-2xl md:text-3xl font-black uppercase leading-none">C'est quoi ?</h2></div>
                                <textarea value={inputContent} onChange={(e) => setInputContent(e.target.value)} className="w-full h-24 p-4 text-lg font-bold border-4 border-black rounded-xl focus:outline-none bg-blue-50 resize-none" placeholder="Je pense que c'est..."/>
                                <FunButton onClick={() => submitContent()} disabled={!inputContent.trim()} color="purple" icon={CheckCircle}>Valider</FunButton>
                            </div>
                        </FunCard>
                    </div>
                )}
            </>
        )}

        {/* --- VIEW: VOTE --- */}
        {currentRoom.phase === 'VOTE' && (
             <div className="min-h-screen bg-purple-900 p-4 overflow-y-auto font-sans">
                <GlobalStyles />
                <div className="max-w-7xl mx-auto">
                     <div className="text-center mb-8 md:mb-12 pt-8 space-y-4"><h2 className="text-3xl md:text-5xl font-black text-yellow-400 uppercase">Le Musée</h2><p className="text-white font-bold bg-black/50 inline-block px-4 py-1 rounded-full">Vote pour ta création préférée !</p></div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8 pb-20">
                        {/* LOGIQUE DE VOTE POUR TOUS LES MODES */}
                        {currentRoom.mode !== 'EXQUISITE' ? (
                            Object.entries(currentRoom.chains).flatMap(([oid, chain]) => chain.steps.map((s,i) => ({oid, i, s})).filter(x => x.s.type === 'DRAWING')).map((item, i) => {
                                const isMine = item.s.authorId === myId;
                                return (
                                    <button key={i} onClick={() => !isMine && !me?.hasVoted && (playPop(), castVote(item.oid, item.i))} disabled={isMine || me?.hasVoted} className={`group relative bg-white p-2 pb-8 border-4 border-black shadow-hard transition-all transform hover:scale-105 ${isMine?'opacity-60 cursor-not-allowed grayscale':''} ${me?.hasVoted?'opacity-50':''}`}>
                                        <div className="aspect-[4/3] bg-gray-50 border-2 border-gray-200 overflow-hidden mb-2"><img src={item.s.content} className={`w-full h-full object-cover ${currentRoom.mode==='PIXEL'?'image-pixelated':''}`}/></div>
                                        {isMine && <div className="absolute inset-0 flex items-center justify-center bg-black/10 font-black text-red-600 text-xl uppercase -rotate-12 border-4 border-red-600 m-8 rounded-xl bg-white/80">C'est toi !</div>}
                                    </button>
                                )
                            })
                        ) : (
                            Object.entries(currentRoom.chains).map(([oid, chain], i) => {
                                const isMine = chain.ownerId === myId;
                                return (
                                     <button key={i} onClick={() => !isMine && !me?.hasVoted && (playPop(), castVote(oid, 0))} disabled={isMine || me?.hasVoted} className="bg-white p-2 border-4 border-black shadow-hard hover:scale-105 transition-transform">
                                        {chain.steps.map((s, idx) => <img key={idx} src={s.content} className="w-full"/>)}
                                     </button>
                                )
                            })
                        )}
                     </div>
                </div>
             </div>
        )}

        {/* --- VIEW: PODIUM --- */}
        {currentRoom.phase === 'PODIUM' && <PodiumView room={currentRoom} onResults={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'gartic_rooms', roomCode), { phase: 'RESULTS' })} />}
        
        {/* --- VIEW: RESULTS --- */}
        {currentRoom.phase === 'RESULTS' && (
            <ResultsView 
                room={currentRoom} 
                onRestart={returnToLobby} 
                currentUserId={myId || ''} 
                isHost={me?.isHost} 
            />
        )}
      </>
  );
}

// ==========================================
// 10. SOUS-VUES (PODIUM & RESULTATS)
// ==========================================

function PodiumView({ room, onResults }: { room: RoomData, onResults: () => void }) {
    const scores: Record<string, number> = {};
    if (room.players) room.players.forEach(p => scores[p.uid] = 0);
    if (room.chains) { Object.values(room.chains).forEach(chain => { if (chain?.steps) { chain.steps.forEach(step => { if (step && (step.votes || 0) > 0) { if (step.authorId) scores[step.authorId] = (scores[step.authorId] || 0) + (step.votes || 0); } }); } }); }
    const sortedPlayers = [...(room.players || [])].sort((a, b) => (scores[b.uid] || 0) - (scores[a.uid] || 0));
    const top3 = sortedPlayers.slice(0, 3);

    return (
        <div className="min-h-screen bg-purple-900 flex flex-col items-center justify-center p-4 overflow-hidden relative font-sans bg-pattern">
            <GlobalStyles />
            <div className="z-10 text-center mb-8 md:mb-12 mt-8"><h1 className="text-5xl md:text-8xl font-black text-yellow-400 uppercase tracking-tighter drop-shadow-[8px_8px_0_rgba(0,0,0,1)] stroke-black mb-4 animate-wobble" style={{WebkitTextStroke: '2px black'}}>PODIUM</h1></div>
            <div className="flex items-end justify-center gap-2 md:gap-8 mb-12 z-10 w-full max-w-5xl px-2 h-[300px] md:h-[450px]">
                {top3[1] ? ( <div className="flex flex-col items-center w-1/3 animate-pop" style={{animationDelay: '0.5s'}}><div className="mb-2 md:mb-4 flex flex-col items-center"><div className="w-12 h-12 md:w-24 md:h-24 rounded-full border-4 border-black bg-gray-300 flex items-center justify-center text-xl md:text-4xl font-black text-black shadow-hard mb-2 overflow-hidden"><img src={top3[1].avatarImage} className="w-full h-full object-cover"/></div><span className="font-bold text-white bg-black px-2 py-1 rounded-full text-[10px] md:text-sm mb-1 truncate max-w-[80px] md:max-w-[100px] text-center">{top3[1].name}</span><span className="font-black text-gray-300 text-sm md:text-2xl">{scores[top3[1].uid]} pts</span></div><div className="w-full h-24 md:h-48 bg-gray-300 border-4 border-black rounded-t-2xl shadow-hard flex items-center justify-center relative"><span className="text-4xl md:text-6xl font-black text-black/20">2</span></div></div> ) : <div className="w-1/3"></div>}
                {top3[0] ? ( <div className="flex flex-col items-center w-1/3 -mt-4 md:-mt-12 animate-pop" style={{animationDelay: '1s'}}><Crown size={32} className="text-yellow-400 fill-yellow-400 mb-2 md:mb-4 drop-shadow-[4px_4px_0_rgba(0,0,0,1)] animate-bounce md:w-12 md:h-12"/><div className="mb-2 md:mb-4 flex flex-col items-center relative"><div className="w-16 h-16 md:w-32 md:h-32 rounded-full border-4 border-black bg-yellow-400 flex items-center justify-center text-3xl md:text-6xl font-black text-black shadow-hard mb-2 z-10 overflow-hidden"><img src={top3[0].avatarImage} className="w-full h-full object-cover"/></div><span className="font-bold text-white bg-black px-3 py-1 rounded-full text-xs md:text-lg mb-1 truncate max-w-[100px] md:max-w-[120px] text-center">{top3[0].name}</span><span className="font-black text-yellow-400 text-lg md:text-4xl drop-shadow-md">{scores[top3[0].uid]} pts</span></div><div className="w-full h-40 md:h-80 bg-yellow-400 border-4 border-black rounded-t-2xl shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center relative overflow-hidden"><div className="absolute inset-0 bg-white/20 transform rotate-45 translate-y-1/2"></div><span className="text-6xl md:text-8xl font-black text-black/20">1</span></div></div> ) : null}
                {top3[2] ? ( <div className="flex flex-col items-center w-1/3 animate-pop" style={{animationDelay: '0.7s'}}><div className="mb-2 md:mb-4 flex flex-col items-center"><div className="w-12 h-12 md:w-24 md:h-24 rounded-full border-4 border-black bg-orange-400 flex items-center justify-center text-xl md:text-4xl font-black text-black shadow-hard mb-2 overflow-hidden"><img src={top3[2].avatarImage} className="w-full h-full object-cover"/></div><span className="font-bold text-white bg-black px-2 py-1 rounded-full text-[10px] md:text-sm mb-1 truncate max-w-[80px] md:max-w-[100px] text-center">{top3[2].name}</span><span className="font-black text-orange-400 text-sm md:text-2xl">{scores[top3[2].uid]} pts</span></div><div className="w-full h-16 md:h-32 bg-orange-400 border-4 border-black rounded-t-2xl shadow-hard flex items-center justify-center relative"><span className="text-3xl md:text-5xl font-black text-black/20">3</span></div></div> ) : <div className="w-1/3"></div>}
            </div>
            <FunButton onClick={onResults} color="white" className="z-20 text-lg md:text-xl px-8 py-4 animate-pulse mb-8">Voir le carnage <ArrowRight size={24}/></FunButton>
        </div>
    );
}

function ResultsView({ room, onRestart, currentUserId, isHost }: { room: RoomData, onRestart: () => void, currentUserId: string, isHost?: boolean }) {
    const [viewingChainOwner, setViewingChainOwner] = useState<string>(room.players[0].uid);
    const currentChain = room.chains[viewingChainOwner];
    const owner = room.players.find(p => p.uid === viewingChainOwner);

    return (
        <div className="min-h-screen bg-purple-100 font-sans flex flex-col">
            <GlobalStyles />
            <div className="bg-white border-b-4 border-black p-3 md:p-4 shadow-md sticky top-0 z-50 flex flex-col md:flex-row items-center justify-between gap-4">
                 <div className="flex items-center gap-2"><div className="bg-black p-2 rounded-lg"><ImageIcon className="text-white" size={20}/></div><h1 className="text-xl md:text-2xl font-black uppercase">Album</h1></div>
                 <div className="flex gap-2 overflow-x-auto max-w-full pb-2 md:pb-0 scrollbar-hide w-full md:w-auto">
                    {room.players.map(p => <button key={p.uid} onClick={() => setViewingChainOwner(p.uid)} className={`px-3 py-2 md:px-4 rounded-xl font-bold border-2 border-black whitespace-nowrap transition-all shadow-hard-sm text-sm md:text-base ${viewingChainOwner === p.uid ? 'bg-yellow-400 -translate-y-1 shadow-hard' : 'bg-white hover:bg-gray-100'}`}>{p.name}</button>)}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-12 bg-pattern">
                <div className="max-w-2xl mx-auto space-y-8 md:space-y-12 relative">
                    <div className="text-center mb-8 md:mb-12 relative"><div className="bg-white border-4 border-black p-4 md:p-6 inline-block transform -rotate-2 shadow-hard-lg rounded-sm"><h2 className="text-xl md:text-2xl font-black uppercase text-gray-400">Album de</h2><h3 className="text-3xl md:text-5xl font-black text-purple-600 uppercase">{owner?.name}</h3></div></div>
                    
                    {room.mode === 'EXQUISITE' ? (
                        <div className="flex flex-col items-center">
                            <div className="bg-white border-4 border-black p-2 shadow-hard-lg w-full max-w-[400px] relative">
                                <div className="absolute -top-3 -right-3 bg-yellow-400 border-4 border-black p-1 md:p-2 rounded-full font-black transform rotate-12 text-[10px] md:text-xs">CADAVRE EXQUIS</div>
                                {currentChain?.steps.map((step, idx) => (
                                    <img key={idx} src={step.content} className="w-full border-b-2 border-black border-dashed last:border-0" style={{display: 'block'}} />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="absolute left-4 md:left-8 top-32 bottom-0 w-1 md:w-2 bg-black ml-[15px] md:ml-[27px] z-0 hidden md:block border-l-2 border-r-2 border-black bg-stripes-white"></div>
                            {currentChain?.steps.map((step, idx) => (
                                <div key={idx} className="relative z-10 flex gap-4 md:gap-6 group">
                                    <div className="hidden md:flex flex-col items-center"><div className="w-12 h-12 md:w-16 md:h-16 rounded-full border-4 border-black bg-white flex items-center justify-center text-xl md:text-2xl font-black shadow-hard z-10 relative">{idx + 1}</div></div>
                                    <div className="flex-1">
                                        <div className={`bg-white border-4 border-black p-1 shadow-hard transition-transform hover:-translate-y-1 hover:shadow-hard-lg ${idx % 2 === 0 ? 'rotate-1' : '-rotate-1'}`}>
                                            <div className="bg-gray-100 border-b-4 border-black p-2 md:p-3 flex justify-between items-center">
                                                <span className="font-black text-sm md:text-lg uppercase truncate">{step.authorName}</span>
                                                <div className="flex items-center gap-2">
                                                    {step.votes > 0 && <div className="bg-yellow-400 border-2 border-black px-2 rounded-full flex items-center gap-1 font-bold text-[10px] md:text-xs shadow-sm"><Star size={10} fill="black"/> {step.votes}</div>}
                                                </div>
                                            </div>
                                            <div className="p-4 md:p-6 min-h-[120px] md:min-h-[150px] flex items-center justify-center bg-white">
                                                {step.type === 'TEXT' ? 
                                                    <p className="text-2xl md:text-4xl font-black text-center uppercase leading-tight text-gray-800" style={{fontFamily: 'cursive'}}>"{step.content}"</p> 
                                                    : 
                                                    <img 
                                                        src={step.content} 
                                                        alt="Drawing" 
                                                        className="max-w-full border-2 border-gray-200 shadow-inner" 
                                                        style={room.mode === 'PIXEL' ? { imageRendering: 'pixelated' } : {}}
                                                    />
                                                }
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>
            <div className="p-4 md:p-6 bg-white border-t-4 border-black flex justify-center shadow-[0_-4px_10px_rgba(0,0,0,0.1)]">
                {isHost ? (
                    <FunButton onClick={onRestart} color="purple" icon={Zap}>Retour au Salon</FunButton>
                ) : (
                    <div className="text-gray-500 font-bold animate-pulse flex items-center gap-2">
                        <Loader2 className="animate-spin"/>
                        L'hôte va relancer la partie...
                    </div>
                )}
            </div>
        </div>
    );
}