/**
 * Mass Renewal / Renew Contract — port of widget.html + index.js Create SOW flow.
 *
 * For each selected contract:
 * 1) Load contract via Zoho function `getModuleWithIDsAndName`
 * 2) Build a Deals (SOW) record with dates shifted by years of extension
 * 3) Insert Deal, then rename Deal_Name to SOWID when available
 */

import {
  executeZohoCrmFunction,
  fetchZohoJson,
  ZOHO_CRM_BASE,
} from "@/lib/zoho";
import type {
  MassRenewalContractsPayload,
  MassRenewalContractsResult,
  MassRenewalResultItem,
} from "@/widgets/mass-renewal-contracts/types";

type ZohoLookup = { id?: string; name?: string } | string | null | undefined;

function lookupId(value: ZohoLookup): string {
  if (value == null || value === "") return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object" && value.id != null) {
    return String(value.id).trim();
  }
  return "";
}

function textValue(value: unknown) {
  if (value == null) return "";
  return String(value).trim();
}

/** Port of `addYears` from logic/index.js */
export function addYears(dateString: unknown, years: number) {
  if (dateString == null || dateString === "") return "";
  const nYears = Number(years) || 0;
  const datePortion = String(dateString).trim().slice(0, 10);
  const parts = datePortion.split("-");

  if (parts.length === 3) {
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) {
      return `${y + nYears}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  const parsed = new Date(String(dateString));
  if (Number.isNaN(parsed.getTime())) return "";
  parsed.setUTCFullYear(parsed.getUTCFullYear() + nYears);
  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Port of `appendNotes` from logic/index.js */
export function appendNotes(existingNotes: unknown, newNotes: string) {
  const next = (newNotes || "").trim();
  if (!next) return textValue(existingNotes);
  const existing = textValue(existingNotes);
  if (existing) return `${existing}\n\n${next}`;
  return next;
}

function parseFunctionOutput(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

async function fetchContractsByIds(ids: string[]) {
  const { res, body } = await executeZohoCrmFunction(
    "getModuleWithIDsAndName",
    { ids, moduleName: "Contracts" },
    { authType: "apikey" },
  );

  let output = parseFunctionOutput(body?.details?.output);
  let code = String(body?.code ?? "").toUpperCase();

  if (
    !res.ok ||
    code === "NOT_ACTIVE" ||
    code === "AUTHENTICATION_FAILURE" ||
    Object.keys(output).length === 0
  ) {
    const fallback = await executeZohoCrmFunction(
      "getModuleWithIDsAndName",
      { ids, moduleName: "Contracts" },
      { authType: "oauth" },
    );
    output = parseFunctionOutput(fallback.body?.details?.output);
    if (!fallback.res.ok && Object.keys(output).length === 0) {
      const detail =
        fallback.body?.message ||
        body?.message ||
        fallback.body?.code ||
        body?.code ||
        `HTTP ${fallback.res.status}`;
      throw new Error(String(detail));
    }
  }

  return output;
}

function buildScopeOfWork(
  subform: unknown,
  yearsExtension: number,
): Record<string, unknown>[] {
  if (!Array.isArray(subform) || subform.length === 0) return [];

  // Same mapping as index.js (OurServices id + shifted dates).
  return subform.map((item) => {
    const row = (item ?? {}) as Record<string, unknown>;
    const serviceId = lookupId(row.OurServices as ZohoLookup);
    return {
      // REST expects { id }; Zoho widget SDK accepted bare id string.
      OurServices: serviceId ? { id: serviceId } : "",
      Vendor_Price: row.Vendor_Price || "",
      Invoice_Price: row.Invoice_Price || "",
      Start_Date: addYears(row.Start_Date, yearsExtension),
      End_Date: addYears(row.End_Date, yearsExtension),
      Number_of_Services: row.Number_of_Services || "",
      Number_of_Services_Completed: row.Number_of_Services_Completed || "",
    };
  });
}

function buildSowMap(
  contractData: Record<string, unknown>,
  form: {
    clientBidDue: string;
    vendorBidDue: string;
    yearsExtension: number;
    clientAddendum: string;
    vendorAddendum: string;
    internalNotes: string;
  },
) {
  const scopeOfWorkData = buildScopeOfWork(
    contractData.Our_Services_SubForm,
    form.yearsExtension,
  );

  const siteId = lookupId(contractData.Site as ZohoLookup);
  const companyId = lookupId(contractData.Company_Name as ZohoLookup);
  const salesAssociateId = lookupId(
    contractData.Sales_Associate as ZohoLookup,
  );
  const salesManagerId = lookupId(contractData.Sales_Manager as ZohoLookup);
  const opsAssociateId = lookupId(
    contractData.Operations_Associate as ZohoLookup,
  );
  const opsManagerId = lookupId(
    contractData.Operations_Manager as ZohoLookup,
  );

  const clientAddendum = appendNotes(
    contractData.Client_Addendum,
    form.clientAddendum,
  );
  const vendorAddendum = appendNotes(
    contractData.Vendor_Addendum,
    form.vendorAddendum,
  );

  // Field map mirrors index.js sowMap (REST uses { id } for lookups).
  // Also writes enriched rich-text addendum fields; PO fields are intentionally omitted.
  const sowMap: Record<string, unknown> = {
    Deal_Name: "tempRec",
    Pipeline: "Scope of Work",
    Stage: "Sourcing Vendor",
    Contract_Term: "Renewal",
    Trigger_Point: contractData.Trigger_Point || "",
    Snow_Removal_Salt_Area_Inclusions:
      contractData.Snow_Removal_Salt_Area_Inclusions || "",
    Address: contractData.Address_Shipping_Service || "",
    Region_District_Zone: contractData.Region_District_Zone || "",
    Addendum: clientAddendum,
    Vendor_Addendum: vendorAddendum,
    Client_Addendum_Rich: clientAddendum,
    Vendor_Addendum_Rich: vendorAddendum,
    Location_Name: contractData.Location_Name || "",
    Number_of_Managed_Locations: contractData.Number_of_Managed_Locations || "",
    Number_of_Services: contractData.Number_of_Services || "",
    Number_of_Services_Completed:
      contractData.Number_of_Services_Completed || "",
    Number_of_Sites_Being_Bid_Olio:
      contractData.Number_of_Locations_Open_For_Bid_Olio || "",
    Number_of_Locations_Awarded:
      contractData.Number_of_Locations_Awarded || "",
    Scope_of_Work: scopeOfWorkData,
    Client_Bid_Due_Date: form.clientBidDue || "",
    Vendor_Bid_Due_Date: form.vendorBidDue || "",
    Internal_Notes_for_Olio_Team: appendNotes(
      contractData.Progress_Notes_1,
      form.internalNotes,
    ),
    Salt_Billing_Frequency_and_Type:
      contractData.Salt_Billing_Frequency_and_Type || "",
    Category: contractData.Category || "",
    Site_Open_Up_Time: contractData.Site_Open_Time || "",
    Start_Date: addYears(contractData.Contract_Start_Date, form.yearsExtension),
    End_Date: addYears(contractData.Contract_End_Date, form.yearsExtension),
  };

  // index.js: Company_Name ← Site, Account_Name ← Company_Name
  if (siteId) sowMap.Company_Name = { id: siteId };
  if (companyId) sowMap.Account_Name = { id: companyId };

  // index.js sales / ops mappings
  if (salesAssociateId) sowMap.Sales_Associate_New = { id: salesAssociateId };
  if (salesManagerId) sowMap.Sales_Owner = { id: salesManagerId };
  if (opsAssociateId) {
    sowMap.Operations_Associate_New = { id: opsAssociateId };
  }
  if (opsManagerId) sowMap.Ops_Owner = { id: opsManagerId };

  return sowMap;
}

const LOOKUP_FILTER_DROP_ORDER = [
  "Sales_Owner",
  "Ops_Owner",
  "Sales_Associate_New",
  "Operations_Associate_New",
  "Account_Name",
  "Company_Name",
] as const;

function isLookupFilterError(code: string, message: string) {
  return (
    code === "FILTER_CRITERIA_NOT_SATISFIED" ||
    /lookup filter criteria/i.test(message)
  );
}

async function createDeal(sowMap: Record<string, unknown>) {
  const payload = { ...sowMap };
  let lastMessage = "Failed to create SOW";

  for (let attempt = 0; attempt < LOOKUP_FILTER_DROP_ORDER.length + 1; attempt += 1) {
    const { res, body } = await fetchZohoJson(`${ZOHO_CRM_BASE}/Deals`, {
      method: "POST",
      body: { data: [payload], trigger: ["workflow"] },
    });
    const row = Array.isArray(body?.data) ? body.data[0] : null;
    const code = String(row?.code ?? body?.code ?? "").toUpperCase();
    const message = String(
      row?.message || body?.message || code || `HTTP ${res.status}`,
    );
    lastMessage = message;

    const createdId =
      row?.details?.id != null ? String(row.details.id)
      : row?.id != null ? String(row.id)
      : "";

    if (res.ok && code === "SUCCESS" && createdId) {
      return { ok: true, id: createdId, message };
    }

    if (!isLookupFilterError(code, message)) {
      return { ok: false, id: "", message };
    }

    // Drop the reported field, or the next known filtered lookup.
    const apiName = String(row?.details?.api_name ?? body?.details?.api_name ?? "").trim();
    const dropKey =
      apiName && apiName in payload
        ? apiName
        : LOOKUP_FILTER_DROP_ORDER.find((key) => key in payload);

    if (!dropKey) {
      return { ok: false, id: "", message };
    }
    delete payload[dropKey];
  }

  return { ok: false, id: "", message: lastMessage };
}

async function renameDealToSowId(dealId: string) {
  const { res, body } = await fetchZohoJson(
    `${ZOHO_CRM_BASE}/Deals/${encodeURIComponent(dealId)}?fields=${encodeURIComponent("SOWID,Deal_Name")}`,
  );
  if (!res.ok) return;
  const row = Array.isArray(body?.data) ? body.data[0] : null;
  const sowId = textValue(row?.SOWID);
  if (!sowId) return;

  await fetchZohoJson(`${ZOHO_CRM_BASE}/Deals`, {
    method: "PUT",
    body: {
      data: [{ id: dealId, Deal_Name: sowId }],
      trigger: ["workflow"],
    },
  });
}

/**
 * Creates renewal SOW (Deals) records for selected contracts.
 */
export async function createMassRenewalSows(
  payload: MassRenewalContractsPayload,
): Promise<MassRenewalContractsResult> {
  const ids = [...new Set((payload.selectedRecordIds ?? []).map(String))]
    .map((id) => id.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return { ok: false, message: "Select at least one contract." };
  }

  const clientBidDue = String(payload.clientBidDue ?? "").trim();
  const vendorBidDue = String(payload.vendorBidDue ?? "").trim();
  if (!clientBidDue || !vendorBidDue) {
    return {
      ok: false,
      message: "Please provide both Client and Vendor Bid Due Dates",
    };
  }

  const yearsExtension = Number(payload.yearsOfExtension) || 1;
  const clientAddendum = String(payload.clientAddendum ?? "").trim();
  const vendorAddendum = String(payload.vendorAddendum ?? "").trim();
  const internalNotes = String(payload.internalNotes ?? "").trim();

  const results: MassRenewalResultItem[] = [];
  let successCount = 0;

  for (const id of ids) {
    try {
      const data = await fetchContractsByIds([id]);
      const entry = data[id] as Record<string, unknown> | undefined;

      if (
        entry &&
        String(entry.status ?? "").toLowerCase() === "failure"
      ) {
        results.push({
          status: "error",
          msg: `SOW creation failed: Contract ${id} not found.`,
        });
        continue;
      }

      const contracts = Object.entries(data).filter(([key, value]) => {
        if (key === "status") return false;
        if (!value || typeof value !== "object") return false;
        const row = value as Record<string, unknown>;
        return String(row.status ?? "").toLowerCase() !== "failure";
      });

      if (contracts.length === 0) {
        results.push({
          status: "error",
          msg: `SOW creation failed: Contract ${id} not found.`,
        });
        continue;
      }

      for (const [, contractRaw] of contracts) {
        const contractData = contractRaw as Record<string, unknown>;
        const contractId = textValue(contractData.id) || id;
        const sowMap = buildSowMap(contractData, {
          clientBidDue,
          vendorBidDue,
          yearsExtension,
          clientAddendum,
          vendorAddendum,
          internalNotes,
        });

        const created = await createDeal(sowMap);
        if (created.ok && created.id) {
          try {
            await renameDealToSowId(created.id);
          } catch {
            // Same as logic.js — SOWID rename is best-effort.
          }
          successCount += 1;
          results.push({
            status: "success",
            msg: `SOW created successfully for Contract ${contractId} → SOW ID: ${created.id}`,
          });
        } else {
          results.push({
            status: "error",
            msg: `Failed to create SOW for Contract ${contractId}${created.message ? `: ${created.message}` : ""}`,
          });
        }
      }
    } catch (error) {
      results.push({
        status: "error",
        msg: `Error processing Contract ${id}${
          error instanceof Error ? `: ${error.message}` : ""
        }`,
      });
    }
  }

  return {
    ok: successCount > 0,
    message:
      successCount > 0
        ? "Processing complete. Review results below."
        : "No SOWs were created. Review results below.",
    results,
    successCount,
    errorCount: results.length - successCount,
  };
}
