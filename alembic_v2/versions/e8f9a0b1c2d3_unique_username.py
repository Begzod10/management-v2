"""make user.username unique

Revision ID: e8f9a0b1c2d3
Revises: d7e8f9a0b1c2
Create Date: 2026-08-12 18:50:00.000000

gennis-v2 and turon-v2 both read and write this one `user` table, and both
reject a username that already exists — gennis in each of its five register
paths, turon in ensure_username_available. But the column carried no unique
constraint, so those checks were advisory: two registrations racing, one in each
app, can both pass the check and both insert.

An exact duplicate is not a cosmetic problem. Login looks a user up with

    select(User).where(User.username == login).scalar_one_or_none()

and scalar_one_or_none() raises MultipleResultsFound on two rows — so a
duplicate locks BOTH accounts out, not just the newer one, and no amount of
retrying helps.

There are 0 exact duplicates today, so this applies cleanly and makes the race
impossible rather than merely unlikely.

Deliberately case-SENSITIVE. 84 usernames currently differ only by case
(aziza / Aziza / AZIZA), which a case-insensitive index would reject outright,
and each of those accounts logs in fine today because the lookup is exact. That
cleanup renames people's logins and needs to be decided and communicated
separately; this constraint is the part that can be done without asking anyone
to change how they sign in.

NULL usernames are unaffected — Postgres allows any number of them in a unique
constraint, which is right here: some accounts have no username at all.
"""
from typing import Sequence, Union
from alembic import op

revision: str = 'e8f9a0b1c2d3'
down_revision: Union[str, None] = 'd7e8f9a0b1c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint("uq_user_username", "user", ["username"])


def downgrade() -> None:
    op.drop_constraint("uq_user_username", "user", type_="unique")
