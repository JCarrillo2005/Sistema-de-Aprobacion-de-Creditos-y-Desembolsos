import {
  useMemo,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
} from "react";
import { useNavigate } from "react-router-dom";
import { useBureauCheck, useCreateRequest } from "../api/hooks";
import { ApiError } from "../api/client";
import { AmortizationTable } from "../components/AmortizationTable";
import { formatMoney } from "../lib/format";
import {
  ALLOWED_TERMS,
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

interface TextFieldProps {
  label: string;
  name: RequestFormField;
  value: string;
  error?: string;
  hint?: string;
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
  inputProps,
  onChange,
  onBlur,
}: TextFieldProps) {
  const errorId = `${name}-error`;
  return (
    <div className={error ? "field field-invalid" : "field"}>
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        {...inputProps}
      />
      {hint && !error && <small className="muted">{hint}</small>}
      {error && (
        <small id={errorId} className="field-error">
          {error}
        </small>
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

  const incomeNumber = parseNumber(values.monthlyIncome);
  const amountNumber = parseNumber(values.amount);
  const termNumber = parseNumber(values.termMonths);

  const showSimulation =
    amountNumber !== null &&
    termNumber !== null &&
    !errors.amount &&
    !errors.termMonths;

  const maxHint =
    incomeNumber !== null && incomeNumber > 0 && !errors.monthlyIncome
      ? `Máximo permitido (40 % del ingreso): ${formatMoney(maxAllowedAmount(incomeNumber))}`
      : undefined;

  function visibleError(field: RequestFormField): string | undefined {
    return touched[field] || submitAttempted ? errors[field] : undefined;
  }

  function update(field: RequestFormField, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
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
    if (!valid || createRequest.isPending) {
      return;
    }
    createRequest.mutate(valid, {
      onSuccess: (created) => {
        // Consulta al buró en segundo plano: el usuario no queda bloqueado esperando.
        bureau.mutate(created.id);
        navigate(`/requests/${created.id}`);
      },
    });
  }

  const serverError = createRequest.error;
  const isHistoryBlock =
    serverError instanceof ApiError &&
    serverError.code === "RECENT_HISTORY_BLOCK";

  return (
    <>
      <div className="page-header">
        <h2>Nueva solicitud de desembolso</h2>
      </div>

      <div className="grid-2">
        <form className="card" onSubmit={handleSubmit} noValidate>
          <TextField
            label="Nombre del solicitante"
            name="applicantName"
            value={values.applicantName}
            error={visibleError("applicantName")}
            onChange={(value) => update("applicantName", value)}
            onBlur={() => markTouched("applicantName")}
            inputProps={{ autoComplete: "name", maxLength: 120 }}
          />
          <TextField
            label="Documento de identidad"
            name="documentId"
            value={values.documentId}
            error={visibleError("documentId")}
            hint="Letras, números y guiones (5 a 20 caracteres)"
            onChange={(value) => update("documentId", value)}
            onBlur={() => markTouched("documentId")}
            inputProps={{ maxLength: 20 }}
          />
          <TextField
            label="Ingreso mensual declarado (USD)"
            name="monthlyIncome"
            value={values.monthlyIncome}
            error={visibleError("monthlyIncome")}
            onChange={(value) => update("monthlyIncome", value)}
            onBlur={() => markTouched("monthlyIncome")}
            inputProps={{
              type: "number",
              min: 0,
              step: "0.01",
              inputMode: "decimal",
            }}
          />
          <TextField
            label="Monto solicitado (USD)"
            name="amount"
            value={values.amount}
            error={visibleError("amount")}
            hint={maxHint}
            onChange={(value) => update("amount", value)}
            onBlur={() => markTouched("amount")}
            inputProps={{
              type: "number",
              min: 0,
              step: "0.01",
              inputMode: "decimal",
            }}
          />

          <div
            className={
              visibleError("termMonths") ? "field field-invalid" : "field"
            }
          >
            <label htmlFor="termMonths">Plazo</label>
            <select
              id="termMonths"
              name="termMonths"
              value={values.termMonths}
              onChange={(event) => update("termMonths", event.target.value)}
              onBlur={() => markTouched("termMonths")}
            >
              {ALLOWED_TERMS.map((term) => (
                <option key={term} value={String(term)}>
                  {term} meses
                </option>
              ))}
            </select>
            {visibleError("termMonths") && (
              <small className="field-error">
                {visibleError("termMonths")}
              </small>
            )}
          </div>

          {serverError && (
            <div className="alert alert-error" role="alert">
              {isHistoryBlock && <strong>Solicitud bloqueada. </strong>}
              {serverError.message}
            </div>
          )}

          <div className="actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!valid || createRequest.isPending}
            >
              {createRequest.isPending
                ? "Enviando…"
                : "Confirmar y enviar solicitud"}
            </button>
          </div>
          <p className="muted">
            Revisa la simulación antes de confirmar. Las reglas se validan
            nuevamente en el servidor.
          </p>
        </form>

        <div>
          {showSimulation && amountNumber !== null && termNumber !== null ? (
            <AmortizationTable
              principal={amountNumber}
              termMonths={termNumber}
            />
          ) : (
            <div className="card">
              <h3>Simulación financiera</h3>
              <p className="muted">
                Ingresa un monto válido y un plazo para ver la tabla de
                amortización estimada.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
