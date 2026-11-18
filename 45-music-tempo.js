(function (root) {
    const lookahead = 0.19;

    function tempoForSpeed(speed) {
        const level = Number.isFinite(speed) ? Math.max(1, Math.floor(speed)) : 1;
        return Math.min(1.5, 1 + (level - 1) * 0.04);
    }

    function createRunTempo() {
        let tempo = 1;
        return {
            update(speed, enabled) {
                if (enabled !== false) tempo = Math.max(tempo, tempoForSpeed(speed));
                return tempo;
            },
            reset() { tempo = 1; }
        };
    }

    function createTimeline(events, duration, barDuration) {
        let tempo = 1, finishPosition = duration, position = 0, cursor, bar, previousBar;

        function makeBar(index, startTime, startPosition, rate) {
            const endPosition = Math.min(duration, (index + 1) * barDuration);
            const endTime = startTime + (endPosition - startPosition) / rate;
            return { index, startTime, startPosition, rate, endPosition, endTime };
        }

        function start(at, offset, rate = tempo) {
            position = Math.max(0, Math.min(offset, finishPosition - 0.001));
            bar = makeBar(Math.floor(position / barDuration), at, position, rate);
            previousBar = null;
            cursor = events.findIndex(event => event.time >= position);
            if (cursor < 0) cursor = events.length;
        }

        return {
            start,
            setTempo(rate) { tempo = rate; },
            finishAtBar() { finishPosition = bar.endPosition; },
            pause(now) {
                if (previousBar && now < bar.startTime) bar = previousBar;
                position = Math.min(bar.endPosition, bar.startPosition + Math.max(0, now - bar.startTime) * bar.rate);
            },
            resume(at) { start(at, position, bar?.rate); },
            schedule(now, play) {
                const horizon = now + lookahead;
                while (true) {
                    while (cursor < events.length) {
                        const event = events[cursor];
                        if (event.time >= bar.endPosition) break;
                        const time = bar.startTime + (event.time - bar.startPosition) / bar.rate;
                        if (time >= horizon) break;
                        cursor++;
                        if (time < now - 0.02) continue;
                        const onset = Math.max(now, time);
                        const length = Math.min(event.duration / bar.rate, bar.endTime - onset);
                        if (length > 0) play(event, onset, length);
                    }
                    if (bar.endPosition >= finishPosition) return now >= bar.endTime;
                    if (bar.endTime >= horizon) return false;
                    previousBar = bar;
                    bar = makeBar(bar.index + 1, bar.endTime, bar.endPosition, tempo);
                }
            }
        };
    }

    root.LBMusicTempo = { tempoForSpeed, createRunTempo, createTimeline, isIntenseSpeed: speed => speed >= 5 };
})(globalThis);
