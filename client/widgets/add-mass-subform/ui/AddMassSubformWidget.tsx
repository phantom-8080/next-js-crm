"use client";

import {
  useEffect,
  useId,
  useState,
  type FormEvent,
} from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ADD_MASS_SUBFORM_WIDGET_NAME } from "@/widgets/add-mass-subform";
import {
  ADD_MASS_SUBFORM_SEARCH_MIN_CHARS,
  getSubformFieldForModule,
  type AddMassSubformLookupOption,
  type AddMassSubformResult,
  type AddMassSubformRow,
} from "@/widgets/add-mass-subform/types";
import type { WidgetOpenContext } from "@/widgets/types";

type AddMassSubformWidgetProps = WidgetOpenContext & {
  open: boolean;
  onClose: () => void;
  className?: string;
};

type SubformDraft = {
  serviceId: string;
  serviceName: string;
  startDate: string;
  endDate: string;
  clientPrice: string;
  vendorPrice: string;
};

const EMPTY_DRAFT: SubformDraft = {
  serviceId: "",
  serviceName: "",
  startDate: "",
  endDate: "",
  clientPrice: "",
  vendorPrice: "",
};

async function requestServiceSuggestions(params: {
  module: string;
  field: string;
  query: string;
}) {
  const search = new URLSearchParams({
    module: params.module,
    field: params.field,
    dataType: "lookup",
    lookupModule: "Products",
    q: params.query,
  });
  const response = await fetch(`/api/field-suggestions?${search.toString()}`);
  const data = (await response.json().catch(() => ({}))) as {
    suggestions?: AddMassSubformLookupOption[];
    error?: string;
  };
  if (!response.ok) throw new Error(data.error || "Failed to load products.");
  return Array.isArray(data.suggestions) ? data.suggestions : [];
}

/**
 * Mass Add SubForm widget — UI + behavior aligned with
 * widget_logic/widget.html + widget_logic/index.js.
 */
export function AddMassSubformWidget({
  open,
  onClose,
  selectedRecordIds,
  module = "Contracts",
  className,
}: AddMassSubformWidgetProps) {
  const titleId = useId();
  const sowId = useId();
  const startDateId = useId();
  const endDateId = useId();
  const clientPriceId = useId();
  const vendorPriceId = useId();

  const [draft, setDraft] = useState<SubformDraft>(EMPTY_DRAFT);
  const [rows, setRows] = useState<AddMassSubformRow[]>([]);
  const [serviceQuery, setServiceQuery] = useState("");
  const [serviceOptions, setServiceOptions] = useState<
    AddMassSubformLookupOption[]
  >([]);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [sowHint, setSowHint] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AddMassSubformResult | null>(null);

  const subFormField =
    getSubformFieldForModule(module) ?? "Our_Services_SubForm";
  const canFetchService =
    serviceQuery.trim().length >= ADD_MASS_SUBFORM_SEARCH_MIN_CHARS;
  const visibleServiceOptions = canFetchService ? serviceOptions : [];

  const [openSnapshot, setOpenSnapshot] = useState(false);
  if (open !== openSnapshot) {
    setOpenSnapshot(open);
    if (open) {
      setDraft(EMPTY_DRAFT);
      setRows([]);
      setServiceQuery("");
      setServiceOptions([]);
      setServiceLoading(false);
      setSowHint("");
      setSubmitting(false);
      setError(null);
      setResult(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, submitting]);

  useEffect(() => {
    if (!canFetchService) return;

    const timer = window.setTimeout(() => {
      setServiceLoading(true);
      requestServiceSuggestions({
        module,
        field: subFormField,
        query: serviceQuery.trim(),
      })
        .then((suggestions) => {
          setServiceOptions(suggestions);
          if (suggestions.length === 0) {
            setSowHint("No Products found");
          } else {
            setSowHint("");
          }
        })
        .catch((lookupError: unknown) =>
          setError(
            lookupError instanceof Error
              ? lookupError.message
              : "Zoho API Error",
          ),
        )
        .finally(() => setServiceLoading(false));
    }, 300);

    return () => window.clearTimeout(timer);
  }, [canFetchService, module, serviceQuery, subFormField]);

  if (!open) return null;

  const controlClassName = cn(
    "mt-1 block h-11 w-full rounded-md border border-crm-border bg-crm-panel px-2.5 text-sm text-crm-text shadow-sm",
    "placeholder:text-crm-text-muted",
    "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
    "disabled:cursor-not-allowed disabled:opacity-60",
  );
  const labelClassName = "block text-sm font-medium text-crm-text";

  function addRow() {
    const productName = serviceQuery.trim();
    if (!productName) {
      setError("SOW Item is required!");
      return;
    }
    if (!draft.serviceId) {
      setError("SOW Item is required!");
      setSowHint("Please select a product from the suggestions");
      return;
    }
    if (
      rows.some(
        (row) =>
          String(row.OurServices) === draft.serviceId ||
          String(row.serviceName ?? "").trim() === productName,
      )
    ) {
      setError("Product already added!");
      return;
    }

    setRows((current) => [
      ...current,
      {
        OurServices: draft.serviceId,
        serviceName: draft.serviceName || productName,
        ...(draft.startDate ? { Start_Date: draft.startDate } : {}),
        ...(draft.endDate ? { End_Date: draft.endDate } : {}),
        ...(draft.clientPrice.trim()
          ? { Invoice_Price: draft.clientPrice.trim() }
          : {}),
        ...(draft.vendorPrice.trim()
          ? { Vendor_Price: draft.vendorPrice.trim() }
          : {}),
      },
    ]);
    setDraft(EMPTY_DRAFT);
    setServiceQuery("");
    setServiceOptions([]);
    setSowHint("");
    setError(null);
  }

  function removeRow(serviceId: string) {
    setRows((current) =>
      current.filter((row) => String(row.OurServices) !== serviceId),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (selectedRecordIds.length === 0) {
      setError("Select at least one record.");
      return;
    }
    if (rows.length === 0) {
      setError("No products to update!");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/widgets/add-mass-subform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedRecordIds,
          module,
          rows,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as AddMassSubformResult;
      if (!response.ok && !data.message) {
        throw new Error("Failed to add subform rows.");
      }
      setResult(data);
      if (!data.ok) {
        setError(data.message || "Failed to add subform rows.");
      }
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to add subform rows.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const showResults = Boolean(result?.ok);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-[2px] dark:bg-black/60"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={submitting}
        className={cn(
          "relative flex max-h-[min(92vh,48rem)] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-crm-border bg-crm-panel shadow-xl",
          className,
        )}
      >
        {submitting ? (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-crm-panel/85 backdrop-blur-[1px]"
            role="status"
            aria-live="polite"
          >
            <Loader2
              className="size-10 animate-spin text-blue-600"
              aria-hidden
            />
            <p className="text-sm font-medium text-crm-text">Adding...</p>
          </div>
        ) : null}

        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-crm-border px-6 py-4">
          <h2 id={titleId} className="truncate text-base text-crm-text sm:text-lg">
            {ADD_MASS_SUBFORM_WIDGET_NAME}
          </h2>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="crm-toolbar-btn shrink-0"
            aria-label="Close"
            onClick={onClose}
            disabled={submitting}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8">
          {showResults && result ? (
            <div>
              <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
                {result.message || "Updated record(s) successfully."}
              </p>
              {result.errors && result.errors.length > 0 ? (
                <ul className="mt-3 max-h-40 list-disc space-y-1 overflow-auto rounded-xl border border-crm-border bg-crm-panel-muted/60 px-5 py-2 text-sm text-crm-text-muted">
                  {result.errors.map((item) => (
                    <li key={`${item.id}-${item.message}`}>
                      {item.id}: {item.message}
                    </li>
                  ))}
                </ul>
              ) : null}
              <Button
                type="button"
                className="mt-5 h-10 w-full bg-blue-500 text-white hover:bg-blue-600"
                onClick={onClose}
              >
                OK
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex h-full flex-col justify-around gap-6">
              <h3 className="text-center text-2xl font-bold text-crm-text">
                Mass Add SubForm
              </h3>

              <p className="text-center text-xs text-crm-text-muted">
                {selectedRecordIds.length.toLocaleString("en-US")} record
                {selectedRecordIds.length === 1 ? "" : "s"} selected
              </p>

              <div className="flex flex-col gap-6">
                <div className="relative w-full">
                  <label htmlFor={sowId} className={labelClassName}>
                    SOW Item
                  </label>
                  <input
                    id={sowId}
                    value={serviceQuery}
                    onChange={(event) => {
                      const value = event.target.value;
                      setServiceQuery(value);
                      setDraft((current) => ({
                        ...current,
                        serviceId: "",
                        serviceName: "",
                      }));
                      if (value.trim().length <= 2) {
                        setServiceOptions([]);
                        setSowHint(
                          value.trim().length > 0
                            ? "Please enter at least 3 characters"
                            : "",
                        );
                      } else {
                        setSowHint("");
                      }
                    }}
                    className={controlClassName}
                    autoComplete="off"
                    disabled={submitting}
                  />
                  {sowHint ? (
                    <span className="text-sm text-red-500">{sowHint}</span>
                  ) : null}
                  {serviceLoading ? (
                    <Loader2 className="absolute right-3 top-10 size-4 animate-spin text-blue-500" />
                  ) : null}
                  {visibleServiceOptions.length > 0 ? (
                    <ul className="absolute z-30 mt-1 max-h-40 w-full overflow-y-auto rounded-md border border-crm-border bg-crm-panel shadow-lg">
                      {visibleServiceOptions.map((option) => (
                        <li key={option.value}>
                          <button
                            type="button"
                            className="block w-full cursor-pointer px-2 py-2 text-left text-sm text-crm-text hover:bg-crm-panel-muted"
                            onClick={() => {
                              setDraft((current) => ({
                                ...current,
                                serviceId: option.value,
                                serviceName: option.label,
                              }));
                              setServiceQuery(option.label);
                              setServiceOptions([]);
                              setSowHint("");
                              setError(null);
                            }}
                          >
                            {option.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <div className="flex w-full items-baseline gap-4">
                  <div className="w-full">
                    <label htmlFor={startDateId} className={labelClassName}>
                      Start Date
                    </label>
                    <input
                      id={startDateId}
                      type="date"
                      value={draft.startDate}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          startDate: event.target.value,
                        }))
                      }
                      className={controlClassName}
                      disabled={submitting}
                    />
                  </div>
                  <div className="w-full">
                    <label htmlFor={endDateId} className={labelClassName}>
                      End Date
                    </label>
                    <input
                      id={endDateId}
                      type="date"
                      value={draft.endDate}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          endDate: event.target.value,
                        }))
                      }
                      className={controlClassName}
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div className="flex w-full items-center gap-2">
                  <div className="w-full">
                    <label htmlFor={clientPriceId} className={labelClassName}>
                      Client Price
                    </label>
                    <input
                      id={clientPriceId}
                      value={draft.clientPrice}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          clientPrice: event.target.value,
                        }))
                      }
                      className={controlClassName}
                      disabled={submitting}
                    />
                  </div>
                  <div className="w-full">
                    <label htmlFor={vendorPriceId} className={labelClassName}>
                      Vendor Price
                    </label>
                    <input
                      id={vendorPriceId}
                      value={draft.vendorPrice}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          vendorPrice: event.target.value,
                        }))
                      }
                      className={controlClassName}
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div className="text-right">
                  <button
                    type="button"
                    className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 disabled:opacity-60"
                    onClick={addRow}
                    disabled={submitting}
                  >
                    Add Row
                  </button>
                </div>
              </div>

              <div>
                {rows.length > 0 ? (
                  <div className="flex max-h-80 flex-col-reverse gap-3 overflow-y-auto">
                    <table className="mt-4 w-full border-collapse text-sm">
                      <thead className="sticky top-0 z-10 bg-crm-panel-muted text-left">
                        <tr>
                          <th className="border border-crm-border p-2 font-semibold text-crm-text">
                            Product Name
                          </th>
                          <th className="border border-crm-border p-2 font-semibold text-crm-text">
                            Start Date
                          </th>
                          <th className="border border-crm-border p-2 font-semibold text-crm-text">
                            End Date
                          </th>
                          <th className="border border-crm-border p-2 font-semibold text-crm-text">
                            Client Price
                          </th>
                          <th className="border border-crm-border p-2 font-semibold text-crm-text">
                            Vendor Price
                          </th>
                          <th className="border border-crm-border p-2 font-semibold text-crm-text">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr
                            key={String(row.OurServices)}
                            className="border bg-crm-panel"
                          >
                            <td className="border border-crm-border p-2 text-crm-text">
                              {row.serviceName || row.OurServices}
                            </td>
                            <td className="border border-crm-border p-2 text-crm-text">
                              {row.Start_Date || ""}
                            </td>
                            <td className="border border-crm-border p-2 text-crm-text">
                              {row.End_Date || ""}
                            </td>
                            <td className="border border-crm-border p-2 text-crm-text">
                              {row.Invoice_Price || ""}
                            </td>
                            <td className="border border-crm-border p-2 text-crm-text">
                              {row.Vendor_Price || ""}
                            </td>
                            <td className="border border-crm-border p-2 text-center">
                              <button
                                type="button"
                                className="font-bold text-red-500 hover:text-red-600"
                                aria-label={`Remove ${row.serviceName || row.OurServices}`}
                                onClick={() =>
                                  removeRow(String(row.OurServices))
                                }
                                disabled={submitting}
                              >
                                -
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {error ? (
                  <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                    {error}
                  </p>
                ) : null}

                {rows.length > 0 ? (
                  <div className="mb-4 mt-4 w-full">
                    <button
                      type="submit"
                      className="w-full rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:opacity-60"
                      disabled={submitting}
                    >
                      Add SubForm
                    </button>
                  </div>
                ) : null}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
