// Only links are rendered; no external video is requested until the user opens it.
export function videoLink(raw: string): string | null {
  if (!raw.trim()) return '';
  try {
    const u=new URL(raw.trim());if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
    const host=u.hostname.toLowerCase();let id:string|null=null;
    if(['youtube.com','www.youtube.com','m.youtube.com'].includes(host)) {
      if(u.pathname==='/watch')id=u.searchParams.get('v');
      else id=u.pathname.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})\/?$/)?.[1]??null;
    } else if(host==='youtu.be')id=u.pathname.match(/^\/([A-Za-z0-9_-]{11})\/?$/)?.[1]??null;
    if(id&&/^[A-Za-z0-9_-]{11}$/.test(id))return `https://www.youtube.com/watch?v=${id}`;
    if(['vimeo.com','www.vimeo.com'].includes(host)&&/^\/\d{1,12}\/?$/.test(u.pathname))return `https://vimeo.com/${u.pathname.split('/')[1]}`;
    return null;
  } catch { return null; }
}
