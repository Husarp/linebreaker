const activeClears = new WeakMap();

export async function playLogoClear(svg) {
  for (const animation of activeClears.get(svg) ?? []) animation.cancel();
  activeClears.delete(svg);

  const view = svg.ownerDocument.defaultView;
  if (!svg.animate || view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const block = Number(svg.dataset.logoBlock);
  const top = svg.querySelector('[data-logo-top]');
  const cracked = svg.querySelector('[data-logo-cracked]');
  const restored = svg.querySelector('[data-logo-restored]');
  const burst = svg.querySelector('[data-logo-burst]');
  if (!block || !top || !cracked || !restored || !burst) return;

  const animations = [];
  const move = (target, frames) => {
    animations.push(target.animate(frames, { duration: 2100, fill: 'both' }));
  };
  const dim = (offset, opacity) => ({ offset, opacity });
  const position = (offset, y, easing = 'linear') => ({ offset, transform: `translateY(${y}px)`, easing });
  move(cracked, [dim(0, 0), dim(.1, 0), dim(.22, 1), dim(.3, 1), dim(.33, 0), dim(.91, 0), dim(.98, 1)]);
  move(restored, [dim(0, 1), dim(.12, 1), dim(.23, 0), dim(.73, 0), dim(.79, 1), dim(.91, 1), dim(.98, 0)]);
  move(burst, [dim(0, 0), dim(.3, 0), dim(.33, 1), dim(.54, 1), dim(.61, 0), dim(1, 0)]);
  move(top, [position(0, 0), position(.36, 0, 'cubic-bezier(.5,0,.9,.6)'),
    position(.52, block), position(.67, block, 'cubic-bezier(.2,.8,.35,1)'), position(.78, 0), position(1, 0)]);

  for (const shard of burst.querySelectorAll('[data-logo-shard]')) {
    const side = Number(shard.dataset.logoShard);
    const drift = Number(shard.dataset.logoDrift);
    const scatter = (offset, distance, easing = 'linear') => ({
      offset, easing,
      transform: `translate(${block * drift * distance}px, ${block * side * distance * (1.9 + Math.abs(drift) * .7)}px)`,
    });
    move(shard, [scatter(0, 0), scatter(.3, 0, 'cubic-bezier(.1,.55,.35,1)'), scatter(.61, 1), scatter(1, 1)]);
  }

  activeClears.set(svg, animations);
  await Promise.allSettled(animations.map(animation => animation.finished));
  if (activeClears.get(svg) === animations) {
    animations.forEach(animation => animation.cancel());
    activeClears.delete(svg);
  }
}
