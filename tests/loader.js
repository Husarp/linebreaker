import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';
export async function loadGame(flag = true, desktopInvoke = null, capacitor = null, fetchImpl = async () => ({ok:true, json:async () => []}), initialSettings = null, configureWindow = null) {
  if (fetchImpl && typeof fetchImpl === 'object') { initialSettings = fetchImpl; fetchImpl = async () => ({ok:true, json:async () => []}); }
  const dom = new JSDOM(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), {url:'https://linebreaker.test/', runScripts:'outside-only', pretendToBeVisual:true});
  const w = dom.window;
  configureWindow?.(w);
  const RealDate = w.Date;
  w.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : ['2026-11-18T12:00:00Z'])); } static now() { return Date.parse('2026-11-18T12:00:00Z'); } };
  w.fetch = fetchImpl;
  Object.defineProperty(w.HTMLElement.prototype, 'innerText', {get(){return this.textContent;},set(v){this.textContent=v;}});
  let now = 0, id = 0;
  const timers = new Map(), frames = new Map(), calls = [];
  w.setTimeout = (fn, ms = 0) => { timers.set(++id, {fn, at:now + ms}); return id; };
  w.clearTimeout = key => timers.delete(key);
  w.setInterval = () => ++id;
  w.clearInterval = () => {};
  w.requestAnimationFrame = fn => {frames.set(++id, fn); return id;};
  w.cancelAnimationFrame = key => frames.delete(key);
  Object.defineProperty(w.performance, 'now', {value:() => now});
  w.HTMLCanvasElement.prototype.getContext = function() {
    const canvas = this;
    return new Proxy({canvas, measureText: s => ({width:String(s).length * 8}), createLinearGradient:() => ({addColorStop(){}}), createRadialGradient:() => ({addColorStop(){}})}, {get(target,key) {return key in target ? target[key] : (...args) => {calls.push([key,...args]);};}});
  };
  class AudioContext {
    constructor(){this.destination = {}; this.currentTime = 0; this.state = 'running'; this.sampleRate = 44100;}
    createGain(){return {gain:{value:0, cancelScheduledValues(){}, setValueAtTime(){}, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
    createOscillator(){return {frequency:{value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){},start(){},stop(){}};}
    createBiquadFilter(){return {frequency:{value:0},Q:{value:0},connect(){},disconnect(){}};}
    createBuffer(channels, length){return {getChannelData:() => new Float32Array(length)};}
    createBufferSource(){return {connect(){},disconnect(){},start(){},stop(){},playbackRate:{value:1}};}
    decodeAudioData(){return Promise.resolve(this.createBuffer(1,1));}
    suspend(){return Promise.resolve();}
    close(){return Promise.resolve();}
    resume(){return Promise.resolve();}
  }
  w.AudioContext = w.webkitAudioContext = AudioContext;
  w.HTMLMediaElement.prototype.play = () => Promise.resolve();
  w.HTMLMediaElement.prototype.pause = () => {};
  w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder;
  w.indexedDB = new IDBFactory();
  const storage = new Map();
  if (initialSettings) storage.set('tetrisRPG_settings', JSON.stringify(initialSettings));
  Object.defineProperty(w, 'localStorage', {value:{getItem:k => storage.get(k) ?? null,setItem:(k,v) => storage.set(k,String(v)),removeItem:k => storage.delete(k),clear:() => storage.clear()}});
  delete w.showOpenFilePicker;
  let seed = 42; w.Math.random = () => ((seed = (Math.imul(seed,1664525)+1013904223) >>> 0)/4294967296);
  if (desktopInvoke) w.__TAURI__ = { core: { invoke: desktopInvoke } };
  if (capacitor) w.Capacitor = capacitor;
  w.eval(readFileSync(new URL('../native-save.js', import.meta.url), 'utf8'));
  w.eval(readFileSync(new URL('../save-sanitize.js', import.meta.url), 'utf8'));
  w.eval(readFileSync(new URL('../controls.js', import.meta.url), 'utf8'));
  w.eval(readFileSync(new URL('../gamepad.js', import.meta.url), 'utf8'));
  w.eval(readFileSync(new URL('../music-synth.js', import.meta.url), 'utf8'));
  w.eval(readFileSync(new URL('../notifications.js', import.meta.url), 'utf8'));
  w.eval(readFileSync(new URL('../assets/skins/catalog.js', import.meta.url), 'utf8'));
  w.__LB_TEST__ = flag;
  w.eval(readFileSync(new URL('../app.js', import.meta.url), 'utf8').replace('window.__lb = {', 'window.__lb = { writeSaveFile, applyLoadedData, startMusic, switchMusicMode, _initTrackCatalog, _getPlaylist,'));
  // Let IndexedDB-backed startup finish before tests mutate state or close the window.
  for (let i = 0; i < 30; i++) await new Promise(resolve => setImmediate(resolve));
  function advance(ms) {
    now += ms;
    const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(now));
    let iterations = 0;
    while ([...timers.values()].some(t => t.at <= now)) {
      if (++iterations > 1000) throw Error('Timer loop');
      for (const [key,t] of [...timers]) if(t.at <= now) {timers.delete(key); t.fn();}
    }
  }
  return {w, api:w.__lb, advance, calls, close:() => dom.window.close()};
}
