import { useState, useEffect, useRef } from 'react';
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
  XCircle
} from 'lucide-react';

// --- CONFIGURATION FIREBASE ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialisation
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// On change l'ID pour repartir sur une base propre sans Storage
const appId = 'gartic-party-no-storage-v1'; 

// --- STYLES & ANIMATIONS ---
const GlobalStyles = () => (
  <style>{`
    @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
    @keyframes wobble { 0%, 100% { transform: rotate(-2deg); } 50% { transform: rotate(2deg); } }
    @keyframes popIn { 0% { transform: scale(0); opacity: 0; } 80% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
    .animate-float { animation: float 3s ease-in-out infinite; }
    .animate-wobble { animation: wobble 2s ease-in-out infinite; }
    .animate-pop { animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
    .bg-pattern { background-color: #7c3aed; background-image: radial-gradient(#a78bfa 2px, transparent 2px); background-size: 30px 30px; }
    .shadow-hard { box-shadow: 4px 4px 0px 0px rgba(0,0,0,1); }
    .shadow-hard-lg { box-shadow: 8px 8px 0px 0px rgba(0,0,0,1); }
    .shadow-hard-sm { box-shadow: 2px 2px 0px 0px rgba(0,0,0,1); }
  `}</style>
);

// --- TYPES ---
type GameMode = 'CLASSIC' | 'EXQUISITE';
type Phase = 'LOBBY' | 'WRITE_START' | 'DRAW' | 'GUESS' | 'VOTE' | 'PODIUM' | 'RESULTS' | 'EXQUISITE_DRAW';

interface Player {
  uid: string; 
  name: string;
  isHost: boolean;
  isReady: boolean;
  hasVoted: boolean;
  score: number;
  avatarColor: string; 
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
}

// --- CONSTANTES ---
const AVATAR_COLORS = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-400', 'bg-blue-400', 'bg-purple-400', 'bg-pink-400', 'bg-teal-400'];
const DRAW_COLORS = ['#000000', '#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#78350f'];
const BRUSH_SIZES = [4, 8, 16, 32];

// --- COMPOSANTS UI ---

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
        relative group px-6 py-3 rounded-xl font-black text-lg uppercase tracking-wider transition-all
        border-2 border-b-[6px] active:border-b-2 active:translate-y-[4px]
        disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:border-b-[6px]
        flex items-center justify-center gap-2
        ${colorClasses[color]} ${className}
      `}
    >
      {Icon && <Icon size={24} strokeWidth={3} />}
      {children}
    </button>
  );
};

const FunCard = ({ children, className = '', title }: any) => (
  <div className={`bg-white border-4 border-black rounded-3xl shadow-hard-lg p-6 ${className}`}>
    {title && (
      <div className="bg-black text-white inline-block px-4 py-1 rounded-full font-bold uppercase tracking-widest mb-4 transform -rotate-2 border-2 border-white shadow-sm">
        {title}
      </div>
    )}
    {children}
  </div>
);

// BADGE JOUEUR AVEC BOUTON KICK
const PlayerBadge = ({ name, isHost, isReady, isMe, hasVoted, uid, color = 'bg-gray-400', onKick, canKick }: any) => (
  <div className={`
    relative flex flex-col items-center p-3 rounded-2xl border-4 border-black bg-white transition-all group
    ${isReady ? 'shadow-hard bg-green-50 -translate-y-1' : 'shadow-sm opacity-90'}
    ${hasVoted ? 'ring-4 ring-yellow-400' : ''}
  `}>
    {isHost && <Crown size={24} className="absolute -top-4 -right-4 text-yellow-500 fill-yellow-400 rotate-12 drop-shadow-md animate-bounce" />}
    
    {/* BOUTON KICK : Visible seulement si on peut kicker et que ce n'est pas nous-même */}
    {canKick && !isMe && (
      <button 
        onClick={() => onKick(uid, name)}
        className="absolute -top-2 -left-2 bg-red-500 text-white p-1 rounded-full border-2 border-black hover:scale-110 transition-transform z-10 shadow-sm opacity-0 group-hover:opacity-100"
        title="Éjecter le joueur"
      >
        <XCircle size={16} strokeWidth={3} />
      </button>
    )}

    <div className={`w-16 h-16 rounded-full border-4 border-black flex items-center justify-center text-2xl font-black text-white mb-2 ${color} shadow-inner`}>
      {name.charAt(0).toUpperCase()}
    </div>
    <div className="text-center w-full">
      <div className="font-bold text-black truncate w-full text-sm md:text-base leading-tight">{name}</div>
      {isMe && <div className="text-[10px] font-black text-purple-600 uppercase tracking-wider">(Moi)</div>}
    </div>
    {isReady && (
      <div className="absolute -bottom-3 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full border-2 border-black flex items-center gap-1">
        <CheckCircle size={12} /> PRÊT
      </div>
    )}
     {hasVoted && (
      <div className="absolute -bottom-3 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full border-2 border-black flex items-center gap-1">
        <Star size={12} fill="black"/> A VOTÉ
      </div>
    )}
  </div>
);

// --- COMPOSANT DESSIN ---
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
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEraser, setIsEraser] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (initialImage) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = initialImage;
    }
  }, [initialImage]);

  const saveState = () => {
    const canvas = canvasRef.current;
    // Qualité réduite à 0.4 pour économiser de la place en BDD
    if(canvas) setHistory(prev => [...prev.slice(-10), canvas.toDataURL('image/jpeg', 0.4)]);
  }

  const getCoordinates = (event: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    let clientX = 0, clientY = 0;
    if ('touches' in event) {
       clientX = event.touches[0].clientX;
       clientY = event.touches[0].clientY;
    } else {
       clientX = (event as React.MouseEvent).clientX;
       clientY = (event as React.MouseEvent).clientY;
    }
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const startDrawing = (e: any) => {
    if (isReadOnly) return;
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    saveState();
    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = isEraser ? '#ffffff' : color;
    ctx.lineWidth = brushSize;
  };

  const draw = (e: any) => {
    if (!isDrawing || isReadOnly) return;
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isReadOnly) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    // ⚠️ COMPRESSION FORTE (0.35) POUR EVITER DE PAYER STORAGE
    if (canvas) onSave(canvas.toDataURL('image/jpeg', 0.35));
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      saveState();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      onSave(canvas.toDataURL('image/jpeg', 0.35));
    }
  };

  const undo = () => {
    if (history.length === 0) return;
    const lastState = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx && lastState) {
      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        onSave(canvas.toDataURL('image/jpeg', 0.35));
      };
      img.src = lastState;
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 items-start w-full max-w-5xl mx-auto">
        <div className="relative flex-1 w-full aspect-[4/3] bg-white rounded-xl border-4 border-black shadow-hard-lg overflow-hidden touch-none group">
            
            {/* GUIDE POUR CADAVRE EXQUIS */}
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
                width={600} // Réduit de 800 à 600 pour économiser des octets
                height={450}
                className={`w-full h-full ${isReadOnly ? 'cursor-default' : 'cursor-crosshair'}`}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
            />
            {!isReadOnly && (
                <div className="absolute top-4 left-4 flex gap-2 z-20">
                    <button onClick={undo} disabled={history.length === 0} className="bg-white border-2 border-black p-2 rounded-lg hover:bg-gray-100 shadow-hard-sm disabled:opacity-50"><Undo size={20}/></button>
                    <button onClick={clearCanvas} className="bg-red-100 border-2 border-black p-2 rounded-lg hover:bg-red-200 shadow-hard-sm text-red-600"><Trash2 size={20}/></button>
                </div>
            )}
        </div>

        {!isReadOnly && (
            <div className="bg-white border-4 border-black rounded-2xl p-4 shadow-hard flex flex-row md:flex-col gap-4 w-full md:w-auto items-center justify-center">
                <div className="flex md:flex-col gap-2">
                    <button onClick={() => setIsEraser(false)} className={`p-3 rounded-xl border-2 border-black transition-transform ${!isEraser ? 'bg-purple-500 text-white -translate-y-1 shadow-hard-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}><Pencil size={24} /></button>
                    <button onClick={() => setIsEraser(true)} className={`p-3 rounded-xl border-2 border-black transition-transform ${isEraser ? 'bg-purple-500 text-white -translate-y-1 shadow-hard-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}><Eraser size={24} /></button>
                </div>
                <div className="h-px w-full bg-gray-300 hidden md:block"></div>
                <div className="flex md:flex-col gap-2 items-center">
                    {BRUSH_SIZES.map(size => (
                        <button key={size} onClick={() => setBrushSize(size)} className={`rounded-full bg-black transition-all ${brushSize === size ? 'ring-4 ring-yellow-400 scale-110' : 'opacity-30 hover:opacity-60'}`} style={{ width: size + 8, height: size + 8 }} />
                    ))}
                </div>
                <div className="h-px w-full bg-gray-300 hidden md:block"></div>
                <div className="grid grid-cols-5 md:grid-cols-2 gap-2">
                    {DRAW_COLORS.map((c) => (
                        <button key={c} onClick={() => { setColor(c); setIsEraser(false); }} className={`w-8 h-8 rounded-full border-2 border-black transition-transform hover:scale-110 shadow-sm ${color === c && !isEraser ? 'ring-4 ring-yellow-400 scale-110 z-10' : ''}`} style={{ backgroundColor: c }} />
                    ))}
                </div>
            </div>
        )}
    </div>
  );
};

// --- MAIN APP ---

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState(''); 
  const [joinCode, setJoinCode] = useState(''); 
  const [currentRoom, setCurrentRoom] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(false);
  const [inputContent, setInputContent] = useState(''); 
  const [isReady, setIsReady] = useState(false);
  const [selectedMode, setSelectedMode] = useState<GameMode>('CLASSIC');

  const [tabId] = useState(() => {
      const existing = sessionStorage.getItem('gartic_tab_id');
      if (existing) return existing;
      const newId = Math.random().toString(36).substring(2, 10);
      sessionStorage.setItem('gartic_tab_id', newId);
      return newId;
  });
  const myId = user ? `${user.uid}_${tabId}` : null;

  // AUTHENTIFICATION
  useEffect(() => {
    signInAnonymously(auth).catch((err) => {
        console.error("Erreur Auth:", err);
        alert("Erreur de connexion Firebase.");
    });

    const unsubscribe = onAuthStateChanged(auth, (u) => {
        setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // ROOM LISTENER
  useEffect(() => {
    if (!user || !roomCode) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'gartic_rooms', roomCode);
    return onSnapshot(roomRef, (snap) => {
      if (snap.exists()) {
          const data = snap.data() as RoomData;
          
          // Check KICK
          const amIStillIn = data.players.some(p => p.uid === myId);
          if (!amIStillIn && data.phase !== 'RESULTS') {
            alert("Tu as été éjecté de la partie !");
            setCurrentRoom(null);
            setRoomCode('');
            return;
          }

          setCurrentRoom(data);
          if (data.mode) setSelectedMode(data.mode);
      }
      else setCurrentRoom(null); 
    });
  }, [user, roomCode, myId]);

  const createRoom = async () => {
    if (!playerName.trim() || !user || !myId) return;
    setLoading(true);
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'gartic_rooms', code);
    const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const newPlayer: Player = {
      uid: myId, 
      name: playerName,
      isHost: true,
      isReady: false,
      hasVoted: false,
      score: 0,
      avatarColor: randomColor
    };

    const newRoom: RoomData = {
      code,
      mode: 'CLASSIC', 
      players: [newPlayer],
      phase: 'LOBBY',
      round: 0,
      chains: {},
      maxRounds: 3,
      createdAt: Date.now()
    };

    await setDoc(roomRef, newRoom);
    setRoomCode(code);
    setLoading(false);
  };

  const joinRoom = async () => {
    if (!playerName.trim() || !joinCode.trim() || !user || !myId) return;
    setLoading(true);
    const code = joinCode.toUpperCase();
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'gartic_rooms', code);
    try {
        const snap = await getDoc(roomRef);
        if (snap.exists()) {
            const data = snap.data() as RoomData;
            
            if (data.phase !== 'LOBBY') {
                alert("Trop tard, la partie a commencé !");
                setLoading(false);
                return;
            }
            
            let updatedPlayers = [...data.players];
            const existingIndex = updatedPlayers.findIndex(p => p.uid === myId);
            const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
            
            if (existingIndex >= 0) {
                updatedPlayers[existingIndex] = { 
                    ...updatedPlayers[existingIndex], 
                    name: playerName, 
                    isReady: false, 
                    hasVoted: false 
                };
            } else {
                updatedPlayers.push({ 
                    uid: myId, 
                    name: playerName, 
                    isHost: false, 
                    isReady: false, 
                    hasVoted: false, 
                    score: 0, 
                    avatarColor: randomColor 
                });
            }
            
            await updateDoc(roomRef, { players: updatedPlayers });
            setRoomCode(code); 
        } else {
            alert("Code invalide !");
        }
    } catch (error) {
        console.error("Erreur JOIN:", error);
        alert("Oups, impossible de rejoindre.");
    }
    setLoading(false);
  };

  // FONCTION KICK
  const kickPlayer = async (targetUid: string, targetName: string) => {
    if (!currentRoom || !myId) return;
    if (!confirm(`Voulez-vous vraiment éjecter ${targetName} ?`)) return;

    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'gartic_rooms', roomCode);
    const updatedPlayers = currentRoom.players.filter(p => p.uid !== targetUid);
    
    const updatedChains = { ...currentRoom.chains };
    delete updatedChains[targetUid];

    await updateDoc(roomRef, { 
        players: updatedPlayers,
        chains: updatedChains
    });
  };

  const updateMode = async (mode: GameMode) => {
      if (!currentRoom || !myId) return;
      setSelectedMode(mode);
      const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'gartic_rooms', roomCode);
      await updateDoc(roomRef, { mode: mode });
  }

  const startGame = async () => {
    if (!currentRoom || !user) return;
    const initialChains: Record<string, GameChain> = {};
    currentRoom.players.forEach(p => {
      initialChains[p.uid] = { ownerId: p.uid, steps: [] };
    });
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'gartic_rooms', roomCode);
    const resetPlayers = currentRoom.players.map(p => ({...p, score: 0, hasVoted: false, isReady: false}));
    
    if (currentRoom.mode === 'EXQUISITE') {
        await updateDoc(roomRef, { 
            phase: 'EXQUISITE_DRAW', 
            chains: initialChains,
            players: resetPlayers,
            maxRounds: 3, 
            round: 0
        });
    } else {
        await updateDoc(roomRef, { 
            phase: 'WRITE_START', 
            chains: initialChains,
            players: resetPlayers,
            maxRounds: currentRoom.players.length,
            round: 0
        });
    }
  };

  const submitContent = async () => {
    if (!currentRoom || !myId) return;
    setIsReady(true);
    const myIndex = currentRoom.players.findIndex(p => p.uid === myId);
    const totalPlayers = currentRoom.players.length;
    
    const ownerIndex = (myIndex - currentRoom.round + (totalPlayers * 10)) % totalPlayers;
    const ownerId = currentRoom.players[ownerIndex].uid;

    let stepType: 'TEXT' | 'DRAWING' = 'DRAWING';
    if (currentRoom.mode === 'CLASSIC') {
        stepType = currentRoom.round % 2 === 0 ? 'TEXT' : 'DRAWING';
    } 

    // VÉRIFICATION DE SÉCURITÉ POUR EVITER LE CRASH FIREBASE (1MB Limit)
    if (stepType === 'DRAWING' && inputContent.length > 900000) {
        alert("Ton dessin est trop complexe pour la version gratuite ! Essaie de faire moins de traits.");
        setIsReady(false);
        return;
    }

    const step: GameStep = {
      type: stepType,
      authorId: myId,
      authorName: currentRoom.players.find(p => p.uid === myId)?.name || 'Inconnu',
      content: inputContent,
      votes: 0
    };

    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'gartic_rooms', roomCode);
    
    try {
        await updateDoc(roomRef, {
           [`chains.${ownerId}.steps`]: arrayUnion(step),
           players: currentRoom.players.map(p => p.uid === myId ? { ...p, isReady: true } : p)
        });
    } catch (err) {
        console.error(err);
        alert("Erreur de sauvegarde : Le dessin est peut-être trop gros !");
        setIsReady(false);
    }

    setInputContent('');
  };

  const castVote = async (targetChainOwnerId: string, stepIndex: number) => {
    if (!currentRoom || !myId) return;
    const chain = currentRoom.chains[targetChainOwnerId];
    if (!chain) return;
    const updatedSteps = [...chain.steps];
    if (updatedSteps[stepIndex]) updatedSteps[stepIndex].votes = (updatedSteps[stepIndex].votes || 0) + 1;
    
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'gartic_rooms', roomCode);
    await updateDoc(roomRef, {
        [`chains.${targetChainOwnerId}.steps`]: updatedSteps,
        players: currentRoom.players.map(p => p.uid === myId ? { ...p, hasVoted: true } : p)
    });
  };

  useEffect(() => {
    if (!currentRoom || !myId) return;
    const me = currentRoom.players.find(p => p.uid === myId);
    if (!me?.isHost) return; 

    const allReady = currentRoom.players.every(p => p.isReady);
    const allVoted = currentRoom.players.every(p => p.hasVoted);

    if (allReady && !['LOBBY', 'VOTE', 'PODIUM', 'RESULTS'].includes(currentRoom.phase)) {
        const maxR = currentRoom.maxRounds;
        
        if (currentRoom.round + 1 >= maxR) {
            const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'gartic_rooms', roomCode);
            updateDoc(roomRef, {
                phase: 'VOTE',
                players: currentRoom.players.map(p => ({...p, isReady: false, hasVoted: false}))
            });
        } else {
            let nextPhase: Phase = 'DRAW';
            
            if (currentRoom.mode === 'CLASSIC') {
                nextPhase = (currentRoom.round + 1) % 2 === 0 ? 'GUESS' : 'DRAW';
            } else {
                nextPhase = 'EXQUISITE_DRAW';
            }

            const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'gartic_rooms', roomCode);
            setTimeout(() => {
                updateDoc(roomRef, {
                    round: increment(1),
                    phase: nextPhase,
                    players: currentRoom.players.map(p => ({...p, isReady: false}))
                });
            }, 1000);
        }
    }

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

  if (!user) return <div className="h-screen flex items-center justify-center bg-pattern"><Loader2 className="animate-spin text-white" size={48}/></div>;

  if (!currentRoom) {
    return (
        <div className="min-h-screen bg-pattern flex items-center justify-center p-4 font-sans">
            <GlobalStyles />
            <FunCard className="w-full max-w-md text-center border-black border-4 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] transform rotate-1 hover:rotate-0 transition-transform duration-300">
                <div className="mb-8 relative">
                    <h1 className="text-6xl font-black text-yellow-400 tracking-tighter uppercase drop-shadow-[4px_4px_0_rgba(0,0,0,1)] stroke-black" style={{WebkitTextStroke: '2px black'}}>Gartic Clone</h1>
                    <div className="absolute -top-6 -right-6 animate-bounce"><Pencil size={48} className="text-purple-500 fill-purple-300 drop-shadow-md" /></div>
                </div>
                <div className="space-y-6">
                    <div className="text-left space-y-2">
                        <label className="block text-lg font-black text-black uppercase tracking-wide">Ton Pseudo</label>
                        <input type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value)} className="w-full px-4 py-3 rounded-xl border-4 border-black font-bold text-xl focus:outline-none focus:shadow-hard transition-all bg-gray-50 placeholder-gray-400" placeholder="SuperArtiste..."/>
                    </div>
                    <div className="flex flex-col gap-4 pt-2">
                        <FunButton onClick={createRoom} disabled={loading || !playerName} color="purple" icon={Palette}>Créer une Party</FunButton>
                        <div className="flex items-center gap-4"><div className="h-1 flex-1 bg-black rounded-full"></div><span className="font-black text-gray-400">OU</span><div className="h-1 flex-1 bg-black rounded-full"></div></div>
                        <div className="flex gap-2">
                            <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} className="flex-1 px-4 py-3 rounded-xl border-4 border-black font-mono text-center font-black text-xl uppercase tracking-widest focus:outline-none focus:shadow-hard" placeholder="CODE" maxLength={6}/>
                            <FunButton onClick={joinRoom} disabled={loading || !playerName || !joinCode} color="green">GO</FunButton>
                        </div>
                    </div>
                </div>
            </FunCard>
        </div>
    );
  }

  if (currentRoom.phase === 'LOBBY') {
      const me = currentRoom.players.find(p => p.uid === myId);
      return (
          <div className="min-h-screen bg-pattern p-6 font-sans">
              <GlobalStyles />
              <div className="max-w-5xl mx-auto space-y-8">
                  <div className="bg-white border-4 border-black rounded-3xl p-6 shadow-hard-lg flex flex-col gap-6">
                      <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-b-4 border-black pb-6">
                        <div className="text-center md:text-left">
                            <h2 className="text-3xl font-black uppercase tracking-tight mb-2">Salon d'attente</h2>
                            <div className="flex items-center gap-3 justify-center md:justify-start bg-gray-100 p-2 rounded-xl border-2 border-black">
                                <span className="text-gray-600 font-bold">CODE:</span>
                                <span className="font-mono font-black text-3xl text-purple-600 tracking-widest select-all">{currentRoom.code}</span>
                            </div>
                        </div>
                        
                        <div className="flex flex-col items-center gap-2">
                            <span className="font-black text-sm uppercase tracking-widest">Mode de Jeu</span>
                            <div className="flex gap-2 bg-gray-100 p-1 rounded-xl border-2 border-black">
                                <button 
                                    onClick={() => me?.isHost && updateMode('CLASSIC')}
                                    className={`px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 ${currentRoom.mode === 'CLASSIC' ? 'bg-white border-2 border-black shadow-hard-sm text-black' : 'text-gray-400'}`}
                                    disabled={!me?.isHost}
                                >
                                    <MessageSquare size={18}/> Classique
                                </button>
                                <button 
                                    onClick={() => me?.isHost && updateMode('EXQUISITE')}
                                    className={`px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 ${currentRoom.mode === 'EXQUISITE' ? 'bg-purple-500 border-2 border-black shadow-hard-sm text-white' : 'text-gray-400'}`}
                                    disabled={!me?.isHost}
                                >
                                    <Ghost size={18}/> Cadavre Exquis
                                </button>
                            </div>
                        </div>
                      </div>
                      
                      <div className="flex justify-center">
                           {me?.isHost && currentRoom.players.length > 1 ? (
                              <FunButton onClick={startGame} color="green" icon={Play} className="animate-pop w-full md:w-auto">Lancer la partie !</FunButton>
                           ) : me?.isHost ? (
                              <div className="px-4 py-2 bg-yellow-100 border-2 border-black rounded-lg font-bold text-yellow-800 text-center animate-pulse">Attends des potes... (2 min)</div>
                           ) : (
                              <div className="text-purple-600 font-black animate-pulse text-xl">L'hôte configure la partie...</div>
                           )}
                      </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                      {currentRoom.players.map((p) => (
                        <PlayerBadge 
                            key={p.uid} 
                            {...p} 
                            isMe={p.uid === myId} 
                            color={p.avatarColor || 'bg-purple-400'} 
                            canKick={me?.isHost}
                            onKick={kickPlayer}
                        />
                      ))}
                      {[...Array(Math.max(0, 8 - currentRoom.players.length))].map((_, i) => <div key={i} className="border-4 border-dashed border-black/20 rounded-2xl aspect-square flex items-center justify-center"><div className="w-12 h-12 rounded-full bg-black/10"></div></div>)}
                  </div>
              </div>
          </div>
      );
  }

  const me = currentRoom.players.find(p => p.uid === myId);
  if (me?.isReady && !['RESULTS', 'VOTE', 'PODIUM'].includes(currentRoom.phase)) {
      return (
          <div className="min-h-screen bg-pattern flex flex-col items-center justify-center p-4 text-center space-y-8">
              <GlobalStyles />
              <FunCard className="animate-float flex flex-col items-center p-12">
                  <Loader2 size={64} className="animate-spin text-purple-600 mb-6" />
                  <h2 className="text-4xl font-black uppercase mb-2">Terminé !</h2>
                  <p className="text-gray-500 font-bold text-xl">On attend les artistes...</p>
              </FunCard>
              <div className="flex gap-3 bg-black/20 p-4 rounded-2xl backdrop-blur-sm">
                  {currentRoom.players.map(p => <div key={p.uid} className={`w-4 h-4 rounded-full border-2 border-white transition-all duration-300 ${p.isReady ? 'bg-green-400 scale-125' : 'bg-gray-400'}`} />)}
              </div>
          </div>
      );
  }

  if (currentRoom.phase === 'EXQUISITE_DRAW') {
    const prevStep = getPreviousContent();
    
    let instruction = "Dessine la TÊTE !";
    let guideImage = null;

    if (currentRoom.round === 1) {
        instruction = "Raccorde le CORPS !";
        guideImage = prevStep?.content;
    } else if (currentRoom.round === 2) {
        instruction = "Dessine les JAMBES !";
        guideImage = prevStep?.content;
    }

    return (
        <div className="min-h-screen bg-purple-600 flex flex-col font-sans">
            <GlobalStyles />
            <div className="bg-white border-b-4 border-black p-4 shadow-md z-10 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="bg-black text-white px-3 py-1 rounded font-black uppercase text-sm flex items-center gap-2"><Ghost size={16}/> Mode Exquis</div>
                    <h2 className="text-xl md:text-2xl font-black text-purple-600">{instruction}</h2>
                </div>
                <FunButton onClick={submitContent} disabled={!inputContent} color="green" className="px-4 py-2 text-sm">J'ai fini !</FunButton>
            </div>
            <div className="flex-1 overflow-hidden bg-pattern p-4 md:p-8 flex items-center justify-center">
                 <DrawingCanvas 
                    onSave={(data) => setInputContent(data)} 
                    guideImage={guideImage} 
                 />
            </div>
        </div>
    );
  }

  if (currentRoom.phase === 'WRITE_START') {
    return (
        <div className="min-h-screen bg-yellow-400 flex items-center justify-center p-4 font-sans bg-pattern" style={{backgroundColor: '#facc15'}}>
            <GlobalStyles />
            <FunCard title="Round 1" className="w-full max-w-3xl text-center space-y-6 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
                <div className="space-y-2"><h2 className="text-4xl font-black text-black uppercase">Invente une situation !</h2><p className="text-gray-500 font-bold text-lg">Sois créatif, bizarre ou juste stupide.</p></div>
                <div className="relative">
                    <textarea value={inputContent} onChange={(e) => setInputContent(e.target.value)} className="w-full h-40 p-6 text-3xl text-center font-black border-4 border-black rounded-2xl focus:outline-none focus:shadow-hard resize-none bg-gray-50 leading-normal" placeholder="Un pingouin qui mange une raclette..." maxLength={80}/>
                    <div className="absolute bottom-4 right-4 text-xs font-bold text-gray-400">{inputContent.length}/80</div>
                </div>
                <FunButton onClick={submitContent} disabled={!inputContent.trim()} color="purple" className="w-full py-4 text-xl" icon={CheckCircle}>C'est validé !</FunButton>
            </FunCard>
        </div>
    );
  }

  if (currentRoom.phase === 'DRAW') {
    const prevStep = getPreviousContent();
    if (!prevStep) return <div className="p-10 text-center">Erreur synchro...</div>;
    return (
        <div className="min-h-screen bg-blue-500 flex flex-col font-sans">
            <GlobalStyles />
            <div className="bg-white border-b-4 border-black p-4 shadow-md z-10 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="bg-black text-white px-3 py-1 rounded font-black uppercase text-sm">DESSINE ÇA</div>
                    <h2 className="text-xl md:text-2xl font-black truncate max-w-[50vw] text-purple-600">"{prevStep.content}"</h2>
                </div>
                <FunButton onClick={submitContent} disabled={!inputContent} color="green" className="px-4 py-2 text-sm">J'ai fini !</FunButton>
            </div>
            <div className="flex-1 overflow-hidden bg-pattern p-4 md:p-8 flex items-center justify-center">
                 <DrawingCanvas onSave={(data) => setInputContent(data)} />
            </div>
        </div>
    );
  }

  if (currentRoom.phase === 'GUESS') {
    const prevStep = getPreviousContent();
    if (!prevStep) return <div className="p-10 text-center">Erreur synchro...</div>;
    return (
        <div className="min-h-screen bg-purple-600 flex items-center justify-center p-4 font-sans bg-pattern">
            <GlobalStyles />
            <FunCard className="w-full max-w-5xl flex flex-col md:flex-row overflow-hidden p-0 border-0">
                <div className="w-full md:w-2/3 bg-gray-100 border-b-4 md:border-b-0 md:border-r-4 border-black flex flex-col relative">
                    <div className="absolute top-4 left-4 z-10 bg-yellow-400 border-2 border-black px-3 py-1 rounded-full font-black text-xs shadow-hard-sm">DESSIN DE {prevStep.authorName.toUpperCase()}</div>
                    <div className="flex-1 flex items-center justify-center bg-white p-4"><img src={prevStep.content} alt="Guess this" className="max-w-full max-h-[50vh] object-contain drop-shadow-lg transform rotate-1" /></div>
                </div>
                <div className="w-full md:w-1/3 p-8 flex flex-col justify-center space-y-6 bg-white">
                     <div className="text-center space-y-2"><h2 className="text-3xl font-black uppercase leading-none">C'est quoi ce truc ?</h2><p className="text-gray-500 font-bold text-sm">Décris ce chef-d'œuvre.</p></div>
                     <textarea value={inputContent} onChange={(e) => setInputContent(e.target.value)} className="w-full h-32 p-4 text-xl text-center font-bold border-4 border-black rounded-xl focus:outline-none focus:shadow-hard bg-blue-50 resize-none" placeholder="Je pense que c'est..."/>
                    <FunButton onClick={submitContent} disabled={!inputContent.trim()} color="purple" icon={CheckCircle}>Valider</FunButton>
                </div>
            </FunCard>
        </div>
    );
  }

  if (currentRoom.phase === 'VOTE') {
    const me = currentRoom.players.find(p => p.uid === myId);
    if (me?.hasVoted) return <div className="min-h-screen bg-indigo-900 flex flex-col items-center justify-center p-4 text-center text-white space-y-6 bg-pattern"><GlobalStyles /><div className="w-32 h-32 bg-yellow-400 rounded-full border-4 border-black flex items-center justify-center animate-bounce shadow-hard-lg"><Star className="text-black fill-white" size={64} /></div><div><h2 className="text-4xl font-black uppercase text-yellow-400 drop-shadow-md">Vote Enregistré !</h2><p className="text-white/80 font-bold mt-2 text-xl">Suspense...</p></div><div className="flex flex-wrap gap-3 justify-center mt-8 p-4 bg-black/30 rounded-xl backdrop-blur-sm">{currentRoom.players.map(p => <div key={p.uid} title={p.name} className={`w-4 h-4 rounded-full border-2 border-black transition-all ${p.hasVoted ? 'bg-green-400 scale-125' : 'bg-gray-600'}`} />)}</div></div>;

    const allDrawings: any[] = [];
    if (currentRoom.mode === 'CLASSIC') {
        Object.entries(currentRoom.chains).forEach(([ownerId, chain]) => {
            chain.steps.forEach((step, idx) => {
                if (step.type === 'DRAWING') allDrawings.push({ chainOwnerId: ownerId, stepIndex: idx, step });
            });
        });
    } else {
        Object.entries(currentRoom.chains).forEach(([ownerId, chain]) => {
             if(chain.steps.length > 0) {
                 allDrawings.push({ chainOwnerId: ownerId, stepIndex: 0, step: chain.steps[0], isExquisite: true, fullChain: chain.steps });
             }
        });
    }

    return (
        <div className="min-h-screen bg-purple-900 p-4 overflow-y-auto font-sans">
            <GlobalStyles />
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-12 pt-8 space-y-4">
                    <h2 className="text-5xl font-black text-yellow-400 uppercase tracking-tight drop-shadow-[4px_4px_0_rgba(0,0,0,1)] stroke-black" style={{WebkitTextStroke: '2px black'}}>
                        {currentRoom.mode === 'CLASSIC' ? 'Le Musée des Horreurs' : 'Les Monstres Exquis'}
                    </h2>
                    <p className="text-white font-bold text-xl bg-black/50 inline-block px-6 py-2 rounded-full">
                        Vote pour ta création préférée !
                    </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 pb-20">
                    {allDrawings.map((item, i) => {
                        const isMine = item.step.authorId === myId;
                        const rot = ['rotate-1', '-rotate-1', 'rotate-2', '-rotate-2'][i % 4];
                        
                        return (
                            <button
                                key={`${item.chainOwnerId}-${item.stepIndex}`}
                                onClick={() => !isMine && castVote(item.chainOwnerId, item.stepIndex)}
                                disabled={isMine}
                                className={`
                                    group relative bg-white p-3 pb-12 border-4 border-black shadow-hard transition-all duration-300
                                    transform ${rot} hover:scale-105 hover:z-10 hover:rotate-0
                                    ${isMine ? 'opacity-60 cursor-not-allowed grayscale' : 'cursor-pointer hover:shadow-hard-lg'}
                                `}
                            >
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-24 h-8 bg-white/30 backdrop-blur-sm border border-white/50 shadow-sm transform -rotate-1"></div>
                                
                                {item.isExquisite ? (
                                    <div className="aspect-[1/3] flex flex-col bg-gray-50 border-2 border-gray-200 mb-2 overflow-hidden">
                                        {item.fullChain.map((part:any, idx:number) => (
                                            <img key={idx} src={part.content} className="w-full h-1/3 object-cover border-b border-dashed border-gray-300" alt="Part" />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="aspect-[4/3] bg-gray-50 border-2 border-gray-200 overflow-hidden mb-2">
                                        <img src={item.step.content} alt="Candidate" className="w-full h-full object-cover" />
                                    </div>
                                )}

                                <p className="font-handwriting text-gray-500 font-bold text-sm text-left transform rotate-1">#{i + 1}</p>
                                {isMine && <div className="absolute inset-0 flex items-center justify-center bg-black/10 font-black text-red-600 text-2xl uppercase tracking-widest -rotate-12 border-4 border-red-600 m-8 rounded-xl bg-white/80">C'est toi !</div>}
                                {!isMine && <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Star className="text-yellow-400 fill-yellow-400 drop-shadow-lg animate-pop" size={80} /></div>}
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    );
  }

  if (currentRoom.phase === 'PODIUM') {
    return <PodiumView room={currentRoom} onResults={() => {const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'gartic_rooms', roomCode);updateDoc(roomRef, { phase: 'RESULTS' });}} />;
  }

  if (currentRoom.phase === 'RESULTS') {
    return <ResultsView room={currentRoom} onRestart={() => window.location.reload()} currentUserId={myId || ''} />;
  }

  return null;
}

function PodiumView({ room, onResults }: { room: RoomData, onResults: () => void }) {
    const scores: Record<string, number> = {};
    if (room.players) room.players.forEach(p => scores[p.uid] = 0);
    if (room.chains) {
        Object.values(room.chains).forEach(chain => {
            if (chain?.steps) {
                chain.steps.forEach(step => {
                    if (step && (step.votes || 0) > 0) {
                        if (step.authorId) scores[step.authorId] = (scores[step.authorId] || 0) + (step.votes || 0);
                    }
                });
            }
        });
    }
    const sortedPlayers = [...(room.players || [])].sort((a, b) => (scores[b.uid] || 0) - (scores[a.uid] || 0));
    const top3 = sortedPlayers.slice(0, 3);

    return (
        <div className="min-h-screen bg-purple-900 flex flex-col items-center justify-center p-4 overflow-hidden relative font-sans bg-pattern">
            <GlobalStyles />
            <div className="absolute inset-0 overflow-hidden pointer-events-none">{[...Array(50)].map((_, i) => <div key={i} className="absolute w-4 h-4 bg-yellow-400 animate-float" style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 5}s`, backgroundColor: ['#FFD700', '#FF69B4', '#00CED1', '#ffffff'][Math.floor(Math.random() * 4)] }} />)}</div>
            <div className="z-10 text-center mb-8 md:mb-12 mt-8"><h1 className="text-5xl md:text-8xl font-black text-yellow-400 uppercase tracking-tighter drop-shadow-[8px_8px_0_rgba(0,0,0,1)] stroke-black mb-4 animate-wobble" style={{WebkitTextStroke: '2px black'}}>PODIUM</h1></div>
            <div className="flex items-end justify-center gap-4 md:gap-8 mb-12 z-10 w-full max-w-5xl px-2 h-[350px] md:h-[450px]">
                {top3[1] ? ( <div className="flex flex-col items-center w-1/3 animate-pop" style={{animationDelay: '0.5s'}}><div className="mb-2 md:mb-4 flex flex-col items-center"><div className="w-16 h-16 md:w-24 md:h-24 rounded-full border-4 border-black bg-gray-300 flex items-center justify-center text-2xl md:text-4xl font-black text-black shadow-hard mb-2">{top3[1].name.charAt(0).toUpperCase()}</div><span className="font-bold text-white bg-black px-2 py-1 rounded-full text-xs md:text-sm mb-1 truncate max-w-[100px] text-center">{top3[1].name}</span><span className="font-black text-gray-300 text-lg md:text-2xl">{scores[top3[1].uid]} pts</span></div><div className="w-full h-32 md:h-48 bg-gray-300 border-4 border-black rounded-t-2xl shadow-hard flex items-center justify-center relative"><span className="text-6xl font-black text-black/20">2</span></div></div> ) : <div className="w-1/3"></div>}
                {top3[0] ? ( <div className="flex flex-col items-center w-1/3 -mt-8 md:-mt-12 animate-pop" style={{animationDelay: '1s'}}><Crown size={48} className="text-yellow-400 fill-yellow-400 mb-2 md:mb-4 drop-shadow-[4px_4px_0_rgba(0,0,0,1)] animate-bounce"/><div className="mb-2 md:mb-4 flex flex-col items-center relative"><div className="w-20 h-20 md:w-32 md:h-32 rounded-full border-4 border-black bg-yellow-400 flex items-center justify-center text-4xl md:text-6xl font-black text-black shadow-hard mb-2 z-10">{top3[0].name.charAt(0).toUpperCase()}</div><span className="font-bold text-white bg-black px-3 py-1 rounded-full text-sm md:text-lg mb-1 truncate max-w-[120px] text-center">{top3[0].name}</span><span className="font-black text-yellow-400 text-2xl md:text-4xl drop-shadow-md">{scores[top3[0].uid]} pts</span></div><div className="w-full h-56 md:h-80 bg-yellow-400 border-4 border-black rounded-t-2xl shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center relative overflow-hidden"><div className="absolute inset-0 bg-white/20 transform rotate-45 translate-y-1/2"></div><span className="text-8xl font-black text-black/20">1</span></div></div> ) : null}
                {top3[2] ? ( <div className="flex flex-col items-center w-1/3 animate-pop" style={{animationDelay: '0.7s'}}><div className="mb-2 md:mb-4 flex flex-col items-center"><div className="w-16 h-16 md:w-24 md:h-24 rounded-full border-4 border-black bg-orange-400 flex items-center justify-center text-2xl md:text-4xl font-black text-black shadow-hard mb-2">{top3[2].name.charAt(0).toUpperCase()}</div><span className="font-bold text-white bg-black px-2 py-1 rounded-full text-xs md:text-sm mb-1 truncate max-w-[100px] text-center">{top3[2].name}</span><span className="font-black text-orange-400 text-lg md:text-2xl">{scores[top3[2].uid]} pts</span></div><div className="w-full h-24 md:h-32 bg-orange-400 border-4 border-black rounded-t-2xl shadow-hard flex items-center justify-center relative"><span className="text-5xl font-black text-black/20">3</span></div></div> ) : <div className="w-1/3"></div>}
            </div>
            <FunButton onClick={onResults} color="white" className="z-20 text-lg md:text-xl px-8 py-4 animate-pulse mb-8">Voir le carnage (Album) <ArrowRight size={24}/></FunButton>
        </div>
    );
}

function ResultsView({ room, onRestart, currentUserId }: { room: RoomData, onRestart: () => void, currentUserId: string }) {
    const [viewingChainOwner, setViewingChainOwner] = useState<string>(room.players[0].uid);
    const currentChain = room.chains[viewingChainOwner];
    const ownerName = room.players.find(p => p.uid === viewingChainOwner)?.name;

    return (
        <div className="min-h-screen bg-purple-100 font-sans flex flex-col">
            <GlobalStyles />
            <div className="bg-white border-b-4 border-black p-4 shadow-md sticky top-0 z-50 flex flex-col md:flex-row items-center justify-between gap-4">
                 <div className="flex items-center gap-2"><div className="bg-black p-2 rounded-lg"><ImageIcon className="text-white" size={24}/></div><h1 className="text-2xl font-black uppercase">L'Album Photo</h1></div>
                 <div className="flex gap-2 overflow-x-auto max-w-full pb-2 md:pb-0 scrollbar-hide">
                    {room.players.map(p => <button key={p.uid} onClick={() => setViewingChainOwner(p.uid)} className={`px-4 py-2 rounded-xl font-bold border-2 border-black whitespace-nowrap transition-all shadow-hard-sm ${viewingChainOwner === p.uid ? 'bg-yellow-400 -translate-y-1 shadow-hard' : 'bg-white hover:bg-gray-100'}`}>{p.name}</button>)}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-12 bg-pattern">
                <div className="max-w-2xl mx-auto space-y-12 relative">
                    <div className="text-center mb-12 relative"><div className="bg-white border-4 border-black p-6 inline-block transform -rotate-2 shadow-hard-lg rounded-sm"><h2 className="text-2xl font-black uppercase text-gray-400">Album de</h2><h3 className="text-5xl font-black text-purple-600 uppercase">{ownerName}</h3></div></div>
                    
                    {/* LOGIQUE D'AFFICHAGE DIFFERENT SELON MODE */}
                    {room.mode === 'EXQUISITE' ? (
                        <div className="flex flex-col items-center">
                            <div className="bg-white border-4 border-black p-2 shadow-hard-lg w-full max-w-[400px] relative">
                                <div className="absolute -top-4 -right-4 bg-yellow-400 border-4 border-black p-2 rounded-full font-black transform rotate-12">CADAVRE EXQUIS</div>
                                {currentChain.steps.map((step, idx) => (
                                    <img key={idx} src={step.content} className="w-full border-b-2 border-black border-dashed last:border-0" style={{display: 'block'}} />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="absolute left-8 top-32 bottom-0 w-2 bg-black ml-[19px] md:ml-[27px] z-0 hidden md:block border-l-2 border-r-2 border-black bg-stripes-white"></div>
                            {currentChain.steps.map((step, idx) => (
                                <div key={idx} className="relative z-10 flex gap-6 group">
                                    <div className="hidden md:flex flex-col items-center"><div className="w-16 h-16 rounded-full border-4 border-black bg-white flex items-center justify-center text-2xl font-black shadow-hard z-10 relative">{idx + 1}</div></div>
                                    <div className="flex-1">
                                        <div className={`bg-white border-4 border-black p-1 shadow-hard transition-transform hover:-translate-y-1 hover:shadow-hard-lg ${idx % 2 === 0 ? 'rotate-1' : '-rotate-1'}`}>
                                            <div className="bg-gray-100 border-b-4 border-black p-3 flex justify-between items-center">
                                                <span className="font-black text-lg uppercase">{step.authorName}</span>
                                                <div className="flex items-center gap-2">
                                                    {step.votes > 0 && <div className="bg-yellow-400 border-2 border-black px-2 rounded-full flex items-center gap-1 font-bold text-xs shadow-sm"><Star size={12} fill="black"/> {step.votes}</div>}
                                                    <span className="text-xs font-bold bg-black text-white px-2 py-1 rounded uppercase">{step.type === 'TEXT' ? 'ÉCRITURE' : 'DESSIN'}</span>
                                                </div>
                                            </div>
                                            <div className="p-6 min-h-[150px] flex items-center justify-center bg-white">
                                                {step.type === 'TEXT' ? <p className="text-3xl md:text-4xl font-black text-center uppercase leading-tight text-gray-800" style={{fontFamily: 'cursive'}}>"{step.content}"</p> : <img src={step.content} alt="Drawing" className="max-w-full border-2 border-gray-200 shadow-inner" />}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>
            <div className="p-6 bg-white border-t-4 border-black flex justify-center shadow-[0_-4px_10px_rgba(0,0,0,0.1)]"><FunButton onClick={onRestart} color="purple" icon={Zap}>Nouvelle Partie</FunButton></div>
        </div>
    );
}