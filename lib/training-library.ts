import { newExercise, type Category, type LibraryExercise } from './training-builder.ts';
const names: [Category, string[]][] = [
  ['fuerza', ['Sentadilla', 'Sentadilla goblet', 'Peso muerto rumano', 'Peso muerto sumo', 'Zancada búlgara', 'Zancadas', 'Step-up', 'Extensión de rodilla en máquina', 'Curl femoral', 'Puente de glúteos', 'Elevación de gemelos de pie', 'Elevación de sóleo sentado', 'Plancha frontal', 'Plancha lateral', 'Remo con mancuerna', 'Press de pecho con mancuernas', 'Flexiones']],
  ['movilidad', ['Movilidad de tobillo', 'Movilidad de cadera', 'Movilidad torácica', 'Movilidad de hombros']],
  ['trail', ['Carrera suave', 'Rodaje continuo', 'Series en cuesta', 'Cambios de ritmo', 'Caminar', 'Progresivos']],
];
export const starterExercises: LibraryExercise[] = names.flatMap(([category, list]) => list.map((name, index) => ({id: `starter:${category}:${index}`, name, category, video_url: '', notes: ''})));
const searchText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim().replace(/\s+/g, ' ');
// Saved team exercises replace matching starter entries; never mutate either source.
export function libraryOptions(saved: readonly LibraryExercise[], search = ''): LibraryExercise[] {
  const byName = new Map<string, LibraryExercise>();
  for (const item of [...starterExercises, ...saved]) byName.set(`${item.category}:${searchText(item.name)}`, item);
  const query = searchText(search);
  return [...byName.values()].filter(i => searchText(`${i.name} ${i.category}`).includes(query)).sort((a,b) => a.name.localeCompare(b.name,'es'));
}
export function exerciseFromLibrary(id: string, options: readonly LibraryExercise[]) {
  const item = options.find(i => i.id === id);
  return item ? {...newExercise(),name:item.name,notes:item.notes,videoUrl:item.video_url} : null;
}
