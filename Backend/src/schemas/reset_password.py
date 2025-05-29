from pydantic import BaseModel,EmailStr



class ResetPasswordInput(BaseModel):
    token: str
    new_password: str



class ForgotPasswordRequest(BaseModel):
    email: EmailStr
