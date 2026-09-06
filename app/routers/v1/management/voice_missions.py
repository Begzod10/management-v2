"""Voice-to-mission endpoint.

POST /api/v1/voice-missions/transcribe
  - Accepts an audio file upload.
  - Transcribes it via Whisper.
  - Extracts mission proposals via GPT.
  - Ranks suggested executors from the management DB for each proposal.
  - Returns a preview the frontend can show before the user confirms creation.

The actual mission creation step uses the existing POST /missions/ endpoint
(MissionCreate schema) with the confirmed executor_ids and deadline.
"""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Mission, MissionHistory, User, Job
from app.services.openai_assistant import (
    ExecutorCandidate,
    ExecutorSuggestion,
    OpenAIError,
    suggest_executors,
)
from app.services.realtime_session import voice_eligible_executors
from app.services.voice_assistant import (
    VoiceAssistantError,
    VoiceMissionProposal,
    extract_missions,
    transcribe_audio,
)
from sqlalchemy import or_, select

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/voice-missions", tags=["voice-missions"])

_ALLOWED_EXTENSIONS = {
    "mp3", "mp4", "m4a", "wav", "webm", "ogg", "flac",
}
_MAX_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB (Whisper API limit)


# ── Response schemas ──────────────────────────────────────────────────────────

class ExecutorSuggestionOut(BaseModel):
    user_id: int
    name: str
    role: str
    job: Optional[str]
    score: float
    reason: str


class MissionProposalOut(BaseModel):
    title: str
    description: Optional[str]
    deadline: date          # absolute date = today + deadline_days
    deadline_days: int
    category: str
    executor_role_hint: str
    raw_excerpt: str
    executor_suggestions: List[ExecutorSuggestionOut]


class VoiceTranscribeResponse(BaseModel):
    transcript: str
    proposals: List[MissionProposalOut]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _to_candidate(user: User, db: Session) -> ExecutorCandidate:
    job_name: Optional[str] = None
    if user.job_id:
        job = db.query(Job).filter(Job.id == user.job_id).first()
        job_name = job.name if job else None

    section_names = [
        sm.section.name
        for sm in user.section_memberships
        if sm.section and not sm.section.deleted
    ]
    project_names = [
        pm.project.name
        for pm in user.project_memberships
        if pm.project and not pm.project.deleted
    ]

    completed_count = db.query(Mission).filter(
        Mission.executor_id == user.id,
        Mission.deleted == False,
        Mission.status.in_(["completed", "approved"]),
    ).count()

    history_mission_ids = select(MissionHistory.mission_id).where(
        MissionHistory.executor_id == user.id,
    )
    recent_titles = [
        m.title
        for m in db.query(Mission.title)
        .filter(
            or_(
                Mission.executor_id == user.id,
                Mission.original_executor_id == user.id,
                Mission.id.in_(history_mission_ids),
            ),
            Mission.deleted == False,
        )
        .order_by(Mission.created_at.desc())
        .limit(5)
        .all()
    ]

    return ExecutorCandidate(
        id=user.id,
        name=f"{user.name} {user.surname}".strip(),
        role=user.role,
        job=job_name,
        section=", ".join(section_names) or None,
        project=", ".join(project_names) or None,
        completed_missions=completed_count,
        recent_mission_titles=tuple(recent_titles),
    )


def _enrich_suggestion(s: ExecutorSuggestion, candidates: List[ExecutorCandidate]) -> ExecutorSuggestionOut:
    c = next((c for c in candidates if c.id == s.user_id), None)
    return ExecutorSuggestionOut(
        user_id=s.user_id,
        name=c.name if c else "",
        role=c.role if c else "",
        job=c.job if c else None,
        score=round(s.score, 3),
        reason=s.reason,
    )


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/transcribe", response_model=VoiceTranscribeResponse)
async def transcribe_and_propose(
    audio: UploadFile = File(...),
    top_k: int = Query(3, ge=1, le=10, description="Max executor suggestions per proposal"),
    db: Session = Depends(get_db),
    creator: User = Depends(get_current_user),
):
    """
    Upload a voice message. Returns a transcript and a list of mission proposals,
    each with ranked executor suggestions pulled from the management user pool.

    The caller should display the proposals, let the manager adjust, then POST to
    /missions/ with the confirmed data to actually create the missions.

    The acting user comes from the authenticated session (get_current_user),
    not a client-supplied id — this endpoint used to take `creator_id` as a
    plain query param with no auth at all, so anyone could pass any id and get
    back a full staff-directory dump plus billable Whisper/GPT calls for free.
    """
    # Validate file type
    filename = audio.filename or "voice.mp3"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported audio format '{ext}'. Allowed: {', '.join(sorted(_ALLOWED_EXTENSIONS))}",
        )

    # Read file with size guard
    audio_bytes = await audio.read()
    if len(audio_bytes) > _MAX_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Audio file too large. Maximum size is {_MAX_SIZE_BYTES // (1024*1024)} MB.",
        )
    if not audio_bytes:
        raise HTTPException(status_code=422, detail="Audio file is empty.")

    # Step 1: Whisper transcription
    try:
        transcript = transcribe_audio(audio_bytes, filename)
    except VoiceAssistantError as exc:
        # Log the real upstream error server-side only — the raw Whisper HTTP
        # body (surfaced by transcribe_audio's exception text) is not for the
        # client, since this endpoint is now reachable by any authenticated
        # user and shouldn't hand back internal API details to probe.
        logger.warning("Whisper transcription failed for creator %s: %s", creator.id, exc)
        raise HTTPException(status_code=502, detail="Ovozni matnga o'girib bo'lmadi")

    if not transcript.strip():
        raise HTTPException(status_code=422, detail="Audio contained no recognisable speech.")

    # Step 2: GPT mission extraction
    try:
        proposals: List[VoiceMissionProposal] = extract_missions(transcript)
    except VoiceAssistantError as exc:
        logger.warning("Mission extraction failed for creator %s: %s", creator.id, exc)
        raise HTTPException(status_code=502, detail="Vazifani tushunib bo'lmadi")

    if not proposals:
        return VoiceTranscribeResponse(transcript=transcript, proposals=[])

    # Step 3: Load executor candidates scoped to who this creator may actually
    # assign to — same rule the WS/Telegram voice paths and the REST /missions/
    # endpoint enforce. This used to load every active user in the company
    # regardless of the (unauthenticated) caller's role.
    eligible_ids = [u.id for u in voice_eligible_executors(creator, db)]
    active_users = (
        db.query(User)
        .options(
            selectinload(User.section_memberships),
            selectinload(User.project_memberships),
        )
        .filter(User.id.in_(eligible_ids))
        .all()
        if eligible_ids
        else []
    )
    candidates = [_to_candidate(u, db) for u in active_users]

    # Step 4: For each proposal, rank executors using the role_hint as extra context
    today = date.today()
    proposal_outs: List[MissionProposalOut] = []

    for prop in proposals:
        title_for_ranking = prop.title
        desc_for_ranking = (
            f"{prop.description or ''}\n[Ideal executor: {prop.executor_role_hint}]"
            if prop.executor_role_hint
            else prop.description
        )
        try:
            suggestions = suggest_executors(
                title=title_for_ranking,
                description=desc_for_ranking,
                candidates=candidates,
                top_k=top_k,
            )
        except OpenAIError as exc:
            logger.warning("Executor suggestion failed for proposal '%s': %s", prop.title, exc)
            suggestions = []

        proposal_outs.append(
            MissionProposalOut(
                title=prop.title,
                description=prop.description,
                deadline=today + timedelta(days=prop.deadline_days),
                deadline_days=prop.deadline_days,
                category=prop.category,
                executor_role_hint=prop.executor_role_hint,
                raw_excerpt=prop.raw_excerpt,
                executor_suggestions=[_enrich_suggestion(s, candidates) for s in suggestions],
            )
        )

    return VoiceTranscribeResponse(transcript=transcript, proposals=proposal_outs)
