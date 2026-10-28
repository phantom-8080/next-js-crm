"use client";

import {
  useEffect,
  useId,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  isMappedFileField,
  moduleUpdateHeading,
  supportsSubformEditor,
} from "@/widgets/olio-mass-update/constants";
import { OLIO_MASS_UPDATE_WIDGET_NAME } from "@/widgets/olio-mass-update";
import type {
  MassUpdateFieldOption,
  MassUpdateLookupOption,
  MassUpdateSubformRow,
  OlioMassUpdateResult,
  OlioMassUpdateValue,
} from "@/widgets/olio-mass-update/types";
import type { WidgetOpenContext } from "@/widgets/types";

type OlioMassUpdateWidgetProps = WidgetOpenContext & {
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

const EMPTY_SUBFORM_DRAFT: SubformDraft = {
  serviceId: "",
  serviceName: "",
  startDate: "",
  endDate: "",
  clientPrice: "",
  vendorPrice: "",
};

function normalizeType(type: string) {
  const normalized = type.toLowerCase();
  return normalized === "ownerlookup" ? "userlookup" : normalized;
}

function formatLocalDateTime() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  );
}

async function requestSuggestions(params: {
  module: string;
  field: string;
  dataType: string;
  lookupModule?: string;
  query?: string;
}) {
  const search = new URLSearchParams({
    module: params.module,
    field: params.field,
    dataType: params.dataType,
    q: params.query ?? "",
  });
  if (params.lookupModule) search.set("lookupModule", params.lookupModule);
  const response = await fetch(`/api/field-suggestions?${search.toString()}`);
  const data = (await response.json().catch(() => ({}))) as {
    suggestions?: MassUpdateLookupOption[];
    error?: string;
  };
  if (!response.ok) throw new Error(data.error || "Failed to load options.");
  return Array.isArray(data.suggestions) ? data.suggestions : [];
}

export function OlioMassUpdateWidget({
  open,
  onClose,
  selectedRecordIds,
  module = "Contracts",
  className,
}: OlioMassUpdateWidgetProps) {
  const titleId = useId();
  const fieldId = useId();
  const valueId = useId();
  const notifyId = useId();

  const [fields, setFields] = useState<MassUpdateFieldOption[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [fieldApiName, setFieldApiName] = useState("");
  const [newValue, setNewValue] = useState<OlioMassUpdateValue>("");
  const [notifyTeam, setNotifyTeam] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OlioMassUpdateResult | null>(null);

  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupOptions, setLookupOptions] = useState<MassUpdateLookupOption[]>(
    [],
  );
  const [selectedLookups, setSelectedLookups] = useState<
    MassUpdateLookupOption[]
  >([]);
  const [lookupLoading, setLookupLoading] = useState(false);

  const [subformDraft, setSubformDraft] =
    useState<SubformDraft>(EMPTY_SUBFORM_DRAFT);
  const [subformRows, setSubformRows] = useState<MassUpdateSubformRow[]>([]);
  const [serviceQuery, setServiceQuery] = useState("");
  const [serviceOptions, setServiceOptions] = useState<
    MassUpdateLookupOption[]
  >([]);
  const [serviceLoading, setServiceLoading] = useState(false);

  const selectedField = useMemo(
    () => fields.find((field) => field.apiName === fieldApiName) ?? null,
    [fieldApiName, fields],
  );
  const fieldType = normalizeType(selectedField?.dataType ?? "text");
  const isFileField =
    fieldType === "fileupload" || isMappedFileField(module, fieldApiName);
  const isSubformField =
    fieldType === "subform" && supportsSubformEditor(module);
  const isMultiLookup =
    fieldType === "multiselectlookup" || fieldType === "multiuserlookup";
  const isLookup =
    fieldType === "lookup" ||
    fieldType === "userlookup" ||
    isMultiLookup;
  const canFetchLookup =
    Boolean(selectedField) &&
    isLookup &&
    (fieldType === "userlookup" || lookupQuery.trim().length >= 5);
  const canFetchService =
    isSubformField && serviceQuery.trim().length >= 5;
  const visibleLookupOptions = canFetchLookup ? lookupOptions : [];
  const visibleServiceOptions = canFetchService ? serviceOptions : [];

  // Reset form when the dialog opens (or module changes while open).
  // Adjusting state during render avoids setState-in-effect cascading renders.
  const [openSnapshot, setOpenSnapshot] = useState({ open: false, module });
  if (open !== openSnapshot.open || module !== openSnapshot.module) {
    setOpenSnapshot({ open, module });
    if (open) {
      setFieldApiName("");
      setNewValue("");
      setNotifyTeam(false);
      setSelectedFile(null);
      setError(null);
      setResult(null);
      setLookupQuery("");
      setLookupOptions([]);
      setSelectedLookups([]);
      setSubformDraft(EMPTY_SUBFORM_DRAFT);
      setSubformRows([]);
      setServiceQuery("");
      setServiceOptions([]);
      setFieldsLoading(true);
    }
  }

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    fetch(
      `/api/widgets/olio-mass-update/fields?module=${encodeURIComponent(module)}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as {
          fields?: MassUpdateFieldOption[];
          message?: string;
        };
        if (!response.ok) {
          throw new Error(data.message || "Failed to load CRM fields.");
        }
        setFields(Array.isArray(data.fields) ? data.fields : []);
      })
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string }).name !== "AbortError") {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Failed to load CRM fields.",
          );
        }
      })
      .finally(() => setFieldsLoading(false));

    return () => controller.abort();
  }, [open, module]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, submitting]);

  useEffect(() => {
    if (!canFetchLookup || !selectedField) return;

    const isUser = fieldType === "userlookup";
    const timer = window.setTimeout(() => {
      setLookupLoading(true);
      requestSuggestions({
        module,
        field: selectedField.apiName,
        dataType: fieldType,
        lookupModule: selectedField.lookupModule,
        query: lookupQuery.trim(),
      })
        .then(setLookupOptions)
        .catch((lookupError: unknown) =>
          setError(
            lookupError instanceof Error
              ? lookupError.message
              : "Failed to load lookup values.",
          ),
        )
        .finally(() => setLookupLoading(false));
    }, isUser ? 0 : 300);
    return () => window.clearTimeout(timer);
  }, [
    canFetchLookup,
    fieldType,
    lookupQuery,
    module,
    selectedField,
  ]);

  useEffect(() => {
    if (!canFetchService) return;

    const timer = window.setTimeout(() => {
      setServiceLoading(true);
      requestSuggestions({
        module,
        field: fieldApiName,
        dataType: "lookup",
        lookupModule: "Products",
        query: serviceQuery.trim(),
      })
        .then(setServiceOptions)
        .catch((lookupError: unknown) =>
          setError(
            lookupError instanceof Error
              ? lookupError.message
              : "Failed to load services.",
          ),
        )
        .finally(() => setServiceLoading(false));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [canFetchService, fieldApiName, module, serviceQuery]);

  if (!open) return null;

  function resetFieldValue(apiName: string) {
    setFieldApiName(apiName);
    setNewValue("");
    setSelectedFile(null);
    setLookupQuery("");
    setLookupOptions([]);
    setSelectedLookups([]);
    setSubformDraft(EMPTY_SUBFORM_DRAFT);
    setSubformRows([]);
    setServiceQuery("");
    setServiceOptions([]);
    setError(null);
  }

  function selectLookup(option: MassUpdateLookupOption) {
    if (isMultiLookup) {
      const next =
        selectedLookups.some((item) => item.value === option.value)
          ? selectedLookups
          : [...selectedLookups, option];
      setSelectedLookups(next);
      setNewValue(next.map((item) => item.value));
      setLookupQuery("");
    } else {
      setSelectedLookups([option]);
      setNewValue(option.value);
      setLookupQuery(option.label);
    }
    setLookupOptions([]);
  }

  function removeLookup(value: string) {
    const next = selectedLookups.filter((item) => item.value !== value);
    setSelectedLookups(next);
    setNewValue(next.map((item) => item.value));
  }

  function addSubformRow() {
    if (!subformDraft.serviceId) {
      setError("Service Name is required.");
      return;
    }
    if (
      subformRows.some(
        (row) => String(row.OurServices) === subformDraft.serviceId,
      )
    ) {
      setError("Product already added.");
      return;
    }
    const next = [
      ...subformRows,
      {
        OurServices: subformDraft.serviceId,
        serviceName: subformDraft.serviceName,
        Start_Date: subformDraft.startDate,
        End_Date: subformDraft.endDate,
        Invoice_Price: subformDraft.clientPrice,
        Vendor_Price: subformDraft.vendorPrice,
      },
    ];
    setSubformRows(next);
    setNewValue(next);
    setSubformDraft(EMPTY_SUBFORM_DRAFT);
    setServiceQuery("");
    setServiceOptions([]);
    setError(null);
  }

  function removeSubformRow(serviceId: string) {
    const next = subformRows.filter(
      (row) => String(row.OurServices) !== serviceId,
    );
    setSubformRows(next);
    setNewValue(next);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (!selectedField) {
      setError("Please select a field.");
      return;
    }
    if (selectedRecordIds.length === 0) {
      setError("Select at least one record to update.");
      return;
    }
    if (fieldType === "subform" && !supportsSubformEditor(module)) {
      setError("Subform mass update is only supported for Contracts and Deals.");
      return;
    }
    if (isFileField && !selectedFile) {
      setError("Please select a file to upload.");
      return;
    }
    if (
      !isFileField &&
      fieldType !== "boolean" &&
      ((Array.isArray(newValue) && newValue.length === 0) ||
        (!Array.isArray(newValue) && !String(newValue).trim()))
    ) {
      setError(
        isSubformField
          ? "Add at least one subform row."
          : "Please enter a new value.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const basePayload = {
        selectedRecordIds,
        module,
        fieldApiName: selectedField.apiName,
        fieldType,
        newValue,
        notifyTeam,
        currentDate: formatLocalDateTime(),
      };
      let response: Response;
      if (isFileField && selectedFile) {
        const formData = new FormData();
        formData.set(
          "selectedRecordIds",
          JSON.stringify(basePayload.selectedRecordIds),
        );
        formData.set("module", basePayload.module);
        formData.set("fieldApiName", basePayload.fieldApiName);
        formData.set("fieldType", basePayload.fieldType);
        formData.set("newValue", JSON.stringify(basePayload.newValue));
        formData.set("notifyTeam", String(basePayload.notifyTeam));
        formData.set("currentDate", basePayload.currentDate);
        formData.set("file", selectedFile);
        response = await fetch("/api/widgets/olio-mass-update", {
          method: "POST",
          body: formData,
        });
      } else {
        response = await fetch("/api/widgets/olio-mass-update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(basePayload),
        });
      }

      const data = (await response.json().catch(() => ({}))) as OlioMassUpdateResult;
      if (!response.ok && !data.successCount) {
        throw new Error(data.message || "Failed to update records.");
      }
      setResult(data);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to update records.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const controlClassName = cn(
    "h-10 w-full rounded-lg border border-crm-border bg-crm-panel px-3 text-sm text-crm-text",
    "outline-none transition placeholder:text-crm-text-muted",
    "hover:border-blue-400/70 hover:bg-crm-panel-muted",
    "focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25",
    "disabled:cursor-not-allowed disabled:opacity-60",
  );
  const selectClassName = cn(
    controlClassName,
    "appearance-none pr-9",
    "bg-[length:0.7rem] bg-[right_0.75rem_center] bg-no-repeat",
    "bg-[url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 16 16%27 fill=%27%2371717a%27%3E%3Cpath d=%27M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06z%27/%3E%3C/svg%3E')]",
  );

  function renderLookupInput() {
    if (fieldType === "userlookup") {
      return (
        <select
          id={valueId}
          className={selectClassName}
          value={typeof newValue === "string" ? newValue : ""}
          onChange={(event) => {
            const option = visibleLookupOptions.find(
              (item) => item.value === event.target.value,
            );
            setNewValue(event.target.value);
            setSelectedLookups(option ? [option] : []);
          }}
          disabled={lookupLoading}
        >
          <option value="">
            {lookupLoading ? "Loading active users..." : "Select a user..."}
          </option>
          {visibleLookupOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    return (
      <div className="relative">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-crm-text-muted"
            aria-hidden
          />
          <input
            id={valueId}
            value={lookupQuery}
            onChange={(event) => {
              setLookupQuery(event.target.value);
              if (!isMultiLookup) {
                setNewValue("");
                setSelectedLookups([]);
              }
            }}
            className={cn(controlClassName, "pl-9 pr-9")}
            placeholder="Type at least 5 characters to search..."
            autoComplete="off"
          />
          {lookupLoading ? (
            <Loader2
              className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-blue-500"
              aria-hidden
            />
          ) : null}
        </div>
        {visibleLookupOptions.length > 0 ? (
          <div className="absolute z-30 mt-1 max-h-44 w-full overflow-auto rounded-lg border border-crm-border bg-crm-panel py-1 shadow-xl">
            {visibleLookupOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-crm-text hover:bg-crm-panel-muted"
                onClick={() => selectLookup(option)}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
        {isMultiLookup && selectedLookups.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedLookups.map((option) => (
              <span
                key={option.value}
                className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-xs text-white"
              >
                {option.label}
                <button
                  type="button"
                  aria-label={`Remove ${option.label}`}
                  onClick={() => removeLookup(option.value)}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  function renderSubformInput() {
    return (
      <div className="space-y-3 rounded-xl border border-crm-border bg-crm-panel-muted/50 p-3">
        <div className="relative">
          <input
            value={serviceQuery}
            onChange={(event) => {
              setServiceQuery(event.target.value);
              setSubformDraft((draft) => ({
                ...draft,
                serviceId: "",
                serviceName: "",
              }));
            }}
            className={controlClassName}
            placeholder="Service name (type at least 5 characters)"
          />
          {serviceLoading ? (
            <Loader2 className="absolute right-3 top-3 size-4 animate-spin text-blue-500" />
          ) : null}
          {visibleServiceOptions.length > 0 ? (
            <div className="absolute z-30 mt-1 max-h-36 w-full overflow-auto rounded-lg border border-crm-border bg-crm-panel py-1 shadow-xl">
              {visibleServiceOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-crm-text hover:bg-crm-panel-muted"
                  onClick={() => {
                    setSubformDraft((draft) => ({
                      ...draft,
                      serviceId: option.value,
                      serviceName: option.label,
                    }));
                    setServiceQuery(option.label);
                    setServiceOptions([]);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            aria-label="Start Date"
            value={subformDraft.startDate}
            onChange={(event) =>
              setSubformDraft((draft) => ({
                ...draft,
                startDate: event.target.value,
              }))
            }
            className={controlClassName}
          />
          <input
            type="date"
            aria-label="End Date"
            value={subformDraft.endDate}
            onChange={(event) =>
              setSubformDraft((draft) => ({
                ...draft,
                endDate: event.target.value,
              }))
            }
            className={controlClassName}
          />
          <input
            aria-label="Client Price"
            placeholder="Client Price"
            value={subformDraft.clientPrice}
            onChange={(event) =>
              setSubformDraft((draft) => ({
                ...draft,
                clientPrice: event.target.value,
              }))
            }
            className={controlClassName}
          />
          <input
            aria-label="Vendor Price"
            placeholder="Vendor Price"
            value={subformDraft.vendorPrice}
            onChange={(event) =>
              setSubformDraft((draft) => ({
                ...draft,
                vendorPrice: event.target.value,
              }))
            }
            className={controlClassName}
          />
        </div>
        <Button
          type="button"
          size="sm"
          className="w-full bg-blue-600 text-white hover:bg-blue-500"
          onClick={addSubformRow}
        >
          <Plus className="size-4" aria-hidden />
          Add Row
        </Button>
        {subformRows.length > 0 ? (
          <div className="max-h-36 space-y-2 overflow-auto">
            {subformRows.map((row) => (
              <div
                key={String(row.OurServices)}
                className="flex items-center justify-between gap-2 rounded-lg border border-crm-border bg-crm-panel px-3 py-2"
              >
                <div className="min-w-0 text-xs text-crm-text">
                  <p className="truncate font-medium">{row.serviceName}</p>
                  <p className="truncate text-crm-text-muted">
                    {[row.Start_Date, row.End_Date, row.Invoice_Price, row.Vendor_Price]
                      .filter(Boolean)
                      .join(" · ") || "No optional values"}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-red-500 hover:text-red-600"
                  aria-label={`Remove ${row.serviceName}`}
                  onClick={() => removeSubformRow(String(row.OurServices))}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  function renderValueInput() {
    if (!selectedField) {
      return (
        <input
          id={valueId}
          className={controlClassName}
          disabled
          placeholder="Select a field first"
        />
      );
    }
    if (isFileField) {
      return (
        <input
          id={valueId}
          type="file"
          className={cn(controlClassName, "h-auto py-2 file:mr-3 file:cursor-pointer")}
          onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
        />
      );
    }
    if (isSubformField) return renderSubformInput();
    if (fieldType === "subform") {
      return (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          Subform editing is only available on Contracts and Deals.
        </p>
      );
    }
    if (isLookup) return renderLookupInput();
    if (fieldType === "boolean") {
      return (
        <label className="flex h-10 items-center gap-2 text-sm text-crm-text">
          <input
            id={valueId}
            type="checkbox"
            checked={Boolean(newValue)}
            onChange={(event) => setNewValue(event.target.checked)}
            className="size-5 accent-blue-600"
          />
          {Boolean(newValue) ? "True" : "False"}
        </label>
      );
    }
    if (fieldType === "picklist") {
      return (
        <select
          id={valueId}
          className={selectClassName}
          value={typeof newValue === "string" ? newValue : ""}
          onChange={(event) => setNewValue(event.target.value)}
        >
          <option value="">Select an option...</option>
          {selectedField.pickListValues?.map((option) => (
            <option key={option.actualValue} value={option.displayValue}>
              {option.displayValue}
            </option>
          ))}
        </select>
      );
    }
    if (fieldType === "multiselectpicklist") {
      return (
        <select
          id={valueId}
          multiple
          className={cn(controlClassName, "h-32 py-2")}
          value={Array.isArray(newValue) ? (newValue as string[]) : []}
          onChange={(event) =>
            setNewValue(
              Array.from(event.target.selectedOptions, (option) => option.value),
            )
          }
        >
          {selectedField.pickListValues?.map((option) => (
            <option key={option.actualValue} value={option.actualValue}>
              {option.displayValue}
            </option>
          ))}
        </select>
      );
    }

    const inputType =
      fieldType === "date"
        ? "date"
        : fieldType === "datetime"
          ? "datetime-local"
          : ["integer", "bigint", "double", "decimal", "currency", "percent"].includes(
                fieldType,
              )
            ? "number"
            : fieldType === "email"
              ? "email"
              : fieldType === "website" || fieldType === "url"
                ? "url"
                : "text";
    return (
      <input
        id={valueId}
        type={inputType}
        step={inputType === "number" ? "any" : undefined}
        value={typeof newValue === "string" ? newValue : ""}
        onChange={(event) => setNewValue(event.target.value)}
        className={controlClassName}
        autoComplete="off"
      />
    );
  }

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
          "relative max-h-[calc(100vh-2rem)] w-full max-w-[38rem] overflow-hidden rounded-2xl border border-crm-border bg-crm-panel shadow-xl shadow-zinc-950/15",
          "dark:shadow-black/50",
          className,
        )}
      >
        {submitting ? (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-crm-panel/85 backdrop-blur-[1px]">
            <Loader2 className="size-10 animate-spin text-blue-600" aria-hidden />
            <p className="text-sm font-medium text-crm-text">
              Updating selected records…
            </p>
          </div>
        ) : null}

        <header className="flex items-center justify-between gap-3 border-b border-crm-border bg-crm-panel px-5 py-4">
          <h2 id={titleId} className="page-heading truncate text-base sm:text-lg">
            {OLIO_MASS_UPDATE_WIDGET_NAME}
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

        <div className="max-h-[calc(100vh-5rem)] overflow-y-auto bg-crm-canvas px-4 py-6 sm:px-6 sm:py-8">
          <form
            onSubmit={handleSubmit}
            className="mx-auto w-full max-w-[29rem] rounded-2xl border border-crm-border bg-crm-panel px-5 py-6 shadow-md shadow-zinc-950/8 sm:px-7 sm:py-7 dark:shadow-black/30"
          >
            <h3 className="section-heading mb-1 text-center text-base sm:text-lg">
              {moduleUpdateHeading(module)}
            </h3>
            <p className="mb-6 text-center text-xs text-crm-text-muted">
              {selectedRecordIds.length.toLocaleString("en-US")} record
              {selectedRecordIds.length === 1 ? "" : "s"} selected
            </p>

            {result ? (
              <div className="space-y-4">
                <p
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm",
                    result.failureCount
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
                  )}
                  role="status"
                >
                  {result.message}
                </p>
                {result.errors?.length ? (
                  <ul className="max-h-40 list-disc space-y-1 overflow-auto rounded-lg border border-crm-border bg-crm-panel-muted p-3 pl-8 text-xs text-crm-text-muted">
                    {result.errors.map((item) => (
                      <li key={item.id}>
                        {item.id}: {item.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <Button
                  type="button"
                  className="w-full bg-blue-600 text-white hover:bg-blue-500"
                  onClick={onClose}
                >
                  OK
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor={fieldId}
                    className="text-sm font-medium text-crm-text"
                  >
                    Select Field
                  </label>
                  <select
                    id={fieldId}
                    required
                    value={fieldApiName}
                    disabled={fieldsLoading}
                    onChange={(event) => resetFieldValue(event.target.value)}
                    className={selectClassName}
                  >
                    <option value="">
                      {fieldsLoading ? "Loading fields..." : "Select field..."}
                    </option>
                    {fields.map((field) => (
                      <option key={field.apiName} value={field.apiName}>
                        {field.label} ({field.dataType})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor={valueId}
                    className="text-sm font-medium text-crm-text"
                  >
                    {isFileField
                      ? "Upload File"
                      : isSubformField
                        ? "Subform Value"
                        : "New Value"}
                  </label>
                  {renderValueInput()}
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-0.5">
                  <label
                    htmlFor={notifyId}
                    className="cursor-pointer text-sm font-medium text-crm-text-muted"
                  >
                    Notify Team
                  </label>
                  <button
                    id={notifyId}
                    type="button"
                    role="switch"
                    aria-checked={notifyTeam}
                    onClick={() => setNotifyTeam((previous) => !previous)}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2",
                      notifyTeam
                        ? "border-blue-600 bg-blue-600 dark:border-blue-500 dark:bg-blue-500"
                        : "border-crm-border bg-zinc-300 dark:bg-zinc-600",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "pointer-events-none inline-block size-5 rounded-full bg-white shadow transition",
                        notifyTeam ? "translate-x-[1.35rem]" : "translate-x-0.5",
                      )}
                    />
                  </button>
                </div>

                {error ? (
                  <p
                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300"
                    role="alert"
                  >
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={
                    submitting ||
                    fieldsLoading ||
                    selectedRecordIds.length === 0
                  }
                  className={cn(
                    "mt-1 inline-flex h-11 w-full items-center justify-center rounded-lg text-sm font-semibold text-white transition",
                    "bg-blue-600 hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                  )}
                >
                  Update Record
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
