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
// -------------------- Helpers -------------------- //
async function getPrimaryDataSourceId(dbId) {
  const db = await notion.databases.retrieve({ database_id: dbId });
  if (Array.isArray(db.data_sources) && db.data_sources.length > 0) {
    return db.data_sources[0].id;
  }
  if (db.data_source_id) return db.data_source_id;
  return undefined;
}

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

    lunchMapLink: props["Lunch Map Link"]?.url ?? null,
    dinnerMapLink: props["Dinner Map Link"]?.url ?? null,
    phoneNumber: props["Phone Number"]?.phone_number ?? null,
    LunchSpecialNormal: props["Lunch Special - Normal"]?.select?.name ?? null,
    DinnerSpecialNormal: props["Dinner Special - Normal"]?.select?.name ?? null,
  };
}

// -------------------- NEW: Fetch cancellations -------------------- //
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
      filter: {
        and: [{ property: "Cancellation Date", date: { equals: today } }],
      },
      page_size: 100,
      start_cursor: cursor,
    });

    (resp.results || []).forEach((page) => {
      const props = page.properties || {};
      const refCustomer =
        props["The Dabba Central Database"]?.relation?.[0]?.id; // reference to main DB
      const mealType = props["Meal"]?.select?.name; // Lunch / Dinner
      if (refCustomer && mealType) {
        cancelled.add(`${refCustomer}-${mealType}`);
      }
    });

    cursor = resp.next_cursor;
  } while (cursor);

  return cancelled;
}
// -------------------- Fetch extras -------------------- //
async function fetchTodayExtras() {
  const dataSourceId = await getPrimaryDataSourceId(extrasDbId);
  if (!dataSourceId) throw new Error("No data source found for extras DB");

  const today = new Date().toISOString().split("T")[0];
  const extras = [];

  let cursor = undefined;
  do {
    const resp = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: { and: [{ property: "Date", date: { equals: today } }] },
      page_size: 100,
      start_cursor: cursor,
    });

    (resp.results || []).forEach((page) => {
      const props = page.properties || {};
      const refCustomer =
        props["The Dabba Central Database"]?.relation?.[0]?.id;
      const mealType = props["Meal Type"]?.select?.name;
      if (refCustomer && mealType) {
        extras.push({ id: refCustomer, mealType });
      }
    });

    cursor = resp.next_cursor;
  } while (cursor);
  console.log(extras);
  return extras;
}
// -------------------- Fetch Customers -------------------- //
async function fetchCustomersByMeal(mealType) {
  const dataSourceId = await getPrimaryDataSourceId(databaseId);
  if (!dataSourceId) throw new Error("No data source found for main DB");

  const today = new Date().toISOString().split("T")[0];
  const allPages = [];
  let cursor = undefined;

  // Regular filter (active subscriptions)
  const baseFilter = {
    and: [
      { property: "Start Date", date: { on_or_before: today } },
      { property: "End Date", date: { on_or_after: today } },
      { property: "Meal Type", multi_select: { contains: mealType } },
    ],
  };

  // Trial filter (Trial Meal Date = today & Trial Meal Time = mealType)
  const trialFilter = {
    and: [
      { property: "Trial Date", date: { equals: today } },
      { property: "Trial Meal Time", select: { equals: mealType } },
    ],
  };

  const filter = { or: [baseFilter, trialFilter] };

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

  // fetch today's cancellations
  const cancelled = await fetchTodayCancellations();
  const extras = await fetchTodayExtras();
  // build list excluding cancelled
  // build list excluding cancelled
  const customers = allPages
    .map((p) => {
      const cust = extractCustomerFromPage(p, mealType);

      // 🔽 Trial override
      const props = p.properties || {};
      const trialDate = props["Trial Date"]?.date?.start;
      const trialTime = props["Trial Meal Time"]?.select?.name;

      if (trialDate === today && trialTime === mealType) {
        if (mealType === "Lunch") {
          cust.LunchSpecialNormal = "Paneer";
        }
        if (mealType === "Dinner") {
          cust.DinnerSpecialNormal = "Paneer";
        }
      }

      return cust;
    })
    .filter((c) => !cancelled.has(`${c.id}-${mealType}`));

  const extraCustomers = await Promise.all(
    extras
      .filter((ex) => ex.mealType === mealType)
      .map(async (ex) => {
        try {
          const page = await notion.pages.retrieve({ page_id: ex.id });
          return extractCustomerFromPage(page, mealType);
        } catch (err) {
          console.error(
            "❌ Failed to fetch extra meal customer:",
            ex.id,
            err.message
          );
          return null;
        }
      })
  );

  // ✅ Add valid extras
  customers.push(...extraCustomers.filter(Boolean));

  // group + sort
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

// -------------------- Routes -------------------- //
app.get("/customers/lunch", async (req, res) => {
  try {
    const grouped = await fetchCustomersByMeal("Lunch");
    return res.json(grouped);
  } catch (err) {
    console.error("❌ Error in /customers/lunch:", err.message);
    return res.status(500).json({ error: "Failed to fetch lunch customers" });
  }
});

app.get("/customers/dinner", async (req, res) => {
  try {
    const grouped = await fetchCustomersByMeal("Dinner");
    return res.json(grouped);
  } catch (err) {
    console.error("❌ Error in /customers/dinner:", err.message);
    return res.status(500).json({ error: "Failed to fetch dinner customers" });
  }
});

// -------------------- Start server -------------------- //
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

app.post("/customers/publish", (req, res) => {
  console.log("📌 Received Publish Data:");
  console.dir(req.body, { depth: null }); // pretty print full object

  res.json({ success: true, message: "Data received successfully" });
});
