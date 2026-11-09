// Presentation helpers only; database policies authorize each operation.
export function canCoach(role: string | null | undefined) {
  return role === 'admin' || role === 'coach';
}

export function hasCoachingAccess(access: { state: string } | null | undefined) {
  return canCoach(access?.state);
}

export const coachLinks = [
  { href: '/entrenador/seguimiento', title: 'Deportistas y seguimiento', text: 'Consulta la evolución deportiva y abre la preparación de cada corredor.' },
  { href: '/entrenamientos/plan?type=fuerza', title: 'Programar fuerza', text: 'Crea sesiones con ejercicios, series, repeticiones y vídeos.' },
  { href: '/entrenamientos/plan?type=trail', title: 'Programar trail', text: 'Diseña sesiones de carrera por montaña.' },
  { href: '/objetivos', title: 'Objetivos y preparación', text: 'Organiza objetivos, etapas y revisiones semanales.' },
  { href: '/mensajes', title: 'Mensajes de deportistas', text: 'Responde las dudas de los corredores desde su conversación.' },
];
