import { useState, useEffect } from 'react';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, onSnapshot, updateDoc, arrayUnion, increment, getDoc } from 'firebase/firestore';
import { auth, db, APP_ID } from './firebase-config';
import { FunButton, FunCard, PlayerBadge, CameraCapture, DrawingCanvas } from './components/GameComponents';
import { ThreeDEditor } from './components/ThreeDEditor';
import { Loader2, Play, Star, Crown, ImageIcon, MessageSquare, Ghost, Camera, Box, Zap } from 'lucide-react';

// --- STYLES ---
const GlobalStyles = () => (
  <style>{`
    @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
    @keyframes popIn { 0% { transform: scale(0); opacity: 0; } 80% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
    .animate-float { animation: float 3s ease-in-out infinite; }
    .animate-pop { animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
    .bg-pattern { background-color: #7c3aed; background-image: radial-gradient(#a78bfa 2px, transparent 2px); background-size: 30px 30px; }
    .shadow-hard { box-shadow: 4px 4px 0px 0px rgba(0,0,0,1); }
    .shadow-hard-lg { box-shadow: 8px 8px 0px 0px rgba(0,0,0,1); }
    .shadow-hard-sm { box-shadow: 2px 2px 0px 0px rgba(0,0,0,1); }
    html, body { overflow-x: hidden; width: 100%; margin: 0; padding: 0; }
  `}</style>
);

const AVATAR_COLORS = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-400', 'bg-blue-400', 'bg-purple-400', 'bg-pink-400', 'bg-teal-400'];

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState(''); 
  const [joinCode, setJoinCode] = useState('');
  const [currentRoom, setCurrentRoom] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [inputContent, setInputContent] = useState(''); 
  const [isReady, setIsReady] = useState(false);
  
  const [tabId] = useState(() => {
      const existing = sessionStorage.getItem('gartic_tab_id');
      if (existing) return existing;
      const newId = Math.random().toString(36).substring(2, 10);
      sessionStorage.setItem('gartic_tab_id', newId);
      return newId;
  });
  const myId = user ? `${user.uid}_${tabId}` : null;

  // 1. Authentification Anonyme
  useEffect(() => { 
      signInAnonymously(auth).catch(err => console.error(err));
      const unsubscribe = onAuthStateChanged(auth, setUser);
      return () => unsubscribe();
  }, []);

  // 2. Écoute de la salle (Room Listener)
  useEffect(() => {
    if (!user || !roomCode) return;
    return onSnapshot(doc(db, 'artifacts', APP_ID, 'rooms', roomCode), (snap) => {
      if (snap.exists()) {
          const data = snap.data();
          // Vérif Anti-Kick
          const amIStillIn = data.players.some((p: any) => p.uid === myId);
          if (!amIStillIn && data.phase !== 'RESULTS') {
             alert("Tu as été éjecté !");
             window.location.reload();
             return;
          }
          setCurrentRoom(data);
      } else {
          setCurrentRoom(null);
      }
    });
  }, [user, roomCode, myId]);

  // --- ACTIONS (Créer, Rejoindre, Start, Submit) ---

  const createRoom = async () => {
    if (!playerName.trim() || !user) return;
    setLoading(true);
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    const p = { uid: myId!, name: playerName, isHost: true, isReady: false, hasVoted: false, score: 0, avatarColor: AVATAR_COLORS[0] };
    
    // On crée la room
    await setDoc(doc(db, 'artifacts', APP_ID, 'rooms', code), { 
        code, 
        mode: 'CLASSIC', 
        players: [p], 
        phase: 'LOBBY', 
        round: 0, 
        chains: {}, 
        maxRounds: 3, 
        createdAt: Date.now() 
    });
    
    setRoomCode(code); 
    setLoading(false);
  };

  const joinRoom = async () => {
      if (!playerName.trim() || !joinCode || !user) return;
      setLoading(true); 
      const code = joinCode.toUpperCase();
      const ref = doc(db, 'artifacts', APP_ID, 'rooms', code);
      const snap = await getDoc(ref);
      
      if (snap.exists()) {
          const d = snap.data();
          if (d.phase !== 'LOBBY') { alert("Partie déjà commencée !"); setLoading(false); return; }
          
          const newPlayer = { 
              uid: myId!, 
              name: playerName, 
              isHost: false, 
              isReady: false, 
              hasVoted: false, 
              score: 0, 
              avatarColor: AVATAR_COLORS[d.players.length % AVATAR_COLORS.length] 
          };
          
          await updateDoc(ref, { players: [...d.players, newPlayer] });
          setRoomCode(code);
      } else {
          alert("Code invalide");
      }
      setLoading(false);
  };

  const startGame = async () => {
      if (!currentRoom) return;
      // Initialisation des chaînes de jeu
      const chains: any = {}; 
      currentRoom.players.forEach((p:any) => chains[p.uid] = { ownerId: p.uid, steps: [] });
      
      let phase = 'WRITE_START';
      if (currentRoom.mode === 'EXQUISITE') phase = 'EXQUISITE_DRAW';
      
      await updateDoc(doc(db, 'artifacts', APP_ID, 'rooms', roomCode), { 
          phase, 
          chains, 
          round: 0, 
          players: currentRoom.players.map((p:any) => ({...p, isReady: false, hasVoted: false, score: 0})) 
      });
  };

  const submitStep = async (contentOverride?: string) => {
      if (!currentRoom) return;
      setIsReady(true); // UI immédiate
      
      const content = contentOverride || inputContent;
      const myIdx = currentRoom.players.findIndex((p:any) => p.uid === myId);
      const totalPlayers = currentRoom.players.length;
      
      // Calculer à qui appartient la chaîne actuelle
      const ownerIdx = (myIdx - currentRoom.round + (totalPlayers * 10)) % totalPlayers;
      const ownerId = currentRoom.players[ownerIdx].uid;
      
      // Déterminer le type (Texte ou Dessin)
      let type = 'DRAWING';
      if (currentRoom.mode === 'CLASSIC' || currentRoom.mode === 'TRADITIONAL' || currentRoom.mode === '3D') {
          type = (currentRoom.round % 2 === 0) ? 'TEXT' : 'DRAWING';
      }

      // Sauvegarde
      await updateDoc(doc(db, 'artifacts', APP_ID, 'rooms', roomCode), {
          [`chains.${ownerId}.steps`]: arrayUnion({ 
              type, 
              authorId: myId, 
              authorName: currentRoom.players[myIdx].name, 
              content, 
              votes: 0 
          }),
          players: currentRoom.players.map((p:any) => p.uid === myId ? { ...p, isReady: true } : p)
      });
      
      setInputContent(''); 
  };

  // KICK PLAYER
  const kickPlayer = async (uidToKick: string, nameToKick: string) => {
      if(!confirm(`Virer ${nameToKick} ?`)) return;
      const newPlayers = currentRoom.players.filter((p:any) => p.uid !== uidToKick);
      await updateDoc(doc(db, 'artifacts', APP_ID, 'rooms', roomCode), { players: newPlayers });
  };

  // GESTION AUTOMATIQUE DES TOURS (Cerveau du jeu)
  useEffect(() => {
      if (!currentRoom || !currentRoom.players) return;
      
      // Vérifier si tout le monde est prêt
      const allReady = currentRoom.players.every((p:any) => p.isReady);
      const allVoted = currentRoom.players.every((p:any) => p.hasVoted);
      const isHost = currentRoom.players.find((p:any) => p.uid === myId)?.isHost;

      if (!isHost) return; // Seul l'hôte déclenche les changements pour éviter les doublons

      // Passage au tour suivant
      if (allReady && ['WRITE_START', 'DRAW', 'GUESS', 'EXQUISITE_DRAW'].includes(currentRoom.phase)) {
          const maxRounds = currentRoom.mode === 'EXQUISITE' ? 3 : currentRoom.players.length;
          const isGameEnd = currentRoom.round + 1 >= maxRounds;
          
          setTimeout(() => {
              if (isGameEnd) {
                  updateDoc(doc(db, 'artifacts', APP_ID, 'rooms', roomCode), { 
                      phase: 'VOTE', 
                      players: currentRoom.players.map((p:any) => ({...p, isReady: false, hasVoted: false})) 
                  });
              } else {
                  let nextPhase = 'DRAW';
                  if (currentRoom.mode !== 'EXQUISITE') {
                      nextPhase = ((currentRoom.round + 1) % 2 === 0) ? 'GUESS' : 'DRAW';
                  } else {
                      nextPhase = 'EXQUISITE_DRAW';
                  }
                  
                  updateDoc(doc(db, 'artifacts', APP_ID, 'rooms', roomCode), { 
                      round: increment(1), 
                      phase: nextPhase, 
                      players: currentRoom.players.map((p:any) => ({...p, isReady: false})) 
                  });
              }
          }, 1500); // Petit délai pour l'animation
      }

      // Passage du Vote au Podium
      if (currentRoom.phase === 'VOTE' && allVoted) {
          setTimeout(() => {
              updateDoc(doc(db, 'artifacts', APP_ID, 'rooms', roomCode), { phase: 'PODIUM' });
          }, 1500);
      }
  }, [currentRoom?.players, currentRoom?.phase, currentRoom?.round]); // Dépendances

  const castVote = async (ownerId: string, stepIdx: number) => {
      const chain = currentRoom.chains[ownerId];
      // On incrémente les votes localement avant d'envoyer (pour éviter les race conditions, on lit tout le tableau)
      const steps = [...chain.steps];
      steps[stepIdx].votes = (steps[stepIdx].votes || 0) + 1;
      
      await updateDoc(doc(db, 'artifacts', APP_ID, 'rooms', roomCode), {
          [`chains.${ownerId}.steps`]: steps,
          players: currentRoom.players.map((p:any) => p.uid === myId ? { ...p, hasVoted: true } : p)
      });
  };

  // --- RENDER ---

  if (!user || !myId) return <div className="min-h-screen flex items-center justify-center bg-pattern"><Loader2 className="animate-spin text-white" size={48}/></div>;

  // 1. ÉCRAN D'ACCUEIL
  if (!currentRoom) return (
    <div className="min-h-screen bg-pattern p-4 flex items-center justify-center font-sans">
        <GlobalStyles />
        <FunCard className="max-w-md text-center">
            <h1 className="text-5xl font-black text-yellow-400 stroke-black mb-6 drop-shadow-md" style={{WebkitTextStroke:'2px black'}}>GARTIC OMEGA</h1>
            <input className="w-full border-4 border-black rounded-xl p-3 text-xl font-bold mb-4" placeholder="Pseudo" value={playerName} onChange={e => setPlayerName(e.target.value)} />
            <FunButton onClick={createRoom} className="w-full mb-4" color="purple">Créer une Party</FunButton>
            <div className="flex gap-2"><input className="border-4 border-black rounded-xl p-3 text-center font-black w-full" placeholder="CODE" value={joinCode} onChange={e => setJoinCode(e.target.value)} /><FunButton onClick={joinRoom} color="green">GO</FunButton></div>
        </FunCard>
    </div>
  );

  const me = currentRoom.players.find((p:any) => p.uid === myId);

  // 2. LOBBY
  if (currentRoom.phase === 'LOBBY') return (
    <div className="min-h-screen bg-pattern p-4 font-sans"><GlobalStyles />
        <FunCard className="max-w-4xl mx-auto mb-8">
            <div className="flex flex-col md:flex-row justify-between items-center border-b-4 border-black pb-4 mb-4 gap-4">
                <h2 className="text-3xl font-black text-center md:text-left">LOBBY <span className="text-purple-600 select-all">{currentRoom.code}</span></h2>
                <div className="flex flex-wrap gap-2 justify-center">
                    {['CLASSIC', 'EXQUISITE', 'TRADITIONAL', '3D'].map(m => (
                        <button key={m} onClick={() => me?.isHost && updateDoc(doc(db, 'artifacts', APP_ID, 'rooms', roomCode), { mode: m })} disabled={!me?.isHost} className={`px-3 py-1 rounded border-2 border-black font-bold flex items-center gap-2 text-xs md:text-sm ${currentRoom.mode === m ? 'bg-yellow-400' : 'bg-gray-100 text-gray-400'}`}>
                            {m === '3D' ? <Box size={16}/> : m === 'TRADITIONAL' ? <Camera size={16}/> : m === 'EXQUISITE' ? <Ghost size={16}/> : <MessageSquare size={16}/>} {m}
                        </button>
                    ))}
                </div>
            </div>
            {me?.isHost ? <FunButton onClick={startGame} color="green" className="w-full animate-pop" icon={Play}>LANCER LA PARTIE</FunButton> : <div className="text-center font-bold animate-pulse text-purple-600">En attente de l'hôte...</div>}
        </FunCard>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-4 max-w-4xl mx-auto">
            {currentRoom.players.map((p:any) => <PlayerBadge key={p.uid} {...p} isMe={p.uid === myId} canKick={me?.isHost} onKick={kickPlayer} />)}
        </div>
    </div>
  );

  // 3. ECRAN D'ATTENTE (Si j'ai fini)
  if (me?.isReady && !['RESULTS', 'VOTE', 'PODIUM'].includes(currentRoom.phase)) {
      return <div className="min-h-screen bg-pattern flex flex-col items-center justify-center p-4 text-center space-y-8"><GlobalStyles /><FunCard><Loader2 className="animate-spin mx-auto mb-4" size={48}/><h2 className="text-3xl font-black">TERMINE !</h2><p>On attend les retardataires...</p></FunCard></div>;
  }

  // --- LOGIQUE DU PRECEDENT TOUR ---
  const prevStep = (() => {
      const myIdx = currentRoom.players.findIndex((p:any) => p.uid === myId);
      const ownerIdx = (myIdx - currentRoom.round + currentRoom.players.length * 10) % currentRoom.players.length;
      const chain = currentRoom.chains[currentRoom.players[ownerIdx].uid];
      return chain?.steps[chain.steps.length - 1];
  })();

  // 4. PHASE ECRITURE
  if (currentRoom.phase === 'WRITE_START') {
      return (
          <div className="min-h-screen bg-yellow-400 p-4 flex items-center justify-center font-sans"><GlobalStyles />
              <FunCard title="SUJET">
                  <h2 className="text-2xl font-black mb-4 text-center">INVENTE UNE SITUATION !</h2>
                  <textarea className="w-full h-32 border-4 border-black rounded-xl p-4 font-bold text-xl mb-4 resize-none" placeholder="Un chien qui mange une pizza..." value={inputContent} onChange={e => setInputContent(e.target.value)} />
                  <FunButton onClick={() => submitStep()} disabled={!inputContent} color="purple" className="w-full">VALIDER</FunButton>
              </FunCard>
          </div>
      );
  }

  // 5. PHASE DESSIN (2D, 3D, PAPIER)
  if (currentRoom.phase === 'DRAW' || currentRoom.phase === 'EXQUISITE_DRAW') {
      const instruction = currentRoom.mode === 'EXQUISITE' ? (currentRoom.round===0?"TÊTE":currentRoom.round===1?"CORPS":"JAMBES") : prevStep?.content;
      const is3D = currentRoom.mode === '3D';
      
      return (
          <div className="min-h-screen bg-blue-500 flex flex-col font-sans h-screen overflow-hidden"><GlobalStyles />
              <div className="bg-white p-2 border-b-4 border-black flex justify-between items-center z-20 shrink-0">
                  <div className="font-black text-lg truncate max-w-[70%] flex items-center gap-2">
                      {is3D ? <Box size={20}/> : <Pencil size={20}/>}
                      <span>{is3D ? "MODELISE: " : "DESSINE: "}</span>
                      <span className="text-purple-600 bg-gray-100 px-2 rounded">{instruction}</span>
                  </div>
                  {/* Le bouton FINI est dans l'éditeur pour le 3D */}
                  {!is3D && <FunButton onClick={() => submitStep()} disabled={!inputContent && currentRoom.mode !== 'TRADITIONAL'} color="green" className="py-1 text-sm h-10">FINI</FunButton>}
              </div>
              
              <div className="flex-1 relative bg-pattern overflow-hidden">
                  {currentRoom.mode === '3D' ? (
                      <div className="h-full w-full p-4">
                        <ThreeDEditor onSave={(data) => submitStep(data)} />
                      </div>
                  ) : currentRoom.mode === 'TRADITIONAL' ? (
                      <div className="p-4 flex justify-center h-full overflow-y-auto"><CameraCapture onCapture={(data) => submitStep(data)} /></div>
                  ) : (
                      <div className="p-2 h-full flex items-center justify-center">
                          <DrawingCanvas 
                            onSave={setInputContent} 
                            guideImage={currentRoom.mode === 'EXQUISITE' ? prevStep?.content : null} 
                          />
                      </div>
                  )}
              </div>
          </div>
      );
  }

  // 6. PHASE DEVINETTE
  if (currentRoom.phase === 'GUESS') {
      return (
          <div className="min-h-screen bg-purple-600 p-4 flex items-center justify-center font-sans"><GlobalStyles />
              <FunCard className="max-w-4xl flex flex-col md:flex-row gap-6 w-full">
                  <div className="flex-1 bg-gray-100 border-4 border-black rounded-xl p-2 flex items-center justify-center min-h-[300px]">
                      <img src={prevStep?.content} className="max-h-[50vh] w-full object-contain" alt="Drawing to guess" />
                  </div>
                  <div className="flex-1 flex flex-col justify-center">
                      <h2 className="text-2xl font-black mb-4 text-center">C'EST QUOI CE TRUC ?</h2>
                      <textarea className="w-full h-32 border-4 border-black rounded-xl p-4 font-bold text-xl mb-4 resize-none" placeholder="Je pense que c'est..." value={inputContent} onChange={e => setInputContent(e.target.value)} />
                      <FunButton onClick={() => submitStep()} disabled={!inputContent} color="purple" className="w-full">VALIDER</FunButton>
                  </div>
              </FunCard>
          </div>
      );
  }

  // 7. PHASE DE VOTE
  if (currentRoom.phase === 'VOTE') {
     const me = currentRoom.players.find((p:any) => p.uid === myId);
     if(me?.hasVoted) return <div className="min-h-screen bg-indigo-900 flex flex-col items-center justify-center text-white font-black text-3xl text-center p-4"><GlobalStyles /><div className="animate-bounce text-6xl mb-4">⭐</div>VOTE ENREGISTRÉ...<br/><span className="text-sm font-normal opacity-70">On attend les autres juges</span></div>;

     const allDrawings: any[] = [];
     if (currentRoom.mode !== 'EXQUISITE') {
         Object.entries(currentRoom.chains).forEach(([oid, chain]:any) => {
            chain.steps.forEach((s:any, i:number) => { 
                if(s.type === 'DRAWING') allDrawings.push({ oid, i, s }); 
            });
         });
     } else {
         Object.entries(currentRoom.chains).forEach(([oid, chain]:any) => { 
             if(chain.steps.length) allDrawings.push({ oid, i: 0, s: chain.steps[0], full: chain.steps, isExq: true }); 
         });
     }

     return (
        <div className="min-h-screen bg-purple-900 p-4 font-sans overflow-y-auto"><GlobalStyles />
           <div className="max-w-7xl mx-auto">
               <h2 className="text-4xl md:text-6xl font-black text-yellow-400 text-center mb-2 stroke-black mt-8" style={{WebkitTextStroke:'2px black'}}>EXPOSITION</h2>
               <p className="text-white text-center mb-8 font-bold">Vote pour tes œuvres préférées !</p>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
                  {allDrawings.map((d, idx) => (
                     <button key={`${d.oid}-${d.i}`} onClick={() => d.s.authorId !== myId && castVote(d.oid, d.i)} disabled={d.s.authorId === myId} className={`relative group bg-white p-3 pb-12 border-4 border-black shadow-hard transition-transform hover:scale-105 hover:z-10 ${idx%2===0?'rotate-1':'-rotate-1'} ${d.s.authorId === myId ? 'opacity-60 cursor-default' : 'cursor-pointer'}`}>
                        <div className="bg-gray-200 aspect-square w-full border-2 border-black overflow-hidden">
                            {d.isExq ? (
                                <div className="flex flex-col h-full">{d.full.map((part:any, k:number) => <img key={k} src={part.content} className="w-full h-1/3 object-cover"/>)}</div>
                            ) : (
                                <img src={d.s.content} className="w-full h-full object-cover"/>
                            )}
                        </div>
                        <div className="absolute bottom-3 left-3 font-handwriting text-gray-500 font-bold">Oeuvre #{idx+1}</div>
                        {d.s.authorId === myId && <div className="absolute inset-0 flex items-center justify-center"><div className="bg-white/90 border-4 border-red-500 text-red-500 font-black px-4 py-2 -rotate-12 text-xl">C'EST TOI</div></div>}
                        {d.s.authorId !== myId && <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Star className="text-yellow-400 fill-yellow-400 drop-shadow-lg" size={64} /></div>}
                     </button>
                  ))}
               </div>
           </div>
        </div>
     );
  }

  // 8. PODIUM
  if (currentRoom.phase === 'PODIUM') {
      // Calcul des scores simplifié pour affichage
      const sorted = [...currentRoom.players].sort((a:any, b:any) => {
          // Calculer le score réel ici en parcourant les chaînes si besoin, 
          // ou supposer qu'on a mis à jour 'score' avant.
          // Pour l'instant on calcule à la volée :
          const scoreA = Object.values(currentRoom.chains).reduce((acc:number, chain:any) => acc + chain.steps.filter((s:any) => s.authorId === a.uid).reduce((sa:number, s:any) => sa + (s.votes||0), 0), 0);
          const scoreB = Object.values(currentRoom.chains).reduce((acc:number, chain:any) => acc + chain.steps.filter((s:any) => s.authorId === b.uid).reduce((sa:number, s:any) => sa + (s.votes||0), 0), 0);
          return scoreB - scoreA;
      });

      return (
        <div className="min-h-screen bg-yellow-400 flex flex-col items-center justify-center font-sans p-4 overflow-hidden"><GlobalStyles />
            <h1 className="text-6xl font-black text-white stroke-black mb-12" style={{WebkitTextStroke:'3px black'}}>PODIUM</h1>
            <div className="flex items-end gap-4 mb-12 h-[300px]">
                {sorted[1] && <div className="flex flex-col items-center"><div className="w-20 h-20 bg-gray-300 rounded-full border-4 border-black flex items-center justify-center font-black text-2xl mb-2">{sorted[1].name[0]}</div><div className="w-24 h-32 bg-gray-300 border-4 border-black rounded-t-lg flex items-center justify-center font-black text-4xl">2</div></div>}
                {sorted[0] && <div className="flex flex-col items-center -mt-8"><Crown className="text-yellow-600 animate-bounce mb-2" size={48}/><div className="w-24 h-24 bg-yellow-300 rounded-full border-4 border-black flex items-center justify-center font-black text-3xl mb-2">{sorted[0].name[0]}</div><div className="w-28 h-48 bg-yellow-300 border-4 border-black rounded-t-lg flex items-center justify-center font-black text-6xl">1</div></div>}
                {sorted[2] && <div className="flex flex-col items-center"><div className="w-20 h-20 bg-orange-400 rounded-full border-4 border-black flex items-center justify-center font-black text-2xl mb-2">{sorted[2].name[0]}</div><div className="w-24 h-20 bg-orange-400 border-4 border-black rounded-t-lg flex items-center justify-center font-black text-4xl">3</div></div>}
            </div>
            <FunButton onClick={() => updateDoc(doc(db, 'artifacts', APP_ID, 'rooms', roomCode), { phase: 'RESULTS' })} color="white">VOIR L'ALBUM <ArrowRight/></FunButton>
        </div>
      );
  }

  // 9. RESULTATS (ALBUM)
  if (currentRoom.phase === 'RESULTS') {
      return <ResultsView room={currentRoom} onRestart={() => window.location.reload()} />;
  }

  return null;
}

// --- COMPOSANT INTERNE RESULTATS ---
function ResultsView({ room, onRestart }: { room: any, onRestart: () => void }) {
    const [viewOwner, setViewOwner] = useState(room.players[0].uid);
    const chain = room.chains[viewOwner];
    
    return (
        <div className="min-h-screen bg-purple-100 font-sans flex flex-col h-screen"><GlobalStyles />
            <div className="bg-white border-b-4 border-black p-3 shadow-md flex flex-col md:flex-row items-center justify-between gap-4 shrink-0 z-10">
                 <div className="flex items-center gap-2"><div className="bg-black p-2 rounded-lg"><ImageIcon className="text-white" size={20}/></div><h1 className="text-xl md:text-2xl font-black uppercase">Album</h1></div>
                 <div className="flex gap-2 overflow-x-auto max-w-full pb-2 md:pb-0 scrollbar-hide w-full md:w-auto">
                    {room.players.map((p:any) => <button key={p.uid} onClick={()=>setViewOwner(p.uid)} className={`px-3 py-2 md:px-4 rounded-xl font-bold border-2 border-black whitespace-nowrap transition-all shadow-hard-sm text-sm ${viewOwner === p.uid ? 'bg-yellow-400 -translate-y-1 shadow-hard' : 'bg-white hover:bg-gray-100'}`}>{p.name}</button>)}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-pattern">
                <div className="max-w-xl mx-auto space-y-8">
                    <div className="text-center"><div className="bg-white border-4 border-black p-4 inline-block transform -rotate-2 shadow-hard-lg"><h2 className="text-xl font-black uppercase text-gray-400">Album de</h2><h3 className="text-3xl font-black text-purple-600 uppercase">{room.players.find((p:any)=>p.uid===viewOwner)?.name}</h3></div></div>
                    
                    {room.mode === 'EXQUISITE' ? (
                        <div className="flex flex-col items-center">
                            <div className="bg-white border-4 border-black p-2 shadow-hard-lg w-full max-w-[400px]">
                                {chain.steps.map((step:any, idx:number) => (
                                    <img key={idx} src={step.content} className="w-full border-b-2 border-black border-dashed last:border-0 block" />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {chain.steps.map((step:any, idx:number) => (
                                <div key={idx} className="bg-white border-4 border-black p-1 shadow-hard">
                                    <div className="bg-gray-100 border-b-4 border-black p-2 flex justify-between items-center">
                                        <span className="font-black text-sm uppercase">{step.authorName}</span>
                                        {step.votes > 0 && <div className="bg-yellow-400 border-2 border-black px-2 rounded-full text-xs font-bold flex items-center gap-1"><Star size={10} fill="black"/> {step.votes}</div>}
                                    </div>
                                    <div className="p-4 flex items-center justify-center min-h-[100px]">
                                        {step.type === 'TEXT' ? <p className="text-2xl font-black text-center font-script">"{step.content}"</p> : <img src={step.content} className="w-full max-h-[300px] object-contain"/>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <div className="p-4 bg-white border-t-4 border-black flex justify-center shrink-0"><FunButton onClick={onRestart} color="purple" icon={Zap}>Rejouer</FunButton></div>
        </div>
    );
}