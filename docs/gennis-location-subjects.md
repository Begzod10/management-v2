# Gennis Location Subjects — API reference

Admins use these endpoints to configure which subjects are relevant for each
branch. The selected subjects appear in subject-selection UIs instead of the
full unfiltered list.

Base path: `/api/v1/gennis-location-subjects`

Quick reference:

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/` | List all entries (optionally filtered by location) |
| `GET` | `/by-location/{location_id}` | Subjects for one location (for subject pickers) |
| `POST` | `/` | Mark a subject as important for a location |
| `DELETE` | `/{entry_id}` | Remove a subject from a location |

---

## GET `/`

List all `(location, subject)` entries. Used by the admin settings screen to
show the full configured list.

### Query params

| Param | Required | Description |
|-------|----------|-------------|
| `location_id` | no | Filter to one branch (`gennis_location.id`) |

### Response `200`

```json
[
  {
    "id": 1,
    "subject_id": 4,
    "location_id": 3,
    "subject": {
      "id": 4,
      "gennis_id": 12,
      "name": "Matematika"
    }
  }
]
```

---

## GET `/by-location/{location_id}`

Returns the flat subject list for one branch. Use this in subject picker
dropdowns — it gives only the subjects the admin has enabled, not the full
catalogue.

### Path param

| Param | Description |
|-------|-------------|
| `location_id` | `gennis_location.id` of the branch |

### Response `200`

```json
[
  { "id": 4, "gennis_id": 12, "name": "Matematika" },
  { "id": 7, "gennis_id": 15, "name": "Ingliz tili" }
]
```

Results are sorted alphabetically by subject name.

---

## POST `/`

Add a subject to a location's important list. Returns `409` if the pair
already exists, `404` if the subject does not exist.

### Request body

```json
{
  "subject_id": 4,
  "location_id": 3
}
```

| Field | Type | Description |
|-------|------|-------------|
| `subject_id` | integer | `gennis_subject.id` |
| `location_id` | integer | `gennis_location.id` |

### Response `201`

```json
{
  "id": 1,
  "subject_id": 4,
  "location_id": 3,
  "subject": {
    "id": 4,
    "gennis_id": 12,
    "name": "Matematika"
  }
}
```

### Errors

| Status | Detail |
|--------|--------|
| `404` | Subject not found |
| `409` | Subject already added to this location |

---

## DELETE `/{entry_id}`

Remove a subject from a location. Use the `id` field from the `GET /` or
`POST /` response — not the `subject_id`.

### Response `204`

No body.

### Errors

| Status | Detail |
|--------|--------|
| `404` | Entry not found |
