import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
const root = resolve('..');
const files = [
  resolve(root, '乡村适老化建设辅助工作台项目总纲.md'),
  resolve('docs/乡村适老化建设辅助工作台项目总纲.md'),
];
const entries: any[] = [];
const seen = new Set<string>();
for (const path of files) {
  const text = await readFile(path, 'utf8');
  const sections = text.split(/(?=^#{1,3} )/m);
  for (let i = 0; i < sections.length; i++) {
    const raw = sections[i].trim();
    if (raw.length < 60 || seen.has(raw)) continue;
    seen.add(raw);
    const title = raw.split('\n')[0].replace(/^#+\s*/, '');
    for (let offset = 0; offset < raw.length; offset += 1600)
      entries.push({
        id: `local-${entries.length + 1}`,
        title,
        source_title: basename(path),
        source_path: path,
        locator: `第 ${i + 1} 节，字符 ${offset + 1}—${Math.min(raw.length, offset + 1600)}`,
        text: raw.slice(offset, offset + 1600),
        category: 'project_method',
        authority: '用户项目方案；非规范、非效果证明',
        verified: false,
      });
  }
}
const paragraphs: string[] = JSON.parse(
  await readFile('work/plan-docx-paragraphs.json', 'utf8'),
);
for (let i = 0; i < paragraphs.length; i += 12) {
  const text = paragraphs
    .slice(i, i + 12)
    .map((p, n) => `[段${i + n + 1}] ${p}`)
    .join('\n');
  if (text.length < 80) continue;
  entries.push({
    id: `docx-${i + 1}`,
    title:
      paragraphs
        .slice(i, i + 12)
        .find((p) => p.length > 5)
        ?.slice(0, 70) ?? '调试工作区方法',
    source_title: '调试工作区方案说明 V1.0',
    source_path: resolve(
      root,
      '乡村适老化建设辅助工作台_调试工作区方案说明_V1.0.docx',
    ),
    locator: `段落 ${i + 1}—${Math.min(i + 12, paragraphs.length)}`,
    text,
    category: 'project_method',
    authority: '用户项目方案；字段示例并非工程阈值，非规范或实施效果证明',
    verified: false,
  });
}
await mkdir('work', { recursive: true });
await writeFile('work/knowledge.json', JSON.stringify(entries, null, 2), {
  mode: 0o600,
});
console.log(
  JSON.stringify({
    indexed: entries.length,
    sources: files.map((p) => basename(p)),
  }),
);
