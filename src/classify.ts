import type { Condition, ThermalCategory } from "./types";

export function classifyThermal(category: ThermalCategory, deltaT: number): {
  condition: Condition;
  action: string;
} {
  if (category === "insulator") {
    if (deltaT >= 5) return { condition: "แย่มาก", action: "แก้ไขทันที" };
    return { condition: "ดี", action: "ปกติ" };
  }
  if (category === "conductor") {
    if (deltaT < 10) return { condition: "ดี", action: "ปกติ" };
    if (deltaT < 30) return { condition: "ปานกลาง", action: "แก้ไข ภายใน 3 เดือน" };
    if (deltaT < 50) return { condition: "แย่", action: "แก้ไข ภายใน 1 เดือน" };
    return { condition: "แย่มาก", action: "แก้ไขทันที" };
  }
  if (deltaT < 5) return { condition: "ดี", action: "ปกติ" };
  if (deltaT < 20) return { condition: "ปานกลาง", action: "แก้ไข ภายใน 3 เดือน" };
  if (deltaT < 40) return { condition: "แย่", action: "แก้ไข ภายใน 1 เดือน" };
  return { condition: "แย่มาก", action: "แก้ไขทันที" };
}

export function classifyGround(voltage: string, ohms: number): {
  condition: Condition;
  action: string;
} {
  const transmission = voltage === "HV";
  if (transmission) {
    if (ohms <= 10) return { condition: "ดี", action: "≤ 10 Ω" };
    return { condition: "แย่", action: ">10 Ω (แก้ไขโดยเร่งด่วน)" };
  }
  if (ohms <= 5) return { condition: "ดี", action: "≤ 5 Ω" };
  if (ohms <= 25) return { condition: "ปานกลาง", action: "5-25 Ω (แก้ไขภายใน 1 ปี)" };
  return { condition: "แย่", action: ">25 Ω (แก้ไขโดยเร่งด่วน)" };
}

export function conditionClass(value: string) {
  if (value.includes("แย่มาก")) return "badge-critical";
  if (value.includes("แย่") || value.includes("Poor")) return "badge-poor";
  if (value.includes("ปานกลาง") || value.includes("Fair")) return "badge-fair";
  if (value.includes("ดี") || value.includes("Good")) return "badge-good";
  return "badge-muted";
}
