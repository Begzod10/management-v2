from sqlalchemy import text
from sqlalchemy.orm import Session


def resolve_payment_type_id(db: Session, payment_type: str | None) -> int | None:
    """Looks up the shared `payment_type` table's id for a free-text label
    (e.g. "cash", "Click") coming from the Office UI's payment-type select.

    Investment/Dividend rows carry both `payment_type` (free text, always
    set) and `payment_type_id` (FK, used by gennis-v2's Inkassatsiya channel
    filters) — this repo's models only ever set the former, leaving the
    latter NULL for every row it creates. See
    gennis-v2/docs/investment-payment-type-duplicates.md.

    Returns None (not an error) when the label has no match — e.g. "transfer"
    exists as a UI option here but gennis-v2's payment_type table only has
    cash/click/bank, so it has nothing to attach to downstream.
    """
    if not payment_type:
        return None
    return db.execute(
        text("SELECT id FROM payment_type WHERE lower(name) = lower(:v) OR lower(slug) = lower(:v)"),
        {"v": payment_type},
    ).scalar()
