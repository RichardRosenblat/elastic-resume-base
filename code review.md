# Code Review
## Changes to be made

1. On the users_api swagger please group endpoints per resource, e.g health, user and pre_approved
2. Check the shutdown logic for the APIs, ensure that the graceful shutdown does not cause any memory leaks or zombie connections. Implement cleanup calls on Synapse and ensure users api calls it.
3. The **POST** `/api/v1/users/pre-approve` endpoint should validate that the role is either "admin" or "user". If the validation fails, it should return a 400 Bad Request response with an appropriate error message.
4. The **PATCH** `/api/v1/users/pre-approve` endpoint should validate that the role is either "admin" or "user". If the validation fails, it should return a 400 Bad Request response with an appropriate error message.

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
* **POST** `/api/v1/users/`
    * Create a new user (**Admin only**)
* **GET** `/api/v1/users/{uid}`
    * Get user by UID
* **PATCH** `/api/v1/users/{uid}`
    * Update user by UID (**Admin only**)
* **DELETE** `/api/v1/users/{uid}`
    * Delete user by UID (**Admin only**)
