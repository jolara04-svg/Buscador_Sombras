import {useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Pressable,StyleSheet,Text,View} from 'react-native';
import Slider from '@react-native-community/slider';
import {BACKEND_URL} from '@/constants/backend';
import {buildRouteRequest,fetchRoute,DEFAULT_SHADE_PREFERENCE,type CalculatedRoute,type MapRoutes,type RouteMode,type RoutePoint} from './route-api';
import {routeComparisonText} from './route-comparison';

type Props={origin: RoutePoint|null; destination: RoutePoint|null; date: string; time: string; contextKey: string; onChange: (routes: MapRoutes|null)=>void};
export function RouteControls({origin,destination,date,time,contextKey,onChange}: Props) {
  const [preference,setPreference]=useState(DEFAULT_SHADE_PREFERENCE*100);
  const [fastest,setFastest]=useState<CalculatedRoute|null>(null);
  const [shaded,setShaded]=useState<CalculatedRoute|null>(null);
  const [selected,setSelected]=useState<RouteMode>('shade');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const controller=useRef<AbortController|null>(null),requestId=useRef(0);
  useEffect(()=>()=>{requestId.current++;controller.current?.abort();},[]);
  const cancel=()=>{requestId.current++;controller.current?.abort();setBusy(false);};
  async function calculate() {
    if (!origin||!destination) return;
    cancel();const id=requestId.current,abort=new AbortController();controller.current=abort;
    let timedOut=false;const timer=setTimeout(()=>{timedOut=true;abort.abort();},125000);
    setBusy(true);setError('');setFastest(null);setShaded(null);onChange(null);
    try {
      const request=buildRouteRequest(origin,destination,date,time,'fastest',preference/100);
      const quick=await fetchRoute(BACKEND_URL,request,abort.signal);
      if (id!==requestId.current) return;
      setFastest(quick);setSelected('fastest');onChange({contextKey,fastest:quick,shaded:null,selected:'fastest'});
      try {
        const shadow=await fetchRoute(BACKEND_URL,{...request,mode:'shade'},abort.signal);
        if (id!==requestId.current) return;
        const measured=shadow.comparison?.fastest?{...quick,...shadow.comparison.fastest,shadow:shadow.shadow}:quick;
        setFastest(measured);setShaded(shadow);setSelected('shade');onChange({contextKey,fastest:measured,shaded:shadow,selected:'shade'});
      } catch (cause) {
        if (id===requestId.current) setError(`La ruta rápida sigue disponible. ${timedOut?'La consulta de sombra ha tardado demasiado.':cause instanceof Error?cause.message:'No se pudo calcular la alternativa con sombra.'}`);
      }
    } catch (cause) {
      if (id===requestId.current) setError(timedOut?'El cálculo ha tardado demasiado. Vuelve a intentarlo.':cause instanceof Error?cause.message:'No se pudo conectar con el servidor.');
    } finally {clearTimeout(timer);if (id===requestId.current) setBusy(false);}
  }
  function choose(mode: RouteMode) {setSelected(mode);onChange({contextKey,fastest,shaded,selected:mode});}
  function card(route: CalculatedRoute|null,mode: RouteMode,label: string) {
    if (!route) return null;
    return <Pressable accessibilityRole="button" accessibilityLabel={`Ver ruta ${label}`} accessibilityState={{selected:selected===mode}} onPress={()=>choose(mode)} style={[styles.card,selected===mode&&styles.active]}>
      <Text style={[styles.cardTitle,{color:mode==='fastest'?'#1677b7':'#258443'}]}>{label}</Text>
      <Text>{route.durationSeconds>0?Math.max(1,Math.ceil(route.durationSeconds/60)):0} min · {Math.round(route.lengthM)} m</Text>
      {route.shadeFraction!==null&&<Text style={styles.note}>{route.shadow.provider==='night'?'Sin sol en esta franja':`${Math.round(route.shadeFraction*100)} % del recorrido en sombra`}</Text>}
    </Pressable>;
  }
  return <View style={styles.panel}>
    <Text style={styles.title}>Rutas a pie</Text>
    <Text>Preferencia de sombra: {preference} %</Text>
    <Slider accessibilityLabel="Preferencia de sombra" minimumValue={0} maximumValue={100} step={5} value={preference}
      // onValueChange={value=>{cancel();setPreference(value);setFastest(null);setShaded(null);setError('');onChange(null);}} minimumTrackTintColor="#258443" />
      onValueChange={value=>{cancel();setPreference(value);setFastest(null);setShaded(null);setError('');onChange(null);}}
      minimumTrackTintColor="#0066cc"
      maximumTrackTintColor="#ddd"
      thumbTintColor="#0066cc" /> 
    <Text style={styles.note}>0 %: menor distancia · 100 %: menos metros al sol. La preferencia no garantiza un porcentaje de sombra.</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Calcular rutas a pie" disabled={!origin||!destination||busy} onPress={calculate} style={[styles.calculate,(!origin||!destination||busy)&&styles.disabled]}>
      <Text style={styles.calculateText}>{busy?'Calculando rutas…':'Calcular rutas'}</Text>
    </Pressable>
    {busy&&<View style={styles.loading}><ActivityIndicator size="small"/><Text>{fastest?'Buscando alternativa con sombra…':'Buscando el recorrido más rápido…'}</Text></View>}
    <View style={styles.cards}>{card(fastest,'fastest','Más rápida')}{card(shaded,'shade','Prioridad a la sombra')}</View>
    {shaded&&!!routeComparisonText(shaded)&&<Text style={styles.note} accessibilityLiveRegion="polite">{routeComparisonText(shaded)}</Text>}
    {!!error&&<Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
    {shaded&&shaded.shadow.provider!=='not-evaluated'&&<Text style={styles.note}>Sombra estimada para esta franja, hasta las {new Date(shaded.nextRecalculateAt).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}. Actualiza el cálculo después.</Text>}
    {fastest&&<Text style={styles.note}>Caminos disponibles en Ciudad Universitaria. Los accesos de los marcadores al camino se muestran discontinuos y no están validados.</Text>}
  </View>;
}
const styles=StyleSheet.create({
  // panel:{marginHorizontal:15,marginBottom:12,padding:15,backgroundColor:'#fff',borderRadius:10,gap:8},
  panel:{padding:15,backgroundColor:'#fff',borderRadius:10,gap:8},
  title:{fontSize:17,fontWeight:'600',color:'#333'},note:{fontSize:12,color:'#666',lineHeight:17},
  // calculate:{backgroundColor:'#1d7050',borderRadius:8,padding:12,alignItems:'center'},calculateText:{color:'#fff',fontWeight:'600'},disabled:{opacity:.45},
  calculate:{backgroundColor:'#0066cc',borderRadius:8,padding:12,alignItems:'center'},calculateText:{color:'#fff',fontWeight:'600'},disabled:{opacity:.45},
  loading:{flexDirection:'row',alignItems:'center',gap:8},cards:{flexDirection:'row',flexWrap:'wrap',gap:8},
  card:{flexGrow:1,flexBasis:180,padding:12,borderWidth:1,borderColor:'#ddd',borderRadius:8,gap:4},active:{borderColor:'#258443',backgroundColor:'#eef8f0'},cardTitle:{fontWeight:'600'},error:{color:'#a13b30',fontSize:13,lineHeight:18},
});
