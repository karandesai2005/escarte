from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Any

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

from questions_data import QUESTIONS, CATEGORIES, BADGES

# Categories where there's no "right or wrong" — we want honest self-reflection.
HONEST_CATEGORIES = {"leadership", "critical", "emotional", "finance"}

# ---------- Config ----------
JWT_ALGORITHM = "HS256"
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="SkillSpark API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ---------- Auth Helpers ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id, "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user.pop("_id", None)
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="access_token", value=token, httponly=True,
        secure=False, samesite="lax", max_age=7 * 24 * 3600, path="/"
    )


# ---------- Pydantic Models ----------
class RegisterInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
    age: Optional[int] = None
    grade: Optional[str] = None


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class SubmissionInput(BaseModel):
    category: Optional[str] = None  # None = full test
    answers: List[dict]  # [{question_id, correct: bool, points: int, format, badge?}]


# ---------- Auth Routes ----------
@api_router.post("/auth/register")
async def register(data: RegisterInput, response: Response):
    email = data.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id, "email": email, "password_hash": hash_password(data.password),
        "name": data.name, "age": data.age, "grade": data.grade,
        "role": "user", "badges": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    token = create_access_token(user_id, email)
    set_auth_cookie(response, token)
    user_doc.pop("_id", None)
    user_doc.pop("password_hash", None)
    return {"user": user_doc, "token": token}


@api_router.post("/auth/login")
async def login(data: LoginInput, response: Response):
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], email)
    set_auth_cookie(response, token)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_login_at": datetime.now(timezone.utc).isoformat()}},
    )
    user.pop("_id", None)
    user.pop("password_hash", None)
    return {"user": user, "token": token}


@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ---------- Meta Routes ----------
@api_router.get("/categories")
async def get_categories():
    # Include question counts
    result = []
    for cat in CATEGORIES:
        count = sum(1 for q in QUESTIONS if q["category"] == cat["id"])
        result.append({**cat, "question_count": count})
    return result


@api_router.get("/badges")
async def get_badges():
    return BADGES


# ---------- Question Routes ----------
def _public_question(q: dict, idx: int) -> dict:
    """Strip correct answers for client."""
    pub = {
        "id": f"{q['category']}-{idx}",
        "category": q["category"],
        "format": q["format"],
        "question": q.get("question"),
        "points": q.get("points", 10),
        "badge": q.get("badge"),
        "honest": q["category"] in HONEST_CATEGORIES,
    }
    if q["format"] in ("mcq", "fill_blank", "scenario"):
        pub["options"] = q["options"]
    elif q["format"] == "true_false":
        pass
    elif q["format"] == "match_pairs":
        # Send lefts and shuffled rights (client will match)
        pub["lefts"] = [p["left"] for p in q["pairs"]]
        pub["rights"] = [p["right"] for p in q["pairs"]]
    elif q["format"] == "order_sentence":
        pub["words"] = q["words"]
    return pub


def _get_question_by_id(qid: str) -> Optional[dict]:
    try:
        cat, idx = qid.rsplit("-", 1)
        idx = int(idx)
    except Exception:
        return None
    for i, q in enumerate(QUESTIONS):
        if q["category"] == cat:
            # Count matches
            pass
    # Rebuild same logic used in list
    cat_qs = [(i, q) for i, q in enumerate(QUESTIONS) if q["category"] == cat]
    if idx < 0 or idx >= len(cat_qs):
        return None
    return cat_qs[idx][1]


@api_router.get("/questions/{category}")
async def get_questions_for_category(category: str, user: dict = Depends(get_current_user)):
    cat_qs = [q for q in QUESTIONS if q["category"] == category]
    if not cat_qs:
        raise HTTPException(status_code=404, detail="Category not found")
    return [_public_question(q, i) for i, q in enumerate(cat_qs)]


@api_router.get("/questions")
async def get_all_questions(user: dict = Depends(get_current_user)):
    # For full-test: group by category, keep ordering
    result = []
    counters = {}
    for q in QUESTIONS:
        cat = q["category"]
        idx = counters.get(cat, 0)
        result.append(_public_question(q, idx))
        counters[cat] = idx + 1
    return result


class CheckAnswerInput(BaseModel):
    question_id: str
    answer: Any  # int index / bool / list of indices / list of pairs


@api_router.post("/questions/check")
async def check_answer(data: CheckAnswerInput, user: dict = Depends(get_current_user)):
    q = _get_question_by_id(data.question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    # Honest / self-reflection categories: no right or wrong. Always mark received.
    if q["category"] in HONEST_CATEGORIES:
        return {
            "correct": True,
            "honest": True,
            "explanation": "Thanks for sharing — noted. There's no right or wrong here.",
            "points": q.get("points", 10),
            "badge": q.get("badge"),
        }

    correct = False
    fmt = q["format"]
    ans = data.answer
    if fmt in ("mcq", "fill_blank", "scenario"):
        correct = int(ans) == q["correct_index"]
    elif fmt == "true_false":
        correct = bool(ans) == q["correct"]
    elif fmt == "order_sentence":
        try:
            correct = list(ans) == q["correct_order"]
        except Exception:
            correct = False
    elif fmt == "match_pairs":
        # ans expected: list of {left, right}
        try:
            expected = {p["left"]: p["right"] for p in q["pairs"]}
            got = {p["left"]: p["right"] for p in ans}
            correct = expected == got
        except Exception:
            correct = False

    return {
        "correct": correct,
        "honest": False,
        "explanation": q.get("explanation", ""),
        "points": q.get("points", 10) if correct else 0,
        "badge": q.get("badge") if correct else None,
    }


# ---------- Submission / Report ----------
def _rank(score_pct: float) -> str:
    if score_pct >= 90: return "Legendary Champ"
    if score_pct >= 75: return "Skill Champ"
    if score_pct >= 60: return "Rising Star"
    if score_pct >= 40: return "Sparkling Learner"
    return "Curious Explorer"


CATEGORY_ADVICE = {
    "english": {
        "pro": "Your English fundamentals are strong — great vocabulary and grammar sense!",
        "con": "A few tricky grammar spots to polish. Practice tenses and articles daily.",
        "rec": "Try our 'Everyday English' program for 15 min/day."
    },
    "communication": {
        "pro": "You handle conversations with empathy and clarity.",
        "con": "Practice active listening and polite disagreement in real conversations.",
        "rec": "Join our 'Speak with Confidence' bootcamp."
    },
    "finance": {
        "pro": "You already think smart about money — needs vs wants is clear to you!",
        "con": "Explore budgeting and the power of long-term saving.",
        "rec": "Our 'Money Smart Teens' 4-week course fits you perfectly."
    },
    "leadership": {
        "pro": "You show great instincts for teamwork and fairness.",
        "con": "Work on delegation and structured decision-making.",
        "rec": "Enroll in our 'Young Leaders Circle' mentorship."
    },
    "critical": {
        "pro": "You think before you act — a superpower!",
        "con": "Keep questioning sources and separating fact from opinion.",
        "rec": "Try our 'Think Sharp' logic puzzles program."
    },
    "emotional": {
        "pro": "You understand feelings — yours and others'. That's rare.",
        "con": "Explore healthy stress techniques and self-reflection habits.",
        "rec": "Join our 'Mindful Teens' weekly sessions."
    },
}

REFLECTION_TEXT = {
    "finance":    "Your money instincts came through honestly. Keep exploring the 'why' behind smart spending — awareness is the first step to wealth.",
    "leadership": "Your leadership style is your own. Notice which choices you gravitated toward — that's the leader you're becoming.",
    "critical":   "You brought your genuine thinking. Trust that instinct, and keep asking 'why?' — that's how sharp minds are built.",
    "emotional":  "Thanks for being honest about your feelings. Self-awareness like this is the real superpower — it can't be tested, only lived.",
}


@api_router.post("/submissions")
async def create_submission(data: SubmissionInput, user: dict = Depends(get_current_user)):
    # Aggregate score per category
    per_cat = {}
    total_points = 0
    max_points = 0
    correct_count = 0
    earned_badges = []

    for a in data.answers:
        cat = a.get("category", "unknown")
        pc = per_cat.setdefault(cat, {"correct": 0, "total": 0, "points": 0, "max_points": 0})
        pc["total"] += 1
        pc["max_points"] += a.get("max_points", a.get("points", 10))
        max_points += a.get("max_points", a.get("points", 10))
        if a.get("correct"):
            pc["correct"] += 1
            pc["points"] += a.get("points", 0)
            total_points += a.get("points", 0)
            correct_count += 1
            if a.get("badge"):
                earned_badges.append(a["badge"])

    # Add badges to user
    if earned_badges:
        existing = set(user.get("badges") or [])
        new_set = list(existing.union(earned_badges))
        await db.users.update_one({"id": user["id"]}, {"$set": {"badges": new_set}})

    score_pct = round((total_points / max_points) * 100) if max_points else 0

    # Build pros/cons
    pros, cons, recs, reflections = [], [], [], []
    for cat_id, stats in per_cat.items():
        cat_pct = round((stats["points"] / stats["max_points"]) * 100) if stats["max_points"] else 0
        if cat_id in HONEST_CATEGORIES:
            reflections.append({
                "category": cat_id,
                "text": REFLECTION_TEXT.get(cat_id, "Thanks for sharing your honest perspective."),
            })
            continue
        advice = CATEGORY_ADVICE.get(cat_id, {})
        if cat_pct >= 70:
            pros.append({"category": cat_id, "text": advice.get("pro", "Great work!"), "score": cat_pct})
        else:
            cons.append({"category": cat_id, "text": advice.get("con", "Room to grow!"), "score": cat_pct})
            recs.append({"category": cat_id, "text": advice.get("rec", "Keep practicing!")})

    submission = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "category": data.category,
        "per_category": per_cat,
        "total_points": total_points,
        "max_points": max_points,
        "score_pct": score_pct,
        "rank": _rank(score_pct),
        "correct_count": correct_count,
        "total_questions": len(data.answers),
        "badges_earned": list(set(earned_badges)),
        "pros": pros,
        "cons": cons,
        "recommendations": recs,
        "reflections": reflections,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.submissions.insert_one(submission)
    submission.pop("_id", None)
    return submission


@api_router.get("/submissions/me")
async def my_submissions(user: dict = Depends(get_current_user)):
    subs = await db.submissions.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return subs


@api_router.get("/submissions/{submission_id}")
async def get_submission(submission_id: str, user: dict = Depends(get_current_user)):
    sub = await db.submissions.find_one({"id": submission_id}, {"_id": 0})
    if not sub:
        raise HTTPException(status_code=404, detail="Not found")
    if sub["user_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    return sub


# ---------- Admin ----------
@api_router.get("/admin/users")
async def admin_users(admin: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    # Attach submission counts + latest attempt per user
    for u in users:
        subs = await db.submissions.find({"user_id": u["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
        u["submissions"] = subs
        u["submission_count"] = len(subs)
        u["last_attempt_at"] = subs[0]["created_at"] if subs else None
    return users


@api_router.get("/admin/submissions")
async def admin_submissions(admin: dict = Depends(require_admin)):
    subs = await db.submissions.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return subs


@api_router.get("/admin/analytics")
async def admin_analytics(admin: dict = Depends(require_admin)):
    user_count = await db.users.count_documents({"role": "user"})
    sub_count = await db.submissions.count_documents({})
    # Category weakness (avg score per cat)
    cat_totals = {c["id"]: {"points": 0, "max": 0, "attempts": 0} for c in CATEGORIES}
    async for s in db.submissions.find({}):
        for cat_id, stats in (s.get("per_category") or {}).items():
            if cat_id in cat_totals:
                cat_totals[cat_id]["points"] += stats.get("points", 0)
                cat_totals[cat_id]["max"] += stats.get("max_points", 0)
                cat_totals[cat_id]["attempts"] += 1
    cat_avg = []
    for cid, v in cat_totals.items():
        pct = round((v["points"] / v["max"]) * 100) if v["max"] else 0
        cat_avg.append({"category": cid, "avg_score_pct": pct, "attempts": v["attempts"]})
    return {"user_count": user_count, "submission_count": sub_count, "category_stats": cat_avg}


@api_router.get("/")
async def root():
    return {"message": "SkillSpark API up", "categories": len(CATEGORIES), "questions": len(QUESTIONS)}


# ---------- App wiring ----------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@skillspark.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "role": "admin",
            "badges": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Seeded admin: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": hash_password(admin_password), "role": "admin"}})


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
