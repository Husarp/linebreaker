const activeClears = new WeakMap();

export async function playLogoClear(svg) {
  for (const animation of activeClears.get(svg) ?? []) animation.cancel();
  activeClears.delete(svg);

  const view = svg.ownerDocument.defaultView;
  if (!svg.animate || view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const block = Number(svg.dataset.logoBlock);
  const top = svg.querySelector('[data-logo-top]');
  const glow = svg.querySelector('[data-logo-glow]');
  const restored = svg.querySelector('[data-logo-restored]');
  if (!block || !top || !glow || !restored) return;

  const animations = [];
  const move = (target, frames) => {
    animations.push(target.animate(frames, { duration: 1700, fill: 'both' }));
  };
  const dim = (offset, opacity) => ({ offset, opacity });
  const position = (offset, y, easing = 'linear') => ({ offset, transform: `translateY(${y}px)`, easing });
  const restGlow = Number(glow.getAttribute('opacity'));
  move(glow, [dim(0, restGlow), dim(.19, 1), dim(.32, 0), dim(.8, 0), dim(1, restGlow)]);
  move(restored, [dim(0, 0), dim(.64, 0), dim(.79, 1), dim(.84, 1), dim(1, 0)]);
  move(top, [position(0, 0), position(.34, 0, 'cubic-bezier(.5,0,.9,.6)'),
    position(.5, block), position(.64, block, 'cubic-bezier(.2,.8,.35,1)'), position(.79, 0), position(1, 0)]);

  for (const shard of svg.querySelectorAll('[data-logo-shard]')) {
    const side = Number(shard.dataset.logoShard);
    const drift = Number(shard.dataset.logoDrift);
    const burst = (offset, distance, opacity, easing = 'linear') => ({
      offset, opacity, easing,
      transform: `translate(${block * drift * distance * .7}px, ${block * side * distance * 2.6}px)`,
    });
    move(shard, [burst(0, 0, 1), burst(.19, 0, 1, 'cubic-bezier(.1,.75,.25,1)'),
      burst(.42, 1, 0), burst(.43, 0, 0), burst(.83, 0, 0), burst(1, 0, 1)]);
  }

  activeClears.set(svg, animations);
  await Promise.allSettled(animations.map(animation => animation.finished));
  if (activeClears.get(svg) === animations) {
    animations.forEach(animation => animation.cancel());
    activeClears.delete(svg);
  }
}
