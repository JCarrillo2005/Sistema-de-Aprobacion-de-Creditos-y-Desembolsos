import { formatClockTime } from "../lib/format";

interface Props {
  at?: number;
  label?: string;
}

// Marca de frescura del dato: el usuario ve cuándo se actualizó por última vez
// en lugar de un intervalo técnico de polling.
export function UpdatedTag({ at, label = "Actualizado" }: Props) {
  return (
    <span className="updated-tag mono" aria-live="polite">
      {at ? `${label} ${formatClockTime(at)}` : "Actualizando…"}
    </span>
  );
}
