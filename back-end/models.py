from datetime import datetime, date
from decimal import Decimal

from sqlalchemy import ForeignKey, String, func, false, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now())

class UserSession(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    is_revoked: Mapped[bool] = mapped_column(server_default=false())

class UserBudget(Base):
    __tablename__ = "budgets"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    expected_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    budget_month: Mapped[date] = mapped_column()
    needs_pct: Mapped[int] = mapped_column()
    wants_pct: Mapped[int] = mapped_column()
    savings_pct: Mapped[int] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now())



 