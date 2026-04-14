import os
import sys
import subprocess
import firebase_admin
from firebase_admin import auth
from google.cloud import pubsub_v1

# --- Configuration ---
PROJECT_ID = "elastic-resume-base" # MUST match your local emulator project ID
PUBSUB_EMULATOR_HOST = "127.0.0.1:8085"
AUTH_EMULATOR_HOST = "127.0.0.1:9099" # Default Firebase Auth emulator port
TOPICS = ["resume-ingested", "dead-letter-queue", "resume-indexed"] # Update with your actual topics

def seed_pubsub():
    print("\n--- Seeding Pub/Sub ---")
    os.environ["PUBSUB_EMULATOR_HOST"] = PUBSUB_EMULATOR_HOST
    publisher = pubsub_v1.PublisherClient()

    for topic_id in TOPICS:
        topic_path = publisher.topic_path(PROJECT_ID, topic_id)
        try:
            publisher.create_topic(request={"name": topic_path})
            print(f" [+] Created topic: {topic_path}")
        except Exception as e:
            print(f" [*] Topic {topic_path} might already exist. ({e})")

def seed_subscriptions():
    print("\n--- Seeding Pub/Sub Subscriptions ---")
    os.environ["PUBSUB_EMULATOR_HOST"] = PUBSUB_EMULATOR_HOST
    
    subscriber = pubsub_v1.SubscriberClient()
    publisher = pubsub_v1.PublisherClient()
    
    topic_path = publisher.topic_path(PROJECT_ID, "resume-ingested")
    subscription_path = subscriber.subscription_path(PROJECT_ID, "resume-ingested-sub")
    
    try:
        subscriber.create_subscription(request={"name": subscription_path, "topic": topic_path})
        print(f" [+] Created subscription: {subscription_path}")
    except Exception as e:
        print(f" [*] Subscription {subscription_path} might already exist. ({e})")

def seed_auth():
    print("\n--- Seeding Firebase Auth ---")
    os.environ["FIREBASE_AUTH_EMULATOR_HOST"] = AUTH_EMULATOR_HOST
    
    try:
        firebase_admin.get_app()
    except ValueError:
        firebase_admin.initialize_app(options={"projectId": PROJECT_ID})

    email = "test@testerson.com"
    password = "qweqwe"

    try:
        user = auth.create_user(email=email, password=password)
        print(f" [+] Successfully created user: {user.uid} ({email})")
    except Exception as e:
        if "email-already-exists" in str(e):
            print(f" [*] User {email} already exists in the emulator.")
        else:
            print(f" [!] Failed to create user: {e}")

def start_listener():
    print("\n--- Launching Listener ---")
    
    # Calculate the path to listen.py assuming it is in your project root
    # __file__ is in Scripts/emulator_scripts/, so we go two folders up
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    listen_script = os.path.join(root_dir, "./Scripts/emulator_scripts/listen.py")
    
    if not os.path.exists(listen_script):
        print(f" [!] Could not find listen.py at {listen_script}. Skipping auto-launch.")
        return

    # sys.executable gets the path to the current venv's python.exe
    python_exe = sys.executable
    
    print(" [+] Opening new terminal window for listen.py...")
    try:
        if sys.platform == "win32":
            # Windows command
            cmd = f'start "Pub/Sub Listener" cmd /k "{python_exe} {listen_script}"'
            subprocess.Popen(cmd, shell=True)
        elif sys.platform == "darwin":
            # macOS AppleScript command
            cmd = f'''osascript -e 'tell app "Terminal" to do script "{python_exe} {listen_script}"' '''
            subprocess.Popen(cmd, shell=True)
        else:
            # Linux (attempts to use gnome-terminal)
            cmd = f'gnome-terminal -- {python_exe} {listen_script}'
            subprocess.Popen(cmd, shell=True)
    except Exception as e:
        print(f" [!] Failed to launch terminal window: {e}")

if __name__ == "__main__":
    print("Starting emulator seeding...")
    seed_pubsub()
    seed_subscriptions()
    seed_auth()
    start_listener()
    print("\nSeeding complete!")