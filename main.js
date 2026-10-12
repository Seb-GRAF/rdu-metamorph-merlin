gsap.registerPlugin(ScrollTrigger, SplitText);

const lenis = new Lenis({ anchors: true });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add(time => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const menu = document.querySelector('.menu');

document.querySelector('.masthead__menu').addEventListener('click', () => {
  menu.showModal();
  lenis.stop();
});

menu.querySelector('.menu__close').addEventListener('click', () => menu.close());

menu.addEventListener('click', event => {
  if (event.target === menu) menu.close();
});

menu.addEventListener('close', () => lenis.start());

const wishlist = document.querySelector('.hero__wishlist');
let wished = false;

wishlist.addEventListener('click', () => {
  wished = !wished;
  wishlist.firstChild.nodeValue = wished ? 'Added to wishlist' : 'Add to wishlist';
  wishlist.querySelector('use').setAttribute('href', `assets/icons.svg#${wished ? 'heart-full' : 'heart'}`);
});

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

const film = document.querySelector('.film__video');
const filmToggle = document.querySelector('.film__toggle');
let filmWanted = !reduceMotion;

const showFilmState = () => {
  filmToggle.setAttribute('aria-label', film.paused ? 'Play the film' : 'Pause the film');
  filmToggle.querySelector('use').setAttribute('href', `assets/icons.svg#${film.paused ? 'play' : 'pause'}-20`);
};

film.addEventListener('play', showFilmState);
film.addEventListener('pause', showFilmState);

filmToggle.addEventListener('click', () => {
  filmWanted = film.paused;
  if (filmWanted) film.play();
  else film.pause();
});

ScrollTrigger.create({
  trigger: '.film',
  onToggle: self => (self.isActive && filmWanted ? film.play() : film.pause()),
});

const release = document.querySelector('.release');
const straps = release.querySelectorAll('.release__strap');
const fitStrap = () => {
  const choice = release.querySelector(':checked').value;
  for (const strap of straps) strap.classList.toggle('release__strap--fitted', strap.dataset.strap === choice);
};

release.addEventListener('change', fitStrap);

const clock = document.querySelector('.footer__clock time');
const genevaTime = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Zurich', hour: '2-digit', minute: '2-digit' });
const showGenevaTime = () => (clock.textContent = genevaTime.format(new Date()));

showGenevaTime();
setInterval(showGenevaTime, 1000);

if (!reduceMotion) {
  const hero = document.querySelector('.hero');
  const soldier = hero.querySelector('.hero__soldier');
  const sheen = hero.querySelector('.hero__sheen');
  const light = { x: -40, y: 30 };
  const paintLight = () => {
    sheen.style.setProperty('--x', `${light.x}%`);
    sheen.style.setProperty('--y', `${light.y}%`);
  };
  const lightX = gsap.quickTo(light, 'x', { duration: 1.2, ease: 'power3', onUpdate: paintLight });
  const lightY = gsap.quickTo(light, 'y', { duration: 1.2, ease: 'power3', onUpdate: paintLight });
  const followPointer = event => {
    const box = sheen.getBoundingClientRect();
    lightX(((event.clientX - box.left) / box.width) * 100);
    lightY(((event.clientY - box.top) / box.height) * 100);
  };

  gsap.to('.hero__watch', { '--light': 1, duration: 1.8, ease: 'power2.inOut' });
  hero.addEventListener('pointermove', followPointer);

  Promise.all([document.fonts.load('900 1em Montserrat'), soldier.decode()]).then(() => {
    const split = SplitText.create('.hero__info > *', { type: 'lines' });

    gsap
      .timeline({ defaults: { ease: 'power2.out' } })
      .set('.hero__info', { opacity: 1 })
      .fromTo([soldier, sheen], { opacity: 0, filter: 'blur(12px)' }, { opacity: 1, filter: 'blur(0px)', duration: 1.6, clearProps: 'filter' }, 0)
      .from(soldier, { scale: 1.03, duration: 2 }, 0)
      .fromTo(
        [...split.lines, '.hero__edition', '.hero__actions', '.masthead'],
        { opacity: 0, filter: 'blur(6px)' },
        { opacity: 1, filter: 'blur(0px)', duration: 1.1, stagger: 0.06, clearProps: 'filter', onComplete: () => split.revert() },
        0.3,
      );
  });

  gsap.to('.hero__watch', {
    yPercent: 8,
    ease: 'none',
    scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
  });

  gsap
    .timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: '.film', start: 'top bottom', end: 'bottom bottom', scrub: true },
    })
    .fromTo('.film__frame', { clipPath: 'inset(14% 20%)' }, { clipPath: 'inset(0% 0%)' })
    .fromTo(film, { scale: 1.2 }, { scale: 1 }, 0);

  for (const text of document.querySelectorAll('.intro__text, .oath__quote p')) {
    gsap.from(SplitText.create(text, { type: 'words' }).words, {
      opacity: 0.15,
      stagger: 0.1,
      ease: 'none',
      scrollTrigger: { trigger: text, start: 'top 80%', end: 'bottom 55%', scrub: true },
    });
  }

  for (const frame of document.querySelectorAll('.forest__plate .plate__image, .twelve__knight .plate__image')) {
    const image = frame.querySelector('img');

    gsap.fromTo(
      image,
      { y: () => frame.clientHeight - image.offsetHeight },
      { y: 0, ease: 'none', scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true } },
    );
  }

  release.querySelector('.release__strap--fitted').classList.remove('release__strap--fitted');
  ScrollTrigger.create({ trigger: '.release__watch', start: 'top 70%', once: true, onEnter: fitStrap });

  const plates = gsap.utils.toArray('.case .plate__image, .oath .plate__image, .inquiry .plate__image');
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

  const wordmark = document.querySelector('.footer__wordmark');
  const glint = wordmark.querySelector('radialGradient');
  const glintPosition = { x: Number(glint.getAttribute('cx')) };
  const moveGlint = gsap.quickTo(glintPosition, 'x', { duration: 1.4, ease: 'power3', onUpdate: () => glint.setAttribute('cx', glintPosition.x) });

  document.querySelector('.footer').addEventListener('pointermove', event => {
    const box = wordmark.getBoundingClientRect();
    moveGlint(((event.clientX - box.left) / box.width) * 160);
  });
}

const inquiryForm = document.querySelector('.inquiry__form');
const inquiryThanks = document.querySelector('.inquiry__thanks');

inquiryForm.addEventListener('submit', event => {
  event.preventDefault();
  inquiryThanks.querySelector('.inquiry__name').textContent = new FormData(inquiryForm).get('first-name').trim();
  inquiryForm.hidden = true;
  inquiryThanks.hidden = false;
});
