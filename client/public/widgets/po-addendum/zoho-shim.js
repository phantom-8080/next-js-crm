/**
 * Zoho SDK shim for PO Addendum — routes CRM calls to
 * /api/widgets/po-addendum?action=…
 */
(function () {
  const API = "/api/widgets/po-addendum";

  function recordIdFromQuery() {
    const params = new URLSearchParams(window.location.search);
    return (params.get("recordId") || params.get("id") || "").trim();
  }

  function moduleFromQuery() {
    const params = new URLSearchParams(window.location.search);
    return (params.get("module") || "Contracts").trim() || "Contracts";
  }

  function apiUrl(action, extra) {
    var q = "action=" + encodeURIComponent(action);
    if (extra) q += "&" + extra;
    return API + "?" + q;
  }

  async function jsonFetch(url, options) {
    const res = await fetch(url, options);
    const body = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) {
      const err = new Error(body.error || body.message || "HTTP " + res.status);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  }

  var pageLoadHandlers = [];

  window.ZOHO = {
    embeddedApp: {
      on: function (event, handler) {
        if (event === "PageLoad" && typeof handler === "function") {
          pageLoadHandlers.push(handler);
        }
      },
      init: function () {
        var id = recordIdFromQuery();
        var entityData = {
          EntityId: id,
          Entity: moduleFromQuery(),
        };
        pageLoadHandlers.forEach(function (handler) {
          try {
            handler(entityData);
          } catch (err) {
            console.error("[po-addendum shim] PageLoad error", err);
          }
        });
      },
    },
    CRM: {
      API: {
        getRecord: async function (config) {
          var entity = String((config && config.Entity) || "Contracts").trim();
          var recordId = String((config && config.RecordID) || "").trim();
          return jsonFetch(
            apiUrl(
              "record",
              "id=" +
                encodeURIComponent(recordId) +
                "&module=" +
                encodeURIComponent(entity),
            ),
          );
        },
        updateRecord: async function (config) {
          return jsonFetch(apiUrl("save"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              Entity: config && config.Entity,
              APIData: config && config.APIData,
            }),
          });
        },
      },
    },
  };
})();
