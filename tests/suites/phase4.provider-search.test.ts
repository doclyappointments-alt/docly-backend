import { api } from "../helpers/api.js";

console.log("\n▶ Phase 4 — Provider Discovery");

(async () => {
  /* -------------------------------------------------------
   * BASIC RESPONSE SHAPE
   * ----------------------------------------------------- */
  const res = await api("GET", "/provider/search");

  if (!Array.isArray(res.items)) {
    throw new Error("items must be an array");
  }

  if (typeof res.total !== "number") {
    throw new Error("total must be a number");
  }

  /* -------------------------------------------------------
   * PAGINATION CONTRACT
   * ----------------------------------------------------- */
  const paged = await api("GET", "/provider/search?page=1&pageSize=5");

  if (paged.page !== 1) {
    throw new Error("page should be 1");
  }

  if (paged.pageSize !== 5) {
    throw new Error("pageSize should be 5");
  }

  console.log("✅ Phase 4 provider discovery test passed");
})();
