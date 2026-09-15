import requests

# 1. Register
reg_data = {"email": "test99@example.com", "password": "SecurePassword123!"}
requests.post("http://127.0.0.1:8000/api/v1/auth/register", json=reg_data)

# 2. Login
login_data = {"username": "test99@example.com", "password": "SecurePassword123!"}
res = requests.post("http://127.0.0.1:8000/api/v1/auth/login", data=login_data)
token = res.json().get("access_token")

# 3. Hit dashboard
headers = {"Authorization": f"Bearer {token}"}
dash_res = requests.get("http://127.0.0.1:8000/api/v1/dashboard/", headers=headers)
print("Dashboard Status:", dash_res.status_code)
print("Dashboard Response:", dash_res.text)

# Also test rates
rates_res = requests.get("http://127.0.0.1:8000/api/v1/forex/rates", headers=headers)
print("Rates Status:", rates_res.status_code)
print("Rates Response:", rates_res.text)
