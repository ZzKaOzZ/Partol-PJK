import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { conditionClass } from "./classify";
import { IconBack, IconClose } from "./icons";
import { photoSrc } from "./sheets";
import type { AppStore, MapPoint, TabId } from "./types";

const THAILAND: L.LatLngExpression = [13.7563, 100.5018];
const PIN_COLORS = [
  "#1a73e8",
  "#e37400",
  "#188038",
  "#d93025",
  "#8e24aa",
  "#00897b",
  "#5c6bc0",
  "#f9ab00",
  "#c2185b",
  "#3949ab",
];

function parseGps(value: string): { lat: number; lng: number } | null {
  if (!value?.trim()) return null;
  const m = value
    .replace(/[°NSEW]/gi, " ")
    .match(/(-?\d+(?:\.\d+)?)\s*[,/\s]\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function driveThumb(url: string) {
  const id = url.match(/[?&]id=([^&]+)/)?.[1] || url.match(/\/d\/([^/]+)/)?.[1];
  if (id && /drive\.google\.com|googleusercontent\.com/.test(url)) {
    return `https://drive.google.com/thumbnail?id=${id}&sz=w1200`;
  }
  return url;
}

export function mapPhoto(point: Pick<MapPoint, "photoData" | "photoUrl">) {
  const src = photoSrc(point);
  return src ? driveThumb(src) : "";
}

function pinColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PIN_COLORS[hash % PIN_COLORS.length];
}

function shortMain(name: string) {
  return name.replace(/^\d+\.\s*/, "").trim() || name || "ไม่ระบุอุปกรณ์หลัก";
}

function collectPoints(store: AppStore): MapPoint[] {
  const out: MapPoint[] = [];
  const seen = new Map<string, number>();

  function push(
    tab: TabId,
    row: {
      id: string;
      pole: string;
      voltage?: string;
      equipment: string;
      condition: string;
      gps: string;
      photoName: string;
      photoData?: string;
      photoUrl?: string;
      createdAt: string;
      jobType?: string;
      mainEquipment?: string;
      defect?: string;
    },
  ) {
    const parsed = parseGps(row.gps);
    if (!parsed) return;
    const key = `${parsed.lat.toFixed(6)},${parsed.lng.toFixed(6)}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    out.push({
      id: row.id,
      tab,
      pole: row.pole,
      jobType: row.jobType || (tab === "pd" ? "งาน PD" : tab === "thermal" ? "งาน Thermal" : "งาน Patrol"),
      voltage: row.voltage ?? "",
      mainEquipment: row.mainEquipment || row.equipment || "ไม่ระบุอุปกรณ์หลัก",
      equipment: row.equipment,
      defect: row.defect ?? "",
      condition: row.condition,
      gps: row.gps,
      lat: parsed.lat + n * 0.00004,
      lng: parsed.lng + n * 0.00004,
      photoName: row.photoName,
      photoData: row.photoData ?? "",
      photoUrl: row.photoUrl,
      createdAt: row.createdAt,
    });
  }

  for (const row of store.patrol) push("patrol", row);
  for (const row of store.thermal) push("thermal", row);
  for (const row of store.pd) push("pd", row);
  return out;
}

function tabLabel(tab: TabId) {
  if (tab === "thermal") return "Thermal";
  if (tab === "pd") return "PD";
  return "Patrol";
}

export default function MapPanel({
  store,
  onBack,
  onOpen,
}: {
  store: AppStore;
  onBack: () => void;
  onOpen: (tab: TabId, id: string) => void;
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const [job, setJob] = useState<"all" | TabId>("all");
  const [main, setMain] = useState("");
  const [selected, setSelected] = useState<MapPoint | null>(null);
  const [lightbox, setLightbox] = useState(false);

  const points = useMemo(() => collectPoints(store), [store]);
  const byJob = useMemo(
    () => (job === "all" ? points : points.filter((p) => p.tab === job)),
    [job, points],
  );
  const mains = useMemo(
    () => [...new Set(byJob.map((p) => p.mainEquipment))].sort((a, b) => a.localeCompare(b, "th")),
    [byJob],
  );
  const visible = useMemo(
    () => (main ? byJob.filter((p) => p.mainEquipment === main) : byJob),
    [byJob, main],
  );
  const missingGps =
    store.patrol.length + store.thermal.length + store.pd.length - points.length;

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView(THAILAND, 6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const id = window.setTimeout(() => map.invalidateSize(), 120);
    return () => {
      window.clearTimeout(id);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    visible.forEach((point) => {
      const color = pinColor(point.mainEquipment);
      const marker = L.marker([point.lat, point.lng], {
        icon: L.divIcon({
          className: `map-pin${selected?.id === point.id ? " on" : ""}`,
          html: `<span style="background:${color}"></span>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
        title: `${shortMain(point.mainEquipment)} · เสา ${point.pole || "-"}`,
      });
      marker.on("click", () => {
        setSelected(point);
        setLightbox(false);
      });
      marker.addTo(layer);
    });

    if (visible.length === 1) {
      map.setView([visible[0].lat, visible[0].lng], 16);
    } else if (visible.length > 1) {
      map.fitBounds(
        L.latLngBounds(visible.map((p) => [p.lat, p.lng] as L.LatLngTuple)),
        { padding: [36, 36], maxZoom: 16 },
      );
    } else {
      map.setView(THAILAND, 6);
    }
    window.setTimeout(() => map.invalidateSize(), 80);
  }, [visible, selected?.id]);

  const photo = selected ? mapPhoto(selected) : "";

  return (
    <section className="panel map-panel">
      <header className="panel-bar">
        <button className="icon-btn" onClick={onBack} aria-label="กลับ">
          <IconBack />
        </button>
        <h1>แผนที่งาน</h1>
      </header>

      <div className="map-filters">
        <div className="chip-row map-chips">
          {([
            ["all", "ทั้งหมด"],
            ["patrol", "Patrol"],
            ["thermal", "Thermal"],
            ["pd", "PD"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              className={`chip ${job === id ? "on" : ""}`}
              onClick={() => {
                setJob(id);
                setMain("");
                setSelected(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="field map-select">
          <label>อุปกรณ์หลัก</label>
          <select
            value={main}
            onChange={(e) => {
              setMain(e.target.value);
              setSelected(null);
            }}
          >
            <option value="">ทั้งหมด ({byJob.length} จุด)</option>
            {mains.map((name) => (
              <option key={name} value={name}>
                {shortMain(name)} ({byJob.filter((p) => p.mainEquipment === name).length})
              </option>
            ))}
          </select>
        </div>
        <div className="map-legend">
          {(main ? [main] : mains).map((name) => (
            <span key={name} className="map-legend-item">
              <i style={{ background: pinColor(name) }} />
              {shortMain(name)}
            </span>
          ))}
        </div>
      </div>

      <div className="map-stage">
        <div ref={mapEl} className="map-canvas" />
        {visible.length === 0 && (
          <div className="map-empty">
            {points.length === 0
              ? "ยังไม่มีพิกัดในข้อมูล — บันทึกงานพร้อม GPS หรือเชื่อมชีตแล้วกดรีเฟรช"
              : "ไม่มีจุดในประเภทที่เลือก"}
          </div>
        )}
        {missingGps > 0 && visible.length > 0 && (
          <p className="map-note">{missingGps} รายการยังไม่มีพิกัด จึงไม่โชว์บนแผนที่</p>
        )}
      </div>

      {selected && (
        <article className="map-card">
          <button className="icon-btn map-card-close" onClick={() => setSelected(null)} aria-label="ปิด">
            <IconClose />
          </button>
          {photo ? (
            <button className="map-card-photo" onClick={() => setLightbox(true)}>
              <img src={photo} alt={selected.photoName || "ภาพถ่าย"} />
            </button>
          ) : (
            <div className="map-card-photo empty">ไม่มีภาพถ่าย</div>
          )}
          <div className="map-card-body">
            <span className={`badge ${conditionClass(selected.condition)}`}>
              {selected.condition || "—"}
            </span>
            <h3>
              เสา {selected.pole || "-"} · {tabLabel(selected.tab)}
            </h3>
            <p>{shortMain(selected.mainEquipment)}</p>
            <p>{selected.defect || selected.equipment}</p>
            <p className="meta">{selected.gps}</p>
            <button className="mini-btn" onClick={() => onOpen(selected.tab, selected.id)}>
              ดูรายละเอียด
            </button>
          </div>
        </article>
      )}

      {lightbox && photo && (
        <div className="map-lightbox" onClick={() => setLightbox(false)}>
          <img src={photo} alt={selected?.photoName || "ภาพถ่าย"} />
        </div>
      )}
    </section>
  );
}
