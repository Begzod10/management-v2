"""add accounting extended tables: account_report, account payable, fine_report, capital_term, charity, book_payment, black_salary_entry

Revision ID: b1c2d3e4f5a6
Revises: a9b8c7d6e5f4
Create Date: 2026-06-29 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, None] = 'a9b8c7d6e5f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'gennis_account_report',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('payment_type_id', sa.Integer(), sa.ForeignKey('payment_type.id'), nullable=True),
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
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()')),
    )

    op.create_table(
        'gennis_account',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('type_account', sa.String(20), nullable=False),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('total_sum', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('payment_sum', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('remaining_sum', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('done', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
    )

    op.create_table(
        'gennis_account_payable',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('account_id', sa.BigInteger(), sa.ForeignKey('gennis_account.id'), nullable=False),
        sa.Column('payment_type_id', sa.Integer(), sa.ForeignKey('payment_type.id'), nullable=True),
        sa.Column('amount_sum', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('desc', sa.String(500), nullable=True),
        sa.Column('type_account', sa.String(20), nullable=True),
        sa.Column('calendar_day', sa.Integer(), nullable=True),
        sa.Column('calendar_month', sa.Integer(), nullable=False),
        sa.Column('calendar_year', sa.Integer(), nullable=False),
        sa.Column('finished', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_comment', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
    )

    op.create_table(
        'gennis_account_payable_history',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('account_id', sa.BigInteger(), sa.ForeignKey('gennis_account.id'), nullable=False),
        sa.Column('payment_type_id', sa.Integer(), sa.ForeignKey('payment_type.id'), nullable=True),
        sa.Column('sum', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('type_account', sa.String(20), nullable=True),
        sa.Column('calendar_day', sa.Integer(), nullable=True),
        sa.Column('calendar_month', sa.Integer(), nullable=False),
        sa.Column('calendar_year', sa.Integer(), nullable=False),
        sa.Column('reason', sa.String(500), nullable=True),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_reason', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
    )

    op.create_table(
        'gennis_fine_report',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('teacher_salary_id', sa.BigInteger(), sa.ForeignKey('gennis_teacher_salary.id'), nullable=True),
        sa.Column('assistent_salary_id', sa.BigInteger(), sa.ForeignKey('gennis_assistent_salary.id'), nullable=True),
        sa.Column('calendar_month', sa.Integer(), nullable=False),
        sa.Column('calendar_year', sa.Integer(), nullable=False),
        sa.Column('amount', sa.BigInteger(), nullable=False),
        sa.Column('reason', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
    )

    op.create_table(
        'gennis_capital_term',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('capital_id', sa.BigInteger(), sa.ForeignKey('gennis_capital_expenditure.id'), nullable=False),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('calendar_month', sa.Integer(), nullable=False),
        sa.Column('calendar_year', sa.Integer(), nullable=False),
        sa.Column('down_cost', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
    )

    op.create_table(
        'gennis_student_charity',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=True),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('discount', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('calendar_month', sa.Integer(), nullable=False),
        sa.Column('calendar_year', sa.Integer(), nullable=False),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
    )

    op.create_table(
        'gennis_student_book_payment',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('payment_sum', sa.BigInteger(), nullable=False),
        sa.Column('calendar_month', sa.Integer(), nullable=False),
        sa.Column('calendar_year', sa.Integer(), nullable=False),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
    )

    op.create_table(
        'gennis_deleted_student_book_payment',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('payment_sum', sa.BigInteger(), nullable=False),
        sa.Column('calendar_month', sa.Integer(), nullable=False),
        sa.Column('calendar_year', sa.Integer(), nullable=False),
        sa.Column('original_id', sa.BigInteger(), nullable=True),
        sa.Column('deleted_at', sa.DateTime(), server_default=sa.text('now()')),
    )

    op.create_table(
        'gennis_teacher_black_salary_entry',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('teacher_salary_id', sa.BigInteger(), sa.ForeignKey('gennis_teacher_salary.id'), nullable=True),
        sa.Column('assistent_salary_id', sa.BigInteger(), sa.ForeignKey('gennis_assistent_salary.id'), nullable=True),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('amount', sa.BigInteger(), nullable=False),
        sa.Column('status', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('student_payment_id', sa.BigInteger(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
    )


def downgrade() -> None:
    op.drop_table('gennis_teacher_black_salary_entry')
    op.drop_table('gennis_deleted_student_book_payment')
    op.drop_table('gennis_student_book_payment')
    op.drop_table('gennis_student_charity')
    op.drop_table('gennis_capital_term')
    op.drop_table('gennis_fine_report')
    op.drop_table('gennis_account_payable_history')
    op.drop_table('gennis_account_payable')
    op.drop_table('gennis_account')
    op.drop_table('gennis_account_report')
