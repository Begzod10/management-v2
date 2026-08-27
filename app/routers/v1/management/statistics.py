from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, desc
from typing import Optional, List
from datetime import date, timedelta

from app.database import get_gennis_db, get_turon_db, get_db
from app.external_models import gennis as G
from app.external_models import turon as T
from app.models import Dividend, Investment, ApiLog
from app.external_models.turon import TuronApiLog, TuronCustomUser
from app.external_models.gennis import GennisApiLog, Users as GennisUsers
from app.models import User
from app.models import (
    PaymentType,
    TuronStudentPaymentV2,
    TuronTeacherSalaryPaymentV2,
    TuronStaffSalaryPaymentV2,
    TuronOverheadTypeV2,
    TuronOverheadV2,
    TuronCapitalV2,
    TuronBranchTransactionV2,
    GennisStudentPaymentLive,
    GennisTeacherSalaryPaymentLive,
    GennisStaffSalaryPaymentLive,
    GennisOverheadLive,
    GennisCapitalExpenditureLive,
    GennisBranchTransactionLive,
)
from app.schemas_stats import (
    ByPaymentType, BranchTransactionTotals,
    GennisOverheadSummary, TuronOverheadSummary,
    GennisSummary, TuronSummary, OverviewOut,
    ApiUsageItem, ApiUsageByUserItem,
    TuronApiUsageItem, TuronApiUsageByUserItem,
    SectionUsageItem,
    GennisApiUsageItem, GennisApiUsageByUserItem,
)

# Section prefix rules — longest prefix must come first so matching is unambiguous
_MANAGEMENT_SECTIONS = [
    ("/api/v1/salary-months",            "Oylik maoshlar"),
    ("/api/v1/salary-days",              "Kunlik maoshlar"),
    ("/api/v1/system-models",            "Tizim modellari"),
    ("/api/v1/missions",                 "Topshiriqlar"),
    ("/api/v1/statistics",               "Statistika"),
    ("/api/v1/projects",                 "Loyihalar"),
    ("/api/v1/sections",                 "Bo'limlar"),
    ("/api/v1/branches",                 "Filiallar"),
    ("/api/v1/dividends",                "Dividendlar"),
    ("/api/v1/investments",              "Investitsiyalar"),
    ("/api/v1/notifications",            "Bildirishnomalar"),
    ("/api/v1/combined",                 "Umumiy moliyaviy hisobot"),
    ("/api/v1/calendar",                 "Taqvim"),
    ("/api/v1/telegram",                 "Telegram bot"),
    ("/api/v1/users",                    "Foydalanuvchilar"),
    ("/api/v1/tags",                     "Teglar"),
    ("/api/v1/jobs",                     "Lavozimlar"),
    ("/api/v1/auth",                     "Kirish / Chiqish"),
    ("/api/v1/turon/students",           "Turon — Talabalar"),
    ("/api/v1/turon/teachers",           "Turon — O'qituvchilar"),
    ("/api/v1/turon/classes",            "Turon — Guruhlar"),
    ("/api/v1/turon/timetable",          "Turon — Dars jadvali"),
    ("/api/v1/turon/terms",              "Turon — Semestrlar"),
    ("/api/v1/turon",                    "Turon"),
    ("/api/v1/gennis",                   "Gennis"),
]

_GENNIS_SECTIONS = [
    # Missions and sub-records (longest prefix first)
    ("/api/missions",                   "Topshiriqlar"),
    ("/api/comment",                    "Topshiriq — Izohlar"),
    ("/api/proofs",                     "Topshiriq — Hisobotlar"),
    ("/api/attachments",                "Topshiriq — Fayllar"),
    ("/api/subtasks",                   "Topshiriq — Kichik vazifalar"),
    ("/api/notifications",              "Bildirishnomalar"),
    ("/api/tags",                       "Teglar"),
    ("/api/task_rating",                "Vazifa reytingi"),
    ("/api/task_debts",                 "Qarz vazifalari"),
    ("/api/task_new_students",          "Yangi o'quvchi vazifalari"),
    ("/api/task_leads",                 "Lid vazifalari"),
    # Students
    ("/api/student",                    "Talabalar"),
    # Teachers and assistants (assistent before teacher)
    ("/api/teacher/assistent",          "Assistentlar"),
    ("/api/teacher",                    "O'qituvchilar"),
    # Account / Finance (sub-paths before generic /api/account)
    ("/api/account/home/",              "Bosh sahifa — moliya"),
    ("/api/account/daily_datas/",       "Kunlik moliyaviy ma'lumotlar"),
    ("/api/account",                    "Moliya / Hisob"),
    # Groups (specific before generic)
    ("/api/group_classroom_attendance", "Sinf — Davomat"),
    ("/api/group_classroom_profile",    "Sinf — Profil"),
    ("/api/group_classroom_test",       "Sinf — Testlar"),
    ("/api/group_classroom",            "Sinf xonasi guruhlari"),
    ("/api/group_change",               "Guruh o'zgartirish"),
    ("/api/group_test",                 "Guruh testlari"),
    ("/api/create_group",               "Guruh yaratish"),
    ("/api/group",                      "Guruhlar"),
    # Time table & rooms
    ("/api/time_table",                 "Dars jadvali"),
    ("/api/room",                       "Xonalar"),
    # School
    ("/api/school",                     "Maktab"),
    # Leads
    ("/api/lead",                       "Lidlar"),
    # Books
    ("/api/book",                       "Kitoblar"),
    # Parents & mobile
    ("/api/parent",                     "Ota-onalar"),
    ("/api/mobile",                     "Mobil"),
    # Home page & reports
    ("/api/home_page",                  "Bosh sahifa"),
    ("/api/reports",                    "Hisobotlar"),
    ("/api/chat-analyzer",              "Chat tahlili"),
    # Auth & base
    ("/api/base",                       "Asosiy"),
    ("/api/checks",                     "Tekshiruvlar"),
    ("/api/classroom",                  "Sinf xonasi"),
    # Bot & integrations
    ("/api/bot/parents",                "Bot — Ota-onalar"),
    ("/api/bot/students",               "Bot — O'quvchilar"),
    ("/api/bot/teachers",               "Bot — O'qituvchilar"),
    ("/api/bot/users",                  "Bot — Foydalanuvchilar"),
    ("/api/bot",                        "Bot"),
    # Dev/utility
    ("/api/programmers_basic",          "Dasturchilar — Yangiliklar"),
    ("/api/programmers",                "Dasturchilar"),
    ("/api/uploads",                    "Fayllar yuklash"),
    ("/api",                            "Boshqa"),
]

_TURON_SECTIONS = [
    # Timetables (specific before generic)
    ("/api/SchoolTimeTable/",           "Maktab dars jadvali"),
    ("/api/Lesson_plan/",               "Dars rejalari"),
    ("/api/TimeTable/",                 "Guruh dars jadvali"),
    # Attendance
    ("/api/Attendance/",                "Davomat"),
    # Finance
    ("/api/Encashment/",                "Inkassatsiya"),
    ("/api/Overhead/",                  "Xarajatlar"),
    ("/api/Capital/",                   "Kapital"),
    ("/api/Payments/",                  "To'lov turlari"),
    # People
    ("/api/Students/",                  "Talabalar"),
    ("/api/Teachers/",                  "O'qituvchilar"),
    ("/api/Users/",                     "Foydalanuvchilar"),
    ("/api/parents/",                   "Ota-onalar"),
    # Academic structure
    ("/api/Group/",                     "Guruhlar"),
    ("/api/Class/",                     "Sinflar"),
    ("/api/Flow/",                      "Oqimlar"),
    ("/api/Subjects/",                  "Fanlar"),
    ("/api/Rooms/",                     "Xonalar"),
    ("/api/Branch/",                    "Filiallar"),
    ("/api/Location/",                  "Joylashuvlar"),
    ("/api/System/",                    "Tizim"),
    ("/api/Language/",                  "Tillar"),
    ("/api/Permissions/",               "Ruxsatnomalar"),
    # Tasks & missions
    ("/api/Tasks/",                     "Topshiriqlar"),
    # Observation
    ("/api/Observation/",               "Kuzatuvlar"),
    # Leads & books
    ("/api/Lead/",                      "Lidlar"),
    ("/api/Books/",                     "Kitoblar"),
    # Calendar, bot, parties
    ("/api/Calendar/",                  "Taqvim"),
    ("/api/Bot/",                       "Bot"),
    ("/api/Parties/",                   "Partiyalar / Klublar"),
    # Reports, surveys, calls
    ("/api/reports/",                   "Hisobotlar"),
    ("/api/surveys/",                   "So'rovnomalar"),
    ("/api/call/",                      "Qo'ng'iroqlar"),
    # Investor portal
    ("/api/v1/investor/",               "Investorlar"),
    # UI / frontend content
    ("/api/Ui/",                        "Interfeys kontenti"),
    # Mobile (sub-sections first)
    ("/api/Mobile/teachers/missions/",  "Mobil — O'qituvchi topshiriqlari"),
    ("/api/Mobile/teachers/observation/","Mobil — O'qituvchi kuzatuvi"),
    ("/api/Mobile/teachers/",           "Mobil — O'qituvchilar"),
    ("/api/Mobile/parents/",            "Mobil — Ota-onalar"),
    ("/api/Mobile/",                    "Mobil"),
    # Terms / academic periods
    ("/api/terms/",                     "Semestrlar"),
    # Auth
    ("/api/token/",                     "Kirish / Chiqish"),
    # Utility endpoints
    ("/api/get_user/",                  "Foydalanuvchi ma'lumoti"),
    ("/api/set_observer/",              "Kuzatuvchi belgilash"),
    ("/api/update_group_datas/",        "Guruh ma'lumotlari"),
    ("/api/get_group_datas/",           "Guruh ma'lumotlari"),
    ("/api/schema/",                    "API sxemasi"),
    ("/api/docs/",                      "Hujjatlar"),
    ("/api/redoc/",                     "Hujjatlar"),
    ("/api/admin/",                     "Admin panel"),
]


def _classify(path: str, rules: list) -> str:
    for prefix, label in rules:
        if path.startswith(prefix):
            return label
    return "Boshqa"


def _aggregate_sections(rows, rules):
    sections: dict[str, dict] = {}
    for r in rows:
        label = _classify(r.path, rules)
        if label not in sections:
            sections[label] = {"total": 0, "weighted_ms": 0.0}
        sections[label]["total"] += r.total
        sections[label]["weighted_ms"] += (r.avg_ms or 0) * r.total

    grand_total = sum(v["total"] for v in sections.values()) or 1
    result = []
    for label, v in sections.items():
        result.append({
            "section": label,
            "total_requests": v["total"],
            "percentage": round(v["total"] / grand_total * 100, 1),
            "avg_response_ms": round(v["weighted_ms"] / v["total"], 1) if v["total"] else 0.0,
        })
    return sorted(result, key=lambda x: x["total_requests"], reverse=True)

router = APIRouter(prefix="/statistics", tags=["Statistics"])


# ─── API Usage ────────────────────────────────────────────────────────────────

@router.get("/api-usage", response_model=List[ApiUsageItem], tags=["API Usage"])
def api_usage(
    limit: int = Query(50, ge=1, le=200),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """Most and least used API endpoints by request count."""
    q = db.query(
        ApiLog.method,
        ApiLog.path,
        func.count(ApiLog.id).label("total"),
        func.avg(ApiLog.response_time_ms).label("avg_ms"),
    )
    if from_date:
        q = q.filter(ApiLog.created_at >= from_date)
    if to_date:
        q = q.filter(ApiLog.created_at < to_date + timedelta(days=1))
    rows = q.group_by(ApiLog.method, ApiLog.path).order_by(desc("total")).limit(limit).all()

    grand_total = sum(r.total for r in rows) or 1
    return [
        {
            "method": r.method,
            "path": r.path,
            "total_requests": r.total,
            "percentage": round(r.total / grand_total * 100, 1),
            "avg_response_ms": round(r.avg_ms or 0, 1),
        }
        for r in rows
    ]


@router.get("/api-usage/by-user", response_model=List[ApiUsageByUserItem], tags=["API Usage"])
def api_usage_by_user(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Request counts per user."""
    q = db.query(
        ApiLog.user_id,
        User.name,
        User.surname,
        func.count(ApiLog.id).label("total"),
    ).outerjoin(User, User.id == ApiLog.user_id).filter(ApiLog.user_id.isnot(None))
    if from_date:
        q = q.filter(ApiLog.created_at >= from_date)
    if to_date:
        q = q.filter(ApiLog.created_at < to_date + timedelta(days=1))
    rows = q.group_by(ApiLog.user_id, User.name, User.surname).order_by(desc("total")).limit(limit).all()
    grand_total = sum(r.total for r in rows) or 1
    return [
        {
            "user_id": r.user_id,
            "name": r.name,
            "surname": r.surname,
            "total_requests": r.total,
            "percentage": round(r.total / grand_total * 100, 1),
        }
        for r in rows
    ]


@router.get("/api-usage/unknown-paths", tags=["API Usage"])
def api_usage_unknown_paths(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """Show paths that fall into 'Boshqa' — not matched by any section rule."""
    q = db.query(
        ApiLog.path,
        func.count(ApiLog.id).label("total"),
    )
    if from_date:
        q = q.filter(ApiLog.created_at >= from_date)
    if to_date:
        q = q.filter(ApiLog.created_at < to_date + timedelta(days=1))
    rows = q.group_by(ApiLog.path).order_by(desc("total")).all()

    return [
        {"path": r.path, "total_requests": r.total}
        for r in rows
        if _classify(r.path, _MANAGEMENT_SECTIONS) == "Boshqa"
    ]


@router.get("/api-usage/by-section", response_model=List[SectionUsageItem], tags=["API Usage"])
def api_usage_by_section(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """Total usage grouped by feature section (all mission routes combined, all salary routes combined, etc.)."""
    q = db.query(
        ApiLog.path,
        func.count(ApiLog.id).label("total"),
        func.avg(ApiLog.response_time_ms).label("avg_ms"),
    )
    if from_date:
        q = q.filter(ApiLog.created_at >= from_date)
    if to_date:
        q = q.filter(ApiLog.created_at < to_date + timedelta(days=1))
    rows = q.group_by(ApiLog.path).all()
    return _aggregate_sections(rows, _MANAGEMENT_SECTIONS)


# ─── Turon API Usage ─────────────────────────────────────────────────────────

@router.get("/turon/api-usage", response_model=List[TuronApiUsageItem], tags=["API Usage"])
def turon_api_usage(
    limit: int = Query(50, ge=1, le=200),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    db: Session = Depends(get_turon_db),
):
    """Most and least used Turon API endpoints by request count."""
    q = db.query(
        TuronApiLog.method,
        TuronApiLog.path,
        func.count(TuronApiLog.id).label("total"),
        func.avg(TuronApiLog.response_time_ms).label("avg_ms"),
    )
    if from_date:
        q = q.filter(TuronApiLog.created_at >= from_date)
    if to_date:
        q = q.filter(TuronApiLog.created_at < to_date + timedelta(days=1))
    rows = q.group_by(TuronApiLog.method, TuronApiLog.path).order_by(desc("total")).limit(limit).all()
    grand_total = sum(r.total for r in rows) or 1
    return [
        {
            "method": r.method,
            "path": r.path,
            "total_requests": r.total,
            "percentage": round(r.total / grand_total * 100, 1),
            "avg_response_ms": round(r.avg_ms or 0, 1),
        }
        for r in rows
    ]


@router.get("/turon/api-usage/by-user", response_model=List[TuronApiUsageByUserItem], tags=["API Usage"])
def turon_api_usage_by_user(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_turon_db),
):
    """Request counts per user in Turon."""
    q = db.query(
        TuronApiLog.user_id,
        TuronCustomUser.name,
        TuronCustomUser.surname,
        func.count(TuronApiLog.id).label("total"),
    ).outerjoin(TuronCustomUser, TuronCustomUser.id == TuronApiLog.user_id).filter(TuronApiLog.user_id.isnot(None))
    if from_date:
        q = q.filter(TuronApiLog.created_at >= from_date)
    if to_date:
        q = q.filter(TuronApiLog.created_at < to_date + timedelta(days=1))
    rows = q.group_by(TuronApiLog.user_id, TuronCustomUser.name, TuronCustomUser.surname).order_by(desc("total")).limit(limit).all()
    grand_total = sum(r.total for r in rows) or 1
    return [
        {
            "user_id": r.user_id,
            "name": r.name,
            "surname": r.surname,
            "total_requests": r.total,
            "percentage": round(r.total / grand_total * 100, 1),
        }
        for r in rows
    ]


@router.get("/turon/api-usage/by-section", response_model=List[SectionUsageItem], tags=["API Usage"])
def turon_api_usage_by_section(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    db: Session = Depends(get_turon_db),
):
    """Turon total usage grouped by feature section."""
    q = db.query(
        TuronApiLog.path,
        func.count(TuronApiLog.id).label("total"),
        func.avg(TuronApiLog.response_time_ms).label("avg_ms"),
    )
    if from_date:
        q = q.filter(TuronApiLog.created_at >= from_date)
    if to_date:
        q = q.filter(TuronApiLog.created_at < to_date + timedelta(days=1))
    rows = q.group_by(TuronApiLog.path).all()
    return _aggregate_sections(rows, _TURON_SECTIONS)


# ─── Gennis API Usage ─────────────────────────────────────────────────────────

@router.get("/gennis/api-usage", response_model=List[GennisApiUsageItem], tags=["API Usage"])
def gennis_api_usage(
    limit: int = Query(50, ge=1, le=200),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    db: Session = Depends(get_gennis_db),
):
    """Most and least used Gennis API endpoints by request count."""
    q = db.query(
        GennisApiLog.method,
        GennisApiLog.path,
        func.count(GennisApiLog.id).label("total"),
        func.avg(GennisApiLog.response_time_ms).label("avg_ms"),
    )
    if from_date:
        q = q.filter(GennisApiLog.created_at >= from_date)
    if to_date:
        q = q.filter(GennisApiLog.created_at < to_date + timedelta(days=1))
    rows = q.group_by(GennisApiLog.method, GennisApiLog.path).order_by(desc("total")).limit(limit).all()
    grand_total = sum(r.total for r in rows) or 1
    return [
        {
            "method": r.method,
            "path": r.path,
            "total_requests": r.total,
            "percentage": round(r.total / grand_total * 100, 1),
            "avg_response_ms": round(r.avg_ms or 0, 1),
        }
        for r in rows
    ]


@router.get("/gennis/api-usage/by-user", response_model=List[GennisApiUsageByUserItem], tags=["API Usage"])
def gennis_api_usage_by_user(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_gennis_db),
):
    """Request counts per user in Gennis."""
    q = db.query(
        GennisApiLog.user_id,
        GennisUsers.name,
        GennisUsers.surname,
        func.count(GennisApiLog.id).label("total"),
    ).outerjoin(GennisUsers, GennisUsers.id == GennisApiLog.user_id).filter(GennisApiLog.user_id.isnot(None))
    if from_date:
        q = q.filter(GennisApiLog.created_at >= from_date)
    if to_date:
        q = q.filter(GennisApiLog.created_at < to_date + timedelta(days=1))
    rows = q.group_by(GennisApiLog.user_id, GennisUsers.name, GennisUsers.surname).order_by(desc("total")).limit(limit).all()
    grand_total = sum(r.total for r in rows) or 1
    return [
        {
            "user_id": r.user_id,
            "name": r.name,
            "surname": r.surname,
            "total_requests": r.total,
            "percentage": round(r.total / grand_total * 100, 1),
        }
        for r in rows
    ]


@router.get("/gennis/api-usage/by-section", response_model=List[SectionUsageItem], tags=["API Usage"])
def gennis_api_usage_by_section(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    db: Session = Depends(get_gennis_db),
):
    """Gennis total usage grouped by feature section."""
    q = db.query(
        GennisApiLog.path,
        func.count(GennisApiLog.id).label("total"),
        func.avg(GennisApiLog.response_time_ms).label("avg_ms"),
    )
    if from_date:
        q = q.filter(GennisApiLog.created_at >= from_date)
    if to_date:
        q = q.filter(GennisApiLog.created_at < to_date + timedelta(days=1))
    rows = q.group_by(GennisApiLog.path).all()
    return _aggregate_sections(rows, _GENNIS_SECTIONS)


# ─── helpers ──────────────────────────────────────────────────────────────────

def _get_total(
    local_db: Session,
    model,
    source: str,
    month,
    year,
    location_id=None,
    branch_id=None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
) -> int:
    q = local_db.query(
        func.coalesce(func.sum(model.amount), 0)
    ).filter(model.source == source, model.deleted == False)
    if month:
        q = q.filter(extract("month", model.date) == month)
    if year:
        q = q.filter(extract("year", model.date) == year)
    if from_date:
        q = q.filter(model.date >= from_date)
    if to_date:
        q = q.filter(model.date < to_date + timedelta(days=1))
    if location_id:
        q = q.filter(model.location_id == location_id)
    if branch_id:
        q = q.filter(model.branch_id == branch_id)
    return q.scalar()



def _month_year_filter_gennis(q, model, month, year, from_date: Optional[date] = None, to_date: Optional[date] = None):
    """Apply month/year (on CalendarMonth) and from_date/to_date (on CalendarDay) filters.

    Day-precise filtering on CalendarDay matches the Gennis backend's own
    account_details route, which always bounds by the actual transaction
    day — not by the calendar_month bucket. Filtering on CalendarMonth
    would let forward/backward-dated rows leak past the date window.
    """
    if month or year:
        q = q.join(G.CalendarMonth, G.CalendarMonth.id == model.calendar_month)
        if month:
            q = q.filter(extract("month", G.CalendarMonth.date) == month)
        if year:
            q = q.filter(extract("year", G.CalendarMonth.date) == year)
    if from_date or to_date:
        q = q.join(G.CalendarDay, G.CalendarDay.id == model.calendar_day)
        if from_date:
            q = q.filter(G.CalendarDay.date >= from_date)
        if to_date:
            q = q.filter(G.CalendarDay.date < to_date + timedelta(days=1))
    return q


def _month_year_filter_turon(q, date_col, month, year, from_date: Optional[date] = None, to_date: Optional[date] = None):
    if month:
        q = q.filter(extract("month", date_col) == month)
    if year:
        q = q.filter(extract("year", date_col) == year)
    if from_date:
        q = q.filter(date_col >= from_date)
    if to_date:
        q = q.filter(date_col < to_date + timedelta(days=1))
    return q


# ─── Gennis ───────────────────────────────────────────────────────────────────

def _month_year_filter_gennis_local(q, model, date_col, month, year, from_date: Optional[date] = None, to_date: Optional[date] = None):
    """Gennis-v2's own tables carry plain calendar_month/calendar_year
    integers (not FK ids into a CalendarMonth lookup like old gennis), so
    no join is needed — and a real date column, so from_date/to_date are
    exact rather than day-precision-via-join."""
    if month:
        q = q.filter(model.calendar_month == month)
    if year:
        q = q.filter(model.calendar_year == year)
    if from_date:
        q = q.filter(date_col >= from_date)
    if to_date:
        q = q.filter(date_col < to_date + timedelta(days=1))
    return q


# ─── Gennis ───────────────────────────────────────────────────────────────────
# Reads locally (get_db → gennis-v2's own tables), NOT the external old-
# gennis DB (get_gennis_db). Old gennis has had no real activity since
# 2026-08-19 — gennis-v2 is the live system now, and its data already
# lives in this same DB (see app/models.py's "Gennis live tables" block).

@router.get("/gennis/payments", response_model=ByPaymentType)
def gennis_payments(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2000),
    location_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
):
    """Student payments in Gennis — total + breakdown by payment channel."""
    # is_real_payment == False is a discount, not a real cash/bank/click
    # payment — same "only count confirmed payments" intent as old gennis's
    # `payment == True` filter.
    rows = (
        db.query(
            GennisStudentPaymentLive.channel,
            func.coalesce(func.sum(GennisStudentPaymentLive.payment_sum), 0).label("total"),
        )
        .filter(GennisStudentPaymentLive.is_real_payment == True, GennisStudentPaymentLive.deleted == False)
    )
    rows = _month_year_filter_gennis_local(rows, GennisStudentPaymentLive, GennisStudentPaymentLive.paid_date, month, year, from_date=from_date, to_date=to_date)
    if location_id:
        rows = rows.filter(GennisStudentPaymentLive.location_id == location_id)
    rows = rows.group_by(GennisStudentPaymentLive.channel).all()

    by_type = [{"payment_type": r.channel, "total": r.total} for r in rows]
    grand_total = sum(r["total"] for r in by_type)

    return {"total": grand_total, "by_payment_type": by_type}


@router.get("/gennis/teacher-salaries", response_model=ByPaymentType)
def gennis_teacher_salaries(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2000),
    location_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
):
    """Teacher salary transactions in Gennis — total + breakdown by payment channel."""
    rows = (
        db.query(
            GennisTeacherSalaryPaymentLive.channel,
            func.coalesce(func.sum(GennisTeacherSalaryPaymentLive.payment_sum), 0).label("total"),
        )
        .filter(GennisTeacherSalaryPaymentLive.deleted == False)
    )
    rows = _month_year_filter_gennis_local(rows, GennisTeacherSalaryPaymentLive, GennisTeacherSalaryPaymentLive.paid_date, month, year, from_date=from_date, to_date=to_date)
    if location_id:
        rows = rows.filter(GennisTeacherSalaryPaymentLive.location_id == location_id)
    rows = rows.group_by(GennisTeacherSalaryPaymentLive.channel).all()

    by_type = [{"payment_type": r.channel, "total": r.total} for r in rows]
    grand_total = sum(r["total"] for r in by_type)

    return {"total": grand_total, "by_payment_type": by_type}


@router.get("/gennis/staff-salaries", response_model=ByPaymentType)
def gennis_staff_salaries(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2000),
    location_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
):
    """Staff salary transactions in Gennis — total + breakdown by payment channel."""
    rows = (
        db.query(
            GennisStaffSalaryPaymentLive.channel,
            func.coalesce(func.sum(GennisStaffSalaryPaymentLive.payment_sum), 0).label("total"),
        )
        .filter(GennisStaffSalaryPaymentLive.deleted == False)
    )
    rows = _month_year_filter_gennis_local(rows, GennisStaffSalaryPaymentLive, GennisStaffSalaryPaymentLive.paid_date, month, year, from_date=from_date, to_date=to_date)
    if location_id:
        rows = rows.filter(GennisStaffSalaryPaymentLive.location_id == location_id)
    rows = rows.group_by(GennisStaffSalaryPaymentLive.channel).all()

    by_type = [{"payment_type": r.channel, "total": r.total} for r in rows]
    grand_total = sum(r["total"] for r in by_type)

    return {"total": grand_total, "by_payment_type": by_type}


@router.get("/gennis/overheads", response_model=GennisOverheadSummary)
def gennis_overheads(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2000),
    location_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
):
    """Overhead expenses in Gennis — total + breakdown by overhead item name + by payment channel."""
    # by item name
    item_rows = (
        db.query(
            GennisOverheadLive.item_name,
            func.coalesce(func.sum(GennisOverheadLive.item_sum), 0).label("total"),
        )
        .filter(GennisOverheadLive.deleted == False)
    )
    item_rows = _month_year_filter_gennis_local(item_rows, GennisOverheadLive, GennisOverheadLive.date, month, year, from_date=from_date, to_date=to_date)
    if location_id:
        item_rows = item_rows.filter(GennisOverheadLive.location_id == location_id)
    item_rows = item_rows.group_by(GennisOverheadLive.item_name).all()

    # by payment channel
    type_rows = (
        db.query(
            GennisOverheadLive.channel,
            func.coalesce(func.sum(GennisOverheadLive.item_sum), 0).label("total"),
        )
        .filter(GennisOverheadLive.deleted == False)
    )
    type_rows = _month_year_filter_gennis_local(type_rows, GennisOverheadLive, GennisOverheadLive.date, month, year, from_date=from_date, to_date=to_date)
    if location_id:
        type_rows = type_rows.filter(GennisOverheadLive.location_id == location_id)
    type_rows = type_rows.group_by(GennisOverheadLive.channel).all()

    grand_total = sum(r.total for r in item_rows)

    return {
        "total": grand_total,
        "by_item": [{"item": r.item_name, "total": r.total} for r in item_rows],
        "by_payment_type": [{"payment_type": r.channel, "total": r.total} for r in type_rows],
    }


@router.get("/gennis/capitals", response_model=ByPaymentType)
def gennis_capitals(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2000),
    location_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
):
    """Capital expenditure in Gennis — total + breakdown by payment channel."""
    rows = (
        db.query(
            GennisCapitalExpenditureLive.channel,
            func.coalesce(func.sum(GennisCapitalExpenditureLive.item_sum), 0).label("total"),
        )
        .filter(GennisCapitalExpenditureLive.deleted == False)
    )
    rows = _month_year_filter_gennis_local(rows, GennisCapitalExpenditureLive, GennisCapitalExpenditureLive.date, month, year, from_date=from_date, to_date=to_date)
    if location_id:
        rows = rows.filter(GennisCapitalExpenditureLive.location_id == location_id)
    rows = rows.group_by(GennisCapitalExpenditureLive.channel).all()

    by_type = [{"payment_type": r.channel, "total": r.total} for r in rows]
    grand_total = sum(r["total"] for r in by_type)
    return {"total": grand_total, "by_payment_type": by_type}


@router.get("/gennis/branch-transactions", response_model=BranchTransactionTotals)
def gennis_branch_transactions(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2000),
    location_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
):
    """Branch transactions in Gennis — split by direction (give/receive) with per-payment-type breakdown.

    Unlike its siblings above, this table has no `channel` string and no
    single date column — payment_type_id (FK to the shared payment_type
    table) and calendar_day/month/year (plain integers) are what it has,
    so from_date/to_date use make_date() to compose a real date to compare."""
    base = (
        db.query(
            GennisBranchTransactionLive.is_give.label("is_give"),
            PaymentType.name.label("payment_type"),
            func.coalesce(func.sum(GennisBranchTransactionLive.amount), 0).label("total"),
        )
        .join(PaymentType, PaymentType.id == GennisBranchTransactionLive.payment_type_id)
        .filter(GennisBranchTransactionLive.deleted == False)
    )
    if month:
        base = base.filter(GennisBranchTransactionLive.calendar_month == month)
    if year:
        base = base.filter(GennisBranchTransactionLive.calendar_year == year)
    if from_date or to_date:
        made_date = func.make_date(
            GennisBranchTransactionLive.calendar_year,
            GennisBranchTransactionLive.calendar_month,
            GennisBranchTransactionLive.calendar_day,
        )
        if from_date:
            base = base.filter(made_date >= from_date)
        if to_date:
            base = base.filter(made_date < to_date + timedelta(days=1))
    if location_id:
        base = base.filter(GennisBranchTransactionLive.location_id == location_id)
    rows = base.group_by(GennisBranchTransactionLive.is_give, PaymentType.name).all()

    give_by_type: List[dict] = []
    receive_by_type: List[dict] = []
    for r in rows:
        bucket = give_by_type if r.is_give else receive_by_type
        bucket.append({"payment_type": r.payment_type, "total": r.total})

    give_total = sum(item["total"] for item in give_by_type)
    receive_total = sum(item["total"] for item in receive_by_type)
    return {
        "give": {"total": give_total, "by_payment_type": give_by_type},
        "receive": {"total": receive_total, "by_payment_type": receive_by_type},
        "net": receive_total - give_total,
    }


@router.get("/gennis/summary", response_model=GennisSummary)
def gennis_summary(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2000),
    location_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
):
    """Full Gennis summary: payments, teacher salaries, staff salaries, overheads, capitals, branch transactions, dividends, remaining."""
    payments = gennis_payments(month, year, location_id, db, from_date=from_date, to_date=to_date)
    teacher_salaries = gennis_teacher_salaries(month, year, location_id, db, from_date=from_date, to_date=to_date)
    staff_salaries = gennis_staff_salaries(month, year, location_id, db, from_date=from_date, to_date=to_date)
    overheads = gennis_overheads(month, year, location_id, db, from_date=from_date, to_date=to_date)
    capitals = gennis_capitals(month, year, location_id, db, from_date=from_date, to_date=to_date)
    branch_transactions = gennis_branch_transactions(month, year, location_id, db, from_date=from_date, to_date=to_date)
    dividends = _get_total(db, Dividend, "gennis", month, year, location_id=location_id, from_date=from_date, to_date=to_date)
    investments = _get_total(db, Investment, "gennis", month, year, location_id=location_id, from_date=from_date, to_date=to_date)

    total_expenses = (
        teacher_salaries["total"] + staff_salaries["total"] + overheads["total"]
        + capitals["total"] + dividends + branch_transactions["give"]["total"]
    )
    remaining = (
        payments["total"] + investments + branch_transactions["receive"]["total"]
        - total_expenses
    )

    return {
        "payments": payments,
        "teacher_salaries": teacher_salaries,
        "staff_salaries": staff_salaries,
        "overheads": overheads,
        "capitals": capitals,
        "branch_transactions": branch_transactions,
        "dividends": dividends,
        "investments": investments,
        "total_expenses": total_expenses,
        "remaining": remaining,
    }


# ─── Turon ────────────────────────────────────────────────────────────────────
# Reads locally (get_db → turon-v2's own turon_*_v2 tables + the shared
# `payment_type` reference), NOT the external old-turon DB (get_turon_db).
# Old turon has had no real admin activity since 2026-08-20 — turon-v2 is the
# live system now, and its financial tables already live in this same DB
# (see app/models.py's "Turon V2 financial tables" block, and conversation
# for the full verification: payments 4,738/5,088 old rows carried over,
# the rest orphaned/zero-value junk worth <0.5% of total value, and native
# turon-v2 payments still landing as recently as the day this was checked).

@router.get("/turon/payments", response_model=ByPaymentType)
def turon_payments(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2000),
    branch_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
):
    """Student payments in Turon — total + breakdown by payment type."""
    rows = (
        db.query(
            PaymentType.name,
            func.coalesce(func.sum(TuronStudentPaymentV2.payment_sum), 0).label("total"),
        )
        .join(PaymentType, PaymentType.id == TuronStudentPaymentV2.payment_type_id)
        # Match turon-v2's own accounting: revenue is status == False (True
        # is a one-time discount credit, not a real cash/bank/click payment
        # — same filter direction old turon used, see app/models.py).
        .filter(TuronStudentPaymentV2.deleted == False, TuronStudentPaymentV2.status == False)
    )
    rows = _month_year_filter_turon(rows, TuronStudentPaymentV2.date, month, year, from_date=from_date, to_date=to_date)
    if branch_id:
        rows = rows.filter(TuronStudentPaymentV2.branch_id == branch_id)
    rows = rows.group_by(PaymentType.name).all()

    by_type = [{"payment_type": r.name, "total": r.total} for r in rows]
    grand_total = sum(r["total"] for r in by_type)

    return {"total": grand_total, "by_payment_type": by_type}


@router.get("/turon/teacher-salaries", response_model=ByPaymentType)
def turon_teacher_salaries(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2000),
    branch_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
):
    """Teacher salary payments in Turon — total + breakdown by payment type."""
    rows = (
        db.query(
            PaymentType.name,
            func.coalesce(func.sum(TuronTeacherSalaryPaymentV2.salary), 0).label("total"),
        )
        .join(PaymentType, PaymentType.id == TuronTeacherSalaryPaymentV2.payment_type_id)
        .filter(TuronTeacherSalaryPaymentV2.deleted == False)
    )
    rows = _month_year_filter_turon(rows, TuronTeacherSalaryPaymentV2.date, month, year, from_date=from_date, to_date=to_date)
    if branch_id:
        rows = rows.filter(TuronTeacherSalaryPaymentV2.branch_id == branch_id)
    rows = rows.group_by(PaymentType.name).all()

    by_type = [{"payment_type": r.name, "total": r.total} for r in rows]
    grand_total = sum(r["total"] for r in by_type)

    return {"total": grand_total, "by_payment_type": by_type}


@router.get("/turon/staff-salaries", response_model=ByPaymentType)
def turon_staff_salaries(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2000),
    branch_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
):
    """Staff (user) salary payments in Turon — total + breakdown by payment type."""
    rows = (
        db.query(
            PaymentType.name,
            func.coalesce(func.sum(TuronStaffSalaryPaymentV2.salary), 0).label("total"),
        )
        .join(PaymentType, PaymentType.id == TuronStaffSalaryPaymentV2.payment_type_id)
        .filter(TuronStaffSalaryPaymentV2.deleted == False)
    )
    rows = _month_year_filter_turon(rows, TuronStaffSalaryPaymentV2.date, month, year, from_date=from_date, to_date=to_date)
    if branch_id:
        rows = rows.filter(TuronStaffSalaryPaymentV2.branch_id == branch_id)
    rows = rows.group_by(PaymentType.name).all()

    by_type = [{"payment_type": r.name, "total": r.total} for r in rows]
    grand_total = sum(r["total"] for r in by_type)

    return {"total": grand_total, "by_payment_type": by_type}


@router.get("/turon/overheads", response_model=TuronOverheadSummary)
def turon_overheads(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2000),
    branch_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
):
    """Overhead expenses in Turon — total + breakdown by overhead type + by payment type."""
    # by overhead type
    type_rows = (
        db.query(
            TuronOverheadTypeV2.name,
            func.coalesce(func.sum(TuronOverheadV2.price), 0).label("total"),
        )
        .join(TuronOverheadTypeV2, TuronOverheadTypeV2.id == TuronOverheadV2.type_id)
        .filter(TuronOverheadV2.deleted == False)
    )
    type_rows = _month_year_filter_turon(type_rows, TuronOverheadV2.date, month, year, from_date=from_date, to_date=to_date)
    if branch_id:
        type_rows = type_rows.filter(TuronOverheadV2.branch_id == branch_id)
    type_rows = type_rows.group_by(TuronOverheadTypeV2.name).all()

    # by payment type
    pay_rows = (
        db.query(
            PaymentType.name,
            func.coalesce(func.sum(TuronOverheadV2.price), 0).label("total"),
        )
        .join(PaymentType, PaymentType.id == TuronOverheadV2.payment_type_id)
        .filter(TuronOverheadV2.deleted == False)
    )
    pay_rows = _month_year_filter_turon(pay_rows, TuronOverheadV2.date, month, year, from_date=from_date, to_date=to_date)
    if branch_id:
        pay_rows = pay_rows.filter(TuronOverheadV2.branch_id == branch_id)
    pay_rows = pay_rows.group_by(PaymentType.name).all()

    grand_total = sum(r.total for r in type_rows)

    return {
        "total": grand_total,
        "by_overhead_type": [{"type": r.name, "total": r.total} for r in type_rows],
        "by_payment_type": [{"payment_type": r.name, "total": r.total} for r in pay_rows],
    }


@router.get("/turon/capitals", response_model=ByPaymentType)
def turon_capitals(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2000),
    branch_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
):
    """Capital expenditure in Turon — total + breakdown by payment type."""
    rows = (
        db.query(
            PaymentType.name,
            func.coalesce(func.sum(TuronCapitalV2.price), 0).label("total"),
        )
        .join(PaymentType, PaymentType.id == TuronCapitalV2.payment_type_id)
        .filter(TuronCapitalV2.deleted == False)
    )
    rows = _month_year_filter_turon(rows, TuronCapitalV2.added_date, month, year, from_date=from_date, to_date=to_date)
    if branch_id:
        rows = rows.filter(TuronCapitalV2.branch_id == branch_id)
    rows = rows.group_by(PaymentType.name).all()

    by_type = [{"payment_type": r.name, "total": r.total} for r in rows]
    grand_total = sum(r["total"] for r in by_type)
    return {"total": grand_total, "by_payment_type": by_type}


@router.get("/turon/branch-transactions", response_model=BranchTransactionTotals)
def turon_branch_transactions(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2000),
    branch_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
):
    """Branch transactions in Turon — split by direction (give/receive) with per-payment-type breakdown."""
    base = (
        db.query(
            TuronBranchTransactionV2.is_give.label("is_give"),
            PaymentType.name.label("payment_type"),
            func.coalesce(func.sum(TuronBranchTransactionV2.amount), 0).label("total"),
        )
        .join(PaymentType, PaymentType.id == TuronBranchTransactionV2.payment_type_id)
        .filter(TuronBranchTransactionV2.deleted == False)
    )
    base = _month_year_filter_turon(base, TuronBranchTransactionV2.date, month, year, from_date=from_date, to_date=to_date)
    if branch_id:
        base = base.filter(TuronBranchTransactionV2.branch_id == branch_id)
    rows = base.group_by(TuronBranchTransactionV2.is_give, PaymentType.name).all()

    give_by_type: List[dict] = []
    receive_by_type: List[dict] = []
    for r in rows:
        bucket = give_by_type if r.is_give else receive_by_type
        bucket.append({"payment_type": r.payment_type, "total": r.total})

    give_total = sum(item["total"] for item in give_by_type)
    receive_total = sum(item["total"] for item in receive_by_type)
    return {
        "give": {"total": give_total, "by_payment_type": give_by_type},
        "receive": {"total": receive_total, "by_payment_type": receive_by_type},
        "net": receive_total - give_total,
    }


@router.get("/turon/summary", response_model=TuronSummary)
def turon_summary(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2000),
    branch_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
):
    """Full Turon summary: payments, teacher salaries, staff salaries, overheads, capitals, branch transactions, dividends, remaining."""
    payments = turon_payments(month, year, branch_id, db, from_date=from_date, to_date=to_date)
    teacher_salaries = turon_teacher_salaries(month, year, branch_id, db, from_date=from_date, to_date=to_date)
    staff_salaries = turon_staff_salaries(month, year, branch_id, db, from_date=from_date, to_date=to_date)
    overheads = turon_overheads(month, year, branch_id, db, from_date=from_date, to_date=to_date)
    capitals = turon_capitals(month, year, branch_id, db, from_date=from_date, to_date=to_date)
    branch_transactions = turon_branch_transactions(month, year, branch_id, db, from_date=from_date, to_date=to_date)
    dividends = _get_total(db, Dividend, "turon", month, year, branch_id=branch_id, from_date=from_date, to_date=to_date)
    investments = _get_total(db, Investment, "turon", month, year, branch_id=branch_id, from_date=from_date, to_date=to_date)

    total_expenses = (
        teacher_salaries["total"] + staff_salaries["total"] + overheads["total"]
        + capitals["total"] + dividends + branch_transactions["give"]["total"]
    )
    remaining = (
        payments["total"] + investments + branch_transactions["receive"]["total"]
        - total_expenses
    )

    return {
        "payments": payments,
        "teacher_salaries": teacher_salaries,
        "staff_salaries": staff_salaries,
        "overheads": overheads,
        "capitals": capitals,
        "branch_transactions": branch_transactions,
        "dividends": dividends,
        "investments": investments,
        "total_expenses": total_expenses,
        "remaining": remaining,
    }


# ─── Combined overview ────────────────────────────────────────────────────────

@router.get("/overview", response_model=OverviewOut)
def overview(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2000),
    gennis_location_id: Optional[int] = Query(None),
    turon_branch_id: Optional[int] = Query(None),
    local_db: Session = Depends(get_db),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
):
    """Director dashboard: combined stats from both systems."""
    g = gennis_summary(month, year, gennis_location_id, local_db, from_date=from_date, to_date=to_date)
    t = turon_summary(month, year, turon_branch_id, local_db, from_date=from_date, to_date=to_date)

    total_payments = g["payments"]["total"] + t["payments"]["total"]
    total_teacher_salaries = g["teacher_salaries"]["total"] + t["teacher_salaries"]["total"]
    total_staff_salaries = g["staff_salaries"]["total"] + t["staff_salaries"]["total"]
    total_overheads = g["overheads"]["total"] + t["overheads"]["total"]
    total_capitals = g["capitals"]["total"] + t["capitals"]["total"]
    total_branch_tx_give = g["branch_transactions"]["give"]["total"] + t["branch_transactions"]["give"]["total"]
    total_branch_tx_receive = g["branch_transactions"]["receive"]["total"] + t["branch_transactions"]["receive"]["total"]
    total_branch_tx_net = total_branch_tx_receive - total_branch_tx_give
    total_dividends = g["dividends"] + t["dividends"]
    total_investments = g["investments"] + t["investments"]
    # investments are minus for management (money sent out), dividends are plus (money received)
    total_expenses = (
        total_teacher_salaries + total_staff_salaries + total_overheads
        + total_capitals + total_investments + total_branch_tx_give
    )
    remaining = total_payments + total_dividends + total_branch_tx_receive - total_expenses

    return {
        "period": {"month": month, "year": year, "from_date": from_date, "to_date": to_date},
        "gennis": g,
        "turon": t,
        "combined": {
            "total_payments": total_payments,
            "total_teacher_salaries": total_teacher_salaries,
            "total_staff_salaries": total_staff_salaries,
            "total_overheads": total_overheads,
            "total_capitals": total_capitals,
            "total_branch_tx_give": total_branch_tx_give,
            "total_branch_tx_receive": total_branch_tx_receive,
            "total_branch_tx_net": total_branch_tx_net,
            "total_dividends": total_dividends,
            "total_investments": total_investments,
            "total_expenses": total_expenses,
            "remaining": remaining,
        },
    }

