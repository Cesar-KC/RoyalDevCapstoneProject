from datetime import date, datetime
from typing import Literal
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

MONTH_PATTERN = r"^\d{4}-(0[1-9]|1[0-2])$"


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50, pattern=r"^[A-Za-z0-9_]+$")
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    name: str
    email: EmailStr
    created_at: datetime

class UserLogin(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=72)


class AllocationIn(BaseModel):
    category_id: int
    amount: int = Field(ge=0, le=1_000_000_000)


class AllocationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    category_id: int
    amount: int

class BudgetCreate(BaseModel):
    month: str = Field(pattern=MONTH_PATTERN) #month format check
    expected_amount: int = Field(ge=1, le=1_000_000_000) # amount check
    plan: Literal["balanced", "save_more", "essentials"] #only these plans accepted
    allocations: list[AllocationIn] = Field(default_factory=list)

class BudgetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    month: str = Field(validation_alias="budget_month")
    expected_amount: int
    needs_pct: int
    wants_pct: int
    savings_pct: int
    created_at: datetime
    allocations: list[AllocationOut]

    @field_validator("month", mode="before")
    @classmethod
    def format_month(cls, value: date) -> str:
        return value.strftime("%Y-%m")
    
class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    kind: str

class TransactionCreate(BaseModel):
    transaction_type: Literal["income", "expense"]
    amount: Decimal = Field(gt=0, le=1_000_000_000, max_digits=12, decimal_places=2)
    category_id: int
    description: str | None = Field(default=None, max_length=255) #can be null, defaults to None
    transaction_date: date


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    transaction_type: str
    amount: float
    category_id: int | None
    description: str | None
    transaction_date: date
    created_at: datetime
