Here is a quick cheat sheet you can save for whenever you need to bounce between your two setups. 

### 1. Check your current status
If you ever forget which account or project is currently active, run these to check:

* **List all `gcloud` configs:** (The active one will have a `True` in the `IS_ACTIVE` column)
    ```bash
    gcloud config configurations list
    ```
* **List all Firebase accounts:** (The active one will have `(active)` next to it)
    ```bash
    firebase login:list
    ```

---

### 2. Switch to Project A (Your First Account)

When you want to go back to your original project, run these commands in your terminal:

```bash
# 1. Switch gcloud profile (usually named 'default')
gcloud config configurations activate default

# 2. Switch Firebase account
firebase login:use your-first-account@email.com

# 3. Switch Firebase project (use the alias you set, often 'default' or the project ID)
firebase use default 
```

---

### 3. Switch to Project B (Your Second Account)

When you want to jump back to the new project you just set up:

```bash
# 1. Switch gcloud profile 
gcloud config configurations activate project-b

# 2. Switch Firebase account
firebase login:use your-second-account@email.com

# 3. Switch Firebase project 
firebase use YOUR_PROJECT_B_ID 
```

---

### ⚠️ The Local Code Exception (ADC)
Remember, if you are actively running a backend server or a local script that uses Google Cloud SDKs (like connecting to Firestore or Cloud Storage from Node.js/Python), switching the `gcloud` config above isn't enough. 

You must manually refresh your Application Default Credentials for the specific account you are testing:

```bash
gcloud auth application-default login
```