gsap.registerPlugin(ScrollTrigger, SplitText);

const lenis = new Lenis({ anchors: true });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add(time => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const runningSection = document.querySelector('.masthead__section');

for (const section of document.querySelectorAll('main > section')) {
  ScrollTrigger.create({
    trigger: section,
    start: 'top center',
    end: 'bottom center',
    onToggle: self => {
      if (self.isActive) {
        runningSection.textContent = section.dataset.title;
        document.body.dataset.section = section.id;
      }
    },
  });
}

const morph = 1;
const toCrystal = 2;
const toForest = 5;
const hold = 2;
const forms = gsap.utils.toArray('.forms__form');
const chapters = gsap.utils.toArray('.forms__chapter');

const formsTimeline = gsap.timeline({
  defaults: { duration: morph, ease: 'none' },
  scrollTrigger: {
    trigger: '.forms',
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: () => {
      const time = formsTimeline.time();
      document.body.dataset.tone = time > toCrystal + morph / 2 && time < toForest + morph / 2 ? 'light' : 'dark';
    },
  },
});

formsTimeline
  .fromTo('.forms__watch', { scale: 1 }, { scale: 1.05, duration: toForest + morph + hold }, 0)
  .to([forms[1], '.forms__ground--crystal'], { opacity: 1 }, toCrystal)
  .to(chapters[0], { opacity: 0, duration: morph / 2 }, toCrystal)
  .to(chapters[1], { opacity: 1, duration: morph / 2 }, toCrystal + morph / 2)
  .to([forms[2], '.forms__ground--forest'], { opacity: 1 }, toForest)
  .set('.forms__ground--crystal', { opacity: 0 }, toForest + morph)
  .to(chapters[1], { opacity: 0, duration: morph / 2 }, toForest)
  .to(chapters[2], { opacity: 1, duration: morph / 2 }, toForest + morph / 2);

const caseStage = document.querySelector('.case__stage');
const caseStrip = document.querySelector('.case__strip');

gsap.to(caseStrip, {
  x: () => caseStage.clientWidth - caseStrip.offsetWidth,
  ease: 'none',
  scrollTrigger: { trigger: '.case', start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true },
});

if (reduceMotion) {
  document.querySelector('.prologue__film').pause();
} else {
  document.fonts.load('900 1em Montserrat').then(() => {
    gsap
      .timeline({ defaults: { ease: 'power2.out' } })
      .to('.prologue__film', { opacity: 1, duration: 1.6 })
      .to('.prologue__title span', { opacity: 1, filter: 'blur(0px)', duration: 1.2, stagger: 0.15 }, 0.2)
      .to(['.prologue__subtitle', '.prologue__facts', '.masthead'], { opacity: 1, duration: 0.8 }, 1);
  });

  for (const video of document.querySelectorAll('.causeway video')) {
    ScrollTrigger.create({ trigger: video, onToggle: self => (self.isActive ? video.play() : video.pause()) });
  }

  for (const text of document.querySelectorAll('.intro__text, .twelve__statement')) {
    gsap.from(SplitText.create(text, { type: 'words' }).words, {
      opacity: 0.15,
      stagger: 0.1,
      ease: 'none',
      scrollTrigger: { trigger: text, start: 'top 80%', end: 'bottom 55%', scrub: true },
    });
  }

  const bleed = document.querySelector('.forest .plate__image');

  gsap
    .timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: bleed, start: 'top bottom', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true },
    })
    .fromTo(bleed, { clipPath: () => `inset(0px ${-parseFloat(getComputedStyle(bleed.parentElement).marginLeft)}px)` }, { clipPath: 'inset(0px 0px)' })
    .fromTo(bleed.querySelector('img'), { scale: 1.08 }, { scale: 1 }, 0);

  gsap.set('.causeway li', { opacity: 0 });

  const causewayObserver = new IntersectionObserver(
    entries => {
      if (entries[0].isIntersecting) {
        causewayObserver.disconnect();
        gsap.to('.causeway li', { opacity: 1, duration: 0.9, stagger: 0.08, ease: 'power2.out' });
      }
    },
    { threshold: 0.2 },
  );

  causewayObserver.observe(document.querySelector('.causeway'));

  gsap.fromTo(
    '.movement__plate img',
    { '--reveal': '-12%' },
    { '--reveal': '100%', ease: 'none', scrollTrigger: { trigger: '.movement__plate', start: 'top 85%', end: 'top 25%', scrub: true } },
  );

  const plates = gsap.utils.toArray('.twelve .plate__image, .case .plate__image, .oath .plate__image, .seat .plate__image');
  gsap.set(plates, { opacity: 0, clipPath: 'inset(8% 8% 8% 8%)' });
  gsap.set(plates.map(plate => plate.querySelector('img')), { scale: 1.2 });

  const plateObserver = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          plateObserver.unobserve(entry.target);
          gsap
            .timeline({ defaults: { duration: 1.8, ease: 'expo.out' } })
            .to(entry.target, { opacity: 1, duration: 1, ease: 'power2.out' })
            .to(entry.target, { clipPath: 'inset(0% 0% 0% 0%)' }, 0)
            .to(entry.target.querySelector('img'), { scale: 1, duration: 2.4 }, 0);
        }
      }
    },
    { threshold: 0.2 },
  );

  for (const plate of plates) {
    plateObserver.observe(plate);
  }
}

const seatForm = document.querySelector('.seat__form');
const seatThanks = document.querySelector('.seat__thanks');

seatForm.addEventListener('submit', event => {
  event.preventDefault();
  seatThanks.querySelector('.seat__name').textContent = new FormData(seatForm).get('name').trim();
  seatForm.hidden = true;
  seatThanks.hidden = false;
});
