import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";

type DemoSceneProps = {
  quality?: number;
};

export function DemoScene({ quality = 0.75 }: DemoSceneProps) {
  const group = useRef<Group>(null);
  const hero = useRef<Mesh>(null);
  const amount = Math.max(12, Math.round(12 + quality * 30));
  const objects = useMemo(
    () =>
      Array.from({ length: amount }, (_, index) => {
        const angle = (index / amount) * Math.PI * 2;
        const radius = 2.4 + (index % 4) * 0.38;
        return {
          position: [
            Math.cos(angle) * radius,
            ((index % 7) - 3) * 0.34,
            Math.sin(angle) * radius,
          ] as [number, number, number],
          scale: 0.09 + (index % 5) * 0.025,
          color: index % 3 === 0 ? "#55e6bb" : index % 3 === 1 ? "#269cff" : "#a87cff",
        };
      }),
    [amount],
  );

  useFrame((state, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * 0.12;
      group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.25) * 0.08;
    }
    if (hero.current) {
      hero.current.rotation.x += delta * 0.22;
      hero.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <>
      <color attach="background" args={["#070b12"]} />
      <fog attach="fog" args={["#070b12", 6, 16]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 3]} intensity={2.2} color="#c7e8ff" />
      <pointLight position={[-4, -1, -2]} intensity={35} color="#55e6bb" distance={9} />
      <group ref={group}>
        <mesh ref={hero} castShadow>
          <torusKnotGeometry args={[0.92, 0.26, 160, 24]} />
          <meshStandardMaterial color="#269cff" roughness={0.2} metalness={0.72} />
        </mesh>
        {objects.map((object, index) => (
          <mesh key={index} position={object.position} scale={object.scale}>
            <icosahedronGeometry args={[1, quality > 0.66 ? 2 : 1]} />
            <meshStandardMaterial
              color={object.color}
              roughness={0.32}
              metalness={0.55}
            />
          </mesh>
        ))}
      </group>
      <mesh position={[0, -2.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[7, 96]} />
        <meshStandardMaterial color="#0b1420" roughness={0.86} metalness={0.12} />
      </mesh>
    </>
  );
}
