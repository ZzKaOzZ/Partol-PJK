import { useEffect, useMemo, useState, type ReactNode } from "react";
import patrolCatalog from "./data/patrolCatalog.json";
import thermalCatalog from "./data/thermalCatalog.json";
import gndCriteria from "./data/gndCriteria.json";
import pdCriteria from "./data/pdCriteria.json";
import thermalThresholds from "./data/thermalThresholds.json";
import { classifyGround, classifyThermal, conditionClass } from "./classify";
import {
  IconBack,
  IconBook,
  IconCheck,
  IconClose,
  IconEdit,
  IconEye,
  IconGps,
  IconMap,
  IconMenu,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSelect,
  IconThermal,
  IconTrash,
  IconWave,
} from "./icons";
import MapPanel from "./MapPanel";
import { loadStore, resetStore, saveStore, uid } from "./store";
import {
  compressImage,
  deleteRemote,
  fetchRemoteStore,
  getScriptUrl,
  mergeStore,
  photoSrc,
  setScriptUrl as persistScriptUrl,
  SHEET_LINK,
  upsertRemote,
} from "./sheets";
import type {
  AppStore,
  Condition,
  PatrolItem,
  PatrolRecord,
  PdRecord,
  Screen,
  TabId,
  ThermalItem,
  ThermalRecord,
  Voltage,
} from "./types";

const patrolItems = patrolCatalog as PatrolItem[];
const thermalItems = thermalCatalog as ThermalItem[];
const PD_TYPES = ["Surface", "Corona", "Internal", "Floating", "Particle", "Arcing"];

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function numbered(values: string[]) {
  return unique(values).sort((a, b) => {
    const na = Number(a.match(/^(\d+)/)?.[1] ?? 999);
    const nb = Number(b.match(/^(\d+)/)?.[1] ?? 999);
    return na - nb || a.localeCompare(b, "th");
  });
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function tabTitle(tab: TabId) {
  if (tab === "thermal") return "Thermal Viewer";
  if (tab === "pd") return "PD";
  return "Patrol";
}

function readFile(file: File) {
  return new Promise<{ name: string; data: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, data: String(reader.result) });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function tabFromHash(): TabId {
  const hash = window.location.hash.replace("#", "");
  if (hash === "thermal" || hash === "pd") return hash;
  return "patrol";
}

function hashIsMap() {
  return window.location.hash.replace("#", "") === "map";
}

export default function App() {
  const [tab, setTab] = useState<TabId>(tabFromHash);
  const [screen, setScreen] = useState<Screen>(() => (hashIsMap() ? { name: "map" } : { name: "list" }));
  const [store, setStore] = useState<AppStore>(loadStore);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [drawer, setDrawer] = useState(false);
  const [toast, setToast] = useState("");
  const [scriptUrl, setScriptUrl] = useState(getScriptUrl);
  const [clock, setClock] = useState(() =>
    new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  );

  useEffect(() => {
    saveStore(store);
  }, [store]);

  useEffect(() => {
    let cancelled = false;
    fetchRemoteStore().then((remote) => {
      if (cancelled || !remote) return;
      setStore((prev) => mergeStore(prev, remote));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(""), 4000);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    const id = setInterval(() => {
      setClock(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
    }, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onHash = () => {
      if (hashIsMap()) {
        setScreen({ name: "map" });
        return;
      }
      setTab(tabFromHash());
      setScreen((prev) => (prev.name === "map" ? { name: "list" } : prev));
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const records = store[tab];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (!q) return list;
    return list.filter((row) => JSON.stringify(row).toLowerCase().includes(q));
  }, [query, records]);

  function goList(nextTab: TabId = tab) {
    setTab(nextTab);
    window.location.hash = nextTab;
    setScreen({ name: "list" });
    setDrawer(false);
    setSelecting(false);
    setSelected([]);
  }

  function goMap() {
    setDrawer(false);
    setSelecting(false);
    setSelected([]);
    setScreen({ name: "map" });
    window.location.hash = "map";
  }

  function persist(next: AppStore) {
    setStore(next);
  }

  async function refreshFromSheet() {
    const remote = await fetchRemoteStore();
    if (remote) {
      persist(mergeStore(loadStore(), remote));
      setToast("โหลดข้อมูลจาก Google Sheet แล้ว");
      return;
    }
    persist(loadStore());
    setToast(getScriptUrl() ? "รีเฟรชข้อมูลในเครื่องแล้ว" : "ยังไม่ได้เชื่อม Apps Script");
  }

  function saveRecord(kind: TabId, record: PatrolRecord | ThermalRecord | PdRecord) {
    const list = store[kind] as Array<PatrolRecord | ThermalRecord | PdRecord>;
    const exists = list.some((row) => row.id === record.id);
    persist({
      ...store,
      [kind]: exists
        ? list.map((row) => (row.id === record.id ? record : row))
        : [record, ...list],
    } as AppStore);
    setScreen({ name: "detail", tab: kind, id: record.id });
    if (!getScriptUrl()) {
      setToast("บันทึกในเครื่องแล้ว — วางลิงก์ Apps Script ในเมนูเพื่อส่งเข้าชีต");
      return;
    }
    setToast("กำลังบันทึกลง Google Sheet...");
    void upsertRemote(kind, record).then((synced) => {
      if (!synced) {
        setToast("บันทึกในเครื่องแล้ว แต่ส่งเข้าชีตไม่สำเร็จ");
        return;
      }
      setStore((prev) => ({
        ...prev,
        [kind]: prev[kind].map((row) => (row.id === synced.id ? { ...row, ...synced } : row)),
      }));
      setToast("บันทึกลง Google Sheet แล้ว กดลิงก์ภาพเพื่อดาวน์โหลดได้");
    });
  }

  function removeSelected() {
    const ids = new Set(selected);
    persist({
      ...store,
      [tab]: store[tab].filter((row) => !ids.has(row.id)),
    });
    ids.forEach((id) => void deleteRemote(tab, id));
    setSelected([]);
    setSelecting(false);
    setToast("ลบรายการที่เลือกแล้ว");
  }

  function removeOne(id: string, kind: TabId) {
    persist({
      ...store,
      [kind]: store[kind].filter((row) => row.id !== id),
    });
    void deleteRemote(kind, id);
    setScreen({ name: "list" });
    setToast("ลบรายการแล้ว");
  }

  return (
    <div className="stage">
      <div className="phone">
        <div className="status-bar">
          <span>{clock}</span>
          <span className="status-icons">5G · 100%</span>
        </div>
        <div className="app-shell">
          {screen.name === "list" && (
            <>
              <header className="topbar">
                {selecting ? (
                  <button className="icon-btn" onClick={() => { setSelecting(false); setSelected([]); }} aria-label="ยกเลิกเลือก">
                    <IconClose />
                  </button>
                ) : (
                  <button className="icon-btn" onClick={() => setDrawer(true)} aria-label="เมนู">
                    <IconMenu />
                  </button>
                )}
                {searching ? (
                  <div className="search-wrap">
                    <input
                      autoFocus
                      placeholder="ค้นหา"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="spacer" />
                )}
                {selecting ? (
                  <button className="icon-btn danger" onClick={removeSelected} disabled={!selected.length} aria-label="ลบ">
                    <IconTrash />
                  </button>
                ) : (
                  <>
                    <button className="icon-btn" onClick={() => setSearching((v) => !v)} aria-label="ค้นหา">
                      <IconSearch />
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => setSelecting(true)}
                      aria-label="เลือก"
                    >
                      <IconSelect />
                    </button>
                    <button className="icon-btn" onClick={goMap} aria-label="แผนที่">
                      <IconMap />
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => void refreshFromSheet()}
                      aria-label="รีเฟรช"
                    >
                      <IconRefresh />
                    </button>
                  </>
                )}
              </header>

              <main className="content">
                {!scriptUrl && (
                  <p className="hint sheet-banner">
                    ยังไม่ได้เชื่อม Google Sheet — เปิดเมนูแล้ววางลิงก์ Apps Script เพื่อบันทึกลงชีตและให้คอลัมน์รูปดาวน์โหลดได้
                  </p>
                )}
                {filtered.length === 0 ? (
                  <div className="empty">No items</div>
                ) : (
                  <div className="list">
                    {filtered.map((row) => (
                      <article
                        key={row.id}
                        className="card"
                        onClick={() => {
                          if (selecting) {
                            setSelected((cur) =>
                              cur.includes(row.id) ? cur.filter((id) => id !== row.id) : [...cur, row.id],
                            );
                            return;
                          }
                          setScreen({ name: "detail", tab, id: row.id });
                        }}
                      >
                        {selecting && (
                          <input
                            className="card-check"
                            type="checkbox"
                            checked={selected.includes(row.id)}
                            readOnly
                          />
                        )}
                        <div>
                          <h3>
                            {"pole" in row ? `เสา ${row.pole || "-"}` : tabTitle(tab)}{" "}
                            {"voltage" in row && row.voltage ? `· ${row.voltage}` : ""}
                          </h3>
                          <p>
                            {"defect" in row && row.defect
                              ? row.defect
                              : "equipment" in row
                                ? row.equipment
                                : ""}
                          </p>
                          <div className="meta">{formatWhen(row.createdAt)}</div>
                        </div>
                        <span className={`badge ${conditionClass("condition" in row ? String(row.condition) : "")}`}>
                          {"condition" in row && row.condition ? row.condition : "—"}
                        </span>
                      </article>
                    ))}
                  </div>
                )}
              </main>

              <button className="fab" onClick={() => setScreen({ name: "form", tab })} aria-label="เพิ่มรายการ">
                <IconPlus />
              </button>

              <nav className="bottom-nav">
                <button className={`nav-item ${tab === "patrol" ? "active" : ""}`} onClick={() => goList("patrol")}>
                  <IconEye />
                  Patrol
                </button>
                <button className={`nav-item ${tab === "thermal" ? "active" : ""}`} onClick={() => goList("thermal")}>
                  <IconThermal />
                  Thermal Viewer
                </button>
                <button className={`nav-item ${tab === "pd" ? "active" : ""}`} onClick={() => goList("pd")}>
                  <IconWave />
                  PD
                </button>
                <button className="nav-item" onClick={goMap}>
                  <IconMap />
                  แผนที่
                </button>
              </nav>
            </>
          )}

          {screen.name === "form" && (
            <RecordForm
              tab={screen.tab}
              existing={
                screen.id
                  ? store[screen.tab].find((row) => row.id === screen.id)
                  : undefined
              }
              onClose={() => setScreen(screen.id ? { name: "detail", tab: screen.tab, id: screen.id } : { name: "list" })}
              onSave={(record) => saveRecord(screen.tab, record)}
            />
          )}

          {screen.name === "detail" && (
            <DetailPanel
              tab={screen.tab}
              record={store[screen.tab].find((row) => row.id === screen.id)}
              onBack={() => {
                if (hashIsMap()) {
                  setScreen({ name: "map" });
                  return;
                }
                goList(screen.tab);
              }}
              onEdit={() => setScreen({ name: "form", tab: screen.tab, id: screen.id })}
              onDelete={() => removeOne(screen.id, screen.tab)}
            />
          )}

          {screen.name === "criteria" && (
            <CriteriaPanel kind={screen.kind} onBack={() => setScreen({ name: "list" })} />
          )}

          {screen.name === "map" && (
            <MapPanel
              store={store}
              onBack={() => goList(tab)}
              onOpen={(kind, id) => setScreen({ name: "detail", tab: kind, id })}
            />
          )}

          {drawer && (
            <>
              <div className="drawer-backdrop" onClick={() => setDrawer(false)} />
              <aside className="drawer">
                <div className="drawer-head">
                  <h2>Partol</h2>
                  <p>ระบบจำหน่ายไฟฟ้า · Maintenance Policy</p>
                </div>
                <nav>
                  <button className={`row ${tab === "patrol" ? "active" : ""}`} onClick={() => goList("patrol")}>
                    <IconEye /> Patrol
                  </button>
                  <button className={`row ${tab === "thermal" ? "active" : ""}`} onClick={() => goList("thermal")}>
                    <IconThermal /> Thermal Viewer
                  </button>
                  <button className={`row ${tab === "pd" ? "active" : ""}`} onClick={() => goList("pd")}>
                    <IconWave /> PD
                  </button>
                  <button className={`row ${screen.name === "map" ? "active" : ""}`} onClick={goMap}>
                    <IconMap /> แผนที่ตามอุปกรณ์หลัก
                  </button>
                  <div className="sep" />
                  <button className="row" onClick={() => { setDrawer(false); setScreen({ name: "criteria", kind: "patrol" }); }}>
                    <IconBook /> เกณฑ์ Patrol
                  </button>
                  <button className="row" onClick={() => { setDrawer(false); setScreen({ name: "criteria", kind: "thermal" }); }}>
                    <IconBook /> เกณฑ์ Thermal
                  </button>
                  <button className="row" onClick={() => { setDrawer(false); setScreen({ name: "criteria", kind: "pd" }); }}>
                    <IconBook /> เกณฑ์ PD
                  </button>
                  <button className="row" onClick={() => { setDrawer(false); setScreen({ name: "criteria", kind: "gnd" }); }}>
                    <IconBook /> เกณฑ์ความต้านทานดิน
                  </button>
                  <div className="sep" />
                  <button
                    className="row"
                    onClick={() => {
                      persist(resetStore());
                      setDrawer(false);
                      setToast("คืนค่าข้อมูลตัวอย่างแล้ว");
                    }}
                  >
                    <IconRefresh /> คืนค่าข้อมูลตัวอย่าง
                  </button>
                  <a className="row" href={SHEET_LINK} target="_blank" rel="noreferrer">
                    เปิด Google Sheet
                  </a>
                  <div className="drawer-settings">
                    <label>ลิงก์ Apps Script</label>
                    <input
                      value={scriptUrl}
                      onChange={(e) => {
                        setScriptUrl(e.target.value);
                        persistScriptUrl(e.target.value);
                      }}
                      placeholder="https://script.google.com/macros/s/..."
                    />
                    <p>วาง URL หลัง Deploy เว็บแอป เพื่อบันทึกข้อมูลและรูปลงชีต</p>
                  </div>
                </nav>
              </aside>
            </>
          )}

          {toast && <div className="toast">{toast}</div>}
        </div>
      </div>
    </div>
  );
}

function RecordForm({
  tab,
  existing,
  onClose,
  onSave,
}: {
  tab: TabId;
  existing?: PatrolRecord | ThermalRecord | PdRecord;
  onClose: () => void;
  onSave: (record: PatrolRecord | ThermalRecord | PdRecord) => void;
}) {
  if (tab === "thermal") {
    return (
      <ThermalForm
        existing={existing as ThermalRecord | undefined}
        onClose={onClose}
        onSave={onSave}
      />
    );
  }
  if (tab === "pd") {
    return <PdForm existing={existing as PdRecord | undefined} onClose={onClose} onSave={onSave} />;
  }
  return (
    <PatrolForm existing={existing as PatrolRecord | undefined} onClose={onClose} onSave={onSave} />
  );
}

type PickerOption = { value: string; title: string; subtitle?: string };

function CatalogPicker({
  label,
  value,
  placeholder,
  disabled,
  options,
  sourceHint,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  disabled?: boolean;
  options: PickerOption[];
  sourceHint?: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const selected = options.find((o) => o.value === value);
  const filtered = options.filter((o) => {
    const hay = `${o.title} ${o.subtitle ?? ""}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  return (
    <>
      <div className="field">
        <label>{label}</label>
        <button
          type="button"
          className="picker-btn"
          disabled={disabled}
          onClick={() => {
            setQ("");
            setOpen(true);
          }}
        >
          {selected ? selected.title : <span className="placeholder">{placeholder}</span>}
        </button>
        {sourceHint && !disabled && <p className="hint">{sourceHint}</p>}
      </div>
      {open && (
        <div className="picker-overlay">
          <header className="panel-bar">
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label="กลับ">
              <IconBack />
            </button>
            <h1>{label}</h1>
          </header>
          <input
            className="picker-search"
            autoFocus
            placeholder="ค้นหาจากตาราง Patrol"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="picker-count">
            {filtered.length} รายการ จากตาราง Patrol
          </div>
          <div className="picker-list">
            {filtered.length === 0 ? (
              <div className="empty">ไม่พบรายการ</div>
            ) : (
              filtered.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  className={`picker-item ${opt.value === value ? "on" : ""}`}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  <b>{opt.title}</b>
                  {opt.subtitle && <span>{opt.subtitle}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}

function FormShell({
  title,
  onClose,
  onSave,
  children,
}: {
  title: string;
  onClose: () => void;
  onSave: () => void;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <header className="panel-bar">
        <button className="icon-btn" onClick={onClose} aria-label="ปิด">
          <IconClose />
        </button>
        <h1>{title}</h1>
        <button className="icon-btn" onClick={onSave} aria-label="บันทึก">
          <IconCheck />
        </button>
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}

function GpsField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="field">
      <label>พิกัด</label>
      <div className="row-2">
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="ละติจูด, ลองจิจูด" />
        <button
          className="mini-btn"
          type="button"
          onClick={() => {
            if (!navigator.geolocation) return;
            navigator.geolocation.getCurrentPosition((pos) => {
              onChange(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`);
            });
          }}
        >
          <IconGps /> GPS
        </button>
      </div>
    </div>
  );
}

function PhotoField({
  name,
  data,
  onChange,
}: {
  name: string;
  data: string;
  onChange: (name: string, data: string) => void;
}) {
  return (
    <div className="field">
      <label>ภาพถ่าย</label>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const next = await readFile(file);
          const data = await compressImage(next.data);
          onChange(next.name.replace(/\.[^.]+$/, ".jpg"), data);
        }}
      />
      {name && <div className="hint">{name}</div>}
      {data && <img className="photo-preview" src={data} alt={name} />}
    </div>
  );
}

function PatrolForm({
  existing,
  onClose,
  onSave,
}: {
  existing?: PatrolRecord;
  onClose: () => void;
  onSave: (record: PatrolRecord) => void;
}) {
  const [pole, setPole] = useState(existing?.pole ?? "");
  const [voltage, setVoltage] = useState<Voltage | "">(existing?.voltage ?? "");
  const [mainEquipment, setMain] = useState(existing?.mainEquipment ?? "");
  const [equipment, setEquipment] = useState(existing?.equipment ?? "");
  const [code, setCode] = useState(existing?.code ?? "");
  const [condition, setCondition] = useState<Condition | "">(existing?.condition ?? "");
  const [resistanceOhm, setOhm] = useState(existing?.resistanceOhm ?? "");
  const [gps, setGps] = useState(existing?.gps ?? "");
  const [photoName, setPhotoName] = useState(existing?.photoName ?? "");
  const [photoData, setPhotoData] = useState(existing?.photoData ?? "");

  const mains = numbered(patrolItems.filter((i) => i.voltage === voltage).map((i) => i.mainEquipment));
  const eqs = numbered(
    patrolItems.filter((i) => i.voltage === voltage && i.mainEquipment === mainEquipment).map((i) => i.equipment),
  );
  const defects = patrolItems.filter(
    (i) => i.voltage === voltage && i.mainEquipment === mainEquipment && i.equipment === equipment,
  );
  const selected = defects.find((i) => i.code === code) ?? patrolItems.find((i) => i.code === code && i.voltage === voltage);
  const groundItem = Boolean(code.endsWith("GR-41"));
  const sheetCount = patrolItems.filter((i) => i.voltage === voltage).length;

  const mainOptions = mains.map((v) => ({
    value: v,
    title: v,
    subtitle: `${patrolItems.filter((i) => i.voltage === voltage && i.mainEquipment === v).length} รายการตรวจ`,
  }));
  const equipmentOptions = eqs.map((v) => ({
    value: v,
    title: v,
    subtitle: `${patrolItems.filter((i) => i.voltage === voltage && i.mainEquipment === mainEquipment && i.equipment === v).length} สิ่งผิดปกติ`,
  }));
  const defectOptions = defects.map((item) => ({
    value: item.code,
    title: item.defect,
    subtitle: item.code,
  }));
  const conditionOptions = selected
    ? (
        [
          { key: "ดี" as const, text: selected.good },
          { key: "ปานกลาง" as const, text: selected.fair },
          { key: "แย่" as const, text: selected.poor },
        ] as const
      )
        .filter((row) => row.text && row.text !== "-")
        .map((row) => ({
          value: row.key,
          title: `${row.key} · ${row.text}`,
          subtitle: "จากตาราง Patrol คอลัมน์ ดี / ปานกลาง / แย่",
        }))
    : [];

  const action = useMemo(() => {
    if (groundItem && resistanceOhm) {
      return classifyGround(voltage, Number(resistanceOhm)).action;
    }
    if (!selected || !condition) return existing?.action ?? "";
    if (condition === "ดี") return selected.good;
    if (condition === "ปานกลาง") return selected.fair;
    return selected.poor;
  }, [condition, existing?.action, groundItem, resistanceOhm, selected, voltage]);

  useEffect(() => {
    if (!groundItem || !resistanceOhm) return;
    setCondition(classifyGround(voltage, Number(resistanceOhm)).condition);
  }, [groundItem, resistanceOhm, voltage]);

  return (
    <FormShell
      title={existing ? "แก้ไข Patrol" : "Patrol ใหม่"}
      onClose={onClose}
      onSave={() =>
        onSave({
          id: existing?.id ?? uid("pt"),
          pole,
          jobType: "งาน Patrol",
          voltage,
          mainEquipment,
          equipment,
          code,
          defect: selected?.defect ?? existing?.defect ?? "",
          condition,
          action,
          resistanceOhm,
          gps,
          photoName,
          photoData,
          photoUrl: existing?.photoUrl,
          fairDesc: selected?.fair ?? existing?.fairDesc ?? "",
          poorDesc: selected?.poor ?? existing?.poorDesc ?? "",
          createdAt: existing?.createdAt ?? new Date().toISOString(),
        })
      }
    >
      <div className="field">
        <label>เสาไฟต้นที่</label>
        <input value={pole} onChange={(e) => setPole(e.target.value)} placeholder="เช่น 12" />
      </div>
      <div className="field">
        <label>ประเภทงาน</label>
        <input value="งาน Patrol" readOnly />
      </div>
      <div className="field">
        <label>ระดับแรงดัน</label>
        <select
          value={voltage}
          onChange={(e) => {
            setVoltage(e.target.value as Voltage);
            setMain("");
            setEquipment("");
            setCode("");
            setCondition("");
          }}
        >
          <option value="">เลือก</option>
          <option value="HV">HV · ระบบสายส่ง</option>
          <option value="MV">MV · ระบบจำหน่าย</option>
          <option value="LV">LV · ระบบแรงต่ำ</option>
        </select>
      </div>
      {voltage === "MV" && (
        <p className="hint">ตัวเลือกทุกช่องด้านล่างมาจากตาราง Patrol ระบบจำหน่าย ({sheetCount} รายการ)</p>
      )}
      <CatalogPicker
        label="อุปกรณ์หลัก"
        value={mainEquipment}
        placeholder={voltage ? "เลือกอุปกรณ์หลัก" : "เลือกระดับแรงดันก่อน"}
        disabled={!voltage}
        options={mainOptions}
        sourceHint={voltage ? `${mainOptions.length} กลุ่ม จากตาราง Patrol (${voltage})` : undefined}
        onChange={(v) => {
          setMain(v);
          setEquipment("");
          setCode("");
          setCondition("");
        }}
      />
      <CatalogPicker
        label="อุปกรณ์"
        value={equipment}
        placeholder={mainEquipment ? "เลือกอุปกรณ์" : "เลือกอุปกรณ์หลักก่อน"}
        disabled={!mainEquipment}
        options={equipmentOptions}
        sourceHint={mainEquipment ? `${equipmentOptions.length} รายการย่อย` : undefined}
        onChange={(v) => {
          setEquipment(v);
          setCode("");
          setCondition("");
        }}
      />
      <CatalogPicker
        label="สิ่งผิดปกติที่ตรวจพบ"
        value={code}
        placeholder={equipment ? "เลือกสิ่งผิดปกติ" : "เลือกอุปกรณ์ก่อน"}
        disabled={!equipment}
        options={defectOptions}
        sourceHint={equipment ? `${defectOptions.length} รายการตรวจ` : undefined}
        onChange={(v) => {
          setCode(v);
          setCondition("");
        }}
      />
      {groundItem && (
        <div className="field">
          <label>ค่าความต้านทานดิน (Ω)</label>
          <input
            type="number"
            step="0.1"
            value={resistanceOhm}
            onChange={(e) => setOhm(e.target.value)}
            placeholder="ระบุค่าที่วัดได้"
          />
        </div>
      )}
      <CatalogPicker
        label="สภาพที่พบ"
        value={condition}
        placeholder={code ? "เลือกสภาพตามเกณฑ์ในตาราง" : "เลือกสิ่งผิดปกติก่อน"}
        disabled={!selected}
        options={conditionOptions}
        sourceHint={selected ? "ข้อความเกณฑ์จากคอลัมน์ ดี / ปานกลาง / แย่" : undefined}
        onChange={(v) => setCondition(v as Condition)}
      />
      {action && action !== "-" && <p className="hint">แนวทางแก้ไข: {action}</p>}
      <GpsField value={gps} onChange={setGps} />
      <PhotoField
        name={photoName}
        data={photoData}
        onChange={(n, d) => {
          setPhotoName(n);
          setPhotoData(d);
        }}
      />
    </FormShell>
  );
}

function ThermalForm({
  existing,
  onClose,
  onSave,
}: {
  existing?: ThermalRecord;
  onClose: () => void;
  onSave: (record: ThermalRecord) => void;
}) {
  const [pole, setPole] = useState(existing?.pole ?? "");
  const [voltage, setVoltage] = useState<Voltage | "">(existing?.voltage ?? "");
  const [mainEquipment, setMain] = useState(existing?.mainEquipment ?? "");
  const [equipment, setEquipment] = useState(existing?.equipment ?? "");
  const [code, setCode] = useState(existing?.code ?? "");
  const [deltaT, setDeltaT] = useState(existing?.deltaT === undefined ? "" : String(existing.deltaT));
  const [gps, setGps] = useState(existing?.gps ?? "");
  const [photoName, setPhotoName] = useState(existing?.photoName ?? "");
  const [photoData, setPhotoData] = useState(existing?.photoData ?? "");

  const mains = numbered(thermalItems.filter((i) => i.voltage === voltage).map((i) => i.mainEquipment));
  const eqs = numbered(
    thermalItems.filter((i) => i.voltage === voltage && i.mainEquipment === mainEquipment).map((i) => i.equipment),
  );
  const defects = thermalItems.filter(
    (i) => i.voltage === voltage && i.mainEquipment === mainEquipment && i.equipment === equipment,
  );
  const selected = defects.find((i) => i.code === code);
  const classified =
    selected && deltaT !== "" ? classifyThermal(selected.category, Number(deltaT)) : null;

  return (
    <FormShell
      title={existing ? "แก้ไข Thermal" : "Thermal ใหม่"}
      onClose={onClose}
      onSave={() =>
        onSave({
          id: existing?.id ?? uid("th"),
          pole,
          jobType: "งาน Thermal",
          voltage,
          mainEquipment,
          equipment,
          code,
          defect: selected?.defect ?? existing?.defect ?? "",
          fairDesc: selected?.fair ?? "",
          poorDesc: selected?.poor ?? "",
          veryPoorDesc: selected?.veryPoor ?? "",
          deltaT: deltaT === "" ? "" : Number(deltaT),
          condition: classified?.condition ?? existing?.condition ?? "",
          action: classified?.action ?? existing?.action ?? "",
          gps,
          photoName,
          photoData,
          photoUrl: existing?.photoUrl,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
        })
      }
    >
      <div className="field">
        <label>เสาไฟต้นที่</label>
        <input value={pole} onChange={(e) => setPole(e.target.value)} />
      </div>
      <div className="field">
        <label>ระดับแรงดัน</label>
        <select
          value={voltage}
          onChange={(e) => {
            setVoltage(e.target.value as Voltage);
            setMain("");
            setEquipment("");
            setCode("");
          }}
        >
          <option value="">เลือก</option>
          <option value="HV">HV</option>
          <option value="MV">MV</option>
          <option value="LV">LV</option>
        </select>
      </div>
      <div className="field">
        <label>อุปกรณ์หลัก</label>
        <select value={mainEquipment} onChange={(e) => { setMain(e.target.value); setEquipment(""); setCode(""); }}>
          <option value="">เลือก</option>
          {mains.map((v) => <option key={v}>{v}</option>)}
        </select>
      </div>
      <div className="field">
        <label>อุปกรณ์</label>
        <select value={equipment} onChange={(e) => { setEquipment(e.target.value); setCode(""); }}>
          <option value="">เลือก</option>
          {eqs.map((v) => <option key={v}>{v}</option>)}
        </select>
      </div>
      <div className="field">
        <label>จุดที่ตรวจพบความร้อน</label>
        <select value={code} onChange={(e) => setCode(e.target.value)}>
          <option value="">เลือก</option>
          {defects.map((item) => (
            <option key={item.code} value={item.code}>
              {item.code} · {item.defect}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>ความแตกต่างอุณหภูมิ (°C)</label>
        <input type="number" step="0.1" value={deltaT} onChange={(e) => setDeltaT(e.target.value)} />
      </div>
      {classified && (
        <p className="hint">
          สภาพที่พบ: {classified.condition} · {classified.action}
        </p>
      )}
      <GpsField value={gps} onChange={setGps} />
      <PhotoField name={photoName} data={photoData} onChange={(n, d) => { setPhotoName(n); setPhotoData(d); }} />
    </FormShell>
  );
}

function PdForm({
  existing,
  onClose,
  onSave,
}: {
  existing?: PdRecord;
  onClose: () => void;
  onSave: (record: PdRecord) => void;
}) {
  const [pole, setPole] = useState(existing?.pole ?? "");
  const [voltage, setVoltage] = useState<Voltage | "">(existing?.voltage ?? "");
  const [equipment, setEquipment] = useState(existing?.equipment ?? "");
  const [condition, setCondition] = useState(existing?.condition ?? "");
  const [pdType, setPdType] = useState(existing?.pdType ?? "");
  const [gps, setGps] = useState(existing?.gps ?? "");
  const [photoName, setPhotoName] = useState(existing?.photoName ?? "");
  const [photoData, setPhotoData] = useState(existing?.photoData ?? "");

  const item = pdCriteria.equipment.find((row) => row.equipment === equipment);
  const action =
    condition.startsWith("ดี")
      ? item?.good ?? ""
      : condition.includes("ปานกลาง")
        ? item?.fair ?? ""
        : condition.includes("แย่")
          ? item?.poor ?? ""
          : existing?.action ?? "";

  return (
    <FormShell
      title={existing ? "แก้ไข PD" : "PD ใหม่"}
      onClose={onClose}
      onSave={() =>
        onSave({
          id: existing?.id ?? uid("pd"),
          pole,
          voltage,
          equipment,
          condition,
          action,
          pdType,
          gps,
          photoName,
          photoData,
          photoUrl: existing?.photoUrl,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
        })
      }
    >
      <div className="field">
        <label>เสาไฟต้นที่</label>
        <input value={pole} onChange={(e) => setPole(e.target.value)} />
      </div>
      <div className="field">
        <label>ระดับแรงดัน</label>
        <select value={voltage} onChange={(e) => setVoltage(e.target.value as Voltage)}>
          <option value="">เลือก</option>
          <option value="HV">HV</option>
          <option value="MV">MV</option>
          <option value="LV">LV</option>
        </select>
      </div>
      <div className="field">
        <label>อุปกรณ์</label>
        <select value={equipment} onChange={(e) => setEquipment(e.target.value)}>
          <option value="">เลือก</option>
          {pdCriteria.equipment.map((row) => (
            <option key={row.equipment}>{row.equipment}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>สภาพที่พบ</label>
        <select value={condition} onChange={(e) => setCondition(e.target.value)}>
          <option value="">เลือก</option>
          <option value="ดี (Good)">ดี (Good)</option>
          <option value="ปานกลาง (Fair)">ปานกลาง (Fair)</option>
          <option value="แย่ (Poor)">แย่ (Poor)</option>
        </select>
      </div>
      {action && <p className="hint">{action}</p>}
      <div className="field">
        <label>ลักษณะ PD</label>
        <select value={pdType} onChange={(e) => setPdType(e.target.value)}>
          <option value="">เลือก</option>
          {PD_TYPES.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </div>
      <GpsField value={gps} onChange={setGps} />
      <PhotoField name={photoName} data={photoData} onChange={(n, d) => { setPhotoName(n); setPhotoData(d); }} />
    </FormShell>
  );
}

function DetailPanel({
  tab,
  record,
  onBack,
  onEdit,
  onDelete,
}: {
  tab: TabId;
  record?: PatrolRecord | ThermalRecord | PdRecord;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  if (!record) {
    return (
      <section className="panel">
        <header className="panel-bar">
          <button className="icon-btn" onClick={onBack}><IconBack /></button>
          <h1>ไม่พบรายการ</h1>
        </header>
      </section>
    );
  }

  const rows: [string, string][] = [
    ["เสาไฟต้นที่", record.pole],
    ["ระดับแรงดัน", record.voltage],
  ];
  if ("jobType" in record) rows.push(["ประเภทงาน", record.jobType]);
  if ("mainEquipment" in record) rows.push(["อุปกรณ์หลัก", record.mainEquipment]);
  rows.push(["อุปกรณ์", record.equipment]);
  if ("code" in record) rows.push(["รหัส", record.code]);
  if ("defect" in record) rows.push(["สิ่งผิดปกติ", record.defect]);
  if ("deltaT" in record) rows.push(["ΔT (°C)", String(record.deltaT ?? "")]);
  if ("pdType" in record) rows.push(["ลักษณะ PD", record.pdType]);
  if ("resistanceOhm" in record && record.resistanceOhm) rows.push(["ความต้านทานดิน", `${record.resistanceOhm} Ω`]);
  rows.push(["สภาพที่พบ", record.condition]);
  rows.push(["แนวทางแก้ไข", record.action]);
  rows.push(["พิกัด", record.gps]);
  rows.push(["บันทึกเมื่อ", formatWhen(record.createdAt)]);

  return (
    <section className="panel">
      <header className="panel-bar">
        <button className="icon-btn" onClick={onBack} aria-label="กลับ"><IconBack /></button>
        <h1>{tabTitle(tab)}</h1>
        <button className="icon-btn" onClick={onEdit} aria-label="แก้ไข"><IconEdit /></button>
        <button className="icon-btn danger" onClick={onDelete} aria-label="ลบ"><IconTrash /></button>
      </header>
      <div className="detail">
        <h2>เสา {record.pole || "-"}</h2>
        <span className={`badge ${conditionClass(record.condition)}`}>{record.condition || "—"}</span>
        {photoSrc(record) && <img className="photo-preview" src={photoSrc(record)} alt={record.photoName || "ภาพถ่าย"} />}
        {record.photoUrl && (
          <a className="download-link" href={record.photoUrl} target="_blank" rel="noreferrer">
            ดาวน์โหลดภาพถ่าย
          </a>
        )}
        {record.photoName && !photoSrc(record) && !record.photoUrl && <p className="hint">{record.photoName}</p>}
        <dl>
          {rows.filter(([, v]) => v).map(([k, v]) => (
            <div className="kv" key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function CriteriaPanel({
  kind,
  onBack,
}: {
  kind: "patrol" | "thermal" | "pd" | "gnd";
  onBack: () => void;
}) {
  const [voltage, setVoltage] = useState<Voltage | "">("MV");
  const [main, setMain] = useState("");
  const titles = {
    patrol: "เกณฑ์ Patrol",
    thermal: "เกณฑ์ Thermal",
    pd: "เกณฑ์ PD",
    gnd: "เกณฑ์ความต้านทานดิน",
  };

  const mains = numbered(patrolItems.filter((i) => i.voltage === voltage).map((i) => i.mainEquipment));
  const shown = patrolItems.filter(
    (i) => i.voltage === voltage && (!main || i.mainEquipment === main),
  );

  return (
    <section className="panel">
      <header className="panel-bar">
        <button className="icon-btn" onClick={onBack}><IconBack /></button>
        <h1>{titles[kind]}</h1>
      </header>
      <div className="panel-body">
        {kind === "patrol" && (
          <>
            <div className="chip-row">
              {(["HV", "MV", "LV"] as Voltage[]).map((v) => (
                <button key={v} className={`chip ${voltage === v ? "on" : ""}`} onClick={() => { setVoltage(v); setMain(""); }}>
                  {v}
                </button>
              ))}
            </div>
            <div className="field">
              <label>อุปกรณ์หลัก</label>
              <select value={main} onChange={(e) => setMain(e.target.value)}>
                <option value="">ทั้งหมด</option>
                {mains.map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
            {shown.map((item) => (
              <article className="criteria-card" key={item.code}>
                <h3>{item.code} · {item.defect}</h3>
                <p>{item.equipment}</p>
                <p>ดี: {item.good}</p>
                <p>ปานกลาง: {item.fair}</p>
                <p>แย่: {item.poor}</p>
              </article>
            ))}
          </>
        )}
        {kind === "thermal" && (
          <>
            {thermalThresholds.levels.map((row) => (
              <article className="criteria-card" key={row.level}>
                <h3>{row.level} · {row.period}</h3>
                <p>{row.definition}</p>
              </article>
            ))}
            {thermalThresholds.items.map((row) => (
              <article className="criteria-card" key={row.name}>
                <h3>{row.name}</h3>
                <p>ดี {row.good} · ปานกลาง {row.fair} · แย่ {row.poor} · แย่มาก {row.veryPoor}</p>
              </article>
            ))}
            {thermalItems.map((item) => (
              <article className="criteria-card" key={item.code}>
                <h3>{item.code} · {item.defect}</h3>
                <p>{item.voltage} · {item.equipment}</p>
              </article>
            ))}
          </>
        )}
        {kind === "pd" && (
          <>
            {pdCriteria.levels.map((row) => (
              <article className="criteria-card" key={row.level}>
                <h3>{row.level} · {row.period}</h3>
                <p>{row.definition}</p>
              </article>
            ))}
            {pdCriteria.equipment.map((row) => (
              <article className="criteria-card" key={row.equipment}>
                <h3>{row.equipment}</h3>
                <p>ดี: {row.good}</p>
                <p>ปานกลาง: {row.fair}</p>
                <p>แย่: {row.poor}</p>
              </article>
            ))}
          </>
        )}
        {kind === "gnd" &&
          gndCriteria.map((row) => (
            <article className="criteria-card" key={row.equipment}>
              <h3>{row.equipment}</h3>
              <p>ดี: {row.good}</p>
              <p>ปานกลาง: {row.fair}</p>
              <p>แย่: {row.poor}</p>
            </article>
          ))}
      </div>
    </section>
  );
}
