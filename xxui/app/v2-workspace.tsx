'use client';
import VillageKnowledge from './v2-knowledge';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Leaf,
  MapPin,
  FileText,
  ClipboardList,
  RefreshCw,
  Download,
  Play,
  Upload,
  LogOut,
  Users,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import TencentLocation from './v2-map';
import SpatialEditor from './spatial-editor';
import VillageAssistant from './v2-assistant';
import FieldSurvey from './v2-survey';
import { api, request } from '@/lib/v2/client';
import { fieldDB, synchronize } from '@/lib/v2/offline';
import {
  demoSpatial,
  emptySpatial,
  normalizeSpatial,
  type Spatial,
} from '@/lib/spatial';
import {
  simulate,
  exampleScenarios,
  type SimResult,
} from '@/lib/v2/simulation';
import { statuses, type RecordObject, type Kind } from '@/lib/v2/schema';
import type { forms } from '@/lib/v2/forms';
import './debug-workbench.css';
import './v2.css';
const names: Record<string, string> = {
  facility: '设施',
  feedback: '反馈',
  issue: '问题',
  observation: '观察',
  scenario: '场景',
  evidence: '证据',
  proposal: '方案',
  review: '复核',
  action: '行动',
  followup: '回访',
  persona: '角色',
};
const kinds = Object.keys(names) as Kind[];
const localWorld = () => {
  const s = demoSpatial();
  s.roads = s.roads.map((r) => ({ ...r, confirmed: true }));
  return s;
};
export default function V2Workspace({ onLegacy }: { onLegacy: () => void }) {
  const [tab, setTab] = useState<'archive' | 'debug' | 'plans'>('debug'),
    [projects, setProjects] = useState<any[]>([]),
    [projectId, setProjectId] = useState(''),
    [user, setUser] = useState(''),
    [world, setWorld] = useState<Spatial>(localWorld),
    [dirty, setDirty] = useState(false),
    [selected, setSelected] = useState(''),
    [focus, setFocus] = useState(''),
    [data, setData] = useState<Record<string, RecordObject[]>>({}),
    [runs, setRuns] = useState<any[]>([]),
    [run, setRun] = useState<any>(null),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [online, setOnline] = useState(true),
    [connected, setConnected] = useState(false),
    [authOpen, setAuthOpen] = useState(false),
    [feedbackId, setFeedbackId] = useState(''),
    [survey, setSurvey] = useState<keyof typeof forms>('feedback'),
    [editing, setEditing] = useState<RecordObject | null>(null),
    [scenarioId, setScenarioId] = useState(''),
    [preview, setPreview] = useState<SimResult | null>(null),
    [tick, setTick] = useState(0),
    [playing, setPlaying] = useState(false),
    [evidenceQuery, setEvidenceQuery] = useState(''),
    [showProposal, setShowProposal] = useState(false),
    [members, setMembers] = useState<any[]>([]),
    [messages, setMessages] = useState<any[]>([]),
    [files, setFiles] = useState<File[]>([]);
  const project = projects.find((p) => p.id === projectId);
  const role = project?.role;
  const drafts = useLiveQuery(
    () =>
      fieldDB.drafts
        .where('project_id')
        .equals(projectId || 'local')
        .filter((d) => d.user_id === user)
        .toArray(),
    [projectId, user],
    [],
  );
  const guard = useCallback(async (fn: () => Promise<any>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }, []);
  const refresh = useCallback(async () => {
    if (!projectId) return;
    const [records, list, people] = await Promise.all([
      Promise.all(
        kinds.map(
          async (k) => [k, await api(projectId, `/records/${k}`)] as const,
        ),
      ),
      api(projectId, '/runs'),
      api(projectId, '/members'),
    ]);
    setData(Object.fromEntries(records));
    setRuns(list);
    setMembers(people);
  }, [projectId]);
  const connect = useCallback(async () => {
    try {
      const me = await request('/api/v1/me');
      setUser(me.user_id);
      sessionStorage.setItem('v2-user', me.user_id);
      const ps = await request<any[]>('/api/v1/projects');
      setProjects(ps);
      setConnected(true);
      sessionStorage.setItem(
        'v2-projects',
        JSON.stringify(
          ps.map(({ id, name, mode, role, version }: any) => ({
            id,
            name,
            mode,
            role,
            version,
          })),
        ),
      );
      if (!projectId && ps.length) setProjectId(ps[0].id);
      setAuthOpen(false);
    } catch (e) {
      setConnected(false);
      setNotice(e instanceof Error ? e.message : '连接失败');
    }
  }, [projectId]);
  useEffect(() => {
    setOnline(navigator.onLine);
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    setUser(sessionStorage.getItem('v2-user') ?? '');
    const cached = sessionStorage.getItem('v2-projects');
    if (cached) {
      setProjects(JSON.parse(cached));
      setProjectId(sessionStorage.getItem('v2-project') ?? '');
      if (!navigator.onLine) setWorld(emptySpatial());
    }
    void connect();
    if ('serviceWorker' in navigator)
      void navigator.serviceWorker
        .register('/field-sw.js')
        .catch(() => setNotice('离线页面缓存不可用，草稿仍可本机保存'));
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  useEffect(() => {
    if (!projectId) return;
    sessionStorage.setItem('v2-project', projectId);
    if (!navigator.onLine) return;
    void guard(async () => {
      const p = await api(projectId, '');
      setWorld(normalizeSpatial(p.spatial));
      setDirty(false);
      setPreview(null);
      setFeedbackId('');
      setScenarioId('');
      setRun(null);
      setMessages([]);
      await refresh();
    });
  }, [projectId]);
  useEffect(() => {
    if (!projectId || !connected || !online) return;
    let stop = false;
    const timer = setInterval(async () => {
      try {
        const list = await api(projectId, '/runs');
        if (stop) return;
        setRuns(list);
        const active = list.find(
          (r: any) =>
            ![
              'completed',
              'failed',
              'cancelled',
              'stale',
              'waiting_verification',
              'awaiting_approval',
            ].includes(r.status),
        );
        if (run) {
          const current = await api(projectId, `/runs/${run.id}`);
          if (stop) return;
          setRun(current);
          if (current.type === 'simulation' && current.result) {
            setPreview(current.result);
          }
          if (current.status !== run.status) await refresh();
        }
        if (
          !active &&
          (!run ||
            [
              'completed',
              'failed',
              'cancelled',
              'stale',
              'waiting_verification',
              'awaiting_approval',
            ].includes(run.status))
        )
          clearInterval(timer);
      } catch (e) {
        if (!stop) setNotice(e instanceof Error ? e.message : '状态查询失败');
      }
    }, 2000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [projectId, connected, online, run?.id, run?.status, refresh]);
  useEffect(() => {
    if (!playing || !preview) return;
    const timer = setInterval(
      () =>
        setTick((t) => {
          if (t >= preview.events.length - 1) {
            setPlaying(false);
            return t;
          }
          return t + 1;
        }),
      450,
    );
    return () => clearInterval(timer);
  }, [playing, preview]);
  const write = useCallback(
    async (kind: Kind, value: any, existing?: RecordObject | null) => {
      if (!projectId) throw new Error('请先连接并选择服务端项目');
      existing = existing?.id ? existing : null;
      const result = await api(
        projectId,
        `/records/${kind}${existing ? '/' + existing.id : ''}`,
        {
          base_version: existing?.version ?? 0,
          source: '工作人员录入',
          data: value,
        },
        existing ? 'PUT' : 'POST',
      );
      await refresh();
      return result;
    },
    [projectId, refresh],
  );
  const initial = useMemo(() => {
    const d = editing?.data ?? {};
    return {
      ...d,
      road_id: d.road_id ?? selected,
      observed_at: d.observed_at ?? new Date().toISOString().slice(0, 16),
      ...(survey === 'observation'
        ? {
            steps:
              d.patch?.steps === undefined || d.patch?.steps === null
                ? '未知'
                : d.patch.steps
                  ? '有'
                  : '无',
            lit:
              d.patch?.lit === undefined || d.patch?.lit === null
                ? '未知'
                : d.patch.lit
                  ? '有'
                  : '无',
            width: d.patch?.width,
            access: d.patch?.access ?? '未知',
          }
        : {}),
    };
  }, [editing, selected, survey]);
  const saveSurvey = useCallback(
    async (values: any) => {
      if (!projectId || !user)
        throw new Error('先登录并选择项目，才能绑定采集草稿');
      let kind = survey as Kind,
        value: any;
      if (survey === 'feedback')
        value = {
          ...values,
          road_id: values.road_id ?? '',
          confirmed: !!values.confirmed,
          allow_model: !!values.allow_model,
          material_ids: editing?.data.material_ids ?? [],
        };
      else if (survey === 'observation') {
        const { steps, lit, width, access, ...rest } = values;
        value = {
          ...rest,
          material_ids: editing?.data.material_ids ?? [],
          confirmed: !!rest.confirmed,
          patch: {
            road_id: values.road_id,
            steps: steps === '未知' ? null : steps === '有',
            lit: lit === '未知' ? null : lit === '有',
            width: width ? Number(width) : null,
            access,
          },
        };
      } else if (survey === 'followup')
        value = { ...values, material_ids: editing?.data.material_ids ?? [] };
      else
        value = {
          material_ids: editing?.data.material_ids ?? [],
          id: editing?.data.id ?? crypto.randomUUID(),
          name: values.name,
          node_id: values.node_id,
          kind: values.kind,
          source: values.source,
          confirmed: !!values.confirmed,
          observed_at: new Date().toISOString(),
          ...Object.fromEntries(
            ['capacity', 'opens', 'closes', 'duration'].map((k) => [
              k,
              values[k] === undefined || values[k] === ''
                ? null
                : Number(values[k]),
            ]),
          ),
        };
      if (!online) {
        await fieldDB.drafts.put({
          id: editing?.id ?? crypto.randomUUID(),
          user_id: user,
          project_id: projectId,
          kind: kind as any,
          input: {
            base_version: editing?.version ?? 0,
            source: '离线现场采集',
            data: value,
          },
          request_id: crypto.randomUUID(),
          state: 'queued',
          updated_at: new Date().toISOString(),
          attachments: files.map((f) => ({
            name: f.name,
            type: f.type,
            blob: f,
          })),
        } as any);
        setNotice('已保存离线草稿，联网后同步');
        return;
      }
      const materialIds = [];
      for (const file of files) {
        const form = new FormData();
        form.append('file', file);
        const m = await request(`/api/v1/projects/${projectId}/materials`, {
          method: 'POST',
          body: form,
        });
        materialIds.push(m.id);
      }
      if ('material_ids' in value)
        value.material_ids = [...value.material_ids, ...materialIds];
      const saved = await write(kind, value, editing);
      if (kind === 'feedback') setFeedbackId(saved.id);
      await fieldDB.drafts.delete(saved.id);
      setFiles([]);
      setNotice('记录已保存');
    },
    [
      projectId,
      user,
      survey,
      editing,
      online,
      files,
      write,
      data.scenario,
      scenarioId,
    ],
  );
  async function startSimulation(
    scId: string,
    mode: 'ai' | 'rules' = 'rules',
    replayId?: string,
  ) {
    if (dirty) throw new Error('请先保存地图或撤销未保存修改');
    const r = await api(projectId, '/runs', {
      type: 'simulation',
      scenario_id: scId,
      mode,
      ...(replayId ? { replay_id: replayId } : {}),
    });
    setRun(await api(projectId, `/runs/${r.run_id}`));
    await refresh();
  }
  async function send(text: string) {
    if (!projectId) throw new Error('请先保存或选择村庄档案');
    if (dirty) throw new Error('请先保存地图');
    setMessages((m) => [
      ...m,
      { role: 'user', content: [{ type: 'text', text }] },
    ]);
    const r = await api(projectId, '/runs', {
      type: feedbackId ? 'agent' : 'consultation',
      ...(feedbackId ? { feedback_id: feedbackId } : {}),
      instruction: text,
    });
    setRun(await api(projectId, `/runs/${r.run_id}`));
    await refresh();
  }
  const chatMessages = useMemo(
    () => [
      ...messages,
      ...(run && ['agent', 'consultation'].includes(run.type)
        ? [
            {
              role: 'assistant',
              content: [
                {
                  type: 'text',
                  text: [
                    statuses[run.status] ?? run.status,
                    run.result?.analysis?.summary,
                    run.result?.review
                      ? `独立复核（${({ pass: '通过', conditional: '需补充', return: '退回' } as Record<string, string>)[run.result.review.verdict] ?? '待判断'}）：${run.result.review.summary}`
                      : '',
                    run.error,
                  ]
                    .filter(Boolean)
                    .join('\n'),
                },
              ],
            },
          ]
        : []),
    ],
    [messages, run],
  );
  const activeRun =
    run &&
    ![
      'completed',
      'failed',
      'cancelled',
      'stale',
      'waiting_verification',
      'awaiting_approval',
    ].includes(run.status);
  const visibleEvidence = (data.evidence ?? []).filter((e) =>
    JSON.stringify(e.data).includes(evidenceQuery),
  );
  const recordCard = (r: RecordObject) => (
    <article key={r.id} className="v2-card">
      <div className="v2-card-heading">
        <b>
          {r.data.title ?? r.data.name ?? r.data.text ?? r.data.description}
        </b>
        <span>
          {names[r.kind]} · V{r.version}
          {r.stale ? ' · 已失效' : ''}
        </span>
      </div>
      <small>{r.id}</small>
      {r.data.road_id && (
        <button
          onClick={() => {
            setFocus(r.data.road_id);
            setTab('debug');
          }}
        >
          定位 {r.data.road_id}
        </button>
      )}
      {r.kind === 'feedback' && (
        <>
          <p>
            {r.data.location} ·{' '}
            {r.data.confirmed ? '已确认原意与位置' : '待确认'}
          </p>
          <button
            onClick={() => {
              setSurvey('feedback');
              setEditing(r);
              setFeedbackId(r.id);
            }}
          >
            编辑与确认
          </button>
          <button
            onClick={() =>
              void guard(async () => {
                await write('issue', {
                  feedback_id: r.id,
                  road_id: r.data.road_id,
                  description: r.data.text,
                  status: 'pending',
                  missing_fields: [],
                });
                setNotice('已建立关联问题');
              })
            }
          >
            建立核查问题
          </button>
          <button
            onClick={() => {
              setFeedbackId(r.id);
              setTab('debug');
            }}
          >
            带入分析
          </button>
        </>
      )}
      {r.kind === 'issue' && (
        <button
          onClick={() => {
            setSurvey('observation');
            setEditing({
              data: { issue_id: r.id, road_id: r.data.road_id },
            } as any);
          }}
        >
          核查此问题
        </button>
      )}
      {r.kind === 'observation' && (
        <button
          disabled={!r.data.confirmed}
          onClick={() =>
            void guard(async () => {
              const p = await api(projectId, `/observations/${r.id}/commit`, {
                base_version: world.version,
              });
              setWorld(p.spatial);
              setProjects((ps) =>
                ps.map((x) => (x.id === projectId ? { ...x, ...p } : x)),
              );
              await refresh();
              setNotice('现实版本已更新，旧推演与方案已失效');
            })
          }
        >
          提交已确认观察
        </button>
      )}
      {r.kind === 'facility' && (
        <button
          disabled={!r.data.confirmed}
          onClick={() =>
            void guard(async () => {
              const p = await api(projectId, `/facilities/${r.id}/commit`, {
                base_version: world.version,
              });
              setWorld(p.spatial);
              setProjects((ps) =>
                ps.map((x) => (x.id === projectId ? { ...x, ...p } : x)),
              );
              await refresh();
              setNotice('已更新现实设施，旧推演失效');
            })
          }
        >
          提交已核验设施
        </button>
      )}
      {r.kind === 'followup' && (
        <p>
          {r.data.result === 'resolved' ? '问题已解决' : '仍需跟进'} ·{' '}
          {r.data.observed_at}
        </p>
      )}
      {(r.data.material_ids ?? []).map((id: string) => (
        <a
          key={id}
          href={`/api/v1/projects/${projectId}/materials/${id}`}
          target="_blank"
          rel="noreferrer"
        >
          打开原始材料
        </a>
      ))}
    </article>
  );
  return (
    <div className="v2-app">
      <header className="v2-header">
        <a className="v2-brand" href="#">
          <Leaf />
          乡筑 <small>适老 AI 村庄 · V2.0</small>
        </a>
        <span className="v2-mode">
          {project?.mode === 'reality' ? '真实项目' : '合成示例'} ·{' '}
          {online ? '在线' : '离线采集'}
        </span>
        <button onClick={() => setAuthOpen(!authOpen)}>
          <Users size={16} />
          {user ? '账户与成员' : '连接工作台'}
        </button>
        <button onClick={onLegacy}>原工作台</button>
      </header>
      <aside className="v2-rail">
        <label>
          当前片区
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">本机合成示例</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {(['archive', 'debug', 'plans'] as const).map((t, i) => (
          <button
            key={t}
            className={tab === t ? 'active' : ''}
            onClick={() => setTab(t)}
          >
            {
              [
                <FileText key="a" />,
                <MapPin key="b" />,
                <ClipboardList key="c" />,
              ][i]
            }
            {['档案', '调试', '方案'][i]}
            <small>
              {['反馈与实地核查', '生活推演与证据', '行动与回访'][i]}
            </small>
          </button>
        ))}
        <div className="v2-rail-bottom">
          <p>{connected ? '已连接业务服务' : '服务尚未连接'}</p>
          <button onClick={() => void connect()}>
            <RefreshCw size={14} />
            重新连接
          </button>
          <small>现实事实、方案与仿真分层保存</small>
        </div>
      </aside>
      <main className="v2-main">
        {notice && (
          <div role="status" className="v2-notice">
            {notice}
            <button onClick={() => setNotice('')}>×</button>
          </div>
        )}
        {authOpen && (
          <section className="v2-section">
            <h2>连接与项目协作</h2>
            <form
              className="v2-form"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void guard(async () => {
                  if (f.get('token'))
                    await request('/api/v1/invitations/accept', {
                      method: 'POST',
                      body: JSON.stringify(Object.fromEntries(f)),
                    });
                  await request('/api/auth/sign-in/email', {
                    method: 'POST',
                    body: JSON.stringify({
                      email: f.get('email'),
                      password: f.get('password'),
                    }),
                  });
                  await connect();
                });
              }}
            >
              <input
                name="email"
                type="email"
                placeholder="受邀邮箱"
                aria-label="邮箱"
                required
              />
              <input
                name="password"
                type="password"
                minLength={12}
                placeholder="密码"
                aria-label="密码"
                required
              />
              <input
                name="name"
                placeholder="姓名（接受邀请时填写）"
                aria-label="姓名"
              />
              <input
                name="token"
                placeholder="邀请凭证（首次加入时填写）"
                aria-label="邀请凭证"
              />
              <button disabled={busy}>登录 / 接受邀请</button>
            </form>
            {connected && (
              <>
                <form
                  className="v2-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void guard(async () => {
                      const p = await request('/api/v1/projects', {
                        method: 'POST',
                        body: JSON.stringify({
                          name: f.get('name'),
                          mode: f.get('mode'),
                          spatial:
                            f.get('mode') === 'demo' ? world : emptySpatial(),
                        }),
                      });
                      await connect();
                      setProjectId(p.id);
                    });
                  }}
                >
                  <input
                    name="name"
                    placeholder="新项目名称"
                    aria-label="新项目名称"
                    required
                  />
                  <select name="mode">
                    <option value="demo">显式导入合成示例</option>
                    <option value="reality">新建真实项目</option>
                  </select>
                  <button>创建项目</button>
                </form>
                {role === 'manager' && (
                  <form
                    className="v2-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void guard(async () => {
                        const r = await api(
                          projectId,
                          '/invitations',
                          Object.fromEntries(f),
                        );
                        setNotice(
                          `邀请凭证（7天有效，请通过自己的渠道交给成员）：${r.token}`,
                        );
                      });
                    }}
                  >
                    <input
                      name="email"
                      type="email"
                      placeholder="成员邮箱"
                      required
                    />
                    <select name="role">
                      <option value="recorder">录入</option>
                      <option value="analyst">分析</option>
                      <option value="reviewer">复核</option>
                      <option value="manager">项目管理</option>
                    </select>
                    <button>生成邀请</button>
                  </form>
                )}
                <button
                  onClick={() =>
                    void guard(async () => {
                      if (drafts.length)
                        throw new Error('还有离线草稿，请先同步或明确删除');
                      await request('/api/auth/sign-out', {
                        method: 'POST',
                        body: '{}',
                      });
                      sessionStorage.removeItem('v2-user');
                      sessionStorage.removeItem('v2-projects');
                      sessionStorage.removeItem('v2-project');
                      setUser('');
                      setConnected(false);
                      setProjectId('');
                      setProjects([]);
                      setData({});
                      setWorld(localWorld());
                    })
                  }
                >
                  <LogOut size={15} />
                  退出账户
                </button>
              </>
            )}
          </section>
        )}
        {tab === 'archive' && (
          <>
            <div className="v2-page-title">
              <div>
                <small>FIELD ARCHIVE</small>
                <h1>让每条反馈，都有来处。</h1>
                <p>记录原话，核实位置，保留现场材料。</p>
              </div>
            </div>
            <div className="v2-tabs">
              {(
                ['feedback', 'observation', 'facility', 'followup'] as const
              ).map((t) => (
                <button
                  className={survey === t ? 'active' : ''}
                  key={t}
                  onClick={() => {
                    setSurvey(t);
                    setEditing(null);
                  }}
                >
                  {
                    {
                      feedback: '村民反馈',
                      observation: '道路核查',
                      facility: '设施调查',
                      followup: '行动回访',
                    }[t]
                  }
                </button>
              ))}
            </div>
            <section className="v2-section">
              <label>
                现场材料（请确认已获授权）
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp,application/pdf,text/plain"
                  onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                />
              </label>
              <FieldSurvey
                type={survey}
                initial={initial}
                onSave={saveSurvey}
              />
            </section>
            <section className="v2-section">
              <h2>离线待同步 · {drafts.length}</h2>
              <button
                disabled={!online}
                onClick={() =>
                  void guard(async () => {
                    const count = await synchronize(user, projectId);
                    await refresh();
                    setNotice(`已同步 ${count} 条记录`);
                  })
                }
              >
                联网同步
              </button>
              {drafts.map((d) => (
                <article className="v2-card" key={d.id}>
                  <b>{d.input.data.text ?? d.input.data.source}</b>
                  <span>
                    {d.state === 'conflict' ? '存在多人修改冲突' : '待同步'}
                  </span>
                  {d.state === 'conflict' && (
                    <>
                      <p>服务端版本 {d.conflict?.version}</p>
                      <pre>{JSON.stringify(d.conflict?.data, null, 2)}</pre>
                      <button
                        onClick={() => {
                          setSurvey(d.kind === 'issue' ? 'feedback' : d.kind);
                          setEditing({
                            id: d.id,
                            version: d.conflict.version,
                            data: d.input.data,
                          } as any);
                        }}
                      >
                        在表单中编辑合并
                      </button>
                      <button
                        onClick={() =>
                          void fieldDB.drafts.update(d.id, {
                            input: {
                              ...d.input,
                              base_version: d.conflict.version,
                            },
                            request_id: crypto.randomUUID(),
                            state: 'queued',
                          })
                        }
                      >
                        保留本地内容，基于此版本重新提交
                      </button>
                    </>
                  )}
                  <button onClick={() => void fieldDB.drafts.delete(d.id)}>
                    明确删除此草稿
                  </button>
                </article>
              ))}
            </section>
            <div className="v2-grid">
              {['feedback', 'issue', 'observation', 'facility', 'followup'].map(
                (k) => (
                  <section key={k}>
                    <h2>{names[k]}</h2>
                    {(data[k] ?? []).map(recordCard)}
                  </section>
                ),
              )}
            </div>
          </>
        )}
        {tab === 'debug' && (
          <>
            <div className="v2-page-title">
              <div>
                <small>LIVING SCENARIOS</small>
                <h1>一条助餐路，几种生活选择。</h1>
                <p>在相同角色与环境下，比较现实条件和候选措施。</p>
              </div>
              <div className="v2-actions">
                <button
                  disabled={!projectId || !dirty || busy}
                  onClick={() =>
                    void guard(async () => {
                      const p = await api(projectId, '/world', {
                        base_version: project?.version ?? world.version,
                        spatial: world,
                        source: '工作人员保存空间底板',
                      });
                      setWorld(p.spatial);
                      setProjects((ps) =>
                        ps.map((x) =>
                          x.id === projectId ? { ...x, ...p } : x,
                        ),
                      );
                      setDirty(false);
                      await refresh();
                    })
                  }
                >
                  保存空间版本
                </button>
                <button
                  onClick={() =>
                    void guard(async () => {
                      if (projectId) {
                        const p = await api(projectId, '');
                        setWorld(p.spatial);
                      } else setWorld(localWorld());
                      setDirty(false);
                    })
                  }
                >
                  撤销未保存修改
                </button>
              </div>
            </div>
            <TencentLocation
              connected={connected && online}
              project={project}
              onSave={async (location, create) => {
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
                      projectId,
                      '/location',
                      { base_version: project.location_version, location },
                      'PUT',
                    );
                const ps = await request('/api/v1/projects');
                setProjects(ps);
                setProjectId(p.id);
                setWorld(p.spatial);
                setDirty(false);
              }}
            />
            <section className="v2-spatial">
              <SpatialEditor
                data={world}
                onChange={(s) => {
                  setWorld(s);
                  setDirty(true);
                }}
                onPlan={(title, body) => {
                  setTab('plans');
                  setNotice(`${title}已整理为概念说明；请建立可复核的业务方案`);
                  setMessages((m) => [
                    ...m,
                    {
                      role: 'assistant',
                      content: [{ type: 'text', text: body }],
                    },
                  ]);
                }}
                onEmpty={() =>
                  setNotice('通过项目定位更换底图，或在账户与成员中新建片区')
                }
                chatOpen={false}
                onToggleChat={() => {}}
                onSelection={setSelected}
                focusId={focus}
              />
            </section>
            <div className="v2-grid v2-debug-grid">
              <section className="v2-section">
                <h2>
                  生活推演{' '}
                  <small>
                    {dirty ? '地图有未保存修改' : `现实版本 V${world.version}`}
                  </small>
                </h2>
                {!projectId ? (
                  <>
                    <p>
                      本机合成示例可运行规则推演。连接服务后才能保存运行、调用
                      CLI 和进行多人确认。
                    </p>
                    <div className="v2-actions">
                      {exampleScenarios(world).map((sc) => (
                        <button
                          key={sc.type}
                          onClick={() =>
                            void guard(async () => {
                              setPreview(await simulate(world, sc));
                              setTick(0);
                            })
                          }
                        >
                          <Play size={14} />
                          {sc.name} · 规则推演
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <select
                      aria-label="推演场景"
                      value={scenarioId}
                      onChange={(e) => setScenarioId(e.target.value)}
                    >
                      <option value="">选择场景</option>
                      {(data.scenario ?? []).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.data.name}
                          {s.stale ? '（已失效）' : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={!scenarioId || !online}
                      onClick={() =>
                        void guard(() => startSimulation(scenarioId, 'rules'))
                      }
                    >
                      规则比较
                    </button>
                    <button
                      disabled={!scenarioId || !online}
                      onClick={() =>
                        void guard(() => startSimulation(scenarioId, 'ai'))
                      }
                    >
                      AI 决策推演
                    </button>
                    <button
                      onClick={() =>
                        void guard(async () => {
                          if (project?.mode !== 'demo')
                            throw new Error('真实项目请从调查资料建立场景');
                          for (const s of exampleScenarios({
                            ...world,
                            version: project.version,
                          }))
                            await write('scenario', s);
                        })
                      }
                    >
                      为当前版本建立三情景
                    </button>
                    <ScenarioEditor
                      world={world}
                      records={data.scenario ?? []}
                      selected={scenarioId}
                      onSave={(s) => write('scenario', s)}
                    />
                  </>
                )}
                {preview && (
                  <SimulationView
                    world={world}
                    result={preview}
                    tick={tick}
                    setTick={setTick}
                    playing={playing}
                    toggle={() => setPlaying(!playing)}
                  />
                )}
                <div className="v2-run-list">
                  {runs
                    .filter((r) => r.type === 'simulation')
                    .map((r) => (
                      <button
                        key={r.id}
                        onClick={() => {
                          setRun(r);
                          if (r.result) {
                            setPreview(r.result);
                            setTick(0);
                          }
                        }}
                      >
                        {r.input.mode === 'ai' ? 'AI' : '规则'} ·{' '}
                        {statuses[r.status]} ·{' '}
                        {new Date(r.created_at).toLocaleTimeString()}
                      </button>
                    ))}
                </div>
              </section>
              <section className="v2-section">
                <h2>协作助手</h2>
                <select
                  aria-label="选择分析反馈"
                  value={feedbackId}
                  onChange={(e) => setFeedbackId(e.target.value)}
                >
                  <option value="">普通知识咨询（不绑定反馈）</option>
                  {(data.feedback ?? []).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.data.text.slice(0, 40)}
                    </option>
                  ))}
                </select>
                <VillageAssistant
                  messages={chatMessages}
                  running={!!activeRun}
                  onSend={(text) => guard(() => send(text))}
                  onCancel={() =>
                    guard(() => api(projectId, `/runs/${run.id}/cancel`, {}))
                  }
                />
                <div className="v2-grid">
                  {(data.issue ?? [])
                    .filter((i) => i.data.feedback_id === feedbackId)
                    .map((i) => (
                      <article className="v2-card" key={i.id}>
                        <b>问题卡</b>
                        <p>{i.data.description}</p>
                        <button
                          onClick={() => {
                            setFocus(i.data.road_id ?? '');
                            setNotice('已定位关联路段');
                          }}
                        >
                          查看地图对象
                        </button>
                        <button onClick={() => setTab('archive')}>
                          打开原始反馈
                        </button>
                      </article>
                    ))}
                  {run?.result?.analysis?.missing_fields?.length > 0 && (
                    <article className="v2-card">
                      <b>核查卡</b>
                      <p>{run.result.analysis.missing_fields.join('、')}</p>
                      <button
                        onClick={() => {
                          setSurvey('observation');
                          setTab('archive');
                        }}
                      >
                        补充道路核查
                      </button>
                    </article>
                  )}
                  {(run?.result?.evidence ?? []).map((e: any) => (
                    <article className="v2-card" key={e.id}>
                      <b>证据卡</b>
                      <p>{e.data?.title}</p>
                      <blockquote>{e.data?.excerpt}</blockquote>
                      <button
                        onClick={() => {
                          setEvidenceQuery(e.data?.title ?? '');
                          document
                            .getElementById('v2-evidence')
                            ?.scrollIntoView();
                        }}
                      >
                        查看引用与适用条件
                      </button>
                    </article>
                  ))}
                  {run?.result?.proposal && (
                    <article className="v2-card">
                      <b>方案变更卡</b>
                      <p>{run.result.proposal.data?.title}</p>
                      <button onClick={() => setTab('plans')}>
                        预览差异与复核
                      </button>
                    </article>
                  )}
                </div>
                {run?.result?.knowledge?.map((k: any) => (
                  <article key={k.id} className="v2-card">
                    <b>知识引用 · {k.title}</b>
                    <small>
                      {k.source_title} · {k.locator}
                    </small>
                    <p>{k.authority}</p>
                    <details>
                      <summary>查看原文片段</summary>
                      <blockquote>{k.text}</blockquote>
                    </details>
                  </article>
                ))}
                {run && (
                  <article className="v2-card">
                    <b>{statuses[run.status]}</b>
                    <small>{run.id}</small>
                    {run.error && <p>{run.error}</p>}
                    {run.type === 'simulation' && run.result && (
                      <button
                        onClick={() =>
                          void guard(() =>
                            startSimulation(
                              run.input.scenario_id,
                              run.input.mode,
                              run.id,
                            ),
                          )
                        }
                      >
                        使用保存的决策复算
                      </button>
                    )}
                    {[
                      'waiting_verification',
                      'awaiting_approval',
                      'failed',
                      'cancelled',
                    ].includes(run.status) && (
                      <button
                        onClick={() =>
                          void guard(async () => {
                            const r = await api(
                              projectId,
                              `/runs/${run.id}/${['failed', 'cancelled'].includes(run.status) ? 'retry' : 'resume'}`,
                              {},
                            );
                            setRun(await api(projectId, `/runs/${r.run_id}`));
                          })
                        }
                      >
                        {['failed', 'cancelled'].includes(run.status)
                          ? '明确重试'
                          : '已处理，继续执行'}
                      </button>
                    )}
                    {run.result?.proposal && (
                      <button onClick={() => setTab('plans')}>
                        查看方案变更卡
                      </button>
                    )}
                    <details>
                      <summary>工具输入输出与执行记录</summary>
                      <pre>{JSON.stringify(run.events ?? [], null, 2)}</pre>
                    </details>
                  </article>
                )}
              </section>
            </div>
            <section className="v2-section">
              <div className="v2-section-title">
                <VillageKnowledge connected={connected && online} />
                <h2 id="v2-evidence">案例与证据</h2>
                <input
                  value={evidenceQuery}
                  onChange={(e) => setEvidenceQuery(e.target.value)}
                  placeholder="按中文关键词筛选"
                  aria-label="证据检索"
                />
              </div>
              <EvidenceEditor onSave={(value) => write('evidence', value)} />
              <label>
                导入证据索引（保留待核验状态）
                <input
                  type="file"
                  accept="application/json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file)
                      void guard(async () => {
                        const entries = JSON.parse(await file.text());
                        if (!Array.isArray(entries))
                          throw new Error('证据索引应为列表');
                        for (const entry of entries)
                          await write('evidence', {
                            ...entry,
                            verified: false,
                          });
                        setNotice('证据索引已导入，请逐条打开原文核验');
                      });
                  }}
                />
              </label>
              <div className="v2-grid">
                {visibleEvidence.map((e) => (
                  <article className="v2-card" key={e.id}>
                    <b>{e.data.title}</b>
                    <span>
                      {
                        (
                          {
                            planned: '计划实施',
                            built: '已建成',
                            in_use: '有使用记录',
                            measured: '有成效记录',
                            not_applicable: '指导材料，无建设状态',
                          } as any
                        )[e.data.stage]
                      }{' '}
                      · {e.data.verified ? '已核验' : '待核验'}
                    </span>
                    <blockquote>{e.data.excerpt}</blockquote>
                    <p>支持：{e.data.claim}</p>
                    <p>适用条件：{e.data.conditions}</p>
                    <p>不能支持：{e.data.limitations}</p>
                    <a href={e.data.url} target="_blank" rel="noreferrer">
                      原始出处 · {e.data.locator}
                    </a>
                    {!e.data.verified && (
                      <button
                        onClick={() =>
                          void guard(() =>
                            write('evidence', { ...e.data, verified: true }, e),
                          )
                        }
                      >
                        已阅读原文，确认核验
                      </button>
                    )}
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
        {tab === 'plans' && (
          <>
            <div className="v2-page-title">
              <div>
                <small>DECISIONS & FOLLOW-UP</small>
                <h1>把判断，落成可跟进的行动。</h1>
                <p>先比较与复核，再确认责任，最后回到现场。</p>
              </div>
              <button onClick={() => setShowProposal(!showProposal)}>
                建立候选方案
              </button>
            </div>
            {showProposal && (
              <ProposalEditor
                scenarios={data.scenario ?? []}
                issues={data.issue ?? []}
                evidence={data.evidence ?? []}
                simulations={runs.filter(
                  (r) =>
                    r.type === 'simulation' &&
                    r.status === 'completed' &&
                    r.world_version === project?.version,
                )}
                onSave={(value) => write('proposal', value)}
              />
            )}
            <section className="v2-section">
              <h2>三情景对比</h2>
              <table>
                <thead>
                  <tr>
                    <th>场景</th>
                    <th>完成角色</th>
                    <th>步行距离</th>
                    <th>等待秒数</th>
                    <th>资源冲突</th>
                    <th>资料缺口</th>
                  </tr>
                </thead>
                <tbody>
                  {runs
                    .filter((r) => r.type === 'simulation' && r.result)
                    .map((r) => (
                      <tr key={r.id}>
                        <td>
                          {r.result.scenario.name} · {statuses[r.status]}
                        </td>
                        <td>
                          {r.result.metrics.completed}/
                          {r.result.scenario.personas.length}
                        </td>
                        <td>
                          {r.result.metrics.distance === null
                            ? '未知'
                            : Math.round(r.result.metrics.distance) + ' m'}
                        </td>
                        <td>
                          {r.result.metrics.waiting === null
                            ? '未知'
                            : Math.round(r.result.metrics.waiting)}
                        </td>
                        <td>{r.result.metrics.conflicts}</td>
                        <td>
                          {r.result.metrics.missing_fields.join('、') || '无'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </section>
            <div className="v2-grid">
              {(data.proposal ?? []).map((p) => (
                <article key={p.id} className="v2-section">
                  <h2>{p.data.title}</h2>
                  <p>
                    {p.stale ? '已失效' : p.data.status} · V{p.version} · 预算：
                    {p.data.budget}
                  </p>
                  <p>待核查：{p.data.missing_fields.join('、') || '无'}</p>
                  <details open>
                    <summary>方案变更预览</summary>
                    {p.data.changes.map((c: any, i: number) => (
                      <p key={i}>
                        {c.road_id}：
                        {Object.entries(c)
                          .filter(([k]) => k !== 'road_id')
                          .map(
                            ([k, v]) =>
                              `${({ steps: '台阶', lit: '照明', width: '宽度', access: '通行' } as any)[k]} → ${String(v)}`,
                          )
                          .join('；')}
                      </p>
                    ))}
                  </details>
                  {p.data.evidence_ids.map((id: string) => {
                    const e = data.evidence?.find((x) => x.id === id);
                    return (
                      <p key={id}>
                        证据：{e?.data.title ?? id} · {e?.data.claim}
                      </p>
                    );
                  })}
                  <form
                    className="v2-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void guard(() =>
                        write('review', {
                          proposal_id: p.id,
                          verdict: f.get('verdict'),
                          notes: f.get('notes'),
                          evidence_ids: p.data.evidence_ids,
                        }),
                      );
                    }}
                  >
                    <select name="verdict">
                      <option value="pass">通过</option>
                      <option value="conditional">有条件通过</option>
                      <option value="return">退回</option>
                    </select>
                    <input name="notes" placeholder="独立复核意见" required />
                    <button disabled={!['reviewer', 'manager'].includes(role)}>
                      提交独立复核
                    </button>
                  </form>
                  {(data.review ?? [])
                    .filter((r) => r.data.proposal_id === p.id)
                    .map((r) => (
                      <p key={r.id}>
                        {r.data.verdict}：{r.data.notes}
                      </p>
                    ))}
                  <button
                    disabled={
                      role !== 'manager' ||
                      p.stale ||
                      p.data.status === 'approved'
                    }
                    onClick={() =>
                      void guard(async () => {
                        const r = await api(
                          projectId,
                          `/proposals/${p.id}/confirm`,
                          {
                            base_version: p.version,
                            request_id: crypto.randomUUID(),
                          },
                        );
                        await refresh();
                        setNotice(`已生成 ${r.action_ids.length} 项行动`);
                      })
                    }
                  >
                    确认方案并生成行动
                  </button>
                </article>
              ))}
            </div>
            <section className="v2-section">
              <h2>行动台账</h2>
              {(data.action ?? []).map((a) => (
                <article key={a.id} className="v2-card">
                  <b>{a.data.title}</b>
                  <p>{a.data.description}</p>
                  <span>
                    {
                      (
                        {
                          unassigned: '待分派',
                          in_progress: '处理中',
                          followup: '待回访',
                          closed: '已关闭',
                        } as any
                      )[a.data.status]
                    }
                  </span>
                  <form
                    className="v2-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void guard(() =>
                        write(
                          'action',
                          { ...a.data, ...Object.fromEntries(f) },
                          a,
                        ),
                      );
                    }}
                  >
                    <select name="assignee" defaultValue={a.data.assignee}>
                      <option value="">待指定负责人</option>
                      {members.map((m) => (
                        <option key={m.user_id} value={m.user_id}>
                          {m.user_id} · {m.role}
                        </option>
                      ))}
                    </select>
                    <select name="status" defaultValue={a.data.status}>
                      {['unassigned', 'in_progress', 'followup', 'closed'].map(
                        (s) => (
                          <option key={s} value={s}>
                            {
                              (
                                {
                                  unassigned: '待分派',
                                  in_progress: '处理中',
                                  followup: '待回访',
                                  closed: '已关闭',
                                } as any
                              )[s]
                            }
                          </option>
                        ),
                      )}
                    </select>
                    <input
                      name="notes"
                      defaultValue={a.data.notes}
                      placeholder="进展说明"
                    />
                    <button>更新行动</button>
                  </form>
                  <button
                    onClick={() => {
                      setTab('archive');
                      setSurvey('followup');
                      setEditing({ data: { action_id: a.id } } as any);
                    }}
                  >
                    记录现场回访
                  </button>
                </article>
              ))}
            </section>
            <button
              onClick={() =>
                void guard(async () =>
                  download(
                    '乡筑-项目交付.json',
                    await api(projectId, '/export'),
                  ),
                )
              }
            >
              <Download size={16} />
              导出业务交付包
            </button>
          </>
        )}
      </main>
      <footer className="v2-footer">
        合成角色用于情景比较 · 正式措施需证据、独立复核与用户确认 ·
        实施及试点进展以现场记录为准
      </footer>
    </div>
  );
}
function download(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function SimulationView({
  world,
  result,
  tick,
  setTick,
  playing,
  toggle,
}: {
  world: Spatial;
  result: SimResult;
  tick: number;
  setTick: (n: number) => void;
  playing: boolean;
  toggle: () => void;
}) {
  const visible = result.events.slice(0, tick + 1);
  const positions = new Map(visible.map((e) => [e.persona_id, e]));
  return (
    <div className="v2-simulation">
      <p>
        {result.scenario.name} ·{' '}
        {result.mode === 'rules'
          ? '规则推演'
          : result.mode === 'ai'
            ? 'AI 决策'
            : '已存决策回放'}{' '}
        · {result.metrics.completed}/{result.scenario.personas.length}个角色完成
      </p>
      <svg viewBox="0 0 1000 667" role="img" aria-label="角色轨迹回放">
        {world.image && (
          <image href={world.image} width="1000" height="667" opacity=".45" />
        )}
        {world.roads.map((r) => {
          const a = world.nodes.find((n) => n.id === r.a),
            b = world.nodes.find((n) => n.id === r.b);
          return a && b ? (
            <line
              key={r.id}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#a8c8b4"
              strokeWidth="4"
            />
          ) : null;
        })}
        {[...positions].map(([id, e], i) => (
          <g key={id}>
            <polyline
              points={visible
                .filter((x) => x.persona_id === id && x.accepted)
                .map((x) => `${x.position.x},${x.position.y}`)
                .join(' ')}
              fill="none"
              stroke={['#a25c43', '#285e49', '#625280'][i % 3]}
              strokeWidth="5"
            />
            <circle
              cx={e.position.x}
              cy={e.position.y}
              r="13"
              fill={['#a25c43', '#285e49', '#625280'][i % 3]}
            />
            <text x={e.position.x + 16} y={e.position.y} fontSize="16">
              {id}
            </text>
          </g>
        ))}
      </svg>
      <div className="v2-actions">
        <button onClick={toggle}>{playing ? '暂停' : '播放'}</button>
        <input
          aria-label="回放时间轴"
          type="range"
          min="0"
          max={Math.max(0, result.events.length - 1)}
          value={tick}
          onChange={(e) => setTick(Number(e.target.value))}
        />
        <button onClick={() => download('推演日志.json', result)}>
          导出日志
        </button>
      </div>
      {visible.at(-1) && (
        <p>
          {Math.round(visible.at(-1)!.time)}秒 · {visible.at(-1)!.persona_id} ·{' '}
          {visible.at(-1)!.action} · {visible.at(-1)!.reason}
        </p>
      )}
      <p>
        资料缺口：{result.metrics.missing_fields.join('、') || '无'}；非法提议：
        {result.metrics.rejected}
      </p>
    </div>
  );
}
function EvidenceEditor({ onSave }: { onSave: (v: any) => Promise<any> }) {
  const [error, setError] = useState('');
  return (
    <details>
      <summary>录入一条经过核验的证据</summary>
      <form
        className="v2-form v2-stacked"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget,
            f = new FormData(form);
          try {
            await onSave({
              ...Object.fromEntries(f),
              tags: String(f.get('tags')).split('、').filter(Boolean),
              verified: false,
              material_ids: [],
            });
            form.reset();
            setError('已保存，阅读原文后再确认核验');
          } catch (e) {
            setError(String(e));
          }
        }}
      >
        {[
          ['title', '资料标题'],
          ['url', '原始网址'],
          ['locator', '页码或段落定位'],
          ['claim', '该片段支持什么'],
          ['conditions', '适用条件'],
          ['limitations', '不能支持哪些结论'],
          ['tags', '检索标签，用顿号分隔'],
        ].map(([n, p]) => (
          <input key={n} name={n} placeholder={p} aria-label={p} required />
        ))}
        <textarea name="excerpt" placeholder="原文证据片段" required />
        <select name="type">
          <option value="case">现实案例</option>
          <option value="standard">规范</option>
          <option value="simulation">仿真</option>
          <option value="followup">回访</option>
        </select>
        <select name="stage">
          <option value="planned">计划实施</option>
          <option value="built">已经建成</option>
          <option value="in_use">持续使用</option>
          <option value="measured">量化成效记录</option>
          <option value="not_applicable">指导材料，不涉及建设状态</option>
        </select>
        <button>保存证据</button>
        <p role="status">{error}</p>
      </form>
    </details>
  );
}
function ProposalEditor({
  simulations,
  scenarios,
  issues,
  evidence,
  onSave,
}: {
  simulations: any[];
  scenarios: RecordObject[];
  issues: RecordObject[];
  evidence: RecordObject[];
  onSave: (v: any) => Promise<any>;
}) {
  const [error, setError] = useState('');
  return (
    <section className="v2-section">
      <h2>候选方案草案</h2>
      <form
        className="v2-form v2-stacked"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget),
            sc = scenarios.find((s) => s.id === f.get('scenario'));
          try {
            await onSave({
              title: f.get('title'),
              issue_ids: f.getAll('issues'),
              scenario_id: sc?.id,
              evidence_ids: f.getAll('evidence'),
              changes: sc?.data.patches ?? [],
              tasks: [
                {
                  title: f.get('title'),
                  type: f.get('type'),
                  description: f.get('description'),
                },
              ],
              missing_fields: String(f.get('missing'))
                .split('、')
                .filter(Boolean),
              budget: f.get('budget'),
              status: 'draft',
              simulation_ids: f.getAll('simulations'),
            });
            setError('草案已保存，请由另一位成员独立复核');
          } catch (e) {
            setError(String(e));
          }
        }}
      >
        <input name="title" placeholder="方案标题" required />
        <select name="scenario" required>
          <option value="">关联比较场景</option>
          {scenarios
            .filter((s) => !s.stale)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.data.name}
              </option>
            ))}
        </select>
        <fieldset>
          <legend>对应问题</legend>
          {issues.map((i) => (
            <label key={i.id}>
              <input name="issues" value={i.id} type="checkbox" />
              {i.data.description}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>关联本次计算</legend>
          {simulations.map((r) => (
            <label key={r.id}>
              <input type="checkbox" name="simulations" value={r.id} />
              {r.result?.scenario_type ?? '推演'} · {r.id.slice(0, 8)}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>支持措施的证据</legend>
          {evidence.map((i) => (
            <label key={i.id}>
              <input name="evidence" value={i.id} type="checkbox" />
              {i.data.title}
            </label>
          ))}
        </fieldset>
        <select name="type">
          <option value="verification">现场核查</option>
          <option value="maintenance">维护</option>
          <option value="service">服务调整</option>
          <option value="engineering">工程准备</option>
        </select>
        <textarea
          name="description"
          placeholder="行动内容与实施条件"
          required
        />
        <input name="budget" defaultValue="待测算" required />
        <input name="missing" placeholder="待核查项，用顿号分隔，无则留空" />
        <button>保存草案</button>
        <p>{error}</p>
      </form>
    </section>
  );
}
function ScenarioEditor({
  world,
  records,
  selected,
  onSave,
}: {
  world: Spatial;
  records: RecordObject[];
  selected: string;
  onSave: (s: any) => Promise<any>;
}) {
  const [error, setError] = useState('');
  return (
    <details>
      <summary>建立或调整角色、资源和方案变量</summary>
      <p>
        复制所选场景，修改明确的方案变量后保存为新场景。通过场景文件可以更换角色参数和共享资源。
      </p>
      <button
        onClick={() =>
          download(
            '场景模板.json',
            records.find((r) => r.id === selected)?.data ??
              exampleScenarios(world)[0],
          )
        }
      >
        导出角色与资源模板
      </button>
      <label>
        <Upload size={14} />
        导入已填写的场景文件
        <input
          type="file"
          accept="application/json"
          onChange={async (e) => {
            try {
              const f = e.target.files?.[0];
              if (!f) return;
              const v = JSON.parse(await f.text());
              await onSave({ ...v, world_version: world.version });
              setError('场景已保存');
            } catch (e) {
              setError(String(e));
            }
          }}
        />
      </label>
      <p>{error}</p>
    </details>
  );
}
