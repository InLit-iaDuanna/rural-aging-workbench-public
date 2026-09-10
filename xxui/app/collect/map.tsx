'use client';
import { useEffect, useRef, useState } from 'react';
import { loadMap } from '../v2-map';
import { request } from '../../lib/v2/client';
import type { Fix } from '../../lib/v2/capture';
export default function CaptureMap({
  fix,
  track,
  photos,
  onSelect,
}: {
  fix: Fix | null;
  track: Fix[];
  photos: any[];
  onSelect: (id: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null),
    map = useRef<any>(null),
    marker = useRef<any>(null),
    line = useRef<any>(null),
    T = useRef<any>(null),
    cache = useRef(new Map<string, any>()),
    select = useRef(onSelect);
  select.current = onSelect;
  const [ready, setReady] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    let gone = false;
    loadMap()
      .then((t) => {
        if (gone) return;
        T.current = t;
        map.current = new t.Map(box.current, {
          center: new t.LatLng(35, 105),
          zoom: 4,
          viewMode: '2D',
        });
        marker.current = new t.MultiMarker({
          map: map.current,
          styles: {
            current: new t.MarkerStyle({
              width: 24,
              height: 24,
              anchor: { x: 12, y: 12 },
              src:
                'data:image/svg+xml,' +
                encodeURIComponent(
                  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="10" fill="#2684ff" stroke="white" stroke-width="3"/></svg>',
                ),
            }),
            photo: new t.MarkerStyle({
              width: 24,
              height: 24,
              anchor: { x: 12, y: 12 },
              src:
                'data:image/svg+xml,' +
                encodeURIComponent(
                  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect x="2" y="2" width="20" height="20" rx="5" fill="#235c43" stroke="white" stroke-width="2"/><circle cx="12" cy="12" r="5" fill="white"/></svg>',
                ),
            }),
          },
          geometries: [],
        });
        marker.current.on('click', (e: any) => {
          if (e.geometry.id !== 'current') select.current(e.geometry.id);
        });
        line.current = new t.MultiPolyline({
          map: map.current,
          styles: {
            trace: new t.PolylineStyle({ color: '#2684ff', width: 4 }),
          },
          geometries: [],
        });
        setReady(true);
      })
      .catch((e) => setError(e.message));
    return () => {
      gone = true;
      marker.current?.setMap(null);
      line.current?.setMap(null);
      map.current?.destroy();
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    let gone = false;
    const traces = track
      .slice(-200)
      .map((p, i) => ({ ...p, id: 'trace:' + i }));
    const points = [
      ...traces,
      ...photos.map((p) => ({ id: p.id, lat: p.data.lat, lng: p.data.lng })),
      ...(fix ? [{ id: 'current', lat: fix.lat, lng: fix.lng }] : []),
    ];
    const key = (p: any) => `${p.lat},${p.lng}`;
    void (async () => {
      const missing = points.filter((p) => !cache.current.has(key(p)));
      for (let i = 0; i < missing.length; i += 40) {
        const batch = missing.slice(i, i + 40);
        const r = await request('/api/v1/map/translate', {
          method: 'POST',
          body: JSON.stringify({
            points: batch.map(({ lat, lng }) => ({ lat, lng })),
          }),
        });
        batch.forEach((p, j) => cache.current.set(key(p), r.points[j]));
      }
      if (gone) return;
      marker.current.setGeometries(
        points
          .filter((p) => !p.id.startsWith('trace:'))
          .map((p) => ({
            id: p.id,
            styleId: p.id === 'current' ? 'current' : 'photo',
            position: new T.current.LatLng(
              cache.current.get(key(p)).lat,
              cache.current.get(key(p)).lng,
            ),
          })),
      );
      line.current.setGeometries(
        traces.length > 1
          ? [
              {
                id: 'trace',
                styleId: 'trace',
                paths: traces.map(
                  (p) =>
                    new T.current.LatLng(
                      cache.current.get(key(p)).lat,
                      cache.current.get(key(p)).lng,
                    ),
                ),
              },
            ]
          : [],
      );
      if (fix) {
        const p = cache.current.get(key(fix));
        map.current.setCenter(new T.current.LatLng(p.lat, p.lng));
        map.current.setZoom(17);
      }
      if (!fix && points.length) {
        const p = cache.current.get(key(points[0]));
        map.current.setCenter(new T.current.LatLng(p.lat, p.lng));
        map.current.setZoom(17);
      }
      setError('');
    })().catch((e) => {
      if (!gone) setError(e.message);
    });
    return () => {
      gone = true;
    };
  }, [ready, fix, photos, track]);
  return (
    <div>
      <div ref={box} className="capture-map" />
      <small>蓝点与线：GPS 位置、采样轨迹 · 绿点：实拍照片</small>
      {error && (
        <p role="alert">地图定位显示失败：{error}。照片原始 GPS 仍保留。</p>
      )}
    </div>
  );
}
