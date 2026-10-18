import { useCallback, useState } from 'react';

import type { Coordenada, ResultadoSolar, VistaActiva } from '@/types/mapa';

const COORDENADA_INICIAL: Coordenada = {
  lat: 40.4168,
  lon: -3.7038,
};

export function useMapaEstado() {
  const [coordenada, setCoordenada] = useState<Coordenada>(COORDENADA_INICIAL);
  const [fecha, setFecha] = useState(() => new Date());
  const [hora, setHora] = useState(() => new Date());
  const [resultadoSolar, setResultadoSolar] = useState<ResultadoSolar | null>(null);
  const [chunkUrl, setChunkUrl] = useState<string | null>(null);
  const [vistaActiva, setVistaActiva] = useState<VistaActiva>('2d');

  const seleccionarCoordenada = useCallback((lat: number, lon: number) => {
    setCoordenada({ lat, lon });
  }, []);

  return {
    coordenada,
    setCoordenada,
    fecha,
    setFecha,
    hora,
    setHora,
    resultadoSolar,
    setResultadoSolar,
    chunkUrl,
    setChunkUrl,
    vistaActiva,
    setVistaActiva,
    seleccionarCoordenada,
  };
}
