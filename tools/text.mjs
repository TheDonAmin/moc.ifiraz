import fs from 'node:fs';

for (const file of process.argv.slice(2)) {
  let h = fs.readFileSync(file, 'utf8');
  h = h.replace(/<!--[\s\S]*?-->/g, '')
       .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  const body = (h.match(/<body\b[^>]*>([\s\S]*)<\/body>/i) || [, h])[1];
  const text = body
    .replace(/<\/(p|div|h[1-6]|li|section|header|footer|br)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&#8217;|&rsquo;/g, "'").replace(/&#8211;|&ndash;/g, '-')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
    .join('\n');
  console.log('##########', file);
  console.log(text.slice(0, 1100));
  console.log();
}
