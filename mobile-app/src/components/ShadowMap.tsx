import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import * as THREE from "three";
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { shadowShaderMaterialDefault, buildingShaderMaterial } from "@/components/shadersSombras";
import { Mapa2D } from "@/components/Mapa2D";

type ShadowMapProps = {
  chunkURL: string;
  azimuth: number;
  elevation: number;
};

const CAMERA_SIZE:number=500;

export function ShadowMap({ chunkURL, azimuth, elevation }:ShadowMapProps){
    const [camera,setCamera]=useState<THREE.OrthographicCamera>(new THREE.OrthographicCamera(-CAMERA_SIZE,CAMERA_SIZE,CAMERA_SIZE,-CAMERA_SIZE));
    const [scene,setScene]=useState<THREE.Scene>(new THREE.Scene());
    const [_renderer,setRenderer]=useState<THREE.WebGLRenderer|null>(null);
    const [_context,setContext]=useState<WebGLRenderingContext|null>(null);
    function isMesh(obj:THREE.Object3D):boolean{
         try{
            return (obj as THREE.Mesh).isMesh;
        }catch{
            return false;
        }
    }
    function extractMeshes(obj:THREE.Object3D,array:THREE.BufferGeometry[]){
        if(isMesh(obj))
            array.push((obj as THREE.Mesh).geometry);
        else
            obj.children.forEach((child)=>extractMeshes(child,array));
    }
    function addToScene(scene:THREE.Scene,mesh:THREE.BufferGeometry,shadow:THREE.Material,building?:THREE.Material){
        scene.add(new THREE.Mesh(mesh, shadow));
        if(building !== undefined)
            scene.add(new THREE.Mesh(mesh, building));
    }
    async function onContextCreate(gl:ExpoWebGLRenderingContext){
        const context:WebGLRenderingContext=gl as WebGLRenderingContext;
        setContext(context);
        if(context===null){
            console.error("Failed to obtain context.");
            return;
        }
        const canvas:HTMLCanvasElement=context.canvas as HTMLCanvasElement;
        const renderer=new THREE.WebGLRenderer({
            canvas:canvas,
            context:context
        });
        setRenderer(renderer);
        if(renderer===null){
            console.error("Failed to obtain renderer.");
            return;
        }
        const loader=new GLTFLoader();
        const gltf=await loader.loadAsync(chunkURL);
        const bounds = new THREE.Box3().setFromObject(gltf.scene);
        const ground=bounds.min.y;
        const meshes:THREE.BufferGeometry[]=[];
        extractMeshes(gltf.scene,meshes);
        const shadowMaterial=shadowShaderMaterialDefault(azimuth, elevation);
        meshes.forEach((mesh)=>{addToScene(scene,mesh,shadowMaterial,buildingShaderMaterial)});
        //scene.add(new THREE.Mesh(new THREE.BoxGeometry(50,50,50),new THREE.MeshBasicMaterial({color:"#FFFFFF"})))
        renderer.render(scene,camera);
    }
    scene.background=new THREE.Color(0,0,255);
    scene.add(camera);
    camera.position.set(0,0,100);
    camera.lookAt(new THREE.Vector3(0,0,0));
    console.log("ShadowMap");
    return (<GLView onContextCreate={onContextCreate} style={StyleSheet.absoluteFill}></GLView>);
}