import bcrypt
from fastapi import Depends, FastAPI, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import SessionLocal
from models import User
from schemas import UserCreate, UserOut, UserLogin

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Budget App API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


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
def login(user_in: UserLogin, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == user_in.username)) #get user info from from db, where username matches

    if user is None or not bcrypt.checkpw(             #user = None, means no username present
        user_in.password.encode("utf-8"),              # False 'bcrpyt.checkpw' , means password does not match
        user.password_hash.encode("utf-8"),
    ):
        raise HTTPException(status_code=401, detail="Invalid username or password")     

    return user #Username is present and password entered matches, success