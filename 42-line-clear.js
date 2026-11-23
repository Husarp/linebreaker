(function (root) {
    const MAX_PARTICLES = 64;
    const clamp = value => Math.max(0, Math.min(1, value));
    const strength = count => Math.max(1, Math.min(4, count));

    function stoneCracks(ctx, left, top, size, column) {
        const shift = column % 2 ? .09 : 0;
        ctx.moveTo(left + size * (.25 + shift), top + size * .08);
        ctx.lineTo(left + size * .49, top + size * .38);
        ctx.lineTo(left + size * .42, top + size * .6);
        ctx.lineTo(left + size * .65, top + size * .91);
        ctx.moveTo(left + size * .42, top + size * .6);
        ctx.lineTo(left + size * .13, top + size * .71);
    }

    function leafGrain(ctx, left, top, size, column) {
        const height = top + size * (column % 2 ? .59 : .37);
        ctx.moveTo(left + size * .12, height);
        ctx.lineTo(left + size * .88, height - size * .09);
    }

    function steppedGlyph(ctx, left, top, size, column) {
        const center = left + size / 2;
        const height = top + size * (column % 2 ? .58 : .42);
        ctx.moveTo(center - size * .36, height);
        ctx.lineTo(center - size * .18, height);
        ctx.lineTo(center - size * .18, height - size * .16);
        ctx.lineTo(center + size * .18, height - size * .16);
        ctx.lineTo(center + size * .18, height);
        ctx.lineTo(center + size * .36, height);
    }

    function glazeCracks(ctx, left, top, size, column) {
        stoneCracks(ctx, left, top, size, column);
        ctx.moveTo(left + size * .49, top + size * .38);
        ctx.lineTo(left + size * .75, top + size * .22);
        ctx.lineTo(left + size * .9, top + size * .29);
    }

    function facet(ctx, left, top, size, column) {
        const center = left + size * (column % 2 ? .42 : .58);
        ctx.moveTo(center, top + size * .13);
        ctx.lineTo(left + size * .85, top + size * .45);
        ctx.lineTo(center, top + size * .84);
        ctx.lineTo(left + size * .16, top + size * .45);
        ctx.closePath();
    }

    const SUBTLE = {
        tint: '#fff', bits: ['#f5f8ff', '#dce8ee'],
        lift: -.86, gravity: -.32, drift: .55, size: .105, life: 245,
    };
    const SKIN_EFFECTS = {
        'carved-stone': {
            name: 'Stone Crumble', tint: '#a1a8af', bits: ['#a2a7ab', '#6f767e', '#a9a196'],
            lift: .4, gravity: 7, drift: .94, size: .17, life: 285, shape: 'shard',
            fleck: '#c2bcb4', detail: stoneCracks, detailColor: '#20252b',
        },
        'golden-dragon': {
            name: 'Gold Leaf', tint: '#efb641', bits: ['#f7d879', '#cb8d30', '#e9b752'],
            lift: -.24, gravity: 2.2, drift: 1.05, size: .18, life: 295, shape: 'leaf',
            fleck: '#fff0b2', detail: leafGrain, detailColor: '#fff0b2',
        },
        'obsidian-carved': {
            name: 'Obsidian Shards', tint: '#272333', bits: ['#0d0c12', '#1d1925', '#14121a'],
            lift: .13, gravity: 4.7, drift: 1, size: .18, life: 285, shape: 'shard', edge: true,
        },
        'aztec-gold': {
            name: 'Stepped Gold Dust', tint: '#bd8d43', bits: ['#f4ce74', '#dba54b', '#b87d30'],
            lift: 1.07, gravity: 3.8, drift: 0, size: .085, life: 260, stepped: true,
        },
        aztec: {
            name: 'Temple Steps', tint: '#288f87', bits: ['#63d2b4', '#317e76', '#afdbc2'],
            lift: -.95, gravity: 4, drift: .38, size: .17, life: 340, span: 405, shape: 'step', stepped: true,
            detail: steppedGlyph, detailColor: '#b9ffe1',
        },
        'brushed-metal': {
            name: 'Grinder Sparks', tint: '#cedce5', bits: ['#fff5cb', '#ffbd59', '#adc5d7'],
            lift: -1.7, gravity: 8.5, drift: 4.2, size: .27, life: 325, span: 380, shape: 'spark',
            detail: leafGrain, detailColor: '#effaff',
        },
        'forged-iron': {
            name: 'Anvil Embers', tint: '#c6a18a', bits: ['#ffd395', '#fa8c56', '#918b8a'],
            lift: -1.1, gravity: 10, drift: 2.9, size: .18, life: 310, span: 365, shape: 'spark',
            fleck: '#ffe8bc',
        },
        'gem-gloss': {
            name: 'Facet Scatter', tint: '#c29feb', bits: ['#f6d1ff', '#a995ef', '#8bf6e6'],
            lift: -1.2, gravity: 5, drift: 2.6, size: .25, life: 360, span: 415, shape: 'facet',
            fleck: '#fff7ff', edge: true, detail: facet, detailColor: '#fff6ff',
        },
        'jelly-candy': {
            name: 'Candy Splat', tint: '#f38bb0', bits: ['#ff92c6', '#f9c86d', '#b48df4'],
            lift: -1.5, gravity: 9, drift: 2.4, size: .34, life: 370, span: 430, shape: 'drop', rowMotion: 'jelly',
        },
        'lava-glass': {
            name: 'Molten Fracture', tint: '#eb6633', bits: ['#ffb65a', '#da4c35', '#702d39'],
            lift: -.95, gravity: 5, drift: 2.8, size: .27, life: 365, span: 430, shape: 'shard',
            fleck: '#ffe599', outline: '#ff8b42', detail: stoneCracks, detailColor: '#ffd081',
        },
        'neon-pixel': {
            name: 'Neon Flicker', tint: '#8bfcee', bits: ['#7fffe9', '#fda3ef', '#a49aff'],
            lift: -.75, gravity: -.4, drift: 1.4, size: .24, life: 315, span: 375, shape: 'dash', rowMotion: 'neon',
        },
        'pixel-16bit': {
            name: 'Pixel Dissolve', tint: '#e6efff', bits: ['#b8d9ff', '#f2e5a8', '#e3a9ba'],
            lift: -.45, gravity: 3.2, drift: 1.4, size: .18, life: 320, span: 385, stepped: true, rowMotion: 'pixels',
        },
        porcelain: {
            name: 'Glaze Crack', tint: '#f6eee4', bits: ['#fff7eb', '#d6e3ef', '#a5bdce'],
            lift: -1.35, gravity: 8.1, drift: 1.8, size: .23, life: 340, span: 400, shape: 'shard',
            detail: glazeCracks, detailColor: '#546780',
        },
        'soft-clay': {
            name: 'Clay Squash', tint: '#d88b77', bits: ['#d18a6c', '#ad6660', '#ebad83'],
            lift: -.85, gravity: 5.8, drift: 1.55, size: .31, life: 315, span: 375, shape: 'crumb', rowMotion: 'clay',
        },
        bubble: {
            name: 'Bubble Pop', tint: '#b8e7ff', bits: ['#d5f9ff', '#a9caf9', '#d4a8ef'],
            lift: -2.15, gravity: -.95, drift: 1.8, size: .37, life: 390, span: 455, shape: 'ring', rowMotion: 'bubble',
        },
        'season-prism': {
            name: 'Prism Split', tint: '#ede4ff', bits: ['#ff9dc2', '#ffdd96', '#8ef8eb', '#acacff'],
            lift: -1.25, gravity: 2.8, drift: 3.4, size: .29, life: 390, span: 455, shape: 'prism',
            detail: facet, detailColor: '#ffffff',
        },
    };

    const normalizeMode = value => value === 'skin' ? 'skin' : 'default';
    const skinEffect = skin => Object.hasOwn(SKIN_EFFECTS, skin) ? SKIN_EFFECTS[skin] : null;
    const resolve = (skin, mode) => normalizeMode(mode) === 'skin' && skinEffect(skin) ? skin : 'subtle';
    function description(skin) {
        const effect = skinEffect(skin);
        return effect ? `Own line-clear effect: ${effect.name}` : '';
    }

    function rowFrame(count, elapsed, duration, frame = {}) {
        const progress = duration > 0 ? clamp(elapsed / duration) : 1;
        const blockAlpha = 1 - clamp((progress - .42) / .58);
        frame.blockAlpha = blockAlpha;
        frame.tintAlpha = (.62 + .025 * (strength(count) - 1)) * clamp(progress / .42) * blockAlpha;
        return frame;
    }

    function emitParticles(profile, rows, board, colors, duration, random, acquire) {
        const count = (profile.span ? 12 : 5) + Math.floor((strength(rows.length) - 1) / 2);
        let emitted = 0;
        for (const row of rows) {
            const width = board[row].length;
            for (let index = 0; index < count; index++) {
                if (emitted++ === MAX_PARTICLES) return;
                const step = profile.stepped ? index % 3 : 0;
                const originX = (index + (profile.stepped ? .5 : .18 + random() * .64)) * width / count;
                const fleck = profile.fleck && index % 4 === 3;
                const shape = fleck ? 'square' : profile.shape || 'square';
                const particle = acquire();
                particle.x = originX;
                particle.y = row + (profile.stepped ? .3 + step * .17 : .37 + random() * .26);
                particle.vx = (random() - .5) * 2 * profile.drift;
                particle.vy = profile.lift * (.78 + random() * .44);
                particle.gravity = profile.gravity;
                particle.size = (fleck ? (profile.span ? .1 : .065) : profile.size) * (.7 + random() * .6);
                const rotates = shape !== 'square' && shape !== 'step';
                particle.angle = rotates ? (random() - .5) * 2 : 0;
                particle.spin = rotates ? (random() - .5) * 9 : 0;
                particle.shape = shape;
                particle.color = fleck ? profile.fleck : profile.bits[index % profile.bits.length];
                particle.edge = profile.outline || (profile.edge ? colors[board[row][Math.floor(originX)]] || '#9ba6b8' : null);
                particle.opacity = fleck ? .64 : .86;
                particle.delay = duration * ((profile.span ? .22 : .38) + step * .09 + random() * .13);
                const life = profile.life * (.82 + random() * .3);
                particle.life = profile.span ? Math.min(life, profile.span - particle.delay) : life;
                particle.elapsed = 0;
                particle.quantized = profile.rowMotion === 'pixels';
            }
        }
    }

    function createParticles(effect, rows, board, colors, duration, random = Math.random) {
        const particles = [];
        if (duration > 0) emitParticles(skinEffect(effect) || SUBTLE, rows, board, colors, duration, random, () => {
            const particle = {};
            particles.push(particle);
            return particle;
        });
        return particles;
    }

    function particleFrame(particle, elapsed, frame = {}) {
        if (elapsed < particle.delay || elapsed >= particle.delay + particle.life) return null;
        const age = elapsed - particle.delay;
        const time = age / 1000;
        frame.x = particle.x + particle.vx * time;
        frame.y = particle.y + particle.vy * time + .5 * particle.gravity * time * time;
        frame.angle = particle.angle + particle.spin * time;
        frame.progress = age / particle.life;
        frame.alpha = particle.opacity * clamp(age / 22) * (1 - frame.progress);
        return frame;
    }

    function drawParticle(ctx, particle, frame, block) {
        const centerX = (particle.quantized ? Math.round(frame.x * 8) / 8 : frame.x) * block;
        const centerY = (particle.quantized ? Math.round(frame.y * 8) / 8 : frame.y) * block;
        const size = particle.size * block;
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = frame.alpha;
        if (particle.shape === 'square') {
            ctx.fillRect(centerX - size / 2, centerY - size / 2, size, size);
            return;
        }
        if (particle.shape === 'dash') {
            ctx.globalAlpha *= Math.floor(frame.progress * 7) % 2 ? .52 : 1;
            ctx.fillRect(centerX - size, centerY, size * 2, size * .24);
            ctx.fillRect(centerX + size * .45, centerY - size * .52, size * .38, size * .38);
            return;
        }
        if (particle.shape === 'spark') {
            ctx.strokeStyle = particle.color;
            ctx.lineWidth = Math.max(1, size * .14);
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(centerX - particle.vx * size * .44, centerY - (particle.vy + particle.gravity * frame.progress * particle.life / 1000) * size * .44);
            ctx.stroke();
            return;
        }
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(frame.angle);
        ctx.beginPath();
        if (particle.shape === 'leaf') {
            const width = size * (.48 + .52 * Math.abs(Math.cos(frame.angle * 2)));
            ctx.moveTo(-width * .65, size * .25);
            ctx.lineTo(-width * .29, -size * .34);
            ctx.lineTo(width * .67, -size * .26);
            ctx.lineTo(width * .39, size * .29);
        } else if (particle.shape === 'step') {
            ctx.moveTo(-size, size * .45);
            ctx.lineTo(-size, 0);
            ctx.lineTo(-size * .28, 0);
            ctx.lineTo(-size * .28, -size * .46);
            ctx.lineTo(size * .6, -size * .46);
            ctx.lineTo(size * .6, size * .45);
        } else if (particle.shape === 'facet' || particle.shape === 'prism') {
            ctx.moveTo(0, -size * .78);
            ctx.lineTo(size * .62, size * .24);
            if (particle.shape === 'facet') ctx.lineTo(0, size * .71);
            ctx.lineTo(-size * .48, size * .33);
        } else if (particle.shape === 'drop') {
            const stretch = 1 + .3 * Math.sin(frame.progress * 14);
            ctx.ellipse(0, 0, size * .48 * stretch, size * .55 / stretch, 0, 0, Math.PI * 2);
        } else if (particle.shape === 'crumb') {
            ctx.ellipse(0, 0, size * .57, size * .29, 0, 0, Math.PI * 2);
        } else if (particle.shape === 'ring') {
            ctx.arc(0, 0, size * (.42 + frame.progress * .5), 0, Math.PI * 1.65);
            ctx.strokeStyle = particle.color;
            ctx.lineWidth = Math.max(1, size * .12);
            ctx.stroke();
            ctx.restore();
            return;
        } else {
            ctx.moveTo(-size * .54, size * .36);
            ctx.lineTo(-size * .35, -size * .27);
            ctx.lineTo(size * .56, -size * .52);
            ctx.lineTo(size * .37, size * .31);
        }
        ctx.closePath();
        ctx.fill();
        if (particle.shape === 'facet' || particle.shape === 'prism' || particle.shape === 'drop') {
            ctx.fillStyle = '#fff';
            ctx.globalAlpha *= .62;
            ctx.fillRect(-size * .16, -size * .24, size * .27, size * .15);
        }
        if (particle.edge) {
            ctx.strokeStyle = particle.edge;
            ctx.globalAlpha = frame.alpha * .16;
            ctx.lineWidth = block * .052;
            ctx.stroke();
            ctx.globalAlpha = frame.alpha * .57;
            ctx.lineWidth = block * .024;
            ctx.stroke();
        }
        ctx.restore();
    }

    function clipPixels(ctx, columns, top, block, progress) {
        const cell = block / 4;
        const remaining = Math.ceil(16 * (1 - clamp((progress - .12) / .88)));
        ctx.beginPath();
        for (let column = 0; column < columns; column++) {
            for (let index = 0; index < remaining; index++) {
                const pixel = (index * 7 + column * 5) % 16;
                ctx.rect(column * block + (pixel % 4) * cell, top + (pixel >> 2) * cell, cell, cell);
            }
        }
        ctx.clip();
    }

    function drawBlocks(ctx, row, values, block, drawBlock, motion, progress) {
        const top = row * block;
        for (let column = 0; column < values.length; column++) {
            if (motion === 'jelly' || motion === 'clay' || motion === 'bubble') {
                const wobble = Math.sin(progress * Math.PI * 3 + column * .42) * Math.sin(progress * Math.PI);
                const scaleY = motion === 'jelly' ? 1 + .32 * wobble : motion === 'clay' ? 1 - .76 * progress : 1 + .32 * progress;
                const scaleX = motion === 'jelly' ? 1 - .18 * wobble : motion === 'clay' ? 1 + .2 * progress : scaleY;
                const centerX = (column + .5) * block;
                const anchorY = top + (motion === 'clay' ? block : block / 2);
                ctx.save();
                ctx.translate(centerX, anchorY);
                ctx.scale(scaleX, scaleY);
                ctx.translate(-centerX, -anchorY);
                drawBlock(ctx, column, row, values[column], block);
                ctx.restore();
            } else {
                drawBlock(ctx, column, row, values[column], block);
            }
        }
    }

    function create(reducedMotion = root.matchMedia?.('(prefers-reduced-motion: reduce)')) {
        const particles = Array.from({ length: MAX_PARTICLES }, () => ({}));
        const rowState = {};
        const particleState = {};
        let first = 0, count = 0;
        let active = null;
        function acquire() {
            const slot = (first + count) % MAX_PARTICLES;
            if (count === MAX_PARTICLES) first = (first + 1) % MAX_PARTICLES;
            else count++;
            return particles[slot];
        }
        function reset() {
            active = null;
            first = count = 0;
        }
        return {
            start({ skin, mode, rows, board, colors, duration }) {
                active = null;
                if (reducedMotion?.matches || !(duration > 0) || !rows.length) return;
                const effect = resolve(skin, mode);
                active = { rows: new Set(rows), elapsed: 0, duration, profile: skinEffect(effect) || SUBTLE };
                emitParticles(active.profile, rows, board, colors, duration, Math.random, acquire);
            },
            advance(dt) {
                if (reducedMotion?.matches) { reset(); return; }
                if (!(dt > 0)) return;
                if (active) active.elapsed += dt;
                let kept = 0;
                for (let index = 0; index < count; index++) {
                    const slot = (first + index) % MAX_PARTICLES;
                    const particle = particles[slot];
                    particle.elapsed += dt;
                    if (particle.elapsed >= particle.delay + particle.life) continue;
                    const target = (first + kept++) % MAX_PARTICLES;
                    particles[slot] = particles[target];
                    particles[target] = particle;
                }
                count = kept;
            },
            drawRow(ctx, row, values, block, drawBlock) {
                if (!active?.rows.has(row)) return false;
                const { profile, elapsed, duration } = active;
                const { blockAlpha, tintAlpha } = rowFrame(active.rows.size, elapsed, duration, rowState);
                if (blockAlpha <= 0) return true;
                const progress = clamp(elapsed / duration);
                const top = row * block;
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, top, block * values.length, block);
                ctx.clip();
                const motion = profile.rowMotion;
                if (motion === 'pixels' && progress > .12) clipPixels(ctx, values.length, top, block, progress);
                const flicker = motion === 'neon' && Math.floor(progress * 8) % 3 === 2 ? .45 : 1;
                ctx.globalAlpha = blockAlpha * flicker;
                drawBlocks(ctx, row, values, block, drawBlock, motion, progress);
                if (tintAlpha > 0) {
                    ctx.globalAlpha = tintAlpha * (profile.span ? .72 : 1);
                    if (motion !== 'clay' && motion !== 'jelly' && motion !== 'bubble') {
                        ctx.fillStyle = flicker === 1 ? profile.tint : '#ff95e7';
                        for (let column = 0; column < values.length; column++) {
                            ctx.fillRect((column + .06) * block, top + block * .06, block * .88, block * .88);
                        }
                    }
                    if (profile.detail) {
                        ctx.strokeStyle = profile.detailColor;
                        ctx.lineWidth = block * .04;
                        ctx.beginPath();
                        for (let column = 0; column < values.length; column++) {
                            profile.detail(ctx, column * block, top, block, column);
                        }
                        ctx.stroke();
                    }
                }
                ctx.restore();
                return true;
            },
            drawParticles(ctx, block) {
                if (!count) return;
                ctx.save();
                for (let index = 0; index < count; index++) {
                    const particle = particles[(first + index) % MAX_PARTICLES];
                    const frame = particleFrame(particle, particle.elapsed, particleState);
                    if (frame?.alpha > 0) drawParticle(ctx, particle, frame, block);
                }
                ctx.restore();
            },
            finish() { active = null; },
            reset,
        };
    }

    root.LBLineClear = { MAX_PARTICLES, normalizeMode, resolve, description, rowFrame, createParticles, particleFrame, create };
})(globalThis);
