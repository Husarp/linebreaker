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
    };

    const normalizeMode = value => value === 'skin' ? 'skin' : 'default';
    const skinEffect = skin => Object.hasOwn(SKIN_EFFECTS, skin) ? SKIN_EFFECTS[skin] : null;
    const resolve = (skin, mode) => normalizeMode(mode) === 'skin' && skinEffect(skin) ? skin : 'subtle';
    function description(skin) {
        const effect = skinEffect(skin);
        return effect ? `Own line-clear effect: ${effect.name}` : '';
    }

    function rowFrame(count, elapsed, duration) {
        const progress = duration > 0 ? clamp(elapsed / duration) : 1;
        const blockAlpha = 1 - clamp((progress - .42) / .58);
        const tintAlpha = (.62 + .025 * (strength(count) - 1)) * clamp(progress / .42) * blockAlpha;
        return { blockAlpha, tintAlpha };
    }

    function createParticles(effect, rows, board, colors, duration, random = Math.random) {
        const particles = [];
        if (!(duration > 0)) return particles;
        const profile = skinEffect(effect) || SUBTLE;
        const count = 5 + Math.floor((strength(rows.length) - 1) / 2);
        for (const row of rows) {
            const width = board[row].length;
            for (let index = 0; index < count && particles.length < MAX_PARTICLES; index++) {
                const step = profile.stepped ? index % 3 : 0;
                const originX = (index + (profile.stepped ? .5 : .18 + random() * .64)) * width / count;
                const fleck = profile.fleck && index % 4 === 3;
                const shape = fleck ? 'square' : profile.shape || 'square';
                particles.push({
                    x: originX, y: row + (profile.stepped ? .3 + step * .17 : .37 + random() * .26),
                    vx: (random() - .5) * 2 * profile.drift,
                    vy: profile.lift * (.78 + random() * .44), gravity: profile.gravity,
                    size: (fleck ? .065 : profile.size) * (.7 + random() * .6),
                    angle: shape === 'square' ? 0 : (random() - .5) * 2,
                    spin: shape === 'square' ? 0 : (random() - .5) * 9,
                    shape, color: fleck ? profile.fleck : profile.bits[index % profile.bits.length],
                    edge: profile.edge ? colors[board[row][Math.floor(originX)]] || '#9ba6b8' : null,
                    opacity: fleck ? .64 : .86,
                    delay: duration * (.38 + step * .09 + random() * .13),
                    life: profile.life * (.82 + random() * .3), elapsed: 0,
                });
            }
            if (particles.length === MAX_PARTICLES) break;
        }
        return particles;
    }

    function particleFrame(particle, elapsed) {
        if (elapsed < particle.delay || elapsed >= particle.delay + particle.life) return null;
        const age = elapsed - particle.delay;
        const time = age / 1000;
        return {
            x: particle.x + particle.vx * time,
            y: particle.y + particle.vy * time + .5 * particle.gravity * time * time,
            angle: particle.angle + particle.spin * time,
            alpha: particle.opacity * clamp(age / 22) * (1 - age / particle.life),
        };
    }

    function drawParticle(ctx, particle, frame, block) {
        const centerX = frame.x * block, centerY = frame.y * block;
        const size = particle.size * block;
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = frame.alpha;
        if (particle.shape === 'square') {
            ctx.fillRect(centerX - size / 2, centerY - size / 2, size, size);
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
        } else {
            ctx.moveTo(-size * .54, size * .36);
            ctx.lineTo(-size * .35, -size * .27);
            ctx.lineTo(size * .56, -size * .52);
            ctx.lineTo(size * .37, size * .31);
        }
        ctx.closePath();
        ctx.fill();
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

    function create(reducedMotion = root.matchMedia?.('(prefers-reduced-motion: reduce)')) {
        const particles = [];
        let active = null;
        function reset() {
            active = null;
            particles.length = 0;
        }
        return {
            start({ skin, mode, rows, board, colors, duration }) {
                active = null;
                if (reducedMotion?.matches || !(duration > 0) || !rows.length) return;
                const effect = resolve(skin, mode);
                active = { rows: new Set(rows), elapsed: 0, duration, profile: skinEffect(effect) || SUBTLE };
                const burst = createParticles(effect, rows, board, colors, duration);
                const overflow = particles.length + burst.length - MAX_PARTICLES;
                if (overflow > 0) particles.splice(0, overflow);
                particles.push(...burst);
            },
            advance(dt) {
                if (reducedMotion?.matches) { reset(); return; }
                if (!(dt > 0)) return;
                if (active) active.elapsed += dt;
                for (let index = particles.length - 1; index >= 0; index--) {
                    const particle = particles[index];
                    particle.elapsed += dt;
                    if (particle.elapsed >= particle.delay + particle.life) particles.splice(index, 1);
                }
            },
            drawRow(ctx, row, values, block, drawBlock) {
                if (!active?.rows.has(row)) return false;
                const { profile, elapsed, duration } = active;
                const { blockAlpha, tintAlpha } = rowFrame(active.rows.size, elapsed, duration);
                if (blockAlpha <= 0) return true;
                const top = row * block;
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, top, block * values.length, block);
                ctx.clip();
                ctx.globalAlpha = blockAlpha;
                values.forEach((value, column) => drawBlock(ctx, column, row, value, block));
                if (tintAlpha > 0) {
                    ctx.globalAlpha = tintAlpha;
                    ctx.fillStyle = profile.tint;
                    for (let column = 0; column < values.length; column++) {
                        ctx.fillRect((column + .06) * block, top + block * .06, block * .88, block * .88);
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
                if (!particles.length) return;
                ctx.save();
                for (const particle of particles) {
                    const frame = particleFrame(particle, particle.elapsed);
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
