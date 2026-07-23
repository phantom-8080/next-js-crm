/**
 * Port of Zoho widget widget.html + index.js (“Client Sending RFP”).
 * Load contract → transition to Sourcing → save site fields → maybe Pending Sales Review if Bids exist.
 */

import {
  escapeZohoCriteriaValue,
  fetchZohoJson,
  fetchZohoRecordById,
  getZohoModuleSearchUrl,
  ZOHO_CRM_BASE,
} from "@/lib/zoho";
import type {
  ClientSendingRfpLoadResult,
  ClientSendingRfpSavePayload,
  ClientSendingRfpSaveResult,
  ClientSendingRfpSearchResult,
  ClientSendingRfpSiteDetailsResult,
  ClientSendingRfpSiteSuggestion,
} from "@/widgets/client-sending-rfp/types";
import {
  STATUS_PENDING_SALES_REVIEW,
  STATUS_SOURCING_VENDOR,
} from "@/widgets/client-sending-rfp/types";

type ZohoLookup = { id?: string; name?: string } | string | null | undefined;

function asText(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function lookupId(value: ZohoLookup): string {
  if (value == null || value === "") return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object" && value.id != null) {
    return String(value.id).trim();
  }
  return "";
}

function lookupName(value: ZohoLookup): string {
  if (value == null || value === "") return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object" && value.name != null) {
    return String(value.name).trim();
  }
  return "";
}

export async function loadClientSendingRfp(
  contractId: string,
): Promise<ClientSendingRfpLoadResult> {
  const id = contractId.trim();
  if (!id) {
    return { ok: false, message: "Contract id is required." };
  }

  const record = await fetchZohoRecordById("Contracts", id, [
    "Name",
    "Contract_Status",
    "Site",
    "Site_Street",
    "Site_City",
    "Site_State",
    "Site_Zip",
  ]);

  const site = record.Site as ZohoLookup;

  return {
    ok: true,
    contractId: id,
    contractName: asText(record.Name) || id,
    currentStatus: asText(record.Contract_Status) || "Unknown",
    siteId: lookupId(site),
    siteName: lookupName(site),
    siteStreet: asText(record.Site_Street),
    siteCity: asText(record.Site_City),
    siteState: asText(record.Site_State),
    siteZip: asText(record.Site_Zip),
  };
}

/**
 * Site suggestions — mirrors widget search on Contracts `Site:starts_with`,
 * with Accounts Account_Name fallback for better coverage.
 */
export async function searchSitesForClientSendingRfp(
  query: string,
): Promise<ClientSendingRfpSearchResult> {
  const q = String(query ?? "").trim();
  if (q.length < 1) {
    return { ok: true, sites: [] };
  }

  const byId = new Map<string, ClientSendingRfpSiteSuggestion>();

  const contractCriteria = `(Site:starts_with:${escapeZohoCriteriaValue(q)})`;
  const contractUrl = getZohoModuleSearchUrl("Contracts", {
    criteria: contractCriteria,
    fields: "Site",
    perPage: 25,
  });
  const contractSearch = await fetchZohoJson(contractUrl);
  if (
    contractSearch.res.ok &&
    Array.isArray(contractSearch.body?.data)
  ) {
    for (const row of contractSearch.body.data) {
      const site = row?.Site as ZohoLookup;
      const id = lookupId(site);
      const name = lookupName(site);
      if (id && name && !byId.has(id)) {
        byId.set(id, { id, name });
      }
    }
  } else if (
    contractSearch.res.status !== 204 &&
    contractSearch.body?.code !== "NO_DATA" &&
    !contractSearch.res.ok
  ) {
    // Continue to Accounts fallback; only fail hard if both fail.
  }

  if (byId.size === 0) {
    const accountCriteria = `(Account_Name:starts_with:${escapeZohoCriteriaValue(q)})`;
    const accountUrl = getZohoModuleSearchUrl("Accounts", {
      criteria: accountCriteria,
      fields: "Account_Name",
      perPage: 25,
    });
    const accountSearch = await fetchZohoJson(accountUrl);
    if (accountSearch.res.ok && Array.isArray(accountSearch.body?.data)) {
      for (const row of accountSearch.body.data) {
        const id = asText(row?.id);
        const name = asText(row?.Account_Name);
        if (id && name && !byId.has(id)) {
          byId.set(id, { id, name });
        }
      }
    } else if (
      accountSearch.res.status !== 204 &&
      accountSearch.body?.code !== "NO_DATA" &&
      !accountSearch.res.ok &&
      byId.size === 0
    ) {
      const detail =
        accountSearch.body?.message ||
        accountSearch.body?.code ||
        `HTTP ${accountSearch.res.status}`;
      return { ok: false, message: String(detail), sites: [] };
    }
  }

  return { ok: true, sites: [...byId.values()] };
}

export async function loadSiteDetailsForClientSendingRfp(
  siteId: string,
): Promise<ClientSendingRfpSiteDetailsResult> {
  const id = siteId.trim();
  if (!id) {
    return { ok: false, message: "Site id is required." };
  }

  try {
    const site = await fetchZohoRecordById("Accounts", id, [
      "Shipping_Street",
      "Shipping_Street_2",
      "Shipping_City",
      "Shipping_State",
      "Shipping_Code",
    ]);

    return {
      ok: true,
      siteStreet:
        asText(site.Shipping_Street) || asText(site.Shipping_Street_2),
      siteCity: asText(site.Shipping_City),
      siteState: asText(site.Shipping_State),
      siteZip: asText(site.Shipping_Code),
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Error fetching site details",
    };
  }
}

async function updateContract(
  data: Record<string, unknown>,
): Promise<{ ok: boolean; message: string }> {
  const { res, body } = await fetchZohoJson(`${ZOHO_CRM_BASE}/Contracts`, {
    method: "PUT",
    body: { data: [data] },
  });

  const row = Array.isArray(body?.data) ? body.data[0] : null;
  const code = String(row?.code ?? body?.code ?? "").toUpperCase();
  const message = String(
    row?.message || body?.message || code || `HTTP ${res.status}`,
  );

  if (res.ok && code === "SUCCESS") {
    return { ok: true, message };
  }
  return { ok: false, message };
}

async function contractHasBids(contractId: string): Promise<boolean> {
  const url =
    `${ZOHO_CRM_BASE}/Contracts/${encodeURIComponent(contractId)}/Bids` +
    `?fields=${encodeURIComponent("id")}&per_page=1`;
  const { res, body } = await fetchZohoJson(url);

  if (res.status === 204 || body?.code === "NO_DATA") {
    return false;
  }
  if (!res.ok) {
    // Related list may be named differently — treat as no bids rather than blocking save.
    console.warn("[client-sending-rfp] Bids related list:", body);
    return false;
  }
  return Array.isArray(body?.data) && body.data.length > 0;
}

export async function saveClientSendingRfp(
  payload: ClientSendingRfpSavePayload,
): Promise<ClientSendingRfpSaveResult> {
  const contractId = payload.contractId.trim();
  const siteId = payload.siteId.trim();

  if (!contractId) {
    return { ok: false, message: "Contract id is required." };
  }
  if (!siteId) {
    return {
      ok: false,
      message: "Please select a valid site from suggestions.",
    };
  }

  const firstUpdate = await updateContract({
    id: contractId,
    Contract_Status: STATUS_SOURCING_VENDOR,
    Site: { id: siteId },
    Site_Street: payload.siteStreet.trim(),
    Site_City: payload.siteCity.trim(),
    Site_State: payload.siteState.trim(),
    Site_Zip: payload.siteZip.trim(),
  });

  if (!firstUpdate.ok) {
    return { ok: false, message: firstUpdate.message || "Update failed" };
  }

  const hadBids = await contractHasBids(contractId);

  if (hadBids) {
    const pendingUpdate = await updateContract({
      id: contractId,
      Contract_Status: STATUS_PENDING_SALES_REVIEW,
    });

    if (!pendingUpdate.ok) {
      return {
        ok: true,
        hadBids: true,
        finalStatus: STATUS_SOURCING_VENDOR,
        message:
          "Fields saved, but failed to set Pending Sales Review after detecting Bids.",
      };
    }

    return {
      ok: true,
      hadBids: true,
      finalStatus: STATUS_PENDING_SALES_REVIEW,
      message:
        "Contract Status updated to Pending Sales Review as Bid is attached",
    };
  }

  return {
    ok: true,
    hadBids: false,
    finalStatus: STATUS_SOURCING_VENDOR,
    message: "Fields saved successfully!",
  };
}
