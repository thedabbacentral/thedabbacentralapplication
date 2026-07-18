// notion-server/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Client } from "@notionhq/client";

dotenv.config();
const app = express();
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://thedabbacentralapplication.vercel.app",
      "https://thedabbacentralapplication-nx9b.vercel.app",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);
app.use(express.json());

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.MAIN_DATABASE_ID;
const cancellationDbId = process.env.CANCELLATION_DB_ID;
const extrasDbId = process.env.EXTRA_MEAL_DB_ID;
const dailyCustomizationDbId = process.env.NOTION_DAILY_CUSTOMIZATION_DB_ID;
const locationChangeDbId = process.env.LOCATION_CHANGE_DB_ID;
const templateDbId = process.env.TEMPLATE_DB_ID;

async function fetchTodayFixedCancellations(mealType) {
  console.log("🔥 fetchTodayFixedCancellations called");

  const dataSourceId = await getPrimaryDataSourceId(templateDbId);

  if (!dataSourceId) {
    throw new Error("No data source found for Template DB");
  }

  const todayDay = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "Asia/Kolkata",
  });

  const response = await notion.dataSources.query({
    data_source_id: dataSourceId,
    filter: {
      and: [
        {
          property: "Day",
          select: {
            equals: todayDay,
          },
        },
        {
          property: "Meal",
          select: {
            equals: mealType,
          },
        },
        {
          property: "Type",
          select: {
            equals: "Cancellation",
          },
        },
      ],
    },
  });

  const customers = [];

  for (const page of response.results) {
    const props = page.properties;

    const customerId = props["Customer"]?.relation?.[0]?.id;

    if (!customerId) continue;

    customers.push(customerId);
  }

  console.log("Today's Fixed Cancellation Customers:", customers);

  return customers;
}

async function applyFixedCancellations(mealType) {
  const appliedCustomers = [];
  const duplicateCustomers = [];
  const inactiveCustomers = [];
  console.log("🚀 Applying Fixed Cancellations");

  const customerIds = await fetchTodayFixedCancellations(mealType);

  // Existing cancellations for today
  const cancelledToday = await fetchTodayCancellations();

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });

  let applied = 0;
  let skippedDuplicate = 0;
  let skippedInactive = 0;

  for (const customerId of customerIds) {
    const customer = await notion.pages.retrieve({
      page_id: customerId,
    });

    const props = customer.properties;

    const customerName =
      props["Customer Name"]?.title?.[0]?.plain_text ??
      props["Customer Name"]?.rich_text?.[0]?.plain_text ??
      "Unknown";

    // Skip duplicate
    if (cancelledToday.has(`${customerId}-${mealType}`)) {
      skippedDuplicate++;
      duplicateCustomers.push(customerName);
      continue;
    }

    const startDate = props["Start Date"]?.date?.start;
    const endDate = props["End Date"]?.date?.start;

    const mealTypes = (props["Meal Type"]?.multi_select || []).map(
      (m) => m.name,
    );

    const active =
      startDate <= today && endDate >= today && mealTypes.includes(mealType);

    if (!active) {
      skippedInactive++;
      inactiveCustomers.push(customerName);
      continue;
    }

    await notion.pages.create({
      parent: {
        database_id: cancellationDbId,
      },
      properties: {
        "The Dabba Central Database": {
          relation: [
            {
              id: customerId,
            },
          ],
        },

        Meal: {
          select: {
            name: mealType,
          },
        },

        "Cancellation Date": {
          date: {
            start: today,
          },
        },
      },
    });

    applied++;
    appliedCustomers.push(customerName);

    console.log("✅ Cancellation Created");
  }

  return {
    applied,
    skippedDuplicate,
    skippedInactive,
    appliedCustomers,
    duplicateCustomers,
    inactiveCustomers,
  };
}

app.get("/test-apply-cancellations", async (req, res) => {
  const result = await applyFixedCancellations("Lunch");
  res.json(result);
});

app.get("/test-fixed-cancellations", async (req, res) => {
  try {
    const data = await fetchTodayFixedCancellations("Lunch");
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json(err.message);
  }
});

app.post("/templates/apply-cancellations", async (req, res) => {
  try {
    const mealMap = {
      lunch: "Lunch",
      dinner: "Dinner",
    };

    const meal = mealMap[req.body.meal?.toLowerCase()];

    if (!meal) {
      return res.status(400).json({
        error: "Invalid meal",
      });
    }

    const result = await applyFixedCancellations(meal);

    return res.json(result);
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: err.message,
    });
  }
});

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

    customisationLunch: tryTitle(props["Customisation Lunch"]) ?? null,
    customisationDinner: tryTitle(props["Customisation Dinner"]) ?? null,

    lunchServeOrder: props["Lunch Serve Order"]?.number ?? 0,
    dinnerServeOrder: props["Dinner Serve Order"]?.number ?? 0,
    poster: props["Poster"]?.checkbox ?? false,

    foodPreference: props["Veg/Non-Veg"]?.select?.name ?? null,
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

async function fetchTodayCustomizationChanges() {
  console.log("🔥 fetchTodayCustomizationChanges called");
  const dataSourceId = await getPrimaryDataSourceId(dailyCustomizationDbId);

  if (!dataSourceId) {
    throw new Error("No data source found for Daily Customization DB");
  }

  const today = new Date().toISOString().split("T")[0];

  const changes = [];

  let cursor = undefined;

  do {
    const resp = await notion.dataSources.query({
      data_source_id: dataSourceId,
      page_size: 100,
      start_cursor: cursor,
      filter: {
        and: [
          {
            property: "Date",
            date: {
              equals: today,
            },
          },
        ],
      },
    });

    (resp.results || []).forEach((page) => {
      const props = page.properties || {};

      const customerId = props["The Dabba Central Database"]?.relation?.[0]?.id;

      const meal = props["Select"]?.select?.name;

      const customisation =
        props["Changed Customization"]?.rich_text?.[0]?.plain_text ??
        props["Changed Customization"]?.title?.[0]?.plain_text ??
        "";

      if (customerId && meal && customisation) {
        changes.push({
          customerId,
          meal,
          customisation,
        });
      }
    });

    cursor = resp.next_cursor;
  } while (cursor);

  console.log("Today's Customisation Changes:", changes);

  return changes;
}

async function fetchTodayLocationChanges() {
  console.log("🔥 fetchTodayLocationChanges called");
  const dataSourceId = await getPrimaryDataSourceId(locationChangeDbId);

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });

  const response = await notion.dataSources.query({
    data_source_id: dataSourceId,
    filter: {
      property: "Date",
      date: {
        equals: today,
      },
    },
  });

  const changes = [];

  for (const page of response.results) {
    const props = page.properties;

    const customerId = props["Customer"]?.relation?.[0]?.id;
    const meal = props["Meal Type"]?.select?.name;
    const mapLink = props["Changed Location Link"]?.url || "";

    if (!customerId || !meal) continue;

    changes.push({
      customerId,
      meal,
      mapLink,
    });
  }

  console.log("Today's Location Changes:", changes);

  return changes;
}

/* -------------------- FETCH CUSTOMERS BY MEAL -------------------- */
/**
 * Fetch active + trial customers for given mealType (Lunch / Dinner).
 * Uses dataSources.query on the main DB data source (no databases.query).
 */
async function fetchCustomersByMeal(mealType, listtype) {
  console.log("🚀 fetchCustomersByMeal", mealType, listtype);
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
  const customizationChanges = await fetchTodayCustomizationChanges();
  const locationChanges = await fetchTodayLocationChanges();

  const customizationMap = new Map();

  customizationChanges.forEach((change) => {
    customizationMap.set(
      `${change.customerId}-${change.meal}`,
      change.customisation,
    );
  });

  const locationMap = new Map();

  locationChanges.forEach((change) => {
    locationMap.set(`${change.customerId}-${change.meal}`, change.mapLink);
  });

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

      const dailyCustomization = customizationMap.get(`${cust.id}-${mealType}`);

      if (dailyCustomization) {
        if (mealType === "Lunch") {
          cust.customisationLunch = dailyCustomization;
        } else {
          cust.customisationDinner = dailyCustomization;
        }

        cust.dailyCustomization = true;
      }

      // console.log({
      //   name: cust.name,
      //   id: cust.id,
      //   lunch: cust.customisationLunch,
      //   dinner: cust.customisationDinner,
      //   daily: cust.dailyCustomization,
      // });

      const changedLocation = locationMap.get(`${cust.id}-${mealType}`);

      console.log({
        customer: cust.name,
        key: `${cust.id}-${mealType}`,
        changedLocation,
      });

      if (changedLocation) {
        cust.locationChanged = true;
        cust.changedMapLink = changedLocation;
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
      cust.route = "Unassigned";
      customers.push(cust);
      console.log(
        `✅ Adding Extra (found in main pages): ${cust.name} ${mealType}`,
      );
    } else {
      // fallback: try pages.retrieve (may fail if integration lacks permissions)
      try {
        const page = await notion.pages.retrieve({ page_id: mainId });
        const cust = extractCustomerFromPage(page, mealType);
        cust.route = "Unassigned";
        customers.push(cust);
        console.log(
          `✅ Adding Extra (via pages.retrieve): ${cust.name} ${mealType}`,
        );
      } catch (err) {
        console.error(
          "❌ Failed to fetch extra meal customer:",
          mainId,
          err.message,
        );
      }
    }
  }

  if (listtype === "serve") {
    return customers;
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

async function fetchAllCustomersByMeal(mealType, listtype) {
  const dataSourceId = await getPrimaryDataSourceId(databaseId);
  if (!dataSourceId) throw new Error("No data source found for main DB");

  const today = new Date().toISOString().split("T")[0];
  const allPages = [];
  let cursor = undefined;

  // Active subscriptions filter
  const filter = {
    and: [
      { property: "Start Date", date: { on_or_before: today } },
      { property: "End Date", date: { on_or_after: today } },
      { property: "Meal Type", multi_select: { contains: mealType } },
    ],
  };

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

  // Map allPages => customers (apply trial override)
  const customers = allPages.map((p) => {
    const cust = extractCustomerFromPage(p, mealType);
    return cust;
  });
  if (listtype === "serve") {
    return customers;
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

app.get("/customers/lunch/all", async (req, res) => {
  try {
    const grouped = await fetchAllCustomersByMeal("Lunch");
    return res.json(grouped);
  } catch (err) {
    console.error("❌ Error in /customers/lunch/all:", err?.message ?? err);
    return res.status(500).json({
      error: "Failed to fetch lunch customers",
      details: err?.message,
    });
  }
});

app.get("/customers/serve/lunch", async (req, res) => {
  try {
    const customers = await fetchCustomersByMeal("Lunch", "serve");
    return res.json(customers);
  } catch (err) {
    console.error("❌ Error in /customers/serve/lunch:", err?.message ?? err);
    console.error("Full Error:", err);
    console.error("Stack:", err.stack);
    return res.status(500).json({
      error: "Failed to fetch serve lunch customers",
      details: err?.message,
    });
  }
});

app.get("/customers/serve/lunch/all", async (req, res) => {
  try {
    const grouped = await fetchAllCustomersByMeal("Lunch", "serve");
    return res.json(grouped);
  } catch (err) {
    console.error(
      "❌ Error in /customers/serve/lunch/all:",
      err?.message ?? err,
    );
    return res.status(500).json({
      error: "Failed to fetch serve lunch customers",
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

app.get("/customers/dinner/all", async (req, res) => {
  try {
    const grouped = await fetchAllCustomersByMeal("Dinner");
    return res.json(grouped);
  } catch (err) {
    console.error("❌ Error in /customers/dinner/all:", err?.message ?? err);
    return res.status(500).json({
      error: "Failed to fetch all dinner customers",
      details: err?.message,
    });
  }
});
app.get("/customers/serve/dinner", async (req, res) => {
  try {
    const grouped = await fetchCustomersByMeal("Dinner", "serve");
    return res.json(grouped);
  } catch (err) {
    console.error("❌ Error in /customers/serve/dinner:", err?.message ?? err);
    return res.status(500).json({
      error: "Failed to fetch serve dinner customers",
      details: err?.message,
    });
  }
});

app.get("/customers/serve/dinner/all", async (req, res) => {
  try {
    const grouped = await fetchAllCustomersByMeal("Dinner", "serve");
    return res.json(grouped);
  } catch (err) {
    console.error(
      "❌ Error in /customers/serve/dinner/all:",
      err?.message ?? err,
    );
    return res.status(500).json({
      error: "Failed to fetch serve dinner customers",
      details: err?.message,
    });
  }
});

app.post("/customers/route/publish", async (req, res) => {
  console.log("📌 Received Publish Data:");
  const data = req.body;
  try {
    const customers = data?.newdata;
    const mealType = data?.mealType;

    if (!customers || !mealType) {
      return res.status(400).json({
        error: "Customers or meal type not found",
      });
    }
    if (!["lunch", "dinner"].includes(mealType)) {
      return res.status(400).json({
        error: "Meal type not found",
      });
    }
    console.log("🚀 ~ app.post ~ customers:", customers);

    for (const customer of customers) {
      const pageId = customer.id;

      console.log(`Updating page: ${pageId}`);

      await notion.pages.update({
        page_id: pageId,
        properties: {
          ...(mealType === "lunch"
            ? {
                "Lunch Route": {
                  select: {
                    name: customer.lunchRoute,
                  },
                },
              }
            : {
                "Dinner Route": {
                  select: {
                    name: customer.dinnerRoute,
                  },
                },
              }),
          ...(mealType === "lunch"
            ? {
                "Lunch Route Order": {
                  number: customer.lunchRouteOrder,
                },
              }
            : {
                "Dinner Route Order": {
                  number: customer.dinnerRouteOrder,
                },
              }),
        },
      });
    }

    res.json({ success: true, message: "Data received successfully" });
  } catch (err) {
    console.error("❌ Error in /customers/publish:", err?.message ?? err);
    return res.status(500).json({
      error: "Failed to publish customers",
      details: err?.message,
    });
  }
});

app.post("/customer/update", async (req, res) => {
  console.log("📌 Received Publish Data:");
  const data = req.body;
  try {
    const updateData = data?.customer;
    const mealType = data?.mealType;
    const customers = updateData?.customers;
    if (!customers?.length) {
      return res.status(400).json({
        error: "Customer not found",
      });
    }
    if (!mealType || !["lunch", "dinner"].includes(mealType)) {
      return res.status(400).json({
        error: "Meal type not found",
      });
    }
    for (const customer of customers) {
      const pageId = customer.id;
      if (!pageId) {
        return res.status(400).json({
          error: "Page id not found",
        });
      }
      console.log(`Updating page: ${pageId}`);
      await notion.pages.update({
        page_id: pageId,
        properties: {
          ...(mealType === "lunch"
            ? {
                "Lunch Special - Normal": {
                  select: {
                    name: customer.LunchSpecialNormal,
                  },
                },
              }
            : {
                "Dinner Special - Normal": {
                  select: {
                    name: customer.DinnerSpecialNormal,
                  },
                },
              }),
          ...(mealType === "lunch"
            ? {
                "Lunch Map Link": {
                  url: updateData.mapLink,
                },
              }
            : {
                "Dinner Map Link": {
                  url: updateData.mapLink,
                },
              }),
          "Phone Number": {
            phone_number: customer.phoneNumber,
          },
        },
      });
    }

    res.json({ success: true, message: "Data received successfully" });
  } catch (err) {
    console.error("❌ Error in /customers/publish:", err?.message ?? err);
    return res.status(500).json({
      error: "Failed to publish customers",
      details: err?.message,
    });
  }
});

app.post("/customers/serve/publish", async (req, res) => {
  console.log("📌 Received Publish Data:");
  const data = req.body;
  try {
    const customers = data?.newdata;
    const mealType = data?.mealType;

    if (!customers || !mealType) {
      return res.status(400).json({
        error: "Customers or meal type not found",
      });
    }
    if (!["lunch", "dinner"].includes(mealType)) {
      return res.status(400).json({
        error: "Meal type not found",
      });
    }
    console.log("🚀 ~ app.post ~ customers:", customers);
    console.log("Customers: ", customers);
    for (const customer of customers) {
      const pageId = customer.id;

      console.log(`Updating page: ${pageId}`);

      await notion.pages.update({
        page_id: pageId,
        properties: {
          ...(mealType === "lunch"
            ? {
                "Lunch Serve Order": {
                  number: customer.serveOrder,
                },
              }
            : {
                "Dinner Serve Order": {
                  number: customer.serveOrder,
                },
              }),
          ...(mealType === "lunch"
            ? {
                "Lunch Special - Normal": {
                  select: {
                    name: customer.thaliType,
                  },
                },
              }
            : {
                "Dinner Special - Normal": {
                  select: {
                    name: customer.thaliType,
                  },
                },
              }),
          Poster: {
            checkbox: customer.poster,
          },
          ...(mealType === "lunch"
            ? {
                "Customisation Lunch": {
                  rich_text: [
                    {
                      text: { content: customer.customisation },
                    },
                  ],
                },
              }
            : {
                "Customisation Dinner": {
                  rich_text: [
                    {
                      text: { content: customer.customisation },
                    },
                  ],
                },
              }),
        },
      });
    }

    res.json({ success: true, message: "Data received successfully" });
  } catch (err) {
    console.error("❌ Error in /customers/serve/publish:", err?.message ?? err);
    return res.status(500).json({
      error: "Failed to publish customers",
      details: err?.message,
    });
  }
});

/* -------------------- START -------------------- */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
