'use client';
import { useEffect, useState } from 'react';
import { request } from '../lib/v2/client';
export default function VillageKnowledge({
  connected,
}: {
  connected: boolean;
}) {
  const [q, setQ] = useState(''),
    [rows, setRows] = useState<any[]>([]),
    [error, setError] = useState('');
  async function search(query: string) {
    try {
      setRows(
        await request('/api/v1/knowledge?q=' + encodeURIComponent(query)),
      );
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '读取失败');
    }
  }
  useEffect(() => {
    if (connected) void search('');
  }, [connected]);
  return (
    <section className="v2-section">
      <h2>适老化知识库</h2>
      <p>
        本地材料按原文片段检索，AI
        引用保留出处。项目方法、规范和实施案例分开判断。
      </p>
      {connected ? (
        <>
          <form
            className="v2-actions"
            onSubmit={(e) => {
              e.preventDefault();
              void search(q);
            }}
          >
            <input
              aria-label="检索适老化知识"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="道路宽度、休息、照明、助餐…"
            />
            <button>检索知识</button>
          </form>
          {error && <p role="alert">{error}</p>}
          <div className="v2-grid">
            {rows.map((r) => (
              <article key={r.id} className="v2-card">
                <b>{r.title}</b>
                <small>
                  {r.source_title} · {r.locator}
                </small>
                <p>{r.authority}</p>
                <details>
                  <summary>阅读原文</summary>
                  <blockquote style={{ whiteSpace: 'pre-wrap' }}>
                    {r.text}
                  </blockquote>
                </details>
              </article>
            ))}
          </div>
          {!rows.length && !error && (
            <p>没有匹配材料，请换用资料中的关键词。</p>
          )}
        </>
      ) : (
        <p>连接业务服务后读取本地知识库。</p>
      )}
    </section>
  );
}
