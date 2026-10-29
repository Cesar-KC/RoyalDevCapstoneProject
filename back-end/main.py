import bcrypt
from datetime import date

from fastapi import Depends, FastAPI, HTTPException, status, Response, Cookie, Query
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import SessionLocal
from models import User, UserSession, UserBudget
from schemas import UserCreate, UserOut, UserLogin, BudgetCreate, BudgetOut, MONTH_PATTERN
from security import new_session_token, hash_token, session_expiry, SESSION_LIFETIME, utc_now




app = FastAPI(title="Budget App API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)



PLAN_SPLITS = {
    "balanced": (50, 30, 20),
    "save_more": (40, 20, 40),
    "essentials": (60, 20, 20),
}



def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(
    session_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> User:
    
    not_authenticated = HTTPException(status_code=401, detail="Not authenticated")

    if session_token is None:
        raise not_authenticated

    user_session = db.scalar(
        select(UserSession).where(UserSession.token_hash == hash_token(session_token))
    )
    if (
        user_session is None
        or user_session.is_revoked
        or user_session.expires_at <= utc_now()
    ):
        raise not_authenticated

    user = db.get(User, user_session.user_id)
    if user is None:
        raise not_authenticated
    return user

def month_to_date(month: str) -> date:
    return date.fromisoformat(f"{month}-01")




@app.post("/api/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.username == user_in.username)):
        raise HTTPException(status_code=409, detail="Username already taken")
    if db.scalar(select(User).where(User.email == user_in.email)):
        raise HTTPException(status_code=409, detail="Email already registered")

    password_bytes = user_in.password.encode("utf-8")
    if len(password_bytes) > 72:
        raise HTTPException(status_code=422, detail="Password is too long")
    password_hash = bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode("utf-8")

    user = User(
        username=user_in.username,
        name=user_in.name,
        email=user_in.email,
        password_hash=password_hash,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Username or email already registered")
    db.refresh(user)
    return user


@app.post("/api/login", response_model=UserOut, status_code=status.HTTP_200_OK)
def login(user_in: UserLogin, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == user_in.username))

    if user is None or not bcrypt.checkpw(
        user_in.password.encode("utf-8"),
        user.password_hash.encode("utf-8"),
    ):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = new_session_token()
    db.add(UserSession(
        user_id=user.id,
        token_hash=hash_token(token),
        expires_at=session_expiry(),
    ))
    db.commit()

    response.set_cookie(
        key="session_token",
        value=token,
        max_age=int(SESSION_LIFETIME.total_seconds()),
        httponly=True,
        samesite="lax",
        secure=False,  # True in production (HTTPS only)
    )
    return user

@app.get("/api/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user

@app.post("/api/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    session_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
):
    if session_token is not None:
        user_session = db.scalar(
            select(UserSession).where(UserSession.token_hash == hash_token(session_token))
        )
        if user_session is not None and not user_session.is_revoked:
            user_session.is_revoked = True
            db.commit()

    response.delete_cookie(
        key="session_token",
        httponly=True,
        samesite="lax",
        secure=False,  # True in production (HTTPS only)
    )

@app.get("/api/budgets", response_model=BudgetOut)
def get_budget(
    month: str = Query(pattern=MONTH_PATTERN),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    budget = db.scalar(
        select(UserBudget).where(
            UserBudget.user_id == current_user.id,
            UserBudget.budget_month == month_to_date(month),
        )
    )
    if budget is None:
        raise HTTPException(status_code=404, detail="No budget for this month")
    return budget

@app.post("/api/budgets", response_model=BudgetOut, status_code=status.HTTP_201_CREATED)
def create_budget(
    budget_in: BudgetCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    budget_month = month_to_date(budget_in.month)

    existing = db.scalar(
        select(UserBudget).where(
            UserBudget.user_id == current_user.id,
            UserBudget.budget_month == budget_month,
        )
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="A budget already exists for this month")

    needs_pct, wants_pct, savings_pct = PLAN_SPLITS[budget_in.plan]
    budget = UserBudget(
        user_id=current_user.id,
        budget_month=budget_month,
        expected_amount=budget_in.expected_amount,
        needs_pct=needs_pct,
        wants_pct=wants_pct,
        savings_pct=savings_pct,
    )
    
    db.add(budget)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A budget already exists for this month")
    db.refresh(budget)

    return budget