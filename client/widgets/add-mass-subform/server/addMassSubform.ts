import {
  fetchZohoJson,
  ZOHO_CRM_BASE,
} from "@/lib/zoho";
import {
  ADD_MASS_SUBFORM_BULK_BATCH_SIZE,
  getSubformFieldForModule,
  type AddMassSubformPayload,
  type AddMassSubformRecordError,
  type AddMassSubformResult,
  type AddMassSubformRow,
} from "@/widgets/add-mass-subform/types";

const MODULE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

function assertModuleName(moduleName: string) {
  if (!MODULE_NAME_PATTERN.test(moduleName)) {
    throw new Error("Invalid CRM module.");
  }
}

function chunkArray<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

/** Build Zoho subform row payload — same fields as legacy `handleSubmittion`. */
function toZohoSubformRow(row: AddMassSubformRow) {
  const product: Record<string, unknown> = {
    OurServices: { id: String(row.OurServices) },
  };

  const startDate = String(row.Start_Date ?? "").trim();
  const endDate = String(row.End_Date ?? "").trim();
  if (startDate) product.Start_Date = startDate;
  if (endDate) product.End_Date = endDate;

  const clientPrice = String(row.Invoice_Price ?? "").trim();
  if (clientPrice) product.Invoice_Price = clientPrice;

  const vendorPrice = String(row.Vendor_Price ?? "").trim();
  if (vendorPrice) product.Vendor_Price = vendorPrice;

  return product;
}

/**
 * Merge incoming products into existing subform rows — same rules as
 * widget_logic/index.js `mergeSubformRows`.
 */
function mergeSubformRows(
  existingSubForm: unknown,
  newProductsData: AddMassSubformRow[],
) {
  let merged: Record<string, unknown>[] = Array.isArray(existingSubForm)
    ? existingSubForm.map((row) => ({ ...(row as Record<string, unknown>) }))
    : [];

  for (const newProduct of newProductsData) {
    const cleaned = toZohoSubformRow(newProduct);
    let matchFound = false;

    merged = merged.map((existingProduct) => {
      const service = existingProduct.OurServices as { id?: unknown } | undefined;
      if (String(service?.id ?? "") === String(newProduct.OurServices)) {
        matchFound = true;
        return { ...existingProduct, ...cleaned };
      }
      return existingProduct;
    });

    if (!matchFound) {
      merged.push(cleaned);
    }
  }

  return merged;
}

async function fetchRecordSubform(
  moduleName: string,
  id: string,
  subFormField: string,
) {
  const url =
    `${ZOHO_CRM_BASE}/${encodeURIComponent(moduleName)}/${encodeURIComponent(id)}` +
    `?fields=${encodeURIComponent(subFormField)}`;
  const { res, body } = await fetchZohoJson(url);
  const row = Array.isArray(body?.data) ? body.data[0] : null;
  if (!res.ok || !row) {
    const detail = body?.message || body?.code || `HTTP ${res.status}`;
    throw new Error(String(detail));
  }
  return row as Record<string, unknown>;
}

async function bulkUpdateRecords(
  moduleName: string,
  records: Record<string, unknown>[],
) {
  const batches = chunkArray(records, ADD_MASS_SUBFORM_BULK_BATCH_SIZE);
  let successCount = 0;
  const errors: AddMassSubformRecordError[] = [];

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
    const batch = batches[batchIndex];
    const { res, body } = await fetchZohoJson(
      `${ZOHO_CRM_BASE}/${encodeURIComponent(moduleName)}`,
      {
        method: "PUT",
        body: { data: batch },
      },
    );

    if (body?.status === "error" && (body.code || body.message)) {
      const message = String(body.message || body.code || "Bulk update failed");
      for (const record of batch) {
        errors.push({ id: String(record.id ?? "unknown"), message });
      }
      continue;
    }

    const results = Array.isArray(body?.data) ? body.data : [];
    if (!res.ok && results.length === 0) {
      const message = String(
        body?.message || body?.code || `HTTP ${res.status}`,
      );
      for (const record of batch) {
        errors.push({ id: String(record.id ?? "unknown"), message });
      }
      continue;
    }

    for (const item of results) {
      const recordId = String(item?.details?.id ?? "unknown");
      if (String(item?.code ?? "").toUpperCase() === "SUCCESS") {
        successCount += 1;
      } else {
        errors.push({
          id: recordId,
          message: String(
            item?.message || item?.code || "Failed to update record",
          ),
        });
      }
    }

    if (!results.length) {
      for (const record of batch) {
        errors.push({
          id: String(record.id ?? "unknown"),
          message: "Bulk update returned no results",
        });
      }
    }
  }

  return { successCount, errors };
}

/**
 * Mass-add subform rows — same flow as widget_logic/index.js `handleSubmittion`:
 * resolve field by module → merge per record → bulk PUT in batches of 100.
 */
export async function addMassSubformRows(
  payload: AddMassSubformPayload,
): Promise<AddMassSubformResult> {
  const moduleName = String(payload.module || "Contracts").trim();
  assertModuleName(moduleName);

  const subFormField = getSubformFieldForModule(moduleName);
  if (!subFormField) {
    return { ok: false, message: `Unsupported entity type: ${moduleName}` };
  }

  const ids = [...new Set((payload.selectedRecordIds ?? []).map(String))]
    .map((id) => id.trim())
    .filter(Boolean);
  if (ids.length === 0) {
    return { ok: false, message: "Select at least one record." };
  }

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  if (rows.length === 0) {
    return { ok: false, message: "No products to update!" };
  }

  const recordsToUpdate: Record<string, unknown>[] = [];
  const prepareErrors: AddMassSubformRecordError[] = [];

  for (const id of ids) {
    try {
      const existingData = await fetchRecordSubform(
        moduleName,
        id,
        subFormField,
      );
      const existingSubForm = existingData[subFormField] || [];
      const mergedSubForm = mergeSubformRows(existingSubForm, rows);
      recordsToUpdate.push({
        id,
        [subFormField]: mergedSubForm,
      });
    } catch (error) {
      prepareErrors.push({
        id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (recordsToUpdate.length === 0) {
    return {
      ok: false,
      message: "No records to update.",
      totalRecords: ids.length,
      successCount: 0,
      failureCount: prepareErrors.length,
      errors: prepareErrors,
    };
  }

  const { successCount, errors: updateErrors } = await bulkUpdateRecords(
    moduleName,
    recordsToUpdate,
  );
  const errors = [...prepareErrors, ...updateErrors];
  const failureCount = errors.length;
  const totalRecords = ids.length;

  return {
    ok: successCount > 0,
    message:
      successCount > 0
        ? `Updated ${successCount} record(s) successfully.`
        : `Update failed. Failures: ${failureCount}`,
    totalRecords,
    successCount,
    failureCount,
    errors,
  };
}
