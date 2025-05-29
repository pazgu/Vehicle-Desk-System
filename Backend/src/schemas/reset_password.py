from pydantic import BaseModel



class ResetPasswordInput(BaseModel):
    token: str
    new_password: str