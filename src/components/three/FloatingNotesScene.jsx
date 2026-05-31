import { Float, Text } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

function Notebook({ position = [0, 0, 0], rotation = [0, 0, 0], color = "#78ded0", scale = 1 }) {
  return (
    <Float speed={1.3} rotationIntensity={0.18} floatIntensity={0.28}>
      <group position={position} rotation={rotation} scale={scale}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.18, 0.08, 1.48]} />
          <meshStandardMaterial color={color} roughness={0.58} metalness={0.03} />
        </mesh>
        <mesh position={[0.03, 0.055, 0.02]} castShadow>
          <boxGeometry args={[1.04, 0.035, 1.32]} />
          <meshStandardMaterial color="#fffaf0" roughness={0.76} />
        </mesh>
        <mesh position={[-0.54, 0.1, 0]} castShadow>
          <boxGeometry args={[0.035, 0.09, 1.36]} />
          <meshStandardMaterial color="#0f766e" roughness={0.48} />
        </mesh>
        <mesh position={[0.2, 0.13, -0.22]} rotation={[0, 0, -0.12]}>
          <boxGeometry args={[0.52, 0.018, 0.035]} />
          <meshStandardMaterial color="#d7a760" roughness={0.42} />
        </mesh>
      </group>
    </Float>
  );
}

function PaperStack({ position = [0, 0, 0], rotation = [0, 0, 0], scale = 1 }) {
  return (
    <Float speed={1.05} rotationIntensity={0.12} floatIntensity={0.18}>
      <group position={position} rotation={rotation} scale={scale}>
        {[0, 1, 2].map((sheet) => (
          <mesh key={sheet} position={[sheet * 0.035, sheet * 0.025, sheet * -0.015]} castShadow receiveShadow>
            <boxGeometry args={[1.05, 0.025, 1.28]} />
            <meshStandardMaterial color={sheet === 0 ? "#f8fbfa" : "#eaf3f0"} roughness={0.72} />
          </mesh>
        ))}
      </group>
    </Float>
  );
}

function Pen({ position = [0, 0, 0], rotation = [0, 0, 0], color = "#17211f" }) {
  return (
    <Float speed={1.6} rotationIntensity={0.2} floatIntensity={0.2}>
      <group position={position} rotation={rotation}>
        <mesh castShadow>
          <cylinderGeometry args={[0.035, 0.035, 1.05, 20]} />
          <meshStandardMaterial color={color} roughness={0.35} metalness={0.12} />
        </mesh>
        <mesh position={[0, 0.58, 0]} castShadow>
          <coneGeometry args={[0.05, 0.16, 20]} />
          <meshStandardMaterial color="#d7a760" roughness={0.38} metalness={0.18} />
        </mesh>
      </group>
    </Float>
  );
}

function SoftParticles({ count = 54, color = "#72d7c9" }) {
  const points = useRef(null);
  const positions = useMemo(() => {
    const items = new Float32Array(count * 3);

    for (let index = 0; index < count; index += 1) {
      items[index * 3] = (Math.random() - 0.5) * 7.8;
      items[index * 3 + 1] = (Math.random() - 0.5) * 4.5;
      items[index * 3 + 2] = (Math.random() - 0.5) * 4.8;
    }

    return items;
  }, [count]);

  useFrame((_, delta) => {
    if (!points.current) return;
    points.current.rotation.y += delta * 0.035;
    points.current.rotation.x += delta * 0.012;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color={color} size={0.035} transparent opacity={0.45} sizeAttenuation depthWrite={false} />
    </points>
  );
}

function WorkspaceLabel() {
  return (
    <Float speed={1.1} rotationIntensity={0.08} floatIntensity={0.12}>
      <Text
        position={[0, 0.58, -0.26]}
        rotation={[-0.26, 0, 0]}
        fontSize={0.34}
        letterSpacing={0}
        color="#f8fbfa"
        anchorX="center"
        anchorY="middle"
      >
        Noted
      </Text>
    </Float>
  );
}

function AuthScene() {
  return (
    <>
      <SoftParticles count={70} />
      <Notebook position={[-1.35, 0.34, 0]} rotation={[0.24, -0.35, -0.18]} color="#78ded0" scale={1.05} />
      <Notebook position={[1.18, -0.52, -0.18]} rotation={[0.42, 0.36, 0.28]} color="#f4c873" scale={0.78} />
      <PaperStack position={[0.2, -0.08, 0.24]} rotation={[0.3, 0.1, -0.12]} scale={0.92} />
      <Pen position={[1.48, 0.52, 0.2]} rotation={[0.9, 0.2, -0.72]} color="#15211e" />
    </>
  );
}

function EmptyScene() {
  return (
    <>
      <SoftParticles count={42} color="#d7a760" />
      <Notebook position={[0, -0.12, 0]} rotation={[0.32, -0.28, 0.02]} color="#7dded3" scale={1.12} />
      <PaperStack position={[0.26, 0.02, 0.08]} rotation={[0.32, -0.12, -0.14]} scale={0.82} />
      <Pen position={[0.78, 0.42, 0.24]} rotation={[0.95, 0.15, -0.6]} color="#0f766e" />
    </>
  );
}

function DashboardScene() {
  return (
    <>
      <SoftParticles count={48} />
      <mesh position={[0, -0.55, -0.35]} rotation={[-0.18, 0, 0]} receiveShadow>
        <boxGeometry args={[3.4, 0.08, 1.8]} />
        <meshStandardMaterial color="#17211f" roughness={0.62} metalness={0.05} />
      </mesh>
      <Notebook position={[-0.82, -0.2, 0.04]} rotation={[0.28, -0.22, -0.12]} color="#78ded0" scale={0.76} />
      <Notebook position={[0.82, -0.14, 0.08]} rotation={[0.32, 0.26, 0.1]} color="#f2cf7b" scale={0.68} />
      <PaperStack position={[0, -0.02, 0.18]} rotation={[0.28, 0.04, 0.04]} scale={0.62} />
      <Pen position={[1.28, 0.1, 0.26]} rotation={[0.92, 0.2, -0.68]} color="#edf7f4" />
      <WorkspaceLabel />
    </>
  );
}

function SceneContent({ variant }) {
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 4, 3]} intensity={1.25} castShadow />
      <pointLight position={[-2.8, 1.8, 2.5]} intensity={0.62} color="#72d7c9" />
      <pointLight position={[2.4, -1.4, 1.5]} intensity={0.38} color="#f5c06f" />
      {variant === "empty" ? <EmptyScene /> : variant === "dashboard" ? <DashboardScene /> : <AuthScene />}
    </>
  );
}

export default function FloatingNotesScene({ variant = "auth", className = "" }) {
  return (
    <div className={`three-scene three-scene-${variant} ${className}`} aria-hidden="true">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0, 0.25, 4.6], fov: 38 }}
        gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["transparent"]} />
        <SceneContent variant={variant} />
      </Canvas>
    </div>
  );
}
