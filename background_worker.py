import time
import schedule
from pipeline import main as run_pipeline

def job():
    print("Running the data processing pipeline...")
    run_pipeline()
    print("Pipeline finished.")

if __name__ == "__main__":
    schedule.every().hour.do(job)
    print("Background worker started. Will run every hour.")
    while True:
        schedule.run_pending()
        time.sleep(1)
