from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    email: Optional[EmailStr] = None


class UserCreate(UserBase):
    password: str = Field(min_length=6, max_length=128)


class UserRead(UserBase):
    id: int
    is_active: bool
    is_admin: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    username: str
    password: str


# ----- Self-service registration & account management -----

class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=6, max_length=128)
    email: Optional[EmailStr] = None
    invite_code: Optional[str] = Field(default=None, max_length=64)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=6, max_length=128)


# ----- Admin: user & invite management -----

class AdminUserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=6, max_length=128)
    email: Optional[EmailStr] = None
    is_admin: bool = False


class AdminResetPassword(BaseModel):
    new_password: str = Field(min_length=6, max_length=128)


class AdminUserRead(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    is_active: bool
    is_admin: bool
    created_at: datetime
    job_count: int = 0

    class Config:
        from_attributes = True


class InviteCreate(BaseModel):
    max_uses: int = Field(default=1, ge=1, le=1000)
    expires_in_days: Optional[int] = Field(default=None, ge=1, le=3650)


class InviteRead(BaseModel):
    id: int
    code: str
    max_uses: int
    used_count: int
    expires_at: Optional[datetime] = None
    created_at: datetime
    is_exhausted: bool = False

    class Config:
        from_attributes = True
