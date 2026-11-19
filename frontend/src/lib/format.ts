const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const dateTimeFormatter = new Intl.DateTimeFormat("es-GT", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatMoney(value: number): string {
  return moneyFormatter.format(value);
}

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

// Antigüedad compacta para bandejas operativas. Se calcula en el cliente a partir
// del timestamp del servidor; no es estado de servidor duplicado.
export function formatRelativeAge(iso: string, now: number = Date.now()): string {
  const elapsedMs = Math.max(0, now - new Date(iso).getTime());
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) {
    return "ahora";
  }
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} h`;
  }
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days} d`;
  }
  const months = Math.floor(days / 30);
  return `${months} mes${months === 1 ? "" : "es"}`;
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)} %`;
}

export function formatClockTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("es-GT", { hour12: false });
}
