from passlib.context import CryptContext

# Initialize password context for bcrypt hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Function to hash a password
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

# Function to verify if the provided password matches the stored hashed password
def verify_password(plain_password: str, hashed_password: str) -> bool:
    print(pwd_context.verify(plain_password, hashed_password))
    return pwd_context.verify(plain_password, hashed_password)
