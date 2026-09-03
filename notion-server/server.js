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
      "http://localhost:5174",
      "https://thedabbacentralapplication.vercel.app",
      "https://thedabbacentralapplication.onrender.com",
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

// --------------------------------------------------
// GOOGLE MAPS LINK → COORDINATES
// --------------------------------------------------

async function resolveGoogleMapsLink(mapLink) {
  if (!mapLink) return null;

  try {
    const response = await fetch(mapLink, {
      redirect: "follow",
    });

    const finalUrl = response.url;
    const html = await response.text();

    console.log("Original Map Link:", mapLink);
    console.log("Resolved URL:", finalUrl);

    // -----------------------------------------
    // 1. Coordinates in normal Google URL
    // -----------------------------------------

    // 1. FIRST: try actual place coordinates
    // Google Maps commonly stores them as !3dLAT!4dLNG

    let match = finalUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);

    if (match) {
      console.log("✅ Actual place coordinates found in URL");

      return {
        lat: Number(match[1]),
        lng: Number(match[2]),
      };
    }

    // 2. Try coordinates encoded in the HTML

    match = html.match(/%212d(-?\d+\.\d+)%213d(-?\d+\.\d+)/);

    if (match) {
      console.log("✅ Coordinates found in Google HTML");

      return {
        lat: Number(match[2]),
        lng: Number(match[1]),
      };
    }

    match = html.match(/%213d(-?\d+\.\d+)%214d(-?\d+\.\d+)/);

    if (match) {
      console.log("✅ Coordinates found in Google HTML");

      return {
        lat: Number(match[1]),
        lng: Number(match[2]),
      };
    }

    // 3. LAST RESORT: use @lat,lng
    // This may be the map viewport rather than the exact place.

    match = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);

    if (match) {
      console.log("⚠️ Using map viewport coordinates");

      return {
        lat: Number(match[1]),
        lng: Number(match[2]),
      };
    }

    console.log("⚠️ Could not extract coordinates");

    return null;
  } catch (err) {
    console.error("❌ Failed to resolve Google Maps link:", err.message);
    return null;
  }
}

function getTodayIST() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });
}

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

async function fetchTodayTemplateExtraMeals(mealType) {
  console.log("🔥 fetchTodayTemplateExtraMeals called");

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
            equals: "Extra Meal",
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

  console.log("Today's Fixed Extra Meal Customers:", customers);

  return customers;
}

async function fetchTodayTemplateNonVeg(mealType) {
  console.log("🔥 fetchTodayTemplateExtraMeals called");

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
            equals: "Non-Veg",
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

  console.log("Today's Fixed Extra Meal Customers:", customers);

  return customers;
}
async function applyTemplateCancellations(mealType) {
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

async function applyTemplateExtraMeals(mealType) {
  const appliedCustomers = [];
  const duplicateCustomers = [];
  const inactiveCustomers = [];
  console.log("🚀 Applying Fixed Extra Meals");

  const customerIds = await fetchTodayTemplateExtraMeals(mealType);

  // Existing cancellations for today
  const extrasToday = await fetchTodayExtras();

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });

  let applied = 0;
  let skippedDuplicate = 0;
  let skippedInactive = 0;

  const extraSet = new Set(
    extrasToday.map((extra) => `${extra.id}-${extra.mealType}`),
  );

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
    if (extraSet.has(`${customerId}-${mealType}`)) {
      skippedDuplicate++;
      duplicateCustomers.push(customerName);
      continue;
    }

    const startDate = props["Start Date"]?.date?.start;
    const endDate =
      props["End Date"]?.date?.end ?? props["End Date"]?.date?.start;

    const mealTypes = (props["Meal Type"]?.multi_select || []).map(
      (m) => m.name,
    );

    const active = startDate <= today && endDate >= today;

    if (!active) {
      skippedInactive++;
      inactiveCustomers.push(customerName);
      continue;
    }

    await notion.pages.create({
      parent: {
        database_id: extrasDbId,
      },
      properties: {
        "The Dabba Central Database": {
          relation: [
            {
              id: customerId,
            },
          ],
        },

        "Meal Type": {
          select: {
            name: mealType,
          },
        },

        Date: {
          date: {
            start: today,
          },
        },
      },
    });

    applied++;
    appliedCustomers.push(customerName);

    console.log("✅ Extra Meal Created");
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

app.post("/templates/apply", async (req, res) => {
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

    const cancellations = await applyTemplateCancellations(meal);

    const extras = await applyTemplateExtraMeals(meal);

    return res.json({
      cancellations,
      extras,
    });
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

    // Map links
    lunchMapLink: props["Lunch Map Link"]?.url ?? null,
    dinnerMapLink: props["Dinner Map Link"]?.url ?? null,

    // Coordinates
    lunchLat: props["Lunch Lat"]?.number ?? null,
    lunchLng: props["Lunch Long"]?.number ?? null,

    dinnerLat: props["Dinner Lat"]?.number ?? null,
    dinnerLng: props["Dinner Long"]?.number ?? null,

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

  const today = getTodayIST();
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

  const today = getTodayIST();
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

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });

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

    const mapLink = props["Changed Location Link"]?.url || null;

    const lat = props["Lat"]?.number ?? null;

    const lng = props["Long"]?.number ?? null;

    if (!customerId || !meal) continue;

    changes.push({
      customerId,
      meal,
      mapLink,
      lat,
      lng,
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

  if (!dataSourceId) {
    throw new Error("No data source found for main DB");
  }

  const today = getTodayIST();

  const allPages = [];
  let cursor = undefined;

  // --------------------------------------------------
  // ACTIVE SUBSCRIPTIONS FILTER
  // --------------------------------------------------

  const baseFilter = {
    and: [
      {
        property: "Start Date",
        date: {
          on_or_before: today,
        },
      },
      {
        property: "End Date",
        date: {
          on_or_after: today,
        },
      },
      {
        property: "Meal Type",
        multi_select: {
          contains: mealType,
        },
      },
    ],
  };

  // --------------------------------------------------
  // TRIAL FILTER
  // --------------------------------------------------

  const trialFilter = {
    and: [
      {
        property: "Trial Date",
        date: {
          equals: today,
        },
      },
      {
        property: "Trial Meal Time",
        select: {
          equals: mealType,
        },
      },
    ],
  };

  const filter = {
    or: [baseFilter, trialFilter],
  };

  // --------------------------------------------------
  // FETCH ALL MAIN DB PAGES
  // --------------------------------------------------

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

  // --------------------------------------------------
  // LOOKUP MAP
  // --------------------------------------------------

  const pageById = new Map(allPages.map((p) => [p.id, p]));

  // --------------------------------------------------
  // FETCH CANCELLATIONS / EXTRAS / CHANGES
  // --------------------------------------------------

  const cancelled = await fetchTodayCancellations();

  const extras = await fetchTodayExtras();

  const customizationChanges = await fetchTodayCustomizationChanges();

  const locationChanges = await fetchTodayLocationChanges();

  const templateNonVeg = await fetchTodayTemplateNonVeg(mealType);

  const nonVegSet = new Set(templateNonVeg);

  // --------------------------------------------------
  // CUSTOMIZATION MAP
  // --------------------------------------------------

  const customizationMap = new Map();

  customizationChanges.forEach((change) => {
    customizationMap.set(
      `${change.customerId}-${change.meal}`,
      change.customisation,
    );
  });

  // --------------------------------------------------
  // LOCATION CHANGE MAP
  // --------------------------------------------------

  const locationMap = new Map();

  locationChanges.forEach((change) => {
    locationMap.set(`${change.customerId}-${change.meal}`, change);
  });

  // ==================================================
  // MAIN CUSTOMERS
  // ==================================================

  const customerResults = await Promise.all(
    allPages.map(async (p) => {
      const cust = extractCustomerFromPage(p, mealType);

      // ------------------------------------------------
      // TRIAL OVERRIDE
      // ------------------------------------------------

      const props = p.properties || {};

      const trialDate = props["Trial Date"]?.date?.start;

      const trialTime = props["Trial Meal Time"]?.select?.name;

      const isTrialMeal = trialDate === today && trialTime === mealType;

      cust.isTrialMeal = isTrialMeal;

      if (isTrialMeal) {
        if (mealType === "Lunch") {
          cust.LunchSpecialNormal = "Paneer";
        }

        if (mealType === "Dinner") {
          cust.DinnerSpecialNormal = "Paneer";
        }
      }

      // ------------------------------------------------
      // DAILY CUSTOMIZATION
      // ------------------------------------------------

      const dailyCustomization = customizationMap.get(`${cust.id}-${mealType}`);

      if (dailyCustomization) {
        if (mealType === "Lunch") {
          cust.customisationLunch = dailyCustomization;
        } else {
          cust.customisationDinner = dailyCustomization;
        }

        cust.dailyCustomization = true;
      }

      // ------------------------------------------------
      // SCHEDULED NON-VEG
      // ------------------------------------------------

      if (nonVegSet.has(cust.id)) {
        if (mealType === "Lunch") {
          cust.LunchSpecialNormal = "Chicken";
        } else {
          cust.DinnerSpecialNormal = "Chicken";
        }

        cust.templateNonVeg = true;
      }

      // ------------------------------------------------
      // LOCATION CHANGE
      // ------------------------------------------------
      // ------------------------------------------------
      // LOCATION CHANGE
      // ------------------------------------------------

      const changedLocation = locationMap.get(`${cust.id}-${mealType}`);

      console.log({
        customer: cust.name,
        key: `${cust.id}-${mealType}`,
        changedLocation,
      });

      if (changedLocation) {
        // Customer has a temporary location change today

        cust.locationChanged = true;

        cust.changedMapLink = changedLocation.mapLink;

        cust.lat = changedLocation.lat;
        cust.lng = changedLocation.lng;

        console.log("📍 Using changed location:", {
          customer: cust.name,
          mealType,
          lat: cust.lat,
          lng: cust.lng,
        });
      } else {
        // Customer is using their normal location

        if (mealType === "Lunch") {
          cust.lat = cust.lunchLat;
          cust.lng = cust.lunchLng;
        } else {
          cust.lat = cust.dinnerLat;
          cust.lng = cust.dinnerLng;
        }

        console.log("📍 Using normal location:", {
          customer: cust.name,
          mealType,
          lat: cust.lat,
          lng: cust.lng,
        });
      }
      return cust;
    }),
  );

  // --------------------------------------------------
  // REMOVE CANCELLED CUSTOMERS
  // --------------------------------------------------

  const customers = customerResults.filter(
    (c) => !cancelled.has(`${c.id}-${mealType}`),
  );

  // ==================================================
  // EXTRA MEALS
  // ==================================================

  for (const ex of extras) {
    if (ex.mealType !== mealType) {
      continue;
    }

    const mainId = ex.id;

    // ------------------------------------------------
    // GET CUSTOMER PAGE
    // ------------------------------------------------

    let page;

    if (pageById.has(mainId)) {
      page = pageById.get(mainId);
    } else {
      try {
        page = await notion.pages.retrieve({
          page_id: mainId,
        });
      } catch (err) {
        console.error(
          "❌ Failed to fetch extra meal customer:",
          mainId,
          err.message,
        );

        continue;
      }
    }

    // ------------------------------------------------
    // CREATE CUSTOMER
    // ------------------------------------------------

    const cust = extractCustomerFromPage(page, mealType);

    cust.route = "Unassigned";

    // ------------------------------------------------
    // DAILY CUSTOMIZATION
    // ------------------------------------------------

    const dailyCustomization = customizationMap.get(`${cust.id}-${mealType}`);

    if (dailyCustomization) {
      if (mealType === "Lunch") {
        cust.customisationLunch = dailyCustomization;
      } else {
        cust.customisationDinner = dailyCustomization;
      }

      cust.dailyCustomization = true;
    }

    // ------------------------------------------------
    // SCHEDULED NON-VEG
    // ------------------------------------------------

    if (nonVegSet.has(cust.id)) {
      if (mealType === "Lunch") {
        cust.LunchSpecialNormal = "Chicken";
      } else {
        cust.DinnerSpecialNormal = "Chicken";
      }

      cust.templateNonVeg = true;
    }
    // ------------------------------------------------
    // LOCATION CHANGE / COORDINATES
    // ------------------------------------------------

    const changedLocation = locationMap.get(`${cust.id}-${mealType}`);

    if (changedLocation) {
      // Customer has a temporary location change today
      cust.locationChanged = true;

      cust.changedMapLink = changedLocation.mapLink;

      // IMPORTANT:
      // Use Lat / Long stored in Location Change database
      cust.lat = changedLocation.lat;
      cust.lng = changedLocation.lng;

      console.log("📍 Using changed location for extra:", {
        customer: cust.name,
        mealType,
        lat: cust.lat,
        lng: cust.lng,
      });
    } else {
      // Use normal coordinates stored in Main Customer database

      if (mealType === "Lunch") {
        cust.lat = cust.lunchLat;
        cust.lng = cust.lunchLng;
      } else {
        cust.lat = cust.dinnerLat;
        cust.lng = cust.dinnerLng;
      }

      console.log("📍 Using normal location for extra:", {
        customer: cust.name,
        mealType,
        lat: cust.lat,
        lng: cust.lng,
      });
    }

    customers.push(cust);

    console.log(`✅ Adding Extra: ${cust.name} ${mealType}`);
  }

  // ==================================================
  // SERVE LIST
  // ==================================================

  if (listtype === "serve") {
    return customers;
  }

  // ==================================================
  // GROUP BY ROUTE
  // ==================================================

  const grouped = customers.reduce((acc, c) => {
    const route = c.route || "Unassigned";

    if (!acc[route]) {
      acc[route] = [];
    }

    acc[route].push(c);

    return acc;
  }, {});

  // --------------------------------------------------
  // SORT BY ORDER
  // --------------------------------------------------

  for (const route in grouped) {
    grouped[route].sort((a, b) => a.order - b.order);
  }

  console.log("========== FINAL CUSTOMER SAMPLE ==========");
  console.log(customers[0]);
  console.log("LAT:", customers[0]?.lat);
  console.log("LNG:", customers[0]?.lng);
  console.log("===========================================");

  return grouped;
}

async function fetchAllCustomersByMeal(mealType, listtype) {
  const dataSourceId = await getPrimaryDataSourceId(databaseId);
  if (!dataSourceId) throw new Error("No data source found for main DB");

  const today = getTodayIST();
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

    if (mealType === "Lunch") {
      cust.lat = cust.lunchLat;
      cust.lng = cust.lunchLng;
    } else {
      cust.lat = cust.dinnerLat;
      cust.lng = cust.dinnerLng;
    }

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

    console.log("🍱 Meal Type:", mealType);
    console.log("👥 Customers:", customers);

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

      // Convert coordinates to numbers
      const lat =
        customer.lat === "" ||
        customer.lat === null ||
        customer.lat === undefined
          ? null
          : Number(customer.lat);

      const lng =
        customer.lng === "" ||
        customer.lng === null ||
        customer.lng === undefined
          ? null
          : Number(customer.lng);

      console.log("=================================");
      console.log("Updating customer:", customer.name);
      console.log("Page ID:", pageId);
      console.log("Meal Type:", mealType);
      console.log("Latitude:", lat);
      console.log("Longitude:", lng);
      console.log("=================================");

      await notion.pages.update({
        page_id: pageId,

        properties: {
          // SPECIAL
          ...(mealType === "lunch"
            ? {
                "Lunch Special - Normal": {
                  select: {
                    name: customer.LunchSpecialNormal || "Normal",
                  },
                },
              }
            : {
                "Dinner Special - Normal": {
                  select: {
                    name: customer.DinnerSpecialNormal || "Normal",
                  },
                },
              }),

          // MAP LINK
          ...(mealType === "lunch"
            ? {
                "Lunch Map Link": {
                  url: updateData.mapLink || null,
                },
              }
            : {
                "Dinner Map Link": {
                  url: updateData.mapLink || null,
                },
              }),

          // COORDINATES
          ...(mealType === "lunch"
            ? {
                "Lunch Lat": {
                  number: lat,
                },
                "Lunch Long": {
                  number: lng,
                },
              }
            : {
                "Dinner Lat": {
                  number: lat,
                },
                "Dinner Long": {
                  number: lng,
                },
              }),

          // PHONE
          "Phone Number": {
            phone_number: customer.phoneNumber || null,
          },
        },
      });

      console.log(`✅ Updated Notion page: ${pageId}`);
    }

    res.json({
      success: true,
      message: "Data received successfully",
    });
  } catch (err) {
    console.error("❌ Error in /customer/update:");
    console.error(err);

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

// --------------------------------------------------
// TEST GOOGLE MAPS LINK RESOLVER
// --------------------------------------------------

app.get("/location/resolve", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        error: "Google Maps URL is required",
      });
    }

    const location = await resolveGoogleMapsLink(url);

    if (!location) {
      return res.status(404).json({
        error: "Could not extract coordinates",
      });
    }

    return res.json({
      success: true,
      originalUrl: url,
      ...location,
    });
  } catch (error) {
    console.error("❌ Location resolver error:", error);

    return res.status(500).json({
      error: "Failed to resolve location",
      details: error.message,
    });
  }
});

/* -------------------- START -------------------- */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
