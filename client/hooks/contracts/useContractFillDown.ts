"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { ContractRecord } from "@/lib/contracts/columns";
import type { ContractListBulkUpdateResult } from "@/widgets/contract-list-bulk-update/types";

export type ActiveFillCell = {
  rowId: string;
  rowIndex: number;
  apiName: string;
  dataType: string;
};

export type FillDownPreview = {
  apiName: string;
  fromIndex: number;
  toIndex: number;
};

export type PendingFillUpdate = {
  recordIds: string[];
  fieldApiName: string;
  fieldType: string;
  fieldValue: string;
  displayValue: string;
  /** Restore this cell if the user cancels a single-cell edit. */
  rollback?: {
    rowId: string;
    apiName: string;
    previousValue: string;
    previousLookupId?: string;
  };
};

const NON_FILLABLE_TYPES = new Set([
  "subform",
  "fileupload",
  "imageupload",
  "profileimage",
  "multiselectlookup",
  "multiuserlookup",
  "rrule",
]);

export function isFillableFieldType(dataType: string, apiName?: string) {
  void apiName;
  const t = dataType.trim().toLowerCase();
  if (!t) return true;
  return !NON_FILLABLE_TYPES.has(t);
}

/** Types that support typing a new value in the grid before fill-down. */
export function isInlineEditableFieldType(dataType: string, apiName?: string) {
  const t = dataType.trim().toLowerCase();
  if (!isFillableFieldType(t, apiName)) return false;
  return true;
}

export function resolveFillDownFieldValue(
  row: ContractRecord,
  apiName: string,
  dataType: string,
): string {
  const type = dataType.trim().toLowerCase();
  const raw = String(row.fields[apiName] ?? "").trim();
  const lookupId = row.lookups?.[apiName]?.trim();

  if (type === "boolean" || type === "checkbox") {
    const lower = raw.toLowerCase();
    if (lower === "yes" || lower === "true" || lower === "1") return "true";
    if (lower === "no" || lower === "false" || lower === "0") return "false";
    return raw;
  }

  // Prefer typed/edited cell text. If it looks like a CRM id, use it for lookups.
  if (
    type === "lookup" ||
    type === "userlookup" ||
    type === "ownerlookup"
  ) {
    if (/^\d{6,}$/.test(raw)) return raw;
    if (lookupId && raw === "") return lookupId;
    // Display name — Deluge searches by name.
    if (raw) return raw;
    if (lookupId) return lookupId;
    return "";
  }

  if (lookupId && /^\d{6,}$/.test(raw)) return raw;
  return raw;
}

function toApiBoolean(raw: string): string {
  const lower = raw.trim().toLowerCase();
  if (lower === "yes" || lower === "true" || lower === "1") return "true";
  if (lower === "no" || lower === "false" || lower === "0") return "false";
  return raw.trim();
}

function readFillTargetFromPoint(
  clientX: number,
  clientY: number,
): { rowIndex: number; apiName: string } | null {
  if (typeof document === "undefined") return null;
  const el = document.elementFromPoint(clientX, clientY);
  if (!(el instanceof Element)) return null;
  const cell = el.closest("[data-fill-row][data-fill-col]");
  if (!(cell instanceof HTMLElement)) return null;
  const rowIndex = Number.parseInt(cell.dataset.fillRow ?? "", 10);
  const apiName = String(cell.dataset.fillCol ?? "").trim();
  if (!Number.isFinite(rowIndex) || !apiName) return null;
  return { rowIndex, apiName };
}

type UseContractFillDownArgs = {
  contracts: ContractRecord[];
  setContracts: Dispatch<SetStateAction<ContractRecord[]>>;
};

export function useContractFillDown({
  contracts,
  setContracts,
}: UseContractFillDownArgs) {
  const [activeCell, setActiveCell] = useState<ActiveFillCell | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftValue, setDraftValue] = useState("");
  /** When user picks a lookup suggestion, store id+label for save/fill. */
  const [lookupSelection, setLookupSelection] = useState<{
    value: string;
    label: string;
  } | null>(null);
  const [preview, setPreview] = useState<FillDownPreview | null>(null);
  const [filling, setFilling] = useState(false);
  const [fillMessage, setFillMessage] = useState<string | null>(null);
  const [fillError, setFillError] = useState<string | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<PendingFillUpdate | null>(
    null,
  );

  const draggingRef = useRef(false);
  const sourceRef = useRef<ActiveFillCell | null>(null);
  const previewRef = useRef<FillDownPreview | null>(null);
  /** Value captured when fill drag starts (includes in-progress edit). */
  const fillPayloadRef = useRef<{
    displayValue: string;
    fieldValue: string;
    /** Source cell already has this value, so it is not part of the update. */
    sourceUnchanged: boolean;
  } | null>(null);
  const commitFillRef = useRef<() => Promise<void>>(async () => {});
  const contractsRef = useRef(contracts);
  const activeCellRef = useRef<ActiveFillCell | null>(null);
  const draftValueRef = useRef("");
  const editingRef = useRef(false);
  const lookupSelectionRef = useRef<{ value: string; label: string } | null>(
    null,
  );
  /** Cell value before the current edit, so cancel can undo local changes. */
  const editBaselineRef = useRef<{
    rowId: string;
    apiName: string;
    value: string;
    lookupId?: string;
  } | null>(null);
  useEffect(() => {
    contractsRef.current = contracts;
    activeCellRef.current = activeCell;
    draftValueRef.current = draftValue;
    editingRef.current = editing;
    lookupSelectionRef.current = lookupSelection;
  });

  const clearFillUi = useCallback(() => {
    draggingRef.current = false;
    sourceRef.current = null;
    previewRef.current = null;
    fillPayloadRef.current = null;
    setPreview(null);
  }, []);

  const patchLocalCell = useCallback(
    (
      rowId: string,
      apiName: string,
      dataType: string,
      displayValue: string,
    ) => {
      const type = dataType.toLowerCase();
      const trimmed = displayValue.trim();
      setContracts((prev) =>
        prev.map((row) => {
          if (row.id !== rowId) return row;
          const nextFields = { ...row.fields, [apiName]: displayValue };
          let nextLookups = row.lookups;
          if (
            type === "lookup" ||
            type === "userlookup" ||
            type === "ownerlookup"
          ) {
            if (/^\d{6,}$/.test(trimmed)) {
              nextLookups = { ...(row.lookups ?? {}), [apiName]: trimmed };
            } else if (!trimmed) {
              const rest = { ...(row.lookups ?? {}) };
              delete rest[apiName];
              nextLookups = Object.keys(rest).length ? rest : undefined;
            }
            // Name-only edit: keep previous lookup id until Zoho resolves on save.
          }
          return { ...row, fields: nextFields, lookups: nextLookups };
        }),
      );
    },
    [setContracts],
  );

  const commitEdit = useCallback(() => {
    const cell = activeCellRef.current;
    if (!cell || !editingRef.current) {
      setEditing(false);
      return;
    }
    const nextValue = draftValueRef.current;
    patchLocalCell(cell.rowId, cell.apiName, cell.dataType, nextValue);
    setEditing(false);
  }, [patchLocalCell]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setDraftValue("");
    setLookupSelection(null);
  }, []);

  const updateDraftValue = useCallback((value: string) => {
    setDraftValue(value);
    // Typing clears a previous suggestion pick unless the label still matches.
    setLookupSelection((prev) =>
      prev && prev.label === value ? prev : null,
    );
  }, []);

  const selectLookupSuggestion = useCallback(
    (option: { value: string; label: string }) => {
      setDraftValue(option.label);
      setLookupSelection(option);
      lookupSelectionRef.current = option;
      draftValueRef.current = option.label;
      const cell = activeCellRef.current;
      if (cell) {
        patchLocalCell(cell.rowId, cell.apiName, cell.dataType, option.label);
        // Also stamp the lookup id locally.
        setContracts((prev) =>
          prev.map((row) => {
            if (row.id !== cell.rowId) return row;
            return {
              ...row,
              fields: { ...row.fields, [cell.apiName]: option.label },
              lookups: { ...(row.lookups ?? {}), [cell.apiName]: option.value },
            };
          }),
        );
      }
    },
    [patchLocalCell, setContracts],
  );

  const startEditing = useCallback((cell?: ActiveFillCell) => {
    const target = cell ?? activeCellRef.current;
    if (
      !target ||
      !isInlineEditableFieldType(target.dataType, target.apiName)
    ) {
      return;
    }
    const row = contractsRef.current[target.rowIndex];
    if (!row || row.id !== target.rowId) return;
    const current = String(row.fields[target.apiName] ?? "");
    const existingId = row.lookups?.[target.apiName]?.trim();
    editBaselineRef.current = {
      rowId: target.rowId,
      apiName: target.apiName,
      value: current,
      lookupId: existingId,
    };
    setActiveCell(target);
    setDraftValue(current);
    setLookupSelection(
      existingId && current ?
        { value: existingId, label: current }
      : null,
    );
    setEditing(true);
    setFillMessage(null);
    setFillError(null);
  }, []);

  const selectCell = useCallback(
    (cell: ActiveFillCell) => {
      if (!isFillableFieldType(cell.dataType, cell.apiName)) return;
      if (editingRef.current) {
        commitEdit();
      }
      setActiveCell(cell);
      setEditing(false);
      setLookupSelection(null);
      setFillMessage(null);
      setFillError(null);
    },
    [commitEdit],
  );

  const setPreviewRange = useCallback((apiName: string, rowIndex: number) => {
    const source = sourceRef.current;
    if (!source || apiName !== source.apiName) return;
    const from = Math.min(source.rowIndex, rowIndex);
    const to = Math.max(source.rowIndex, rowIndex);
    const next = { apiName, fromIndex: from, toIndex: to };
    previewRef.current = next;
    setPreview(next);
  }, []);

  const beginFillDrag = useCallback(
    (cell: ActiveFillCell, e: ReactPointerEvent) => {
      if (!isFillableFieldType(cell.dataType, cell.apiName) || filling) return;
      e.preventDefault();
      e.stopPropagation();

      const row = contractsRef.current[cell.rowIndex];
      if (!row || row.id !== cell.rowId) return;

      // Prefer the in-progress edit so drag uses "test 10" not the old "test 1".
      const picked = lookupSelectionRef.current;
      const displayValue =
        editingRef.current &&
        activeCellRef.current?.rowId === cell.rowId &&
        activeCellRef.current?.apiName === cell.apiName
          ? draftValueRef.current
          : picked && picked.label
            ? picked.label
            : String(row.fields[cell.apiName] ?? "");

      const currentSourceValue = String(row.fields[cell.apiName] ?? "").trim();
      const sourceUnchanged = currentSourceValue === displayValue.trim();

      if (editingRef.current) {
        patchLocalCell(cell.rowId, cell.apiName, cell.dataType, displayValue);
        setEditing(false);
      }

      const sourceForResolve: ContractRecord = {
        ...row,
        fields: { ...row.fields, [cell.apiName]: displayValue },
        lookups:
          picked?.value ?
            { ...(row.lookups ?? {}), [cell.apiName]: picked.value }
          : /^\d{6,}$/.test(displayValue.trim()) &&
              (cell.dataType.toLowerCase() === "lookup" ||
                cell.dataType.toLowerCase() === "userlookup" ||
                cell.dataType.toLowerCase() === "ownerlookup")
            ? { ...(row.lookups ?? {}), [cell.apiName]: displayValue.trim() }
            : row.lookups,
      };
      const fieldValue =
        picked?.value ||
        resolveFillDownFieldValue(
          sourceForResolve,
          cell.apiName,
          cell.dataType,
        );
      fillPayloadRef.current = {
        displayValue,
        fieldValue,
        sourceUnchanged,
      };

      draggingRef.current = true;
      sourceRef.current = cell;
      setActiveCell(cell);
      const nextPreview = {
        apiName: cell.apiName,
        fromIndex: cell.rowIndex,
        toIndex: cell.rowIndex,
      };
      previewRef.current = nextPreview;
      setPreview(nextPreview);
      setFillMessage(null);
      setFillError(null);
    },
    [filling, patchLocalCell],
  );

  const applyOptimisticFill = useCallback(
    (
      targetIds: string[],
      apiName: string,
      dataType: string,
      displayValue: string,
      fieldValueForApi: string,
    ) => {
      const type = dataType.toLowerCase();
      const lookupId =
        type === "lookup" ||
        type === "userlookup" ||
        type === "ownerlookup" ||
        /^\d{6,}$/.test(fieldValueForApi)
          ? /^\d{6,}$/.test(fieldValueForApi)
            ? fieldValueForApi
            : undefined
          : undefined;

      const idSet = new Set(targetIds);
      setContracts((prev) =>
        prev.map((row) => {
          if (!idSet.has(row.id)) return row;
          const nextFields = { ...row.fields, [apiName]: displayValue };
          const nextLookups =
            lookupId ?
              { ...(row.lookups ?? {}), [apiName]: lookupId }
            : row.lookups;
          return { ...row, fields: nextFields, lookups: nextLookups };
        }),
      );
    },
    [setContracts],
  );

  const persistBulk = useCallback(
    async (
      targetIds: string[],
      apiName: string,
      dataType: string,
      fieldValue: string,
      displayValue: string,
      successMessage?: string,
    ) => {
      setFilling(true);
      setFillError(null);
      setFillMessage(
        successMessage ??
          `Updating ${targetIds.length} contract${targetIds.length === 1 ? "" : "s"}…`,
      );

      try {
        const res = await fetch("/api/widgets/contract-list-bulk-update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recordIds: targetIds,
            fieldApiName: apiName,
            fieldValue,
            fieldType: dataType,
          }),
        });
        const result = (await res.json()) as ContractListBulkUpdateResult;
        if (!result.ok) {
          setFillError(result.message || "Bulk update failed.");
          setFillMessage(null);
          return false;
        }
        applyOptimisticFill(
          targetIds,
          apiName,
          dataType,
          displayValue,
          fieldValue,
        );
        setFillMessage(
          result.message ||
            `Updated ${targetIds.length} contract${targetIds.length === 1 ? "" : "s"}.`,
        );
        return true;
      } catch (error) {
        setFillError(
          error instanceof Error ? error.message : "Bulk update failed.",
        );
        setFillMessage(null);
        return false;
      } finally {
        setFilling(false);
      }
    },
    [applyOptimisticFill],
  );

  const commitEditAndSave = useCallback(async () => {
    const cell = activeCellRef.current;
    if (!cell || !editingRef.current) {
      setEditing(false);
      return;
    }

    const nextDisplay = draftValueRef.current;
    const picked = lookupSelectionRef.current;
    const row = contractsRef.current.find((r) => r.id === cell.rowId);
    const previous = String(row?.fields[cell.apiName] ?? "");
    const previousId = row?.lookups?.[cell.apiName]?.trim() ?? "";
    patchLocalCell(cell.rowId, cell.apiName, cell.dataType, nextDisplay);
    setEditing(false);

    const type = cell.dataType.toLowerCase();
    let fieldValue = nextDisplay.trim();
    if (type === "boolean" || type === "checkbox") {
      fieldValue = toApiBoolean(nextDisplay);
    } else if (
      type === "lookup" ||
      type === "userlookup" ||
      type === "ownerlookup"
    ) {
      fieldValue = (picked?.value || previousId || fieldValue).trim();
      if (!fieldValue) {
        setFillError("Pick a lookup suggestion (or enter a record ID).");
        return;
      }
    }

    if (!fieldValue && type !== "boolean" && type !== "checkbox") {
      setFillError("Value cannot be empty.");
      return;
    }

    const baseline = editBaselineRef.current;
    const previousValue =
      baseline?.rowId === cell.rowId && baseline.apiName === cell.apiName
        ? baseline.value
        : previous;
    const previousLookup =
      baseline?.rowId === cell.rowId && baseline.apiName === cell.apiName
        ? baseline.lookupId
        : previousId;

    if (
      nextDisplay === previousValue &&
      (!picked || picked.value === (previousLookup ?? ""))
    ) {
      return;
    }

    setPendingUpdate({
      recordIds: [cell.rowId],
      fieldApiName: cell.apiName,
      fieldType: cell.dataType,
      fieldValue,
      displayValue: picked?.label || nextDisplay,
      rollback: {
        rowId: cell.rowId,
        apiName: cell.apiName,
        previousValue,
        previousLookupId: previousLookup,
      },
    });
  }, [patchLocalCell]);

  const commitFill = useCallback(async () => {
    const source = sourceRef.current;
    const range = previewRef.current;
    const payload = fillPayloadRef.current;
    clearFillUi();

    if (!source || !range || !payload) return;

    const from = range.fromIndex;
    const to = range.toIndex;
    if (to === from) return;

    const rows = contractsRef.current;
    const sourceRow = rows[source.rowIndex];
    if (!sourceRow || sourceRow.id !== source.rowId) {
      setFillError("Source row is no longer available. Refresh and try again.");
      return;
    }

    const targetIds = rows
      .slice(from, to + 1)
      .map((row) => row.id)
      .filter((id) => {
        if (!id) return false;
        if (payload.sourceUnchanged && id === source.rowId) return false;
        return true;
      });
    if (targetIds.length === 0) return;

    const { displayValue, fieldValue } = payload;

    if (!fieldValue && source.dataType.toLowerCase() !== "boolean") {
      setFillError("Source cell is empty — nothing to fill.");
      return;
    }

    setPendingUpdate({
      recordIds: targetIds,
      fieldApiName: source.apiName,
      fieldType: source.dataType,
      fieldValue,
      displayValue,
    });
  }, [clearFillUi]);

  const cancelPendingUpdate = useCallback(() => {
    const pending = pendingUpdate;
    setPendingUpdate(null);
    if (!pending?.rollback) return;
    const { rowId, apiName, previousValue, previousLookupId } = pending.rollback;
    setContracts((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const nextFields = { ...row.fields, [apiName]: previousValue };
        const nextLookups = { ...(row.lookups ?? {}) };
        if (previousLookupId) nextLookups[apiName] = previousLookupId;
        else delete nextLookups[apiName];
        return {
          ...row,
          fields: nextFields,
          lookups: Object.keys(nextLookups).length ? nextLookups : undefined,
        };
      }),
    );
  }, [pendingUpdate, setContracts]);

  const confirmPendingUpdate = useCallback(async () => {
    const pending = pendingUpdate;
    if (!pending || filling) return;
    setPendingUpdate(null);
    await persistBulk(
      pending.recordIds,
      pending.fieldApiName,
      pending.fieldType,
      pending.fieldValue,
      pending.displayValue,
      pending.recordIds.length === 1 ? "Saving cell…" : undefined,
    );
  }, [filling, pendingUpdate, persistBulk]);

  useEffect(() => {
    commitFillRef.current = commitFill;
  });

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (!draggingRef.current || !sourceRef.current) return;
      const hit = readFillTargetFromPoint(e.clientX, e.clientY);
      if (!hit) return;
      setPreviewRange(hit.apiName, hit.rowIndex);
    };

    const onPointerUp = () => {
      if (!draggingRef.current) return;
      void commitFillRef.current();
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [setPreviewRange]);

  const isCellInFillPreview = useCallback(
    (rowIndex: number, apiName: string) => {
      if (!preview || preview.apiName !== apiName) return false;
      return rowIndex >= preview.fromIndex && rowIndex <= preview.toIndex;
    },
    [preview],
  );

  const isActiveCell = useCallback(
    (rowId: string, apiName: string) =>
      activeCell?.rowId === rowId && activeCell.apiName === apiName,
    [activeCell],
  );

  const isEditingCell = useCallback(
    (rowId: string, apiName: string) =>
      editing &&
      activeCell?.rowId === rowId &&
      activeCell.apiName === apiName,
    [activeCell, editing],
  );

  return {
    activeCell,
    editing,
    draftValue,
    setDraftValue: updateDraftValue,
    selectLookupSuggestion,
    filling,
    fillMessage,
    fillError,
    pendingUpdate,
    confirmPendingUpdate,
    cancelPendingUpdate,
    selectCell,
    startEditing,
    commitEditAndSave,
    cancelEdit,
    beginFillDrag,
    isCellInFillPreview,
    isActiveCell,
    isEditingCell,
    clearFillMessage: () => {
      setFillMessage(null);
      setFillError(null);
    },
  };
}
