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
  move(cracked, [dim(0, 0), dim(.1, 0), dim(.22, 1), dim(.28, 1), dim(.33, 0), dim(.91, 0), dim(1, 1)]);
  move(restored, [dim(0, 1), dim(.1, 1), dim(.22, 0), dim(.73, 0), dim(.8, 1), dim(.91, 1), dim(1, 0)]);
  move(burst, [dim(0, 0), dim(.28, 0), dim(.33, 1), dim(.53, 1), dim(.61, 0), dim(.91, 0), dim(1, 1)]);
  move(top, [position(0, 0), position(.36, 0, 'cubic-bezier(.5,0,.9,.6)'),
    position(.52, block), position(.67, block, 'cubic-bezier(.2,.8,.35,1)'), position(.73, 0), position(1, 0)]);

  for (const shard of burst.querySelectorAll('[data-logo-shard]')) {
    const fromX = Number(shard.dataset.logoFromX);
    const fromY = Number(shard.dataset.logoFromY);
    const scatter = (offset, remaining, easing = 'linear') => ({
      offset, easing,
      transform: `translate(${fromX * remaining}px, ${fromY * remaining}px)`,
    });
    move(shard, [scatter(0, 1), scatter(.28, 1, 'cubic-bezier(.1,.55,.35,1)'), scatter(.53, 0), scatter(1, 0)]);
  }

  activeClears.set(svg, animations);
  await Promise.allSettled(animations.map(animation => animation.finished));
  if (activeClears.get(svg) === animations) {
    animations.forEach(animation => animation.cancel());
    activeClears.delete(svg);
  }
}
