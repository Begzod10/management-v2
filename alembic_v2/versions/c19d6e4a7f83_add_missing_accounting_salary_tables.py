"""add missing gennis_* accounting/salary/black-salary tables

Revision ID: c19d6e4a7f83
Revises: b7d4f2a08e31
Create Date: 2026-07-15 12:00:00.000000

These 23 tables have had SQLAlchemy models in gennis-v2's
external_models/management.py for a while (accounting: account/
account_payable/capital/overhead/fine-report; salary: teacher/
assistent/staff salary + payments + black-salary; misc: book payment,
student charity, deleted teacher, phone list) but nobody ever wrote
the matching management-v2 migration, so the tables never existed in
production — every query against them (e.g. POST /accounting/payments
touching gennis_teacher_black_salary_entry) 500ed with
UndefinedColumnError/UndefinedTableError.

No explicit ForeignKeyConstraints to pre-existing core tables
(payment_type, overhead_type) — same plain-Integer-column convention
used by every other gennis_* mirror table in this migration chain.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c19d6e4a7f83'
down_revision: Union[str, Sequence[str], None] = 'b7d4f2a08e31'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'gennis_account',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('type_account', sa.String(length=20), nullable=False),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('total_sum', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('payment_sum', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('remaining_sum', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('done', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'gennis_capital_expenditure',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('item_name', sa.String(length=500), nullable=False),
        sa.Column('item_sum', sa.BigInteger(), nullable=False),
        sa.Column('channel', sa.String(length=100), nullable=True),
        sa.Column('payment_type_id', sa.Integer(), nullable=True),
        sa.Column('location_id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('calendar_month', sa.Integer(), nullable=False),
        sa.Column('calendar_year', sa.Integer(), nullable=False),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('deleted_reason', sa.String(length=500), nullable=True),
        sa.Column('created_by', sa.BigInteger(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'gennis_teacher_salary',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('teacher_id', sa.Integer(), nullable=True),
        sa.Column('teacher_name', sa.String(length=511), nullable=True),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('total_salary', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('taken_money', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('black_salary', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('debt', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('fine', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('remaining_salary', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('calendar_month', sa.Integer(), nullable=False),
        sa.Column('calendar_year', sa.Integer(), nullable=False),
        sa.Column('synced_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'gennis_assistent_salary',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('assistent_id', sa.Integer(), nullable=True),
        sa.Column('assistent_name', sa.String(length=511), nullable=True),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('total_salary', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('taken_money', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('black_salary', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('debt', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('fine', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('remaining_salary', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('calendar_month', sa.Integer(), nullable=False),
        sa.Column('calendar_year', sa.Integer(), nullable=False),
        sa.Column('synced_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'gennis_staff_salary',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('staff_id', sa.Integer(), nullable=True),
        sa.Column('staff_name', sa.String(length=511), nullable=True),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('total_salary', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('taken_money', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('remaining_salary', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('deleted_date', sa.DateTime(), nullable=True),
        sa.Column('deleted_comment', sa.Text(), nullable=True),
        sa.Column('calendar_month', sa.Integer(), nullable=False),
        sa.Column('calendar_year', sa.Integer(), nullable=False),
        sa.Column('synced_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'gennis_account_payable',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('account_id', sa.BigInteger(), nullable=False),
        sa.Column('payment_type_id', sa.Integer(), nullable=True),
        sa.Column('amount_sum', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('desc', sa.String(length=500), nullable=True),
        sa.Column('type_account', sa.String(length=20), nullable=True),
        sa.Column('calendar_day', sa.Integer(), nullable=True),
        sa.Column('calendar_month', sa.Integer(), nullable=False),
        sa.Column('calendar_year', sa.Integer(), nullable=False),
        sa.Column('finished', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('deleted_comment', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['account_id'], ['gennis_account.id']),
    )

    op.create_table(
        'gennis_account_payable_history',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('account_id', sa.BigInteger(), nullable=False),
        sa.Column('payment_type_id', sa.Integer(), nullable=True),
        sa.Column('sum', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('type_account', sa.String(length=20), nullable=True),
        sa.Column('calendar_day', sa.Integer(), nullable=True),
        sa.Column('calendar_month', sa.Integer(), nullable=False),
        sa.Column('calendar_year', sa.Integer(), nullable=False),
        sa.Column('reason', sa.String(length=500), nullable=True),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('deleted_reason', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['account_id'], ['gennis_account.id']),
    )

    op.create_table(
        'gennis_account_report',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('payment_type_id', sa.Integer(), nullable=True),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('calendar_month', sa.Integer(), nullable=False),
        sa.Column('calendar_year', sa.Integer(), nullable=False),
        sa.Column('all_dividend', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('all_salaries', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('all_overheads', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('payable', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('receivables', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('sub_payable', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('sub_receivables', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('balance', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'gennis_assistent_black_salary',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('assistent_id', sa.Integer(), nullable=True),
        sa.Column('total_salary', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('calendar_month', sa.Integer(), nullable=False),
        sa.Column('calendar_year', sa.Integer(), nullable=False),
        sa.Column('status', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('synced_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'gennis_assistent_salary_payment',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('assistent_id', sa.Integer(), nullable=True),
        sa.Column('assistent_name', sa.String(length=511), nullable=True),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('payment_sum', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('channel', sa.String(length=100), nullable=True),
        sa.Column('payment_type_id', sa.Integer(), nullable=True),
        sa.Column('paid_date', sa.Date(), nullable=True),
        sa.Column('calendar_month', sa.Integer(), nullable=False),
        sa.Column('calendar_year', sa.Integer(), nullable=False),
        sa.Column('reason', sa.String(length=500), nullable=True),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('synced_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'gennis_capital_term',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('capital_id', sa.BigInteger(), nullable=False),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('calendar_month', sa.Integer(), nullable=False),
        sa.Column('calendar_year', sa.Integer(), nullable=False),
        sa.Column('down_cost', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['capital_id'], ['gennis_capital_expenditure.id']),
    )

    op.create_table(
        'gennis_deleted_capital_expenditure',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('original_id', sa.BigInteger(), nullable=True),
        sa.Column('item_name', sa.String(length=500), nullable=False),
        sa.Column('item_sum', sa.BigInteger(), nullable=False),
        sa.Column('channel', sa.String(length=100), nullable=True),
        sa.Column('payment_type_id', sa.Integer(), nullable=True),
        sa.Column('location_id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('calendar_month', sa.Integer(), nullable=False),
        sa.Column('calendar_year', sa.Integer(), nullable=False),
        sa.Column('created_by', sa.BigInteger(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('deleted_date', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('deleted_reason', sa.String(length=500), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'gennis_deleted_overhead',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('original_id', sa.BigInteger(), nullable=True),
        sa.Column('item_name', sa.String(length=500), nullable=False),
        sa.Column('item_sum', sa.BigInteger(), nullable=False),
        sa.Column('overhead_type_id', sa.Integer(), nullable=True),
        sa.Column('channel', sa.String(length=100), nullable=True),
        sa.Column('payment_type_id', sa.Integer(), nullable=True),
        sa.Column('location_id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('calendar_month', sa.Integer(), nullable=False),
        sa.Column('calendar_year', sa.Integer(), nullable=False),
        sa.Column('created_by', sa.BigInteger(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('deleted_date', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('deleted_reason', sa.String(length=500), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'gennis_deleted_student_book_payment',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('payment_sum', sa.BigInteger(), nullable=False),
        sa.Column('calendar_month', sa.Integer(), nullable=False),
        sa.Column('calendar_year', sa.Integer(), nullable=False),
        sa.Column('original_id', sa.BigInteger(), nullable=True),
        sa.Column('deleted_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'gennis_deleted_teacher',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('teacher_id', sa.Integer(), nullable=True),
        sa.Column('calendar_day', sa.Integer(), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('synced_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'gennis_fine_report',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('teacher_salary_id', sa.BigInteger(), nullable=True),
        sa.Column('assistent_salary_id', sa.BigInteger(), nullable=True),
        sa.Column('calendar_month', sa.Integer(), nullable=False),
        sa.Column('calendar_year', sa.Integer(), nullable=False),
        sa.Column('amount', sa.BigInteger(), nullable=False),
        sa.Column('reason', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['teacher_salary_id'], ['gennis_teacher_salary.id']),
        sa.ForeignKeyConstraint(['assistent_salary_id'], ['gennis_assistent_salary.id']),
    )

    op.create_table(
        'gennis_overhead',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('item_name', sa.String(length=500), nullable=False),
        sa.Column('item_sum', sa.BigInteger(), nullable=False),
        sa.Column('overhead_type_id', sa.Integer(), nullable=True),
        sa.Column('channel', sa.String(length=100), nullable=True),
        sa.Column('payment_type_id', sa.Integer(), nullable=True),
        sa.Column('location_id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('calendar_month', sa.Integer(), nullable=False),
        sa.Column('calendar_year', sa.Integer(), nullable=False),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('deleted_reason', sa.String(length=500), nullable=True),
        sa.Column('created_by', sa.BigInteger(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'gennis_phone_list',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('synced_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'gennis_staff_salary_payment',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('staff_id', sa.Integer(), nullable=True),
        sa.Column('staff_name', sa.String(length=511), nullable=True),
        sa.Column('job', sa.String(length=255), nullable=True),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('payment_sum', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('channel', sa.String(length=100), nullable=True),
        sa.Column('payment_type_id', sa.Integer(), nullable=True),
        sa.Column('paid_date', sa.Date(), nullable=True),
        sa.Column('calendar_month', sa.Integer(), nullable=False),
        sa.Column('calendar_year', sa.Integer(), nullable=False),
        sa.Column('reason', sa.String(length=500), nullable=True),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('synced_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'gennis_student_book_payment',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('payment_sum', sa.BigInteger(), nullable=False),
        sa.Column('calendar_month', sa.Integer(), nullable=False),
        sa.Column('calendar_year', sa.Integer(), nullable=False),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'gennis_student_charity',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=True),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('discount', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('calendar_month', sa.Integer(), nullable=False),
        sa.Column('calendar_year', sa.Integer(), nullable=False),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'gennis_teacher_black_salary_entry',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('teacher_salary_id', sa.BigInteger(), nullable=True),
        sa.Column('assistent_salary_id', sa.BigInteger(), nullable=True),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('amount', sa.BigInteger(), nullable=False),
        sa.Column('status', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('student_payment_id', sa.BigInteger(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['teacher_salary_id'], ['gennis_teacher_salary.id']),
        sa.ForeignKeyConstraint(['assistent_salary_id'], ['gennis_assistent_salary.id']),
    )

    op.create_table(
        'gennis_teacher_salary_payment',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('teacher_id', sa.Integer(), nullable=True),
        sa.Column('teacher_name', sa.String(length=511), nullable=True),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('payment_sum', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('channel', sa.String(length=100), nullable=True),
        sa.Column('payment_type_id', sa.Integer(), nullable=True),
        sa.Column('paid_date', sa.Date(), nullable=True),
        sa.Column('calendar_month', sa.Integer(), nullable=False),
        sa.Column('calendar_year', sa.Integer(), nullable=False),
        sa.Column('reason', sa.String(length=500), nullable=True),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('synced_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('gennis_teacher_salary_payment')
    op.drop_table('gennis_teacher_black_salary_entry')
    op.drop_table('gennis_student_charity')
    op.drop_table('gennis_student_book_payment')
    op.drop_table('gennis_staff_salary_payment')
    op.drop_table('gennis_phone_list')
    op.drop_table('gennis_overhead')
    op.drop_table('gennis_fine_report')
    op.drop_table('gennis_deleted_teacher')
    op.drop_table('gennis_deleted_student_book_payment')
    op.drop_table('gennis_deleted_overhead')
    op.drop_table('gennis_deleted_capital_expenditure')
    op.drop_table('gennis_capital_term')
    op.drop_table('gennis_assistent_salary_payment')
    op.drop_table('gennis_assistent_black_salary')
    op.drop_table('gennis_account_report')
    op.drop_table('gennis_account_payable_history')
    op.drop_table('gennis_account_payable')
    op.drop_table('gennis_staff_salary')
    op.drop_table('gennis_assistent_salary')
    op.drop_table('gennis_teacher_salary')
    op.drop_table('gennis_capital_expenditure')
    op.drop_table('gennis_account')
