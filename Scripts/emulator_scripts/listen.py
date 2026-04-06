import os
import time
import uuid
from google.cloud import pubsub_v1

# --- Configuration ---
os.environ["PUBSUB_EMULATOR_HOST"] = "127.0.0.1:8085"
PROJECT_ID = "elastic-resume-base" # MUST match your local emulator project ID

def start_listening():
    print(f"Connecting to emulator at {os.environ['PUBSUB_EMULATOR_HOST']}...")
    
    publisher = pubsub_v1.PublisherClient()
    subscriber = pubsub_v1.SubscriberClient()
    project_path = f"projects/{PROJECT_ID}"
    
    # 1. Fetch all topics currently registered in the emulator
    try:
        topics = list(publisher.list_topics(request={"project": project_path}))
    except Exception as e:
        print(f" [!] Failed to list topics. Is the emulator running? Error: {e}")
        return

    if not topics:
        print(" [!] No topics found in the emulator. Nothing to listen to.")
        return

    print(f"Found {len(topics)} topic(s). Setting up debug subscriptions...\n")

    futures = []

    # Helper function to generate a specific callback for each topic
    def create_callback(topic_name):
        def callback(message):
            print(f"\n[+] MESSAGE RECEIVED ON TOPIC: '{topic_name}'")
            print(f"    Payload: {message.data.decode('utf-8')}")
            if message.attributes:
                print("    Attributes:")
                for key, value in message.attributes.items():
                    print(f"      {key}: {value}")
            # Acknowledge the message so it doesn't get pulled again
            message.ack()
        return callback

    # 2. Loop through every topic and attach a listener
    for topic in topics:
        topic_short_name = topic.name.split('/')[-1]
        
        # Create a unique, ephemeral subscription name using a UUID
        # This ensures we don't accidentally steal messages from your main app's subscriptions
        sub_id = f"debug-listener-{topic_short_name}-{uuid.uuid4().hex[:6]}"
        subscription_path = subscriber.subscription_path(PROJECT_ID, sub_id)
        
        try:
            subscriber.create_subscription(request={"name": subscription_path, "topic": topic.name})
            
            # Subscribe and store the background thread "future"
            future = subscriber.subscribe(subscription_path, callback=create_callback(topic_short_name))
            futures.append(future)
            
            print(f" [*] Listening to: {topic_short_name} (via {sub_id})")
        except Exception as e:
            print(f" [!] Failed to subscribe to {topic_short_name}: {e}")

    print("\nListening for messages... (Press CTRL+C to quit)")

    # 3. Keep the main thread alive so the background threads can keep listening
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping listeners...")
        for future in futures:
            future.cancel()
        print("Done.")

if __name__ == "__main__":
    start_listening()