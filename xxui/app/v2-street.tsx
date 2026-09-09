'use client';
import { useEffect, useState } from 'react';
import { api, request } from '../lib/v2/client';
export default function StreetJourney({ project }: { project: any }) {
  const [photos, setPhotos] = useState<any[]>([]),
    [route, setRoute] = useState('第一次步行采集'),
    [file, setFile] = useState<File | null>(null),
    [note, setNote] = useState(''),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [index, setIndex] = useState(0),
    [run, setRun] = useState<any>(null),
    [runs, setRuns] = useState<any[]>([]);
  const active =
    run && !['completed', 'failed', 'cancelled', 'stale'].includes(run.status);
  const current = photos.filter((p) => p.data.route === route),
    photo = current[index];
  const visits =
    run?.result?.visits ??
    run?.events
      ?.filter((e: any) => e.stage === 'street_visit')
      .map((e: any) => e.payload) ??
    [];
  async function load() {
    setPhotos(await api(project.id, '/street-photos'));
    setRuns(
      (await api(project.id, '/runs')).filter(
        (r: any) => r.type === 'streetwalk',
      ),
    );
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [project.id]);
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    const timer = setInterval(() => {
      void api(project.id, '/runs/' + run.id)
        .then((r) => {
          if (!stopped) setRun(r);
        })
        .catch((e) => {
          if (!stopped) setError(e.message);
        });
    }, 2000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [active, run?.id, project.id]);
  async function upload() {
    setBusy(true);
    setError('');
    try {
      if (!window.isSecureContext)
        throw new Error('手机定位需要 HTTPS 访问，请使用部署后的安全地址。');
      if (!navigator.geolocation) throw new Error('此浏览器不支持定位');
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 0,
          }),
      );
      const form = new FormData();
      form.append(
        'metadata',
        JSON.stringify({
          route,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          located_at: new Date(position.timestamp).toISOString(),
          note,
          allow_model: consent,
        }),
      );
      form.append('file', file!);
      await request('/api/v1/projects/' + project.id + '/street-photos', {
        method: 'POST',
        body: form,
      });
      setFile(null);
      setNote('');
      await load();
      setIndex(current.length);
    } catch (e: any) {
      setError(
        e.code === 1
          ? '定位权限未开启，请在浏览器允许定位后重试。'
          : (e.message ?? '定位或上传失败，请重试'),
      );
    } finally {
      setBusy(false);
    }
  }
  async function walk() {
    setBusy(true);
    setError('');
    try {
      const r = await api(project.id, '/runs', {
        type: 'streetwalk',
        photo_ids: current.map((p) => p.id),
      });
      setRun(await api(project.id, '/runs/' + r.run_id));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="journey-panel street-panel">
      <h2>沿路拍照，建立实拍街景</h2>
      <p className="journey-muted">
        不必先发现问题。沿同一条路线逐点拍摄，AI
        会按上传顺序查看照片，提出待核查问题。
      </p>
      <label>
        本次采集路线
        <input
          value={route}
          maxLength={120}
          onChange={(e) => {
            setRoute(e.target.value);
            setIndex(0);
          }}
          list="street-routes"
        />
      </label>
      <datalist id="street-routes">
        {[...new Set<string>(photos.map((p) => p.data.route))].map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
      <div className="street-capture">
        <label className="street-file">
          拍一张照片
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <label className="street-file">
          选择已有照片
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      {file && (
        <p>
          待上传：{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
        </p>
      )}
      <label>
        照片说明（选填）
        <input
          value={note}
          maxLength={1000}
          onChange={(e) => setNote(e.target.value)}
          placeholder="例如：村口向助餐点方向"
        />
      </label>
      <label className="street-consent">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        我有权上传这些照片，并允许项目 AI 分析。
      </label>
      <p className="journey-muted">
        点击上传时获取当前位置及精度。请在拍摄地点上传；旧照片不会自动用当前位置冒充拍摄位置。建议避开可识别的人脸和车牌。
      </p>
      <button
        className="primary"
        disabled={
          busy ||
          !file ||
          !consent ||
          !route.trim() ||
          file.size > 15 * 1024 * 1024
        }
        onClick={() => void upload()}
      >
        {busy ? '正在处理…' : '获取当前位置并上传'}
      </button>
      {file && file.size > 15 * 1024 * 1024 && (
        <p role="alert">单张照片不能超过 15 MB。</p>
      )}
      {error && <p role="alert">{error}</p>}
      <hr />
      <h3>路线相册 · {current.length} 个采集点</h3>
      {photo ? (
        <>
          <img
            className="street-photo"
            src={'/api/v1/projects/' + project.id + '/materials/' + photo.id}
            alt={photo.data.note || '路线采集照片 ' + (index + 1)}
          />
          <p>
            第 {index + 1} 站 · {photo.data.note || '未填写说明'}
            <br />
            <small>
              上传定位 WGS84 {photo.data.lat.toFixed(5)},{' '}
              {photo.data.lng.toFixed(5)} · 精度 ±
              {Math.round(photo.data.accuracy)} 米
            </small>
          </p>
          <div className="journey-actions">
            <button disabled={index === 0} onClick={() => setIndex(index - 1)}>
              上一站
            </button>
            <button
              disabled={index >= current.length - 1}
              onClick={() => setIndex(index + 1)}
            >
              下一站
            </button>
          </div>
        </>
      ) : (
        <p className="journey-muted">
          还没有照片。用手机沿路拍摄后，照片会出现在这里。
        </p>
      )}
      <button
        className="primary"
        disabled={busy || active || !current.length || current.length > 12}
        onClick={() => void walk()}
      >
        让 AI 沿这条路线巡查
      </button>
      {current.length > 12 && (
        <p>每次巡查最多 12 张，请使用不同路线名称分段采集。</p>
      )}
      {active && (
        <p role="status">
          正在逐站查看照片 · 已完成 {visits.length} 站{' '}
          <button
            onClick={() =>
              void api(project.id, '/runs/' + run.id + '/cancel')
                .then(() => api(project.id, '/runs/' + run.id))
                .then(setRun)
                .catch((e) => setError(e.message))
            }
          >
            取消巡查
          </button>
        </p>
      )}
      {run?.status === 'failed' && (
        <p role="alert">巡查失败：{run.error}。可以重新发起巡查。</p>
      )}
      {run?.status === 'cancelled' && (
        <p>巡查已取消，已完成站点保留在记录中。</p>
      )}
      {visits.map((v: any, i: number) => (
        <article key={v.photo_id} className="street-finding">
          <h3>第 {i + 1} 站 · 照片巡查</h3>
          <img
            className="street-photo"
            src={'/api/v1/projects/' + project.id + '/materials/' + v.photo_id}
            alt={'第' + (i + 1) + '站分析依据'}
          />
          <p>{v.summary}</p>
          {v.findings.map((f: any, j: number) => (
            <p key={j}>
              <b>可见情况：</b>
              {f.observation}
              <br />
              <b>疑似问题：</b>
              {f.concern}
              <br />
              <b>现场核查：</b>
              {f.verify}
            </p>
          ))}
          {v.missing_fields.length > 0 && (
            <p>尚不能判断：{v.missing_fields.join('；')}</p>
          )}
        </article>
      ))}
      <details
        onToggle={(e) => {
          if (e.currentTarget.open)
            void load().catch((e) => setError(e.message));
        }}
      >
        <summary>已保存的巡查</summary>
        {runs.map((r) => (
          <button
            key={r.id}
            disabled={!!active}
            onClick={() =>
              void api(project.id, '/runs/' + r.id)
                .then(setRun)
                .catch((e) => setError(e.message))
            }
          >
            {new Date(r.created_at).toLocaleString()} · {r.status}
          </button>
        ))}
      </details>
    </section>
  );
}
