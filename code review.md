# Code Review 

Make the following improvements to the BFF API endpoints and User API endpoints to enhance error handling, validation, and consistency

Ensure the code changes are properly tested and do not change any other endpoints or functionality beyond what is specified in the to-do list.

Make sure the endpoints of BFF properly reflect any changes made to the User API endpoints, including path, querystring parameters, and request body changes. and that the BFF service properly handles any new error responses or validation logic added to the User API endpoints.

## BFF API Endpoint

### 👥 BFF Users endpoints

* **PATCH** `/api/v1/users/{uid}`
    * role validation is not being enforced, allowing admin users to define roles that do not exist
    * body validation error messages could be improved to specify the invalid field and expected values
* **DELETE** `/api/v1/users/{uid}`
    * calls from admins return a 502 downstream error, likely from BFF sending a no body request with content-type application/json, which the Users API does not accept. This returns an error that the BFF service recasts to a 502

* **GET** `/api/v1/users/pre-approve`
    * role querystring parameter is not being enforced, allowing admin users to query with roles that do not exist and searches with roles that do exist do not filter results as expected
* **POST** `/api/v1/users/pre-approve`
    * Adding a user with an email that is already pre-approved returns a 502 downstream error, likely from BFF not expecting a 409 conflict response from the Users API, which would be more appropriate for this scenario
* **PATCH** `/api/v1/users/pre-approve`
    * Updating a pre-approved with a body without valid fields returns a 502 downstream error, likely from BFF not expecting a 400 bad request response from the Users API, which would be more appropriate for this scenario
* **DELETE** `/api/v1/users/pre-approve`
    * calls from admins return a 502 downstream error, likely from BFF sending a no body request with content-type application/json, which the Users API does not accept. This returns an error that the BFF service recasts to a 502

---



## User API Endpoint changes

Changes to the path, querystring parameters, or request body of the User API endpoints should be reflected in the BFF API endpoints as well, to ensure consistency and proper functionality.

### **Authentication & Authorization**
* **POST** `/api/v1/users/authorize`
    * Add logic to auto-update the user's email in the Firestore collection if it differs from the email provided by the BFF API during authorization, to handle cases where the user's email may have changed in the authentication provider (e.g., Firebase Auth).

### **Pre-Approval (Admin Only)**
* **GET** `/api/v1/users/pre-approve`
    * Improve **querystring validation** error messages to specify the invalid field and expected values.
* **POST** `/api/v1/users/pre-approve`
    * Improve **body validation** error messages to specify the invalid field and expected values.
* **PATCH** `/api/v1/users/pre-approve`
    * Improve **body validation** error messages to specify the invalid field and expected values.

### **User Management**
* **GET** `/api/v1/users/`
    * Add an `email` filter to the **querystring parameters**.
    * Improve **querystring validation** error messages to indicate specific invalid fields and expected values.
* **PATCH** `/api/v1/users/{uid}`
    * Improve **body validation** error messages to specify the invalid field and expected values.
