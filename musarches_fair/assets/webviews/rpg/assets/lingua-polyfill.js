/* Lingua deplatform polyfill — 覆盖 lingguang / asap 所有可能的 API */
(function(){
  const noop = () => Promise.resolve({ ok: true });
  const mkApi = () => ({
    saveFile: async (o) => { try { const a = document.createElement('a'); const blob = new Blob([o.data], {type:'application/octet-stream'}); a.href = URL.createObjectURL(blob); a.download = o.fileName || 'download'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href); return {ok:true}; } catch(e){ return {ok:false, error:e.message}; } },
    saveImageToPhotosAlbum: noop,
    chooseImage: noop,
    uploadImage: noop,
    chooseFile: noop,
    readFile: noop,
    getToken: () => localStorage.getItem('lingua_token') || null,
    getUserInfo: () => ({ nickname:'匿名', level:1 }),
    getLocation: () => Promise.resolve({latitude:39.9, longitude:116.4}),
    onAudioStart: () => {}, onAudioEnd: () => {},
    vibrate: () => {}, vibratePatterns: { button:()=>{}, success:()=>{}, error:()=>{} },
    getAppId: () => 'lingua-deplatformed',
    getAppSecret: () => '',
    _getArtifactId: () => 'lingua-deplatformed',
    _getArtifactVersion: () => '1.0.0',
    auth: { login: async () => ({ok:true, token:'mock'}), logout: async () => {} },
    ai: { chat: async () => ({ok:true, text:'(AI 功能已离线)'}) },
    asr: { start: () => Promise.resolve(), stop: () => Promise.resolve() },
    db: { create: () => Promise.resolve(), read: () => Promise.resolve([]), update: () => Promise.resolve(), delete: () => Promise.resolve() },
    data: { get: async () => null, set: async () => {}, remove: async () => {} },
    app: { ready: () => Promise.resolve(), exit: () => {} },
  });
  if (typeof window !== 'undefined') {
    if (!window.lingguang) window.lingguang = mkApi();
    if (!window.asap) window.asap = mkApi();
    window.blockDeviceVibrate = false;
  }
})();
