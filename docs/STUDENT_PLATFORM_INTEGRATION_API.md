# `/api/v1/integrations/student-platform/*`

management-v2's own copy of gennis-v2's student_platform login shim — same
contract, same old-gennis-shaped response, but reads the shared
`user`/`gennis_*`/`turon_*_v2` tables directly instead of through a
read-only mirror, since management-v2 owns this DB.

- **Domain (production):** `https://office.gennis.uz`
- **Route file:** `app/routers/v1/integrations/student_platform.py`
- **Consumer:** student_platform's `GennisService` (`MGMT_INTEGRATION_URL`
  setting — see student_platform's `PROJECT_KNOWLEDGE.md` §10.6)
- **Auth:** `/login` requires none. `/group/{id}/students` and
  `/flow/{id}/students` require the bearer token `/login` just issued.

---

## `POST /api/v1/integrations/student-platform/login`

Authenticates against the shared `user` table, then resolves whether the
account is a gennis or a turon teacher/student, answering in old gennis's
`/base/login` response shape so student_platform's existing parser is
unchanged.

### Request body

```json
{
  "username": "aliyev_shodlik",
  "password": "correct-horse-battery-staple"
}
```

| Field | Type | Notes |
|---|---|---|
| `username` | string | old gennis called this field `username`; kept as-is so the caller is unchanged |
| `password` | string | plain password, checked against the shared `user` table (bcrypt / django_pbkdf2_sha256 / Werkzeug, auto-detected) |

### Response — 200 OK, gennis student

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "type_user": "student",
  "source": "gennis",
  "user": {
    "id": 13807,
    "name": "Shodlik",
    "surname": "Aliyev",
    "role": "student",
    "email": null,
    "phone": [{ "phone": "993154318" }],
    "birth_date": null,
    "student": {
      "group": [
        { "id": 458, "name": "Dchj 12:00", "price": 430000 }
      ],
      "combined_debt": 430000,
      "location_id": 3,
      "location_name": "Chilonzor"
    }
  }
}
```

`user.id` here is the gennis **student** id (`gennis_student.gennis_id`),
**not** the shared `user.id` — sending the user id instead would make
student_platform miss the existing local account and silently create a
duplicate one.

### Response — 200 OK, gennis teacher

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "type_user": "teacher",
  "source": "gennis",
  "user": {
    "id": 6,
    "name": "Nigora",
    "surname": "Eshqobilova",
    "role": "teacher",
    "email": null,
    "phone": [],
    "birth_date": null,
    "teacher": {
      "group": [
        { "id": 610, "name": "Dchj 10:30", "price": 430000 },
        { "id": 506, "name": "Dchj 9:00", "price": 430000 }
      ],
      "location_id": 3,
      "location_name": "Chilonzor"
    }
  }
}
```

For teachers, `user.id` is the gennis **user** id
(`gennis_teacher.user_gennis_id`), resolved via a bridge table
(`gennis_teacher_group_link`), not the student-id convention above.

### Response — 200 OK, turon teacher

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "type_user": "teacher",
  "source": "turon",
  "user": {
    "id": 18447,
    "name": "Ra'no",
    "surname": "Mamatova",
    "role": "teacher",
    "email": null,
    "phone": [{ "phone": "983112203" }],
    "birth_date": "1994-03-12",
    "teacher": {
      "group": [],
      "branch_id": 6,
      "branch_name": "Xo'jakent"
    }
  }
}
```

For turon, `user.id` **is** the shared `user.id` — there's no separate turon
id space, unlike gennis. `branch_id`/`branch_name` come from the account's
own `turon_user_profile_v2` row, not from any particular group.

### Response — 200 OK, turon student

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "type_user": "student",
  "source": "turon",
  "user": {
    "id": 19055,
    "name": "Sarvar",
    "surname": "Ruzmatov",
    "role": "student",
    "email": null,
    "phone": [{ "phone": "935455952" }],
    "birth_date": "2015-07-04",
    "student": {
      "group": [
        { "id": 197, "name": "0-green", "price": 1650000 }
      ],
      "flow": [
        { "id": 772, "name": "Breakfast" },
        { "id": 773, "name": "Lunch Primary" },
        { "id": 775, "name": "Second Lunch" }
      ],
      "combined_debt": 0,
      "branch_id": 6,
      "branch_name": "Xo'jakent"
    }
  }
}
```

Turon students additionally carry `flow[]` — a second, independent grouping
from `group[]` (not a billing unit, no `price`). `combined_debt` is always
`0` for turon today; turon-v2 doesn't expose a computed debt figure yet.

### `birth_date`

Top-level on `user` (both teacher and student, both sources) — an ISO
`"YYYY-MM-DD"` string, or `null`.

- **turon**: read from `turon_user_profile_v2.birth_date` — already loaded
  as `turon_profile` earlier in the handler, so this is free (no extra
  query). Populated for most, not all, real accounts.
- **gennis**: always `null`. No table this endpoint reads (`gennis_student`,
  `gennis_user_link`, `gennis_teacher_sync`) carries a birth date — the
  live legacy gennis DB's `users.born_day/born_month/born_year` does have
  it, but reaching that would mean a second, genuinely-remote DB
  round-trip on every gennis login (`get_gennis_db()`, not currently
  opened anywhere in this file). Deferred; revisit if a gennis-side age
  feature is actually needed.

student_platform stores this as an advisory, nullable field — never gate
access on it being present, only on it being absent-vs-a-real-value when
it is present.

### Location / branch fields

`teacher` and `student` each carry **one** location for the whole account —
not one per `group[]`/`flow[]` entry, since a person has a single home
branch/location regardless of how many groups they're in. Named differently
per source because the two systems' own schemas differ:

| Source | Fields | Read from |
|---|---|---|
| `gennis` | `location_id`, `location_name` | `gennis_user_link` — the account's branch, set at link time. |
| `turon` | `branch_id`, `branch_name` | `turon_user_profile_v2.branch_id` (the account's own branch), `branch_name` looked up from `turon_branch_v2`. |

Either field can be `null` if the account has no branch/location assigned.

### Error responses

**401 Unauthorized** — wrong username/password:

```json
{ "detail": "Incorrect login or password" }
```

**403 Forbidden** — account matched but deactivated or locked:

```json
{ "detail": "Account is not available" }
```

**409 Conflict** — password correct, but the account isn't linked to a
gennis or turon teacher/student record at all (e.g. a pure management-v2
staff account with no `gennis_user_link` row and no `turon_user_profile_v2`
row):

```json
{ "detail": "This account is not linked to a gennis or turon teacher/student record" }
```

`GennisService.login()` on student_platform's side only treats `200` as
success — a `409` falls through to local auth exactly like a network error
would.

---

## `GET /api/v1/integrations/student-platform/group/{group_gennis_id}/students`

The roster of one group, shaped like old gennis's
`GET /group/students/{id}`. Requires the bearer token `/login` issued.

| Param | Type | Notes |
|---|---|---|
| `group_gennis_id` | int, path | the group id **in its own system** — exactly what `/login`'s `group[].id` returned |
| `source` | string, query | `"gennis"` (default) or `"turon"` — disambiguates which id space `group_gennis_id` belongs to |

```
GET https://office.gennis.uz/api/v1/integrations/student-platform/group/610/students
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Response — 200 OK (gennis, `source` omitted)

```json
{
  "students": [
    {
      "id": 11362,
      "name": "Temur",
      "surname": "Abdurashidov",
      "phone": "949061323",
      "balance": 0,
      "birth_date": null
    },
    {
      "id": 12480,
      "name": "Sunnat",
      "surname": "Abdusamatov",
      "phone": "500052636",
      "balance": 0,
      "birth_date": null
    }
  ]
}
```

### Response — 200 OK (`?source=turon`)

```json
{
  "students": [
    {
      "id": 19055,
      "name": "Sarvar",
      "surname": "Ruzmatov",
      "phone": "935455952",
      "balance": 0,
      "birth_date": "2015-07-04"
    }
  ]
}
```

`balance` is always `0` in both cases — old gennis's response shape included
the field, but neither source computes a real per-student balance here.
`birth_date` follows the same rule as `/login` (see above): populated for
most turon accounts from `turon_user_profile_v2.birth_date`, always `null`
for gennis.

If the group id doesn't exist (or belongs to the *other* source — a gennis
id passed with `source=turon` or vice versa, since the two are independent,
overlapping numeric spaces):

```json
{ "students": [] }
```

---

## `GET /api/v1/integrations/student-platform/flow/{flow_id}/students`

The roster of one turon Flow — a second, independent student grouping from
Group. No `source` param: gennis has no Flow concept at all. Requires the
bearer token `/login` issued.

```
GET https://office.gennis.uz/api/v1/integrations/student-platform/flow/42/students
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Response — 200 OK

```json
{
  "students": [
    {
      "id": 19055,
      "name": "Sarvar",
      "surname": "Ruzmatov",
      "phone": "935455952",
      "balance": 0,
      "birth_date": "2015-07-04"
    }
  ]
}
```

Same shape as `/group/{id}/students`; `flow_id` maps directly to
`turon_flow_v2.id`, the same id `/login`'s `flow[].id` returns for a turon
student. Unknown or deleted flow id:

```json
{ "students": [] }
```
