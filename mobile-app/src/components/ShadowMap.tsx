import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import * as THREE from "three";
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { shadowShaderMaterialDefault, buildingShaderMaterial, transparentShaderMaterial } from "@/components/shadersSombras";
import { Mapa2D } from "@/components/Mapa2D";

type ShadowMapProps = {
  //Foreground shadow overlay properties.
  chunkURL:string;
  azimuth:number;
  elevation:number;
  //Backgruond map properties.
  initialLat:number;
  initialLon:number;
  origen:{
    lat:number,
    lon:number
  }|null;
  destino:{
    lat:number,
    lon:number
  }|null;
  modoSeleccion:"origen"|"destino"|"solar";
  modoBusqueda:"lugar"|"ruta";
  onSeleccionarCoordenada:(lat:number, lon:number)=>void;
};//Sí, se que estoy rompiendo la encapsulación. Ya luego si eso.

const STYLES=StyleSheet.create({
    alignment_div:{
        width:"100%",
        height:0,
        margin:0,
        padding:0,
        overflow:"visible"
    },
    overflowing_div:{
        width:"100%",
        height:450,
        margin:0,
        padding:0
    }
});

const CAMERA_SIZE:number=500;

export function ShadowMap({ chunkURL, azimuth, elevation, initialLat, initialLon, origen, destino, modoSeleccion, modoBusqueda, onSeleccionarCoordenada }:ShadowMapProps){
    const [camera,setCamera]=useState<THREE.OrthographicCamera>(new THREE.OrthographicCamera(-CAMERA_SIZE,CAMERA_SIZE,CAMERA_SIZE,-CAMERA_SIZE));
    const [scene,setScene]=useState<THREE.Scene>(new THREE.Scene());
    const [_renderer,setRenderer]=useState<THREE.WebGLRenderer|null>(null);
    const [_context,setContext]=useState<WebGLRenderingContext|null>(null);
    const ref=useRef(null);
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
        let gltf;
        try{
            gltf=await loader.loadAsync(chunkURL);
        }
        catch{
            console.log("Failed to obtain chunk");
        }
        const meshes:THREE.BufferGeometry[]=[];
        if(gltf!==undefined)
            extractMeshes(gltf.scene,meshes);
        else 
            meshes.push(new THREE.BoxGeometry(100,100,100));//A cube, mainly for testing.
        const x=gl.drawingBufferHeight/gl.drawingBufferWidth
        const shadowMaterial=shadowShaderMaterialDefault(azimuth, elevation,x);
        const buildingMaterial=buildingShaderMaterial(x);
        meshes.forEach((mesh)=>{addToScene(scene,mesh,shadowMaterial,buildingMaterial)});
        addToScene(scene,new THREE.PlaneGeometry(CAMERA_SIZE,CAMERA_SIZE),transparentShaderMaterial(x));
        const aspectRatio=gl.drawingBufferWidth/gl.drawingBufferHeight;
        camera.left=-CAMERA_SIZE*aspectRatio;
        camera.right=CAMERA_SIZE*aspectRatio;
        setCamera(camera); 
        renderer.render(scene,camera);//Creo que los edificios están flotando
    }
    scene.add(camera);
    camera.position.set(0,0,100);
    camera.lookAt(new THREE.Vector3(0,0,0));
    console.log("ShadowMap");
    return (<div>
                <div style={STYLES.alignment_div}>
                    <div style={STYLES.overflowing_div}>
                        <Mapa2D
                            initialLat={initialLat}
                            initialLon={initialLon}
                            origen={origen}
                            destino={destino}
                            modoSeleccion={modoSeleccion}
                            modoBusqueda={modoBusqueda}
                            onSeleccionarCoordenada={onSeleccionarCoordenada}
                        />
                    </div>
                </div>    
                <div style={STYLES.alignment_div}>
                    <div style={STYLES.overflowing_div}>
                        <GLView
                            onContextCreate={onContextCreate}
                            style={StyleSheet.absoluteFill}
                        />
                    </div>
                </div>
            </div>
        );
}