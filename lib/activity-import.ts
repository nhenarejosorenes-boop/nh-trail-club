import { Decoder, Stream } from '@garmin/fitsdk';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

export const MAX_ACTIVITY_BYTES = 20 * 1024 * 1024;
export type ImportedActivity = {
  index: number; title: string; startedAt: string; date: string;
  distanceKm: number | null; elevationM: number | null; durationSeconds: number;
  averageHeartRate: number | null; maxHeartRate: number | null; warnings: string[];
};
export type ActivityFile = { format: 'fit' | 'tcx' | 'gpx'; activities: ImportedActivity[] };
type Obj = Record<string, any>; // External SDK/XML messages have format-dependent fields.
const array = (v: any): any[] => v == null ? [] : Array.isArray(v) ? v : [v];
const number = (v: any): number | null => v === '' || v == null || typeof v === 'boolean' || !Number.isFinite(Number(v)) ? null : Number(v);
const positive = (v: any) => { const n = number(v); return n !== null && n >= 0 ? n : null; };
function timestamp(value: any): string {
  if (!(value instanceof Date) && (typeof value !== 'string' || !/T.*(?:Z|[+-]\d\d:\d\d)$/i.test(value))) throw new Error('La actividad necesita fecha y hora con zona horaria.');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('La fecha del archivo no es válida.');
  return date.toISOString();
}
export function activityDate(startedAt: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(startedAt));
  return ['year','month','day'].map(k=>parts.find(p=>p.type===k)!.value).join('-');
}
function activity(index: number, title: string, start: any, seconds: number | null, distance: number | null, elevation: number | null, warnings: string[], hr?: any, maxHr?: any): ImportedActivity {
  const startedAt = timestamp(start);
  if (seconds === null || seconds <= 0 || seconds > 604800) throw new Error('No hay una duración válida de actividad (máximo siete días). Los archivos de rutas sin actividad no se pueden importar.');
  if (distance !== null && distance > 500000) throw new Error('La distancia supera el máximo de 500 km.');
  if (elevation !== null && elevation > 30000) throw new Error('El desnivel supera el máximo de 30.000 m.');
  if (distance === null) warnings.push('Falta la distancia: complétala antes de guardar.');
  if (elevation === null) warnings.push('Falta el desnivel positivo: complétalo antes de guardar.');
  const heart = (v:any) => {const n=number(v);return n!==null && n>=20 && n<=250 ? Math.round(n):null;};
  return {index,title:title.slice(0,160),startedAt,date:activityDate(startedAt),distanceKm:distance===null?null:Math.round(distance/10)/100,elevationM:elevation===null?null:Math.round(elevation),durationSeconds:seconds,averageHeartRate:heart(hr),maxHeartRate:heart(maxHr),warnings};
}
type Point = { lat: number | null; lon: number | null; elevation: number | null; time?: any };
function trackSummary(segments: Point[][]) {
  let distance=0, elevation=0, pairs=0, altitudePairs=0, expectedPairs=0, count=0;
  const times:string[]=[];
  for(const points of segments) {
    let previous:Point|undefined;
    for(const point of points) {
      if(++count>150000) throw new Error('El archivo contiene demasiados puntos (máximo 150.000).');
      if(point.time) times.push(timestamp(point.time));
      if(previous) {
        expectedPairs++;
        if(previous.lat!==null && previous.lon!==null && point.lat!==null && point.lon!==null) {
          const rad=Math.PI/180, a=Math.sin((point.lat-previous.lat)*rad/2)**2 + Math.cos(previous.lat*rad)*Math.cos(point.lat*rad)*Math.sin((point.lon-previous.lon)*rad/2)**2;
          distance+=6371000*2*Math.atan2(Math.sqrt(Math.min(1,a)),Math.sqrt(Math.max(0,1-a)));pairs++;
        }
        if(previous.elevation!==null && point.elevation!==null) {elevation+=Math.max(0,point.elevation-previous.elevation);altitudePairs++;}
      }
      previous=point;
    }
  }
  if(times.some((t,i)=>i>0 && t<times[i-1])) throw new Error('El archivo tiene marcas de tiempo desordenadas.');
  return {distance:pairs&&pairs===expectedPairs?distance:null,elevation:altitudePairs&&altitudePairs===expectedPairs?elevation:null,start:times[0],seconds:times.length>1&&times.length===count?(Date.parse(times.at(-1)!)-Date.parse(times[0]))/1000:null};
}
function coordinates(lat: any, lon: any, elevation:any, time:any):Point {
  const la=number(lat),lo=number(lon);
  return {lat:la!==null&&Math.abs(la)<=90?la:null,lon:lo!==null&&Math.abs(lo)<=180?lo:null,elevation:number(elevation),time};
}
function sumComplete(rows: Obj[], key: string) { const values=rows.map(r=>positive(r[key]));return values.length && values.every(v=>v!==null)?values.reduce<number>((s,v)=>s+v!,0):null; }
export function parseActivityFile(name: string, buffer: ArrayBuffer): ActivityFile {
  if(buffer.byteLength===0 || buffer.byteLength>MAX_ACTIVITY_BYTES) throw new Error('Selecciona un archivo de hasta 20 MB. Descomprime los ZIP antes de importarlos.');
  const format=name.split('.').at(-1)?.toLowerCase();
  if(format==='fit') {
    const decoder=new Decoder(Stream.fromArrayBuffer(buffer));
    if(!decoder.isFIT() || !decoder.checkIntegrity()) throw new Error('El archivo FIT está incompleto o su comprobación de integridad ha fallado.');
    const {messages,errors}=decoder.read({convertDateTimesToDates:true,convertTypesToStrings:true});
    if(errors.length) throw new Error('No se ha podido leer íntegramente el archivo FIT.');
    const sessions=array(messages.sessionMesgs);
    if(!sessions.length || sessions.length>32) throw new Error('El FIT debe contener entre 1 y 32 sesiones de actividad.');
    const activities=sessions.map((s:Obj,index:number)=>{
      if(!['running','walking','hiking'].includes(s.sport)) throw new Error('Solo se admiten actividades de carrera, caminata o senderismo. Separa las sesiones de otros deportes.');
      const warnings:string[]=[];
      const timer=positive(s.totalTimerTime),elapsed=positive(s.totalElapsedTime);
      if(timer===null) warnings.push('Duración obtenida del tiempo transcurrido, incluidas las pausas.');
      return activity(index,'Salida importada de FIT',s.startTime,timer??elapsed,positive(s.totalDistance),positive(s.totalAscent),warnings,s.avgHeartRate,s.maxHeartRate);
    });
    return {format,activities};
  }
  if(format!=='tcx' && format!=='gpx') throw new Error('Formato no admitido. Utiliza FIT, TCX o GPX sin comprimir.');
  const xml=new TextDecoder('utf-8',{fatal:true}).decode(buffer);
  if(/<!\s*(?:DOCTYPE|ENTITY)/i.test(xml)) throw new Error('No se admiten declaraciones de entidades o DTD en el XML.');
  // Bound nesting before invoking the parser; content is never executed or fetched.
  let depth=0;for(const tag of xml.matchAll(/<\/?[A-Za-z_][^>]*>/g)) {if(tag[0].startsWith('</')) depth--;else if(!tag[0].endsWith('/>')) depth++;if(depth>64)throw new Error('El XML tiene demasiados niveles de anidación.');}
  if(XMLValidator.validate(xml)!==true) throw new Error('El XML no es válido o está incompleto.');
  const data=new XMLParser({ignoreAttributes:false,removeNSPrefix:true,parseTagValue:false,parseAttributeValue:false,processEntities:false}).parse(xml);
  const activities:ImportedActivity[]=[];
  if(format==='gpx') {
    const tracks=array(data.gpx?.trk);
    if(!tracks.length || tracks.length>32) throw new Error('El GPX debe contener un track de actividad con tiempos. Las rutas sin actividad no se pueden importar.');
    tracks.forEach((track:Obj,index:number)=>{
      const summary=trackSummary(array(track.trkseg).map(seg=>array(seg.trkpt).map(p=>coordinates(p['@_lat'],p['@_lon'],p.ele,p.time))));
      activities.push(activity(index,typeof track.name==='string'?track.name:'Salida importada de GPX',summary.start,summary.seconds,summary.distance,summary.elevation,['Confirma que es una actividad de carrera o senderismo.','Distancia y desnivel estimados a partir del GPS, sin filtrar ruido de altitud.','Duración transcurrida entre puntos, incluidas las pausas.']));
    });
  } else {
    const rows=array(data.TrainingCenterDatabase?.Activities?.Activity);
    if(!rows.length || rows.length>32) throw new Error('El TCX debe contener entre 1 y 32 actividades. No se admiten archivos de recorridos.');
    rows.forEach((row:Obj,index:number)=>{
      const sport=String(row['@_Sport']??'').toLowerCase();
      if(sport!=='running' && sport!=='other') throw new Error('Solo se admiten actividades de carrera o senderismo.');
      const laps=array(row.Lap),summary=trackSummary(laps.flatMap(lap=>array(lap.Track).map(track=>array(track.Trackpoint).map(p=>coordinates(p.Position?.LatitudeDegrees,p.Position?.LongitudeDegrees,p.AltitudeMeters,p.Time)))));
      const warnings=['Desnivel estimado a partir de los puntos de altitud, sin filtrar ruido.'];
      if(sport==='other') warnings.push('Confirma que es una actividad de carrera o senderismo.');
      const seconds=sumComplete(laps,'TotalTimeSeconds'),distance=sumComplete(laps,'DistanceMeters');
      if(seconds===null)warnings.push('Duración transcurrida entre puntos, incluidas las pausas.');
      if(distance===null)warnings.push('Distancia estimada a partir del GPS.');
      activities.push(activity(index,'Salida importada de TCX',summary.start??row.Id??laps[0]?.['@_StartTime'],seconds??summary.seconds,distance??summary.distance,summary.elevation,warnings));
    });
  }
  return {format,activities};
}
