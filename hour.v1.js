/* The hour — which part of the day the sky opens on.

   The sky cycles through six times of day (the sky's script), and a visit opens
   on the visitor's own: night 21-05, dawn 05-08, day 08-13, rain 13-16,
   sunset 16-19, dusk 19-21. This reads the clock, once, here and nowhere
   else, and marks the page before its first paint: data-sky (which time
   of day: the stylesheet's still sky and its words' colours) and
   data-sky-at (how far through that time of day, 0-1: the sky opens that
   far through it), and the browser's bars take the top of that sky
   (theme-color). Without it the page is the still day sky. */
(function () {
  var d = new Date(), h = d.getHours() + d.getMinutes() / 60;
  var DAY = [['dawn', 5, 8, '#b0a9d3'], ['day', 8, 13, '#70b6ea'], ['rain', 13, 16, '#809aa9'], ['sunset', 16, 19, '#c5a4c4'], ['dusk', 19, 21, '#1a3132'], ['night', 21, 29, '#0d1842']];
  var i, a, b, at, meta = document.querySelector('meta[name="theme-color"]');
  if (h < 5) h += 24;
  for (i = 0; i < DAY.length; i++) {
    a = DAY[i][1]; b = DAY[i][2];
    if (h >= a && h < b) break;
  }
  if (i === DAY.length) i = DAY.length - 1;
  at = Math.min(0.999, Math.max(0, (h - DAY[i][1]) / (DAY[i][2] - DAY[i][1])));
  document.documentElement.setAttribute('data-sky', DAY[i][0]);
  document.documentElement.setAttribute('data-sky-at', at.toFixed(3));
  if (meta) meta.setAttribute('content', DAY[i][3]);      // (the browser's own bars, the top of that still sky)
})();
