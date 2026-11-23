export type Estacion = 'primavera' | 'verano' | 'otoño' | 'invierno';

export type EstacionOption = {
  value: Estacion;
  label: string;
  month: number;
  day: number;
};

/**
 * Fechas representativas de cada estación en el hemisferio norte.
 * Se conserva el año y la hora que aporta la persona usuaria para que la
 * comparación estacional se haga a la misma hora del día.
 */
export const ESTACIONES: readonly EstacionOption[] = [
  { value: 'primavera', label: 'Primavera', month: 2, day: 20 },
  { value: 'verano', label: 'Verano', month: 5, day: 21 },
  { value: 'otoño', label: 'Otoño', month: 8, day: 22 },
  { value: 'invierno', label: 'Invierno', month: 11, day: 21 },
] as const;

const ESTACION_POR_VALOR = new Map(ESTACIONES.map((estacion) => [estacion.value, estacion]));

export function fechaRepresentativaDeEstacion(estacion: Estacion, fechaReferencia: Date | string = new Date()) {
  const referencia = new Date(fechaReferencia);
  if (Number.isNaN(referencia.getTime())) {
    throw new Error('La fecha de referencia no es válida.');
  }

  const configuracion = ESTACION_POR_VALOR.get(estacion);
  if (!configuracion) {
    throw new Error(`La estación "${estacion}" no es válida.`);
  }

  return new Date(
    referencia.getFullYear(),
    configuracion.month,
    configuracion.day,
    referencia.getHours(),
    referencia.getMinutes(),
    referencia.getSeconds(),
    referencia.getMilliseconds(),
  );
}

export function formatearFechaLocal(fecha: Date) {
  if (Number.isNaN(fecha.getTime())) {
    throw new Error('No se puede formatear una fecha inválida.');
  }

  return [
    fecha.getFullYear(),
    String(fecha.getMonth() + 1).padStart(2, '0'),
    String(fecha.getDate()).padStart(2, '0'),
  ].join('-');
}

export function estacionDeFecha(fecha: Date | string = new Date()): Estacion {
  const referencia = new Date(fecha);
  if (Number.isNaN(referencia.getTime())) {
    throw new Error('La fecha no es válida.');
  }

  const month = referencia.getMonth();
  const day = referencia.getDate();
  const monthDay = (month + 1) * 100 + day;

  if (monthDay >= 320 && monthDay < 621) return 'primavera';
  if (monthDay >= 621 && monthDay < 922) return 'verano';
  if (monthDay >= 922 && monthDay < 1221) return 'otoño';
  return 'invierno';
}

export function etiquetaEstacion(estacion: Estacion) {
  return ESTACION_POR_VALOR.get(estacion)?.label ?? estacion;
}

export type SelectorEstacionState = {
  estacion: Estacion;
  menuAbierto: boolean;
};

export function crearEstadoSelectorEstacion(estacion: Estacion): SelectorEstacionState {
  return { estacion, menuAbierto: false };
}

export function alternarMenuEstacion(state: SelectorEstacionState): SelectorEstacionState {
  return { ...state, menuAbierto: !state.menuAbierto };
}

export function seleccionarEstacionEnMenu(state: SelectorEstacionState, estacion: Estacion): SelectorEstacionState {
  return { estacion, menuAbierto: false };
}
