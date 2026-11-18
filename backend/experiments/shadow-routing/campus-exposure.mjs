// Campo sintetico, suave en el espacio y distinto por franja. Exclusivamente
// para pruebas de rutas: NO sustituye al shader ni predice sombra solar real.
export function campusExposure(edges, slot) {
  const phase=(slot%48)*Math.PI/8;
  return edges.map(e=>{
    const a=e.geometry[0],b=e.geometry.at(-1),x=(a[0]+b[0])/2,y=(a[1]+b[1])/2;
    const fraction=.5+.45*Math.sin(x/180+phase)*Math.cos(y/220-phase);
    const shadeM=e.lengthM*fraction,sunM=e.lengthM-shadeM;
    return {lengthM:e.lengthM,shadeM,sunM,unknownM:0,cost:shadeM+4*sunM};
  });
}
