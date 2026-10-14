/*import { StyleSheet, Text, View, TextInput, Button, Switch } from 'react-native';
import { useState } from 'react';

// Simplified solar position calculation
function calculateSunPosition(date: Date, latitude: number, longitude: number) {
  // Convert to radians
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  // Julian date calculation
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 0-11 to 1-12
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();

  // Calculate Julian Date
  const JulianDate =
    367 * year
    - Math.floor((7 * (year + Math.floor((month + 9) / 12))) / 4)
    + Math.floor((275 * month) / 9)
    + day
    + 1721013.5
    + ((hour + minute / 60) / 24)
    - 0.5 * Math.sign(100 * year + month - 190002.5)
    + 0.5;

  // Days since J2000.0
  const n = JulianDate - 2451545.0;

  // Mean longitude of the sun
  const L = 280.460 + 0.9856474 * n;
  const L_norm = L % 360;

  // Mean anomaly of the sun
  const g = 357.528 + 0.9856003 * n;
  const g_rad = toRad(g % 360);

  // Ecliptic longitude of the sun
  const lambda = L_norm + 1.915 * Math.sin(g_rad) + 0.020 * Math.sin(2 * g_rad);

  // Obliquity of the ecliptic
  const epsilon = 23.439 - 0.0000004 * n;

  // Right ascension and declination
  const alpha = Math.atan2(Math.cos(toRad(epsilon)) * Math.sin(toRad(lambda)), Math.cos(toRad(lambda)));
  const delta = Math.asin(Math.sin(toRad(epsilon)) * Math.sin(toRad(lambda)));

  // Greenwich mean sidereal time
  const GMST = 6.697375 + 0.0657098242 * n + hour;
  const GMST_deg = (GMST % 24) * 15;

  // Local hour angle
  const LHA = (GMST_deg + longitude - L_norm) % 360;
  const LHA_rad = toRad(LHA);

  // Latitude in radians
  const lat_rad = toRad(latitude);

  // Solar elevation (altitude)
  const elevation_rad = Math.asin(
    Math.sin(delta) * Math.sin(lat_rad) +
    Math.cos(delta) * Math.cos(lat_rad) * Math.cos(LHA_rad)
  );

  // Solar azimuth
  const azimuth_rad = Math.acos(
    (Math.sin(delta) - Math.sin(elevation_rad) * Math.sin(lat_rad)) /
    (Math.cos(elevation_rad) * Math.cos(lat_rad))
  );

  // Adjust azimuth based on hour angle
  const azimuth = LHA_rad > 0 ? toDeg(azimuth_rad) : 360 - toDeg(azimuth_rad);

  return {
    elevation: toDeg(elevation_rad),
    azimuth: azimuth
  };
}

export default function SolarCalculatorScreen() {
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [result, setResult] = useState(null);
  const [calculating, setCalculating] = useState(false);

  const handleCalculate = () => {
    try {
      const lat = parseFloat(latitude);
      const lon = parseFloat(longitude);

      if (isNaN(lat) || isNaN(lon)) {
        alert('Por favor ingrese coordenadas válidas');
        return;
      }

      if (lat < -90 || lat > 90) {
        alert('La latitud debe estar entre -90 y 90 grados');
        return;
      }

      if (lon < -180 || lon > 180) {
        alert('La longitud debe estar entre -180 y 180 grados');
        return;
      }

      // Combine date and time
      const combinedDate = new Date(date);
      combinedDate.setHours(time.getHours(), time.getMinutes(), 0, 0);

      setCalculating(true);
      const position = calculateSunPosition(combinedDate, lat, lon);
      setResult(position);
      setCalculating(false);
    } catch (error) {
      alert('Error en el cálculo: ' + error.message);
      setCalculating(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Calculadora de Posición Solar</Text>
        <Text style={styles.subtitle}>Ingrese fecha, hora y ubicación</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Fecha:</Text>
          <TextInput
            style={styles.input}
            value={date.toISOString().split('T')[0]}
            onChangeText={(text) => {
              const newDate = new Date(text);
              if (!isNaN(newDate.getTime())) setDate(newDate);
            }}
            placeholder="YYYY-MM-DD"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Hora:</Text>
          <TextInput
            style={styles.input}
            value={time.toTimeString().slice(0, 5)}
            onChangeText={(text) => {
              const [hours, minutes] = text.split(':');
              const newDate = new Date(time);
              newDate.setHours(parseInt(hours) || 0, parseInt(minutes) || 0, 0, 0);
              if (!isNaN(newDate.getTime())) setTime(newDate);
            }}
            placeholder="HH:MM"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Latitud (°):</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={latitude}
            onChangeText={setLatitude}
            placeholder="-90 a 90"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Longitud (°):</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={longitude}
            onChangeText={setLongitude}
            placeholder="-180 a 180"
          />
        </View>

        <Button
          title={calculating ? 'Calculando...' : 'Calcular Posición Solar'}
          onPress={handleCalculate}
          disabled={calculating}
          color="#0066cc"
        />
      </View>

      {result && (
        <View style={styles.results}>
          <Text style={styles.resultsTitle}>Resultados:</Text>
          <View style={styles.resultItem}>
            <Text style={styles.resultLabel}>Altura solar:</Text>
            <Text style={styles.resultValue}>{result.elevation.toFixed(2)}°</Text>
          </View>
          <View style={styles.resultItem}>
            <Text style={styles.resultLabel}>Acimut solar:</Text>
            <Text style={styles.resultValue}>{result.azimuth.toFixed(2)}°</Text>
          </View>
          <View style={styles.resultItem}>
            <Text style={styles.resultLabel}>Posición:</Text>
            <Text style={styles.resultValue}>
              {result.elevation >= 0 ? 'Por encima del horizonte' : 'Por debajo del horizonte'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  form: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  results: {
    marginTop: 30,
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  resultLabel: {
    fontSize: 16,
    color: '#666',
  },
  resultValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
});*/
import { useEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import { BoxGeometry, Color, DirectionalLight, Matrix4, Mesh, MeshBasicMaterial, Object3D, PerspectiveCamera, PlaneGeometry, Scene, ShadowMaterial, Vector3, WebGLRenderer } from "three";
import { BasicShadowMap, MeshLambertMaterial } from "three";
//I've chosen this for the docs say it performs better. I think that's what Galileo would do.
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
//Voy a hacer algo que no debería, y a documentar con comentarios.
//Ya lo pondré bonito luego.

const PORT=3000;
const ZERO_VEC3=new Vector3(0, 0, 0);
const ROT_MATRIX=new Matrix4(1, 0, 0, 0,
                             0, 0, 1, 0,
                             0,-1, 0, 0,
                             0, 0, 0, 1 );

const styles=StyleSheet.create({
  black100:{
    width:"100%",
    height:"100%",
    backgroundColor:"#FF0000"
  }
});

//Returns elem if not null. Raises an exception if null;
function checkNullElem(elem:Element|null):Element{
  if(elem===null)
    throw new Error("Element was null");
  return elem;
}

//Returns the vector given by the polar coordinates (r,theta,phi)
//This function uses the mathmatics convention for spherical coordinates.
function vectorFromSpherical(r:number,theta:number,phi:number):Vector3{
  return new Vector3(
    r*Math.cos(theta)*Math.sin(phi),
    r*Math.sin(theta)*Math.sin(phi),
    r*Math.cos(phi)
  );
}
//React component for the scene. We may need to change its name.
function ShadowScene(){
  //All of the camera configuration. These values are to be fine-tuned to get the best result.
  function getCamera(_div:Element|null):PerspectiveCamera{
    //I've set all parameters but aspect to their respective defaults. https://threejs.org/docs/#PerspectiveCamera
    const div:Element=checkNullElem(_div);
    const fov=50;//Field of view
    const aspect=div.clientWidth/div.clientHeight;//Aspect ratio
    const near=0.1;//Near clipping plane
    const far=2000;//Far clipping plane
    const camera=new PerspectiveCamera(fov,aspect,near,far);
    //Initial state of the camera.
    camera.position.set(0, 5, 5);
    camera.lookAt(ZERO_VEC3);
    return camera;
  }
  //All of the renderer configuration. Hopefully, we don't need to touch this.
  function getRenderer(_div:Element|null, _cnv:Element|null):WebGLRenderer{
    const div:Element=checkNullElem(_div);
    const cnv:Element=checkNullElem(_cnv);
    const renderer=new WebGLRenderer({canvas: cnv});
    renderer.setSize(div.clientWidth,div.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=BasicShadowMap;
    return renderer;
  }
  //Orbit controls. The speeds may need to be changed.
  function getControls(camera:PerspectiveCamera,renderer:WebGLRenderer){
    const controls=new OrbitControls(camera,renderer.domElement);
    //Movement speed.
    controls.panSpeed=0.5;
    controls.rotateSpeed=0.5;
    controls.zoomSpeed=0.5;
    //Caps how low the camera can go so it doesn't end up undergruond.
    controls.maxPolarAngle=Math.PI/2;
    return controls;
  }
  //A cube mainly for testing
  function getCube(scene:Scene):Object3D{
    const geometry:BoxGeometry=new BoxGeometry(4, 2, 2);
    const material:MeshLambertMaterial=new MeshBasicMaterial({color:"#00FF00"});
    const mesh:Mesh=new Mesh(geometry,material);
    const obj:Object3D=new Object3D();
    obj.add(mesh);
    scene.add(obj);
    //Translating the cube so it isn't clipping through the floor.
    obj.applyMatrix4(new Matrix4(1, 0, 0, 0,
                                 0, 1, 0, 0,
                                 0, 0, 1, 1,
                                 0, 0, 0, 1 ));
    obj.applyMatrix4(ROT_MATRIX);    
    mesh.castShadow=true;
    mesh.recieveShadow=true;
    return obj;
  }
  //Gets a model. It's completly broken by the way.
  function getModel(){
    const loader:GLTFLoader=new GLTFLoader();
    //For whatever reason, the example is returning a 404, crashing the app in the process. 
    const gltf=loader.loadAsync("http://localhost:3000/chunk?lat=40.4168&lon=-3.7038");//This is asyncronous. It'll probably come to bite us in the butt later.
//  //I've hadrcoded the port to try to get something.
    //This one fails too. I've ensured it exists and is written accoring to the specification.
//    const gltf=loader.loadAsync("http://localhost:3000/tiles/16/24711/32093");
    if(gltf===null)
      throw new Error("gltf was null");
    else if(gltf===undefined)
      throw new Error("gltf was undefined");
    return gltf.scene;
  }
  //Gets the floor plane.
  function getPlane(scene:Scene):Object3D{
    const geometry:PlaneGeometry=new PlaneGeometry(100,100);
    const material:MeshLambertMaterial=new MeshBasicMaterial({color:"#0000FF"});
    const mesh:Mesh=new Mesh(geometry, material);
    const obj:Object3D=new Object3D();
    obj.add(mesh);
    scene.add(obj);
    obj.applyMatrix4(ROT_MATRIX);   
    mesh.castShadow=true;
    mesh.recieveShadow=true;
    return obj;
  }
  //Return a new light pointing in the angle passed through theta and phi
  //after adding it to the scene.
  //This method follows the mathematics convention for spherical coordinates.
  //This method will also add the light's target to the scene.
  function getLight(scene:Scene, theta:number, phi:number):DirectionalLight{
    const light=new DirectionalLight("#FFFFFF", 1);
    const target=new Object3D();
    target.position.set(vectorFromSpherical(1,theta,phi));
    scene.add(light);
    scene.add(target);//This looks like a leak waiting to happen
    light.target=target;
    target.applyMatrix4(ROT_MATRIX);
    light.castShadow=true;
    light.shadow.camera.near=0.1;
    light.shadow.camera.far=10000;
    light.shadow.camera.left=-100;
    light.shadow.camera.right=100;
    light.shadow.camera.bottom=-100;
    light.shadow.camera.top=100;
    return light;
  }
  //Chapuza. Updates the renderer. If null, creates it.
  function click(){
    //console.log("click");
    let camera:PerspectiveCamera;
    let renderer:WebGLRenderer;
    let controls:OrbitControls;
    if(_camera===null)
      setCamera(camera=getCamera(ref.current));
    else
      camera=_camera;
    if(_renderer===null)
      setRenderer(renderer=getRenderer(ref.current,cnv.current));
    else
      renderer=_renderer;
    if(_controls===null)
      setControls(controls=getControls(camera,renderer));
    else
      controls=_controls;
    controls.update();
    renderer.render(scene,camera);
  }

  //Handles window resizing;
  function resize(){
    setCamera(null);
    setRenderer(null);
    setControls(null);
    click();
  }

  const ref=useRef<HTMLDivElement|null>(null);//1
  const cnv=useRef<HTMLCanvasElement|null>(null);//2
  //
  const div=(<div ref={ref} onClick={()=>click()}  style={styles.black100} onMouseMove={()=>click()} onWheel={()=>click()} onResize={()=>resize()}>
      <canvas ref={cnv}></canvas>
    </div>);
  const [firstPass,setFirstPass]:[boolean,any]=useState<boolean>(true);//3
  const [scene,setScene]:[Scene,any]=useState<Scene>(new Scene());//4
  const [_camera,setCamera]:[PerspectiveCamera|null,any]=useState<PerspectiveCamera|null>(null);//5
  const [_renderer,setRenderer]:[WebGLRenderer|null,any]=useState<WebGLRenderer|null>(null);//6
  const [_controls,setControls]:[OrbitControls|null,any]=useState<OrbitControls|null>(null);//7
  const [cube,setCube]:[Object3D,any]=useState<Object3D>(getCube(scene));//8
  const [light,setLight]:[DirectionalLight,any]=useState<DirectionalLight>(getLight(scene,0,Math.PI/4));//9
  const [plane,setPlane]:[Mesh,any]=useState<Mesh>(getPlane(scene));//10
  useEffect(()=>{
    window.addEventListener("resize",resize);
    return ()=>{window.removeEventListener("resize",resize);};
  },[]);
  //scene.add(getShadowPlane());
  //scene.add(getModel());
  scene.background=new Color("#000000");
  if(firstPass){
    setFirstPass(false);
    setScene(scene);
  }
  return div;
}

export default function Main(){
    const cnv=(<ShadowScene></ShadowScene>);
    return cnv;
}

/*
NOTAS:

El cubo y el plano se dibujan correctamente.

Las sombras no se dibujan. Creo que es un problema de cómo están configurados los
elementos de la escena, pero no sé por qué otro lado atacarlo.

Hay que pasar el ratón para que empiece a dibujar. No ha conseguido que funcione onLoad
(tal vez se pueda hacer con un poco de JavaScript asíncrono).

Los controles de la cámara funcionan. No se permite meter la cámara bajo el suelo.
Para conseguir esto, hay que rotar todos los objectos de la escena mediante 
object.applyMatrix4(ROT_MATRIX)
donde object es un objeto de la escena.

En los comentarios viene qué hace cada cosa más o menos. Ya lo pondré en bonito luego.

He dejado el código original comentado. Por si las moscas.
*/