// La integracion por coordenadas vive separada del adaptador original de Victor.
import {createVictorRouteService,validateRouteRequest as validateLegacyRequest} from './victor-adapter.mjs';
import {createCoordinateRouteService,validateCoordinateRequest} from './coordinate-routes.mjs';
const coordinates=input=>input?.origin!==undefined||input?.destination!==undefined;
export function validateRouteRequest(input){return coordinates(input)?validateCoordinateRequest(input):validateLegacyRequest(input);}
export function createRouteService(dependencies){
  const legacy=createVictorRouteService(dependencies),points=createCoordinateRouteService(dependencies);
  return {plan:input=>(coordinates(input)?points:legacy).plan(input)};
}
