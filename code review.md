# Code Review - Users API
## Changes to be made

1. On the users_api swagger please group endpoints per resource, e.g health, user and pre_approved
2. Check the shutdown logic for both the APIs, ensure that the graceful shutdown does not cause any memory leaks or zombie connections. Implement cleanup calls on Synapse and ensure users api calls it.
3. The **POST** `/api/v1/users/pre-approve` endpoint should validate that the role is either "admin" or "user". If the validation fails, it should return a 400 Bad Request response with an appropriate error message.
4. The **PATCH** `/api/v1/users/pre-approve` endpoint should validate that the role is either "admin" or "user". If the validation fails, it should return a 400 Bad Request response with an appropriate error message.
5. The **POST** `/api/v1/users/` endpoint shouldn't exist, as users should only be created through the pre-approval process. This endpoint should be removed to prevent unauthorized user creation. Remove this endpoint from both User API and the BFF api
6. The **PATCH** `/api/v1/users/{uid}` endpoint should return a 400 Bad Request response if the request body is empty or only contains invalid fields. This will help ensure that updates are meaningful and prevent unintended consequences from invalid requests.
7. The **GET** `/api/v1/users/` endpoint is currently returning a 500 error with logs indicating "FirebaseFirestore is not defined". This issue needs to be investigated and resolved to ensure that the endpoint functions correctly and returns the expected list of users.
8. Fix any test errors and typescript errors in all the codebase.


## User API Endpoints

### **Health**
Liveness and readiness probes for the Users API service.

* **GET** `/health/live`
    * Liveness probe
    * OK
* **GET** `/health/ready`
    * Readiness probe
    * OK

---

### **Users**
CRUD operations for Firestore user documents and role resolution.

#### **Authentication & Authorization**
* **POST** `/api/v1/users/authorize`
    * Authorize a user (BFF login flow)
    * Ok

#### **Pre-Approval (Admin Only)**
* **GET** `/api/v1/users/pre-approve`
    * List or get pre-approved users
    * Ok
* **POST** `/api/v1/users/pre-approve`
    * Add a pre-approved user
    * changes needed
* **PATCH** `/api/v1/users/pre-approve`
    * Update a pre-approved user
    * changes needed
* **DELETE** `/api/v1/users/pre-approve`
    * Delete a pre-approved user
    * Ok

#### **User Management**
* **GET** `/api/v1/users/`
    * List users
    * Returns 500 logs say "FirebaseFirestore is not defined"
* **POST** `/api/v1/users/`
    * Create a new user (**Admin only**)
    * Shouldn't exist, only create users through pre-approval
* **GET** `/api/v1/users/{uid}`
    * Get user by UID
    * Ok
* **PATCH** `/api/v1/users/{uid}`
    * Update user by UID (**Admin only**)
    * returns 500 if sent with empty body or only invalid fields
* **DELETE** `/api/v1/users/{uid}`
    * Delete user by UID (**Admin only**)
    * Ok
