'use client';
import { useEffect, useRef, useState } from 'react';
let sdk: Promise<any> | undefined;
export function loadMap() {
  if (sdk) return sdk;
  sdk = new Promise((resolve, reject) => {
    const w = window as any;
    w._TMapSecurityConfig = {
      serviceHost: `${location.origin}/api/v1/map/delegate`,
    };
    if (w.TMap) {
      resolve(w.TMap);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://map.qq.com/api/gljs?v=1.exp';
    script.onload = () =>
      w.TMap ? resolve(w.TMap) : reject(new Error('地图组件未能初始化'));
    script.onerror = () =>
      reject(new Error('腾讯地图加载失败，请检查网络连接'));
    document.head.appendChild(script);
  });
  return sdk;
}
export default function TencentLocation({
  connected,
  project,
  onSave,
  expanded = false,
}: {
  connected: boolean;
  expanded?: boolean;
  project?: any;
  onSave: (v: any, create: boolean) => Promise<void>;
}) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<any>(null),
    marker = useRef<any>(null);
  const [address, setAddress] = useState(''),
    [result, setResult] = useState<any>(null),
    [candidates, setCandidates] = useState<any[]>([]),
    [mode, setMode] = useState('search'),
    [error, setError] = useState(''),
    [show, setShow] = useState(expanded),
    [busy, setBusy] = useState(false),
    [name, setName] = useState(''),
    [notes, setNotes] = useState(''),
    [saved, setSaved] = useState('');
  useEffect(() => {
    const v = project?.geographic_location;
    setResult(
      v
        ? { title: v.name, location: v.location, ad_info: { adcode: v.adcode } }
        : null,
    );
    setAddress(v?.address ?? '');
    setName(v?.name ?? '');
    setNotes(v?.notes ?? '');
    setSaved('');
  }, [project?.id, project?.location_version]);
  useEffect(() => {
    if (!show || !connected) return;
    let disposed = false;
    void loadMap()
      .then((T) => {
        if (disposed || !container.current) return;
        map.current = new T.Map(container.current, {
          center: new T.LatLng(
            project?.geographic_location?.location.lat ?? 35,
            project?.geographic_location?.location.lng ?? 105,
          ),
          zoom: project?.geographic_location ? 15 : 4,
          viewMode: '2D',
        });
        const v = project?.geographic_location;
        if (v)
          marker.current = new T.MultiMarker({
            map: map.current,
            geometries: [
              {
                id: 'saved-village',
                position: new T.LatLng(v.location.lat, v.location.lng),
              },
            ],
          });
      })
      .catch((e) => setError(e.message));
    return () => {
      disposed = true;
      marker.current?.setMap(null);
      marker.current = null;
      map.current?.destroy();
      map.current = null;
    };
  }, [show, connected, project?.id, project?.location_version]);
  async function locate() {
    setBusy(true);
    setError('');
    setResult(null);
    setCandidates([]);
    marker.current?.setMap(null);
    try {
      const response = await fetch(
        mode === 'search'
          ? `/api/v1/map/search?keyword=${encodeURIComponent(address.trim())}`
          : `/api/v1/map/geocode?address=${encodeURIComponent(address.trim())}`,
        { credentials: 'include' },
      );
      const data: any = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (mode === 'search') {
        setCandidates(data.results);
        if (!data.results.length)
          setError('未找到地点，请补充城市、乡镇名称，或切换完整地址定位。');
      } else
        await selectPlace({
          ...data.result,
          address: address.trim(),
          source: '腾讯地图地址解析',
        });
    } catch (e) {
      setError(e instanceof Error ? e.message : '地址定位失败');
    } finally {
      setBusy(false);
    }
  }
  async function selectPlace(place: any) {
    try {
      const T = await loadMap();
      if (!map.current) throw new Error('地图尚未加载完成，请稍后选择');
      const position = new T.LatLng(place.location.lat, place.location.lng);
      map.current.setCenter(position);
      map.current.setZoom(15);
      marker.current?.setMap(null);
      marker.current = new T.MultiMarker({
        map: map.current,
        geometries: [{ id: 'address-result', position }],
      });
      setResult(place);
      setName(place.title || address);
      setSaved('');
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '地点定位失败');
    }
  }
  async function save(create: boolean) {
    setBusy(true);
    setError('');
    try {
      await onSave(
        {
          name,
          address: result.address || address,
          location: result.location,
          coordinate_system: 'GCJ-02',
          source:
            result.source ||
            project?.geographic_location?.source ||
            '腾讯地图地址解析',
          adcode: result.ad_info?.adcode ?? '',
          notes,
          confirmed: true,
        },
        create,
      );
      setSaved('村庄档案已保存，刷新页面后可从当前片区重新打开。');
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="v2-section">
      {!expanded && (
        <>
          <h2>村庄地理定位 · 腾讯地图</h2>
          <p>
            查询村庄地址，查看周边地理位置。此定位不改变影像尺度，也不代表道路已适老核验。
          </p>
        </>
      )}
      {project?.geographic_location && (
        <p>
          已记录：{project.geographic_location.name} ·{' '}
          {project.geographic_location.address} · 档案版本{' '}
          {project.location_version}
        </p>
      )}
      {saved && <p role="status">{saved}</p>}
      {!connected ? (
        <p>登录并连接业务服务后使用地址定位。</p>
      ) : (
        <>
          {!expanded && (
            <button onClick={() => setShow((v) => !v)}>
              {show ? '收起地理地图' : '打开地理地图'}
            </button>
          )}
          {show && (
            <>
              <div className="v2-actions">
                <select
                  aria-label="定位方式"
                  value={mode}
                  disabled={busy}
                  onChange={(e) => {
                    setMode(e.target.value);
                    setResult(null);
                    setCandidates([]);
                    setError('');
                    marker.current?.setMap(null);
                  }}
                >
                  <option value="search">地点名称搜索</option>
                  <option value="geocode">完整地址定位</option>
                </select>
                <input
                  aria-label="村庄或地点名称"
                  placeholder="输入村庄、学校等地点名称，可加城市缩小范围"
                  value={address}
                  disabled={busy}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setResult(null);
                    setCandidates([]);
                    setError('');
                    setSaved('');
                    marker.current?.setMap(null);
                  }}
                />
                <button
                  disabled={busy || address.trim().length < 3}
                  onClick={() => void locate()}
                >
                  {busy
                    ? '正在查询…'
                    : mode === 'search'
                      ? '搜索地点'
                      : '查询地址'}
                </button>
              </div>
              {candidates.length > 0 && (
                <div
                  aria-label="地点候选"
                  style={{ maxHeight: 180, overflowY: 'auto', marginTop: 10 }}
                >
                  <p>找到 {candidates.length} 个地点，请选择具体位置：</p>
                  {candidates.map((p) => (
                    <button
                      key={p.id}
                      aria-pressed={result?.id === p.id}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        marginBottom: 4,
                      }}
                      onClick={() => void selectPlace(p)}
                    >
                      {p.title} · {p.address}
                    </button>
                  ))}
                </div>
              )}
              <div
                ref={container}
                style={{
                  height: expanded ? 250 : 360,
                  width: '100%',
                  marginTop: 12,
                }}
              />
              {result && (
                <div>
                  {expanded ? (
                    <p>已找到 {result.title}，请核对地图上的位置。</p>
                  ) : (
                    <p>
                      {result.title} · GCJ-02：{result.location.lat.toFixed(6)},{' '}
                      {result.location.lng.toFixed(6)} · 解析级别 {result.level}
                      ，请结合现场核对。
                    </p>
                  )}
                  <label>
                    村庄名称
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <details>
                    <summary>添加备注（选填）</summary>
                    <label>
                      记录备注
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="片区范围、现场联系人或待核查事项"
                      />
                    </label>
                  </details>
                  <div className="v2-actions">
                    <button
                      className={expanded ? 'primary' : undefined}
                      disabled={busy || !name.trim()}
                      onClick={() => void save(true)}
                    >
                      {expanded
                        ? '确认位置，下一步'
                        : '确认位置，建立真实村庄档案'}
                    </button>
                    {project?.mode === 'reality' && (
                      <button
                        disabled={busy || !name.trim()}
                        onClick={() => void save(false)}
                      >
                        更新当前村庄位置
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
          {error && <p role="alert">{error}</p>}
        </>
      )}
    </section>
  );
}
