import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Crown, CheckCircle, Star, XCircle, Loader2, Camera, Upload, RefreshCw, ArrowRight, Pencil, Eraser, Undo, Trash2 } from 'lucide-react';

export const FunButton = ({ onClick, disabled, children, color = 'yellow', className = '', icon: Icon }: any) => {
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
    <button onClick={onClick} disabled={disabled} className={`relative group px-4 py-3 md:px-6 md:py-3 rounded-xl font-black text-sm md:text-lg uppercase tracking-wider transition-all border-2 border-b-[4px] md:border-b-[6px] active:border-b-2 active:translate-y-[2px] md:active:translate-y-[4px] disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:border-b-[4px] md:disabled:border-b-[6px] flex items-center justify-center gap-2 w-full md:w-auto ${colorClasses[color]} ${className}`}>
      {Icon && <Icon size={20} className="md:w-6 md:h-6" strokeWidth={3} />} {children}
    </button>
  );
};

export const FunCard = ({ children, className = '', title }: any) => (
  <div className={`bg-white border-4 border-black rounded-3xl shadow-hard p-4 md:p-6 w-full ${className}`}>
    {title && <div className="bg-black text-white inline-block px-3 py-1 md:px-4 md:py-1 rounded-full font-bold uppercase tracking-widest mb-4 transform -rotate-2 border-2 border-white shadow-sm text-sm md:text-base">{title}</div>}
    {children}
  </div>
);

export const PlayerBadge = ({ name, isHost, isReady, isMe, hasVoted, uid, color = 'bg-gray-400', onKick, canKick }: any) => (
  <div className={`relative flex flex-col items-center p-2 md:p-3 rounded-2xl border-4 border-black bg-white transition-all group ${isReady ? 'shadow-hard bg-green-50 -translate-y-1' : 'shadow-sm opacity-90'} ${hasVoted ? 'ring-4 ring-yellow-400' : ''}`}>
    {isHost && <Crown size={20} className="absolute -top-3 -right-3 md:-top-4 md:-right-4 text-yellow-500 fill-yellow-400 rotate-12 drop-shadow-md animate-bounce" />}
    {canKick && !isMe && <button onClick={() => onKick(uid, name)} className="absolute -top-2 -left-2 bg-red-500 text-white p-1 rounded-full border-2 border-black hover:scale-110 transition-transform z-10 shadow-sm md:opacity-0 md:group-hover:opacity-100 opacity-100"><XCircle size={14} strokeWidth={3} /></button>}
    <div className={`w-12 h-12 md:w-16 md:h-16 rounded-full border-4 border-black flex items-center justify-center text-xl md:text-2xl font-black text-white mb-2 ${color} shadow-inner`}>{name.charAt(0).toUpperCase()}</div>
    <div className="text-center w-full"><div className="font-bold text-black truncate w-full text-xs md:text-base leading-tight">{name}</div>{isMe && <div className="text-[10px] font-black text-purple-600 uppercase tracking-wider">(Moi)</div>}</div>
    {isReady && <div className="absolute -bottom-3 bg-green-500 text-white text-[10px] md:text-xs font-bold px-2 py-1 rounded-full border-2 border-black flex items-center gap-1"><CheckCircle size={10} /> PRÊT</div>}
    {hasVoted && <div className="absolute -bottom-3 bg-yellow-400 text-black text-[10px] md:text-xs font-bold px-2 py-1 rounded-full border-2 border-black flex items-center gap-1"><Star size={10} fill="black"/> A VOTÉ</div>}
  </div>
);

export const CameraCapture = ({ onCapture }: { onCapture: (data: string) => void }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
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
        } catch (err) { setError("Utilise le bouton d'import."); }
    };
    const stopCamera = () => { if (videoRef.current?.srcObject) { (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop()); setIsStreaming(false); } };
    const takePhoto = () => {
        if (videoRef.current) {
            const cvs = document.createElement('canvas');
            const vid = videoRef.current;
            const w = Math.min(600, vid.videoWidth);
            cvs.width = w; cvs.height = w * (vid.videoHeight / vid.videoWidth);
            cvs.getContext('2d')?.drawImage(vid, 0, 0, cvs.width, cvs.height);
            setCapturedImage(cvs.toDataURL('image/jpeg', 0.5));
            stopCamera();
        }
    };
    const handleUpload = (e: any) => {
        const f = e.target.files?.[0];
        if(f) { const r = new FileReader(); r.onload = (ev: any) => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); const w = Math.min(600, i.width); c.width = w; c.height = w * (i.height/i.width); c.getContext('2d')?.drawImage(i,0,0,c.width,c.height); setCapturedImage(c.toDataURL('image/jpeg',0.5)); }; i.src = ev.target.result; }; r.readAsDataURL(f); }
    };

    useEffect(() => { startCamera(); return stopCamera; }, []);

    if (capturedImage) return <div className="w-full flex flex-col items-center gap-4 animate-pop"><img src={capturedImage} className="w-full max-w-md rounded-xl border-4 border-black shadow-hard" /><div className="flex gap-4 w-full max-w-md"><FunButton onClick={() => {setCapturedImage(null); startCamera();}} color="red" icon={RefreshCw} className="flex-1">Refaire</FunButton><FunButton onClick={() => onCapture(capturedImage!)} color="green" icon={ArrowRight} className="flex-1">Envoyer</FunButton></div></div>;
    return <div className="w-full flex flex-col items-center gap-4"><div className="relative w-full max-w-md bg-black rounded-xl overflow-hidden border-4 border-black shadow-hard aspect-[4/3] flex items-center justify-center"><video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${isStreaming ? 'block' : 'hidden'}`} />{!isStreaming && !error && <Loader2 className="text-white animate-spin"/>}{error && <p className="text-white p-4">{error}</p>}</div><div className="flex flex-col gap-3 w-full max-w-md"><FunButton onClick={takePhoto} disabled={!isStreaming} color="purple" icon={Camera} className="w-full">Prendre Photo</FunButton><label className="cursor-pointer w-full"><div className="bg-white border-2 border-black border-dashed rounded-xl p-3 flex items-center justify-center gap-2 font-bold hover:bg-gray-50 text-gray-600"><Upload size={20} /> Galerie</div><input type="file" accept="image/*" onChange={handleUpload} className="hidden" /></label></div></div>;
};

export const DrawingCanvas = ({ initialImage, onSave, isReadOnly, guideImage }: any) => {
  const canvasRef = useRef<HTMLCanvasElement>(null); const containerRef = useRef<HTMLDivElement>(null);
  const [color, setColor] = useState('#000000'); const [brushSize, setBrushSize] = useState(8); const [isEraser, setIsEraser] = useState(false);
  const [dims, setDims] = useState({ w: 600, h: 450 });
  useLayoutEffect(() => { if(containerRef.current) { const w = Math.min(containerRef.current.offsetWidth, 800); setDims({ w, h: w*0.75 }); } }, []);
  useEffect(() => { const c = canvasRef.current, x = c?.getContext('2d'); if(c && x) { if(!initialImage) { x.fillStyle='#fff'; x.fillRect(0,0,c.width,c.height); } x.lineCap='round'; x.lineJoin='round'; if(initialImage) { const i = new Image(); i.onload=()=>x.drawImage(i,0,0,dims.w,dims.h); i.src=initialImage; } } }, [initialImage, dims]);
  
  const getPos = (e: any) => { const r = canvasRef.current!.getBoundingClientRect(), sx = canvasRef.current!.width/r.width, sy = canvasRef.current!.height/r.height, cx = e.touches?e.touches[0].clientX:e.clientX, cy = e.touches?e.touches[0].clientY:e.clientY; return { x: (cx-r.left)*sx, y: (cy-r.top)*sy }; };
  const draw = (e: any) => { if(isReadOnly || (e.buttons!==1 && e.type!=='touchmove')) return; if(e.cancelable) e.preventDefault(); const x = canvasRef.current?.getContext('2d'); const p = getPos(e); x?.lineTo(p.x, p.y); x?.stroke(); };
  const start = (e: any) => { if(isReadOnly) return; if(e.cancelable) e.preventDefault(); const x = canvasRef.current?.getContext('2d'); const p = getPos(e); x?.beginPath(); x?.moveTo(p.x, p.y); if(x) { x.strokeStyle = isEraser?'#fff':color; x.lineWidth = brushSize; } };
  
  return (
    <div className="flex flex-col gap-4 items-center w-full max-w-5xl mx-auto">
        <div ref={containerRef} className="relative w-full bg-white rounded-xl border-4 border-black shadow-hard-lg overflow-hidden" style={{height: dims.h}}>
            {guideImage && <div className="absolute inset-0 opacity-50 pointer-events-none"><img src={guideImage} className="w-full h-full object-cover"/></div>}
            <canvas ref={canvasRef} width={dims.w} height={dims.h} className={`touch-none ${isReadOnly?'':'cursor-crosshair'}`} onMouseDown={start} onMouseMove={draw} onTouchStart={start} onTouchMove={draw} onMouseUp={() => onSave(canvasRef.current!.toDataURL('image/jpeg', 0.4))} onTouchEnd={() => onSave(canvasRef.current!.toDataURL('image/jpeg', 0.4))} />
            {!isReadOnly && <button onClick={() => {const x=canvasRef.current!.getContext('2d'); x!.fillStyle='#fff'; x!.fillRect(0,0,dims.w,dims.h);}} className="absolute top-2 right-2 bg-red-100 p-2 rounded text-red-600"><Trash2/></button>}
        </div>
        {!isReadOnly && <div className="bg-white border-4 border-black rounded-2xl p-2 w-full flex flex-wrap justify-center gap-2"><button onClick={()=>setIsEraser(!isEraser)} className={`p-2 border-2 border-black rounded ${isEraser?'bg-red-500 text-white':'bg-gray-100'}`}>{isEraser?<Eraser/>:<Pencil/>}</button>{['#000000','#ff0000','#00ff00','#0000ff','#ffff00'].map(c=><button key={c} onClick={()=>{setColor(c); setIsEraser(false)}} className="w-8 h-8 rounded-full border-2 border-black" style={{backgroundColor:c}}/>)}</div>}
    </div>
  );
};