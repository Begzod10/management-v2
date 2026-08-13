"""link a student registration to the gennis_student row it became

A self-service registration is only a signup form until an admin enrols it in a
group. At that point it is materialised into a real gennis_student row, and this
column records which one — so the registration stops being offered as a candidate
and there is one unambiguous answer to "has this signup become a student yet?".

Revision ID: d7f2a9c4b183
Revises: 0e6343dbb45e
Create Date: 2026-08-13 17:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'd7f2a9c4b183'
down_revision: Union[str, Sequence[str], None] = '0e6343dbb45e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'gennis_student_registration',
        sa.Column('student_id', sa.BigInteger(), nullable=True),
    )
    op.create_foreign_key(
        'fk_gsr_student_id', 'gennis_student_registration', 'gennis_student',
        ['student_id'], ['id'],
    )
    op.create_index(
        'ix_gsr_student_id', 'gennis_student_registration', ['student_id'],
    )


def downgrade() -> None:
    op.drop_index('ix_gsr_student_id', table_name='gennis_student_registration')
    op.drop_constraint('fk_gsr_student_id', 'gennis_student_registration', type_='foreignkey')
    op.drop_column('gennis_student_registration', 'student_id')
