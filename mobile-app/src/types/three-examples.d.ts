declare module 'three/examples/jsm/loaders/GLTFLoader.js' {
  import * as THREE from 'three';

  export type GLTF = {
    scene: THREE.Group;
  };

  export class GLTFLoader {
    parse(
      data: ArrayBuffer | string,
      path: string,
      onLoad: (gltf: GLTF) => void,
      onError?: (error: unknown) => void,
    ): void;
  }
}
