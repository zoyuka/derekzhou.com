/* Email obfuscation */
(function () {
  var user = 'hello';
  var domain = 'derekzhou.com';
  var link = document.getElementById('email-link');
  if (link) {
    link.href = 'mailto:' + user + '@' + domain;
  }
})();

/* Scroll reveal */
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var sections = document.querySelectorAll('[data-reveal]');
  if (!sections.length) return;

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  sections.forEach(function (section, i) {
    section.style.transitionDelay = (i * 0.1) + 's';
    observer.observe(section);
  });
})();
