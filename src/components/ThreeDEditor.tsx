import { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { Box, Eraser, Trash2 } from 'lucide-react';
import { FunButton } from './GameComponents'; // On réutilise le bouton

const DRAW_COLORS = ['#000000', '#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#78350f'];

const VoxelScene = ({ color, isEraser, onCaptureRef, cubes, setCubes }: any) => {
  const { gl, scene, camera } = useThree();

  useEffect(() => {
    onCaptureRef.current = () => {
      gl.render(scene, camera);
      return gl.domElement.toDataURL('image/jpeg', 0.6);
    };
  }, [gl, scene, camera, onCaptureRef]);

  const handleClick = (e: any) => {
    e.stopPropagation();
    if (e.delta > 10) return; // Si mouvement souris, pas de clic

    if (isEraser) {
      if (e.object.name === 'voxel') {
         setCubes((prev: any[]) => prev.filter((c) => c.id !== e.object.userData.id));
      }
    } else {
      const { point, face } = e;
      if (!point || !face) return;
      const pos = new THREE.Vector3().copy(point).add(face.normal).floor().addScalar(0.5);
      
      // Limites de la grille (-10 à 10)
      if (Math.abs(pos.x) > 10 || Math.abs(pos.z) > 10 || pos.y < 0 || pos.y > 20) return;

      const newCube = {
        id: Math.random().toString(36),
        position: [pos.x, pos.y, pos.z],
        color: color
      };
      setCubes((prev: any[]) => [...prev, newCube]);
    }
  };

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      <OrbitControls makeDefault maxPolarAngle={Math.PI / 2} />
      
      <group>
        <Grid position={[0, -0.01, 0]} args={[20, 20]} cellColor="#6b7280" sectionColor="#000000" sectionThickness={1.5} cellThickness={0.5} infiniteGrid fadeDistance={30} />
        
        {/* Sol invisible pour cliquer */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} onPointerUp={(e) => !isEraser && handleClick(e)}>
            <planeGeometry args={[20, 20]} />
            <meshBasicMaterial visible={false} />
        </mesh>

        {cubes.map((cube: any) => (
          <mesh 
            key={cube.id} 
            position={cube.position} 
            name="voxel"
            userData={{ id: cube.id }}
            onPointerUp={handleClick}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={cube.color} />
            <lineSegments>
              <edgesGeometry args={[new THREE.BoxGeometry(1, 1, 1)]} />
              <lineBasicMaterial color="black" linewidth={2} />
            </lineSegments>
          </mesh>
        ))}

        <mesh position={[0, -0.5, 0]} rotation={[-Math.PI/2, 0, 0]}>
            <planeGeometry args={[20, 20]} />
            <meshBasicMaterial color="#f3f4f6" opacity={0.5} transparent />
        </mesh>
      </group>
    </>
  );
};

export const ThreeDEditor = ({ onSave, isReadOnly }: { onSave: (data: string) => void, isReadOnly?: boolean }) => {
  const [color, setColor] = useState('#eab308');
  const [isEraser, setIsEraser] = useState(false);
  const [cubes, setCubes] = useState<any[]>([]);
  const captureRef = useRef<() => string>(() => '');

  return (
    <div className="flex flex-col gap-4 items-center w-full max-w-5xl mx-auto h-full">
       <div className="relative w-full flex-1 min-h-[300px] bg-gray-100 rounded-xl border-4 border-black shadow-hard-lg overflow-hidden">
          <div className="absolute top-2 left-2 z-10 bg-black/50 text-white text-[10px] px-2 py-1 rounded pointer-events-none">
             1 doigt: tourner • Tap: poser/gommer
          </div>
          
          <Canvas gl={{ preserveDrawingBuffer: true }} shadows camera={{ position: [5, 5, 5], fov: 50 }}>
             <Suspense fallback={null}>
                <VoxelScene 
                    color={color} 
                    isEraser={isEraser} 
                    onCaptureRef={captureRef} 
                    cubes={cubes} 
                    setCubes={setCubes} 
                />
             </Suspense>
          </Canvas>

          {!isReadOnly && (
            <button onClick={() => setCubes([])} className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-lg border-2 border-black shadow-sm">
                <Trash2 size={20}/>
            </button>
          )}
       </div>

       {!isReadOnly && (
         <div className="bg-white border-4 border-black rounded-2xl p-2 shadow-hard w-full">
            <div className="flex flex-col gap-2 items-center justify-center">
                <div className="flex gap-2 w-full justify-center">
                    <button onClick={() => setIsEraser(false)} className={`flex-1 p-2 rounded-xl border-2 border-black flex items-center justify-center gap-2 ${!isEraser ? 'bg-blue-500 text-white shadow-hard-sm' : 'bg-gray-100'}`}><Box size={20} /> Bloc</button>
                    <button onClick={() => setIsEraser(true)} className={`flex-1 p-2 rounded-xl border-2 border-black flex items-center justify-center gap-2 ${isEraser ? 'bg-red-500 text-white shadow-hard-sm' : 'bg-gray-100'}`}><Eraser size={20} /> Gomme</button>
                    <FunButton onClick={() => onSave(captureRef.current())} color="green" className="py-2 text-sm">FINI</FunButton>
                </div>
                <div className="grid grid-cols-10 gap-1 w-full">
                    {DRAW_COLORS.map((c) => (
                        <button key={c} onClick={() => { setColor(c); setIsEraser(false); }} className={`aspect-square rounded-full border-2 border-black ${color === c && !isEraser ? 'ring-2 ring-blue-400 scale-110 z-10' : ''}`} style={{ backgroundColor: c }} />
                    ))}
                </div>
            </div>
         </div>
       )}
    </div>
  );
};