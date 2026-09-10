'use client';
import { useEffect, useRef, useState, useMemo } from 'react';
import Dexie, { type Table } from 'dexie';
import { request, api } from '../../lib/v2/client';
import { freshFix, spacing, type Fix } from '../../lib/v2/capture';
import CaptureMap from './map';
import './style.css';
type Shot = {
  id: string;
  user: string;
  project: string;
  blob: Blob;
  data: any;
};
const local = new Dexie('xiangzhu-mobile-capture') as Dexie & {
  shots: Table<Shot, string>;
};
local.version(1).stores({ shots: 'id,[user+project]' });
export default function Collect() {
  const [user, setUser] = useState(''),
    [ready, setReady] = useState(false),
    [projects, setProjects] = useState<any[]>([]),
    [project, setProject] = useState(''),
    [route, setRoute] = useState(''),
    [interval, setIntervalMetres] = useState(30),
    [fix, setFix] = useState<Fix | null>(null),
    [anchor, setAnchor] = useState<Fix | null>(null),
    [watching, setWatching] = useState(false),
    [camera, setCamera] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [photos, setPhotos] = useState<any[]>([]),
    [drafts, setDrafts] = useState<Shot[]>([]),
    [selected, setSelected] = useState(''),
    [note, setNote] = useState(''),
    [clock, setClock] = useState(Date.now());
  const [track, setTrack] = useState<Fix[]>([]);
  const trackRef = useRef<Fix[]>([]);
  const watch = useRef<number | null>(null),
    video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    latest = useRef<Fix | null>(null),
    generation = useRef(0);
  const progress = spacing(anchor, fix, interval),
    fresh = freshFix(fix, clock);
  async function load() {
    const me = await request('/api/v1/me');
    setUser(me.user_id);
    const p = (await request('/api/v1/projects')).filter(
      (v: any) => v.mode === 'reality',
    );
    setProjects(p);
    const requested = new URLSearchParams(location.search).get('project');
    setProject(
      (current) =>
        current ||
        (p.some((v: any) => v.id === requested) ? requested : p.at(-1)?.id) ||
        '',
    );
  }
  useEffect(() => {
    void load()
      .catch((e) => {
        if (e.status !== 401) setError(e.message);
      })
      .finally(() => setReady(true));
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => {
      window.clearInterval(timer);
      if (watch.current !== null)
        navigator.geolocation.clearWatch(watch.current);
      stream.current?.getTracks().forEach((t) => t.stop());
      generation.current++;
    };
  }, []);
  async function refresh() {
    if (!project || !user) return;
    setDrafts(
      await local.shots
        .where('[user+project]')
        .equals([user, project])
        .toArray(),
    );
    setPhotos(await api(project, '/street-photos'));
  }
  useEffect(() => {
    if (!user || !project) return;
    setRoute('步行采集 ' + new Date().toLocaleString());
    setAnchor(null);
    trackRef.current = [];
    setTrack([]);
    setSelected('');
    void refresh().catch((e) => setError(e.message));
  }, [project, user]);
  useEffect(() => {
    if (camera && video.current) {
      video.current.srcObject = stream.current;
      void video.current.play().catch((e) => setError(e.message));
    }
  }, [camera]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (drafts.length) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [drafts.length]);
  function stopCamera() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setCamera(false);
  }
  function stop() {
    generation.current++;
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    setWatching(false);
    stopCamera();
  }
  function start() {
    setError('');
    if (!window.isSecureContext) {
      setError('手机定位和相机需要 HTTPS 地址，普通局域网 HTTP 无法使用。');
      return;
    }
    if (!navigator.geolocation) {
      setError('浏览器不支持定位');
      return;
    }
    const token = ++generation.current;
    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        if (token !== generation.current) return;
        const f = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
          located_at: new Date(p.timestamp).toISOString(),
          heading: p.coords.heading,
          speed: p.coords.speed,
          altitude: p.coords.altitude,
        };
        latest.current = f;
        setFix(f);
        const previous = trackRef.current.at(-1);
        if (
          !previous ||
          p.timestamp - Date.parse(previous.located_at) >= 3000
        ) {
          trackRef.current = [...trackRef.current, f].slice(-600);
          setTrack(trackRef.current);
        }
        setError('');
      },
      (e) => {
        setError(
          e.code === 1
            ? '请在浏览器设置中允许定位，再重新开始。'
            : '暂时无法获取定位，请到开阔处重试。',
        );
        if (e.code === 1) stop();
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    setWatching(true);
  }
  async function openCamera() {
    setError('');
    setBusy(true);
    const token = generation.current;
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      if (token !== generation.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      setCamera(true);
    } catch {
      setError('无法打开相机，请允许相机权限，并检查 HTTPS 连接。');
    } finally {
      setBusy(false);
    }
  }
  async function capture() {
    setBusy(true);
    setError('');
    try {
      const f = latest.current;
      if (!freshFix(f))
        throw new Error('定位超过15秒未更新，请等待新位置后拍摄。');
      const v = video.current!;
      if (!v.videoWidth) throw new Error('相机画面尚未准备好');
      const captured_at = new Date().toISOString(),
        canvas = document.createElement('canvas');
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      canvas.getContext('2d')!.drawImage(v, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('照片生成失败'))),
          'image/jpeg',
          0.9,
        ),
      );
      if (blob.size > 15 * 1024 * 1024)
        throw new Error('照片超过15 MB，请降低相机分辨率');
      const id = crypto.randomUUID();
      const data = {
        ...f,
        capture_id: id,
        captured_at,
        route,
        interval,
        note,
        allow_model: false,
        track: trackRef.current,
      };
      await local.shots.add({ id, user, project, blob, data });
      setAnchor(f);
      trackRef.current = [f!];
      setTrack(trackRef.current);
      setNote('');
      stopCamera();
      setSelected(id);
      setDrafts(
        await local.shots
          .where('[user+project]')
          .equals([user, project])
          .toArray(),
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function upload() {
    setBusy(true);
    setError('');
    try {
      for (const shot of drafts) {
        const form = new FormData();
        form.append('metadata', JSON.stringify(shot.data));
        form.append('file', shot.blob, shot.id + '.jpg');
        await request('/api/v1/projects/' + project + '/street-photos', {
          method: 'POST',
          body: form,
        });
        await local.shots.delete(shot.id);
      }
      await refresh();
    } catch (e: any) {
      setError('上传未完成，照片仍保存在本机，可重试。' + e.message);
      setDrafts(
        await local.shots
          .where('[user+project]')
          .equals([user, project])
          .toArray(),
      );
    } finally {
      setBusy(false);
    }
  }
  const all = useMemo(
    () =>
      [
        ...photos,
        ...drafts.map((d) => ({ id: d.id, data: d.data, local: true })),
      ]
        .filter((p) => p.data.route === route)
        .sort(
          (a, b) =>
            Date.parse(
              a.data.captured_at ?? a.created_at ?? a.data.located_at,
            ) -
            Date.parse(b.data.captured_at ?? b.created_at ?? b.data.located_at),
        ),
    [photos, drafts, route],
  );
  useEffect(() => {
    setAnchor(all.length ? all[all.length - 1].data : null);
  }, [all]);
  const chosen = all.find((p) => p.id === selected);
  const [preview, setPreview] = useState('');
  useEffect(() => {
    const d = drafts.find((d) => d.id === selected);
    if (d) {
      const url = URL.createObjectURL(d.blob);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreview(
      selected ? '/api/v1/projects/' + project + '/materials/' + selected : '',
    );
  }, [selected, drafts, project]);
  return (
    <main className="capture-app">
      <header>
        <b>乡筑 · 手机采集</b>
        <a href="/">工作台</a>
      </header>
      {!ready ? (
        <p>正在连接…</p>
      ) : !user ? (
        <section>
          <h1>登录采集端</h1>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              void request('/api/auth/sign-in/email', {
                method: 'POST',
                body: JSON.stringify({
                  email: f.get('email'),
                  password: f.get('password'),
                }),
              })
                .then(load)
                .catch((e) => setError(e.message))
                .finally(() => setBusy(false));
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
            <button disabled={busy}>登录</button>
          </form>
        </section>
      ) : (
        <>
          <details className="capture-options">
            <summary>
              {projects.find((p) => p.id === project)?.name || '选择村庄'} · 每{' '}
              {interval} 米提醒 · 设置
            </summary>
            <section className="capture-settings">
              <label>
                保存到村庄
                <select
                  value={project}
                  disabled={watching || busy || camera}
                  onChange={(e) => setProject(e.target.value)}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              {!projects.length && <a href="/">先在工作台建立村庄档案</a>}
              <label>
                路线名称
                <input
                  value={route}
                  disabled={watching || busy || camera}
                  onChange={(e) => {
                    setRoute(e.target.value);
                    setAnchor(null);
                  }}
                  list="route-list"
                />
                <datalist id="route-list">
                  {[
                    ...new Set<string>(
                      [...photos, ...drafts].map((p) => p.data.route),
                    ),
                  ].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </datalist>
              </label>
              <label>
                拍照间隔
                <select
                  value={interval}
                  onChange={(e) => setIntervalMetres(Number(e.target.value))}
                >
                  {[10, 30, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n} 米
                    </option>
                  ))}
                </select>
              </label>
            </section>
          </details>
          <CaptureMap
            track={track}
            fix={fix}
            photos={all}
            onSelect={setSelected}
          />
          <section className="capture-status" role="status">
            <div>
              <b>
                {!watching
                  ? '开始定位后沿路采集'
                  : !fix
                    ? '正在获取当前位置…'
                    : !fresh
                      ? '定位已过期，等待更新'
                      : progress.ready
                        ? anchor
                          ? '已到拍照距离'
                          : '可以拍第一张'
                        : `距上一张约 ${Math.round(progress.distance)} 米`}
              </b>
              <small>
                {fix
                  ? `GPS 精度 ±${Math.round(fix.accuracy)} 米 · ${fresh ? '实时位置' : '位置待更新'}`
                  : '允许定位后，当前位置会显示在地图上'}
              </small>
            </div>
            <button
              disabled={busy || !project || !route.trim()}
              onClick={watching ? stop : start}
            >
              {watching ? '暂停定位' : '开始定位'}
            </button>
          </section>
          <p className="capture-tip">
            间隔按距上次拍照点的直线距离提醒，并扣除定位误差；你可以随时手动补拍。请保持页面在前台。
          </p>
          {camera ? (
            <section>
              <video
                ref={video}
                autoPlay
                muted
                playsInline
                className="capture-video"
              />
              <button
                className="capture-shutter"
                disabled={busy || !fresh}
                onClick={() => void capture()}
              >
                拍摄并保存当场位置
              </button>
              <button onClick={stopCamera}>关闭相机</button>
            </section>
          ) : (
            <button
              className={
                'capture-shutter ' + (progress.ready && fresh ? 'due' : '')
              }
              disabled={!watching || !fresh || busy || !route.trim()}
              onClick={() => void openCamera()}
            >
              {!watching
                ? '开始定位后拍照'
                : progress.ready
                  ? '拍一张'
                  : '手动补拍'}
            </button>
          )}
          <section>
            <label>
              现场说明（选填）
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="朝向、天气或现场情况"
                maxLength={1000}
              />
            </label>
            <p className="capture-tip">
              拍照保存照片、拍摄时间、GPS、精度与设备提供的移动方向。移动方向不是镜头朝向。照片先存本机，上传后本机副本自动清理。
            </p>
            <button
              disabled={busy || !drafts.length}
              onClick={() => void upload()}
            >
              上传待保存照片（{drafts.length}）
            </button>
          </section>
          <section>
            <h2>路线街景 · {all.length} 站</h2>
            <div className="capture-stations">
              {all.map((p, i) => (
                <button
                  key={p.id}
                  aria-pressed={p.id === selected}
                  onClick={() => setSelected(p.id)}
                >
                  {i + 1}
                  {p.local ? ' · 待上传' : ''}
                </button>
              ))}
            </div>
            {chosen && (
              <>
                <img
                  className="capture-photo"
                  src={preview}
                  alt="选中的实拍采集点"
                />
                <p>
                  {chosen.data.note || '未填写现场说明'}
                  <br />
                  {chosen.data.captured_at
                    ? new Date(chosen.data.captured_at).toLocaleString()
                    : '旧记录：拍摄时间未知'}
                  <br />
                  GPS {chosen.data.lat.toFixed(5)}, {chosen.data.lng.toFixed(5)}{' '}
                  · ±{Math.round(chosen.data.accuracy)} 米
                </p>
                <div className="capture-stations">
                  <button
                    disabled={all.indexOf(chosen) === 0}
                    onClick={() => setSelected(all[all.indexOf(chosen) - 1].id)}
                  >
                    上一站
                  </button>
                  <button
                    disabled={all.indexOf(chosen) === all.length - 1}
                    onClick={() => setSelected(all[all.indexOf(chosen) + 1].id)}
                  >
                    下一站
                  </button>
                </div>
              </>
            )}
          </section>
        </>
      )}
      {error && (
        <p className="capture-error" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
