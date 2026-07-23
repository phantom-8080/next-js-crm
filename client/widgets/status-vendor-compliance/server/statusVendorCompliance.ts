/**
 * Port of Zoho widget widget.html + index.js (“Vendor Compliance Review”).
 * Activate Vendor → save vendor compliance → set Contract_Status to Active.
 */

import { fetchZohoJson, fetchZohoRecordById, ZOHO_CRM_BASE } from "@/lib/zoho";
import {
  toInputDate,
  toZohoDate,
} from "@/widgets/compliance-fields/server/complianceFields";
import type {
  StatusVendorComplianceLoadResult,
  StatusVendorComplianceSavePayload,
  StatusVendorComplianceSaveResult,
  VendorComplianceForm,
} from "@/widgets/status-vendor-compliance/types";
import { STATUS_ACTIVE } from "@/widgets/status-vendor-compliance/types";

type ZohoLookup = { id?: string; name?: string } | string | null | undefined;

const VENDOR_FIELDS = [
  "Vendor_Name",
  "W9_URL",
  "COI_Expiration",
  "Workers_Compensation",
  "CF_Legal_Name_Must_Be_Same_As_W9",
  "Bank_ACH",
] as const;

const EMPTY_FIELDS: VendorComplianceForm = {
  w9Url: "",
  coiExpiration: "",
  workersComp: "",
  legalName: "",
  bankAch: "",
};

function asText(value: unknown): string {
  if (value == null || value === "") return "";
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

function isCoiExpired(coiExpiration: string): boolean {
  const raw = coiExpiration.trim();
  if (!raw) return true;
  const coiDate = new Date(raw);
  if (Number.isNaN(coiDate.getTime())) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  coiDate.setHours(0, 0, 0, 0);
  return coiDate.getTime() <= today.getTime();
}

export async function loadStatusVendorCompliance(
  contractId: string,
): Promise<StatusVendorComplianceLoadResult> {
  const id = contractId.trim();
  if (!id) {
    return { ok: false, message: "Contract id is required." };
  }

  const contract = await fetchZohoRecordById("Contracts", id, [
    "Name",
    "Contract_Status",
    "Vendor",
    "Vendor_Name",
  ]);

  const vendorLookup = (contract.Vendor ?? contract.Vendor_Name) as ZohoLookup;
  const vendorId = lookupId(vendorLookup);
  const vendorName = lookupName(vendorLookup);

  let fields: VendorComplianceForm = { ...EMPTY_FIELDS };

  if (vendorId) {
    try {
      const vendor = await fetchZohoRecordById("Vendors", vendorId, [
        ...VENDOR_FIELDS,
      ]);
      fields = {
        w9Url: asText(vendor.W9_URL),
        coiExpiration: toInputDate(vendor.COI_Expiration),
        workersComp: asText(vendor.Workers_Compensation),
        legalName: asText(vendor.CF_Legal_Name_Must_Be_Same_As_W9),
        bankAch: asText(vendor.Bank_ACH),
      };
    } catch (error) {
      console.error("[status-vendor-compliance] vendor fetch:", error);
    }
  }

  return {
    ok: true,
    contractId: id,
    contractName: asText(contract.Name) || id,
    currentStatus: asText(contract.Contract_Status) || "Unknown",
    vendorId: vendorId || undefined,
    vendorName: vendorName || undefined,
    vendorExists: Boolean(vendorId),
    fields,
  };
}

export async function saveStatusVendorCompliance(
  payload: StatusVendorComplianceSavePayload,
): Promise<StatusVendorComplianceSaveResult> {
  const contractId = payload.contractId.trim();
  const vendorId = payload.vendorId.trim();
  const fields = payload.fields ?? EMPTY_FIELDS;

  if (!contractId) {
    return { ok: false, message: "Contract id is required." };
  }
  if (!vendorId) {
    return {
      ok: false,
      message: "Vendor field is empty. Cannot save compliance.",
    };
  }

  const w9Url = fields.w9Url.trim();
  const coiExpiration = fields.coiExpiration.trim();
  const workersComp = fields.workersComp.trim();
  const legalName = fields.legalName.trim();
  const bankAch = fields.bankAch.trim();

  if (!w9Url || !coiExpiration || !workersComp || !legalName) {
    return { ok: false, message: "Please fill all mandatory fields." };
  }

  if (isCoiExpired(coiExpiration)) {
    return {
      ok: false,
      message:
        "Certificate of Insurance has expired. Please update before proceeding",
    };
  }

  const vendorUpdate = await fetchZohoJson(`${ZOHO_CRM_BASE}/Vendors`, {
    method: "PUT",
    body: {
      data: [
        {
          id: vendorId,
          W9_URL: w9Url,
          COI_Expiration: toZohoDate(coiExpiration),
          Workers_Compensation: workersComp,
          CF_Legal_Name_Must_Be_Same_As_W9: legalName,
          Bank_ACH: bankAch,
        },
      ],
      trigger: ["workflow"],
    },
  });

  const vendorRow = Array.isArray(vendorUpdate.body?.data)
    ? vendorUpdate.body.data[0]
    : null;
  const vendorCode = String(
    vendorRow?.code ?? vendorUpdate.body?.code ?? "",
  ).toUpperCase();
  const vendorOk =
    Boolean(vendorUpdate.res.ok) &&
    (vendorCode === "SUCCESS" ||
      Boolean(vendorRow?.details?.id) ||
      vendorCode === "");

  if (!vendorOk) {
    return {
      ok: false,
      message: String(
        vendorRow?.message ||
          vendorUpdate.body?.message ||
          "Failed to update Vendor record",
      ),
    };
  }

  const contractUpdate = await fetchZohoJson(`${ZOHO_CRM_BASE}/Contracts`, {
    method: "PUT",
    body: {
      data: [
        {
          id: contractId,
          Contract_Status: STATUS_ACTIVE,
        },
      ],
      trigger: ["workflow"],
    },
  });

  const contractRow = Array.isArray(contractUpdate.body?.data)
    ? contractUpdate.body.data[0]
    : null;
  const contractCode = String(
    contractRow?.code ?? contractUpdate.body?.code ?? "",
  ).toUpperCase();
  const contractOk =
    Boolean(contractUpdate.res.ok) && contractCode === "SUCCESS";

  if (!contractOk) {
    return {
      ok: false,
      message: String(
        contractRow?.message ||
          contractUpdate.body?.message ||
          "Failed to update contract status",
      ),
    };
  }

  return {
    ok: true,
    finalStatus: STATUS_ACTIVE,
    message: `Contract Status updated to: ${STATUS_ACTIVE}`,
  };
}
