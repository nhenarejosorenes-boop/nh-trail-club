import { parseActivityFile } from './activity-import';
self.onmessage = (event: MessageEvent<{name:string; buffer:ArrayBuffer}>) => {
  try { self.postMessage({result:parseActivityFile(event.data.name,event.data.buffer)}); }
  catch(error) {self.postMessage({error:error instanceof Error?error.message:'No se pudo leer el archivo.'});}
};
