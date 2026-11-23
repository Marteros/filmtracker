import fs from 'node:fs';
const md = fs.readFileSync('PRIVACY.md', 'utf8');
const html = fs.readFileSync('public/privacy.html', 'utf8');
const mdHeadings = [...md.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim());
const htmlHeadings = [...html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map((m) => m[1].trim());
const same = mdHeadings.length === htmlHeadings.length && mdHeadings.every((h, i) => h === htmlHeadings[i]);
if (!same) {
  console.error('Privacy headings differ');
  console.error('MD:', mdHeadings);
  console.error('HTML:', htmlHeadings);
  process.exit(1);
}
console.log('Privacy headings OK');
