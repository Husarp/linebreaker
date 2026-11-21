(function (root) {
    const scores = {
        'glass-harbor': {
            bpm: 76, swing: 0.10, feel: 'calm', waves: ['sine', 'sine', 'triangle'], cutoff: 2800, trim: 1.08,
            form: 'A a B A C b',
            chords: ['D3:m9 Bb3:maj7 G3:m7 A3:sus', 'F3:maj7 C3:add9 Bb3:maj7 G3:m7', 'Eb3:maj7 D3:m7 G3:m9 A3:sus'],
            lead: [
                ['2:E5:5 8:F5:3 13:A4:2', '0:D5:5 7:C5:2 10:A4:5', '3:Bb4:3 8:D5:4 13:F5:2', '0:E5:7 10:B4:3'],
                ['0:A4:3 5:C5:3 9:E5:6', '3:G5:4 9:D5:5', '0:F5:3 6:D5:3 10:A4:4', '2:G4:6 11:C5:3'],
                ['0:G5:6 9:F5:3 13:D5:2', '2:A4:4 8:F5:5', '0:A5:3 6:G5:3 11:D5:4', '0:D5:7 12:E5:2']
            ]
        },
        'fernlight': {
            bpm: 88, swing: 0.18, feel: 'calm', waves: ['triangle', 'sine', 'sine'], cutoff: 2450, trim: 1.02,
            form: 'a A B b C B a',
            chords: ['Ab3:maj7 Eb3:add9 F3:m9 Db3:maj7', 'Bb3:m7 Eb3:sus Ab3:maj7 Gb3:maj7', 'Db3:maj7 C3:m7 F3:m7 Eb3:sus'],
            lead: [
                ['0:Eb5:3 5:C5:2 8:G4:3 13:Bb4:2', '2:F5:3 7:G5:2 11:Bb5:4', '0:Ab5:4 6:Eb5:2 11:C5:4', '0:Bb4:5 9:F4:3 14:Ab4:2'],
                ['3:Db5:4 9:F5:3 13:Ab5:2', '0:Bb5:4 6:Ab5:3 12:F5:2', '1:G5:5 8:C5:2 12:Eb5:3', '0:Db5:7 11:Ab4:3'],
                ['0:F5:3 4:Ab5:3 11:C6:4', '0:Bb5:3 5:G5:5 13:Eb5:2', '2:G5:3 8:Ab5:3 13:Eb5:2', '1:F5:5 11:Bb4:3']
            ]
        },
        'paper-orbits': {
            bpm: 82, swing: 0.04, feel: 'calm', waves: ['sine', 'triangle', 'sine'], cutoff: 3150, trim: 1.07,
            form: 'A B a C B c',
            chords: ['E3:m9 G3:maj7 C3:maj7 B3:sus', 'A3:m7 D3:add9 G3:maj7 F#3:m7', 'C3:maj7 A3:m9 E3:m7 B3:sus'],
            lead: [
                ['0:B4:7 9:F#5:3 14:D5:1', '1:B5:3 6:A5:3 12:F#5:3', '0:E5:3 4:G5:3 9:B4:5', '3:C#5:3 9:F#4:5'],
                ['0:E5:3 5:B5:3 10:C6:4', '0:A5:5 8:E5:3 13:F#5:2', '1:D5:3 6:B4:5 13:F#5:2', '0:A4:4 8:E5:4'],
                ['2:G4:3 6:B4:2 10:E5:5', '0:C5:4 7:G4:3 12:B4:3', '0:E4:5 8:G4:2 12:B4:3', '1:F#4:4 8:C#5:5']
            ]
        },
        'blue-hour': {
            bpm: 92, swing: 0.13, feel: 'calm', waves: ['triangle', 'sine', 'triangle'], cutoff: 2200, trim: 1.02,
            form: 'a B A c B C a',
            chords: ['B3:m7 E3:add9 G3:maj7 F#3:sus', 'D3:maj7 A3:add9 B3:m7 E3:add9', 'G3:maj7 A3:sus F#3:m7 E3:add9'],
            lead: [
                ['3:F#4:2 6:B4:3 11:D5:4', '0:G#4:5 7:B4:2 12:F#5:3', '1:D5:4 8:A4:3 12:B4:3', '0:C#5:6 11:G#4:3'],
                ['0:E5:2 4:F#5:4 10:A5:3 14:F#5:1', '2:E5:4 8:B4:4 13:C#5:2', '0:A4:3 6:D5:4 13:F#5:2', '2:G#5:6 11:E5:4'],
                ['0:B4:3 4:D5:3 10:F#5:3', '1:G5:4 7:E5:3 12:A4:3', '3:C#5:4 9:E5:4', '0:B4:7 12:G#4:2']
            ]
        },
        'copper-relay': {
            bpm: 136, swing: 0.08, feel: 'drive', waves: ['square', 'triangle', 'sine'], cutoff: 3650, trim: 0.99,
            form: 'a A B b A C c B A b C B a A',
            chords: ['C3:m7 Eb3:maj7 Ab3:maj7 Bb3:add9', 'F3:m7 Ab3:maj7 C3:m9 G3:sus', 'Db3:maj7 Eb3:add9 F3:m7 G3:sus'],
            lead: [
                ['0:G4:2 3:Bb4:2 6:C5:4 12:Eb5:2 15:G5:1', '2:F5:2 5:D5:2 8:Bb4:3 14:G4:2', '0:Ab4:2 3:C5:3 8:Eb5:2 11:G5:4', '0:F5:3 6:C5:2 10:D5:2 14:Bb4:2'],
                ['0:C5:3 5:Ab4:2 8:F4:2 11:Eb5:4', '0:C5:2 4:Eb5:2 7:Ab5:4 13:G5:2', '0:D5:2 3:Eb5:2 6:G5:2 10:Bb5:3 15:G5:1', '2:F5:2 6:D5:2 10:C5:4'],
                ['1:Ab4:2 4:Db5:2 7:F5:2 12:C6:3', '0:Bb5:2 3:G5:2 8:F5:3 13:Eb5:2', '0:Ab5:2 4:C6:2 7:Eb6:2 12:C6:3', '0:G5:4 7:D5:3 13:C5:2']
            ]
        },
        'vector-bloom': {
            bpm: 148, swing: 0.02, feel: 'drive', waves: ['triangle', 'square', 'triangle'], cutoff: 3050, trim: 0.93,
            form: 'A B a C b A B c A C b B C a A B',
            chords: ['A3:m9 F3:maj7 D3:m7 E3:sus', 'C3:maj7 G3:add9 Bb3:maj7 F3:add9', 'D3:m9 F3:maj7 E3:m7 E3:sus'],
            lead: [
                ['1:E5:2 4:A5:3 9:B5:2 12:G5:2 15:E5:1', '0:C5:2 3:F5:2 7:E5:2 10:A4:5', '2:F4:2 5:C5:3 10:D5:2 13:A5:2', '0:B5:2 4:E5:2 8:D5:2 11:F#5:3'],
                ['0:G5:4 6:E5:2 9:B4:2 12:C5:3', '0:A4:3 4:D5:2 7:B4:2 10:G5:3 15:A5:1', '2:F5:2 6:D5:2 10:A5:3 14:Bb5:2', '0:C6:4 6:G5:2 9:F5:2 13:C5:2'],
                ['0:E5:4 7:C6:2 11:A5:3', '1:F5:2 4:A5:2 8:E5:4 14:C5:2', '0:B4:2 3:G5:2 7:D6:3 12:B5:3', '0:F#5:3 6:A5:3 11:E5:4']
            ]
        },
        'switchyard': {
            bpm: 132, swing: 0.21, feel: 'drive', waves: ['sawtooth', 'triangle', 'sine'], cutoff: 2850, trim: 0.97,
            form: 'a A B a B C c A b C B A c B',
            chords: ['F#3:m7 A3:maj7 B3:m7 D3:maj7', 'E3:add9 C#3:m7 D3:maj7 A3:add9', 'G3:maj7 B3:m7 A3:maj7 C#3:sus'],
            lead: [
                ['0:F#4:3 5:C#5:2 8:A4:2 11:E5:2 14:C#5:2', '1:B4:2 4:G#4:2 7:C#5:3 13:E5:2', '0:F#5:2 3:D5:2 6:B4:3 11:A4:3', '2:C#5:3 7:E5:2 10:F#5:2 13:A5:2'],
                ['0:B5:3 4:G#5:2 7:F#5:2 10:B4:4', '2:G#5:2 6:E5:2 9:C#5:3 14:B4:2', '0:D5:2 4:A5:3 9:F#5:3 14:C#5:2', '0:E5:3 6:C#5:2 10:B4:2 14:E4:2'],
                ['3:B4:2 6:D5:2 9:F#5:4', '0:A5:2 4:F#5:2 7:D5:2 12:E5:3', '0:C#5:2 5:E5:2 8:G#5:2 11:B5:3', '1:G#5:3 7:F#5:2 11:D#5:3']
            ]
        },
        'tidal-engine': {
            bpm: 152, swing: 0.05, feel: 'drive', waves: ['triangle', 'triangle', 'square'], cutoff: 3380, trim: 0.95,
            form: 'a A B C b A c B A b C A B c A B',
            chords: ['G3:m9 C3:m7 Eb3:maj7 D3:sus', 'Bb3:maj7 G3:m7 F3:add9 Eb3:maj7', 'Ab3:maj7 G3:m7 C3:m9 D3:sus'],
            lead: [
                ['0:A5:2 3:G5:2 6:D5:4 13:Bb4:2', '0:Eb5:2 4:G5:2 7:Bb5:3 12:F5:3', '1:G5:2 4:D5:2 7:C5:2 10:Bb4:4', '0:A4:2 3:D5:2 7:E5:3 12:G5:3'],
                ['0:F5:4 6:A5:2 9:C6:2 13:Bb5:2', '0:D6:2 3:Bb5:2 6:G5:2 10:F5:3 15:D5:1', '2:C5:2 5:G5:2 9:A5:2 12:E5:3', '0:G5:3 5:Bb5:3 11:D6:4'],
                ['1:C6:2 4:Ab5:2 8:G5:3 13:Eb5:2', '0:D5:2 3:F5:2 6:Bb5:3 11:G5:3', '0:D6:3 5:Bb5:2 8:G5:2 12:Eb5:2', '0:A5:3 5:E5:2 8:D5:3 13:G4:2']
            ]
        },
        'redline-echo': {
            bpm: 172, swing: 0.025, feel: 'rush', waves: ['square', 'triangle', 'sawtooth'], cutoff: 3500, trim: 0.91,
            form: 'A b A B C a C B a B C A',
            chords: ['Eb3:m7 Gb3:maj7 Cb3:maj7 Bb3:sus', 'Ab3:m9 Eb3:m7 Db3:add9 Bb3:sus', 'Gb3:maj7 E3:maj7 Eb3:m7 Bb3:sus'],
            lead: [
                ['0:Gb5:2 3:Bb5:2 6:F5:2 9:Gb5:2 12:Db6:3', '0:Bb5:2 4:Ab5:2 7:F5:2 10:Db5:2 14:Gb5:2', '1:Eb5:2 4:Gb5:2 7:Bb5:2 10:Cb6:2 13:Eb6:2', '0:F6:2 3:C6:2 6:Bb5:2 9:Eb5:2 12:F5:3'],
                ['0:Gb5:3 5:Eb5:2 8:Bb4:2 11:Cb5:2 14:Eb5:2', '0:Bb5:2 3:Gb5:2 6:F5:2 9:Db5:2 13:Eb5:3', '0:F5:2 3:Ab5:2 6:Eb5:2 9:Ab5:2 13:Db6:3', '1:Bb5:2 4:C6:2 7:F5:2 10:Eb5:2 13:Bb4:2'],
                ['0:Ab5:2 4:Bb5:2 7:Gb5:2 10:Db6:2 13:F6:2', '0:Eb6:2 3:B5:2 6:G#5:2 9:F#5:2 12:E5:3', '0:Eb5:2 3:Gb5:2 6:Bb5:2 9:Db6:2 12:Gb6:3', '0:F6:3 5:C6:2 8:Eb6:2 12:Bb5:3']
            ]
        },
        'fault-current': {
            bpm: 184, swing: 0.09, feel: 'rush', waves: ['sawtooth', 'sine', 'triangle'], cutoff: 3250, trim: 0.94,
            form: 'a A B C A b B c A C B a C A',
            chords: ['B3:m7 G3:maj7 F#3:sus E3:add9', 'D3:maj7 C3:maj7 B3:m9 F#3:sus', 'G3:maj7 E3:m9 C3:add9 F#3:sus'],
            lead: [
                ['0:D5:2 2:F#5:2 5:A5:3 10:C#6:2 13:B5:2', '0:G5:2 3:D6:2 7:B5:2 10:A5:2 13:F#5:2', '0:C#6:3 5:F#5:2 8:G#5:2 11:C#5:2 14:E5:2', '0:G#5:2 3:B5:2 6:F#5:2 10:E5:4'],
                ['1:A5:2 4:C#6:2 7:E6:3 12:D6:3', '0:G5:2 3:E6:2 6:B5:2 9:D6:2 13:C6:3', '0:F#5:3 5:D5:2 8:B5:3 13:C#6:2', '0:G#5:2 3:C#6:2 6:F#6:2 10:B5:2 13:C#6:2'],
                ['0:D6:2 3:A5:2 6:F#6:2 10:D6:3 14:B5:2', '0:G5:2 3:F#5:2 6:B5:3 11:E6:2 14:D6:2', '0:C6:3 5:G5:2 8:E5:2 11:G5:2 14:D6:2', '0:C#6:4 6:B5:2 9:G#5:2 12:F#5:3']
            ]
        }
    };

    const patterns = {
        calm: { bass: [[0, 0, 9], [10, 2, 5]], arp: [[2, 2], [6, 0], [10, 3], [14, 1]], kick: [0], snare: [12], hat: [6, 14] },
        drive: { bass: [[0, 0, 3], [4, 0, 2], [7, 2, 2], [10, 0, 3], [14, 1, 2]], arp: [[2, 0], [5, 2], [8, 1], [11, 3], [14, 2]], kick: [0, 7, 10], snare: [4, 12], hat: [2, 6, 9, 14] },
        rush: { bass: [[0, 0, 2], [3, 0, 2], [6, 2, 2], [8, 0, 2], [11, 0, 2], [14, 1, 2]], arp: [[1, 0], [3, 2], [5, 1], [7, 3], [9, 2], [11, 1], [13, 3], [15, 2]], kick: [0, 4, 8, 10], snare: [4, 12], hat: [2, 5, 6, 9, 13, 14, 15] }
    };
    const intervals = { maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], m9: [0, 3, 7, 14], add9: [0, 4, 7, 14], sus: [0, 5, 7, 14] };
    const pitches = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const envelopes = [[0.17, 0.023, 0.58], [0.12, 0.012, 0.75], [0.062, 0.012, 0.46]];
    const waveTrim = { sine: 1.08, triangle: 1, square: 0.64, sawtooth: 0.78 };
    const cache = new Map();
    const noiseBuffers = new WeakMap();

    function noteNumber(note) {
        const [, name, accidental, octave] = /^([A-G])([b#]?)(\d)$/.exec(note);
        return (Number(octave) + 1) * 12 + pitches[name] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0);
    }

    function getTrack(id) {
        if (cache.has(id)) return cache.get(id);
        const score = Object.hasOwn(scores, id) ? scores[id] : null;
        if (!score) return null;
        const stepTime = 60 / score.bpm / 4;
        const pattern = patterns[score.feel];
        const form = score.form.split(' ');
        const chords = score.chords.map(section => section.split(' ').map(chord => {
            const [note, type] = chord.split(':');
            return intervals[type].map(interval => noteNumber(note) + interval);
        }));
        const lead = score.lead.map(section => section.map(bar => bar.split(' ').map(event => {
            const [step, note, length] = event.split(':');
            return [Number(step), noteNumber(note), Number(length)];
        })));
        const events = [];
        for (const [phrase, letter] of form.entries()) {
            const section = 'ABC'.indexOf(letter.toUpperCase());
            const full = letter === letter.toUpperCase();
            for (const [bar, chord] of chords[section].entries()) {
                const base = (phrase * 4 + bar) * 16;
                const timeAt = step => (base + step + (step % 2 ? score.swing : 0)) * stepTime;
                const tone = (voice, step, note, length, strength) => {
                    const time = timeAt(step);
                    events.push({ voice, time, duration: Math.min(timeAt(step + length) - time, timeAt(16) - time) * 0.94, note, strength });
                };
                for (const [step, note, length] of lead[section][bar]) tone(0, step, note, length, full ? 1 : 0.82);
                for (const [step, degree, length] of pattern.bass) {
                    if (full || step % 2 === 0) tone(1, step, chord[degree] - 12, length, step === 0 ? 1 : 0.81);
                }
                for (const [index, [step, degree]] of pattern.arp.entries()) {
                    if (full || index % 2 === 0) tone(2, step, chord[(degree + bar) % 4] + 12, score.feel === 'calm' ? 2 : 1, index % 2 ? 0.68 : 1);
                }
                for (const voice of ['kick', 'snare', 'hat']) {
                    const steps = voice === 'snare' && full && bar === 3 && score.feel !== 'calm' ? [...pattern[voice], 15] : pattern[voice];
                    for (const [index, step] of steps.entries()) {
                        if (!full && (voice === 'snare' || index % 2 !== 0)) continue;
                        const volume = score.feel === 'calm' ? 0.48 : score.feel === 'drive' ? 0.88 : 1;
                        events.push({ voice, time: timeAt(step), duration: Math.min(0.17, timeAt(16) - timeAt(step)), strength: volume * (index % 2 === 0 ? 1 : 0.66) });
                    }
                }
            }
        }
        events.sort((first, second) => first.time - second.time);
        const track = { duration: form.length * 64 * stepTime, barDuration: 16 * stepTime, events, waves: score.waves, cutoff: score.cutoff, trim: score.trim };
        cache.set(id, track);
        return track;
    }

    function noiseBuffer(context) {
        if (!noiseBuffers.has(context)) {
            const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.2), context.sampleRate);
            const samples = buffer.getChannelData(0);
            let seed = 39;
            for (let index = 0; index < samples.length; index++) {
                seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
                samples[index] = seed / 2147483648 - 1;
            }
            noiseBuffers.set(context, buffer);
        }
        return noiseBuffers.get(context);
    }

    function createSource(context, descriptor) {
        const { synth: track, duration } = descriptor;
        const output = context.createBiquadFilter();
        output.type = 'lowpass';
        output.frequency.value = track.cutoff;
        output.Q.value = 0.34;
        const noiseFilters = {};
        for (const [voice, frequency] of [['snare', 1800], ['hat', 4600]]) {
            const filter = context.createBiquadFilter();
            filter.type = voice === 'snare' ? 'bandpass' : 'highpass';
            filter.frequency.value = frequency;
            filter.Q.value = 0.65;
            filter.connect(output);
            noiseFilters[voice] = filter;
        }
        const active = new Set();
        const timeline = root.LBMusicTempo.createTimeline(track.events, duration, track.barDuration);
        let timer, running = false, stopped = false;

        function play(event, time, length) {
            const { voice, note, strength } = event;
            const tonal = Number.isInteger(voice);
            const noiseFilter = noiseFilters[voice];
            const node = noiseFilter ? context.createBufferSource() : context.createOscillator();
            const gain = context.createGain();
            let [level, attack, sustain] = tonal ? envelopes[voice] : voice === 'kick' ? [0.23, 0.005, 0.33] : voice === 'snare' ? [0.21, 0.005, 0.19] : [0.13, 0.003, 0.15];
            if (tonal) {
                node.type = track.waves[voice];
                node.frequency.value = 440 * 2 ** ((note - 69) / 12);
                level *= waveTrim[node.type];
            } else if (noiseFilter) {
                node.buffer = noiseBuffer(context);
                length = Math.min(length, voice === 'hat' ? 0.045 : 0.12);
            } else {
                node.frequency.setValueAtTime(136, time);
                node.frequency.exponentialRampToValueAtTime(45, time + Math.min(0.075, length));
            }
            const end = time + length;
            const peak = level * strength * track.trim;
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(peak, time + Math.min(attack, length * 0.25));
            gain.gain.exponentialRampToValueAtTime(peak * sustain, time + length * 0.53);
            gain.gain.linearRampToValueAtTime(0, end);
            node.connect(gain);
            gain.connect(noiseFilter || output);
            const voiceNodes = { node, gain };
            active.add(voiceNodes);
            node.onended = () => { active.delete(voiceNodes); node.disconnect(); gain.disconnect(); };
            node.start(time);
            node.stop(end);
        }

        function schedule() {
            if (!running) return;
            let ended;
            try {
                ended = timeline.schedule(context.currentTime, play);
            } catch (error) {
                source.onerror?.(error);
                source.stop();
                return;
            }
            if (ended) {
                source.stop();
                source.onended?.();
                return;
            }
            timer = setTimeout(schedule, context.state === 'running' ? 45 : 180);
        }

        function silence() {
            running = false;
            clearTimeout(timer);
            for (const { node, gain } of active) {
                node.onended = null;
                node.stop();
                node.disconnect();
                gain.disconnect();
            }
            active.clear();
        }

        const source = {
            buffer: descriptor,
            onended: null,
            onerror: null,
            connect(target) { output.connect(target); },
            setTempo: timeline.setTempo,
            finishAtBar: timeline.finishAtBar,
            start(when = 0, position = 0) {
                if (running || stopped) return;
                running = true;
                timeline.start(Math.max(when, context.currentTime + 0.025), position);
                schedule();
            },
            pause() {
                if (!running) return;
                timeline.pause(context.currentTime);
                silence();
            },
            resume() {
                if (running || stopped) return;
                running = true;
                timeline.resume(context.currentTime + 0.025);
                schedule();
            },
            stop() {
                if (stopped) return;
                stopped = true;
                output.disconnect();
                silence();
                for (const filter of Object.values(noiseFilters)) filter.disconnect();
            }
        };
        return source;
    }

    root.LBMusicSynth = { getTrack, createSource };
})(globalThis);
