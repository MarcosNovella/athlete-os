/**
 * Single-source glossary (roadmap §A.9): every jargon term the UI shows gets a
 * 2-3 line plain-language explanation. One map so the wording is identical
 * everywhere a term appears. Señales, nunca veredictos (ADR-012).
 */

export type GlossaryKey =
  | 'acwr'
  | 'ewma'
  | 'au'
  | 'srpe'
  | 'monotony'
  | 'strain'
  | 'z'
  | 'baseline'
  | 'readiness'
  | 'e1rm'
  | 'ritmo';

export const GLOSSARY: Record<GlossaryKey, { term: string; definition: string }> = {
  acwr: {
    term: 'ACWR',
    definition:
      'Cociente entre tu carga reciente (7 días) y tu base (28 días). Entre 0.8 y 1.3 suele ser terreno seguro; por encima, el salto de carga es una señal a vigilar — nunca un veredicto.',
  },
  ewma: {
    term: 'EWMA',
    definition:
      'Promedio móvil que pesa más los días recientes: la sesión de ayer cuenta más que la de hace un mes. Es como el motor suaviza tus cargas diarias.',
  },
  au: {
    term: 'AU',
    definition:
      'Unidades arbitrarias de carga: minutos × esfuerzo (sRPE). No se comparan entre personas — solo tus semanas entre sí.',
  },
  srpe: {
    term: 'sRPE',
    definition:
      'Esfuerzo percibido de la sesión, de 1 a 10, anotado al terminar. Multiplicado por los minutos da la carga en AU.',
  },
  monotony: {
    term: 'Monotonía',
    definition:
      'Qué tan parecidos son tus días de carga entre sí. Bajo 1.5 está ok; sobre 2, la semana es demasiado uniforme — variá estímulos y descansos.',
  },
  strain: {
    term: 'Strain',
    definition:
      'Carga total de la semana × monotonía. No tiene escala universal: se compara solo contra tus propias últimas semanas.',
  },
  z: {
    term: 'z',
    definition:
      'Cuántas desviaciones estándar estás de TU media de 28 días. ±0.5 es tu rango normal; más allá de ±1.5 es una salida MUY marcada.',
  },
  baseline: {
    term: 'Baseline',
    definition:
      'Tu media personal de los últimos 28 días para una métrica. Se forma con 7+ check-ins; contra ella se calculan los z.',
  },
  readiness: {
    term: 'Readiness',
    definition:
      'Cómo te sentís para entrenar hoy, de 1 a 5, según tu check-in. Es subjetivo a propósito: tu percepción es el dato.',
  },
  e1rm: {
    term: 'e1RM',
    definition:
      'Fuerza máxima estimada (1 repetición) a partir del peso y las reps de tu serie tope, con la fórmula de Epley. Es una estimación, no un test real de 1RM.',
  },
  ritmo: {
    term: 'Ritmo',
    definition:
      'Minutos por kilómetro en una sesión de running. Más bajo es más rápido — se compara contra tu propia media, no contra una tabla.',
  },
};
