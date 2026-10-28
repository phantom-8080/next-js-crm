import {
  executeZohoCrmFunction,
  fetchZohoJson,
  getZohoAccessToken,
  getZohoModuleFieldsUrl,
  invalidateZohoAccessTokenCache,
  isZohoTokenExpiredResponse,
  ZOHO_CRM_BASE,
} from "@/lib/zoho";
import {
  isMappedFileField,
  moduleNameField,
  MODULE_FILE_FIELD_MAPS,
  supportsSubformEditor,
} from "@/widgets/olio-mass-update/constants";
import type {
  MassUpdateFieldOption,
  MassUpdateSubformRow,
  OlioMassUpdatePayload,
  OlioMassUpdateRecordError,
  OlioMassUpdateResult,
  OlioMassUpdateValue,
} from "@/widgets/olio-mass-update/types";

const MODULE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

type RawZohoField = {
  api_name?: string;
  field_label?: string;
  data_type?: string;
  format?: string;
  pick_list_values?: Array<{
    actual_value?: unknown;
    display_value?: unknown;
  }>;
  lookup?: { module?: string; api_name?: string };
  associated_module?: { module?: string; api_name?: string };
};

type UploadedFile = {
  name: string;
  type: string;
  bytes: Uint8Array;
};

type ServerMassUpdatePayload = OlioMassUpdatePayload & {
  file?: UploadedFile;
};

function assertModuleName(module: string) {
  if (!MODULE_NAME_PATTERN.test(module)) {
    throw new Error("Invalid CRM module.");
  }
}

function normalizeDataType(dataType: unknown) {
  const type = String(dataType ?? "text").toLowerCase();
  return type === "ownerlookup" ? "userlookup" : type;
}

function extractLookupModule(field: RawZohoField) {
  return String(
    field.lookup?.module ??
      field.lookup?.api_name ??
      field.associated_module?.module ??
      field.associated_module?.api_name ??
      "",
  ).trim();
}

function mapField(field: RawZohoField): MassUpdateFieldOption | null {
  const apiName = String(field.api_name ?? "").trim();
  if (!apiName || apiName === "id" || apiName.startsWith("$")) return null;

  const pickListValues = Array.isArray(field.pick_list_values)
    ? field.pick_list_values
        .map((item) => {
          const actualValue = String(item.actual_value ?? item.display_value ?? "");
          const displayValue = String(item.display_value ?? item.actual_value ?? "");
          return actualValue && displayValue ? { actualValue, displayValue } : null;
        })
        .filter(
          (
            item,
          ): item is {
            actualValue: string;
            displayValue: string;
          } => Boolean(item),
        )
    : [];

  const lookupModule = extractLookupModule(field);
  return {
    apiName,
    label: String(field.field_label ?? apiName),
    dataType: normalizeDataType(field.data_type),
    ...(field.format ? { format: String(field.format) } : {}),
    ...(lookupModule ? { lookupModule } : {}),
    ...(pickListValues.length > 0 ? { pickListValues } : {}),
  };
}

async function loadRawFields(module: string): Promise<RawZohoField[]> {
  assertModuleName(module);
  const { res, body } = await fetchZohoJson(getZohoModuleFieldsUrl(module));
  if (!res.ok || !Array.isArray(body?.fields)) {
    const detail = body?.message || body?.code || `HTTP ${res.status}`;
    throw new Error(`Unable to load ${module} fields: ${String(detail)}`);
  }
  return body.fields;
}

export async function loadOlioMassUpdateFields(
  module = "Contracts",
): Promise<MassUpdateFieldOption[]> {
  const fields = await loadRawFields(module);
  return fields
    .map(mapField)
    .filter((field): field is MassUpdateFieldOption => Boolean(field))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function stringValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object" && value != null) return JSON.stringify(value);
  return String(value ?? "");
}

function isEmptyValue(value: OlioMassUpdateValue) {
  if (typeof value === "boolean") return false;
  if (Array.isArray(value)) return value.length === 0;
  return !String(value).trim();
}

function valueForZoho(fieldType: string, value: OlioMassUpdateValue): unknown {
  if (fieldType === "boolean") return Boolean(value);
  if (fieldType === "lookup" || fieldType === "userlookup") {
    return { id: String(value) };
  }
  if (fieldType === "multiselectlookup" || fieldType === "multiuserlookup") {
    const ids = Array.isArray(value) ? value : [String(value)];
    return ids.filter(Boolean).map((id) => ({ id: String(id) }));
  }
  if (fieldType === "multiselectpicklist") {
    return Array.isArray(value) ? value.map(String) : [String(value)];
  }
  return value;
}

function parseAuditLog(raw: unknown): Record<string, unknown[]> {
  if (!raw) return {};
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown[]>)
      : {};
  } catch {
    return {};
  }
}

function dateKey(currentDate: string) {
  const match = currentDate.match(/^\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  return new Date().toISOString().slice(0, 10);
}

function localDateTimeFallback() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  );
}

async function fetchRecord(module: string, id: string, fields: string[]) {
  const uniqueFields = [...new Set(fields.filter(Boolean))];
  const url =
    `${ZOHO_CRM_BASE}/${encodeURIComponent(module)}/${encodeURIComponent(id)}` +
    (uniqueFields.length
      ? `?fields=${encodeURIComponent(uniqueFields.join(","))}`
      : "");
  const { res, body } = await fetchZohoJson(url);
  const row = Array.isArray(body?.data) ? body.data[0] : null;
  if (!res.ok || !row) {
    const detail = body?.message || body?.code || `HTTP ${res.status}`;
    throw new Error(String(detail));
  }
  return row as Record<string, unknown>;
}

async function updateRecord(
  module: string,
  data: Record<string, unknown>,
): Promise<void> {
  const { res, body } = await fetchZohoJson(
    `${ZOHO_CRM_BASE}/${encodeURIComponent(module)}`,
    {
      method: "PUT",
      body: { data: [data], trigger: ["workflow"] },
    },
  );
  const result = Array.isArray(body?.data) ? body.data[0] : null;
  if (!res.ok || String(result?.code ?? "").toUpperCase() !== "SUCCESS") {
    const detail =
      result?.message || body?.message || result?.code || body?.code || `HTTP ${res.status}`;
    throw new Error(String(detail));
  }
}

async function uploadFileToZoho(file: UploadedFile): Promise<string> {
  const url = `${ZOHO_CRM_BASE}/files`;

  async function post(token: string) {
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([Uint8Array.from(file.bytes)], {
        type: file.type || "application/octet-stream",
      }),
      file.name,
    );
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
      cache: "no-store",
      body: formData,
    });
    const body = await res.json().catch(() => ({}));
    return { res, body };
  }

  let token = await getZohoAccessToken();
  let result = await post(token);
  if (isZohoTokenExpiredResponse(result.res, result.body)) {
    invalidateZohoAccessTokenCache();
    token = await getZohoAccessToken({ force: true });
    result = await post(token);
  }

  const row = Array.isArray(result.body?.data) ? result.body.data[0] : null;
  const fileId = String(row?.details?.id ?? row?.id ?? "").trim();
  if (!result.res.ok || !fileId) {
    const detail =
      row?.message || result.body?.message || row?.code || `HTTP ${result.res.status}`;
    throw new Error(`File upload failed: ${String(detail)}`);
  }
  return fileId;
}

function cleanedSubformRow(row: MassUpdateSubformRow) {
  const result: Record<string, unknown> = {
    OurServices: { id: row.OurServices },
  };
  for (const key of [
    "Start_Date",
    "End_Date",
    "Invoice_Price",
    "Vendor_Price",
  ] as const) {
    const value = row[key];
    if (value && value !== "N/A" && value !== "null") result[key] = value;
  }
  return result;
}

function mergeSubformRows(
  existing: unknown,
  incoming: MassUpdateSubformRow[],
): Record<string, unknown>[] {
  const rows = Array.isArray(existing)
    ? existing.map((row) => ({ ...(row as Record<string, unknown>) }))
    : [];

  for (const newRow of incoming) {
    const index = rows.findIndex((row) => {
      const service = row.OurServices as { id?: unknown } | undefined;
      return String(service?.id ?? "") === String(newRow.OurServices);
    });
    const cleaned = cleanedSubformRow(newRow);
    if (index < 0) {
      rows.push(cleaned);
      continue;
    }
    const previous = rows[index];
    rows[index] = {
      ...previous,
      ...cleaned,
      Start_Date: cleaned.Start_Date ?? previous.Start_Date ?? null,
      End_Date: cleaned.End_Date ?? previous.End_Date ?? null,
      Invoice_Price: cleaned.Invoice_Price ?? previous.Invoice_Price ?? null,
      Vendor_Price: cleaned.Vendor_Price ?? previous.Vendor_Price ?? null,
    };
  }
  return rows;
}

async function notifyCatalyst(args: {
  entityId: string;
  letTeamKnow: boolean;
  fieldName: string;
  fieldValue: OlioMassUpdateValue;
  currentDate: string;
  sortKey: string;
  recordName: string;
}) {
  const { res, body } = await executeZohoCrmFunction(
    "NotificationCatalystDB",
    {
      entityId: args.entityId,
      letTeamKnow: String(args.letTeamKnow),
      fieldName: args.fieldName,
      fieldValue: stringValue(args.fieldValue),
      currentDate: args.currentDate,
      RecordName: args.recordName || "Unknown",
      SortKey: args.sortKey,
    },
  );
  if (!res.ok) {
    const detail = body?.message || body?.code || `HTTP ${res.status}`;
    throw new Error(`Catalyst notification failed: ${String(detail)}`);
  }
}

async function validateActiveVendor(
  selectedRecordIds: string[],
  vendorId: string,
) {
  const vendor = await fetchRecord("Vendors", vendorId, ["Vendor_Name", "Status"]);
  if (String(vendor.Status ?? "") === "Active") return;

  let userEmail = "";
  try {
    const firstContract = await fetchRecord("Contracts", selectedRecordIds[0], [
      "Operations_Associate",
    ]);
    const operationsAssociate = firstContract.Operations_Associate as
      | { id?: unknown }
      | undefined;
    const userId = String(operationsAssociate?.id ?? "");
    if (userId) {
      const { res, body } = await fetchZohoJson(
        `${ZOHO_CRM_BASE}/users/${encodeURIComponent(userId)}`,
      );
      if (res.ok) {
        userEmail = String(
          (Array.isArray(body?.users) ? body.users[0]?.email : "") ?? "",
        );
      }
    }
  } catch {
    // Blocking an inactive vendor is more important than notification lookup.
  }

  try {
    await executeZohoCrmFunction("teamcliqnotification", {
      user: userEmail,
      vendorId,
    });
  } catch {
    // The legacy widget treats Cliq as a best-effort warning.
  }
  throw new Error(
    `Vendor ${String(vendor.Vendor_Name ?? vendorId)} must be active to proceed.`,
  );
}

export async function updateOlioMassRecords(
  payload: ServerMassUpdatePayload,
): Promise<OlioMassUpdateResult> {
  const moduleName = String(payload.module || "Contracts").trim();
  assertModuleName(moduleName);
  const ids = [...new Set((payload.selectedRecordIds ?? []).map(String))]
    .map((id) => id.trim())
    .filter(Boolean);
  if (ids.length === 0) {
    return { ok: false, message: "Select at least one record." };
  }

  const fieldApiName = String(payload.fieldApiName ?? "").trim();
  if (!fieldApiName) {
    return { ok: false, message: "Please select a field." };
  }

  const fields = await loadOlioMassUpdateFields(moduleName);
  const selectedField = fields.find((field) => field.apiName === fieldApiName);
  if (!selectedField) {
    return { ok: false, message: "The selected field is not available in Zoho CRM." };
  }

  const fieldType = normalizeDataType(selectedField.dataType);
  const mappedFile = isMappedFileField(moduleName, fieldApiName);
  const isFile = fieldType === "fileupload" || mappedFile;
  if (isFile && !payload.file) {
    return { ok: false, message: "Please select a file to upload." };
  }
  if (
    fieldType === "subform" &&
    !supportsSubformEditor(moduleName)
  ) {
    return {
      ok: false,
      message: "Subform mass update is only supported for Contracts and Deals.",
    };
  }
  if (!isFile && fieldType !== "boolean" && isEmptyValue(payload.newValue)) {
    return { ok: false, message: "Please enter a new value." };
  }

  if (
    moduleName === "Contracts" &&
    fieldApiName === "Vendor" &&
    typeof payload.newValue === "string"
  ) {
    await validateActiveVendor(ids, payload.newValue);
  }

  const currentDate = payload.currentDate?.trim() || localDateTimeFallback();
  const nameField = moduleNameField(moduleName);
  const urlCompanionField = MODULE_FILE_FIELD_MAPS[moduleName]?.[fieldApiName];
  const errors: OlioMassUpdateRecordError[] = [];
  let successCount = 0;

  for (const id of ids) {
    try {
      const fieldsToFetch = [nameField, fieldApiName];
      if (moduleName === "Contracts") {
        fieldsToFetch.push("MassWidgetUpdate", "MassWidgetUpdateCount");
      }
      const record = await fetchRecord(moduleName, id, fieldsToFetch);
      const previousCount = Number.parseInt(
        String(record.MassWidgetUpdateCount ?? "0"),
        10,
      );
      const updatedCount = (Number.isFinite(previousCount) ? previousCount : 0) + 1;
      const updateData: Record<string, unknown> = { id };

      if (moduleName === "Contracts") {
        const auditLog = parseAuditLog(record.MassWidgetUpdate);
        const key = dateKey(currentDate);
        const today = Array.isArray(auditLog[key]) ? auditLog[key] : [];
        today.push({
          Field: fieldApiName,
          Value: payload.newValue,
          LetTeamKnow: String(payload.notifyTeam),
          DateTime: currentDate,
        });
        auditLog[key] = today;
        updateData.Record_Changed_Today = true;
        updateData.Updated_By_Widget = false;
        updateData.MassWidgetUpdateCount = updatedCount;
        updateData.MassWidgetUpdate = JSON.stringify(auditLog);
      }

      if (fieldType === "subform") {
        const incoming = Array.isArray(payload.newValue)
          ? (payload.newValue as MassUpdateSubformRow[])
          : [];
        updateData[fieldApiName] = mergeSubformRows(
          record[fieldApiName],
          incoming,
        );
      } else if (isFile && payload.file) {
        const fileId = await uploadFileToZoho(payload.file);
        // Bid docs historically stored the uploaded file id on the companion URL field.
        if (fieldApiName === "Bid_Docs_Upload" && urlCompanionField) {
          updateData[urlCompanionField] = fileId;
        } else {
          const existingFiles = Array.isArray(record[fieldApiName])
            ? record[fieldApiName]
            : [];
          updateData[fieldApiName] = [
            ...existingFiles
              .map((file) => {
                const item = file as Record<string, unknown>;
                const attachmentId = item.attachment_Id ?? item.attachment_id;
                return attachmentId
                  ? { attachment_id: String(attachmentId), _delete: null }
                  : null;
              })
              .filter(Boolean),
            { file_id: fileId },
          ];
        }
      } else {
        updateData[fieldApiName] = valueForZoho(
          fieldType,
          payload.newValue,
        );
      }

      await updateRecord(moduleName, updateData);
      try {
        await notifyCatalyst({
          entityId: id,
          letTeamKnow: Boolean(payload.notifyTeam),
          fieldName: fieldApiName,
          fieldValue: payload.newValue,
          currentDate,
          sortKey: `data-${updatedCount}`,
          recordName: String(
            record[nameField] ?? record.Name ?? "Unknown",
          ),
        });
      } catch (notifyError) {
        console.warn(
          `[olio-mass-update] Catalyst notify failed for ${id}:`,
          notifyError,
        );
      }
      successCount += 1;
    } catch (error) {
      errors.push({
        id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const failureCount = errors.length;
  const totalRecords = ids.length;
  return {
    ok: successCount > 0,
    message: `Update completed. Total: ${totalRecords}, Success: ${successCount}, Failures: ${failureCount}`,
    totalRecords,
    successCount,
    failureCount,
    errors,
  };
}
