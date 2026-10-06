import { OrbitControls } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';

import { useTheme } from '@/hooks/use-theme';
import type { SolarPosition, SunDirection } from '@/utils/solar-position';
import { projectCubeShadow } from '@/utils/shadow-geometry';

const CUBE_SIZE = 1;
const DEFAULT_DIRECTION: SunDirection = {
  x: 0.6,
  y: 0.72,
  z: 0.35,
};

type SolarSceneContentProps = {
  solarPosition: SolarPosition | null;
};

export function SolarSceneContent({ solarPosition }: SolarSceneContentProps) {
  const theme = useTheme();
  const hasSunlight = solarPosition?.isAboveHorizon ?? false;
  const sunDirection = hasSunlight ? solarPosition.direction : DEFAULT_DIRECTION;
  const lightPosition: [number, number, number] = [
    sunDirection.x * 4,
    sunDirection.y * 4,
    sunDirection.z * 4,
  ];

  const shadowShape = useMemo(() => {
    if (!solarPosition?.isAboveHorizon) return null;

    const points = projectCubeShadow(solarPosition.direction, CUBE_SIZE);
    if (points.length < 3) return null;

    const shape = new THREE.Shape();
    shape.moveTo(points[0].x, -points[0].z);
    for (const point of points.slice(1)) {
      shape.lineTo(point.x, -point.z);
    }
    shape.closePath();
    return shape;
  }, [solarPosition]);

  return (
    <>
      <color attach="background" args={[theme.background]} />
      <ambientLight
        color={hasSunlight ? '#fff8ed' : '#8aa4c8'}
        intensity={hasSunlight ? 0.55 : 0.24}
      />
      <directionalLight
        castShadow
        color={hasSunlight ? '#fff1cf' : '#7894bd'}
        intensity={hasSunlight ? 2.2 : 0.35}
        position={lightPosition}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial
          color={theme.backgroundElement}
          roughness={0.9}
          metalness={0}
        />
      </mesh>

      <gridHelper
        args={[6, 12, theme.textSecondary, theme.backgroundSelected]}
        position={[0, 0.008, 0]}
      />

      <mesh castShadow receiveShadow position={[0, CUBE_SIZE / 2, 0]}>
        <boxGeometry args={[CUBE_SIZE, CUBE_SIZE, CUBE_SIZE]} />
        <meshStandardMaterial color="#4d82d9" roughness={0.68} metalness={0.05} />
      </mesh>

      {shadowShape && (
        <mesh
          position={[0, 0.014, 0]}
          renderOrder={1}
          rotation={[-Math.PI / 2, 0, 0]}>
          <shapeGeometry args={[shadowShape]} />
          <meshBasicMaterial
            color="#101820"
            depthWrite={false}
            opacity={0.52}
            side={THREE.DoubleSide}
            transparent
          />
        </mesh>
      )}

      <OrbitControls
        enableDamping
        enablePan={false}
        maxDistance={7}
        minDistance={2}
        target={[0, 0.45, 0]}
      />
    </>
  );
}
