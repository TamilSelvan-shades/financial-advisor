# Authentication Implementation Plan

This document outlines the step-by-step implementation plan for adding multi-tenant authentication and security to the application.

> [!IMPORTANT]  
> Please review this plan. Once you approve it, we will begin writing the Python code and modifying the project files.

## 1. Dependencies
We will add the following packages to `requirements.txt` and install them in the active virtual environment:
- `pyjwt`: For generating and verifying JSON Web Tokens.
- `passlib[argon2]`: For secure password hashing (Argon2 is highly recommended over bcrypt).
- `python-multipart`: Required by FastAPI to process form data for the OAuth2 password flow.

## 2. Auth Utility Module (`auth.py`)
We will create a new file named `auth.py` to encapsulate all security-related functions:
- **Password Hashing:** Function to hash plain-text passwords securely using Argon2.
- **Password Verification:** Function to verify an inputted password against the stored hash.
- **Token Creation (`create_access_token`):** Function to generate a JWT access token with a 15-minute expiration time.
- **Token Decoding:** Function to decode, validate, and extract claims from the JWT.

## 3. Pydantic Schemas (`schemas.py`)
We will add the necessary schemas for data validation during authentication:
- `UserCreate`: Schema for user registration (requires `email` and `password`).
- `UserResponse`: Schema for returning user data (must exclude the `hashed_password`).
- `Token`: Schema for the token response, containing `access_token` and `token_type` (usually `"bearer"`).
- *(Note: For the login request, we will use FastAPI's built-in `OAuth2PasswordRequestForm` which handles standard form-encoded username/password login).*

## 4. FastAPI Dependency (`get_current_user`)
We will implement a `get_current_user` dependency (likely in `auth.py` or a dedicated `dependencies.py`):
- Validate the `Bearer <token>` header from incoming requests.
- Decode the JWT to extract the user's email or UUID.
- Query the database for the corresponding active `User` model.
- Raise `HTTPException(status_code=401)` if the token is invalid, expired, or the user is inactive.

## 5. New Auth Endpoints
We will create the authentication endpoints (e.g., in a new `routers/auth.py` or directly in `main.py`):
- **`POST /api/v1/auth/register`**: Endpoint to register a new user. It hashes the password, stores the new `User` in the database, and returns a `UserResponse`.
- **`POST /api/v1/auth/login`**: Endpoint to authenticate a user. It validates the email/password combination and returns a `Token` containing the JWT access token.

## Step-by-Step Implementation Order

- [ ] **Step 1: Install Dependencies** - Update `requirements.txt` and run `pip install`.
- [ ] **Step 2: Update Schemas** - Add the authentication Pydantic models to `schemas.py`.
- [ ] **Step 3: Create Auth Utilities** - Implement hashing, token generation, and the `get_current_user` dependency in `auth.py`.
- [ ] **Step 4: Create Endpoints** - Implement the `/register` and `/login` routes.
- [ ] **Step 5: Secure Existing Endpoints** - (Optional/Next Step) Begin applying the `get_current_user` dependency to existing business logic endpoints to enforce multi-tenancy.

## Open Questions

> [!NOTE]  
> - **Secret Key:** We will need a secret key for JWT encoding. I will set it up to read from an environment variable (e.g., `SECRET_KEY` in `.env`), with a fallback or error if missing.
> - **Router Structure:** Currently, the application has a `main.py` and `app.py`. Where would you prefer the auth endpoints to be placed? (e.g., inside `main.py`, or a separate `routers/auth.py`?)
