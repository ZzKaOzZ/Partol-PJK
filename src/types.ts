export type TabId = "patrol" | "thermal" | "pd";
export type Voltage = "HV" | "MV" | "LV";
export type Condition = "ดี" | "ปานกลาง" | "แย่" | "แย่มาก";
export type ThermalCategory = "insulator" | "conductor" | "joint";

export type Screen =
  | { name: "list" }
  | { name: "form"; tab: TabId; id?: string }
  | { name: "detail"; tab: TabId; id: string }
  | { name: "criteria"; kind: "patrol" | "thermal" | "pd" | "gnd" };

export interface PatrolItem {
  voltage: Voltage;
  mainEquipment: string;
  equipment: string;
  code: string;
  defect: string;
  good: string;
  fair: string;
  poor: string;
}

export interface ThermalItem extends PatrolItem {
  veryPoor: string;
  category: ThermalCategory;
}

export interface PatrolRecord {
  id: string;
  pole: string;
  jobType: string;
  voltage: Voltage | "";
  mainEquipment: string;
  equipment: string;
  code: string;
  defect: string;
  condition: Condition | "";
  action: string;
  resistanceOhm: string;
  gps: string;
  photoName: string;
  photoData: string;
  createdAt: string;
}

export interface ThermalRecord {
  id: string;
  pole: string;
  jobType: string;
  voltage: Voltage | "";
  mainEquipment: string;
  equipment: string;
  code: string;
  defect: string;
  fairDesc: string;
  poorDesc: string;
  veryPoorDesc: string;
  deltaT: number | "";
  condition: Condition | "";
  action: string;
  gps: string;
  photoName: string;
  photoData: string;
  createdAt: string;
}

export interface PdRecord {
  id: string;
  pole: string;
  voltage: Voltage | "";
  equipment: string;
  condition: string;
  action: string;
  pdType: string;
  gps: string;
  photoName: string;
  photoData: string;
  createdAt: string;
}

export interface AppStore {
  patrol: PatrolRecord[];
  thermal: ThermalRecord[];
  pd: PdRecord[];
}
