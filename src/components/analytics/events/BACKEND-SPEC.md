# Events Explorer - Backend API Specification

## Overview

The Events Explorer lets users browse, filter, and inspect individual event occurrences sent by their mobile app. The frontend currently runs on mock data. This document describes the API endpoints, request/response shapes, and query capabilities the backend needs to provide.

All endpoints are scoped to a project and require the standard Bearer token auth.

---

## 1. List Events (paginated, filterable, sortable)

```
GET /api/v1/projects/{project_id}/events
```

### Query Parameters

| Parameter    | Type     | Required | Description                                                                                                                                                                                                     |
| ------------ | -------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cursor`     | string   | no       | Opaque cursor for next page (returned in response). Omit for first page.                                                                                                                                        |
| `limit`      | integer  | no       | Page size. Default `50`, max `200`.                                                                                                                                                                             |
| `sort_by`    | string   | no       | Field to sort by. Default `timestamp`. Allowed: `timestamp`, `event_name`, `platform`, `app_version`, `device_model`, `os_version`, `country`.                                                                  |
| `sort_order` | string   | no       | `asc` or `desc`. Default `desc`.                                                                                                                                                                                |
| `search`     | string   | no       | Free-text search across all fields and property values (case-insensitive).                                                                                                                                      |
| `start_date` | ISO 8601 | no       | Filter events from this timestamp (inclusive).                                                                                                                                                                  |
| `end_date`   | ISO 8601 | no       | Filter events up to this timestamp (**exclusive**). A bare `YYYY-MM-DD` still spans that whole day. An explicit UTC offset is required on timestamps; without one the value falls back to date-grained parsing. |
| `filters`    | JSON     | no       | URL-encoded JSON array of filter objects (see below).                                                                                                                                                           |

### Filter Object Shape

```json
{
  "field": "event_name",
  "operator": "is",
  "value": "login_complete"
}
```

| Field      | Type   | Description                                                                                                                                                                                                                               |
| ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `field`    | string | Any top-level event attribute (`event_name`, `user_id`, `session_id`, `platform`, `app_version`, `device_model`, `os_version`, `country`, `category`) **or** any event property key (e.g. `screen_name`, `source`, `amount`, `currency`). |
| `operator` | string | One of: `is`, `is_not`, `contains`.                                                                                                                                                                                                       |
| `value`    | string | The value to compare against.                                                                                                                                                                                                             |

### Filter Logic

- Multiple filters on the **same field** with `is` operator: **OR** (event matches if any value matches).
- Multiple filters on the **same field** with `is_not` operator: **AND** (event must not match any of the excluded values).
- `contains`: case-insensitive substring match (e.g. `_start` matches `login_start`, `purchase_start`).
- Filters on **different fields**: **AND** (all field groups must pass).
- Filters can target **event properties** (the custom key-value pairs), not just top-level attributes.

### Response

```json
{
  "data": [
    {
      "id": "evt_abc123",
      "event_name": "purchase_complete",
      "timestamp": "2026-04-28T14:32:10.000Z",
      "user_id": "usr_x7k2m9",
      "session_id": "ses_p3n8q1",
      "platform": "iOS",
      "app_version": "2.4.0",
      "device_model": "iPhone 15 Pro",
      "os_version": "iOS 18.2",
      "country": "US",
      "category": "revenue",
      "properties": {
        "product_id": "prod_a1b2c3",
        "amount": 29.99,
        "currency": "USD"
      }
    }
  ],
  "next_cursor": "eyJpZCI6ImV2dF8...",
  "total_count": 1284
}
```

| Field         | Type              | Description                                             |
| ------------- | ----------------- | ------------------------------------------------------- |
| `data`        | EventOccurrence[] | Array of event objects.                                 |
| `next_cursor` | string \| null    | Cursor for next page. `null` if no more results.        |
| `total_count` | integer           | Total matching events (for UI display, not pagination). |

---

## 2. Event Detail

```
GET /api/v1/projects/{project_id}/events/{event_id}
```

Returns a single event with the full `properties` payload. This is a **richer** shape than the list rows: the list endpoint omits `properties` (returns `null`) and several detail-only fields (`build`, `vendor_id`, `timezone`, `language`, `link_tags`, `sdk_attributes`, `tags`, `ip`, `path`, `ingested_at`, …). The UI must fetch this endpoint to show event properties.

---

## 3. Event Volume Histogram

```
GET /api/v1/projects/{project_id}/events/volume
```

Returns event counts bucketed by time interval for the volume chart above the table.

### Query Parameters

Same filter parameters as List Events (`search`, `start_date`, `end_date`, `filters`) so the histogram reflects the active filters.

| Parameter    | Type     | Required | Description                                                                                                                                                                                                                                                                                                                                                               |
| ------------ | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `start_date` | ISO 8601 | yes      | Start of range.                                                                                                                                                                                                                                                                                                                                                           |
| `end_date`   | ISO 8601 | yes      | End of range.                                                                                                                                                                                                                                                                                                                                                             |
| `search`     | string   | no       | Same free-text search.                                                                                                                                                                                                                                                                                                                                                    |
| `filters`    | JSON     | no       | Same filter array.                                                                                                                                                                                                                                                                                                                                                        |
| `bucket`     | string   | no       | Bucket size. Auto-determined if omitted. Options: `hour`, `day`, `week`, `month`.                                                                                                                                                                                                                                                                                         |
| `timezone`   | string   | no       | IANA zone the buckets are cut in, e.g. `Europe/Bucharest`. Defaults to `UTC`. An unrecognised zone falls back to UTC rather than failing (the labels change, the counts do not). **Send offset-bearing instants for `start_date`/`end_date` alongside it** — bare dates are read as UTC days, so pairing them with a non-UTC zone leaves the first and last bars partial. |

### Response

`bucket` is a **pre-formatted wall-clock label** in the requested `timezone` — not an instant. Render it verbatim; never pass it to a date parser.

```json
{
  "buckets": [
    { "bucket": "2026-04-28 14:00:00", "count": 42 },
    { "bucket": "2026-04-28 15:00:00", "count": 37 }
  ]
}
```

---

## 4. Filterable Field Values (autocomplete)

```
GET /api/v1/projects/{project_id}/events/field-values
```

Returns the distinct values for a given field, used to populate the query bar dropdown suggestions.

### Query Parameters

| Parameter | Type    | Required | Description                                       |
| --------- | ------- | -------- | ------------------------------------------------- |
| `field`   | string  | yes      | Field name (top-level attribute or property key). |
| `q`       | string  | no       | Optional prefix/substring filter for typeahead.   |
| `limit`   | integer | no       | Max values to return. Default `50`.               |

### Response

```json
{
  "field": "platform",
  "values": ["Android", "iOS", "Web"]
}
```

---

## 5. Filterable Field List (property discovery)

```
GET /api/v1/projects/{project_id}/events/fields
```

Returns the available filterable fields, including dynamically-discovered event property keys. Used to populate the "Event properties" group in the query bar dropdown.

### Response

```json
{
  "attributes": [
    { "key": "event_name", "label": "Event", "type": "string" },
    { "key": "user_id", "label": "User", "type": "string" },
    { "key": "session_id", "label": "Session", "type": "string" },
    { "key": "platform", "label": "Platform", "type": "string" },
    { "key": "app_version", "label": "Version", "type": "string" },
    { "key": "device_model", "label": "Device", "type": "string" },
    { "key": "os_version", "label": "OS", "type": "string" },
    { "key": "country", "label": "Country", "type": "string" },
    { "key": "category", "label": "Category", "type": "string" }
  ],
  "properties": [
    { "key": "screen_name", "type": "string", "event_names": ["screen_view"] },
    {
      "key": "amount",
      "type": "number",
      "event_names": ["purchase_start", "purchase_complete"]
    },
    {
      "key": "currency",
      "type": "string",
      "event_names": ["purchase_start", "purchase_complete"]
    },
    {
      "key": "product_id",
      "type": "string",
      "event_names": [
        "purchase_start",
        "purchase_complete",
        "add_to_cart",
        "remove_from_cart"
      ]
    },
    {
      "key": "quantity",
      "type": "number",
      "event_names": ["add_to_cart", "remove_from_cart"]
    },
    { "key": "query", "type": "string", "event_names": ["search"] },
    { "key": "results_count", "type": "number", "event_names": ["search"] },
    { "key": "content_type", "type": "string", "event_names": ["share"] },
    { "key": "share_method", "type": "string", "event_names": ["share"] },
    {
      "key": "notification_type",
      "type": "string",
      "event_names": ["notification_open", "notification_dismiss"]
    },
    {
      "key": "campaign_id",
      "type": "string",
      "event_names": ["notification_open", "notification_dismiss"]
    },
    { "key": "link_id", "type": "string", "event_names": ["deep_link_open"] },
    { "key": "source", "type": "string", "event_names": ["deep_link_open"] },
    { "key": "duration_ms", "type": "number", "event_names": ["screen_view"] },
    { "key": "session_duration", "type": "number", "event_names": ["*"] }
  ]
}
```

Notes:

- `event_names` tells the frontend which events have this property (useful for contextual filtering). `*` means it appears on many event types.
- `type` helps the frontend decide whether to show numeric operators in the future.

---

## Data Model: EventOccurrence

| Field          | Type   | Description                                                                |
| -------------- | ------ | -------------------------------------------------------------------------- |
| `id`           | string | Unique event ID.                                                           |
| `event_name`   | string | Event name (e.g. `purchase_complete`, `screen_view`).                      |
| `timestamp`    | string | ISO 8601 timestamp.                                                        |
| `user_id`      | string | User identifier.                                                           |
| `session_id`   | string | Session identifier.                                                        |
| `platform`     | string | `iOS`, `Android`, or `Web`.                                                |
| `app_version`  | string | App version string.                                                        |
| `device_model` | string | Device model name.                                                         |
| `os_version`   | string | OS version string.                                                         |
| `country`      | string | ISO 3166-1 alpha-2 country code.                                           |
| `category`     | string | One of: `engagement`, `lifecycle`, `revenue`, `navigation`, `system`.      |
| `properties`   | object | Arbitrary key-value pairs. Values can be `string`, `number`, or `boolean`. |

---

## Cross-Page Navigation

### Events Explorer → User Flows

The Events Explorer table has a "View User Flow" action on `session_id` and `user_id` cells. When clicked, the frontend navigates to:

```
/analytics/user_flows?filters=[{"f":"session_id","v":"ses_p3n8q1","o":"is"}]
```

or

```
/analytics/user_flows?filters=[{"f":"user_id","v":"usr_x7k2m9","o":"is"}]
```

The `filters` parameter is URL-encoded JSON using the compact `{f, v, o}` format (same as the Events filter format but with shortened keys).

### User Flows → Events Explorer

When a user right-clicks a screen node and selects "View in Events", the frontend navigates to:

```
/analytics/events?filters=[{"f":"screen_name","v":"Home","o":"is"}]
```

**Both pages use the same compact filter JSON format** `[{f, v, o}]` for cross-page navigation, enabling deep-linked round-trip navigation between the two views.

---

## Notes for Implementation

1. **Cursor pagination** is preferred over offset-based to handle real-time event ingestion without duplicates/skips.
2. **Free-text search** should match across all top-level string fields and all property values (cast to string).
3. **Property filtering** must search inside the `properties` JSON column, not just top-level columns.
4. The **volume histogram** endpoint should apply the exact same filter logic as the list endpoint so the chart matches the table.
5. The **field-values** endpoint powers typeahead - it should be fast. Consider caching or materialized views for high-cardinality fields like `user_id`.
6. The **fields** endpoint can be cached aggressively (property keys don't change frequently).
