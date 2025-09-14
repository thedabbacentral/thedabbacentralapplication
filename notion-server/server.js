// notion-server/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Client } from "@notionhq/client";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DB_ID;
const cancellationDbId = process.env.NOTION_CANCELLATION_DB_ID;
const extrasDbId = process.env.NOTION_EXTRAMEAL_DB_ID;

/**
 * Get the primary data source id for a database (v5 style)
 */
async function getPrimaryDataSourceId(dbId) {
  const db = await notion.databases.retrieve({ database_id: dbId });
  if (Array.isArray(db.data_sources) && db.data_sources.length > 0) {
    return db.data_sources[0].id;
  }
  if (db.data_source_id) return db.data_source_id;
  return undefined;
}

/**
 * Extract needed fields from a page/result returned by dataSources.query or pages.retrieve
 */
function extractCustomerFromPage(page, mealType) {
  const props = page.properties || {};

  const tryTitle = (p) =>
    p?.title?.[0]?.plain_text ||
    p?.rich_text?.[0]?.plain_text ||
    p?.plain_text ||
    undefined;

  const name =
    tryTitle(props["Customer Name"]) ||
    tryTitle(props["Customer name"]) ||
    tryTitle(props.Name) ||
    tryTitle(props.Title) ||
    "Unnamed";

  const routeField = mealType === "Lunch" ? "Lunch Route" : "Dinner Route";
  const orderField =
    mealType === "Lunch" ? "Lunch Route Order" : "Dinner Route Order";

  let route = "Unassigned";
  if (props[routeField]?.select) {
    route = props[routeField].select.name ?? route;
  } else if (Array.isArray(props[routeField]?.multi_select)) {
    // defensive
    route = props[routeField].multi_select[0]?.name ?? route;
  }

  const order = props[orderField]?.number ?? 0;

  return {
    id: page.id,
    name,
    route,
    order,
    startDate: props["Start Date"]?.date?.start ?? null,
    endDate:
      props["End Date"]?.date?.end ?? props["End Date"]?.date?.start ?? null,
    mealTypes: (props["Meal Type"]?.multi_select || []).map((m) => m.name),

    // Map links (url property)
    lunchMapLink: props["Lunch Map Link"]?.url ?? null,
    dinnerMapLink: props["Dinner Map Link"]?.url ?? null,

    // phone number property (Notion uses phone_number)
    phoneNumber: props["Phone Number"]?.phone_number ?? null,

    // "Normal/Special" select values
    LunchSpecialNormal: props["Lunch Special - Normal"]?.select?.name ?? null,
    DinnerSpecialNormal: props["Dinner Special - Normal"]?.select?.name ?? null,
  };
}

/* -------------------- CANCELLATIONS -------------------- */
/**
 * Return a Set of strings `${pageId}-${mealType}` representing cancellations for today.
 */
async function fetchTodayCancellations() {
  const dataSourceId = await getPrimaryDataSourceId(cancellationDbId);
  if (!dataSourceId)
    throw new Error("No data source found for cancellation DB");

  const today = new Date().toISOString().split("T")[0];
  const cancelled = new Set();

  let cursor = undefined;
  do {
    const resp = await notion.dataSources.query({
      data_source_id: dataSourceId,
      page_size: 100,
      start_cursor: cursor,
      filter: {
        and: [{ property: "Cancellation Date", date: { equals: today } }],
      },
    });

    (resp.results || []).forEach((page) => {
      const props = page.properties || {};
      const refCustomer =
        props["The Dabba Central Database"]?.relation?.[0]?.id;
      const mealType = props["Meal"]?.select?.name;
      if (refCustomer && mealType) {
        cancelled.add(`${refCustomer}-${mealType}`);
      }
    });

    cursor = resp.next_cursor;
  } while (cursor);

  return cancelled;
}

/* -------------------- EXTRAS -------------------- */
/**
 * Return array [{ id: mainPageId, mealType }]
 */
async function fetchTodayExtras() {
  const dataSourceId = await getPrimaryDataSourceId(extrasDbId);
  if (!dataSourceId) throw new Error("No data source found for extras DB");

  const today = new Date().toISOString().split("T")[0];
  const extras = [];

  let cursor = undefined;
  do {
    const resp = await notion.dataSources.query({
      data_source_id: dataSourceId,
      page_size: 100,
      start_cursor: cursor,
      filter: { and: [{ property: "Date", date: { equals: today } }] },
    });

    (resp.results || []).forEach((page) => {
      const props = page.properties || {};
      const refCustomer =
        props["The Dabba Central Database"]?.relation?.[0]?.id;
      // Some extras use "Meal" or "Meal Type" naming; try both defensively:
      const mealType =
        props["Meal Type"]?.select?.name ?? props["Meal"]?.select?.name;
      if (refCustomer && mealType) {
        extras.push({ id: refCustomer, mealType });
      }
    });

    cursor = resp.next_cursor;
  } while (cursor);

  // debug log
  console.log("✅ Today extras:", extras);
  return extras;
}

/* -------------------- FETCH CUSTOMERS BY MEAL -------------------- */
/**
 * Fetch active + trial customers for given mealType (Lunch / Dinner).
 * Uses dataSources.query on the main DB data source (no databases.query).
 */
async function fetchCustomersByMeal(mealType) {
  const dataSourceId = await getPrimaryDataSourceId(databaseId);
  if (!dataSourceId) throw new Error("No data source found for main DB");

  const today = new Date().toISOString().split("T")[0];
  const allPages = [];
  let cursor = undefined;

  // Active subscriptions filter
  const baseFilter = {
    and: [
      { property: "Start Date", date: { on_or_before: today } },
      { property: "End Date", date: { on_or_after: today } },
      { property: "Meal Type", multi_select: { contains: mealType } },
    ],
  };

  // Trial filter (trial date today + trial meal time equals mealType)
  const trialFilter = {
    and: [
      { property: "Trial Date", date: { equals: today } },
      { property: "Trial Meal Time", select: { equals: mealType } },
    ],
  };

  const filter = { or: [baseFilter, trialFilter] };

  // Paginate over the main DB data source
  do {
    const resp = await notion.dataSources.query({
      data_source_id: dataSourceId,
      page_size: 100,
      start_cursor: cursor,
      filter,
    });
    allPages.push(...(resp.results || []));
    cursor = resp.next_cursor;
  } while (cursor);

  // Build quick lookup map of main pages by id (used for matching extras)
  const pageById = new Map(allPages.map((p) => [p.id, p]));

  // fetch cancellations & extras (these both use their own dataSources)
  const cancelled = await fetchTodayCancellations();
  const extras = await fetchTodayExtras();

  // Map allPages => customers (apply trial override)
  const customers = allPages
    .map((p) => {
      const cust = extractCustomerFromPage(p, mealType);

      // trial override: if trial is today for this meal, set special -> Paneer
      const props = p.properties || {};
      const trialDate = props["Trial Date"]?.date?.start;
      const trialTime = props["Trial Meal Time"]?.select?.name;
      if (trialDate === today && trialTime === mealType) {
        if (mealType === "Lunch") cust.LunchSpecialNormal = "Paneer";
        if (mealType === "Dinner") cust.DinnerSpecialNormal = "Paneer";
      }

      return cust;
    })
    .filter((c) => !cancelled.has(`${c.id}-${mealType}`));

  // For extras: some entries reference main DB page ids that might already be in allPages.
  // If we find the main page in pageById, use that. Otherwise, attempt pages.retrieve as fallback.
  for (const ex of extras) {
    if (ex.mealType !== mealType) continue;
    const mainId = ex.id;
    if (pageById.has(mainId)) {
      const page = pageById.get(mainId);
      const cust = extractCustomerFromPage(page, mealType);
      customers.push(cust);
      console.log(
        `✅ Adding Extra (found in main pages): ${cust.name} ${mealType}`
      );
    } else {
      // fallback: try pages.retrieve (may fail if integration lacks permissions)
      try {
        const page = await notion.pages.retrieve({ page_id: mainId });
        const cust = extractCustomerFromPage(page, mealType);
        customers.push(cust);
        console.log(
          `✅ Adding Extra (via pages.retrieve): ${cust.name} ${mealType}`
        );
      } catch (err) {
        console.error(
          "❌ Failed to fetch extra meal customer:",
          mainId,
          err.message
        );
      }
    }
  }

  // Group by route and sort by order
  const grouped = customers.reduce((acc, c) => {
    const route = c.route || "Unassigned";
    if (!acc[route]) acc[route] = [];
    acc[route].push(c);
    return acc;
  }, {});

  for (const route in grouped) {
    grouped[route].sort((a, b) => a.order - b.order);
  }

  return grouped;
}

/* -------------------- ROUTES -------------------- */
app.get("/customers/lunch", async (req, res) => {
  try {
    const grouped = await fetchCustomersByMeal("Lunch");
    return res.json(grouped);
  } catch (err) {
    console.error("❌ Error in /customers/lunch:", err?.message ?? err);
    return res.status(500).json({
      error: "Failed to fetch lunch customers",
      details: err?.message,
    });
  }
});

app.get("/customers/dinner", async (req, res) => {
  try {
    const grouped = await fetchCustomersByMeal("Dinner");
    return res.json(grouped);
  } catch (err) {
    console.error("❌ Error in /customers/dinner:", err?.message ?? err);
    return res.status(500).json({
      error: "Failed to fetch dinner customers",
      details: err?.message,
    });
  }
});

/* -------------------- START -------------------- */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
