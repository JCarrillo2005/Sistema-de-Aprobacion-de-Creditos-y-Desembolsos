import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
} from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { useBureauCheck, useCreateRequest, useDocumentStatus } from "../api/hooks";
import type { RequestStatus } from "../api/types";
import { AmortizationTable } from "../components/AmortizationTable";
import { formatDateTime, formatMoney, formatPercent } from "../lib/format";
import { statusLabel } from "../lib/labels";
import {
  ALLOWED_TERMS,
  capacityUsedPercent,
  debtRatioPercent,
  maxAllowedAmount,
  parseNumber,
  validateRequestForm,
  type RequestFormField,
  type RequestFormValues,
} from "../lib/rules";

const EMPTY_FORM: RequestFormValues = {
  applicantName: "",
  documentId: "",
  monthlyIncome: "",
  amount: "",
  termMonths: "12",
};

interface FieldStatus {
  tone: "ok" | "error" | "info";
  text: string;
}

interface TextFieldProps {
  label: string;
  name: RequestFormField;
  value: string;
  error?: string;
  hint?: string;
  prefix?: string;
  status?: FieldStatus;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
  onChange: (value: string) => void;
  onBlur: () => void;
}

function TextField({
  label,
  name,
  value,
  error,
  hint,
  prefix,
  status,
  inputProps,
  onChange,
  onBlur,
}: TextFieldProps) {
  const errorId = `${name}-error`;
  const statusId = `${name}-status`;
  const describedBy = [error ? errorId : null, status ? statusId : null]
    .filter((value): value is string => value !== null)
    .join(" ");

  return (
    <div className={error ? "field field-invalid" : "field"}>
      <label htmlFor={name}>{label}</label>
      <div className={prefix ? "input-wrap input-has-prefix" : "input-wrap"}>
        {prefix && <span className="input-prefix mono">{prefix}</span>}
        <input
          id={name}
          name={name}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          {...inputProps}
        />
      </div>
      {hint && !error && !status && <small className="muted">{hint}</small>}
      {error && (
        <small id={errorId} className="field-error">
          {error}
        </small>
      )}
      {status && (
        <small
          id={statusId}
          className={`field-status field-status--${status.tone}`}
          aria-live="polite"
        >
          {`${status.tone === "ok" ? "✓" : status.tone === "error" ? "!" : "…"} ${status.text}`}
        </small>
      )}
    </div>
  );
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

interface HistoryBlockDetails {
  blockingRequestId?: number;
  blockingStatus?: RequestStatus;
  blockedUntil?: string | null;
}

// Los detalles del 409 llegan como `unknown`; se leen con guardas en vez de
// confiar en la forma del cuerpo del error.
function readHistoryBlockDetails(details: unknown): HistoryBlockDetails {
  if (typeof details !== "object" || details === null) {
    return {};
  }
  const record = details as Record<string, unknown>;
  const status = record.blockingStatus;
  const knownStatus: RequestStatus | undefined =
    status === "CREADA" ||
    status === "EN_REVISION" ||
    status === "APROBADA" ||
    status === "RECHAZADA"
      ? status
      : undefined;
  return {
    blockingRequestId:
      typeof record.blockingRequestId === "number"
        ? record.blockingRequestId
        : undefined,
    blockingStatus: knownStatus,
    blockedUntil:
      typeof record.blockedUntil === "string"
        ? record.blockedUntil
        : record.blockedUntil === null
          ? null
          : undefined,
  };
}

// Solo dígitos y separadores; recorta a 2 decimales mientras se escribe.
// Acepta coma decimal ("1,5" → "1.5") y coma de miles ("1,000" → "1000"),
// igual que el formato en-US que usa la interfaz.
function sanitizeMoneyInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.,]/g, "");
  const hasDot = cleaned.includes(".");
  const hasComma = cleaned.includes(",");
  let normalized: string;
  if (hasComma && hasDot) {
    normalized = cleaned.replace(/,/g, "");
  } else if (/^\d{1,3}(,\d{3})+$/.test(cleaned)) {
    normalized = cleaned.replace(/,/g, "");
  } else {
    normalized = cleaned.replace(/,/g, ".");
  }
  const [integerPart = "", ...decimalParts] = normalized.split(".");
  if (!normalized.includes(".")) {
    return integerPart;
  }
  const decimals = decimalParts.join("").slice(0, 2);
  return `${integerPart}.${decimals}`;
}

interface CapacityMeterProps {
  income: number | null;
  amount: number | null;
}

function CapacityMeter({ income, amount }: CapacityMeterProps) {
  const max = income !== null ? maxAllowedAmount(income) : null;
  const usage = income !== null && amount !== null ? capacityUsedPercent(amount, income) : null;
  const ratio = income !== null && amount !== null ? debtRatioPercent(amount, income) : null;
  const exceeded = usage !== null && usage > 100;
  const width = Math.max(0, Math.min(usage ?? 0, 100));

  return (
    <div className={exceeded ? "capacity capacity--over" : "capacity"}>
      <div className="capacity-head">
        <span className="eyebrow">Capacidad de endeudamiento</span>
        <strong className="mono">{usage !== null ? formatPercent(usage, 0) : "—"}</strong>
      </div>
      <div
        className="capacity-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(width)}
        aria-label="Uso del límite de endeudamiento"
      >
        <div className="capacity-fill" style={{ width: `${width}%` }} />
        <span className="capacity-threshold" aria-hidden="true" />
      </div>
      <div className="capacity-scale mono">
        <span>{formatMoney(amount ?? 0)} solicitado</span>
        <span>{max !== null ? `${formatMoney(max)} límite` : "Límite 40 %"}</span>
      </div>
      <p className="capacity-note" aria-live="polite">
        {usage === null ? (
          "Ingreso y monto para calcular tu capacidad."
        ) : exceeded ? (
          <>
            Excede por{" "}
            <span className="mono">{formatMoney((amount ?? 0) - (max ?? 0))}</span>{" "}
            el límite.
          </>
        ) : (
          <>
            <span className="mono">{formatPercent(usage, 0)}</span> del límite de{" "}
            <span className="mono">{formatMoney(max ?? 0)}</span>.
          </>
        )}
      </p>
      {ratio !== null && (
        <p className="capacity-subnote mono">
          Endeudamiento {formatPercent(ratio)} del ingreso · tope normativo 40 %
        </p>
      )}
    </div>
  );
}

export default function NewRequestPage() {
  const navigate = useNavigate();
  const createRequest = useCreateRequest();
  const bureau = useBureauCheck();

  const [values, setValues] = useState<RequestFormValues>(EMPTY_FORM);
  const [touched, setTouched] = useState<
    Partial<Record<RequestFormField, boolean>>
  >({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const { errors, valid } = useMemo(
    () => validateRequestForm(values),
    [values],
  );

  const debouncedDocument = useDebouncedValue(values.documentId.trim(), 300);

  // 1) Validación de formato (mismas reglas que el backend).
  const formatStatus = useMemo<FieldStatus | null>(() => {
    if (debouncedDocument.length === 0) {
      return null;
    }
    // Se reutiliza la misma validación del formulario: no se duplica ninguna regla.
    const debouncedErrors = validateRequestForm({
      ...values,
      documentId: debouncedDocument,
    }).errors;
    if (debouncedErrors.documentId) {
      return { tone: "error", text: debouncedErrors.documentId };
    }
    return {
      tone: "ok",
      text: "Documento válido",
    };
  }, [debouncedDocument, values]);

  // 2) Detección en el servidor: solicitud pendiente o rechazo dentro de 30 días.
  const documentFormatValid = formatStatus?.tone === "ok";
  const documentCheck = useDocumentStatus(debouncedDocument, documentFormatValid);
  const documentBlocked = documentCheck.data?.blocked === true;

  const documentDisplayStatus = useMemo<FieldStatus | null>(() => {
    if (formatStatus?.tone === "error") {
      return formatStatus;
    }
    if (documentFormatValid && documentCheck.isFetching && !documentCheck.data) {
      return { tone: "info", text: "Verificando historial…" };
    }
    // Si está bloqueado, el detalle se muestra solo en el recuadro amarillo
    // que va debajo del campo; así no se duplica el mensaje.
    if (documentCheck.data?.blocked) {
      return null;
    }
    if (documentCheck.data) {
      return {
        tone: "ok",
        text: "Sin solicitudes activas ni rechazos recientes",
      };
    }
    return formatStatus;
  }, [
    formatStatus,
    documentFormatValid,
    documentCheck.isFetching,
    documentCheck.data,
  ]);

  const incomeNumber = parseNumber(values.monthlyIncome);
  const amountNumber = parseNumber(values.amount);
  const termNumber = parseNumber(values.termMonths);

  const validIncome =
    incomeNumber !== null && incomeNumber > 0 && !errors.monthlyIncome
      ? incomeNumber
      : null;
  const positiveAmount =
    amountNumber !== null && amountNumber > 0 ? amountNumber : null;

  // El simulador sigue visible aunque el monto exceda el límite: el medidor
  // marca el umbral en rojo y el envío permanece bloqueado.
  const showSimulation =
    positiveAmount !== null && termNumber !== null && !errors.termMonths;

  function visibleError(field: RequestFormField): string | undefined {
    return touched[field] || submitAttempted ? errors[field] : undefined;
  }

  function update(field: RequestFormField, value: string) {
    // El backend ya normaliza el documento; hacerlo aquí evita sorpresas al guardar.
    let nextValue = field === "documentId" ? value.toUpperCase() : value;
    // El dinero se limita a 2 decimales directamente en la entrada.
    if (field === "monthlyIncome" || field === "amount") {
      nextValue = sanitizeMoneyInput(nextValue);
    }
    setValues((previous) => ({ ...previous, [field]: nextValue }));
    if (createRequest.isError) {
      createRequest.reset();
    }
  }

  function markTouched(field: RequestFormField) {
    setTouched((previous) => ({ ...previous, [field]: true }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitAttempted(true);
    if (!valid || createRequest.isPending || documentBlocked) {
      return;
    }
    createRequest.mutate(valid, {
      onSuccess: (created) => {
        // Consulta al buró en segundo plano: la navegación no queda bloqueada.
        bureau.mutate(created.id);
        navigate(`/requests/${created.id}`);
      },
    });
  }

  const serverError = createRequest.error;
  const isHistoryBlock =
    serverError instanceof ApiError &&
    serverError.code === "RECENT_HISTORY_BLOCK";
  const historyBlockDetails =
    serverError instanceof ApiError &&
    serverError.code === "RECENT_HISTORY_BLOCK"
      ? readHistoryBlockDetails(serverError.details)
      : {};

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">Solicitud de crédito</span>
          <h2>Nueva solicitud</h2>
        </div>
      </div>

      <div className="workbench">
        <form className="panel form-panel" onSubmit={handleSubmit} noValidate>
          <div className="panel-head">
            <h3>Datos de la solicitud</h3>
          </div>

          <fieldset className="form-section">
            <legend>01 · Identificación</legend>
            <TextField
              label="Nombre del solicitante"
              name="applicantName"
              value={values.applicantName}
              error={visibleError("applicantName")}
              onChange={(value) => update("applicantName", value)}
              onBlur={() => markTouched("applicantName")}
              inputProps={{ autoComplete: "name", maxLength: 120, placeholder: "Nombre completo" }}
            />
            <TextField
              label="Documento de identidad"
              name="documentId"
              value={values.documentId}
              error={visibleError("documentId")}
              status={
                visibleError("documentId")
                  ? undefined
                  : (documentDisplayStatus ?? undefined)
              }
              onChange={(value) => update("documentId", value)}
              onBlur={() => markTouched("documentId")}
              inputProps={{ maxLength: 20, placeholder: "Ej. DPI-1234567", spellCheck: false }}
            />
            {documentBlocked && documentCheck.data && (
              <div className="alert alert-warning alert-contained" role="alert">
                <div className="alert-title">
                  <strong>
                    {documentCheck.data.blockingStatus === "RECHAZADA"
                      ? "Documento con rechazo reciente"
                      : "Documento con solicitud activa"}
                  </strong>
                </div>
                <p>
                  {documentCheck.data.blockingStatus === "RECHAZADA"
                    ? `La solicitud #${documentCheck.data.blockingRequestId ?? "—"} fue rechazada. El documento queda bloqueado durante 30 días desde su registro.`
                    : `La solicitud #${documentCheck.data.blockingRequestId ?? "—"} sigue activa (${documentCheck.data.blockingStatus ? statusLabel(documentCheck.data.blockingStatus) : "en revisión"}). Debe resolverse antes de registrar otra.`}
                </p>
                {documentCheck.data.blockedUntil && (
                  <p className="alert-footnote">
                    Podrá volver a solicitar a partir de{" "}
                    {formatDateTime(documentCheck.data.blockedUntil)}.
                  </p>
                )}
              </div>
            )}
          </fieldset>

          <fieldset className="form-section">
            <legend>02 · Capacidad de pago</legend>
            <TextField
              label="Ingreso mensual declarado"
              name="monthlyIncome"
              value={values.monthlyIncome}
              error={visibleError("monthlyIncome")}
              prefix="USD"
              onChange={(value) => update("monthlyIncome", value)}
              onBlur={() => markTouched("monthlyIncome")}
              inputProps={{
                type: "text",
                inputMode: "decimal",
                placeholder: "0.00",
                autoComplete: "off",
                className: "money-input",
              }}
            />
            <TextField
              label="Monto solicitado"
              name="amount"
              value={values.amount}
              error={visibleError("amount")}
              prefix="USD"
              onChange={(value) => update("amount", value)}
              onBlur={() => markTouched("amount")}
              inputProps={{
                type: "text",
                inputMode: "decimal",
                placeholder: "0.00",
                autoComplete: "off",
                className: "money-input",
              }}
            />
            <CapacityMeter income={validIncome} amount={positiveAmount} />
          </fieldset>

          <fieldset className="form-section">
            <legend>03 · Condiciones del crédito</legend>
            <div className={visibleError("termMonths") ? "field field-invalid" : "field"}>
              <label htmlFor="termMonths">Plazo del crédito</label>
              <select
                id="termMonths"
                name="termMonths"
                value={values.termMonths}
                onChange={(event) => update("termMonths", event.target.value)}
                onBlur={() => markTouched("termMonths")}
              >
                {ALLOWED_TERMS.map((term) => (
                  <option key={term} value={String(term)}>
                    {String(term).padStart(2, "0")} meses
                  </option>
                ))}
              </select>
              {visibleError("termMonths") && (
                <small className="field-error">{visibleError("termMonths")}</small>
              )}
            </div>
          </fieldset>

          {serverError && (
            <div className="alert alert-error" role="alert">
              <div className="alert-title">
                <strong>
                  {isHistoryBlock
                    ? "No es posible registrar la solicitud"
                    : "No pudimos registrar la solicitud"}
                </strong>
              </div>
              {isHistoryBlock ? (
                <>
                  <p>
                    {historyBlockDetails.blockingStatus === "RECHAZADA"
                      ? `La solicitud #${historyBlockDetails.blockingRequestId ?? "—"} fue rechazada. El documento queda bloqueado durante 30 días desde su registro.`
                      : `La solicitud #${historyBlockDetails.blockingRequestId ?? "—"} sigue activa. Debe resolverse antes de registrar otra.`}
                  </p>
                  {historyBlockDetails.blockedUntil && (
                    <p className="alert-footnote">
                      Podrá volver a solicitar a partir de{" "}
                      {formatDateTime(historyBlockDetails.blockedUntil)}.
                    </p>
                  )}
                </>
              ) : (
                <p>{serverError.message}</p>
              )}
            </div>
          )}

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!valid || createRequest.isPending || documentBlocked}
              aria-busy={createRequest.isPending}
            >
              {createRequest.isPending
                ? "Registrando…"
                : "Confirmar y enviar solicitud"}
            </button>
          </div>
        </form>

        <div className="simulator-column">
          {showSimulation && positiveAmount !== null && termNumber !== null ? (
            <AmortizationTable principal={positiveAmount} termMonths={termNumber} />
          ) : (
            <section className="panel simulator simulator--idle">
              <div className="panel-head">
                <div>
                  <span className="eyebrow">Cotización estimada</span>
                  <h3>Plan de pagos</h3>
                </div>
                <span className="rate-chip mono">1.5 % / MES</span>
              </div>
              <p className="muted">
                Ingresa monto y plazo para ver la cuota estimada.
              </p>
              <div className="sim-placeholder mono" aria-hidden="true">
                <span>$ ————</span>
                <span>·</span>
                <span>00 CUOTAS</span>
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
