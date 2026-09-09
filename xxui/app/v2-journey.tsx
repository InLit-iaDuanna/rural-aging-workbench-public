'use client';
import StreetJourney from './v2-street';
import { useEffect, useState } from 'react';
import {
  Leaf,
  ArrowRight,
  Check,
  MapPin,
  MessageCircle,
  Download,
  HelpCircle,
  LoaderCircle,
} from 'lucide-react';
import { api, request } from '../lib/v2/client';
import TencentLocation from './v2-map';
import './v2.css';
import './journey.css';
const labels = ['定位村庄', '初始化档案', '采集与分析', '查看下一步'];
const focusOptions = [
  '步行通行',
  '休息设施',
  '助餐服务',
  '夜间照明',
  '公共活动',
];
const emptySetup = {
  goal: '',
  area: '',
  route: '',
  observations: '',
  focus: [] as string[],
};
export default function VillageJourney({
  onAdvanced,
}: {
  onAdvanced: () => void;
}) {
  const [ready, setReady] = useState(false),
    [signed, setSigned] = useState(false),
    [welcome, setWelcome] = useState(true),
    [step, setStep] = useState(0),
    [project, setProject] = useState<any>(null),
    [projects, setProjects] = useState<any[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [run, setRun] = useState<any>(null),
    [question, setQuestion] = useState(''),
    [elapsed, setElapsed] = useState(0),
    [history, setHistory] = useState<any[] | null>(null),
    [setup, setSetup] = useState(emptySetup);
  async function guard(fn: () => Promise<any>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作未完成，请重试');
    } finally {
      setBusy(false);
    }
  }
  async function load() {
    try {
      await request('/api/v1/me');
      setSigned(true);
      setProjects(await request('/api/v1/projects'));
    } catch (e: any) {
      if (e.status !== 401) setError(e.message);
      setSigned(false);
    } finally {
      setReady(true);
    }
  }
  useEffect(() => {
    setWelcome(localStorage.getItem('xiangzhu-intro') !== 'seen');
    void load();
  }, []);
  function dismiss() {
    setWelcome(false);
    localStorage.setItem('xiangzhu-intro', 'seen');
  }
  async function openProject(p: any) {
    const full = await api(p.id, '');
    setProject(full);
    setSetup(full.initialization ?? emptySetup);
    setRun(null);
    setHistory(null);
    setStep(full.initialization ? 2 : 1);
    setQuestion(full.initialization?.goal ?? '');
    dismiss();
  }
  async function saveLocation(location: any, create: boolean) {
    const p = create
      ? await request('/api/v1/projects', {
          method: 'POST',
          body: JSON.stringify({
            name: location.name,
            mode: 'reality',
            geographic_location: location,
          }),
        })
      : await api(
          project.id,
          '/location',
          { base_version: project.location_version, location },
          'PUT',
        );
    setProjects(await request('/api/v1/projects'));
    await openProject(p);
    setStep(1);
  }
  async function initialize() {
    await guard(async () => {
      const p = await api(
        project.id,
        '/initialization',
        { base_version: project.initialization_version, data: setup },
        'PUT',
      );
      setProject(p);
      setQuestion(setup.goal);
      setStep(2);
    });
  }
  async function analyze() {
    await guard(async () => {
      const r = await api(project.id, '/runs', {
        type: 'consultation',
        instruction: question,
      });
      setRun(await api(project.id, '/runs/' + r.run_id));
      setElapsed(0);
      setStep(2);
    });
  }
  const running =
    run && !['completed', 'failed', 'cancelled', 'stale'].includes(run.status);
  useEffect(() => {
    if (!running || !project) return;
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const r = await api(project.id, '/runs/' + run.id);
        if (stopped) return;
        setRun(r);
        setElapsed((v) => v + 2);
        if (r.status === 'completed') setStep(3);
      } catch (e) {
        if (!stopped) setError(e instanceof Error ? e.message : '读取进度失败');
      }
    }, 2000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [running, run?.id, project?.id]);
  const missing = [
    ...new Set<string>([
      ...(run?.result?.analysis?.missing_fields ?? []),
      ...(run?.result?.review?.missing_fields ?? []),
    ]),
  ];
  function exportResult() {
    const text = [
      '# ' + project.name + ' · 本次体验记录',
      '地址：' + project.geographic_location.address,
      '目标：' + setup.goal,
      '范围：' + setup.area,
      '## AI 建议',
      run.result.analysis.summary,
      '## 独立复核',
      run.result.review.summary,
      '## 下一步核查',
      ...missing.map((x) => '- ' + x),
      '本次记录为辅助建议，待核查信息不代表已确认事实。',
    ].join('\n\n');
    const u = URL.createObjectURL(
      new Blob([text], { type: 'text/markdown;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = u;
    a.download = project.name + '-体验记录.md';
    a.click();
    URL.revokeObjectURL(u);
  }
  return (
    <div className="v2-app journey">
      <header className="journey-header">
        <a className="journey-brand" href="/">
          <Leaf size={20} />
          乡筑<span>村庄工作台</span>
        </a>
        <div>
          <button onClick={() => setWelcome((v) => !v)}>
            <HelpCircle size={16} />
            使用指引
          </button>
          <button onClick={onAdvanced}>专业工作台</button>
        </div>
      </header>
      <main className="journey-main">
        {welcome && (
          <aside className="journey-intro">
            <div>
              <b>第一次来，从你的村庄开始。</b>
              <p>
                先找位置并建档，再沿路定位拍照。AI
                会给出建议，并整理下一步需要核查的事。
              </p>
            </div>
            <button className="primary" onClick={dismiss}>
              我知道了
              <ArrowRight size={16} />
            </button>
          </aside>
        )}
        <nav className="journey-steps" aria-label="体验步骤">
          {labels.map((label, i) => (
            <button
              key={label}
              aria-current={step === i ? 'step' : undefined}
              disabled={
                !signed ||
                (i > 0 && !project) ||
                (i > 1 && !project?.initialization) ||
                (i === 3 && run?.status !== 'completed') ||
                !!running
              }
              onClick={() => setStep(i)}
            >
              <span>{step > i ? <Check size={14} /> : i + 1}</span>
              {label}
            </button>
          ))}
        </nav>
        {error && (
          <div className="journey-error" role="alert">
            {error}
            <button onClick={() => setError('')}>关闭</button>
          </div>
        )}
        {!ready ? (
          <div className="journey-panel">正在连接工作台…</div>
        ) : !signed ? (
          <section className="journey-login journey-panel">
            <h1>先登录，保存你的村庄</h1>
            <p>村庄档案和 AI 结果会保存在你的项目中。</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void guard(async () => {
                  await request('/api/auth/sign-in/email', {
                    method: 'POST',
                    body: JSON.stringify({
                      email: f.get('email'),
                      password: f.get('password'),
                    }),
                  });
                  await load();
                });
              }}
            >
              <label>
                邮箱
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                密码
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>
              <button className="primary" disabled={busy}>
                {busy ? '正在登录…' : '登录并开始'}
              </button>
            </form>
            <small>使用已有项目账户；新成员由项目负责人邀请。</small>
          </section>
        ) : (
          <>
            <div className="journey-title">
              <div>
                <small>第 {step + 1} 步 / 共 4 步</small>
                <h1>
                  {
                    [
                      '找到你要体验的村庄',
                      '建立这次工作的起点',
                      '沿路采集，让 AI 帮你观察',
                      '这次分析完成了',
                    ][step]
                  }
                </h1>
              </div>
              {project && (
                <span className="journey-village">
                  <MapPin size={15} />
                  {project.name}
                </span>
              )}
            </div>
            {step === 0 && (
              <>
                <TencentLocation
                  connected
                  project={project}
                  onSave={saveLocation}
                  expanded
                />
                {projects.some((p) => p.mode === 'reality') && (
                  <details className="journey-panel">
                    <summary>继续已有村庄</summary>
                    <div className="journey-projects">
                      {projects
                        .filter((p) => p.mode === 'reality')
                        .map((p) => (
                          <button
                            key={p.id}
                            onClick={() => void guard(() => openProject(p))}
                          >
                            <b>{p.name}</b>
                            <small>
                              {p.geographic_location?.address ?? '待补充位置'}
                            </small>
                            <ArrowRight size={16} />
                          </button>
                        ))}
                    </div>
                  </details>
                )}
              </>
            )}
            {step === 1 && (
              <section className="journey-panel">
                <p className="journey-muted">
                  位置已保存。可以直接建立档案，下面的内容都可留空，以后再补。
                </p>
                <form
                  className="journey-setup"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void initialize();
                  }}
                >
                  <label>
                    建档备注或目标（选填）
                    <input
                      value={setup.goal}
                      onChange={(e) =>
                        setSetup({ ...setup, goal: e.target.value })
                      }
                      placeholder="例如：了解老人去助餐点沿途需要改善什么"
                    />
                  </label>
                  <label>
                    村庄范围（选填）
                    <input
                      value={setup.area}
                      onChange={(e) =>
                        setSetup({ ...setup, area: e.target.value })
                      }
                      placeholder="例如：村口至老年食堂周边"
                    />
                  </label>
                  <fieldset>
                    <legend>关注什么？</legend>
                    <div className="journey-chips">
                      {focusOptions.map((f) => (
                        <label key={f}>
                          <input
                            type="checkbox"
                            checked={setup.focus.includes(f)}
                            onChange={(e) =>
                              setSetup({
                                ...setup,
                                focus: e.target.checked
                                  ? [...setup.focus, f]
                                  : setup.focus.filter((x) => x !== f),
                              })
                            }
                          />
                          {f}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <details>
                    <summary>补充已知情况（选填）</summary>
                    <label>
                      主要路线
                      <input
                        value={setup.route}
                        onChange={(e) =>
                          setSetup({ ...setup, route: e.target.value })
                        }
                        placeholder="起点、终点，暂不清楚可留空"
                      />
                    </label>
                    <label>
                      你已经观察到的情况
                      <textarea
                        value={setup.observations}
                        onChange={(e) =>
                          setSetup({ ...setup, observations: e.target.value })
                        }
                        placeholder="路面、座椅、照明等；无需猜测未知信息"
                      />
                    </label>
                  </details>
                  <div className="journey-actions">
                    <button type="button" onClick={() => setStep(0)}>
                      返回位置
                    </button>
                    <button className="primary" disabled={busy}>
                      建立档案，开始采集
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </form>
              </section>
            )}
            {step === 2 && <StreetJourney project={project} />}
            {step === 2 && (
              <div className="journey-analysis">
                <section className="journey-panel">
                  <p className="journey-muted">
                    档案已建立。可以先采集照片，也可以在下面自由提问。
                  </p>
                  <label>
                    本次问题
                    <textarea
                      aria-label="本次问题"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      disabled={!!running}
                      maxLength={5000}
                      placeholder="用自己的话描述问题…"
                    />
                  </label>
                  {!running && (
                    <div className="journey-actions">
                      <button onClick={() => setStep(1)}>修改档案</button>
                      <button
                        className="primary"
                        disabled={busy || !question.trim()}
                        onClick={() => void analyze()}
                      >
                        <MessageCircle size={16} />
                        {run ? '再次分析' : '开始 AI 分析'}
                      </button>
                    </div>
                  )}
                  {running && (
                    <div className="journey-progress" role="status">
                      <LoaderCircle className="spin" size={20} />
                      <div>
                        <b>
                          {run.status === 'reviewing'
                            ? '正在独立复核建议'
                            : 'CodeBuddy 正在分析你的村庄'}
                        </b>
                        <p>已等待 {elapsed} 秒，完成后自动显示结果。</p>
                      </div>
                      <button
                        onClick={() =>
                          void guard(async () => {
                            await api(
                              project.id,
                              '/runs/' + run.id + '/cancel',
                              {},
                            );
                            setRun(await api(project.id, '/runs/' + run.id));
                          })
                        }
                      >
                        取消
                      </button>
                    </div>
                  )}
                  {run?.status === 'failed' && (
                    <div role="alert" className="journey-error">
                      本次未完成：{run.error}。你可以保留问题并再次分析。
                    </div>
                  )}
                </section>
                <aside className="journey-context">
                  <h2>AI 将依据什么</h2>
                  <dl>
                    <dt>村庄</dt>
                    <dd>{project.name}</dd>
                    <dt>研究范围</dt>
                    <dd>{setup.area}</dd>
                    <dt>重点</dt>
                    <dd>{setup.focus.join('、')}</dd>
                  </dl>
                  <p>未录入的道路尺寸、设施容量等保持未知。</p>
                </aside>
              </div>
            )}
            {step === 3 && run?.result && (
              <>
                <section className="journey-panel journey-result">
                  <div className="journey-result-header">
                    <h2>给你的建议</h2>
                    <span>已保存</span>
                  </div>
                  <p className="journey-answer">
                    {run.result.analysis.summary}
                  </p>
                  <div className="journey-review">
                    <b>
                      独立复核 ·{' '}
                      {
                        (
                          {
                            pass: '通过',
                            conditional: '需要补充',
                            return: '需要调整',
                          } as any
                        )[run.result.review.verdict]
                      }
                    </b>
                    <p>{run.result.review.summary}</p>
                  </div>
                </section>
                <section className="journey-panel">
                  <h2>接下来可以核查这些事</h2>
                  <ul className="journey-checks">
                    {missing.map((item) => (
                      <li key={item}>
                        <span>·</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                  {!missing.length && (
                    <p>
                      本次未列出额外核查项，可以补充具体现场问题再继续讨论。
                    </p>
                  )}
                  <div className="journey-actions">
                    <button
                      onClick={() => {
                        setQuestion('');
                        setStep(2);
                      }}
                    >
                      <MessageCircle size={16} />
                      继续提问
                    </button>
                    <button onClick={exportResult}>
                      <Download size={16} />
                      导出本次记录
                    </button>
                  </div>
                </section>
                <details className="journey-panel">
                  <summary>查看本次输入与引用</summary>
                  <p>问题：{run.input?.instruction}</p>
                  {run.result.knowledge?.map((k: any) => (
                    <div key={k.id}>
                      <b>
                        {k.source_title} · {k.locator}
                      </b>
                      <p>{k.authority}</p>
                      <blockquote>{k.text}</blockquote>
                    </div>
                  ))}
                </details>
              </>
            )}
            {project && (
              <div className="journey-bottom">
                <button
                  disabled={!!running}
                  onClick={() =>
                    void guard(async () =>
                      setHistory(
                        history
                          ? null
                          : (await api(project.id, '/runs')).filter(
                              (r: any) =>
                                r.type === 'consultation' &&
                                r.status === 'completed',
                            ),
                      ),
                    )
                  }
                >
                  查看已保存的分析
                </button>
                <button
                  disabled={!!running}
                  onClick={() => {
                    setProject(null);
                    setStep(0);
                    setRun(null);
                    setHistory(null);
                  }}
                >
                  体验另一个村庄
                </button>
              </div>
            )}
            {history && (
              <div className="journey-panel">
                {history.length === 0 ? (
                  <p>还没有完成的分析。</p>
                ) : (
                  history.map((r) => (
                    <button
                      className="journey-history"
                      key={r.id}
                      onClick={() => {
                        setRun(r);
                        setStep(3);
                        setHistory(null);
                      }}
                    >
                      {r.input.instruction}
                      <ArrowRight size={14} />
                    </button>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </main>
      <footer className="journey-footer">
        输入会保存在村庄档案中。AI 建议用于辅助讨论，现场情况仍需核实。
      </footer>
    </div>
  );
}
